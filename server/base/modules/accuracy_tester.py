#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   accuracy_tester.py
@Time    :   2026/06/10
@Project :   景区导览AI数字人
@Desc    :   RAG知识库准确率自测模块
"""

import json
import os
from pathlib import Path
from typing import List, Tuple

import numpy as np
from loguru import logger


async def run_accuracy_test(
    test_questions: List[dict],
    rag_retriever,
    llm_handler,
    embedding_model=None,
) -> dict:
    """运行准确率自测

    Args:
        test_questions: 测试问题列表
        rag_retriever: RAG检索器实例
        llm_handler: LLM处理器
        embedding_model: 可选的嵌入模型用于语义相似度计算

    Returns:
        dict: 测试报告
    """
    from ..modules.rag.rag_worker import build_tour_rag_prompt

    model_name = os.getenv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
    results = []
    correct_count = 0
    semantic_correct_count = 0

    for idx, tq in enumerate(test_questions):
        question = tq.get("question", "")
        expected = tq.get("expected_answer", "")
        spot_name = tq.get("spot_name", "")
        category = tq.get("category", "")

        logger.info(f"Testing Q{idx+1}/{len(test_questions)}: {question[:50]}...")

        # Step 1: RAG检索
        try:
            rag_prompt, references = build_tour_rag_prompt(rag_retriever, spot_name, question)
        except Exception as e:
            logger.warning(f"RAG failed for Q{idx+1}: {e}")
            rag_prompt = question
            references = []

        # Step 2: LLM生成
        try:
            response = llm_handler.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "你是景区导游，请根据资料准确回答游客问题。",
                    },
                    {"role": "user", "content": rag_prompt},
                ],
                stream=False,
                temperature=0.3,
                max_tokens=512,
            )
            actual_answer = response.choices[0].message.content
        except Exception as e:
            actual_answer = f"LLM调用失败: {e}"

        # Step 3: 关键词匹配判断
        is_keyword_match = _keyword_match(expected, actual_answer)

        # Step 4: 语义相似度判断（如果提供了embedding模型）
        semantic_score = 0.0
        is_semantic_match = False
        if embedding_model is not None and expected and actual_answer:
            try:
                semantic_score = _semantic_similarity(expected, actual_answer, embedding_model)
                is_semantic_match = semantic_score >= 0.75
            except Exception:
                pass

        if is_keyword_match:
            correct_count += 1
        if is_semantic_match:
            semantic_correct_count += 1

        results.append({
            "id": idx + 1,
            "question": question,
            "expected_answer": expected,
            "actual_answer": actual_answer[:300],
            "category": category,
            "keyword_match": is_keyword_match,
            "semantic_score": round(semantic_score, 2),
            "semantic_match": is_semantic_match,
            "references": references,
        })

    total = len(test_questions)
    keyword_accuracy = round(correct_count / total * 100, 1) if total > 0 else 0
    semantic_accuracy = round(semantic_correct_count / total * 100, 1) if total > 0 else 0

    # 按分类统计
    category_stats = {}
    for r in results:
        cat = r["category"]
        if cat not in category_stats:
            category_stats[cat] = {"total": 0, "correct": 0}
        category_stats[cat]["total"] += 1
        if r["keyword_match"]:
            category_stats[cat]["correct"] += 1

    for cat in category_stats:
        cat_total = category_stats[cat]["total"]
        cat_correct = category_stats[cat]["correct"]
        category_stats[cat]["accuracy"] = round(cat_correct / cat_total * 100, 1) if cat_total > 0 else 0

    report = {
        "total": total,
        "keyword_correct": correct_count,
        "keyword_accuracy": keyword_accuracy,
        "semantic_correct": semantic_correct_count,
        "semantic_accuracy": semantic_accuracy,
        "passed_90": keyword_accuracy >= 90.0,
        "category_stats": category_stats,
        "details": results,
    }

    logger.info(f"Accuracy test complete: {keyword_accuracy}% (keyword), {semantic_accuracy}% (semantic)")
    return report


def _keyword_match(expected: str, actual: str) -> bool:
    """基于关键词匹配判断答案正确性

    Args:
        expected: 预期答案
        actual: 实际答案

    Returns:
        bool: 是否匹配
    """
    if not expected or not actual:
        return False

    # 提取关键词
    expected_keywords = _extract_keywords(expected)
    actual_lower = actual.lower()

    match_count = sum(1 for kw in expected_keywords if kw.lower().strip() in actual_lower)

    # 至少匹配50%的关键词
    threshold = max(1, len(expected_keywords) * 0.5)
    return match_count >= threshold


def _extract_keywords(text: str) -> List[str]:
    """从文本中提取关键词

    Args:
        text: 输入文本

    Returns:
        List[str]: 关键词列表
    """
    # 简单方式：按标点分割
    import re

    # 移除常见停用词
    stop_words = {"的", "了", "在", "是", "有", "和", "与", "或", "及", "等", "等", "吗", "呢", "吧"}

    parts = re.split(r"[，,。；;！!？?\s]+", text)
    keywords = []
    for part in parts:
        part = part.strip()
        if len(part) >= 2 and part not in stop_words:
            keywords.append(part)

    return keywords[:10]  # 最多10个关键词


def _semantic_similarity(text1: str, text2: str, embedding_model) -> float:
    """计算语义相似度

    Args:
        text1: 文本1
        text2: 文本2
        embedding_model: 嵌入模型

    Returns:
        float: 余弦相似度 (0~1)
    """
    try:
        emb1 = embedding_model.embed_query(text1)
        emb2 = embedding_model.embed_query(text2)

        # 余弦相似度
        dot_product = np.dot(emb1, emb2)
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(dot_product / (norm1 * norm2))
    except Exception as e:
        logger.warning(f"Semantic similarity failed: {e}")
        return 0.0


def load_test_questions(file_path: str) -> List[dict]:
    """加载测试问题集

    Args:
        file_path: JSON文件路径

    Returns:
        List[dict]: 测试问题列表
    """
    path = Path(file_path)
    if not path.exists():
        logger.error(f"Test QA file not found: {file_path}")
        return []

    with open(path, "r", encoding="utf-8") as f:
        questions = json.load(f)

    logger.info(f"Loaded {len(questions)} test questions from {file_path}")
    return questions
