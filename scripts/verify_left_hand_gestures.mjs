import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import * as THREE from '../frontend/node_modules/three/build/three.module.js';import {GLTFLoader} from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class{};const results=[];
for(const test of JSON.parse(fs.readFileSync('work_dirs/all-guide-motion/cases.json'))){
 const d=JSON.parse(fs.readFileSync(test.path));for(const b of d.buffers)b.uri='data:application/octet-stream;base64,'+fs.readFileSync(path.resolve(path.dirname(test.path),b.uri)).toString('base64');d.materials=[{}];d.images=[];d.textures=[];for(const mesh of d.meshes)for(const p of mesh.primitives)p.material=0;
 const g=await new GLTFLoader().parseAsync(JSON.stringify(d),'');const mx=new THREE.AnimationMixer(g.scene);mx.clipAction(g.animations[0]).play();const bone=n=>g.scene.getObjectByName('J_Bip_L_'+n),hand=bone('Hand'),palm=new THREE.Vector3().crossVectors(bone('Index1').position,bone('Little1').position).negate().normalize(),right=g.scene.getObjectByName('J_Bip_R_Hand');
 const set=t=>{mx.setTime(t);g.scene.updateMatrixWorld(true)};set(0);const rest=hand.getWorldPosition(new THREE.Vector3()),rq=right.quaternion.clone();const height=new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3()).y;
 set(1.7);const raised=hand.getWorldPosition(new THREE.Vector3());set(3);const extended=hand.getWorldPosition(new THREE.Vector3()),up=palm.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).y;
 assert.ok(raised.y-rest.y>height*.08,'left hand must rise '+test.guideId);assert.ok(extended.z-raised.z>height*.04,'left hand must reach forward '+test.guideId);assert.ok(up>.95,'palm upward '+test.guideId);
 for(let t=0;t<46;t+=.25){set(t);assert.ok(right.quaternion.angleTo(rq)<1e-5,'right hand stays down '+test.guideId)}
 results.push({guideId:test.guideId,leftRise:+(raised.y-rest.y).toFixed(3),forward:+(extended.z-raised.z).toFixed(3),palmUp:+up.toFixed(3)});
}
fs.writeFileSync('work_dirs/all-guide-motion/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({result:'PASS',guides:results}));
