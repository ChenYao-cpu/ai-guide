"""Install generated route cover files and persist their actual database links.

Usage: python scripts/import_generated_route_covers.py work_dirs/generated-route-covers.json
Manifest entries: route_id, source_path, prompt.
"""
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

import psycopg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
entries = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
folder = ROOT / 'static/tour_files/route_covers'
folder.mkdir(parents=True, exist_ok=True)
stamp = datetime.now().strftime('%Y%m%d%H%M%S')
prepared, backup = [], []
with psycopg.connect(host=os.environ.get('POSTGRES_SERVER', '127.0.0.1'),
                     port=os.environ.get('POSTGRES_PORT', '15432'),
                     dbname=os.environ.get('POSTGRES_DB', 'streamer_sales_db'),
                     user=os.environ.get('POSTGRES_USER', 'postgres'), password=os.environ['POSTGRES_PASSWORD']) as db:
    for entry in entries:
        sid = int(entry['route_id'])
        source = Path(entry['source_path'])
        with Image.open(source) as image:
            image.verify()
        row = db.execute('SELECT name,cover_image,cover_generated FROM tour_route WHERE route_id=%s AND NOT delete', (sid,)).fetchone()
        if not row:
            raise ValueError(f'Route {sid} does not exist')
        if row[1]:
            raise ValueError(f'Route {sid} already has a cover; do not overwrite it silently')
        relative = f'tour_files/route_covers/route-{sid}-generated-{stamp}{source.suffix.lower()}'
        target = ROOT / 'static' / relative
        shutil.copy2(source, target)
        backup.append({'route_id': sid, 'name': row[0], 'cover_image': row[1], 'cover_generated': row[2]})
        prepared.append({**entry, 'route_name': row[0], 'image_path': relative,
                         'generator': 'built-in image_gen',
                         'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    (ROOT / 'work_dirs' / f'route-cover-backup-{stamp}.json').write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding='utf-8')
    db.execute('''CREATE TABLE IF NOT EXISTS tour_route_cover_source (
        route_id INTEGER PRIMARY KEY REFERENCES tour_route(route_id),
        image_path TEXT NOT NULL, generation_metadata JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)''')
    for entry in prepared:
        db.execute('UPDATE tour_route SET cover_image=%s,cover_generated=true WHERE route_id=%s', (entry['image_path'], entry['route_id']))
        db.execute('INSERT INTO tour_route_cover_source(route_id,image_path,generation_metadata) VALUES(%s,%s,%s::jsonb)',
                   (entry['route_id'], entry['image_path'], json.dumps(entry, ensure_ascii=False)))
(folder / f'generation-manifest-{stamp}.json').write_text(json.dumps(prepared, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Installed and linked {len(prepared)} route covers.')
