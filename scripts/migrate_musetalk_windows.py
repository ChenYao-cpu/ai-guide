from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'server/digital_human/modules/realtime_inference.py'
source = path.read_text(encoding='utf-8')
source = source.replace('import copy\n', 'import copy\nimport subprocess\nfrom .image_files import write_image\n')
start = source.index('def setup_ffmpeg_env(')
end = source.index('def init_digital_model(', start)
source = source[:start] + '''def setup_ffmpeg_env(model_dir):
    import imageio_ffmpeg
    directory = Path(model_dir).resolve() / 'drivers'
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / ('ffmpeg.exe' if os.name == 'nt' else 'ffmpeg')
    if not target.is_file():
        shutil.copy2(imageio_ffmpeg.get_ffmpeg_exe(), target)
    os.environ['PATH'] = str(directory) + os.pathsep + os.environ.get('PATH', '')


''' + source[end:]
start = source.index('    os.environ["HF_ENDPOINT"]', source.index('def init_digital_model('))
end = source.index('    # load model weights', start)
source = source[:start] + '''    muse_talk_model_path = Path(model_dir)
    sd_model_path = Path(model_dir) / 'sd-vae-ft-mse'
    whisper_pth_path = Path(model_dir) / 'whisper/tiny.pt'
    required = [whisper_pth_path, sd_model_path / 'diffusion_pytorch_model.bin', muse_talk_model_path / 'musetalk/pytorch_model.bin']
    if not all(item.is_file() for item in required):
        raise FileNotFoundError('请先运行 scripts/download_avatar_weights.py 下载模型')

''' + source[end:]
start = source.index('    os.environ["HF_ENDPOINT"]', source.index('def load_pose_model('))
end = source.index('    config_file', start)
source = source[:start] + "    dw_pose_path = Path(model_dir) / 'dwpose/dw-ll_ucoco_384.pth'\n\n" + source[end:]
start = source.index('    os.environ["HF_ENDPOINT"]', source.index('def load_face_parsing_model('))
end = source.index('    face_parsing_model =', start)
source = source[:start] + '''    model_dir = Path(model_dir) / 'face-parse-bisent'
    resnet_path = model_dir / 'resnet18-5c106cde.pth'

''' + source[end:]
source = source.replace('cv2.imwrite(', 'write_image(')
start = source.index('        cmd_img2video =')
end = source.index('        logger.info("Remove tmp files', start)
source = source[:start] + '''        temporary_video = str(Path(self.avatar_path) / (tmp_tag + '.mp4'))
        subprocess.run(['ffmpeg', '-y', '-v', 'warning', '-r', str(fps), '-f', 'image2', '-i', str(Path(self.avatar_path) / tmp_tag / '%08d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', temporary_video], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'warning', '-i', temporary_video, '-i', str(audio_path), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', str(output_vid)], check=True)

''' + source[end:]
source = source.replace('        batch_size=32,', '        batch_size=4,')
path.write_text(source, encoding='utf-8')
path = root / 'server/digital_human/modules/musetalk/utils/preprocessing.py'
source = path.read_text(encoding='utf-8').replace('import pickle\n', 'import pickle\nfrom ...image_files import read_image\n').replace('cv2.imread(img_path)', 'read_image(img_path)')
path.write_text(source, encoding='utf-8')
