"""Install generated guide artwork and retire old choices without deleting files."""
from pathlib import Path
import json
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / '.env')
from sqlmodel import Session, select
from server.base.database.init_db import DB_ENGINE
from server.base.models.tour_models import DigitalGuideInfo

roles = [('明制汉服女', 'ming-woman-v1.png', 'female_wenrou'),
         ('明制汉服男', 'ming-man-v2.png', 'male_wenhou'),
         ('西装女', 'suit-woman-v1.png', 'female_wenrou'),
         ('西装男', 'suit-man-v1.png', 'male_wenhou')]
with Session(DB_ENGINE) as db:
    guides = db.exec(select(DigitalGuideInfo)).all()
    snapshot = [g.model_dump() for g in guides]
    backup = Path('work_dirs/guide-artwork-before.json')
    if not backup.exists():
        backup.write_text(json.dumps(snapshot, ensure_ascii=False, default=str, indent=2), encoding='utf-8')
    names = {name for name, _, _ in roles}
    for g in guides:
        if g.name not in names:
            g.delete = True
            db.add(g)
    for name, filename, voice in roles:
        path = 'digital_guide/generated/' + filename
        assert (Path('static') / path).is_file(), path
        guide = next((g for g in guides if g.name == name), None)
        if guide is None:
            guide = DigitalGuideInfo(name=name, user_id=1)
        guide.avatar = path
        guide.poster_image = path
        guide.voice_style = voice
        guide.character = '专业、亲切，提供景区历史文化讲解'
        guide.live2d_model_path = ''
        guide.base_mp4_path = ''
        guide.delete = False
        db.add(guide)
    db.commit()
print('Four generated guides installed; previous choices retired and backed up.')
