from pathlib import Path
import json,math,sys
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.base.modules.avatar3d import upper_body_rig,upper_body_pose,rotate_vector,multiply
results=[]
def angle(a,b):
 a=np.asarray(a);b=np.asarray(b);return math.degrees(2*math.acos(min(1,abs(float(np.dot(a,b)/np.linalg.norm(a)/np.linalg.norm(b))))))
for p in Path('static/digital_guide/3d/models').glob('*/base.json'):
 rig=upper_body_rig(json.loads(p.read_text(encoding='utf-8')));nodes,ids,parents,*_=rig;rest=upper_body_pose(rig,0,[])
 def world(i):
  q=rest.get(nodes[i].get('name'),nodes[i].get('rotation',[0,0,0,1]));return multiply(world(parents[i]),q) if i in parents else q
 def position(i):
  parent=parents.get(i)
  return (position(parent)+rotate_vector(world(parent),nodes[i].get('translation',[0,0,0]))) if parent is not None else np.asarray(nodes[i].get('translation',[0,0,0]),dtype=float)
 for side in ('L','R'):
  n=lambda part:f'J_Bip_{side}_{part}'
  wrist=position(ids[n('Hand')]);hip=position(ids['J_Bip_C_Hips']);height=rig[-3]
  assert wrist[1]<hip[1]+height*.07,('hands must stay at lower abdomen',p,wrist)
  assert np.dot(wrist-hip,rig[-1])>height*.07,('hands must be in front of clothing',p,wrist)
  upper=rotate_vector(world(ids[n('UpperArm')]),nodes[ids[n('LowerArm')]]['translation']);lower=rotate_vector(world(ids[n('LowerArm')]),nodes[ids[n('Hand')]]['translation'])
  elbow=180-math.degrees(math.acos(np.dot(upper,lower)/np.linalg.norm(upper)/np.linalg.norm(lower)));assert abs(elbow-130)<.002,(p,elbow)
  palm=-np.cross(nodes[ids[n('Index1')]]['translation'],nodes[ids[n('Little1')]]['translation']);palm/=np.linalg.norm(palm);assert np.dot(rotate_vector(world(ids[n('Hand')]),palm),-rig[-1])>.95
  for time,elbow,wrist in [(3.8,70 if side=='R' else 0,110 if side=='R' else 0),(69.8,30,45)]:
   pose=upper_body_pose(rig,time,[])
   if time==3.8 and side=='R':
    saved=rest;rest=pose
    peak_upper=rotate_vector(world(ids[n('UpperArm')]),nodes[ids[n('LowerArm')]]['translation']);peak_lower=rotate_vector(world(ids[n('LowerArm')]),nodes[ids[n('Hand')]]['translation'])
    included=180-math.degrees(math.acos(np.clip(np.dot(peak_upper,peak_lower)/np.linalg.norm(peak_upper)/np.linalg.norm(peak_lower),-1,1)))
    rest=saved;assert abs(included-90)<.002,('actual elbow must bend to 90 degrees',p,included)
   assert angle(rest[n('UpperArm')],pose[n('UpperArm')])<.002
   assert abs(angle(rest[n('LowerArm')],pose[n('LowerArm')])-elbow)<.002
   assert abs(angle(rest[n('Hand')],pose[n('Hand')])-wrist)<.002
 for t in (6.8,20,60,66.8,72.8,90):
  pose=upper_body_pose(rig,t,[]);assert all(angle(rest[k],pose[k])<.002 for k in rest)
 results.append(p.parent.name)
assert results
Path('work_dirs/elbow-sequence-verification.json').write_text(json.dumps({'models':results,'anglesVerified':True,'restGapSeconds':60}),encoding='utf-8')
print('PASS:',len(results),'models; exact joint angles, inward palms, fixed upper arms, 60-second rest')
