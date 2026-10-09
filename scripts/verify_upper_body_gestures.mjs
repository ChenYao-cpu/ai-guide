import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import * as T from '../frontend/node_modules/three/build/three.module.js';import {GLTFLoader} from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class{};const results=[];
for(const test of JSON.parse(fs.readFileSync('work_dirs/all-guide-motion/cases.json'))){
 const d=JSON.parse(fs.readFileSync(test.path));for(const b of d.buffers)b.uri='data:application/octet-stream;base64,'+fs.readFileSync(path.resolve(path.dirname(test.path),b.uri)).toString('base64');d.materials=[{}];d.images=[];d.textures=[];for(const mesh of d.meshes)for(const p of mesh.primitives)p.material=0;
 const g=await new GLTFLoader().parseAsync(JSON.stringify(d),'');const mx=new T.AnimationMixer(g.scene);mx.clipAction(g.animations[0]).play();const bone=(s,n)=>g.scene.getObjectByName('J_Bip_'+s+'_'+n),right=bone('R','Hand'),left=bone('L','Hand'),palm=new T.Vector3().crossVectors(bone('R','Index1').position,bone('R','Little1').position).negate().normalize();
 const set=t=>{mx.setTime(t);g.scene.updateMatrixWorld(true)};set(0);const rest=right.getWorldPosition(new T.Vector3()),leftRest=left.getWorldPosition(new T.Vector3()),height=new T.Box3().setFromObject(g.scene).getSize(new T.Vector3()).y;
 const legs=['L','R'].flatMap(s=>['UpperLeg','LowerLeg','Foot'].map(n=>bone(s,n))).filter(Boolean).map(b=>({b,q:b.quaternion.clone(),p:b.position.clone()}));
 let rise=0,forward=0,up=0;
 for(let t=0;t<46;t+=.1){set(t);const p=right.getWorldPosition(new T.Vector3());rise=Math.max(rise,p.y-rest.y);forward=Math.max(forward,p.z-rest.z);up=Math.max(up,palm.clone().applyQuaternion(right.getWorldQuaternion(new T.Quaternion())).y);
  assert(left.getWorldPosition(new T.Vector3()).distanceTo(leftRest)<.001,'left hand stays at abdomen '+test.guideId);
  for(const l of legs){assert(l.b.quaternion.toArray().every((q,i)=>Math.abs(q-l.q.toArray()[i])<1e-7));assert(l.b.position.distanceTo(l.p)<1e-6)}
  assert(bone('C','Spine').quaternion.angleTo(new T.Quaternion(...d.nodes.find(n=>n.name==='J_Bip_C_Spine').rotation))<1e-5,'torso remains frontal');
 }
 assert(rise>height*.05,'right hand rises '+test.guideId);assert(up>.8,'right palm faces gently up '+test.guideId);assert(Math.abs(rest.y-leftRest.y)<height*.04,'hands overlap at abdomen');
 results.push({guideId:test.guideId,rightRise:+rise.toFixed(3),forward:+forward.toFixed(3),palmUp:+up.toFixed(3)});
}
fs.writeFileSync('work_dirs/all-guide-motion/right-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({result:'PASS',guides:results}));
