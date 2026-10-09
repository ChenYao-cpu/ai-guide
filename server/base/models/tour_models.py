#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   tour_models.py
@Time    :   2026/06/10
@Project :   景区导览AI数字人
@Desc    :   景区导览相关数据结构定义
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel
from sqlmodel import JSON, Column, Field, Relationship, SQLModel

from ..models.user_model import UserInfo


# =======================================================
#                    景区景点数据库模型
# =======================================================


class ScenicSpotInfo(SQLModel, table=True):
    """景区景点信息"""

    __tablename__ = "scenic_spot_info"

    spot_id: int | None = Field(default=None, primary_key=True, unique=True)
    spot_name: str = Field(index=True, unique=True)
    category: str = "natural"  # natural / historical / cultural / modern / comprehensive
    tags: str = ""  # 标签，用 ; 分隔，如 "古建筑;园林;世界遗产"
    location: str = ""  # 景点位置描述，如 "景区东门入口向北200米"
    city: str = ""  # 所属城市；未配置时不参与跨景点路线推荐
    latitude: float = 0.0  # GPS纬度
    longitude: float = 0.0  # GPS经度
    trigger_radius: float = 50.0  # 自动触发讲解的半径（米）
    visit_duration: int = 20  # 建议游览时长（分钟），10~40，随机分配
    best_season: str = ""  # 最佳游览季节，如 "春季/秋季"
    description: str = ""  # 景点简介
    history_detail: str = ""  # 历史文化详细介绍
    photo_tips: str = ""  # 最佳拍摄位置、方向和时间建议
    service_facilities: str = ""  # 周边卫生间、休息点、游客服务等信息
    tour_tips: str = ""  # 游览提醒与特色观察建议
    image_path: str = ""  # 景点图片路径
    instruction: str = ""  # 景点讲解词/知识文档路径
    upload_date: datetime = datetime.now()
    delete: bool = False

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")

    # 关系
    visit_records: list["SpotVisitRecord"] = Relationship(back_populates="spot_info")
    route_spots: list["TourRouteSpot"] = Relationship(back_populates="spot_info")


class SpotPageItem(BaseModel):
    spot_list: List[ScenicSpotInfo] = []
    currentPage: int = 0
    pageSize: int = 0
    totalSize: int = 0


class SpotQueryItem(BaseModel):
    instructionPath: str = ""


# =======================================================
#                    知识库文档数据库模型
# =======================================================


class KnowledgeDocument(SQLModel, table=True):
    """知识库文档"""

    __tablename__ = "knowledge_document"

    doc_id: int | None = Field(default=None, primary_key=True, unique=True)
    title: str = Field(index=True)
    file_path: str = ""
    file_type: str = ""  # pdf / docx / txt / md
    chunk_count: int = 0  # 文档切分后的块数
    content_hash: str = ""  # 内容哈希，用于去重
    upload_time: datetime = datetime.now()
    status: str = "pending"  # pending / processing / completed / failed

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")


# =======================================================
#                    游览路线数据库模型
# =======================================================


class TourRoute(SQLModel, table=True):
    """游览路线"""

    __tablename__ = "tour_route"

    route_id: int | None = Field(default=None, primary_key=True, unique=True)
    name: str = Field(index=True)
    theme: str = "comprehensive"  # history / nature / comprehensive / photography / family
    city: str = ""
    estimated_time_minutes: int = 60  # 预计游览时长（分钟）
    cover_image: str = ""
    cover_generated: bool = False
    description: str = ""  # 路线简介
    delete: bool = False

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")

    # 路线包含的景点
    route_spots: list["TourRouteSpot"] = Relationship(
        back_populates="route",
        sa_relationship_kwargs={"lazy": "selectin", "order_by": "asc(TourRouteSpot.spot_order)"},
    )


class TourRouteSpot(SQLModel, table=True):
    """路线-景点关联表（带排序）"""

    __tablename__ = "tour_route_spot"

    id: int | None = Field(default=None, primary_key=True, unique=True)
    route_id: int | None = Field(default=None, foreign_key="tour_route.route_id")
    spot_id: int | None = Field(default=None, foreign_key="scenic_spot_info.spot_id")
    spot_order: int = 0  # 景点在路线中的顺序

    route: Optional[TourRoute] | None = Relationship(back_populates="route_spots")
    spot_info: Optional[ScenicSpotInfo] | None = Relationship(back_populates="route_spots")


class TourRouteCreate(BaseModel):
    name: str
    theme: str = "comprehensive"
    estimated_time_minutes: int = 60
    description: str = ""
    spot_ids: List[int] = []  # 景点ID列表（按顺序）


# =======================================================
#                    数字导游数据库模型
# =======================================================


class DigitalGuideInfo(SQLModel, table=True):
    """数字导游配置信息"""

    __tablename__ = "digital_guide_info"

    guide_id: int | None = Field(default=None, primary_key=True, unique=True)
    name: str = Field(index=True, unique=True)
    character: str = ""  # 性格描述，如 "博学、亲切、善于讲历史故事"
    avatar: str = ""  # 头像

    voice_style: str = "female_wenrou"  # 声音风格: female_wenrou / female_huopo / male_wenhou / male_hongliang
    voice_speed: float = 1.0  # 语速倍率: 0.8 ~ 1.5

    outfit_images: str = ""  # 换装图片，JSON数组

    tts_weight_tag: str = ""
    tts_reference_sentence: str = ""
    tts_reference_audio: str = ""

    poster_image: str = ""
    base_mp4_path: str = ""  # 数字人基础循环视频
    base_video_metadata: str = ""  # 服务端校验后的素材信息 JSON
    model3d_path: str = ""  # 已校验骨骼和口型的原生 glTF 模型
    render_mode: str = "realistic"
    is_enabled: bool = True  # 管理员上架后才对游客开放
    live2d_model_path: str = ""  # Live2D 模型路径（如 /live2d/haru/haru_greeter_t05.model3.json）

    delete: bool = False

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")


# =======================================================
#                    导览会话数据库模型
# =======================================================


class TourSessionStatus(SQLModel, table=True):
    """导览会话状态"""

    __tablename__ = "tour_session_status"

    status_id: int | None = Field(default=None, primary_key=True, unique=True)

    record_id: int | None = Field(default=None, foreign_key="spot_visit_record.record_id")

    current_spot_index: int = 0  # 当前讲解景点索引
    streaming_video_path: str = ""  # 当前数字人讲解视频

    live_status: int = 0  # 0 未开始，1 进行中，2 已结束
    start_time: datetime | None = None
    end_time: datetime | None = None

    session_info: Optional["TourSessionInfo"] | None = Relationship(
        back_populates="status", sa_relationship_kwargs={"lazy": "selectin"}
    )


class TourSessionInfo(SQLModel, table=True):
    """导览会话信息"""

    __tablename__ = "tour_session_info"

    session_id: int | None = Field(default=None, primary_key=True, unique=True)

    name: str = ""  # 会话名称
    visitor_preferences: str = ""  # 游客偏好，JSON格式存储

    delete: bool = False

    route_id: int | None = Field(default=None, foreign_key="tour_route.route_id")
    guide_id: int | None = Field(default=None, foreign_key="digital_guide_info.guide_id")

    status_id: int | None = Field(default=None, foreign_key="tour_session_status.status_id")
    status: TourSessionStatus | None = Relationship(back_populates="session_info", sa_relationship_kwargs={"lazy": "selectin"})

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")


class SpotVisitRecord(SQLModel, table=True):
    """景点讲解记录"""

    __tablename__ = "spot_visit_record"

    record_id: int | None = Field(default=None, primary_key=True, unique=True)

    narration_text: str = ""  # 讲解文案
    start_video: str = ""  # 数字人讲解视频
    start_time: datetime | None = None
    selected: bool = True

    spot_id: int | None = Field(default=None, foreign_key="scenic_spot_info.spot_id")
    spot_info: ScenicSpotInfo | None = Relationship(back_populates="visit_records", sa_relationship_kwargs={"lazy": "selectin"})

    session_id: int | None = Field(default=None, foreign_key="tour_session_info.session_id")


# =======================================================
#                    游客交互记录数据库模型
# =======================================================


class VisitorInteraction(SQLModel, table=True):
    """游客交互记录（对话消息）"""

    __tablename__ = "visitor_interaction"

    message_id: int | None = Field(default=None, primary_key=True, unique=True)

    session_id: int | None = Field(default=None, foreign_key="tour_session_info.session_id")

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")
    user_info: UserInfo | None = Relationship(sa_relationship_kwargs={"lazy": "selectin"})

    guide_id: int | None = Field(default=None, foreign_key="digital_guide_info.guide_id")

    role: str  # "guide" 或 "user"
    message: str
    send_time: datetime | None = None

    # 情感分析结果
    sentiment_score: float = 0.0  # 情感分数 0~1（1=非常正面）
    emotion_label: str = "neutral"  # 情感标签: positive / neutral / negative


class AvatarPerformance(SQLModel, table=True):
    __tablename__ = "avatar_performance"
    performance_id: str = Field(primary_key=True)
    message_id: int = Field(foreign_key="visitor_interaction.message_id")
    guide_id: int = Field(foreign_key="digital_guide_info.guide_id")
    audio_path: str
    scene_path: str
    timeline_json: str
    duration: float
    created_at: datetime = Field(default_factory=datetime.now)


# =======================================================
#                    游客反馈与统计数据模型
# =======================================================


class VisitorFeedback(SQLModel, table=True):
    """游客反馈汇总"""

    __tablename__ = "visitor_feedback"

    feedback_id: int | None = Field(default=None, primary_key=True, unique=True)
    session_id: int | None = Field(default=None, foreign_key="tour_session_info.session_id")

    overall_sentiment_score: float = 0.0
    overall_emotion_label: str = "neutral"
    topics: str = "[]"  # 热点话题，JSON数组
    feedback_text: str = ""  # 自动生成的服务建议
    created_at: datetime = datetime.now()

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")


class DailyInteractionStats(SQLModel, table=True):
    """每日运营统计数据"""

    __tablename__ = "daily_interaction_stats"

    stats_id: int | None = Field(default=None, primary_key=True, unique=True)
    date: datetime = Field(index=True, default=datetime.now)

    total_sessions: int = 0  # 总服务人次
    total_questions: int = 0  # 总提问数
    top_questions: str = "[]"  # 热门问题 Top5，JSON数组
    average_satisfaction: float = 0.0  # 平均满意度

    sentiment_distribution: str = '{"positive":0,"neutral":0,"negative":0}'  # 情感分布

    user_id: int | None = Field(default=None, foreign_key="user_info.user_id")


# =======================================================
#                    前端请求模型
# =======================================================


class TourChatItem(BaseModel):
    sessionId: int
    message: str = ""
    asrFileUrl: str = ""
    currentSpotId: int | None = None
    nextSpotId: int | None = None
    avatarMode: str = "audio"  # audio / realistic，未就绪时返回真实原因


class PreferenceItem(BaseModel):
    preferences: List[str] = []  # ["history", "nature", "photography", "family", "comprehensive"]


class RouteRecommendRequest(BaseModel):
    preferences: List[str] = []
    session_id: int | None = None
    city: str = ""
