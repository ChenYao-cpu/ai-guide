#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   route_recommender.py
@Time    :   2026/06/10
@Project :   景区导览AI数字人
@Desc    :   个性化路线推荐模块
"""

from math import asin, cos, radians, sin, sqrt
import re
from typing import Any, List

from loguru import logger
from .route_city import spot_city, normalize_city


# 偏好-分类映射表
PREFERENCE_CATEGORY_MAP = {
    "history": ["historical", "cultural"],  # 喜欢历史 → 历史+文化景点
    "nature": ["natural"],  # 喜欢自然 → 自然风光景点
    "photography": ["natural", "cultural", "modern"],  # 拍照打卡 → 好看的地方
    "family": ["comprehensive", "cultural", "natural"],  # 亲子 → 综合+文化+自然
    "comprehensive": ["natural", "historical", "cultural", "modern"],  # 综合 → 全部
}

PREFERENCE_TAG_KEYWORDS = {
    "history": ["历史", "古迹", "古建筑", "文化", "典故", "遗产", "寺", "塔"],
    "nature": ["自然", "山", "水", "湖", "园林", "花", "生态", "风光"],
    "photography": ["摄影", "拍照", "打卡", "夜景", "观景", "地标", "网红"],
    "family": ["亲子", "儿童", "互动", "体验", "科普", "休闲", "无障碍"],
}

ALGORITHM_VERSION = "single-city-preference-mmr-geo-budget-v3"


# 路线主题描述模板
ROUTE_THEME_TEMPLATES = {
    "history": {
        "name_prefix": "历史文化深度游",
        "description": "这条路线聚焦于景区的历史文化精华，带您穿越时空，感受千年文脉。适合喜欢历史故事和文化探索的游客。",
    },
    "nature": {
        "name_prefix": "自然风光探索游",
        "description": "这条路线串联了景区最美的自然景观，让您沉浸在大自然的鬼斧神工之中。适合热爱自然风光的游客。",
    },
    "comprehensive": {
        "name_prefix": "经典全景游",
        "description": "这条路线涵盖了景区最具代表性的景点，兼顾自然风光与人文历史，是首次来访的首选路线。",
    },
    "photography": {
        "name_prefix": "打卡拍照精选游",
        "description": "这条路线精选了景区最适合拍照留念的景点，每个角度都能拍出大片感。适合摄影爱好者和喜欢分享的游客。",
    },
    "family": {
        "name_prefix": "亲子欢乐游",
        "description": "这条路线适合全家出游，节奏轻松，景点趣味性高，让孩子们在游玩中增长见识。",
    },
}


def get_recommended_categories(preferences: List[str]) -> List[str]:
    """根据游客偏好获取推荐景点分类

    Args:
        preferences: 游客偏好列表，如 ["history", "nature"]

    Returns:
        List[str]: 匹配的景点分类列表
    """
    if not preferences or "comprehensive" in preferences:
        return PREFERENCE_CATEGORY_MAP["comprehensive"]

    categories = []
    for pref in preferences:
        if pref in PREFERENCE_CATEGORY_MAP:
            categories.extend(PREFERENCE_CATEGORY_MAP[pref])

    # 去重
    return list(set(categories)) if categories else PREFERENCE_CATEGORY_MAP["comprehensive"]


def get_primary_theme(preferences: List[str]) -> str:
    """根据偏好确定主路线主题

    Args:
        preferences: 游客偏好列表

    Returns:
        str: 路线主题
    """
    if not preferences:
        return "comprehensive"

    if "history" in preferences:
        return "history"
    if "nature" in preferences:
        return "nature"
    if "photography" in preferences:
        return "photography"
    if "family" in preferences:
        return "family"

    return preferences[0] if preferences[0] in ROUTE_THEME_TEMPLATES else "comprehensive"


def _get_value(spot: Any, field: str, default: Any = None) -> Any:
    return getattr(spot, field, spot.get(field, default) if isinstance(spot, dict) else default)


def _score_spot(spot: Any, preferences: List[str], primary_theme: str) -> tuple[float, dict]:
    """计算单景点评分，并保留可展示的评分组成。"""
    category = str(_get_value(spot, "category", ""))
    tags = str(_get_value(spot, "tags", ""))
    description = str(_get_value(spot, "description", ""))
    searchable_text = f"{tags};{description}"

    primary_categories = PREFERENCE_CATEGORY_MAP.get(primary_theme, [])
    all_categories = get_recommended_categories(preferences)
    if category in primary_categories:
        category_score = 60.0
    elif category in all_categories:
        category_score = 45.0
    elif primary_theme == "comprehensive":
        category_score = 35.0
    else:
        category_score = 10.0

    matched_tags: list[str] = []
    for preference in preferences:
        for keyword in PREFERENCE_TAG_KEYWORDS.get(preference, []):
            if keyword in searchable_text and keyword not in matched_tags:
                matched_tags.append(keyword)
    tag_score = min(25.0, len(matched_tags) * 5.0)

    visit_duration = int(_get_value(spot, "visit_duration", 20) or 20)
    duration_score = 10.0 if 10 <= visit_duration <= 45 else 5.0
    latitude = float(_get_value(spot, "latitude", 0.0) or 0.0)
    longitude = float(_get_value(spot, "longitude", 0.0) or 0.0)
    geo_score = 5.0 if latitude and longitude else 0.0

    components = {
        "category": category_score,
        "tag": tag_score,
        "duration": duration_score,
        "geo_completeness": geo_score,
        "matched_tags": matched_tags,
    }
    return category_score + tag_score + duration_score + geo_score, components


def _haversine_meters(first: Any, second: Any) -> float:
    lat1 = float(_get_value(first, "latitude", 0.0) or 0.0)
    lng1 = float(_get_value(first, "longitude", 0.0) or 0.0)
    lat2 = float(_get_value(second, "latitude", 0.0) or 0.0)
    lng2 = float(_get_value(second, "longitude", 0.0) or 0.0)
    if not all((lat1, lng1, lat2, lng2)):
        return float("inf")
    lat1, lng1, lat2, lng2 = map(radians, (lat1, lng1, lat2, lng2))
    delta_lat, delta_lng = lat2 - lat1, lng2 - lng1
    value = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
    return 2 * 6371000 * asin(sqrt(value))


def _order_by_nearest_neighbor(scored_spots: list[dict]) -> list[dict]:
    """从最高相关景点出发，以最近邻降低折返；坐标缺失时保持评分顺序。"""
    if len(scored_spots) < 2:
        return scored_spots

    ordered = [scored_spots[0]]
    remaining = scored_spots[1:]
    while remaining:
        current = ordered[-1]["spot"]
        next_index = min(
            range(len(remaining)),
            key=lambda index: (
                _haversine_meters(current, remaining[index]["spot"]),
                -remaining[index]["score"],
            ),
        )
        ordered.append(remaining.pop(next_index))
    return ordered


async def recommend_route(
    preferences: List[str],
    spot_list: list,
    time_budget_minutes: int | None = None,
    city: str = "",
) -> dict:
    """根据游客偏好推荐游览路线

    Args:
        preferences: 游客偏好列表
        spot_list: 可用景点列表（ScenicSpotInfo对象列表）
        time_budget_minutes: 游客可用时长；提供后会约束景点数量与总停留时长

    Returns:
        dict: 推荐的路线信息，包含 name, theme, description, spots, estimated_time
    """
    preferences = list(dict.fromkeys(preferences or ["comprehensive"]))
    primary_theme = get_primary_theme(preferences)
    groups={}
    for spot in spot_list:
        location_city=spot_city(spot)
        if location_city:groups.setdefault(location_city,[]).append(spot)
    selected_city=normalize_city(city)
    if not selected_city and groups:
        selected_city=max(groups,key=lambda c:(sum(sorted((_score_spot(s,preferences,primary_theme)[0] for s in groups[c]),reverse=True)[:3]),-min(int(_get_value(s,'spot_id',0) or 0) for s in groups[c])))
    spot_list=groups.get(selected_city,[])

    # 多目标评分：偏好分类、标签语义、建议时长和坐标完整度。
    scored_spots: list[dict] = []
    for spot in spot_list:
        score, components = _score_spot(spot, preferences, primary_theme)
        if primary_theme == "comprehensive" or score >= 35.0:
            scored_spots.append({"spot": spot, "score": score, "components": components})

    scored_spots.sort(
        key=lambda item: (
            -item["score"],
            int(_get_value(item["spot"], "spot_id", 0) or 0),
        )
    )

    # MMR式去同质化：同类景点越多，后续候选的边际得分越低。
    selected: list[dict] = []
    category_counts: dict[str, int] = {}
    candidates = scored_spots.copy()
    max_spots = 6 if time_budget_minutes is None else min(6, max(1, time_budget_minutes // 30))
    selected_duration = 0
    while candidates and len(selected) < max_spots:
        feasible = candidates
        if time_budget_minutes is not None:
            feasible = [
                item for item in candidates
                if selected_duration + int(_get_value(item["spot"], "visit_duration", 20) or 20)
                <= time_budget_minutes
            ]
            if not feasible:
                break
        best = max(
            feasible,
            key=lambda item: item["score"]
            - category_counts.get(str(_get_value(item["spot"], "category", "")), 0) * 8.0,
        )
        category = str(_get_value(best["spot"], "category", ""))
        best["diversity_penalty"] = category_counts.get(category, 0) * 8.0
        selected.append(best)
        selected_duration += int(_get_value(best["spot"], "visit_duration", 20) or 20)
        category_counts[category] = category_counts.get(category, 0) + 1
        candidates.remove(best)

    selected = _order_by_nearest_neighbor(selected)
    recommended_spots = [item["spot"] for item in selected]

    # 生成路线信息
    theme_info = ROUTE_THEME_TEMPLATES.get(primary_theme, ROUTE_THEME_TEMPLATES["comprehensive"])

    estimated_time = sum(int(_get_value(spot, "visit_duration", 20) or 20) for spot in recommended_spots)

    spot_names = []
    for spot in recommended_spots:
        name = str(_get_value(spot, "spot_name", ""))
        spot_names.append(name)

    result = {
        "city": selected_city,
        "name": f"{theme_info['name_prefix']}（{'→'.join(spot_names[:3])}{'...' if len(spot_names) > 3 else ''}）",
        "theme": primary_theme,
        "description": theme_info["description"],
        "estimated_time_minutes": estimated_time,
        "spot_ids": [
            spot.spot_id if hasattr(spot, "spot_id") else spot.get("spot_id") for spot in recommended_spots
        ],
        "spot_names": spot_names,
        "spot_count": len(recommended_spots),
        "requested_time_minutes": time_budget_minutes,
        "excluded_spot_count": max(0, len(spot_list) - len(recommended_spots)),
        "algorithm_version": ALGORITHM_VERSION,
        "recommendation_explanation": (
            f"仅在{selected_city or '已配置城市'}内选择景点；综合偏好分类、景点标签、游览时长与坐标完整度评分；"
            "通过同类惩罚提升路线多样性，并按地理最近邻减少折返。"
            + (
                f"路线受 {time_budget_minutes} 分钟预算约束，未采用全量勾选。"
                if time_budget_minutes is not None else ""
            )
        ),
        "score_details": [
            {
                "spot_id": _get_value(item["spot"], "spot_id"),
                "spot_name": _get_value(item["spot"], "spot_name", ""),
                "score": round(item["score"], 1),
                "diversity_penalty": item.get("diversity_penalty", 0.0),
                "components": item["components"],
            }
            for item in selected
        ],
    }

    logger.info(f"Route recommendation: {result}")
    return result


def parse_preferences_from_message(message: str) -> List[str]:
    """从游客消息中解析偏好关键词

    Args:
        message: 游客消息

    Returns:
        List[str]: 偏好列表
    """
    preferences = []

    keyword_map = {
        "history": ["历史", "文化", "故事", "古迹", "传统", "古代", "老", "典故"],
        "nature": ["自然", "风景", "山水", "风光", "花", "树", "瀑布", "山", "湖"],
        "photography": ["拍照", "打卡", "摄影", "拍", "照片", "好看", "美", "网红"],
        "family": ["孩子", "小孩", "亲子", "家庭", "带娃", "小朋友", "儿童"],
    }

    for pref, keywords in keyword_map.items():
        for kw in keywords:
            if kw in message:
                preferences.append(pref)
                break

    return list(set(preferences)) if preferences else ["comprehensive"]


def parse_time_budget_from_message(message: str) -> int | None:
    """从自然语言中提取游览时长，统一换算为分钟。"""
    text = (message or "").lower().replace("个", "")
    if "半天" in text:
        return 240
    if "一天" in text or "1天" in text:
        return 360

    hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:小时|钟头|h\b)", text)
    if hour_match:
        return max(15, int(float(hour_match.group(1)) * 60))

    chinese_hours = {"半": 0.5, "一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6}
    chinese_match = re.search(r"([半一两二三四五六])\s*(?:小时|钟头)", text)
    if chinese_match:
        return int(chinese_hours[chinese_match.group(1)] * 60)

    minute_match = re.search(r"(\d+)\s*(?:分钟|min\b)", text)
    if minute_match:
        return max(15, int(minute_match.group(1)))
    chinese_minute_match = re.search(r"([一二两三四五六七八九十]+)\s*分钟", text)
    if chinese_minute_match:
        digits = {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
        raw = chinese_minute_match.group(1)
        if raw == "十":
            minutes = 10
        elif "十" in raw:
            left, right = raw.split("十", 1)
            minutes = (digits.get(left, 1) * 10) + digits.get(right, 0)
        else:
            minutes = digits.get(raw, 0)
        return max(15, minutes) if minutes else None
    return None
