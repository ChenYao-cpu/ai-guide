<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
const props=defineProps<{modelUrl:string;audioElement?:HTMLAudioElement|null; width?:number;height?:number;naturalStanding?:boolean}>()
const emit=defineEmits<{ready:[];error:[message:string]}>()
const host=ref<HTMLDivElement|null>(null)
let renderer:THREE.WebGLRenderer|undefined,scene:THREE.Scene,camera:THREE.PerspectiveCamera
let model:THREE.Group|undefined,mixer:THREE.AnimationMixer|undefined,action:THREE.AnimationAction|undefined
let request=0,version=0,last=0,idleTime=0,isIdle=true
let standingArms:{bone:THREE.Object3D;rotation:THREE.Quaternion}[]=[]
function prepareStanding(){
 standingArms=[]
 if(!model||!props.naturalStanding)return
 model.updateMatrixWorld(true)
 const head=model.getObjectByName('J_Bip_C_Head')
 const leftEye=model.getObjectByName('J_Adj_L_FaceEye'),rightEye=model.getObjectByName('J_Adj_R_FaceEye')
 if(head&&leftEye&&rightEye){
  const front=leftEye.getWorldPosition(new THREE.Vector3()).add(rightEye.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5).sub(head.getWorldPosition(new THREE.Vector3()))
  front.y=0
  if(front.lengthSq()>1e-8){model.rotateY(-Math.atan2(front.x,front.z));model.updateMatrixWorld(true)}
 }
 const down=new THREE.Vector3(0,-1,0)
 for(const side of ['L','R']){
  for(const [part,childPart] of [['UpperArm','LowerArm'],['LowerArm','Hand'],['Hand','Middle1']]){
   const bone=model.getObjectByName(`J_Bip_${side}_${part}`),child=model.getObjectByName(`J_Bip_${side}_${childPart}`)
   if(!bone||!child||!bone.parent)continue
   model.updateMatrixWorld(true)
   const current=bone.getWorldQuaternion(new THREE.Quaternion())
   const direction=child.position.clone().normalize().applyQuaternion(current)
   const desired=new THREE.Quaternion().setFromUnitVectors(direction,down).multiply(current)
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired))
   standingArms.push({bone,rotation:bone.quaternion.clone()})
  }
 }
 model.updateMatrixWorld(true)
}
function applyStanding(){for(const {bone,rotation} of standingArms)bone.quaternion.copy(rotation)}
let observer:ResizeObserver|undefined
function fit(){if(!renderer||!host.value)return;const w=host.value.clientWidth||props.width||360,h=host.value.clientHeight||props.height||440;renderer.setSize(w,h);camera.aspect=w/h;if(model){model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const distance=Math.max(size.y,size.x/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))*1.10;center.y+=size.y*.03;camera.position.set(center.x,center.y,box.max.z+distance);camera.lookAt(center)}camera.updateProjectionMatrix()}
function disposeModel(){standingArms=[];if(!model)return;scene.remove(model);model.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){for(const v of Object.values(m)){if(v instanceof THREE.Texture)v.dispose()}m.dispose()}}});model=undefined;mixer=undefined;action=undefined}
async function load(){
 if(!renderer||!props.modelUrl)return
 const v=++version
 try{
  const gltf=await new GLTFLoader().loadAsync(props.modelUrl)
  if(v!==version)return
  disposeModel();model=gltf.scene;scene.add(model);model.traverse(o=>{o.frustumCulled=false})
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3())
  camera.aspect=(props.width||360)/(props.height||440)
  const distance=Math.max(size.y,size.x/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))*1.10
  center.y+=size.y*.03;camera.position.set(center.x,center.y,box.max.z+distance);camera.lookAt(center);camera.updateProjectionMatrix()
  mixer=new THREE.AnimationMixer(model);isIdle=gltf.animations[0]?.name==='idle';idleTime=0
  if(gltf.animations[0]){action=mixer.clipAction(gltf.animations[0]);action.setLoop(isIdle?THREE.LoopRepeat:THREE.LoopOnce,isIdle?Infinity:1);action.clampWhenFinished=true;action.play();mixer.setTime(0)}
  prepareStanding();fit();renderer.render(scene,camera);emit('ready')
 }catch{emit('error','3D模型加载失败，请检查网络与模型资源')}
}
function loop(time:number){request=window.requestAnimationFrame(loop);const dt=Math.min(.1,(time-last)/1000||0);last=time
 if(mixer){if(isIdle){idleTime+=dt;mixer.setTime(idleTime)}else mixer.setTime(props.audioElement?.currentTime||0)}
 applyStanding()
 if(renderer)renderer.render(scene,camera)
}
onMounted(()=>{try{scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0xadb5c5,1.2));const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(1,3,4);scene.add(light);const fill=new THREE.DirectionalLight(0xffffff,.8);fill.position.set(-2,1.5,3);scene.add(fill)
 camera=new THREE.PerspectiveCamera(30,(props.width||360)/(props.height||440),.01,100)
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.setSize(props.width||360,props.height||440);renderer.outputColorSpace=THREE.SRGBColorSpace;host.value?.appendChild(renderer.domElement);observer=new ResizeObserver(fit);if(host.value)observer.observe(host.value);load();request=window.requestAnimationFrame(loop)
 }catch{emit('error','设备无法启动3D渲染')}})
watch(()=>props.modelUrl,load)
onBeforeUnmount(()=>{version++;observer?.disconnect();window.cancelAnimationFrame(request);disposeModel();renderer?.dispose()})
</script>
<template><div ref="host" class="tour-avatar-3d"  /></template>
<style scoped>.tour-avatar-3d{width:100%;height:100%;max-width:100%;min-height:120px;overflow:hidden}.tour-avatar-3d :deep(canvas){display:block;max-width:100%;height:auto!important}</style>
