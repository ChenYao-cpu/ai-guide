"""对接现有 MuseTalk 服务。所有生成状态落库，不伪造视频或百分比。"""
import asyncio
import uuid
import json
import os
import time
import subprocess
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import httpx
from sqlmodel import Session, select
from sqlalchemy import inspect, text
from ...web_configs import API_CONFIG, WEB_CONFIGS
from ..database.init_db import DB_ENGINE
from ..models.avatar_job import AvatarJob
from ..models.tour_models import DigitalGuideInfo
_render_lock = asyncio.Lock()
PROJECT_ROOT = Path(__file__).resolve().parents[3]
CARTOON_ROOT = PROJECT_ROOT / 'frontend/public/live2d'
CARTOON_PYTHON = Path(os.environ.get('AVATAR_PYTHON', str(PROJECT_ROOT / '.venv-avatar/Scripts/python.exe')))
_cartoon_checks = {}


def cartoon_model(value):
    if not (value or '').startswith('/live2d/') or not value.endswith('.model.json'):
        return None
    path = (CARTOON_ROOT / value[8:]).resolve()
    return path if path.is_relative_to(CARTOON_ROOT.resolve()) and path.is_file() else None


async def check_cartoon(guide):
    model = cartoon_model(guide.live2d_model_path)
    if not model:
        return {'ready': False, 'message': '待配置：请选择完整的 Live2D 卡通模型'}
    if not CARTOON_PYTHON.is_file():
        return {'ready': False, 'message': '待配置：卡通渲染环境未安装'}
    key = str(model)
    cached = _cartoon_checks.get(key)
    if cached and time.monotonic() - cached[0] < 60:
        return cached[1]
    ready = False
    preview = Path(WEB_CONFIGS.SERVER_FILE_ROOT).resolve() / 'digital_guide/previews' / (hashlib.sha256(key.encode()).hexdigest()[:16] + '.png')
    preview.parent.mkdir(parents=True, exist_ok=True)
    try:
        process = await asyncio.to_thread(subprocess.run, [str(CARTOON_PYTHON), str(PROJECT_ROOT / 'scripts/render_cartoon.py'), '--model', str(model), '--preview', str(preview)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=20)
        output = process.stdout
        ready = process.returncode == 0 and any(line.startswith('{') and json.loads(line).get('ready') is True for line in output.decode(errors='replace').splitlines())
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    result = {'ready': ready, 'message': '可生成：Live2D 样例模型，真实音频驱动开合口与模型动作' if ready else '卡通模型渲染检查失败，请检查运行环境和模型文件', 'model': model.name, 'previewUrl': '/api/v1/files/digital_guide/previews/' + preview.name if ready and preview.is_file() else ''}
    _cartoon_checks[key] = (time.monotonic(), result)
    return result


def fail_interrupted_jobs():
    if 'avatar_mode' not in {column['name'] for column in inspect(DB_ENGINE).get_columns('avatar_render_job')}:
        with DB_ENGINE.begin() as connection:
            connection.execute(text("ALTER TABLE avatar_render_job ADD COLUMN IF NOT EXISTS avatar_mode VARCHAR NOT NULL DEFAULT 'realistic'"))
    with Session(DB_ENGINE) as db:
        jobs = db.exec(select(AvatarJob).where(AvatarJob.status.in_(['queued', 'processing']))).all()
        for job in jobs:
            job.status = 'failed'
            job.error = '生成服务重启，本轮视频已中断，请重新提问'
            job.updated_at = datetime.now(timezone.utc)
            db.add(job)
        db.commit()


def local_asset(value: str) -> Path | None:
    root = Path(WEB_CONFIGS.SERVER_FILE_ROOT).resolve()
    value = (value or '').replace('\\', '/')
    if '/files/' in value:
        value = value.split('/files/', 1)[1]
    elif value.startswith(('http://', 'https://')):
        return None
    if value.startswith('static/'):
        value = value[7:]
    path = (root / value.lstrip('/')).resolve()
    return path if path.is_relative_to(root) and path.is_file() else None


async def capability(guide: DigitalGuideInfo) -> dict:
    source = local_asset(guide.base_mp4_path)
    ready = False
    reason = '待配置：请在管理端上传真人基础视频'
    if source:
        reason = '待配置：MuseTalk 推理服务或模型未就绪'
        try:
            async with httpx.AsyncClient(timeout=2, trust_env=False) as client:
                response = await client.get(API_CONFIG.DIGITAL_HUMAN_CHECK_URL)
                ready = response.status_code == 200 and response.json().get('ready') is True
        except (httpx.HTTPError, ValueError):
            pass
        if ready:
            reason = '可生成：根据本轮讲解音频合成视频'
    try:
        metadata = json.loads(guide.base_video_metadata or '{}')
    except ValueError:
        metadata = {}
    if source and not metadata:
        metadata = {'kind': 'portrait' if source.name.endswith('-portrait.mp4') else 'unverified'}
    if ready and metadata.get('kind') == 'portrait':
        reason = '口型可生成；当前为静态海报，肢体动作待生成'
    elif ready and metadata.get('kind') == 'motion_candidate':
        reason = '动作素材已接入，可保留原动作并生成本轮口型；动作质量请预览确认'
    return {
        'preferredMode': guide.render_mode,
        'threeD': __import__('server.base.modules.avatar3d', fromlist=['model_info']).model_info(guide),
        'source': metadata,
        'sourceUrl': '/api/v1/files/' + source.relative_to(Path(WEB_CONFIGS.SERVER_FILE_ROOT).resolve()).as_posix() if source else '',
        'guide_id': guide.guide_id,
        'audio': {'ready': True, 'message': '语音是否可播放以本轮合成结果为准'},
        'realistic': {'ready': ready, 'message': reason, 'sourceConfigured': bool(source)},
        'cartoon': await check_cartoon(guide),
    }


def save_job(job: AvatarJob, status: str, **values):
    with Session(DB_ENGINE) as db:
        current = db.get(AvatarJob, job.job_id)
        if current:
            current.status = status
            current.updated_at = datetime.now(timezone.utc)
            for key, value in values.items():
                setattr(current, key, value)
            db.add(current)
            db.commit()


async def render_job(job_id: str):
    async with _render_lock:
        await _render_job(job_id)


async def _render_job(job_id: str):
    with Session(DB_ENGINE) as db:
        job = db.get(AvatarJob, job_id)
        guide = db.get(DigitalGuideInfo, job.guide_id) if job else None
    if not job or not guide:
        return
    save_job(job, 'processing')
    try:
        audio = local_asset(job.audio_path)
        if job.avatar_mode == 'cartoon':
            model = cartoon_model(guide.live2d_model_path)
            if not model or not audio:
                raise ValueError('卡通模型或语音不存在')
            output = Path(WEB_CONFIGS.SERVER_FILE_ROOT).resolve() / 'digital_guide/videos' / (job.job_id + '.mp4')
            process = await asyncio.to_thread(subprocess.run, [str(CARTOON_PYTHON), str(PROJECT_ROOT / 'scripts/render_cartoon.py'), '--model', str(model), '--audio', str(audio), '--output', str(output)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=240)
            logs = process.stdout
            if process.returncode != 0 or not output.is_file():
                from loguru import logger
                logger.error('Cartoon renderer failed: {}', logs.decode(errors='replace')[-2000:])
                output.unlink(missing_ok=True)
                raise RuntimeError('卡通视频生成失败')
            save_job(job, 'completed', video_url='/api/v1/files/digital_guide/videos/' + output.name)
            return
        source = local_asset(guide.base_mp4_path)
        if not source or not audio:
            raise ValueError('基础视频或本轮语音文件不存在')
        async with httpx.AsyncClient(timeout=180, trust_env=False) as client:
            # 每轮使用独立标识，避免缓存旧素材或并发任务互相覆盖。
            identity = 'tour_' + job.job_id
            base = {'user_id': 'tour', 'request_id': job.job_id, 'streamer_id': identity}
            response = await client.post(API_CONFIG.DIGITAL_HUMAN_PREPROCESS_URL, json={**base, 'video_path': str(source)})
            response.raise_for_status()
            response = await client.post(API_CONFIG.DIGITAL_HUMAN_URL, json={**base, 'tts_path': str(audio), 'chunk_id': 0})
            response.raise_for_status()
            result = response.json().get('digital_human_mp4_path', '')
        root = Path(WEB_CONFIGS.SERVER_FILE_ROOT).resolve()
        output = Path(result).resolve() if result else None
        if not output or not output.is_relative_to(root) or not output.is_file():
            raise ValueError('推理服务未返回可访问的视频文件，请检查共享文件目录')
        video_url = '/api/v1/files/' + output.relative_to(root).as_posix()
        save_job(job, 'completed', video_url=video_url)
    except Exception as exc:
        save_job(job, 'failed', error=f'数字人视频生成失败：{type(exc).__name__}')


async def enqueue(guide_id: int, session_id: int, message_id: int, audio_path: str, avatar_mode: str = 'realistic') -> dict:
    with Session(DB_ENGINE) as db:
        guide = db.get(DigitalGuideInfo, guide_id)
    if not guide:
        return {'status': 'unavailable', 'message': '导游不存在'}
    state = await capability(guide)
    selected = state.get(avatar_mode)
    if not selected or not selected['ready']:
        return {'status': 'unavailable', 'message': selected['message'] if selected else '不支持的数字人模式'}
    if not local_asset(audio_path):
        return {'status': 'unavailable', 'message': '本轮语音合成失败，无法生成口型视频'}
    job = AvatarJob(job_id=uuid.uuid4().hex, access_token=uuid.uuid4().hex, session_id=session_id, guide_id=guide_id, message_id=message_id, audio_path=audio_path, avatar_mode=avatar_mode)
    with Session(DB_ENGINE) as db:
        db.add(job)
        db.commit()
        db.refresh(job)
    return {'job_id': job.job_id, 'access_token': job.access_token, 'status': 'queued', 'message': '视频生成排队中'}
