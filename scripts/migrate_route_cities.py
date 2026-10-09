"""Backfill explicit address cities and verified existing Summer Palace spots.

Summer Palace source: scripts/seed_summer_palace_demo.py;
verified city: https://zyk.bjhd.gov.cn/kjhd/lyhd/201810/t20181023_4530788_hd.shtml
Unknown relative addresses remain unconfigured; no guessed nearest city.
"""
import json,runpy
from datetime import datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ns=runpy.run_path(str(ROOT/'scripts/migrate_left_hand_gestures.py'))
from sqlmodel import Session,select
from server.base.database.init_db import DB_ENGINE,_migrate_add_missing_columns
from server.base.models.tour_models import ScenicSpotInfo,TourRoute
from server.base.modules.route_city import spot_city,route_city

_migrate_add_missing_columns()
seed=runpy.run_path(str(ROOT/'scripts/seed_summer_palace_demo.py'))
summer_names={'仁寿殿','长廊','佛香阁','昆明湖','十七孔桥','苏州街'}
with Session(DB_ENGINE) as db:
    spots=db.exec(select(ScenicSpotInfo)).all();routes=db.exec(select(TourRoute)).all()
    backup={'spots':[{'spot_id':s.spot_id,'city':s.city} for s in spots],
            'routes':[{'route_id':r.route_id,'city':r.city} for r in routes]}
    path=ROOT/'work_dirs'/('route-cities-backup-'+datetime.now().strftime('%Y%m%d%H%M%S')+'.json')
    path.write_text(json.dumps(backup,ensure_ascii=False),encoding='utf8')
    updated=0
    for s in spots:
        if s.city:continue
        city=spot_city(s)
        if not city and s.spot_name in summer_names and 39.98<s.latitude<40.02 and 116.25<s.longitude<116.29:
            city='北京'
        if city:s.city=city;db.add(s);updated+=1
    db.flush()
    configured=0
    for r in routes:
        try:r.city=route_city([x.spot_info for x in r.route_spots if x.spot_info and not x.spot_info.delete])
        except ValueError:continue
        db.add(r);configured+=1
    db.commit()
    print(json.dumps({'spots_updated':updated,'routes_configured':configured,'backup':str(path)},ensure_ascii=True))
