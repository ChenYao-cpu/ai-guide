"""微信小程序专用讯飞实时数字人代理，密钥仅在服务端使用。"""
import base64
import hashlib
import hmac
import os
from datetime import datetime, timezone
from email.utils import formatdate
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field as InputField
from sqlmodel import Field, SQLModel, Session

from ..database.init_db import DB_ENGINE
from ..models.tour_models import TourSessionInfo
from ..modules.xingyun_access import authorize_tour

router = APIRouter(prefix='/miniprogram/xfyun', tags=['miniprogram-xfyun'])
HOST = 'vms.cn-huadong-1.xf-yun.com'


class XfyunSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    tour_id: int = Field(index=True)
    remote_session: str = ''
    app_id: str = ''
    status: str = 'starting'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def settings():
    names = ('APP_ID', 'API_KEY', 'API_SECRET', 'AVATAR_ID', 'VCN')
    values = {key: os.getenv('XFYUN_AVATAR_' + key, '').strip() for key in names}
    if not all(values.values()):
        raise HTTPException(503, '待配置：请配置讯飞数字人 APP_ID、API_KEY、API_SECRET、AVATAR_ID 和 VCN')
    return values


def signed_url(action, config, date=None):
    path = '/v1/private/vms2d_' + action
    date = date or formatdate(usegmt=True)
    canonical = f'host: {HOST}\ndate: {date}\nPOST {path} HTTP/1.1'
    signature = base64.b64encode(hmac.new(config['API_SECRET'].encode(), canonical.encode(), hashlib.sha256).digest()).decode()
    auth = f'api_key="{config["API_KEY"]}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
    return f'https://{HOST}{path}?' + urlencode({'host': HOST, 'date': date, 'authorization': base64.b64encode(auth.encode()).decode()})


async def cloud(action, body, config):
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(signed_url(action, config), json=body)
        response.raise_for_status()
        result = response.json()
        header = result.get('header', {})
        if header.get('code') != 0:
            raise HTTPException(502, f'讯飞数字人请求失败（代码 {header.get("code", "unknown")}）')
        return header
    except (httpx.HTTPError, ValueError, AttributeError):
        raise HTTPException(502, '讯飞数字人服务请求失败，请稍后重试')


def authorize(db, tour_id, access, authorization, allow_ended=False):
    tour = db.get(TourSessionInfo, tour_id)
    if not tour:
        raise HTTPException(404, '导览不存在')
    return authorize_tour(db, tour_id, tour.guide_id, access, authorization, allow_ended=allow_ended)


@router.get('/config')
def config_status():
    try:
        settings()
    except HTTPException as exc:
        return {'configured': False, 'message': exc.detail}
    return {'configured': True, 'message': '讯飞配置已保存，实际连接待验证'}


@router.post('/sessions/{tour_id}')
async def start(tour_id: int, x_tour_access: str = Header(default=''), authorization: str = Header(default='')):
    config = settings()
    with Session(DB_ENGINE) as db:
        authorize(db, tour_id, x_tour_access, authorization)
        record = XfyunSession(tour_id=tour_id, app_id=config['APP_ID'])
        db.add(record)
        db.commit()
        try:
            header = await cloud('start', {'header': {'app_id': config['APP_ID'], 'uid': str(tour_id)}, 'parameter': {'vmr': {'stream': {'protocol': 'rtmp'}, 'avatar_id': config['AVATAR_ID'], 'width': 720, 'height': 1280}}}, config)
            record.remote_session = header.get('session', '')
            record.status = 'started' if record.remote_session else 'failed'
            db.add(record)
            db.commit()
            url = header.get('stream_url', '')
            if not record.remote_session or not url.startswith('rtmp://'):
                if record.remote_session:
                    await cloud('stop', {'header': {'app_id': record.app_id, 'session': record.remote_session, 'uid': str(tour_id)}}, config)
                    record.status = 'closed'
                    db.add(record)
                    db.commit()
                raise HTTPException(502, '讯飞未返回有效的会话或 RTMP 拉流地址')
            return {'id': record.id, 'stream_url': url}
        except HTTPException:
            if record.status == 'starting':
                record.status = 'failed'
                db.add(record)
                db.commit()
            raise


class Command(BaseModel):
    action: str
    text: str = InputField(default='', max_length=16000)


@router.post('/sessions/{session_id}/command')
async def command(session_id: int, data: Command, x_tour_access: str = Header(default=''), authorization: str = Header(default='')):
    if data.action not in ('speak', 'ping', 'stop'):
        raise HTTPException(400, '不支持的数字人指令')
    config = settings()
    with Session(DB_ENGINE) as db:
        record = db.get(XfyunSession, session_id)
        if not record:
            raise HTTPException(404, '数字人会话不存在')
        authorize(db, record.tour_id, x_tour_access, authorization, allow_ended=data.action == 'stop')
        if record.status == 'closed' and data.action == 'stop':
            return {'success': True}
        if record.status != 'started' or record.app_id != config['APP_ID']:
            raise HTTPException(409, '数字人会话不可用，请重新连接')
        body = {'header': {'app_id': record.app_id, 'session': record.remote_session, 'uid': str(record.tour_id)}}
        if data.action == 'speak':
            if not data.text.strip():
                raise HTTPException(400, '播报内容不能为空')
            body['parameter'] = {'tts': {'vcn': config['VCN'], 'speed': 50, 'pitch': 50, 'volume': 50}}
            body['payload'] = {'text': {'encoding': 'utf8', 'status': 3, 'seq': 3, 'text': base64.b64encode(data.text.encode()).decode()}, 'ctrl_w': {'encoding': 'utf8', 'format': 'json', 'status': 3, 'seq': 0}}
        await cloud('ctrl' if data.action == 'speak' else data.action, body, config)
        if data.action == 'stop':
            record.status = 'closed'
            db.add(record)
            db.commit()
        return {'success': True}
