"""Install user-provided Summer Palace photos and update real scenic-spot rows."""
import json, os, sys, shutil
from pathlib import Path
from datetime import datetime
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key,value=line.split('=',1);os.environ.setdefault(key.strip(),value.strip().strip(chr(34)).strip(chr(39)))
from sqlmodel import Session, select
from server.base.database.init_db import DB_ENGINE
from server.base.models.tour_models import ScenicSpotInfo
from server.base.modules.route_city import spot_city
photos=[
('昆明湖','kunming-lake-user.png','codex-clipboard-8e59eece-10a5-4142-986b-64f502e8f83d.png'),
('佛香阁','foxiang-pavilion-user.png','codex-clipboard-bb3f66ba-6508-4859-9e1f-9425fac58284.png'),
('长廊','long-corridor-user.png','codex-clipboard-461aa4fd-3df7-4db5-87a4-ac35c14b848b.png'),
('十七孔桥','seventeen-arch-bridge-user.png','codex-clipboard-4a32a187-3cdc-4f7e-8f4e-ec5b142b1300.png'),
('苏州街','suzhou-street-user.png','codex-clipboard-35d4ec25-f351-4b12-85fe-5767d2729a24.png')]
destination=ROOT/'static/tour_files/spot_images';destination.mkdir(parents=True,exist_ok=True)
changes=[]
with Session(DB_ENGINE) as db:
    rows=[]
    for name,filename,attachment in photos:
        source=Path('C:/Users/ASUS/AppData/Local/Temp')/attachment
        assert source.is_file(),source
        matched=[s for s in db.exec(select(ScenicSpotInfo).where(ScenicSpotInfo.spot_name==name,ScenicSpotInfo.delete==False)).all() if spot_city(s)=='北京']
        assert len(matched)==1,(name,len(matched))
        rows.append((matched[0],filename,source))
    for spot,filename,source in rows:
        target=destination/filename
        if target.exists() and target.read_bytes()!=source.read_bytes():
            shutil.copy2(target,target.with_name(target.stem+'-backup-'+datetime.now().strftime('%Y%m%d%H%M%S')+target.suffix))
        shutil.copy2(source,target)
        changes.append({'spot_id':spot.spot_id,'spot_name':spot.spot_name,'previous_image_path':spot.image_path,'image_path':'tour_files/spot_images/'+filename})
        spot.image_path=changes[-1]['image_path'];db.add(spot)
    backup=ROOT/'work_dirs'/('summer-palace-photos-'+datetime.now().strftime('%Y%m%d%H%M%S')+'.json')
    backup.write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')
    db.commit()
print('Updated',len(changes),'real Beijing scenic spots; original paths backed up to',backup.name)
