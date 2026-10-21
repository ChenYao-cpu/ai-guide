"""Recover the user's old phone history after verifying the cached account.

Only reads the HBuilder debug app storage. Does not touch other accounts or
overwrite newer server history. Keeps a history-only recovery snapshot.
"""
import json
import os
import re
import sqlite3
import subprocess
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text

ROOT = Path(__file__).resolve().parents[1]
ADB = r'D:\HBuilderX\HBuilderX\plugins\launcher-tools\tools\adbs\adb.exe'


def parse_time(value):
    match = re.fullmatch(r'\w+ (\w+ \d+ \d+ \d+:\d+:\d+) GMT([+-])(\d{2})(\d{2})(?: \([^)]*\))?', value)
    if not match:
        raise ValueError('Unsupported original timestamp; refusing to invent a time')
    offset = timedelta(hours=int(match[3]), minutes=int(match[4]))
    if match[2] == '-':
        offset = -offset
    return datetime.strptime(match[1], '%b %d %Y %H:%M:%S').replace(tzinfo=timezone(offset)).astimezone(timezone.utc).replace(tzinfo=None)


def main():
    temporary = ROOT / 'work_dirs' / 'phone-history-recovery.sqlite'
    try:
        temporary.write_bytes(subprocess.check_output([ADB, 'exec-out', 'run-as', 'io.dcloud.HBuilder', 'cat', 'databases/DCStorage']))
        with closing(sqlite3.connect(temporary)) as local:
            stored = dict(local.execute('SELECT key,value FROM DC_1471076813_storage WHERE key IN (\'view_history\',\'user_id\',\'username\')'))
        owner = json.loads(stored['user_id'])['data']
        if owner != 1 or stored['username'] != 'admin':
            raise ValueError('Cached account changed; stop recovery')
        history = json.loads(stored['view_history'])
    finally:
        temporary.unlink(missing_ok=True)
    prepared = [(int(item['spot_id']), parse_time(item['viewTime'])) for item in history]
    load_dotenv(ROOT / '.env', override=True)
    engine = create_engine(URL.create('postgresql+psycopg', username=os.getenv('POSTGRES_USER', 'postgres'),
        password=os.environ['POSTGRES_PASSWORD'], host=os.getenv('POSTGRES_SERVER'),
        port=int(os.getenv('POSTGRES_PORT')), database=os.getenv('POSTGRES_DB')))
    snapshot = ROOT / 'work_dirs' / ('recovered-view-history-' + datetime.now().strftime('%Y%m%d%H%M%S') + '.json')
    snapshot.write_text(json.dumps({'user_id': owner, 'source': 'phone DCStorage view_history', 'records': history}, ensure_ascii=False, indent=2), encoding='utf-8')
    with engine.begin() as db:
        user = db.execute(text('SELECT username FROM user_info WHERE user_id=:id AND NOT delete'), {'id': owner}).scalar_one()
        if user != 'admin':
            raise ValueError('Server account does not match cached account')
        for item, (spot_id, viewed_at) in zip(history, prepared):
            if not db.execute(text('SELECT spot_id FROM scenic_spot_info WHERE spot_id=:id AND NOT delete'), {'id': spot_id}).scalar_one_or_none():
                candidates = db.execute(text('SELECT spot_id,image_path FROM scenic_spot_info WHERE spot_name=:name AND NOT delete'),
                    {'name': item['spot_name']}).mappings().all()
                old_photo = item.get('image_path', '').split('/')[-1]
                if len(candidates) != 1 or not old_photo or candidates[0]['image_path'].split('/')[-1] != old_photo:
                    raise ValueError('Old spot identity cannot be verified; keep the recovery snapshot')
                spot_id = candidates[0]['spot_id']
                print(f'Resolved renamed database ID {item["spot_id"]} to {spot_id} by matching name and original image')
            db.execute(text('''INSERT INTO spot_view_history(user_id,spot_id,viewed_at) VALUES(:uid,:sid,:viewed)
                ON CONFLICT(user_id,spot_id) DO UPDATE SET viewed_at=GREATEST(spot_view_history.viewed_at,EXCLUDED.viewed_at)'''),
                {'uid': owner, 'sid': spot_id, 'viewed': viewed_at})
    print(f'Recovered {len(prepared)} real cached records for admin, keeping original times. Snapshot: {snapshot.name}')


if __name__ == '__main__':
    main()
