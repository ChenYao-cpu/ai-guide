"""Reauthor saved performances using their real speech envelopes; retain DB identity."""
import json,os,sys,shutil
from pathlib import Path
from datetime import datetime
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  key,value=line.split('=',1);os.environ.setdefault(key.strip(),value.strip().strip('"').strip("'"))
from sqlmodel import Session,select
from server.base.database.init_db import DB_ENGINE
from server.base.models.tour_models import AvatarPerformance, VisitorInteraction
from server.base.modules.avatar3d import animated_document,gesture_plan,write_glb

def reauthor(path,text=''):
 doc=json.loads(path.read_text(encoding='utf-8'));chunks=[(path.parent/b['uri']).read_bytes() for b in doc['buffers']]
 def samples(i):
  a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
  return np.frombuffer(chunks[v['buffer']],dtype='<f4',count=a['count'],offset=v.get('byteOffset',0)+a.get('byteOffset',0))
 channel=next(c for c in doc['animations'][0]['channels'] if c['target']['path']=='weights')
 sampler=doc['animations'][0]['samplers'][channel['sampler']];times=samples(sampler['input'])
 node=doc['nodes'][channel['target']['node']];names=doc['meshes'][node['mesh']]['extras']['targetNames']
 column=next(i for i,n in enumerate(names) if n.endswith('_MTH_A'))
 amplitudes=samples(sampler['output']).reshape(-1,len(names))[:,column]/.8
 base_path=(path.parent/doc['buffers'][0]['uri']).resolve().parent/'base.json'
 base=json.loads(base_path.read_text(encoding='utf-8'));gestures=gesture_plan(text,float(times[-1]))
 updated,animation=animated_document(base,doc['buffers'][0]['uri'],times,amplitudes,gestures,path.stem)
 return updated,animation,chunks[0],gestures

if __name__=='__main__':
 backup=ROOT/'work_dirs'/('left-gesture-backup-'+datetime.now().strftime('%Y%m%d%H%M%S'));count=0
 with Session(DB_ENGINE) as db:
  for record in db.exec(select(AvatarPerformance)).all():
   path=(ROOT/'static'/record.scene_path).resolve()
   if not path.is_relative_to((ROOT/'static/digital_guide/3d').resolve()):raise ValueError('Unexpected performance path')
   if not path.exists():continue
   message=db.get(VisitorInteraction,record.message_id)
   doc,animation,model,gestures=reauthor(path,message.message if message else '')
   for original in [path,path.with_suffix('.bin'),path.with_suffix('.glb'),path.with_suffix('.morph.json')]:
    if original.exists():
     destination=backup/original.relative_to(ROOT);destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,destination)
   path.write_text(json.dumps(doc,ensure_ascii=False),encoding='utf-8');path.with_suffix('.bin').write_bytes(animation)
   write_glb(path.with_suffix('.glb'),doc,[model,animation]);record.timeline_json=json.dumps(gestures,ensure_ascii=False);db.add(record);count+=1
  db.commit()
 print(json.dumps({'updated':count,'backup':str(backup)},ensure_ascii=False))
