"""Link empty route covers to existing photos of their actual member spots.

Only uses local images referenced by database records. Saves previous values.
"""
import json
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text

ROOT = Path(__file__).resolve().parents[1]


def main():
    load_dotenv(ROOT / '.env', override=True)
    engine = create_engine(URL.create('postgresql+psycopg',
        username=os.getenv('POSTGRES_USER', 'postgres'), password=os.environ['POSTGRES_PASSWORD'],
        host=os.getenv('POSTGRES_SERVER', '127.0.0.1'), port=int(os.getenv('POSTGRES_PORT', '15432')),
        database=os.getenv('POSTGRES_DB', 'streamer_sales_db')))
    changes = []
    missing = []
    with engine.begin() as db:
        for row in db.execute(text('SELECT spot_id,image_path FROM scenic_spot_info WHERE NOT delete')).mappings():
            if row['image_path'] and not (ROOT / 'static' / row['image_path']).is_file():
                missing.append(dict(row))
        for route in db.execute(text("SELECT route_id,cover_image,cover_generated FROM tour_route WHERE NOT delete AND COALESCE(cover_image,'')='' ")).mappings():
            photos = db.execute(text('''SELECT s.spot_id,s.image_path FROM tour_route_spot rs
                JOIN scenic_spot_info s ON s.spot_id=rs.spot_id
                WHERE rs.route_id=:id AND NOT s.delete ORDER BY rs.spot_order,rs.id'''), {'id': route['route_id']}).mappings()
            for photo in photos:
                path = (ROOT / 'static' / (photo['image_path'] or '')).resolve()
                if photo['image_path'] and path.is_relative_to(ROOT / 'static') and path.is_file():
                    changes.append({**dict(route), 'source_spot_id': photo['spot_id'], 'new_cover_image': photo['image_path']})
                    break
        backup = ROOT / 'work_dirs' / ('route-photo-links-' + datetime.now().strftime('%Y%m%d%H%M%S') + '.json')
        backup.write_text(json.dumps({'changes': changes, 'missing_spot_images': missing}, ensure_ascii=False, indent=2), encoding='utf-8')
        for change in changes:
            db.execute(text('UPDATE tour_route SET cover_image=:image,cover_generated=false WHERE route_id=:id'),
                {'image': change['new_cover_image'], 'id': change['route_id']})
    print(f'Linked {len(changes)} route covers to existing member photos; {len(missing)} missing spot images. Backup: {backup.name}')


if __name__ == '__main__':
    main()
