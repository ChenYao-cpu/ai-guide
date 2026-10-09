#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   init_db.py
@Time    :   2024/09/06
@Project :   https://github.com/PeterH0323/Streamer-Sales
@Author  :   HinGwenWong
@Version :   1.0
@Desc    :   数据库初始化
"""

from loguru import logger
from pydantic import PostgresDsn
from pydantic_core import MultiHostUrl
from sqlmodel import SQLModel, create_engine

from ...web_configs import WEB_CONFIGS

ECHO_DB_MESG = False  # 数据库执行中是否回显，for debug


def sqlalchemy_db_url() -> PostgresDsn:
    """生成数据库 URL

    Returns:
        PostgresDsn: 数据库地址
    """
    return MultiHostUrl.build(
        scheme="postgresql+psycopg",
        username=WEB_CONFIGS.POSTGRES_USER,
        password=WEB_CONFIGS.POSTGRES_PASSWORD,
        host=WEB_CONFIGS.POSTGRES_SERVER,
        port=WEB_CONFIGS.POSTGRES_PORT,
        path=WEB_CONFIGS.POSTGRES_DB,
    )


_base_url = str(sqlalchemy_db_url())
logger.info(
    "connecting to db: {}@{}:{}/{}",
    WEB_CONFIGS.POSTGRES_USER,
    WEB_CONFIGS.POSTGRES_SERVER,
    WEB_CONFIGS.POSTGRES_PORT,
    WEB_CONFIGS.POSTGRES_DB,
)
DB_ENGINE = create_engine(
    _base_url,
    echo=ECHO_DB_MESG,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "connect_timeout": 10,
        "options": "-c statement_timeout=10s -c lock_timeout=8s -c idle_in_transaction_session_timeout=15s",
    },
)


def create_db_and_tables():
    """创建所有数据库和对应的表，有则跳过"""
    logger.info("  → 检查表结构...")
    SQLModel.metadata.create_all(DB_ENGINE)
    logger.info("  → 检查字段迁移...")
    _migrate_add_missing_columns()
    logger.info("  → 数据库初始化完成")


def _migrate_add_missing_columns():
    """补充新增字段——生产环境请用 Alembic 管理迁移"""
    from sqlalchemy import text as sa_text
    migrations = [
        {"table":"digital_guide_info","columns":[("is_enabled", "BOOLEAN NOT NULL DEFAULT TRUE")]},
        {"table":"xingyunsession","columns":[("guide_id", "INTEGER"),("tour_id", "INTEGER"),("access_hash", "TEXT NOT NULL DEFAULT ''"),("app_id", "TEXT NOT NULL DEFAULT ''"),("secret_encrypted", "TEXT NOT NULL DEFAULT ''")]},
        {"table":"scenic_spot_info","columns":[("city", "TEXT NOT NULL DEFAULT ''")]},
        {"table":"tour_route","columns":[("city", "TEXT NOT NULL DEFAULT ''")]},
        {"table":"tour_route","columns":[("cover_image", "TEXT NOT NULL DEFAULT ''"),("cover_generated","BOOLEAN NOT NULL DEFAULT FALSE")]},
        {"table": "digital_guide_info", "columns": [("base_video_metadata", "TEXT NOT NULL DEFAULT ''"), ("model3d_path", "TEXT NOT NULL DEFAULT ''"), ("render_mode", "TEXT NOT NULL DEFAULT 'realistic'")]},
        # ScenicSpotInfo: GPS字段（LBS位置服务）
        {
            "table": "scenic_spot_info",
            "columns": [
                ("latitude", "DOUBLE PRECISION DEFAULT 0.0"),
                ("longitude", "DOUBLE PRECISION DEFAULT 0.0"),
                ("trigger_radius", "DOUBLE PRECISION DEFAULT 50.0"),
            ],
        },
        # ScenicSpotInfo: 游览时长字段（AI推荐用）
        {
            "table": "scenic_spot_info",
            "columns": [
                ("visit_duration", "INTEGER DEFAULT 20"),
            ],
        },
        # ScenicSpotInfo: 面向推荐问题的结构化知识字段
        {
            "table": "scenic_spot_info",
            "columns": [
                ("photo_tips", "TEXT DEFAULT ''"),
                ("service_facilities", "TEXT DEFAULT ''"),
                ("tour_tips", "TEXT DEFAULT ''"),
            ],
        },
        # UserInfo: 微信 openid（小程序微信登录持久化标识）
        {
            "table": "user_info",
            "columns": [
                ("openid", "VARCHAR(255) DEFAULT NULL"),
            ],
        },
    ]
    with DB_ENGINE.connect() as conn:
        for m in migrations:
            table = m["table"]
            for col_name, col_def in m["columns"]:
                try:
                    conn.execute(sa_text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col_name} {col_def}"))
                    conn.commit()
                except Exception:
                    conn.rollback()
                    # PostgreSQL 不支持 ADD COLUMN IF NOT EXISTS，用 try/except 兜底
                    try:
                        conn.execute(sa_text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
                        conn.commit()
                    except Exception:
                        conn.rollback()  # 列已存在则跳过
