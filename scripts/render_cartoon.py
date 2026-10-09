"""Render a configured Live2D model with the actual speech envelope to H.264/AAC.

Runs in .venv-avatar, isolated from the API environment. No visible window.
Lip opening follows audio RMS; this is not phoneme-level lip synchronization.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

import glfw
import imageio_ffmpeg
import live2d
import numpy as np
from OpenGL import GL


def render(model_path, audio=None, output=None, preview=None):
    width, height, fps = 480, 640, 25
    config = json.loads(Path(model_path).read_text(encoding='utf-8'))
    root = Path(model_path).parent
    references = [config.get('model')] + config.get('textures', [])
    if not references[0] or not all((root / item).is_file() for item in references):
        raise ValueError('模型文件或纹理不完整')
    if not glfw.init():
        raise RuntimeError('无法初始化 OpenGL')
    window = None
    model = None
    encoder = None
    try:
        glfw.window_hint(glfw.VISIBLE, glfw.FALSE)
        window = glfw.create_window(width, height, 'Avatar renderer', None, None)
        if not window:
            raise RuntimeError('无法创建离屏渲染上下文')
        glfw.make_context_current(window)
        live2d.init()
        live2d.glInit()
        model = live2d.Model()
        model.LoadModelJson(str(model_path))
        model.Resize(width, height)
        model.SetAutoBlink(True)
        model.SetAutoBreath(True)
        params = set(model.GetParamIds())
        if 'PARAM_MOUTH_OPEN_Y' not in params:
            raise ValueError('模型缺少嘴部开合参数')
        motions = config.get('motions', {}).get('idle', [])
        if motions:
            model.StartMotion('idle', 0, 3)
        samples = np.zeros(640, dtype=np.float32)
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        if audio:
            decoded = subprocess.run([ffmpeg, '-v', 'error', '-i', str(audio), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-t', '120', 'pipe:1'], capture_output=True, check=True, timeout=60)
            samples = np.frombuffer(decoded.stdout, dtype='<f4')
            if not samples.size:
                raise ValueError('语音文件无法解码')
            if samples.size >= 120 * 16000:
                raise ValueError('单轮讲解超过两分钟，请缩短讲解')
        if output:
            Path(output).parent.mkdir(parents=True, exist_ok=True)
            encoder = subprocess.Popen([ffmpeg, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{width}x{height}', '-r', str(fps), '-i', 'pipe:0', '-i', str(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', '-shortest', str(output)], stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        count = math.ceil(len(samples) / (16000 / fps)) if audio else 1
        mouth = 0.0
        GL.glViewport(0, 0, width, height)
        for index in range(count):
            glfw.poll_events()
            model.Update(1 / fps)
            section = samples[int(index * 16000 / fps):int((index + 1) * 16000 / fps)]
            rms = float(np.sqrt(np.mean(section ** 2))) if len(section) else 0
            target = min(1.0, rms * 7.0)
            mouth += (target - mouth) * (0.8 if target > mouth else 0.55)
            model.SetParamById('PARAM_MOUTH_OPEN_Y', mouth)
            live2d.clearBuffer(0.965, 0.974, 0.99, 1.0)
            model.Draw()
            GL.glFinish()
            pixels = np.frombuffer(GL.glReadPixels(0, 0, width, height, GL.GL_RGB, GL.GL_UNSIGNED_BYTE), dtype=np.uint8).reshape(height, width, 3)[::-1].copy()
            if index == 0:
                if float(pixels.std()) < 2:
                    raise RuntimeError('模型没有渲染出有效画面')
                if preview:
                    from PIL import Image
                    Image.fromarray(pixels).save(preview)
            if encoder:
                encoder.stdin.write(pixels.tobytes())
        if encoder:
            encoder.stdin.close()
            errors = encoder.stderr.read()
            if encoder.wait(timeout=30) != 0:
                raise RuntimeError('视频编码失败：' + errors.decode(errors='replace')[-300:])
        print(json.dumps({'ready': True, 'output': str(output or ''), 'frames': count}, ensure_ascii=False), flush=True)
    finally:
        if encoder and encoder.poll() is None:
            encoder.kill()
            encoder.wait()
        if model:
            model.DestroyRenderer()
        live2d.dispose()
        if window:
            glfw.destroy_window(window)
        glfw.terminate()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    parser.add_argument('--audio')
    parser.add_argument('--output')
    parser.add_argument('--preview')
    args = parser.parse_args()
    if bool(args.audio) != bool(args.output):
        parser.error('--audio and --output must be supplied together')
    render(args.model, args.audio, args.output, args.preview)
