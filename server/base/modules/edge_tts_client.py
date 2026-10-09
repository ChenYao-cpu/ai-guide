#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   edge_tts_client.py
@Time    :   2026/06/11
@Desc    :   基于 Edge-TTS 的免费语音合成（无需GPU，无需API Key）
            pip install edge-tts
"""

import asyncio
import os
import tempfile
import uuid
from pathlib import Path

from loguru import logger

# 中文语音列表（女声为主）
VOICE_MAP = {
    "female_wenrou": "zh-CN-XiaoxiaoNeural",      # 温柔女声（推荐）
    "female_huopo": "zh-CN-XiaoyiNeural",           # 活泼女声
    "male_wenhou": "zh-CN-YunxiNeural",             # 温厚男声
    "male_hongliang": "zh-CN-YunjianNeural",        # 洪亮男声
}

# 语速映射
SPEED_MAP = {
    0.8: "-20%",
    0.9: "-10%",
    1.0: "+0%",
    1.2: "+20%",
    1.5: "+50%",
}


async def synthesize_speech(
    text: str,
    voice_style: str = "female_wenrou",
    speed: float = 1.0,
    output_dir: str = "",
) -> str:
    """使用 Edge TTS 合成语音

    Args:
        text: 要合成的文本
        voice_style: 声音风格
        speed: 语速倍率
        output_dir: 输出目录

    Returns:
        str: 生成的 wav 文件路径
    """
    try:
        import edge_tts
    except ImportError:
        logger.error("edge_tts not installed. Run: pip install edge-tts")
        return ""

    if not text:
        return ""

    voice = VOICE_MAP.get(voice_style, VOICE_MAP["female_wenrou"])
    rate = SPEED_MAP.get(speed, "+0%")

    # 清理文本（移除 markdown 语法）
    clean_text = text.replace("**", "").replace("*", "").replace("`", "").replace("#", "")

    # 输出文件
    if not output_dir:
        output_dir = tempfile.gettempdir()
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, f"tts_{uuid.uuid4().hex[:8]}.mp3")

    try:
        communicate = edge_tts.Communicate(clean_text, voice, rate=rate)
        await communicate.save(output_file)

        logger.info(f"Edge TTS synthesized: {output_file} (voice={voice}, rate={rate})")
        return output_file
    except Exception as e:
        logger.error(f"Edge TTS synthesis failed: {e}")
        return ""


def synthesize_speech_sync(text: str, voice_style: str = "female_wenrou", speed: float = 1.0) -> str:
    """同步版本，方便在非 async 上下文中调用"""
    return asyncio.run(synthesize_speech(text, voice_style, speed))
