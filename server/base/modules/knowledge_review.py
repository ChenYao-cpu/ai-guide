"""Review first; prepare a replacement index before committing publication."""
import asyncio
import hashlib
from pathlib import Path
from sqlmodel import Session, select
from ..models.tour_models import KnowledgeDocument, KnowledgeReview
from ...web_configs import WEB_CONFIGS

KNOWLEDGE_WRITE_LOCK=asyncio.Lock()


def document_path(doc):
    root=Path(WEB_CONFIGS.SERVER_FILE_ROOT).resolve()
    path=(root/doc.file_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('文档路径无效或文件已丢失')
    return path


def read_document(doc):
    path=document_path(doc)
    content=path.read_bytes()
    digest=hashlib.sha256(content).hexdigest()
    if doc.content_hash and not digest.startswith(doc.content_hash):
        raise ValueError('文档内容已变化，请重新上传并审核')
    if path.suffix.lower() in {'.md','.txt'}:
        text=content.decode('utf-8',errors='replace')
    else:
        from .rag.file_operation import FileOperation
        text,error=FileOperation().read(str(path))
        if error: raise ValueError('无法提取文档正文，请检查文件格式')
    if not text.strip(): raise ValueError('文档没有可读取正文')
    return text,digest


async def review_document(engine,doc_id,user_id,decision,note,expected_hash):
    from .rag import rag_worker
    async with KNOWLEDGE_WRITE_LOCK:
        with Session(engine) as db:
            doc=db.get(KnowledgeDocument,doc_id)
            if not doc or doc.user_id!=user_id: raise ValueError('文档不存在或无权审核')
            if doc.content_hash!=expected_hash: raise ValueError('文档版本已变化，请重新打开预览')
            previous=doc.status
            status={'publish':'completed','reject':'rejected','withdraw':'pending'}[decision]
            if status==previous: raise ValueError('该文档已处于目标状态，请刷新列表')
            if decision=='withdraw' and previous!='completed': raise ValueError('只有已发布文档可以撤回')
            _,digest=read_document(doc)
            # Validate/build the whole new snapshot before changing any state.
            published=db.exec(select(KnowledgeDocument).where(KnowledgeDocument.user_id==user_id,
                             KnowledgeDocument.status=='completed')).all()
            paths=[d.file_path for d in published if d.doc_id!=doc_id]
            if status=='completed': paths.append(doc.file_path)
            prepared=await rag_worker._load_lightweight_tour_retriever(user_id,paths) if paths else None
            doc.status=status
            doc.content_hash=digest
            db.add(doc)
            db.add(KnowledgeReview(doc_id=doc_id,reviewer_id=user_id,previous_status=previous,status=status,
                                   content_hash=digest,note=note.strip()))
            db.commit()
            if user_id==1: rag_worker.TOUR_RAG_RETRIEVER=prepared
            return {'doc_id':doc_id,'status':status,'content_hash':digest,
                    'index_version':prepared.index_version if prepared else '',
                    'public_index_updated':user_id==1}
