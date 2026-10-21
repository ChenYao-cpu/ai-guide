"""Preview/apply concise visit defaults without changing walking times or route order."""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / '.env', override=True)
from sqlmodel import Session, select
from server.base.database.init_db import DB_ENGINE
from server.base.models.tour_models import ScenicSpotInfo, TourRoute, TourRouteSpot
from server.base.modules.route_presentation import route_overview


def sync(apply=False):
    minutes = json.loads((ROOT / 'data/summer_palace_visit_durations.json').read_text(encoding='utf-8'))['minutes']
    with Session(DB_ENGINE) as session:
        spots = session.exec(select(ScenicSpotInfo).where(
            ScenicSpotInfo.delete == False, ScenicSpotInfo.city.in_(['北京', '北京市', 'Beijing']),
            ScenicSpotInfo.spot_name.in_(minutes)).order_by(ScenicSpotInfo.spot_id)).all()
        if len(spots) != len(minutes) or {s.spot_name for s in spots} != set(minutes):
            raise ValueError('Expected all 16 unique Summer Palace attractions; no data changed')
        before = [s.model_dump(mode='json') for s in spots]
        revised = [dict(s.model_dump(), visit_duration=minutes[s.spot_name]) for s in spots]
        ids = {s.spot_id for s in spots}
        routes = session.exec(select(TourRoute).where(TourRoute.delete == False)).all()
        route_updates = []
        for route in routes:
            members = session.exec(select(ScenicSpotInfo).join(TourRouteSpot,
                TourRouteSpot.spot_id == ScenicSpotInfo.spot_id).where(
                TourRouteSpot.route_id == route.route_id).order_by(TourRouteSpot.spot_order)).all()
            if not any(s.spot_id in ids for s in members):
                continue
            overview = route_overview([dict(s.model_dump(), visit_duration=minutes[s.spot_name])
                if s.spot_id in ids else s.model_dump() for s in members])
            if overview['complete']:
                route_updates.append((route, overview['total_minutes']))
        if apply:
            backup = ROOT / 'work_dirs/visit-duration-backups'
            backup.mkdir(parents=True, exist_ok=True)
            (backup / (datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json')).write_text(json.dumps({
                'database': DB_ENGINE.url.database, 'spots': before,
                'route_times': [dict(route_id=r.route_id, minutes=r.estimated_time_minutes)
                                for r, _ in route_updates]}, ensure_ascii=False, indent=2), encoding='utf-8')
            for spot in spots:
                spot.visit_duration = minutes[spot.spot_name]
                session.add(spot)
            for route, total in route_updates:
                route.estimated_time_minutes = total
                session.add(route)
            session.commit()
        keys = ('visit_minutes', 'walking_minutes', 'rest_minutes', 'total_minutes')
        old_overview, new_overview = route_overview(before), route_overview(revised)
        return dict(applied=apply, database=DB_ENGINE.url.database, spots=minutes,
            before={k: old_overview[k] for k in keys}, after={k: new_overview[k] for k in keys},
            routes=[dict(name=r.name, minutes=total) for r, total in route_updates])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    print(json.dumps(sync(parser.parse_args().apply), ensure_ascii=True, indent=2))
