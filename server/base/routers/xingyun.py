"""多数字人星云会话代理，应用凭据仅在后端解密使用。"""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from urllib.parse import quote, urlsplit

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field as InputField
from sqlmodel import Field, Session, SQLModel, select

from ..database.init_db import DB_ENGINE
from ..models.tour_models import DigitalGuideInfo
from ..models.xingyun import XingyunGuideBinding
from ..modules.xingyun_access import (
    authorize_tour, decrypt_secret, encrypt_secret, require_guide_admin, selectable,
)
from .users import get_current_user_info

GATEWAY = "https://nebula-agent.xingyun3d.com/user/v1/ttsa/session"
SDK_URL = "https://media.xingyun3d.com/xingyun3d/general/litesdk/xmovAvatar@latest.js"
router = APIRouter(prefix="/xingyun", tags=["xingyun"])


class XingyunSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(default=0, index=True)
    guide_id: int | None = None
    tour_id: int | None = None
    access_hash: str = ""
    app_id: str = ""
    secret_encrypted: str = ""
    session_id: str = Field(default="", index=True)
    request_id: str = Field(default="", index=True)
    status: str = "failed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BindingInput(BaseModel):
    app_id: str = InputField(min_length=1, max_length=200)
    app_secret: str = InputField(default="", max_length=500)
    voice_label: str = InputField(default="", max_length=80)
    use_xingyun: bool = True


class CreateGuideInput(BaseModel):
    name: str = InputField(min_length=1, max_length=30)
    character: str = InputField(default="", max_length=1000)
    app_id: str = InputField(min_length=1, max_length=200)
    app_secret: str = InputField(min_length=1, max_length=500)
    voice_label: str = InputField(default="", max_length=80)
    poster_image: str = InputField(min_length=1, max_length=2000)
    avatar: str = InputField(min_length=1, max_length=2000)


@router.post("/guides")
def create_xingyun_guide(data: CreateGuideInput, user_id: int = Depends(require_guide_admin)):
    name, app_id, secret = data.name.strip(), data.app_id.strip(), data.app_secret.strip()
    if not name or not app_id or not secret or not data.poster_image.strip() or not data.avatar.strip():
        raise HTTPException(400, "请填写名称、App ID、App Secret，并上传封面和头像")
    encrypted = encrypt_secret(secret)
    with Session(DB_ENGINE) as db:
        guide = DigitalGuideInfo(name=name, character=data.character.strip(), user_id=user_id,
                                 render_mode="xingyun", is_enabled=False,
                                 poster_image=data.poster_image.strip(), avatar=data.avatar.strip())
        db.add(guide)
        db.flush()
        binding = XingyunGuideBinding(guide_id=guide.guide_id, app_id=app_id,
                                      secret_encrypted=encrypted, voice_label=data.voice_label.strip())
        db.add(binding)
        db.commit()
        db.refresh(guide)
        return {"guide_id": guide.guide_id, "message": "已创建并绑定，尚未上架；请连接验证后上架"}


def owned_guide(db, guide_id, user_id):
    guide = db.get(DigitalGuideInfo, guide_id)
    if not guide or guide.delete or guide.user_id != user_id:
        raise HTTPException(404, "数字导游不存在或无权管理")
    return guide


@router.get("/admin/{guide_id}")
def binding_info(guide_id: int, user_id: int = Depends(require_guide_admin)):
    with Session(DB_ENGINE) as db:
        guide = owned_guide(db, guide_id, user_id)
        binding = db.get(XingyunGuideBinding, guide_id)
        return {"app_id": binding.app_id if binding else "",
                "secret_configured": bool(binding and binding.secret_encrypted),
                "voice_label": binding.voice_label if binding else "",
                "use_xingyun": guide.render_mode == "xingyun"}


@router.put("/admin/{guide_id}")
def save_binding(guide_id: int, data: BindingInput, user_id: int = Depends(require_guide_admin)):
    with Session(DB_ENGINE) as db:
        guide = owned_guide(db, guide_id, user_id)
        binding = db.get(XingyunGuideBinding, guide_id)
        app_id, secret = data.app_id.strip(), data.app_secret.strip()
        if not app_id:
            raise HTTPException(400, "请填写星云 App ID")
        if not secret and (not binding or not binding.secret_encrypted or binding.app_id != app_id):
            raise HTTPException(400, "新增应用或修改 App ID 时必须填写对应的 App Secret")
        if not binding:
            binding = XingyunGuideBinding(guide_id=guide_id, app_id=app_id, secret_encrypted="")
        binding.app_id = app_id
        if secret:
            binding.secret_encrypted = encrypt_secret(secret)
        binding.voice_label = data.voice_label.strip()
        # 即使留空沿用，也验证旧凭据仍能解密。
        decrypt_secret(binding.secret_encrypted)
        guide.render_mode = "xingyun" if data.use_xingyun else "realistic"
        db.add(binding)
        db.add(guide)
        db.commit()
    return {"success": True, "message": "星云应用绑定已保存，云端连接需在导览端验证"}


@router.delete("/admin/{guide_id}")
def remove_binding(guide_id: int, user_id: int = Depends(require_guide_admin)):
    with Session(DB_ENGINE) as db:
        guide = owned_guide(db, guide_id, user_id)
        binding = db.get(XingyunGuideBinding, guide_id)
        if binding:
            db.delete(binding)
        if guide.render_mode == "xingyun":
            guide.render_mode = "realistic"
        guide.is_enabled = False
        db.add(guide)
        db.commit()
    return {"success": True, "message": "星云绑定已移除，导游已下架"}


@router.get("/config/{guide_id}")
def config(guide_id: int):
    with Session(DB_ENGINE) as db:
        guide = db.get(DigitalGuideInfo, guide_id)
        ready = selectable(db, guide) and guide.render_mode == "xingyun"
        binding = db.get(XingyunGuideBinding, guide_id) if ready else None
        return {"configured": bool(ready), "sdkUrl": SDK_URL,
                "voice_label": binding.voice_label if binding else "",
                "provider": guide.render_mode if guide and not guide.delete else "",
                "message": "星云应用已绑定，点击连接验证" if ready else "该导游未上架或未绑定星云应用"}


def signed_headers(method, body, timestamp=None, app_id=None, app_secret=None):
    timestamp = int(time.time()) if timestamp is None else timestamp
    canonical = json.dumps(body, sort_keys=True, ensure_ascii=True, separators=(",", ":")).replace(" ", "")
    # 可选环境参数仅保留旧签名验证脚本兼容；实际连接始终传入该导游的凭据。
    app_id = app_id if app_id is not None else os.environ["XINGYUN_APP_ID"].strip()
    app_secret = app_secret if app_secret is not None else os.environ["XINGYUN_APP_SECRET"].strip()
    value = "/user/v1/ttsa/session" + method.lower() + canonical + app_secret + str(timestamp)
    return {"X-APP-ID": app_id, "X-TIMESTAMP": str(timestamp),
            "X-TOKEN": hashlib.md5(value.encode()).hexdigest(), "Content-Type": "application/json"}


@router.get("/webview/{tour_id}")
def webview_url(tour_id: int, x_tour_access: str = Header(default="")):
    from ..models.tour_models import TourSessionInfo
    with Session(DB_ENGINE) as db:
        tour = db.get(TourSessionInfo, tour_id)
        if not tour:
            raise HTTPException(404, "导览不存在")
        authorize_tour(db, tour_id, tour.guide_id, x_tour_access, "")
        guide = db.get(DigitalGuideInfo, tour.guide_id)
        if not selectable(db, guide) or guide.render_mode != "xingyun":
            raise HTTPException(409, "所选导游未启用星云")
    origin = os.getenv("XINGYUN_WEB_ORIGIN", "").strip().rstrip("/")
    parsed = urlsplit(origin)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise HTTPException(503, "待配置：管理员需设置星云网页 HTTPS 地址及微信业务域名")
    return {"url": f"{origin}/m/tour/{tour_id}?framing=half#avatarToken={quote(x_tour_access, safe='')}"}


@router.api_route("/session/{guide_id}", methods=["POST", "DELETE"])
async def session_proxy(guide_id: int, request: Request, tour_id: int = 0,
                        x_tour_access: str = Header(default=""), authorization: str = Header(default="")):
    raw = await request.body()
    if len(raw) > 65536:
        raise HTTPException(413, "会话请求过大")
    try:
        body = json.loads(raw)
        if not isinstance(body, dict):
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(400, "无效的会话请求")
    with Session(DB_ENGINE) as db:
        access_hash = hashlib.sha256(x_tour_access.encode()).hexdigest() if x_tour_access else ""
        if request.method == "DELETE":
            remote_id, remote_request = body.get("session_id"), body.get("request_id")
            if not remote_id and not remote_request:
                raise HTTPException(400, "缺少会话标识")
            statement = select(XingyunSession).where(XingyunSession.guide_id == guide_id, XingyunSession.tour_id == tour_id)
            statement = statement.where(XingyunSession.session_id == str(remote_id)) if remote_id else statement.where(XingyunSession.request_id == str(remote_request))
            record = db.exec(statement).first()
            if not record:
                raise HTTPException(404, "星云会话不存在")
            # 允许下架/导览结束后的原客户端释放资源，使用创建时的凭据快照。
            if not access_hash or access_hash != record.access_hash:
                scheme, _, token = authorization.partition(" ")
                if scheme.lower() != "bearer" or not token or record.user_id != get_current_user_info(token):
                    raise HTTPException(403, "无权关闭此星云会话")
            body = {"stop_reason": str(body.get("stop_reason", "user_stop"))[:200]}
            if record.session_id:
                body["session_id"] = record.session_id
            if record.request_id:
                body["request_id"] = record.request_id
            app_id, encrypted = record.app_id, record.secret_encrypted
        else:
            guide = db.get(DigitalGuideInfo, guide_id)
            if not selectable(db, guide) or guide.render_mode != "xingyun":
                raise HTTPException(409, "该数字导游未上架或尚未配置星云")
            tour = authorize_tour(db, tour_id, guide_id, x_tour_access, authorization)
            binding = db.get(XingyunGuideBinding, guide_id)
            app_id, encrypted = binding.app_id, binding.secret_encrypted
            record = XingyunSession(user_id=tour.user_id or 0, guide_id=guide_id, tour_id=tour_id,
                                     access_hash=access_hash, app_id=app_id, secret_encrypted=encrypted)
            db.add(record)
            db.commit()
        secret = decrypt_secret(encrypted)
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.request(request.method, GATEWAY, json=body,
                                                headers=signed_headers(request.method, body, app_id=app_id, app_secret=secret))
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(502, "星云服务请求失败，请稍后重试")
        data = payload.get("data") or {}
        if not isinstance(data, dict):
            raise HTTPException(502, "星云服务返回了无效数据")
        if response.is_success:
            if request.method == "POST" and data.get("resource_pack"):
                record.session_id = str(data.get("session_id") or "")
                record.request_id = str(data.get("request_id") or "")
                record.status = "connected"
            elif request.method == "DELETE" and payload.get("error_code") in (None, 0, "0"):
                record.status = "closed"
            db.add(record)
            db.commit()
        return JSONResponse(payload, status_code=response.status_code, headers={"Cache-Control": "no-store"})
