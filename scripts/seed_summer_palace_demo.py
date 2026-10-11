#!/usr/bin/env python
"""幂等导入颐和园演示数据，用于比赛演示和本地验收。"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _load_env() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip('"').strip("'"))


_load_env()
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from sqlmodel import Session, select  # noqa: E402

from server.base.database.init_db import DB_ENGINE  # noqa: E402
from server.base.models.tour_models import (  # noqa: E402
    DigitalGuideInfo,
    KnowledgeDocument,
    ScenicSpotInfo,
    TourRoute,
    TourRouteSpot,
)
from server.base.models.user_model import UserInfo  # noqa: E402


KNOWLEDGE_DIR = Path("static/tour_files/knowledge_base")

SPOTS = [
    {
        "spot_name": "仁寿殿",
        "category": "historical",
        "tags": "历史;宫廷建筑;古建筑;政务空间",
        "location": "东宫门内西侧",
        "latitude": 39.996511125,
        "longitude": 116.27399545,
        "trigger_radius": 65.0,
        "visit_duration": 18,
        "best_season": "四季皆宜",
        "description": "颐和园东部宫廷区的重要建筑，适合了解皇家园林中宫廷理政空间与山水游赏空间的衔接。",
        "history_detail": "仁寿殿所在院落布局端庄严整，曾承担处理政务和接见活动等功能。参观时可重点观察殿前陈设、院落尺度和建筑中轴关系。",
        "photo_tips": "推荐在院落中轴线稍偏侧的位置取景，将殿前陈设与主体建筑同时纳入画面；上午光线较柔和，也能减少正面逆光。",
        "service_facilities": "仁寿殿靠近东宫门入口服务区，附近可找到游客咨询、卫生间和短暂停留区域；具体开放位置以现场导览牌为准。",
        "tour_tips": "重点观察院落中轴、殿前陈设和宫廷区向山水园林过渡的空间关系。",
        "instruction": "tour_files/knowledge_base/summer_palace_culture.md",
    },
    {
        "spot_name": "长廊",
        "category": "cultural",
        "tags": "园林;彩画;古建筑;摄影;亲子",
        "location": "昆明湖北岸、万寿山南麓",
        "latitude": 39.996653912179916,
        "longitude": 116.26594003180881,
        "trigger_radius": 80.0,
        "visit_duration": 25,
        "best_season": "春季、秋季",
        "description": "沿昆明湖北岸展开的标志性游廊，以连续廊架、丰富彩画和移步换景的空间体验连接湖山与建筑。",
        "history_detail": "长廊兼具遮阳避雨和组织游线的作用。梁枋绘画包含山水、花鸟与人物故事等题材，是观察传统建筑彩画与园林叙事的重要位置。",
        "photo_tips": "推荐站在长廊一端沿廊柱方向取景，利用重复廊柱形成纵深透视；也可从临湖一侧把彩画、廊檐和昆明湖组合入画。",
        "service_facilities": "长廊沿线设有多处座椅和休息空间，附近主要游览节点可查找卫生间、商店与导览标识，位置以园内指示为准。",
        "tour_tips": "除了整体透视，可近距离观察梁枋上的山水、花鸟和人物故事彩画。",
        "instruction": "tour_files/knowledge_base/summer_palace_culture.md",
    },
    {
        "spot_name": "佛香阁",
        "category": "historical",
        "tags": "地标;佛教建筑;万寿山;观景;摄影",
        "location": "万寿山前山中部",
        "latitude": 39.9978267875,
        "longitude": 116.26798205,
        "trigger_radius": 70.0,
        "visit_duration": 30,
        "best_season": "春季、秋季",
        "description": "位于万寿山中部的标志性建筑，是颐和园重要视觉中心，可俯瞰昆明湖并理解园林中轴与对景关系。",
        "history_detail": "佛香阁依山势层层抬升，从湖面与长廊均可形成醒目的对景。游览区域台阶较多，登高前应结合体力合理安排。",
        "photo_tips": "远景可在昆明湖东岸或长廊临湖一侧拍摄，让湖面作为前景；登高后可面向昆明湖拍摄园林中轴与湖山全景。",
        "service_facilities": "佛香阁区域台阶较多，山下主要节点设有休息和导览设施；需要卫生间或商店时建议先在长廊沿线确认位置。",
        "tour_tips": "登高路段应量力而行，重点观察建筑随山势抬升形成的中轴秩序和对景效果。",
        "instruction": "tour_files/knowledge_base/summer_palace_culture.md",
    },
    {
        "spot_name": "昆明湖",
        "category": "natural",
        "tags": "湖景;自然;园林;摄影;休闲;亲子",
        "location": "颐和园中南部",
        "latitude": 39.9954065,
        "longitude": 116.27336795,
        "trigger_radius": 120.0,
        "visit_duration": 35,
        "best_season": "春季、秋季",
        "description": "颐和园山水格局的核心水体，与万寿山、堤岛、桥梁和岸线建筑共同构成开阔的湖山景观。",
        "history_detail": "昆明湖通过水面、堤岸、岛屿与远近建筑形成多层次视线关系，是理解皇家园林借景、对景和空间尺度的核心区域。",
        "photo_tips": "最佳取景点可选昆明湖东岸或长廊南侧，镜头朝向万寿山和佛香阁，用湖面倒影作前景；傍晚侧光更适合表现建筑层次。",
        "service_facilities": "昆明湖沿岸主要游览节点设有休息座椅、导览牌和游船服务点；卫生间、商店及开放中的码头位置请以现场指示为准。",
        "tour_tips": "临水游览注意安全，可对照万寿山、堤岛、桥梁和岸线建筑理解借景与对景。",
        "instruction": "tour_files/knowledge_base/summer_palace_landscape.md",
    },
    {
        "spot_name": "十七孔桥",
        "category": "cultural",
        "tags": "石桥;湖景;摄影;建筑;地标",
        "location": "昆明湖东南部，连接东堤与南湖岛",
        "latitude": 39.9894892,
        "longitude": 116.2714667,
        "trigger_radius": 85.0,
        "visit_duration": 20,
        "best_season": "四季皆宜，傍晚适合摄影",
        "description": "横跨昆明湖水域的重要景观桥梁，连续券洞、石栏与湖面倒影形成富有节奏的构图。",
        "history_detail": "十七孔桥连接东堤与南湖岛，是湖区空间组织的重要节点。侧向观赏可更好地表现连续桥洞、桥身曲线和水面倒影。",
        "photo_tips": "推荐从桥体侧前方取景，以连续券洞和水面倒影表现桥身节奏；傍晚可利用侧逆光突出石桥轮廓。",
        "service_facilities": "东堤与南湖岛方向均有休息空间和导览标识，卫生间与商店需根据现场开放情况沿东堤查找。",
        "tour_tips": "桥面游人较多时注意通行秩序，从侧面观察更容易看清桥洞数量与整体曲线。",
        "instruction": "tour_files/knowledge_base/summer_palace_landscape.md",
    },
    {
        "spot_name": "苏州街",
        "category": "cultural",
        "tags": "水街;江南风格;体验;亲子;摄影",
        "location": "万寿山后山后湖区域",
        "latitude": 40.00083990174717,
        "longitude": 116.26792322723945,
        "trigger_radius": 75.0,
        "visit_duration": 28,
        "best_season": "春季、夏季、秋季",
        "description": "沿后湖水岸布置的街市式建筑群，以江南水镇意象营造区别于前山皇家气象的情景化空间。",
        "history_detail": "苏州街利用水岸、桥梁和店铺式建筑塑造商业街景，体现皇家园林对江南城镇景观的模拟与再创造。",
        "photo_tips": "推荐在跨水小桥或对岸取景，将水面、店铺立面和桥梁同时纳入画面；阴天柔光更适合表现街巷细节。",
        "service_facilities": "苏州街游览区设有导览和休息节点，周边卫生间、商店等设施是否开放请以现场公告为准。",
        "tour_tips": "注意水岸高差和台阶，可从桥、水、街三者的组合观察江南水镇意象。",
        "instruction": "tour_files/knowledge_base/summer_palace_route.md",
    },
]

# 与已有数据库修正使用同一份可溯源的 WGS84 点位，避免重新导入退回近似坐标。
_locations = json.loads((ROOT / "data/summer_palace_locations.json").read_text(encoding="utf-8"))["spots"]
for _spot in SPOTS:
    for _key in ("latitude", "longitude", "location"):
        _spot[_key] = _locations[_spot["spot_name"]][_key]

ROUTES = [
    ("皇家园林经典文化线", "history", 98, "从宫廷区进入山水园林，串联仁寿殿、长廊与佛香阁。", ["仁寿殿", "长廊", "佛香阁", "昆明湖"]),
    ("昆明湖摄影漫游线", "photography", 80, "围绕湖岸、长廊与桥梁组织的轻松摄影路线。", ["长廊", "昆明湖", "十七孔桥"]),
    ("亲子湖山体验线", "family", 88, "节奏舒缓，兼顾园林观察、湖景和水街体验。", ["苏州街", "长廊", "昆明湖"]),
]


def main() -> None:
    with Session(DB_ENGINE) as session:
        user = session.exec(select(UserInfo).where(UserInfo.delete == False).order_by(UserInfo.user_id)).first()
        if not user or not user.user_id:
            raise RuntimeError("请先启动后端完成默认管理员初始化")
        user_id = user.user_id

        spot_ids: dict[str, int] = {}
        for payload in SPOTS:
            spot = session.exec(select(ScenicSpotInfo).where(ScenicSpotInfo.spot_name == payload["spot_name"])).first()
            if spot is None:
                spot = ScenicSpotInfo(user_id=user_id, **payload)
            else:
                for key, value in payload.items():
                    setattr(spot, key, value)
                spot.user_id = user_id
                spot.delete = False
            session.add(spot)
            session.flush()
            spot_ids[spot.spot_name] = int(spot.spot_id)

        guides = [
            DigitalGuideInfo(
                name="小颐",
                character="博学、亲切、擅长把园林历史讲成生动故事",
                avatar="",
                poster_image="",
                voice_style="female_wenrou",
                voice_speed=1.0,
                live2d_model_path="/models/汉服女导游1.vrm",
                user_id=user_id,
            ),
            DigitalGuideInfo(
                name="宫苑先生",
                character="沉稳、专业、侧重古建筑与园林营造知识",
                avatar="",
                poster_image="",
                voice_style="male_wenhou",
                voice_speed=0.95,
                live2d_model_path="/models/西装男导游1.vrm",
                user_id=user_id,
            ),
        ]
        for payload in guides:
            guide = session.exec(select(DigitalGuideInfo).where(DigitalGuideInfo.name == payload.name)).first()
            if guide is None:
                guide = payload
            else:
                for field in (
                    "character", "avatar", "poster_image", "voice_style", "voice_speed",
                    "live2d_model_path", "user_id",
                ):
                    setattr(guide, field, getattr(payload, field))
                guide.delete = False
            session.add(guide)

        for title, theme, minutes, description, names in ROUTES:
            route = session.exec(select(TourRoute).where(TourRoute.name == title)).first()
            if route is None:
                route = TourRoute(name=title, user_id=user_id)
            route.theme = theme
            route.estimated_time_minutes = minutes
            route.description = description
            route.delete = False
            route.user_id = user_id
            session.add(route)
            session.flush()
            old_links = session.exec(select(TourRouteSpot).where(TourRouteSpot.route_id == route.route_id)).all()
            for link in old_links:
                session.delete(link)
            session.flush()
            for order, spot_name in enumerate(names):
                session.add(TourRouteSpot(route_id=route.route_id, spot_id=spot_ids[spot_name], spot_order=order))

        knowledge_files = [
            ("颐和园景区总览与游览服务", "summer_palace_overview.md", 5),
            ("颐和园历史建筑知识", "summer_palace_culture.md", 6),
            ("颐和园湖山景观知识", "summer_palace_landscape.md", 5),
            ("颐和园特色区域与路线知识", "summer_palace_route.md", 5),
        ]
        for title, filename, chunks in knowledge_files:
            path = KNOWLEDGE_DIR / filename
            content_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            doc = session.exec(select(KnowledgeDocument).where(KnowledgeDocument.title == title)).first()
            if doc is None:
                doc = KnowledgeDocument(title=title, user_id=user_id)
            doc.file_path = str(path.relative_to("static")).replace("\\", "/")
            doc.file_type = "md"
            doc.chunk_count = chunks
            doc.content_hash = content_hash
            doc.status = "completed"
            doc.user_id = user_id
            session.add(doc)

        session.commit()

    print("DEMO_DATA_READY spots=6 routes=3 guides=2 knowledge_docs=4")


if __name__ == "__main__":
    main()
