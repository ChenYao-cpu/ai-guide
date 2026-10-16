"""Read-only, bounded itinerary and linked content previews; no tour is created."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..database.init_db import DB_ENGINE
from ..models.tour_models import ScenicSpotInfo, TourRoute, DigitalGuideInfo
from ..modules.route_city import route_city
from ..modules.route_presentation import route_overview
from ..modules.tour_dialogue import resolve_turn, local_answer
from ..modules.tour_visuals import build_visual_context
from ..modules.rag import rag_worker
from ..utils import make_return_data, ResultCode
from .users import get_current_user_info

router = APIRouter(prefix='/tour-experience', tags=['tour-experience'])


class RoutePreviewRequest(BaseModel):
    spot_ids: list[int] = Field(default_factory=list, max_length=20)
    pace: Literal['standard', 'relaxed'] = 'standard'
    start_area: Literal['auto', 'east', 'north', 'south'] = 'auto'
    end_area: Literal['auto', 'east', 'north', 'south'] = 'auto'
    avoid_steps: bool = False
    reserve: int = Field(default=0, ge=0, le=120)


def load_spots(db, ids):
    if len(set(ids)) != len(ids):
        raise HTTPException(422, '路线中有重复景点')
    spots = [db.get(ScenicSpotInfo, sid) for sid in ids]
    if any(not s or s.delete for s in spots):
        raise HTTPException(422, '所选景点不可用')
    try:
        if spots: route_city(spots)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return [s.model_dump() for s in spots]


@router.post('/route-preview')
def preview_route(body: RoutePreviewRequest):
    with Session(DB_ENGINE) as db:
        result = route_overview(load_spots(db, body.spot_ids), body.pace, end_area=body.end_area,
            start_area=body.start_area, avoid_steps=body.avoid_steps, reserve=body.reserve)
    return make_return_data(True, ResultCode.SUCCESS, '成功', result)


class ContentPreviewRequest(RoutePreviewRequest):
    language: Literal['zh', 'en'] = 'zh'
    spot_id: int = 0
    guide_id: int = 0
    draft: dict = Field(default_factory=dict)
    guide_draft: dict = Field(default_factory=dict)
    question: str = Field(default='请介绍这个景点', max_length=2000)
    explanation_mode: Literal['standard', 'deep', 'child'] = 'standard'


@router.post('/content-preview')
async def preview_content(body: ContentPreviewRequest, user_id: int = Depends(get_current_user_info)):
    from ..modules.tour_support import child_fallback
    with Session(DB_ENGINE) as db:
        # Public catalog only. Private document text and provider credentials are
        # never serialized. Drafts are overlaid in memory, never committed.
        selected = load_spots(db, body.spot_ids)
        spot = db.get(ScenicSpotInfo, body.spot_id) if body.spot_id else None
        if spot and spot.delete: raise HTTPException(404, '景点不可用')
        data = spot.model_dump() if spot else (selected[0] if selected else {})
        draft_changed = False
        allowed = {'spot_name', 'description', 'history_detail', 'photo_tips', 'tour_tips',
                   'service_facilities', 'image_path', 'location', 'best_season', 'visit_duration'}
        for key, value in body.draft.items():
            if key in allowed and isinstance(value, (str, int, float)):
                if isinstance(value, str) and len(value) > 12000: raise HTTPException(422, '预览内容过长')
                if key == 'visit_duration' and (type(value) is not int or not 1 <= value <= 480):
                    raise HTTPException(422, '停留时间须为1至480分钟')
                draft_changed = draft_changed or value != data.get(key)
                data[key] = value
        selected = [data if s.get('spot_id') == data.get('spot_id') else s for s in selected]
        if not data.get('spot_name'): raise HTTPException(422, '请先选择景点')
        from ..modules.tour_language import query_aliases
        turn = resolve_turn(query_aliases(body.question), data)
        turn.detailed = body.explanation_mode == 'deep'
        answer, sources = local_answer(turn, data, selected[1] if len(selected) > 1 else None)
        if body.explanation_mode == 'child': answer = child_fallback(turn, data, answer)
        # A changed draft is shown verbatim alongside the fallback narration,
        # so editors can see what is unsaved without misrepresenting the RAG index.
        routes = db.exec(select(TourRoute).where(TourRoute.delete == False)).all()
        related = [dict(route_id=r.route_id, name=r.name) for r in routes
                   if any(x.spot_id == data.get('spot_id') for x in r.route_spots)]
        guides = db.exec(select(DigitalGuideInfo).where(DigitalGuideInfo.delete == False)).all()
        guide = next((g for g in guides if g.guide_id == body.guide_id), None)
        guide_preview = dict(name=guide.name, character=guide.character, enabled=guide.is_enabled,
            poster_image=guide.poster_image, voice_style=guide.voice_style, render_mode=guide.render_mode) if guide else None
        if body.guide_draft:
            guide_preview = guide_preview or {}
            for field in ('name','character','poster_image','voice_style'):
                value=body.guide_draft.get(field)
                if isinstance(value,str) and len(value)<=2000: guide_preview[field]=value
            if type(body.guide_draft.get('is_enabled')) is bool:
                guide_preview['enabled']=body.guide_draft['is_enabled']
        evidence = []
        retriever = rag_worker.TOUR_RAG_RETRIEVER
        if isinstance(retriever, rag_worker.LightweightTourRetriever):
            evidence = retriever.search_evidence(turn.resolved_question, data['spot_name'], turn.intents)[:3]
        result = dict(spot={k: v for k, v in data.items() if k in allowed | {'spot_id'}},
            answer=answer, sources=sources, visuals=build_visual_context(data, turn.intents, answer),
            routes=related, route=route_overview(selected), evidence=evidence,
            guides=[dict(guide_id=g.guide_id, name=g.name, enabled=g.is_enabled, render_mode=g.render_mode,
                         poster_image=g.poster_image) for g in guides],
            guide=guide_preview,
            draft=draft_changed, index_scope='current_public_index',
            note='只读预览，不创建游客会话、不保存草稿。示例回答使用本地知识；线上模型措辞可能不同。')
    if body.language == 'en':
        from ..modules.tour_language import translate_answer
        from .llm import get_tour_llm_res
        from .tour_chat import _llm_is_configured
        result['answer'] = await translate_answer(result['answer'], get_tour_llm_res if _llm_is_configured() else None)
        result['visuals'] = build_visual_context(data, turn.intents, result['answer'], 'en')
    return make_return_data(True, ResultCode.SUCCESS, '成功', result)
