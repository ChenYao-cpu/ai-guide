#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   server_info.py
@Time    :   2024/09/02
@Project :   https://github.com/PeterH0323/Streamer-Sales
@Author  :   HinGwenWong
@Version :   1.0
@Desc    :   组件信息获取逻辑
"""


import random
import requests
from loguru import logger

from ..web_configs import API_CONFIG, WEB_CONFIGS


class ServerPluginsInfo:

    def __init__(self) -> None:
        # 启动时不检查，避免卡顿
        self.tts_server_enabled = False
        self.digital_human_server_enabled = False
        self.asr_server_enabled = False
        self.llm_enabled = True  # DeepSeek API 直接可用
        self.rag_enabled = WEB_CONFIGS.ENABLE_RAG
        self.agent_enabled = False

    def update_info(self):

        self.tts_server_enabled = self._check_server(API_CONFIG.TTS_URL + "/check")
        self.digital_human_server_enabled = self._check_server(API_CONFIG.DIGITAL_HUMAN_CHECK_URL)
        self.asr_server_enabled = self._check_server(API_CONFIG.ASR_URL + "/check")
        self.llm_enabled = self._check_server(API_CONFIG.LLM_URL)

        if WEB_CONFIGS.AGENT_DELIVERY_TIME_API_KEY is None or WEB_CONFIGS.AGENT_WEATHER_API_KEY is None:
            self.agent_enabled = False
        else:
            self.agent_enabled = True

        self.rag_enabled = WEB_CONFIGS.ENABLE_RAG

        logger.info(
            "\nself check plugins info : \n"
            f"| llm            | {self.llm_enabled} |\n"
            f"| rag            | {self.rag_enabled} |\n"
            f"| tts            | {self.tts_server_enabled} |\n"
            f"| digital hunam  | {self.digital_human_server_enabled} |\n"
            f"| asr            | {self.asr_server_enabled} |\n"
            f"| agent          | {self.agent_enabled} |\n"
        )

    @staticmethod
    def _check_server(url):

        try:
            res = requests.get(url, timeout=1)  # 1秒超时，不卡启动
        except Exception:
            return False

        return res.status_code == 200

    @staticmethod
    def _make_color_list(color_num):

        color_list = [
            "#FF3838",
            "#FF9D97",
            "#FF701F",
            "#FFB21D",
            "#CFD231",
            "#48F90A",
            "#92CC17",
            "#3DDB86",
            "#1A9334",
            "#00D4BB",
            "#2C99A8",
            "#00C2FF",
            "#344593",
            "#6473FF",
            "#0018EC",
            "#8438FF",
            "#520085",
            "#CB38FF",
            "#FF95C8",
            "#FF37C7",
        ]

        return random.sample(color_list, color_num)

    def get_status(self):
        self.update_info()

        info_list = [
            {
                "plugin_name": "LLM",
                "describe": "大语言模型（Qwen2.5-7B），作为核心对话引擎，理解游客问题并生成导览讲解",
                "enabled": self.llm_enabled,
            },
            {
                "plugin_name": "RAG",
                "describe": "检索增强生成，基于景区知识库为数字导游提供准确的景区资料支撑",
                "enabled": self.rag_enabled,
            },
            {
                "plugin_name": "TTS",
                "describe": "文字转语音（GPT-SoVITS），将导游讲解文本合成为自然语音",
                "enabled": self.tts_server_enabled,
            },
            {
                "plugin_name": "数字人",
                "describe": "数字人驱动（MuseTalk），音频驱动虚拟导游口型同步，需要和 TTS 一起开启",
                "enabled": self.digital_human_server_enabled,
            },
            {
                "plugin_name": "Agent",
                "describe": "智能代理，用于根据游客对话获取天气等实时信息",
                "enabled": self.agent_enabled,
            },
            {
                "plugin_name": "ASR",
                "describe": "语音转文字（FunASR），让游客无需打字即可通过语音与数字导游对话",
                "enabled": self.asr_server_enabled,
            },
        ]

        # 生成图标背景色
        color_list = self._make_color_list(len(info_list))
        for idx, color in enumerate(color_list):
            info_list[idx].update({"avatar_color": color})

        return info_list


SERVER_PLUGINS_INFO = ServerPluginsInfo()
