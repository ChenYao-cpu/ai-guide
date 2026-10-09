import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import * as THREE from '../frontend/node_modules/three/build/three.module.js'
import {GLTFLoader} from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
globalThis.ProgressEvent ??= class {constructor(type,options){Object.assign(this,options);this.type=type}}
const info=JSON.parse(fs.readFileSync(process.argv[2] || 'work_dirs/3d-performance-preview.json','utf8'))
const source=path.resolve('static',info.scene_url.split('/files/')[1])
const document=JSON.parse(fs.readFileSync(source,'utf8'))
for(const buffer of document.buffers){buffer.uri='data:application/octet-stream;base64,'+fs.readFileSync(path.resolve(path.dirname(source),buffer.uri)).toString('base64')}
assert.ok(document.materials.every(m=>m.pbrMetallicRoughness?.metallicFactor===0),'cloth and skin must not use default metallic material')
// Validate bones and morph tracks without a browser/texture decoder.
document.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];document.images=[];document.textures=[]
for(const mesh of document.meshes)for(const primitive of mesh.primitives)primitive.material=0
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(document),'')
const mixer=new THREE.AnimationMixer(gltf.scene)
assert.equal(gltf.animations.length,1)
const action=mixer.clipAction(gltf.animations[0]);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play()
mixer.setTime(0);gltf.scene.updateMatrixWorld(true)
const hand=gltf.scene.getObjectByName('J_Bip_L_Hand'),arm=gltf.scene.getObjectByName('J_Bip_L_UpperArm')
assert.ok(hand&&arm,'actual guide arm bones must be present')
const handHeight=hand.getWorldPosition(new THREE.Vector3()).y
assert.ok(handHeight<1.05,'arms must be lowered from the source T-pose')
const before=gltf.scene.getObjectByName('J_Bip_L_LowerArm').quaternion.clone()
const right=gltf.scene.getObjectByName('J_Bip_R_Hand'),rightRest=right.quaternion.clone()
mixer.setTime(2.5);gltf.scene.updateMatrixWorld(true)
const after=gltf.scene.getObjectByName('J_Bip_L_LowerArm').quaternion
const raisedHandHeight=hand.getWorldPosition(new THREE.Vector3()).y
assert.ok(raisedHandHeight>handHeight+.15,'left hand must rise for the explanation')
assert.ok(before.angleTo(after)>1.0,'the guide elbow must visibly bend during explanation')
assert.ok(rightRest.angleTo(right.quaternion)<1e-5,'right hand must remain at rest')
const index=gltf.scene.getObjectByName('J_Bip_L_Index1').position
const little=gltf.scene.getObjectByName('J_Bip_L_Little1').position
const palm=new THREE.Vector3().crossVectors(index,little).negate().normalize()
const palmUp=palm.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).y
assert.ok(palmUp>.95,'left palm must face upward')
mixer.setTime(1.7);gltf.scene.updateMatrixWorld(true)
const lifted=hand.getWorldPosition(new THREE.Vector3())
mixer.setTime(3);gltf.scene.updateMatrixWorld(true)
assert.ok(hand.getWorldPosition(new THREE.Vector3()).z>lifted.z+.08,'left hand must move forward after lifting')
const face=[];gltf.scene.traverse(node=>{if(node.morphTargetDictionary&&Object.keys(node.morphTargetDictionary).some(n=>n.endsWith('_MTH_A')))face.push(node)})
assert.ok(document.meshes.some(m=>m.weights?.some(v=>v===.24)),'guide must have a slight smile')
assert.ok(face.length,'actual mouth morph targets must be loaded')
let min=1,max=0
for(let time=0;time<Math.min(6,info.duration);time+=.05){mixer.setTime(time);for(const mesh of face){const name=Object.keys(mesh.morphTargetDictionary).find(n=>n.endsWith('_MTH_A'));const value=mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]];min=Math.min(min,value);max=Math.max(max,value)}}
assert.ok(max-min>.2,'mouth movement must reflect real audio, including silence')
assert.equal(info.loop,false)
assert.ok(info.gestures.every(g=>g.side==='left'&&g.gesture==='palm_up_forward'))
console.log(JSON.stringify({result:'PASS',handHeight,palmUp,lipRange:[min,max],gestureCount:info.gestures.length,duration:info.duration}))
