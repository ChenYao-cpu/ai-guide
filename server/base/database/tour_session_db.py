#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   tour_session_db.py
@Time    :   2026/06/10
@Project :   景区导览AI数字人
@Desc    :   导览会话数据表读写
"""

from datetime import datetime
from typing import List

from loguru import logger
from sqlmodel import Session, and_, select

from ..models.tour_models import (
    DigitalGuideInfo,
    SpotVisitRecord,
    TourRoute,
    TourSessionInfo,
    TourSessionStatus,
    VisitorInteraction,
)
from ..modules.guide_identity import SHOWCASE_GUIDE_NAME, resolve_model_path, resolve_voice_style
from .digital_guide_db import _asset_url
from .init_db import DB_ENGINE


async def create_tour_session(
    name: str,
    route_id: int,
    guide_id: int,
    user_id: int,
    visitor_preferences: str = "",
) -> TourSessionInfo:
    """创建新的导览会话

    Args:
        name: 会话名称
        route_id: 路线 ID
        guide_id: 导游 ID
        user_id: 用户 ID
        visitor_preferences: 游客偏好 JSON

    Returns:
        TourSessionInfo: 创建的会话
    """
    with Session(DB_ENGINE) as session:
        # 用户所选身份不可被静默替换；下架或删除后拒绝创建。
        selected_guide = session.exec(
            select(DigitalGuideInfo).where(
                and_(DigitalGuideInfo.guide_id == guide_id, DigitalGuideInfo.delete == False)
            )
        ).first()
        from ..modules.xingyun_access import selectable
        from fastapi import HTTPException
        if not selectable(session, selected_guide):
            raise HTTPException(409, "所选数字导游已下架或不可用，请重新选择")

        # 创建会话状态
        status = TourSessionStatus(live_status=0)
        session.add(status)
        session.commit()
        session.refresh(status)

        # 创建会话
        tour_session = TourSessionInfo(
            name=name,
            route_id=route_id,
            guide_id=guide_id,
            user_id=user_id,
            visitor_preferences=visitor_preferences,
            status_id=status.status_id,
        )
        session.add(tour_session)
        session.commit()
        session.refresh(tour_session)

    return tour_session


async def get_db_tour_sessions(
    user_id: int,
    current_page: int = -1,
    page_size: int = 10,
) -> tuple:
    """查询导览会话列表"""
    from sqlalchemy import func

    conditions = [TourSessionInfo.delete == False]
    if user_id > 0:
        conditions.append(TourSessionInfo.user_id == user_id)
    query_condition = and_(*conditions)

    with Session(DB_ENGINE) as session:
        total_count = session.scalar(select(func.count(TourSessionInfo.session_id)).where(query_condition))

        if current_page < 0:
            sessions = session.exec(
                select(TourSessionInfo).where(query_condition).order_by(TourSessionInfo.session_id.desc())
            ).all()
        else:
            offset_idx = (current_page - 1) * page_size
            sessions = session.exec(
                select(TourSessionInfo)
                .where(query_condition)
                .offset(offset_idx)
                .limit(page_size)
                .order_by(TourSessionInfo.session_id.desc())
            ).all()

    if sessions is None:
        sessions = []

    return sessions, total_count


async def start_tour_session(session_id: int) -> bool:
    """开始导览会话

    Args:
        session_id: 会话 ID

    Returns:
        bool: 是否成功
    """
    try:
        with Session(DB_ENGINE) as session:
            tour_session = session.exec(
                select(TourSessionInfo).where(TourSessionInfo.session_id == session_id)
            ).one()

            if tour_session and tour_session.status:
                tour_session.status.live_status = 1
                tour_session.status.start_time = datetime.now()
                session.add(tour_session.status)
                session.commit()
                return True
        return False
    except Exception as e:
        logger.error(f"Start session failed: {e}")
        return False


async def end_tour_session(session_id: int) -> bool:
    """结束导览会话

    Args:
        session_id: 会话 ID

    Returns:
        bool: 是否成功
    """
    try:
        with Session(DB_ENGINE) as session:
            tour_session = session.exec(
                select(TourSessionInfo).where(TourSessionInfo.session_id == session_id)
            ).one()

            if tour_session and tour_session.status:
                tour_session.status.live_status = 2
                tour_session.status.end_time = datetime.now()
                session.add(tour_session.status)
                session.commit()
                return True
        return False
    except Exception as e:
        logger.error(f"End session failed: {e}")
        return False


async def get_session_live_info(session_id: int):
    """获取导览会话实时信息（包含对话历史、当前景点、视频）"""
    from ...web_configs import API_CONFIG

    with Session(DB_ENGINE) as session:
        tour_session = session.exec(
            select(TourSessionInfo).where(TourSessionInfo.session_id == session_id)
        ).first()

        if not tour_session:
            return None

        # 获取导游信息
        guide_info = None
        if tour_session.guide_id:
            guide_info = session.exec(
                select(DigitalGuideInfo).where(
                    and_(
                        DigitalGuideInfo.guide_id == tour_session.guide_id,
                    )
                )
            ).first()

        # 获取路线信息
        route_info = None
        if tour_session.route_id:
            route_info = session.exec(
                select(TourRoute).where(TourRoute.route_id == tour_session.route_id)
            ).first()

        # 获取对话历史
        conversations = session.exec(
            select(VisitorInteraction)
            .where(VisitorInteraction.session_id == session_id)
            .order_by(VisitorInteraction.send_time)
        ).all()

        conversation_list = []
        for msg in (conversations or []):
            conversation_list.append({
                "role": msg.role,
                "userId": msg.user_id,
                "userName": "游客" if msg.role == "user" else (guide_info.name if guide_info else "导游"),
                "avatar": guide_info.avatar if guide_info and msg.role == "guide" else "",
                "message": msg.message,
                "send_time": str(msg.send_time) if msg.send_time else "",
            })

        # 获取当前景点信息
        current_spot = None
        next_spot = None
        current_spot_index = tour_session.status.current_spot_index if tour_session.status else 0
        if route_info and route_info.route_spots:
            spots = sorted(route_info.route_spots, key=lambda x: x.spot_order)
            if current_spot_index < len(spots):
                rs = spots[current_spot_index]
                current_spot = rs.spot_info
            if current_spot_index + 1 < len(spots):
                next_spot = spots[current_spot_index + 1].spot_info

        guide_model_path = resolve_model_path(
            guide_info.voice_style if guide_info else "female_wenrou",
            guide_info.live2d_model_path if guide_info else "",
        )
        guide_voice_style = resolve_voice_style(
            guide_info.voice_style if guide_info else "female_wenrou",
            guide_model_path,
        )

        result = {
            "session_id": tour_session.session_id,
            "name": tour_session.name,
            "visitor_preferences": tour_session.visitor_preferences,
            "guide_info": {
                "guide_id": guide_info.guide_id if guide_info else 0,
                "render_mode": guide_info.render_mode if guide_info else "",
                "is_enabled": bool(guide_info and guide_info.is_enabled and not guide_info.delete),
                "name": guide_info.name if guide_info else "",
                "character": guide_info.character if guide_info else "",
                "avatar": _asset_url(guide_info.avatar) if guide_info and guide_info.avatar else "",
                "poster_image": _asset_url(guide_info.poster_image) if guide_info and guide_info.poster_image else "",
                "base_mp4_path": _asset_url(guide_info.base_mp4_path) if guide_info and guide_info.base_mp4_path else "",
                "live2d_model_path": guide_model_path,
                "voice_style": guide_voice_style,
                "voice_speed": guide_info.voice_speed if guide_info else 1.0,
            } if guide_info else None,
            "route_info": {
                "route_id": route_info.route_id if route_info else 0,
                "name": route_info.name if route_info else "",
                "theme": route_info.theme if route_info else "",
                "estimated_time": route_info.estimated_time_minutes if route_info else 0,
            } if route_info else None,
            "current_spot_info": {
                "spot_id": current_spot.spot_id if current_spot else 0,
                "spot_name": current_spot.spot_name if current_spot else "",
                "category": current_spot.category if current_spot else "",
                "description": current_spot.description if current_spot else "",
                "history_detail": current_spot.history_detail if current_spot else "",
                "location": current_spot.location if current_spot else "",
                "best_season": current_spot.best_season if current_spot else "",
                "visit_duration": current_spot.visit_duration if current_spot else 20,
                "photo_tips": current_spot.photo_tips if current_spot else "",
                "service_facilities": current_spot.service_facilities if current_spot else "",
                "tour_tips": current_spot.tour_tips if current_spot else "",
                "image_path": API_CONFIG.REQUEST_FILES_URL + "/" + current_spot.image_path.lstrip("/") if current_spot and current_spot.image_path else "",
            } if current_spot else None,
            "next_spot_info": {
                "spot_id": next_spot.spot_id,
                "spot_name": next_spot.spot_name,
                "description": next_spot.description,
                "location": next_spot.location,
                "visit_duration": next_spot.visit_duration,
            } if next_spot else None,
            "current_spot_index": current_spot_index,
            "current_streamer_video": API_CONFIG.REQUEST_FILES_URL + tour_session.status.streaming_video_path if tour_session.status and tour_session.status.streaming_video_path else "",
            "live_status": tour_session.status.live_status if tour_session.status else 0,
            "start_time": str(tour_session.status.start_time) if tour_session.status and tour_session.status.start_time else "",
            "final_spot": False,  # 是否最后一个景点
            "conversation": conversation_list,
        }

        # 判断是否最后一个景点
        if route_info and route_info.route_spots:
            spots_sorted = sorted(route_info.route_spots, key=lambda x: x.spot_order)
            result["final_spot"] = current_spot_index >= len(spots_sorted) - 1

        return result


async def next_spot_in_session(session_id: int) -> bool:
    """切换到下一个景点

    Args:
        session_id: 会话 ID

    Returns:
        bool: 是否成功
    """
    try:
        with Session(DB_ENGINE) as session:
            tour_session = session.exec(
                select(TourSessionInfo).where(TourSessionInfo.session_id == session_id)
            ).one()

            if tour_session and tour_session.status:
                tour_session.status.current_spot_index += 1
                session.add(tour_session.status)
                session.commit()
                return True
        return False
    except Exception as e:
        logger.error(f"Next spot failed: {e}")
        return False


async def save_visitor_message(session_id: int, user_id: int, guide_id: int, role: str, message: str) -> VisitorInteraction:
    """保存游客交互消息

    Args:
        session_id: 会话 ID
        user_id: 用户 ID
        guide_id: 导游 ID
        role: 角色
        message: 消息内容

    Returns:
        VisitorInteraction: 创建的消息记录
    """
    with Session(DB_ENGINE) as session:
        interaction = VisitorInteraction(
            session_id=session_id,
            user_id=user_id,
            guide_id=guide_id,
            role=role,
            message=message,
            send_time=datetime.now(),
        )
        session.add(interaction)
        session.commit()
        session.refresh(interaction)
    return interaction


async def get_conversation_history(session_id: int) -> List[dict]:
    """获取会话对话历史

    Args:
        session_id: 会话 ID

    Returns:
        List[dict]: 对话历史
    """
    with Session(DB_ENGINE) as session:
        messages = session.exec(
            select(VisitorInteraction)
            .where(VisitorInteraction.session_id == session_id)
            .order_by(VisitorInteraction.send_time)
        ).all()

    if messages is None:
        return []

    return [
        {
            "role": msg.role,
            "message": msg.message,
            "send_time": str(msg.send_time) if msg.send_time else "",
        }
        for msg in messages
    ]


async def delete_tour_session(session_id: int) -> bool:
    """软删除导览会话

    Args:
        session_id: 会话 ID

    Returns:
        bool: 是否成功
    """
    try:
        with Session(DB_ENGINE) as session:
            tour_session = session.exec(
                select(TourSessionInfo).where(TourSessionInfo.session_id == session_id)
            ).one()
            if tour_session:
                tour_session.delete = True
                session.add(tour_session)
                session.commit()
                return True
        return False
    except Exception as e:
        logger.error(f"Delete session failed: {e}")
        return False


async def update_session_video_path(status_id: int, video_path: str) -> bool:
    """更新会话当前视频路径

    Args:
        status_id: 状态 ID
        video_path: 视频路径

    Returns:
        bool: 是否成功
    """
    try:
        with Session(DB_ENGINE) as session:
            status = session.exec(
                select(TourSessionStatus).where(TourSessionStatus.status_id == status_id)
            ).one()
            if status:
                status.streaming_video_path = video_path
                session.add(status)
                session.commit()
                return True
        return False
    except Exception:
        return False
