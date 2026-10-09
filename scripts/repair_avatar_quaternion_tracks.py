import os,json,sys,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
for line in (root/'.env').read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);os.environ.setdefault(k.strip(),v.strip().strip('\"').strip("'"))
from server.base.modules.avatar3d import write_glb
count=0
for p in (root/'static/digital_guide/3d').rglob('*.gltf'):
 d=json.loads(p.read_text(encoding='utf-8'));chunks=[(p.parent/b['uri']).read_bytes() for b in d['buffers']]
 write_glb(p.with_suffix('.glb'),d,chunks);count+=1
print('XR assets regenerated:',count)
