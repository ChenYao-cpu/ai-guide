#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   knowledge_base.py
@Time    :   2026/06/10
@Project :   景区导览AI数字人
@Desc    :   知识库管理接口
"""

import hashlib
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from loguru import logger

from ...web_configs import API_CONFIG, WEB_CONFIGS
from ..database.knowledge_doc_db import (
    add_knowledge_doc,
    delete_knowledge_doc,
    get_db_knowledge_docs,
    update_doc_status,
)
from ..models.tour_models import KnowledgeDocument
from ..modules.rag.rag_worker import rebuild_tour_rag_db
from ..utils import ResultCode, make_return_data
from .users import get_current_user_info

router = APIRouter(
    prefix="/knowledge-base",
    tags=["knowledge-base"],
    responses={404: {"description": "Not found"}},
)


@router.get("/list", summary="获取知识库文档列表")
async def get_knowledge_doc_list(
    currentPage: int = 1,
    pageSize: int = 10,
    user_id: int = Depends(get_current_user_info),
):
    docs, total = await get_db_knowledge_docs(user_id, currentPage, pageSize)

    return make_return_data(
        True,
        ResultCode.SUCCESS,
        "成功",
        {"doc_list": docs, "currentPage": currentPage, "pageSize": pageSize, "totalSize": total},
    )


@router.post("/upload", summary="上传知识库文档")
async def upload_knowledge_doc(
    title: str = "",
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_info),
):
    """上传景区知识文档（支持 PDF/Word/TXT）"""
    file_type = file.filename.split(".")[-1].lower()
    allowed_types = ["pdf", "docx", "doc", "txt", "md"]

    if file_type not in allowed_types:
        return make_return_data(False, ResultCode.FAIL, f"不支持的文件类型: {file_type}", "")

    # 保存文件
    upload_time_str = str(int(time.time())) + "__" + str(uuid.uuid4().hex)
    save_dir = Path(WEB_CONFIGS.SERVER_FILE_ROOT).joinpath(
        WEB_CONFIGS.TOUR_FILE_DIR, WEB_CONFIGS.KNOWLEDGE_BASE_DIR
    )
    save_dir.mkdir(exist_ok=True, parents=True)

    save_filename = upload_time_str + "." + file_type
    save_path = save_dir / save_filename

    with open(save_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # 计算内容哈希
    content_hash = hashlib.sha256(content).hexdigest()[:16]

    # 创建数据库记录
    doc_title = title if title else file.filename
    relative_path = str(Path(WEB_CONFIGS.TOUR_FILE_DIR) / WEB_CONFIGS.KNOWLEDGE_BASE_DIR / save_filename)

    doc = KnowledgeDocument(
        title=doc_title,
        file_path=relative_path,
        file_type=file_type,
        content_hash=content_hash,
        status="pending",
        user_id=user_id,
    )
    doc = await add_knowledge_doc(doc)

    # 异步触发 RAG 重建
    try:
        await update_doc_status(doc.doc_id, "processing")
        await rebuild_tour_rag_db(user_id)
        await update_doc_status(doc.doc_id, "completed", chunk_count=-1)  # chunk count updated by feature_store
    except Exception as e:
        logger.error(f"RAG rebuild failed: {e}")
        await update_doc_status(doc.doc_id, "failed")

    return make_return_data(True, ResultCode.SUCCESS, "上传成功", {"doc_id": doc.doc_id})


@router.delete("/delete/{docId}", summary="删除知识库文档")
async def remove_knowledge_doc(docId: int, user_id: int = Depends(get_current_user_info)):
    success = await delete_knowledge_doc(docId, user_id)

    if not success:
        return make_return_data(False, ResultCode.FAIL, "删除失败", "")

    # 重建 RAG
    try:
        await rebuild_tour_rag_db(user_id)
    except Exception as e:
        logger.warning(f"RAG rebuild after delete failed: {e}")

    return make_return_data(True, ResultCode.SUCCESS, "成功", "")


@router.post("/reindex", summary="触发知识库重建索引")
async def reindex_knowledge_base(user_id: int = Depends(get_current_user_info)):
    """手动触发 RAG 向量数据库重建"""
    try:
        await rebuild_tour_rag_db(user_id)
        return make_return_data(True, ResultCode.SUCCESS, "重建索引完成", "")
    except Exception as e:
        logger.error(f"Reindex failed: {e}")
        return make_return_data(False, ResultCode.FAIL, f"重建失败: {str(e)}", "")


@router.get("/test-qa", summary="知识问答评测")
async def test_qa_accuracy(user_id: int = Depends(get_current_user_info)):
    """逐题执行 RAG+LLM，并返回可解释的关键词覆盖评测报告。"""
    del user_id  # 鉴权依赖已完成，本评测使用管理员共享题集。
    import json
    import os
    from datetime import datetime, timezone
    from pathlib import Path

    from ..modules.evaluation_metrics import evaluate_keyword_coverage

    try:
        test_qa_path = Path("./configs/test_qa.json")
        if not test_qa_path.exists():
            return make_return_data(False, ResultCode.FAIL, "测试问题集不存在，请先创建 configs/test_qa.json", "")

        try:
            with open(test_qa_path, "r", encoding="utf-8") as f:
                test_questions = json.load(f)
        except Exception:
            return make_return_data(False, ResultCode.FAIL, "测试问题集解析失败", "")

        if not test_questions:
            return make_return_data(False, ResultCode.FAIL, "测试问题集为空", "")

        if not WEB_CONFIGS.ENABLE_RAG:
            return make_return_data(
                False,
                ResultCode.FAIL,
                "当前未启用 RAG，无法执行知识库评测。请设置 ENABLE_RAG=true 并重启服务。",
                "",
            )

        from ..modules.rag import rag_worker
        from ..utils import LLM_MODEL_HANDLER

        if rag_worker.TOUR_RAG_RETRIEVER is None:
            return make_return_data(
                False,
                ResultCode.FAIL,
                "RAG 检索器尚未加载，请先上传知识文档并重建索引。",
                "",
            )

        model_name = os.getenv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
        results = []
        correct_count = 0
        started_at = time.perf_counter()

        for idx, tq in enumerate(test_questions):
            question = tq.get("question", "")
            expected = tq.get("expected_answer", "")
            expected_keywords = tq.get("expected_keywords", expected)
            spot_name = tq.get("spot_name", "")
            source_doc = tq.get("source_doc", "")
            category = tq.get("category", "")
            item_started_at = time.perf_counter()

            logger.info(f"准确率自测 Q{idx+1}/{len(test_questions)}: {question[:40]}...")

            # RAG 检索
            try:
                rag_prompt, references = rag_worker.build_tour_rag_prompt(
                    rag_worker.TOUR_RAG_RETRIEVER,
                    spot_name,
                    question,
                )
            except Exception as e:
                logger.warning(f"Q{idx+1} RAG检索失败: {e}")
                results.append(
                    {
                        "question": question,
                        "spot_name": spot_name,
                        "source_doc": source_doc,
                        "category": category,
                        "expected_answer": expected,
                        "expected_keywords": expected_keywords,
                        "actual_answer": "",
                        "matched_keywords": [],
                        "matched_count": 0,
                        "required_count": 0,
                        "keyword_coverage": 0.0,
                        "reference_count": 0,
                        "duration_ms": round((time.perf_counter() - item_started_at) * 1000),
                        "is_correct": False,
                        "error": f"RAG检索失败: {e}",
                    }
                )
                continue

            # LLM 生成答案
            try:
                response = LLM_MODEL_HANDLER.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "你是颐和园智能导游。请只根据提供的知识库资料作答，"
                                "第一句直接回答问题，再用不超过两句话补充依据；"
                                "不得混入其他景区信息，不得编造数字。"
                            ),
                        },
                        {"role": "user", "content": rag_prompt},
                    ],
                    stream=False,
                    temperature=0.3,
                    # 评测任务是基于知识片段的事实抽取，不需要推理模式。
                    # 显式关闭思考可避免 reasoning_content 耗尽输出额度，
                    # 从而出现正文为空、被误判为知识库回答错误的问题。
                    reasoning_effort="none",
                    extra_body={"thinking": {"type": "disabled"}},
                    max_tokens=300,
                    timeout=30,
                )
                actual_answer = (response.choices[0].message.content or "").strip()
                if not actual_answer:
                    raise RuntimeError("模型返回空答案")
            except Exception as e:
                logger.warning(f"Q{idx+1} LLM调用失败: {e}")
                actual_answer = ""
                llm_error = f"LLM调用失败: {e}"
            else:
                llm_error = ""

            evaluation = evaluate_keyword_coverage(expected_keywords, actual_answer)
            is_correct = evaluation["is_correct"] and not llm_error

            if is_correct:
                correct_count += 1

            results.append(
                {
                    "question": question,
                    "spot_name": spot_name,
                    "source_doc": source_doc,
                    "category": category,
                    "expected_answer": expected,
                    "expected_keywords": ",".join(evaluation["keywords"]),
                    "actual_answer": actual_answer[:500],
                    "matched_keywords": evaluation["matched_keywords"],
                    "matched_count": evaluation["matched_count"],
                    "required_count": evaluation["required_count"],
                    "keyword_coverage": evaluation["coverage"],
                    "reference_count": len(references or []),
                    "duration_ms": round((time.perf_counter() - item_started_at) * 1000),
                    "is_correct": is_correct,
                    "error": llm_error,
                }
            )

        total = len(test_questions)
        accuracy = round(correct_count / total * 100, 1) if total > 0 else 0

        logger.info(f"知识问答评测完成: {accuracy}% ({correct_count}/{total})")

        return make_return_data(
            True,
            ResultCode.SUCCESS,
            "评测完成",
            {
                "total": total,
                "correct": correct_count,
                "accuracy": accuracy,
                "passed": accuracy >= 90.0,
                "metric_name": "关键词覆盖通过率",
                "pass_threshold": 90.0,
                "evaluation_method": "RAG检索 + LLM生成；每题命中30%关键词且最多要求3个关键词",
                "model_name": model_name,
                "rag_enabled": True,
                "duration_ms": round((time.perf_counter() - started_at) * 1000),
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "details": results,
            },
        )
    except Exception as e:
        logger.error(f"Accuracy test unexpected error: {e}", exc_info=True)
        return make_return_data(False, ResultCode.FAIL, f"自测执行异常: {str(e)}", "")
