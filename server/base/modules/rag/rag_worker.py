import os
import re
import shutil
from pathlib import Path
from typing import Any

from loguru import logger

from ....web_configs import WEB_CONFIGS
from ...database.product_db import get_db_product_info

# 基础配置
CONTEXT_MAX_LENGTH = 3000  # 上下文最大长度
GENERATE_TEMPLATE = "这是说明书：\"{}\"\n 客户的问题：\"{}\" \n 请阅读说明并运用你的性格进行解答。"  # RAG prompt 模板

# 景区导览 RAG 配置
TOUR_CONTEXT_MAX_LENGTH = 3600  # 景区知识库上下文最大长度
TOUR_GENERATE_TEMPLATE = (
    "【景区知识库资料】\n{}\n\n"
    "【游客问题】\n{}\n\n"
    "请根据以上景区资料回答游客的问题。要求：\n"
    "1. 资料中有的信息请准确引用，简洁作答（控制在3-5句话内）；\n"
    "2. 资料中可能包含表格数据（用 | 分隔），请提取关键信息作答，不要原样输出管道符；\n"
    "3. 只使用与本轮景点和问题有关的资料；资料未记载的纹样、典故、年代、设施位置不得补写。"
    "缺少某项资料时只说明该项缺失，不要转去讲其他景区；\n"
    "4. 严禁出现【XX】格式的占位符，每个细节都要写具体。"
)  # 景区导览 RAG prompt 模板

# RAG 实例句柄
RAG_RETRIEVER = None
TOUR_RAG_RETRIEVER = None  # 景区知识库 RAG 实例


class LightweightTourRetriever:
    """面向中小型景区知识库的轻量级字符 TF-IDF 检索器。

    不依赖常驻的大型 embedding/reranker 模型，适合比赛现场和普通笔记本；
    检索到的原文仍会进入大模型上下文，因此保持完整 RAG 工作流。
    """

    def __init__(self, records: list[tuple[str, str]]):
        from sklearn.feature_extraction.text import TfidfVectorizer

        self.records: list[tuple[str, str]] = []
        for source, text in records:
            paragraphs = [part.strip() for part in re.split(r"\n\s*\n|(?<=[。！？])", text) if part.strip()]
            buffer = ""
            for paragraph in paragraphs:
                buffer = f"{buffer}\n{paragraph}".strip()
                if len(buffer) >= 180:
                    self.records.append((source, buffer))
                    buffer = ""
            if buffer:
                self.records.append((source, buffer))

        if not self.records:
            raise RuntimeError("景区知识库中没有可检索文本")

        self.vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(1, 3), sublinear_tf=True)
        self.matrix = self.vectorizer.fit_transform([text for _, text in self.records])

    def get(self, fs_id: str = "tour_default", **_: Any):
        return self

    def query(self, question: str, context_max_length: int = TOUR_CONTEXT_MAX_LENGTH):
        import numpy as np

        query_vector = self.vectorizer.transform([question])
        scores = (self.matrix @ query_vector.T).toarray().ravel()
        ranked = np.argsort(scores)[::-1]
        selected = [int(index) for index in ranked[:5] if scores[index] > 0.01]
        if not selected and len(ranked):
            selected = [int(ranked[0])]

        chunks: list[str] = []
        references: list[str] = []
        context = ""
        for index in selected:
            source, text = self.records[index]
            remaining = context_max_length - len(context)
            if remaining <= 0:
                break
            excerpt = text[:remaining]
            chunks.append(excerpt)
            context += f"【来源：{source}】\n{excerpt}\n"
            if source not in references:
                references.append(source)
        return "\n".join(chunks), context[:context_max_length], references


async def _load_lightweight_tour_retriever(user_id: int) -> LightweightTourRetriever:
    from ...database.knowledge_doc_db import get_all_knowledge_file_paths
    from .file_operation import FileOperation

    records: list[tuple[str, str]] = []
    file_operator = FileOperation()
    for file_path in await get_all_knowledge_file_paths(user_id):
        source_path = Path(WEB_CONFIGS.SERVER_FILE_ROOT) / file_path
        if not source_path.exists():
            logger.warning(f"Knowledge file not found: {source_path}")
            continue
        if source_path.suffix.lower() in {".md", ".txt", ".text"}:
            text = source_path.read_text(encoding="utf-8", errors="ignore")
        else:
            text, error = file_operator.read(str(source_path))
            if error:
                logger.warning(f"Knowledge file read failed: {source_path}: {error}")
                continue
        if text and text.strip():
            records.append((source_path.name, text.strip()))

    retriever = LightweightTourRetriever(records)
    logger.info(f"Lightweight tour RAG loaded: {len(records)} documents, {len(retriever.records)} chunks")
    return retriever


def build_rag_prompt(rag_retriever: Any, product_name, prompt):

    real_retriever = rag_retriever.get(fs_id="default")

    if isinstance(real_retriever, tuple):
        logger.info(f" @@@ GOT real_retriever == tuple : {real_retriever}")
        return ""

    chunk, db_context, references = real_retriever.query(
        f"商品名：{product_name}。{prompt}", context_max_length=CONTEXT_MAX_LENGTH - 2 * len(GENERATE_TEMPLATE)
    )
    logger.info(f"db_context = {db_context}")

    if db_context is not None and len(db_context) > 1:
        prompt_rag = GENERATE_TEMPLATE.format(db_context, prompt)
    else:
        logger.info("db_context get error")
        prompt_rag = prompt

    logger.info(f"RAG reference = {references}")
    logger.info("=" * 20)

    return prompt_rag


def build_tour_rag_prompt(rag_retriever: Any, spot_name: str, prompt: str) -> tuple:
    """构建景区导览 RAG prompt

    Args:
        rag_retriever: RAG检索器实例
        spot_name: 当前景点名称
        prompt: 游客原始问题

    Returns:
        tuple: (增强后的prompt, 引用来源列表)
    """
    real_retriever = rag_retriever.get(fs_id="tour_default")

    if isinstance(real_retriever, tuple):
        logger.info(f" @@@ Tour RAG not ready: {real_retriever}")
        return prompt, []

    query_text = f"景点：{spot_name}。游客问题：{prompt}"
    chunk, db_context, references = real_retriever.query(
        query_text, context_max_length=TOUR_CONTEXT_MAX_LENGTH - len(TOUR_GENERATE_TEMPLATE)
    )
    logger.info(f"Tour db_context length: {len(db_context) if db_context else 0}")

    # A shared index must not override the active dossier with another park.
    if spot_name and db_context and spot_name not in db_context:
        return prompt, []
    if db_context is not None and len(db_context) > 1:
        prompt_rag = TOUR_GENERATE_TEMPLATE.format(db_context, prompt)
    else:
        logger.info("Tour db_context empty, using original prompt")
        prompt_rag = prompt
        references = []

    logger.info(f"Tour RAG references = {references}")
    logger.info("=" * 20)

    return prompt_rag, references


def init_rag_retriever(rag_config: str, db_path: str):
    import torch
    from .retriever import CacheRetriever

    torch.cuda.empty_cache()

    retriever = CacheRetriever(config_path=rag_config)

    # 初始化
    retriever.get(fs_id="default", config_path=rag_config, work_dir=db_path)

    return retriever


def init_tour_rag_retriever(rag_config: str, db_path: str):
    """初始化景区知识库 RAG 检索器"""
    import torch
    from .retriever import CacheRetriever

    torch.cuda.empty_cache()

    retriever = CacheRetriever(config_path=rag_config)

    # 初始化
    retriever.get(fs_id="tour_default", config_path=rag_config, work_dir=db_path)

    return retriever


async def gen_rag_db(user_id, force_gen=False):
    """
    生成向量数据库。

    参数:
    force_gen - 布尔值，当设置为 True 时，即使数据库已存在也会重新生成数据库。
    """

    # 检查数据库目录是否存在，如果存在且force_gen为False，则不执行生成操作
    if Path(WEB_CONFIGS.RAG_VECTOR_DB_DIR).exists() and not force_gen:
        return

    if force_gen and Path(WEB_CONFIGS.RAG_VECTOR_DB_DIR).exists():
        shutil.rmtree(WEB_CONFIGS.RAG_VECTOR_DB_DIR)

    # 仅仅遍历 instructions 字段里面的文件
    if Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).exists():
        shutil.rmtree(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP)
    Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).mkdir(exist_ok=True, parents=True)

    # 读取 yaml 文件，获取所有说明书路径，并移动到 tmp 目录
    product_list, _ = await get_db_product_info(user_id)

    for info in product_list:

        shutil.copyfile(
            Path(
                WEB_CONFIGS.SERVER_FILE_ROOT,
                WEB_CONFIGS.PRODUCT_FILE_DIR,
                WEB_CONFIGS.INSTRUCTIONS_DIR,
                Path(info.instruction).name,
            ),
            Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).joinpath(Path(info.instruction).name),
        )

    logger.info("Generating rag database, pls wait ...")
    # 调用函数生成向量数据库
    from .feature_store import gen_vector_db

    gen_vector_db(
        WEB_CONFIGS.RAG_CONFIG_PATH,
        str(Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).absolute()),
        WEB_CONFIGS.RAG_VECTOR_DB_DIR,
    )

    # 删除过程文件
    shutil.rmtree(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP)


async def gen_tour_rag_db(user_id, force_gen=False):
    """生成景区知识库向量数据库

    Args:
        user_id: 用户 ID
        force_gen: 是否强制重新生成
    """
    from ...database.knowledge_doc_db import get_all_knowledge_file_paths

    # 只有响应库和拒答库均完整时才复用索引，避免上次中断留下空目录。
    db_dir = Path(WEB_CONFIGS.RAG_TOUR_KNOWLEDGE_DB_DIR)
    required_indexes = (
        db_dir / "db_response" / "index.faiss",
        db_dir / "db_reject" / "index.faiss",
    )
    index_ready = all(path.exists() for path in required_indexes)
    if db_dir.exists() and not force_gen and index_ready:
        return

    if db_dir.exists() and (force_gen or not index_ready):
        shutil.rmtree(db_dir)

    # 准备临时目录
    tmp_dir = Path(WEB_CONFIGS.TOUR_KNOWLEDGE_GEN_DB_TMP)
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(exist_ok=True, parents=True)

    # 获取所有知识库文档
    knowledge_files = await get_all_knowledge_file_paths(user_id)

    if not knowledge_files:
        logger.warning("No knowledge files found, skipping tour RAG DB generation")
        return

    for file_path in knowledge_files:
        src_path = Path(WEB_CONFIGS.SERVER_FILE_ROOT) / file_path
        if src_path.exists():
            shutil.copyfile(src_path, tmp_dir / Path(file_path).name)
        else:
            logger.warning(f"Knowledge file not found: {src_path}")

    logger.info("Generating tour knowledge rag database, pls wait ...")
    from .feature_store import gen_vector_db

    gen_vector_db(
        WEB_CONFIGS.RAG_CONFIG_PATH,
        str(tmp_dir.absolute()),
        WEB_CONFIGS.RAG_TOUR_KNOWLEDGE_DB_DIR,
    )

    shutil.rmtree(tmp_dir)
    logger.info("Tour RAG database generated successfully")


async def load_rag_model(user_id):

    global RAG_RETRIEVER

    # 重新生成 RAG 向量数据库
    await gen_rag_db(user_id)

    # 加载 rag 模型
    RAG_RETRIEVER = init_rag_retriever(rag_config=WEB_CONFIGS.RAG_CONFIG_PATH, db_path=WEB_CONFIGS.RAG_VECTOR_DB_DIR)
    logger.info("load rag model done !...")


async def load_tour_rag_model(user_id):
    """加载景区知识库 RAG 模型"""
    global TOUR_RAG_RETRIEVER

    if os.getenv("TOUR_RAG_BACKEND", "lightweight").strip().lower() != "vector":
        TOUR_RAG_RETRIEVER = await _load_lightweight_tour_retriever(user_id)
        return

    # 生成景区知识库向量数据库
    await gen_tour_rag_db(user_id)

    # 加载 RAG 模型
    TOUR_RAG_RETRIEVER = init_tour_rag_retriever(
        rag_config=WEB_CONFIGS.RAG_CONFIG_PATH, db_path=WEB_CONFIGS.RAG_TOUR_KNOWLEDGE_DB_DIR
    )
    logger.info("load tour rag model done !...")


async def rebuild_rag_db(user_id, db_name="default"):

    # 重新生成 RAG 向量数据库
    await gen_rag_db(user_id, force_gen=True)

    # 重新加载 retriever
    RAG_RETRIEVER.pop(db_name)
    RAG_RETRIEVER.get(fs_id=db_name, config_path=WEB_CONFIGS.RAG_CONFIG_PATH, work_dir=WEB_CONFIGS.RAG_VECTOR_DB_DIR)


async def rebuild_tour_rag_db(user_id, db_name="tour_default"):
    """重建景区知识库 RAG 数据库"""
    global TOUR_RAG_RETRIEVER

    if os.getenv("TOUR_RAG_BACKEND", "lightweight").strip().lower() != "vector":
        TOUR_RAG_RETRIEVER = await _load_lightweight_tour_retriever(user_id)
        logger.info("Lightweight tour RAG index refreshed")
        return

    await gen_tour_rag_db(user_id, force_gen=True)

    if TOUR_RAG_RETRIEVER:
        TOUR_RAG_RETRIEVER.pop(db_name)
        TOUR_RAG_RETRIEVER.get(
            fs_id=db_name,
            config_path=WEB_CONFIGS.RAG_CONFIG_PATH,
            work_dir=WEB_CONFIGS.RAG_TOUR_KNOWLEDGE_DB_DIR,
        )
    else:
        TOUR_RAG_RETRIEVER = init_tour_rag_retriever(
            rag_config=WEB_CONFIGS.RAG_CONFIG_PATH, db_path=WEB_CONFIGS.RAG_TOUR_KNOWLEDGE_DB_DIR
        )
    logger.info("Tour RAG database rebuilt successfully")
