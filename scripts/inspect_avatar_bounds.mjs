import fs from 'node:fs'
import * as THREE from '../frontend/node_modules/three/build/three.module.js'
import {GLTFLoader} from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
globalThis.ProgressEvent ??= class {constructor(type,options){Object.assign(this,options);this.type=type}}
const file='static/digital_guide/3d/models/ee971f65c0915c67/idle.glb'
const raw=fs.readFileSync(file),length=raw.readUInt32LE(12)
const doc=JSON.parse(raw.subarray(20,20+length).toString())
const binary=raw.subarray(28+length)
doc.buffers=[{byteLength:binary.length,uri:'data:application/octet-stream;base64,'+binary.toString('base64')}]
doc.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];doc.images=[];doc.textures=[]
for(const mesh of doc.meshes)for(const p of mesh.primitives)p.material=0
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'')
const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations[0]).play();mixer.setTime(0);gltf.scene.updateMatrixWorld(true)
const box=new THREE.Box3().setFromObject(gltf.scene)
console.log('BOUNDS',box.min.toArray(),box.max.toArray())
for(const name of ['J_Bip_C_Head','J_Bip_C_Hips','J_Bip_L_Hand','J_Bip_R_Hand'])console.log(name,gltf.scene.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()).toArray())
