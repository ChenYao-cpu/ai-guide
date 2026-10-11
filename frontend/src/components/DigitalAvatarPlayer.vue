<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { request_handler } from '@/api/base'
import TourAvatar3D from './TourAvatar3D.vue'
import XingyunGuide from './XingyunGuide.vue'
const xingyunRef = ref<InstanceType<typeof XingyunGuide> | null>(null)
const xingyunConnected = ref(false)
const props = defineProps<{ guideId?: number; tourId?: number; framing?: 'full' | 'half'; posterImage?: string; sourceVideo?: string; width?: number; height?: number; audioElement?: HTMLAudioElement | null; speaking?: boolean; busy?: boolean }>()
const emit = defineEmits<{ playing: [value: boolean]; connected: [value: boolean] }>()
const posterUrl = computed(() => (props.posterImage || '').replace(/\\/g, '/').replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?=\/api\/v1\/files)/, ''))
type AvatarJob = { job_id?: string; access_token?: string; status?: string; message?: string }
type Capability = { preferredMode?: string; threeD?:{ready:boolean;message:string;modelUrl?:string;name?:string}; realistic: { ready: boolean; message: string }; cartoon: { ready: boolean; message: string; previewUrl?: string } }
type Performance={scene_url?:string;message?:string;mode?:string}
const sceneUrl=ref('')
let readyResolve:((ready:boolean)=>void)|undefined
function sceneReady(){readyResolve?.(true);readyResolve=undefined;message.value='3D讲解就绪'}
function sceneError(value:string){message.value=value;readyResolve?.(false);readyResolve=undefined}
async function acceptPerformance(data?:Performance|null){
 if(!data?.scene_url){if(data?.message)message.value=data.message;return false}
 message.value='正在准备3D讲解动作'
 const current=version
 const ready=new Promise<boolean>(resolve=>{readyResolve=resolve})
 sceneUrl.value=data.scene_url
 const timeout=setTimeout(()=>{readyResolve?.(false);readyResolve=undefined;message.value='3D加载超时，本轮先播放语音'},30000)
 await ready;clearTimeout(timeout)
 return current===version
}
const mode = ref('audio')
const state = ref<Capability | null>(null)
const message = ref('语音导览 · 提问后播放本轮讲解')
const videoUrl = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let version = 0
let capabilityReady: Promise<void> = Promise.resolve()
function stop() { xingyunRef.value?.stop(); version++; if(timer)clearTimeout(timer);timer=undefined;videoUrl.value='';readyResolve?.(false);readyResolve=undefined;sceneUrl.value=''; props.audioElement?.pause();emit('playing',false) }
function updateMessage() { message.value = mode.value==='3d' ? state.value?.threeD?.message||'正在准备3D模型' : mode.value === 'audio' ? '语音导览 · 提问后播放本轮讲解' : state.value?.[mode.value as 'realistic'|'cartoon']?.message || '正在查询数字人状态' }
function choose(value: string) { stop();mode.value=value;updateMessage() }
async function poll(job: AvatarJob, current: number) {
  if(current!==version)return
  try {
    const response=await request_handler.get('/avatar/jobs/'+job.job_id,{params:{token:job.access_token}})
    if(current!==version)return
    const data=response.data.data
    if(data.status==='completed'){videoUrl.value=data.video_url;message.value='视频已生成';return}
    if(data.status==='failed'){message.value=data.message||'视频生成失败';return}
    message.value=data.status==='processing'?'正在生成口型视频…':'视频生成排队中'
    timer=setTimeout(()=>poll(job,current),1500)
  }catch{if(current===version)message.value='获取视频状态失败，请重新提问'}
}
function acceptJob(job?: AvatarJob | null) { if(job?.job_id){poll(job,version);return true} if(job?.message)message.value=job.message;return false }
watch(()=>props.guideId,(id)=>{
  stop();state.value=null
  capabilityReady=(async()=>{if(!id)return;try{const response=await request_handler.get('/avatar/capabilities/'+id);if(props.guideId===id){state.value=response.data.data;mode.value=state.value?.preferredMode==='xingyun'?'audio':state.value?.preferredMode==='3d'&&state.value.threeD?.ready?'3d':state.value?.realistic.ready?'realistic':'audio';updateMessage()}}catch{message.value='数字人状态查询失败'}})()
},{immediate:true})
onBeforeUnmount(stop)
watch(()=>props.speaking,value=>{if(!value&&props.audioElement?.ended&&mode.value==='3d'){sceneUrl.value='';updateMessage()}})
defineExpose({getMode:async()=>{await capabilityReady;return xingyunRef.value?.isReady() ? 'xingyun' : mode.value},speak:(text?:string)=>xingyunRef.value?.speak(text)||false,acceptJob,acceptPerformance,stop})
</script>
<template>
  <div class="digital-avatar" :style="{maxWidth:(width||360)+'px'}">
    <div class="viewport" :style="{minHeight:0+'px'}">
      <XingyunGuide ref="xingyunRef" :guide-id="guideId" :tour-id="tourId" :poster-image="posterUrl" :framing="framing || 'full'" @playing="emit('playing', $event)" @connected="xingyunConnected=$event; emit('connected', $event)" />
      <TourAvatar3D v-show="!xingyunConnected" :natural-standing="true" v-if="mode==='3d'&&state?.threeD?.modelUrl" :model-url="sceneUrl||state.threeD.modelUrl" :audio-element="audioElement" :width="Math.max(200,(width||360)-30)" :height="height||440" @ready="sceneReady" @error="sceneError" />
      <video v-show="!xingyunConnected" v-else-if="videoUrl" :key="'speech-'+videoUrl" :muted="false" :loop="false" playsinline :src="videoUrl" controls autoplay @play="emit('playing',true)" @pause="emit('playing',false)" @ended="emit('playing',false)" @error="message='视频播放失败，请检查网络';emit('playing',false)" />
      <img v-show="!xingyunConnected" v-else-if="posterUrl && state?.preferredMode !== 'xingyun'" :src="posterUrl" alt="所选数字人全身形象" style="width:100%;height:100%;min-height:0;object-fit:contain" />
      <div v-show="!xingyunConnected" v-else-if="state?.preferredMode !== 'xingyun'" class="placeholder"><strong>待开发：请上传数字人形象素材</strong></div>
    </div>
    <p v-if="!xingyunConnected && state?.preferredMode !== 'xingyun'" class="playback-message" role="status">{{ message }}</p>
  </div>
</template>
<style scoped>
.digital-avatar{height:100%;max-height:100%;display:flex;flex-direction:column;width:100%;margin:auto;padding:14px;box-sizing:border-box}.modes{display:flex;gap:8px;justify-content:center;margin-bottom:16px}.modes button{border: 1px solid var(--glass-line);border-radius:9px;padding:8px 20px;color: var(--text-secondary);background: var(--glass);cursor:pointer}.modes button.selected{color: var(--champagne-text);border-color: var(--glass-line);background: var(--glass)}.viewport{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;border: 1px solid var(--glass-line);background: var(--glass);border-radius:16px;overflow:hidden}.viewport video{width:100%;max-height:440px;object-fit:contain}.playback-message{font-size:12px;color: var(--text-secondary);line-height:1.6}.placeholder{padding:28px;text-align:center;display:flex;flex-direction:column;gap:18px;align-items:center}.placeholder span{width:74px;height:74px;border-radius:22px;line-height:74px;background: var(--glass);color: var(--champagne-text);font-size:30px}.placeholder strong{font-size:14px;line-height:1.8;color: var(--text-secondary)}.placeholder small{font-size:12px;line-height:1.7;color: var(--text-muted)}
</style>
