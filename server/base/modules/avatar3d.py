"""Author real glTF skeletal/morph animation from saved speech and guide configuration."""
import copy
import hashlib
import json
import math
import re
import struct
import subprocess
import uuid
from functools import lru_cache
from pathlib import Path
import numpy as np
from sqlmodel import Session
from .avatar_runtime import local_asset
from ..database.init_db import DB_ENGINE
from ..models.tour_models import AvatarPerformance

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / 'static/digital_guide/3d'
MODEL_SOURCE = ROOT / 'miniprogram/static/models'


def read_glb(path):
    raw = path.read_bytes()
    if raw[:4] != b'glTF':
        raise ValueError('Invalid glTF model')
    length = struct.unpack_from('<I', raw, 12)[0]
    document = json.loads(raw[20:20 + length])
    binary_offset = 20 + length
    binary_length = struct.unpack_from('<I', raw, binary_offset)[0]
    return document, raw[binary_offset + 8:binary_offset + 8 + binary_length]


def quaternion(x=0, y=0, z=0):
    sx, cx = math.sin(x/2), math.cos(x/2)
    sy, cy = math.sin(y/2), math.cos(y/2)
    sz, cz = math.sin(z/2), math.cos(z/2)
    return [sx*cy*cz+cx*sy*sz, cx*sy*cz-sx*cy*sz, cx*cy*sz+sx*sy*cz, cx*cy*cz-sx*sy*sz]


def multiply(a, b):
    x,y,z,w=a; X,Y,Z,W=b
    return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]


def gesture_plan(text, duration):
    # One complete movement, then 60 seconds of rest, then both forearms.
    return [g for g in [
        {'start':0.8,'end':6.8,'gesture':'right_elbow_70','side':'right','elbowDegrees':70,'wristDegrees':110},
        {'start':66.8,'end':72.8,'gesture':'both_elbows_30','side':'both','elbowDegrees':30,'wristDegrees':45},
    ] if g['start'] < duration]


def rotate_vector(q, v):
    v=np.asarray(v,dtype=float);xyz=np.asarray(q[:3])
    return v+2*np.cross(xyz,np.cross(xyz,v)+q[3]*v)


def between_vectors(a,b):
    a=np.asarray(a)/np.linalg.norm(a);b=np.asarray(b)/np.linalg.norm(b)
    dot=float(np.dot(a,b))
    if dot < -.999999:
        axis=np.cross(a,[1,0,0] if abs(a[0])<.9 else [0,1,0]);axis/=np.linalg.norm(axis)
        return [*axis,0.0]
    q=np.array([*np.cross(a,b),1+dot]);return (q/np.linalg.norm(q)).tolist()


def slerp(a,b,w):
    a=np.asarray(a);b=np.asarray(b);dot=float(np.dot(a,b))
    if dot<0:b=-b;dot=-dot
    if dot>.9995:q=a+(b-a)*w
    else:
        angle=math.acos(min(1,dot));q=(math.sin((1-w)*angle)*a+math.sin(w*angle)*b)/math.sin(angle)
    return (q/np.linalg.norm(q)).tolist()


@lru_cache(maxsize=3)
def captured_arm_clip(name):
    """Action3D SMPL-X axis-angle capture; smooth rotations, never Euler angles.

    Only the anatomical right shoulder/elbow are retargeted. Root, legs and
    torso capture are deliberately excluded to preserve the frontal guide.
    """
    path=Path(__file__).resolve().parents[1]/'assets/action3d'/f'{name}.json'
    frames=json.loads(path.read_text(encoding='utf8'))
    tracks=[]
    for frame in frames:
        body=np.asarray(frame['smplx_body_pose']).reshape(21,3)
        rotations=[]
        for index in (16,18):
            vector=body[index];angle=float(np.linalg.norm(vector))
            rotations.append([*(vector/max(angle,1e-9)*math.sin(angle/2)),math.cos(angle/2)])
        tracks.append(rotations)
    result=[]
    for i in range(len(tracks)):
        window=range(max(0,i-2),min(len(tracks),i+3));row=[]
        for joint in range(2):
            reference=np.asarray(tracks[i][joint]);total=np.zeros(4);weights=0
            for j in window:
                q=np.asarray(tracks[j][joint]);q=q if np.dot(q,reference)>=0 else -q
                weight=(.1,.2,.4,.2,.1)[j-i+2];total+=q*weight;weights+=weight
            row.append((total/np.linalg.norm(total)).tolist())
        result.append(row)
    return result


def captured_arm_directions(kind,u,sign):
    name='right_hand_push' if kind=='describe_history' else 'right_hand_raise' if kind=='emphasize' else 'right_hand_intro'
    frames=captured_arm_clip(name);position=min(len(frames)-1,max(0,u*(len(frames)-1)))
    i=int(position);j=min(i+1,len(frames)-1)
    upper=slerp(frames[i][0],frames[j][0],position-i)
    lower=slerp(frames[i][1],frames[j][1],position-i)
    a=rotate_vector(upper,[-1,0,0]);b=rotate_vector(multiply(upper,lower),[-1,0,0])
    # Retain the captured forearm arc, but keep the upper arm near the body.
    a[0]=sign*min(.27,abs(a[0]));a/=np.linalg.norm(a)
    b[0]*=-sign
    return a,b


def lowered_arm_rotation(base,side,lift=0):
    nodes=base['nodes'];ids={n.get('name'):i for i,n in enumerate(nodes)}
    parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    upper=ids[f'J_Bip_{side}_UpperArm'];lower=ids[f'J_Bip_{side}_LowerArm']
    def world(i):
        q=nodes[i].get('rotation',[0,0,0,1])
        return multiply(world(parents[i]),q) if i in parents else q
    parent=world(parents[upper]);rest=nodes[upper].get('rotation',[0,0,0,1])
    vector=nodes[lower]['translation'];source=rotate_vector(rest,vector)
    outward=1 if rotate_vector(parent,source)[0]>=0 else -1
    spread=.25+.20*lift
    desired=[outward*spread,-math.sqrt(1-spread*spread),0]
    inverse=[-v for v in parent[:3]]+[parent[3]]
    return multiply(between_vectors(source,rotate_vector(inverse,desired)),rest)


def left_arm_pose(base,t,gestures):
    """Raise only the anatomical left arm, turn palm up, then reach forward."""
    nodes=base['nodes'];ids={n.get('name'):i for i,n in enumerate(nodes)}
    parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    upper=ids['J_Bip_L_UpperArm'];lower=ids['J_Bip_L_LowerArm'];hand=ids['J_Bip_L_Hand']
    rest=lambda i:nodes[i].get('rotation',[0,0,0,1])
    pose={upper:lowered_arm_rotation(base,'L')}
    def world(i):
        own=pose.get(i,rest(i))
        return multiply(world(parents[i]),own) if i in parents else own
    for g in gestures:
        if not g['start']<=t<=g['end']:continue
        u=(t-g['start'])/max(.1,g['end']-g['start'])
        smooth=lambda v:(lambda x:x*x*(3-2*x))(min(1,max(0,v)))
        weight=smooth(u/.25)*smooth((1-u)/.22)
        forward=smooth((u-.30)/.28)
        pose[upper]=lowered_arm_rotation(base,'L',weight)
        # Model-local forward is -Z; the installed VRM root converts it to +Z.
        root=base['scenes'][base.get('scene',0)]['nodes'][0]
        direction=rotate_vector(world(root),np.array([-.25*(1-forward),.8*(1-forward)+.12,-(.35+.65*forward)]))
        parent_world=world(parents[lower]);inverse=[-v for v in parent_world[:3]]+[parent_world[3]]
        local_direction=rotate_vector(inverse,direction)
        source_direction=rotate_vector(rest(lower),nodes[hand]['translation'])
        desired=multiply(between_vectors(source_direction,local_direction),rest(lower))
        pose[lower]=slerp(rest(lower),desired,weight)
        middle=nodes[ids['J_Bip_L_Middle1']]['translation']
        index=nodes[ids['J_Bip_L_Index1']]['translation'];little=nodes[ids['J_Bip_L_Little1']]['translation']
        palm=-np.cross(index,little);palm/=np.linalg.norm(palm)
        front=rotate_vector(world(root),[0,0,-1]);front/=np.linalg.norm(front)
        up=np.array([0,1,0]);q=between_vectors(middle,front)
        current=rotate_vector(q,palm);current-=front*np.dot(current,front);current/=np.linalg.norm(current)
        angle=math.atan2(float(np.dot(front,np.cross(current,up))),float(np.dot(current,up)))
        desired_world=multiply([*(front*math.sin(angle/2)),math.cos(angle/2)],q)
        parent_world=world(parents[hand]);inverse=[-v for v in parent_world[:3]]+[parent_world[3]]
        pose[hand]=slerp(rest(hand),multiply(inverse,desired_world),weight)
        break
    return {nodes[i]['name']:q for i,q in pose.items()}


def upper_body_rig(base):
    nodes=base['nodes'];ids={n.get('name'):i for i,n in enumerate(nodes)}
    parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    rotations={};positions={}
    def world(i):
        if i in rotations:return rotations[i],positions[i]
        parent_q,parent_p=world(parents[i]) if i in parents else ([0,0,0,1],np.zeros(3))
        rotations[i]=multiply(parent_q,nodes[i].get('rotation',[0,0,0,1]))
        positions[i]=parent_p+rotate_vector(parent_q,nodes[i].get('translation',[0,0,0]))
        return rotations[i],positions[i]
    for i in range(len(nodes)):world(i)
    bounds=[base['accessors'][p['attributes']['POSITION']] for mesh in base['meshes'] for p in mesh['primitives']]
    bottom=min(a.get('min',[0,0,0])[1] for a in bounds);height=max(a.get('max',[0,1.5,0])[1] for a in bounds)-bottom
    root=base['scenes'][base.get('scene',0)]['nodes'][0]
    front=rotate_vector(rotations[root],[0,0,-1]);front/=np.linalg.norm(front)
    return nodes,ids,parents,rotations,positions,height,bottom,front


def abdominal_reference_pose(rig,t,gestures,activity=1):
    """Two-bone arm IK: crossed abdominal rest and restrained right-hand narration."""
    nodes,ids,parents,rest_world,positions,height,bottom,front=rig
    pose={};rest=lambda i:nodes[i].get('rotation',[0,0,0,1])
    def world_q(i):
        own=pose.get(i,rest(i))
        return multiply(world_q(parents[i]),own) if i in parents else own
    inverse=lambda q:[-v for v in q[:3]]+[q[3]]
    smooth=lambda v:(lambda x:x*x*(3-2*x))(min(1,max(0,v)))
    gesture=next((g for g in gestures if g['start']<=t<=g['end']),None)
    u=(t-gesture['start'])/max(.1,gesture['end']-gesture['start']) if gesture else 0
    weight=smooth(u/.28)*smooth((1-u)/.25)*activity if gesture else 0
    kind=gesture['gesture'] if gesture else ''
    taps=sum(math.sin(math.pi*(u-a)/.10)**2 for a in (.38,.57) if a<u<a+.10) if kind=='emphasize' else 0
    center=positions[ids['J_Bip_C_Hips']].copy()
    for side in ('L','R'):
        upper,lower,hand=[ids[f'J_Bip_{side}_{part}'] for part in ('UpperArm','LowerArm','Hand')]
        shoulder=positions[upper];sign=1 if shoulder[0]>=center[0] else -1
        # Right fingers lie above the left hand during pauses.
        target=np.array([center[0]+sign*height*.035,center[1]-height*(.025 if side=='R' else .04),center[2]])+front*height*.12
        fingers=np.array([-sign,-.55,0.0]);normal=-front.copy()
        l1=np.linalg.norm(nodes[lower]['translation']);l2=np.linalg.norm(nodes[hand]['translation'])
        captured_elbow=None
        if side=='R' and weight:
            upper_direction,lower_direction=captured_arm_directions(kind,u,sign)
            # SMPL-X Y is up and Z is forward; map forward into the model's
            # actual world basis rather than assuming its root orientation.
            to_world=lambda v:np.array([v[0],v[1],0])+front*v[2]
            captured_elbow=to_world(upper_direction)*l1
            active=shoulder+captured_elbow+to_world(lower_direction)*l2+front*height*.018*taps
            # The source capture raises to chest/face level. Keep this guide's
            # presentation in the waist-to-lower-chest area of the references.
            active[1]=bottom+height*np.clip((active[1]-bottom)/height,.64,.69)
            active[0]=center[0]+sign*height*np.clip(abs(active[0]-center[0])/height,.07,.15)
            target=target*(1-weight)+active*weight
            # Opening the forearm must not spin the wrist. Keep fingers mostly
            # across the body, opening only about 22 degrees towards the camera.
            fingers=fingers*(1-weight)+(np.array([-sign*.9,0,0])+front*.5)*weight
            normal=np.array([0,1,0])+front*(.18+.07*weight*math.sin(u*math.pi))
        delta=target-shoulder;distance=float(np.linalg.norm(delta));direction=delta/max(distance,1e-6)
        # Keep at least 60 degrees of elbow flexion, never a straight reach.
        # Do not force abdominal rest outward to satisfy an artificial limit.
        reach_max=math.sqrt(l1*l1+l2*l2+2*l1*l2*math.cos(math.radians(60)))
        reach_min=abs(l1-l2)+.001
        distance=math.sqrt(l1*l1+l2*l2+2*l1*l2*math.cos(math.radians(50)));target=shoulder+direction*distance
        along=(l1*l1-l2*l2+distance*distance)/(2*distance)
        # Elbows remain below the shoulders instead of pointing sideways.
        pole=np.array([sign*.15,-1,-.10])
        if captured_elbow is not None:pole=pole*(1-weight)+captured_elbow/max(l1,1e-6)*weight
        pole-=direction*np.dot(pole,direction);pole/=np.linalg.norm(pole)
        elbow=shoulder+direction*along+pole*math.sqrt(max(0,l1*l1-along*along))
        parent=world_q(parents[upper]);source=rotate_vector(rest(upper),nodes[lower]['translation'])
        pose[upper]=multiply(between_vectors(source,rotate_vector(inverse(parent),elbow-shoulder)),rest(upper))
        parent=world_q(parents[lower]);source=rotate_vector(rest(lower),nodes[hand]['translation'])
        pose[lower]=multiply(between_vectors(source,rotate_vector(inverse(parent),target-elbow)),rest(lower))
        middle=nodes[ids[f'J_Bip_{side}_Middle1']]['translation']
        index=nodes[ids[f'J_Bip_{side}_Index1']]['translation'];little=nodes[ids[f'J_Bip_{side}_Little1']]['translation']
        palm=-np.cross(index,little);palm/=np.linalg.norm(palm);fingers/=np.linalg.norm(fingers)
        desired=between_vectors(middle,fingers);current=rotate_vector(desired,palm)
        current-=fingers*np.dot(current,fingers);current/=np.linalg.norm(current)
        normal-=fingers*np.dot(normal,fingers);normal/=np.linalg.norm(normal)
        angle=math.atan2(float(np.dot(fingers,np.cross(current,normal))),float(np.dot(current,normal)))
        desired=multiply([*(fingers*math.sin(angle/2)),math.cos(angle/2)],desired)
        pose[hand]=multiply(inverse(world_q(parents[hand])),desired)
        for finger in ('Index','Middle','Ring','Little'):
            first=ids.get(f'J_Bip_{side}_{finger}1')
            if first is None:continue
            axis=np.cross(nodes[first]['translation'],palm);axis/=max(1e-6,np.linalg.norm(axis))
            curl=.22 if side=='L' else .20
            if side=='R' and kind=='emphasize':curl=(.025 if finger=='Index' else .55)*weight+.20*(1-weight)
            for joint in (1,2,3):
                i=ids.get(f'J_Bip_{side}_{finger}{joint}')
                if i is not None:pose[i]=multiply(rest(i),[*(axis*math.sin(curl/2)),math.cos(curl/2)])
    return {nodes[i]['name']:q for i,q in pose.items()}


def upper_body_pose(rig,t,gestures,activity=1):
    """Fixed upper arms; anatomically mirrored elbow and wrist rotations."""
    nodes,ids,parents,_,positions,height,bottom,front=rig
    baseline=abdominal_reference_pose(rig,0,[],0)
    pose=dict(baseline)
    gesture=next((g for g in gesture_plan('',74) if g['start']<=t<=g['end']),None)
    if not gesture:return pose
    u=(t-gesture['start'])/(gesture['end']-gesture['start'])
    smooth=lambda x:(lambda v:v*v*(3-2*v))(min(1,max(0,x)))
    weight=smooth(u/.3)*smooth((1-u)/.3)
    def world(i):
        q=baseline.get(nodes[i].get('name'),nodes[i].get('rotation',[0,0,0,1]))
        return multiply(world(parents[i]),q) if i in parents else q
    for side in (('R',) if gesture['side']=='right' else ('L','R')):
        upper,lower,hand=[ids[f'J_Bip_{side}_{part}'] for part in ('UpperArm','LowerArm','Hand')]
        upper_direction=rotate_vector(world(upper),nodes[lower]['translation'])
        lower_direction=rotate_vector(world(lower),nodes[hand]['translation'])
        if gesture['side']=='right':
            # Rotate the forearm 70 degrees on a cone while ending at a true
            # 90-degree elbow bend; an arbitrary outward axis can straighten it.
            up=upper_direction/np.linalg.norm(upper_direction)
            low=lower_direction/np.linalg.norm(lower_direction)
            parallel=float(np.dot(up,low));radial=low-up*parallel;radial/=np.linalg.norm(radial)
            bend=math.radians(90)
            cosine=(math.cos(math.radians(70))-parallel*math.cos(bend))/(math.sqrt(max(1e-8,1-parallel*parallel))*math.sin(bend))
            azimuth=math.acos(float(np.clip(cosine,-1,1)))
            candidates=[]
            for direction in (-1,1):
                q=[*(up*math.sin(direction*azimuth/2)),math.cos(azimuth/2)]
                candidate=up*math.cos(bend)+rotate_vector(q,radial)*math.sin(bend)
                candidates.append(candidate)
            outward=np.array([-1.0,.15,0.0])+front*.65
            target=max(candidates,key=lambda v:float(np.dot(v,outward)))
            axis=np.cross(low,target)
        else:axis=np.cross(upper_direction,lower_direction)
        axis/=np.linalg.norm(axis)
        parent=world(parents[lower]);inverse=[-v for v in parent[:3]]+[parent[3]]
        axis=rotate_vector(inverse,axis)
        angle=math.radians(gesture['elbowDegrees'])*weight
        name=nodes[lower]['name'];pose[name]=multiply([*(axis*math.sin(angle/2)),math.cos(angle/2)],baseline[name])
        # Twist at the wrist about the finger direction, without moving the upper arm.
        axis=np.asarray(nodes[ids[f'J_Bip_{side}_Middle1']]['translation'],dtype=float);axis/=np.linalg.norm(axis)
        angle=math.radians(gesture['wristDegrees'])*weight*(-1 if side=='R' else 1)
        name=nodes[hand]['name'];pose[name]=multiply(baseline[name],[*(axis*math.sin(angle/2)),math.cos(angle/2)])
        if gesture['side']=='right':
            fingers=np.array([-1.0,.12,0.0]);fingers/=np.linalg.norm(fingers)
            index=nodes[ids['J_Bip_R_Index1']]['translation'];little=nodes[ids['J_Bip_R_Little1']]['translation']
            palm=-np.cross(index,little);palm/=np.linalg.norm(palm)
            desired=between_vectors(nodes[ids['J_Bip_R_Middle1']]['translation'],fingers)
            current=rotate_vector(desired,palm);current-=fingers*np.dot(current,fingers);current/=np.linalg.norm(current)
            normal=front-fingers*np.dot(front,fingers);normal/=np.linalg.norm(normal)
            twist=math.atan2(float(np.dot(fingers,np.cross(current,normal))),float(np.dot(current,normal)))
            desired=multiply([*(fingers*math.sin(twist/2)),math.cos(twist/2)],desired)
            parent=multiply(world(parents[lower]),pose[nodes[lower]['name']]);inverse=[-v for v in parent[:3]]+[parent[3]]
            desired=multiply(inverse,desired)
            a=np.asarray(baseline[name]);b=np.asarray(desired);distance=2*math.acos(min(1,abs(float(np.dot(a,b)/np.linalg.norm(a)/np.linalg.norm(b)))))
            pose[name]=slerp(baseline[name],desired,math.radians(110)*weight/max(distance,1e-6))

    return pose


def animated_document(base, binary_uri, times, amplitudes, gestures, animation_name, loop=False):
    doc=copy.deepcopy(base)
    doc['animations']=[]
    # Missing metallicFactor defaults to 1 in glTF; skin and cloth are dielectric.
    for material in doc.get('materials', []):
        pbr=material.setdefault('pbrMetallicRoughness', {})
        pbr['metallicFactor']=0.0
        pbr['roughnessFactor']=0.85
    doc['buffers']=[{'uri':binary_uri,'byteLength':base['buffers'][0]['byteLength']}]
    data=bytearray()
    def accessor(values, kind, count=None):
        arr=np.asarray(values,dtype='<f4'); offset=len(data); data.extend(arr.tobytes())
        vi=len(doc.setdefault('bufferViews',[])); doc['bufferViews'].append({'buffer':1,'byteOffset':offset,'byteLength':arr.nbytes})
        ai=len(doc.setdefault('accessors',[]))
        item={'bufferView':vi,'componentType':5126,'count':count or len(arr),'type':kind}
        if kind=='SCALAR': item.update(min=[float(arr.min())],max=[float(arr.max())])
        doc['accessors'].append(item); return ai
    ti=accessor(times,'SCALAR')
    anim={'name':animation_name,'samplers':[],'channels':[]}
    rig=upper_body_rig(base)
    # Keep brief syllable gaps smooth; longer real-audio pauses return both hands.
    activity=[]
    for i,t in enumerate(times):
        nearby=amplitudes[np.abs(times-t)<.30]
        activity.append(1.0 if len(nearby) and float(np.max(nearby))>.08 else 0.0)
    smoothed=np.convolve(activity,np.ones(9)/9,mode='same') if len(activity)>=9 else np.asarray(activity)
    poses=[upper_body_pose(rig,float(t),gestures,float(smoothed[i])) for i,t in enumerate(times)]
    def channel(node,path,values,kind):
        output=accessor(values,kind)
        si=len(anim['samplers']);anim['samplers'].append({'input':ti,'output':output,'interpolation':'LINEAR'})
        anim['channels'].append({'sampler':si,'target':{'node':node,'path':path}})
    for ni,node in enumerate(doc['nodes']):
        name=node.get('name','')
        if name not in poses[0] and name not in ['J_Bip_C_Head','J_Bip_C_Spine']:
            continue
        rotations=[]
        for frame,t in enumerate(times):
            if name in poses[frame]:
                rotations.append(poses[frame][name]);continue
            x=y=z=0.0
            if name=='J_Bip_C_Head': x=.009*math.sin(t*.9)+.016*(1-smoothed[frame]);y=.016*math.sin(t*.45)
            rotations.append(multiply(node.get('rotation',[0,0,0,1]),quaternion(x,y,z)))
        # glTF LINEAR quaternion interpolation needs one continuous hemisphere.
        # Equivalent q/-q keys otherwise interpolate through a wrist flip.
        for frame in range(1,len(rotations)):
            if np.dot(rotations[frame-1],rotations[frame])<0:
                rotations[frame]=[-v for v in rotations[frame]]
        channel(ni,'rotation',rotations,'VEC4')
        node['rotation'] = rotations[0]
    # Keep only seven morphs supported on mobile; amplitude is decoded from the real TTS.
    for ni,node in enumerate(doc['nodes']):
        if 'mesh' not in node:continue
        mesh=doc['meshes'][node['mesh']];names=mesh.get('extras',{}).get('targetNames',[])
        if not names:continue
        selected=[i for i,n in enumerate(names) if any(n.endswith(s) for s in ('_EYE_Close','_MTH_A','_MTH_I','_MTH_U','_MTH_E','_MTH_O','_ALL_Joy'))]
        if not selected:continue
        for p in mesh['primitives']:
            if 'targets' in p:p['targets']=[p['targets'][i] for i in selected]
        mesh['extras']['targetNames']=[names[i] for i in selected]
        mesh['weights']=[.24 if names[i].endswith('_ALL_Joy') else 0.0 for i in selected];node['weights']=list(mesh['weights'])
        values=[]
        for index,t in enumerate(times):
            blink=max(0,1-abs((t%4.7)-4.2)/.20)
            for i in selected:
                n=names[i]
                value=blink if n.endswith('_EYE_Close') else .24 if n.endswith('_ALL_Joy') else amplitudes[index]*.8 if n.endswith('_MTH_A') else 0
                values.append(value)
        channel(ni,'weights',values,'SCALAR')
    binary_name=animation_name+'.bin'
    doc['buffers'].append({'uri':binary_name,'byteLength':len(data)})
    doc['animations'].append(anim)
    doc['extras']={'tourAnimation':animation_name,'loop':loop,'gesturePlan':gestures,'lipSync':'speech-envelope'}
    return doc,bytes(data)


def expand_normalized_accessors(document, binary):
    """XR Frame needs normalized integer attributes decoded into FLOAT arrays."""
    output=bytearray(binary)
    types={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}
    dtypes={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4'}
    for item in document.get('accessors',[]):
        if not item.get('normalized'):continue
        if 'sparse' in item:raise ValueError('暂不支持稀疏归一化模型数据')
        view=document['bufferViews'][item['bufferView']]
        dtype=np.dtype(dtypes[item['componentType']]);width=types[item['type']]
        offset=view.get('byteOffset',0)+item.get('byteOffset',0)
        values=np.ndarray((item['count'],width),dtype=dtype,buffer=binary,offset=offset,
                          strides=(view.get('byteStride',width*dtype.itemsize),dtype.itemsize))
        limits=np.iinfo(dtype)
        decoded=values.astype('<f4')/float(limits.max)
        if limits.min<0:decoded=np.maximum(decoded,-1.0)
        while len(output)%4:output.append(0)
        start=len(output);raw=np.asarray(decoded,dtype='<f4').tobytes();output.extend(raw)
        item['bufferView']=len(document['bufferViews'])
        new_view={'buffer':0,'byteOffset':start,'byteLength':len(raw)}
        if 'target' in view:new_view['target']=view['target']
        document['bufferViews'].append(new_view)
        item['byteOffset']=0;item['componentType']=5126;item.pop('normalized',None)
        if 'min' in item:item['min']=decoded.min(axis=0).tolist()
        if 'max' in item:item['max']=decoded.max(axis=0).tolist()
    document['buffers'][0]['byteLength']=len(output)
    return bytes(output)


def write_glb(path, document, chunks):
    doc=copy.deepcopy(document);combined=bytearray();offsets=[]
    # These VRM/MToon vertex colors encode shader control masks (zero for
    # face/hair), not albedo. Native glTF multiplies them into base color.
    # Retain the original textures and remove only this incompatible mask.
    if 'VRM' in doc.get('extensions',{}):
        for mesh in doc.get('meshes',[]):
            for primitive in mesh['primitives']:
                primitive['attributes'].pop('COLOR_0',None)
        for material,source in zip(doc.get('materials',[]),doc['extensions']['VRM'].get('materialProperties',[])):
            properties=source.get('floatProperties',{})
            mode=properties.get('_BlendMode',0)
            material['alphaMode']='MASK' if mode==1 else 'BLEND' if mode in (2,3) else 'OPAQUE'
            if mode==1:material['alphaCutoff']=properties.get('_Cutoff',.5)
    # Kanata 3.17 encodes morph tracks as Euler TRS and then rejects them.
    # Keep real speech samples in a companion resource; XR applies them to Mesh.
    morph_tracks=[]
    arm_tracks=[]
    def samples(accessor_id):
        item=doc['accessors'][accessor_id];view=doc['bufferViews'][item['bufferView']]
        offset=view.get('byteOffset',0)+item.get('byteOffset',0)
        return np.frombuffer(chunks[view['buffer']],dtype='<f4',count=item['count'],offset=offset).tolist()
    for animation in doc.get('animations',[]):
        for channel in animation['channels']:
            if channel['target']['path']=='rotation':
                node=doc['nodes'][channel['target']['node']]
                if re.match(r'J_Bip_[LR]_(UpperArm|LowerArm|Hand|Index|Middle|Ring|Little)',node.get('name','')):
                    sampler=animation['samplers'][channel['sampler']]
                    a=doc['accessors'][sampler['output']];v=doc['bufferViews'][a['bufferView']]
                    values=np.frombuffer(chunks[v['buffer']],dtype='<f4',count=a['count']*4,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).tolist()
                    arm_tracks.append({'node':node['name'],'times':samples(sampler['input']),'values':values})
            if channel['target']['path']!='weights':continue
            node=doc['nodes'][channel['target']['node']]
            sampler=animation['samplers'][channel['sampler']]
            names=doc['meshes'][node['mesh']]['extras']['targetNames']
            morph_tracks.append({'node':node['name'],'names':names,'times':samples(sampler['input']),
                                 'values':samples(sampler['output'])})
        animation['channels']=[c for c in animation['channels'] if c['target']['path']!='weights']
    positions=[doc['accessors'][p['attributes']['POSITION']] for m in doc['meshes'] for p in m['primitives']]
    bottom=min(a['min'][1] for a in positions);top=max(a['max'][1] for a in positions)
    path.with_suffix('.morph.json').write_text(json.dumps({'tracks':morph_tracks,'armTracks':arm_tracks,'gesturePlan':gesture_plan('',74),'framing':{'height':top-bottom,'baseY':bottom}},separators=(',',':')),encoding='utf-8')
    # XR Frame rejects node-level morph defaults; mesh defaults retain the pose.
    for node in doc.get('nodes',[]):
        if 'weights' in node:
            if 'mesh' in node:doc['meshes'][node['mesh']]['weights']=node['weights']
            node.pop('weights')
    for chunk in chunks:
        while len(combined)%4:combined.append(0)
        offsets.append(len(combined));combined.extend(chunk)
    for view in doc.get('bufferViews',[]):
        view['byteOffset']=view.get('byteOffset',0)+offsets[view['buffer']];view['buffer']=0
    doc['buffers']=[{'byteLength':len(combined)}]
    encoded=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4);combined.extend(b'\x00'*((-len(combined))%4))
    length=12+8+len(encoded)+8+len(combined)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,length)+struct.pack('<II',len(encoded),0x4E4F534A)+encoded+struct.pack('<II',len(combined),0x004E4942)+combined)


def install_model(filename):
    source_root=ROOT/'frontend/public/models' if filename.endswith('.vrm') else MODEL_SOURCE
    source=(source_root/filename).resolve()
    if not source.is_relative_to(source_root.resolve()) or not source.is_file():raise ValueError('模型不存在')
    base,binary=read_glb(source)
    binary=expand_normalized_accessors(base,binary)
    if filename.endswith('.vrm'):
        base.setdefault('extras',{})['sourceRig']='vrm'
        for scene in base.get('scenes',[]):
            parent=len(base['nodes']);base['nodes'].append({'name':'VRMFront','rotation':[0,1,0,0],'children':scene['nodes']});scene['nodes']=[parent]
    # Read original VRM expression bindings, including models without targetNames.
    presets={'a':'_MTH_A','i':'_MTH_I','u':'_MTH_U','e':'_MTH_E','o':'_MTH_O','blink':'_EYE_Close','joy':'_ALL_Joy'}
    for group in base.get('extensions',{}).get('VRM',{}).get('blendShapeMaster',{}).get('blendShapeGroups',[]):
        suffix=presets.get(group.get('presetName'))
        if not suffix:continue
        for bind in group.get('binds',[]):
            mesh=base['meshes'][bind['mesh']]
            count=len(mesh['primitives'][0].get('targets',[]))
            names=mesh.setdefault('extras',{}).setdefault('targetNames',['expression_'+str(i) for i in range(count)])
            if bind['index']<len(names):names[bind['index']]='VRM'+suffix
    required={'J_Bip_C_Head','J_Bip_L_UpperArm','J_Bip_R_UpperArm'}
    if not required.issubset({n.get('name') for n in base['nodes']}):raise ValueError('模型缺少讲解骨骼')
    if not any(any(n.endswith('_MTH_A') for n in m.get('extras',{}).get('targetNames',[])) for m in base['meshes']):raise ValueError('模型缺少口型变形')
    identity=hashlib.sha256(source.read_bytes()+b'tour-rig-v6').hexdigest()[:16]
    directory=ASSETS/'models'/identity;directory.mkdir(parents=True,exist_ok=True)
    (directory/'base.bin').write_bytes(binary)
    (directory/'base.json').write_text(json.dumps(base,ensure_ascii=False),encoding='utf-8')
    times=np.linspace(0,12,121)
    doc,anim=animated_document(base,'base.bin',times,np.zeros(len(times)),[],'idle',True)
    (directory/'idle.bin').write_bytes(anim)
    write_glb(directory/'idle.glb',doc,[binary,anim])
    (directory/'idle.gltf').write_text(json.dumps(doc,ensure_ascii=False),encoding='utf-8')
    framing=json.loads((directory/'idle.morph.json').read_text(encoding='utf-8'))['framing']
    (directory/'info.json').write_text(json.dumps({'name':source.stem,'hash':identity,'height':framing['height']}),encoding='utf-8')
    return 'digital_guide/3d/models/'+identity+'/idle.gltf'


def model_info(guide):
    path=local_asset(guide.model3d_path)
    if not path or path.name!='idle.gltf':return {'ready':False,'message':'待配置：3D模型未安装'}
    info_path=path.parent/'info.json'
    if not info_path.is_file():return {'ready':False,'message':'3D模型校验信息缺失'}
    info=json.loads(info_path.read_text(encoding='utf-8'))
    return {'ready':True,'message':'3D骨骼讲解，真实语音音量驱动开合口','modelUrl':'/api/v1/files/'+guide.model3d_path.replace('idle.gltf','idle.glb'),'name':info['name']}


def create_performance(guide, message_id, audio_url, text):
    source=local_asset(guide.model3d_path);audio=local_asset(audio_url)
    if not source or not audio:raise ValueError('3D模型或本轮语音缺失')
    ffmpeg = ROOT / 'weights/digital_human_weights/drivers/ffmpeg.exe'
    if not ffmpeg.is_file():raise ValueError('真实语音解码器未安装')
    result=subprocess.run([str(ffmpeg),'-v','error','-i',str(audio),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True,timeout=30)
    pcm=np.frombuffer(result.stdout,dtype='<f4')
    if not len(pcm):raise ValueError('语音无法解码')
    duration=len(pcm)/16000
    times=np.arange(0,duration,.05);times=np.append(times,duration)
    rms=np.asarray([math.sqrt(float(np.mean(pcm[int(t*16000):min(len(pcm),int(t*16000)+800)]**2))) if t<duration else 0 for t in times])
    peak=max(.03,float(np.percentile(rms,90)));amps=np.clip(rms/peak,0,1);amps[rms<.008]=0
    gestures=gesture_plan(text,duration)
    base=json.loads((source.parent/'base.json').read_text(encoding='utf-8'))
    identity=uuid.uuid4().hex;directory=ASSETS/'performances';directory.mkdir(parents=True,exist_ok=True)
    doc,anim=animated_document(base,'../models/'+source.parent.name+'/base.bin',times,amps,gestures,identity)
    (directory/(identity+'.bin')).write_bytes(anim)
    scene=directory/(identity+'.gltf');scene.write_text(json.dumps(doc,ensure_ascii=False),encoding='utf-8')
    write_glb(directory/(identity+'.glb'),doc,[(source.parent/'base.bin').read_bytes(),anim])
    scene_path=scene.relative_to(ROOT/'static').as_posix()
    with Session(DB_ENGINE) as db:
        db.add(AvatarPerformance(performance_id=identity,message_id=message_id,guide_id=guide.guide_id,audio_path=audio_url,
                               scene_path=scene_path,duration=duration,timeline_json=json.dumps(gestures,ensure_ascii=False)))
        db.commit()
    return {'performance_id':identity,'mode':'3d','scene_url':'/api/v1/files/'+scene_path,'audio_url':audio_url,
            'duration':round(duration,2),'gestures':gestures,'animation':identity,'loop':False}
