"""修正六个演示景点；保留 ID、路线、讲解与其他数据，修改前保存坐标备份。"""
import json
import argparse
from datetime import datetime
from pathlib import Path

from seed_summer_palace_demo import DB_ENGINE, ScenicSpotInfo, Session, select, ROOT


def main():
    locations = json.loads((ROOT / "data/summer_palace_locations.json").read_text(encoding="utf-8"))["spots"]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spots", nargs="+", choices=list(locations), help="仅修正指定的景点；默认六个景点")
    names = set(parser.parse_args().spots or locations)
    with Session(DB_ENGINE) as session:
        spots = session.exec(select(ScenicSpotInfo).where(ScenicSpotInfo.delete == False)).all()
        targets = [s for s in spots if s.spot_name in names and 39.97 < s.latitude < 40.02 and 116.23 < s.longitude < 116.30]
        if len(targets) != len(names):
            raise RuntimeError(f"预期颐和园 {len(names)} 个景点，实际 {len(targets)} 个，未执行修改")
        backup = ROOT / "work_dirs" / f"spot-coordinates-before-{datetime.now():%Y%m%d-%H%M%S}.json"
        backup.parent.mkdir(exist_ok=True)
        backup.write_text(json.dumps([{"spot_id": s.spot_id, "spot_name": s.spot_name, "latitude": s.latitude, "longitude": s.longitude, "location": s.location} for s in targets], ensure_ascii=False, indent=2), encoding="utf-8")
        for spot in targets:
            for key in ("latitude", "longitude", "location"):
                setattr(spot, key, locations[spot.spot_name][key])
            session.add(spot)
        session.commit()
        print(f"Updated {len(targets)} locations; backup: {backup}")


if __name__ == "__main__":
    main()
