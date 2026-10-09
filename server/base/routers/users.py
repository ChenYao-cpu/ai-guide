#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   users.py
@Time    :   2024/08/30
@Project :   https://github.com/PeterH0323/Streamer-Sales
@Author  :   HinGwenWong
@Version :   1.0
@Desc    :   用户登录和 Token 认证接口
"""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from loguru import logger
from passlib.context import CryptContext

from ...web_configs import WEB_CONFIGS
from ..database.user_db import get_db_user_info
from ..models.user_model import TokenItem
from ..utils import ResultCode, make_return_data

router = APIRouter(
    prefix="/user",
    tags=["user"],
    responses={404: {"description": "Not found"}},
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user/login")

# 密码加解密
PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """密码校验

    Args:
        plain_password (str): 明文密码
        hashed_password (str): 加密后的密码，用于对比

    Returns:
        bool: 校验时候通过
    """
    return PWD_CONTEXT.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """生成哈希密码

    Args:
        password (str): 明文密码

    Returns:
        str: 加密后的哈希密码
    """
    return PWD_CONTEXT.hash(password)


def authenticate_user(username: str, password: str) -> bool:
    """对用户名和密码进行校验

    Args:
        username (str): 用户名
        password (str): 密码

    Returns:
        bool: 是否检验通过
    """

    # 获取用户信息
    user_info = get_db_user_info(username=username, all_info=True)
    if not user_info:
        # 没有找到用户名
        logger.info(f"Cannot find username = {username}")
        return False

    # 校验密码
    if not verify_password(password, user_info.hashed_password):
        logger.info(f"verify_password fail")
        # 密码校验失败
        return False

    return user_info


def get_current_user_info(token: str = Depends(oauth2_scheme)):
    """在 token 中提取 user id

    Args:
        token (str, optional): token. Defaults to Depends(oauth2_scheme).

    Raises:
        HTTPException: 401 获取失败

    Returns:
        int: 用户 ID
    """
    if not WEB_CONFIGS.TOKEN_JWT_SECURITY_KEY:
        logger.error("TOKEN_JWT_SECURITY_KEY 未配置")
        raise HTTPException(status_code=503, detail="Authentication service is not configured")
    try:
        token_data = jwt.decode(token, WEB_CONFIGS.TOKEN_JWT_SECURITY_KEY, algorithms=WEB_CONFIGS.TOKEN_JWT_ALGORITHM)
        user_id = token_data.get("user_id", None)
    except Exception as e:
        logger.error(e)
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    if not user_id:
        logger.error(f"can not get user_id: {user_id}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    # TODO 超时强制重新登录

    logger.info(f"Got user_id: {user_id}")
    return user_id


@router.post("/login", summary="登录接口")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if not WEB_CONFIGS.TOKEN_JWT_SECURITY_KEY:
        logger.error("TOKEN_JWT_SECURITY_KEY 未配置")
        raise HTTPException(status_code=503, detail="Authentication service is not configured")
    try:
        # 校验用户名和密码
        user_info = authenticate_user(form_data.username, form_data.password)

        if not user_info:
            raise HTTPException(status_code=401, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

    # 过期时间
    token_expires = datetime.now(timezone.utc) + timedelta(days=7)

    # token 生成包含内容，记录 IP 的原因是防止被其他人拿到用户的 token 进行假冒访问
    token_data = {
        "user_id": user_info.user_id,
        "username": user_info.username,
        "exp": int(token_expires.timestamp()),
        "ip": user_info.ip_address,
        "login_time": int(datetime.now(timezone.utc).timestamp()),
    }
    # 生成 token
    token = jwt.encode(token_data, WEB_CONFIGS.TOKEN_JWT_SECURITY_KEY, algorithm=WEB_CONFIGS.TOKEN_JWT_ALGORITHM)

    # 返回
    res_json = TokenItem(access_token=token, token_type="bearer")
    # return make_return_data(True, ResultCode.SUCCESS, "成功", content)
    return res_json


@router.post("/wx-login", summary="微信小程序登录接口")
async def wx_login(data: dict):
    """微信小程序授权登录 — 通过微信code换取openid，自动注册或登录"""
    import os
    import httpx
    import hashlib
    from sqlmodel import Session, select
    from ..database.init_db import DB_ENGINE
    from ..models.user_model import UserInfo

    if not WEB_CONFIGS.TOKEN_JWT_SECURITY_KEY:
        raise HTTPException(503, "登录服务未配置 JWT 密钥")
    code = (data or {}).get("code", "")
    if not isinstance(code, str) or len(code) > 256:
        raise HTTPException(400, "微信登录凭证格式错误")
    # 用户资料统一由鉴权后的 /profile 接口保存。
    nickName = ""
    avatarUrl = ""

    if not code:
        return make_return_data(False, ResultCode.FAIL, "缺少微信授权code", "")

    # 正式登录只接受微信服务端返回的身份。
    openid = ""
    wx_appid = os.getenv("WX_APPID", "")
    wx_secret = os.getenv("WX_SECRET", "")
    allow_dev = os.getenv('ALLOW_DEV_LOGIN', 'false').lower() == 'true'
    is_dev = code.startswith('dev_')
    if is_dev and not allow_dev:
        return make_return_data(False, ResultCode.FAIL, '开发登录未启用', '')
    if not is_dev and wx_appid and wx_secret:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                wx_resp = await client.get('https://api.weixin.qq.com/sns/jscode2session', params={
                    'appid': wx_appid, 'secret': wx_secret, 'js_code': code,
                    'grant_type': 'authorization_code',
                })
                wx_resp.raise_for_status()
                wx_data = wx_resp.json()
            if wx_data.get('errcode'):
                error_code = wx_data.get('errcode')
                messages = {40029: '微信登录凭证无效，请重新授权', 40163: '微信登录凭证已使用，请重新授权',
                            40013: '后端微信 AppID 配置错误', 40125: '后端微信 AppSecret 配置错误',
                            45011: '微信登录请求过于频繁，请稍后重试', -1: '微信服务繁忙，请稍后重试'}
                return make_return_data(False, ResultCode.FAIL, messages.get(error_code, '微信授权失败，请重新尝试'), '')
            openid = wx_data.get('openid', '')
        except (httpx.HTTPError, ValueError):
            logger.warning('WeChat login exchange failed')
            return make_return_data(False, ResultCode.FAIL, '连接微信登录服务失败，请稍后重试', '')

    if not openid and not (is_dev and allow_dev):
        return make_return_data(False, ResultCode.FAIL, '微信登录未配置或授权失败：请在后端配置与小程序一致的 WX_APPID 和 WX_SECRET', '')

    # 开发登录仅在显式开启时创建真实数据库账号。
    unique_id = openid or ("wx_dev_" + hashlib.md5(code.encode()).hexdigest()[:12])
    username = "微信用户" + hashlib.sha256(unique_id.encode()).hexdigest()[:16]

    with Session(DB_ENGINE) as session:
        existing = None
        if openid:
            existing = session.exec(select(UserInfo).where(UserInfo.openid == openid)).first()
        if not existing:
            existing = session.exec(select(UserInfo).where(UserInfo.openid == unique_id)).first()
        if existing:
            if existing.delete:
                raise HTTPException(403, "账号已停用")
            user_id = existing.user_id
            if nickName:
                existing.username = nickName
            if avatarUrl:
                existing.avatar = avatarUrl
            username = existing.username
            saved_avatar = existing.avatar or ""
            session.commit()
            logger.info(f"Returning WeChat user: {username} (id={user_id})")
        else:
            import secrets
            hashed = PWD_CONTEXT.hash(secrets.token_urlsafe(32))
            new_user = UserInfo(
                openid=unique_id,
                username=username,
                avatar=avatarUrl or "",
                hashed_password=hashed,
                email="",
                ip_address="127.0.0.1",
                delete=False,
            )
            session.add(new_user)
            session.commit()
            session.refresh(new_user)
            user_id = new_user.user_id
            saved_avatar = new_user.avatar or ""
            logger.info(f"Auto-registered WeChat user (id={user_id})")

    # 生成 JWT token
    token_expires = datetime.now(timezone.utc) + timedelta(days=30)
    token_data = {
        "user_id": user_id,
        "username": username,
        "exp": int(token_expires.timestamp()),
        "ip": "127.0.0.1",
        "login_time": int(datetime.now(timezone.utc).timestamp()),
    }
    token = jwt.encode(token_data, WEB_CONFIGS.TOKEN_JWT_SECURITY_KEY, algorithm=WEB_CONFIGS.TOKEN_JWT_ALGORITHM)
    return make_return_data(True, ResultCode.SUCCESS, "登录成功", {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user_id,
        "username": username,
        "avatar": saved_avatar,
        "profile_completed": bool(saved_avatar),
    })


@router.get("/me", summary="获取用户信息")
async def get_streaming_room_api(user_id: int = Depends(get_current_user_info)):
    """获取用户信息"""
    user_info = get_db_user_info(id=user_id, all_info=True)
    if not user_info or user_info.delete:
        raise HTTPException(401, "登录账号不存在或已停用")
    from ..models.user_model import UserBaseInfo
    user_info = UserBaseInfo(**user_info.model_dump())
    return make_return_data(True, ResultCode.SUCCESS, "成功", user_info)


@router.post("/profile", summary="保存用户头像与昵称")
async def save_user_profile(nickname: str = Form(...), avatar: UploadFile = File(...), user_id: int = Depends(get_current_user_info)):
    import uuid
    from pathlib import Path
    from sqlmodel import Session
    from ..database.init_db import DB_ENGINE
    from ..models.user_model import UserInfo

    nickname = nickname.strip()
    if not nickname or len(nickname) > 40:
        raise HTTPException(400, "昵称须为1至40个字符")
    content = await avatar.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "头像不能超过5MB")
    if content.startswith(b'\x89PNG\r\n\x1a\n'):
        extension = 'png'
    elif content.startswith(b'\xff\xd8\xff'):
        extension = 'jpg'
    else:
        raise HTTPException(400, "头像仅支持PNG或JPEG图片")
    relative = Path('user_avatars') / str(user_id) / (uuid.uuid4().hex + '.' + extension)
    target = Path(WEB_CONFIGS.SERVER_FILE_ROOT) / relative
    with Session(DB_ENGINE) as session:
        user = session.get(UserInfo, user_id)
        if not user or user.delete:
            raise HTTPException(404, "用户不存在")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        try:
            user.username = nickname
            user.avatar = '/api/v1/files/' + relative.as_posix()
            session.add(user)
            session.commit()
        except Exception:
            session.rollback()
            target.unlink(missing_ok=True)
            raise HTTPException(409, "昵称保存失败，请换一个昵称重试")
        return make_return_data(True, ResultCode.SUCCESS, "资料保存成功", {"username": user.username, "avatar": user.avatar})
