"""Import reviewed Commons photographs, keeping source and license records."""
import hashlib
import html
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import psycopg
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

# Each choice was reviewed against the file description and named location.
choices = {58: 4, 60: 2, 61: 2, 62: 2, 63: 3, 64: 2, 65: 0, 66: 3, 47: 0}
candidates = json.loads((ROOT / 'work_dirs/photo-candidates.json').read_text(encoding='utf-8'))
if candidates['57'] and 'Beijing Summer Palace Leshoutang' in candidates['57'][0]['title']:
    choices[57] = 0
if candidates['59'] and candidates['59'][0]['title'] == 'File:排云殿.jpg':
    choices[59] = 0
folder = ROOT / 'static/tour_files/spot_images'
folder.mkdir(parents=True, exist_ok=True)
manifest_path = folder / 'commons-attribution.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
changes, failures = [], []
client = requests.Session()
client.headers['User-Agent'] = 'ScenicGuideAssetImport/1.0 (local scenic guide; Commons attribution retained)'

with psycopg.connect(host=os.environ.get('POSTGRES_SERVER', '127.0.0.1'),
                     port=os.environ.get('POSTGRES_PORT', '15432'),
                     dbname=os.environ.get('POSTGRES_DB', 'streamer_sales_db'),
                     user=os.environ.get('POSTGRES_USER', 'postgres'), password=os.environ['POSTGRES_PASSWORD']) as db:
    db.execute('''CREATE TABLE IF NOT EXISTS scenic_spot_photo_source (
        spot_id INTEGER PRIMARY KEY REFERENCES scenic_spot_info(spot_id),
        image_path TEXT NOT NULL, source_metadata JSONB NOT NULL,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)''')
    for sid, index in choices.items():
        try:
            row = db.execute('SELECT spot_name,image_path FROM scenic_spot_info WHERE spot_id=%s AND NOT delete', (sid,)).fetchone()
            if not row:
                raise ValueError('Missing scenic spot')
            name, previous = row
            if previous and (ROOT / 'static' / previous).is_file():
                continue
            entry = candidates[str(sid)][index]
            info, title = entry['info'], entry['title']
            metadata = info.get('extmetadata', {})
            def clean(key):
                return html.unescape(re.sub('<[^>]*>', '', metadata.get(key, {}).get('value', ''))).strip()
            license_name = clean('LicenseShortName')
            if not (license_name.startswith('CC BY') or license_name in ('CC0', 'Public domain')):
                raise ValueError('Unsupported license: ' + license_name)
            url = info.get('thumburl') or info['url']
            response = client.get(url, timeout=40)
            response.raise_for_status()
            target = folder / f'commons-spot-{sid}.jpg'
            temporary = target.with_suffix('.download')
            temporary.write_bytes(response.content)
            with Image.open(temporary) as image:
                image.verify()
            with Image.open(temporary) as image:
                if image.width < 300 or image.height < 200:
                    raise ValueError('Image too small')
                image.convert('RGB').save(target, quality=90)
            temporary.unlink()
            relative = target.relative_to(ROOT / 'static').as_posix()
            record = {'spot_name': name, 'title': title, 'author': clean('Artist'),
                      'license': license_name, 'license_url': clean('LicenseUrl'),
                      'source_page': info['descriptionurl'], 'download_url': url,
                      'changes': 'Converted to JPEG; resized by Wikimedia preview service if applicable.',
                      'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
            manifest[str(sid)] = record
            changes.append({'spot_id': sid, 'previous_image_path': previous, 'image_path': relative})
            backup = ROOT / 'work_dirs' / ('photo-import-backup-' + datetime.now().strftime('%Y%m%d%H%M%S%f') + '.json')
            backup.write_text(json.dumps(changes, ensure_ascii=False, indent=2), encoding='utf-8')
            db.execute('UPDATE scenic_spot_info SET image_path=%s WHERE spot_id=%s', (relative, sid))
            db.execute('''INSERT INTO scenic_spot_photo_source(spot_id,image_path,source_metadata)
                VALUES(%s,%s,%s::jsonb) ON CONFLICT(spot_id) DO UPDATE
                SET image_path=excluded.image_path,source_metadata=excluded.source_metadata''',
                (sid, relative, json.dumps(record, ensure_ascii=False)))
            db.commit()
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
            print('Imported', sid, name, flush=True)
        except Exception as error:
            db.rollback()
            failures.append({'spot_id': sid, 'error': str(error)})
            print('Failed', sid, str(error), flush=True)
print(json.dumps({'imported': len(changes), 'failures': failures}, ensure_ascii=False))
