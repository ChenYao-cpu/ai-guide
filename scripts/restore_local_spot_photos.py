"""Restore known local photos without overwriting existing assets."""
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('\"').strip("'"))
from sqlmodel import Session, select
from server.base.database.init_db import DB_ENGINE
from server.base.models.tour_models import ScenicSpotInfo

source = Path(sys.argv[1]).resolve() / 'static'
photos = {'仁寿殿': 'renshou-hall-user.png', '昆明湖': 'kunming-lake-user.png', '佛香阁': 'foxiang-pavilion-user.png',
          '长廊': 'long-corridor-user.png', '十七孔桥': 'seventeen-arch-bridge-user.png',
          '苏州街': 'suzhou-street-user.png'}
copied, changes = 0, []
with Session(DB_ENGINE) as db:
    for spot in db.exec(select(ScenicSpotInfo).where(ScenicSpotInfo.delete == False)).all():
        relative = spot.image_path
        if not relative and spot.spot_name in photos and '北京' in (spot.city + spot.location):
            relative = 'tour_files/spot_images/' + photos[spot.spot_name]
        if not relative:
            continue
        src, dest = (source / relative).resolve(), (ROOT / 'static' / relative).resolve()
        if not src.is_relative_to(source) or not dest.is_relative_to(ROOT / 'static'):
            continue
        if not src.is_file():
            continue
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            copied += 1
        if not spot.image_path:
            changes.append({'spot_id': spot.spot_id, 'previous_image_path': spot.image_path, 'image_path': relative})
            spot.image_path = relative
            db.add(spot)
    backup = ROOT / 'work_dirs' / ('photo-restoration-' + datetime.now().strftime('%Y%m%d%H%M%S') + '.json')
    backup.write_text(json.dumps(changes, ensure_ascii=False, indent=2), encoding='utf-8')
    db.commit()
print(f'Restored {copied} files; bound {len(changes)} existing photos; backup: {backup.name}')
