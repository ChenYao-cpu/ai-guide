<template>
  <main class="mt-root">
    <header class="mt-top">
      <div class="mt-title"><BrandLogo compact /></div>
      <button class="mt-btn-gps" :class="{ on: gpsTracking }" @click="toggleGps" :aria-pressed="gpsTracking"><el-icon><Location /></el-icon>{{ gpsTracking ? '定位已开' : '定位' }}</button>
      <button class="mt-btn-end" @click="confirmEnd">结束</button>
    </header>

    <section class="mt-hero" aria-label="数字人导游">
      <div class="mt-guide-heading">
        <h1>{{ guideInfo?.name || '数字导游' }}</h1>
        <span v-if="isSpeaking || loading" class="mt-status" role="status"><i></i>{{ isSpeaking ? '正在讲解' : '正在准备讲解' }}</span>
      </div>
      <div v-if="guideInfo?.guide_id" class="mt-3d-wrap">
        <DigitalAvatarPlayer ref="live2dRef" :audioElement="ttsAudio" :width="gw" :height="gh"
          :tour-id="sid" framing="full"
          :poster-image="guideInfo.poster_image" :source-video="guideInfo.base_mp4_path"
          :guide-id="guideInfo.guide_id" :speaking="isSpeaking" :busy="loading" @playing="isSpeaking = $event" />
      </div>
      <p v-else class="mt-avatar-loading" role="status">正在加载数字人…</p>
    </section>

    <section class="mt-chat-panel" aria-label="景区问答">
      <header class="mt-chat-heading"><h2>景区问答</h2><span>{{ spotCards[spotIdx]?.spot_name || currentSpot?.spot_name }}</span></header>
      <div class="mt-chat" ref="chatEl" role="log" aria-label="导览对话" aria-live="polite">
        <p v-if="!conversations.length" class="mt-chat-empty">想了解什么？直接向导游提问。</p>
        <div v-for="(m, i) in conversations" :key="i" class="mc-row" :class="m.role">
          <div class="mc-bubble">
            <div class="mc-text" v-html="fmt(m.message, m.role)"></div>
            <details v-if="m.role === 'guide' && m.message?.includes('以上内容来自景区知识档案')" class="mc-source"><summary>参考资料</summary><p>景区知识档案</p></details>
          </div>
        </div>
        <p v-if="loading" class="mc-loading" role="status">正在准备讲解…</p>
      </div>
    </section>

    <footer class="mt-bar">
      <div class="mt-quick-row" aria-label="快捷提问">
        <button v-for="q in quickQuestions" :key="q.message" class="mt-quick-btn" :disabled="loading || recognizing || recording" @click="send(q.message)">{{ q.label }}</button>
      </div>
      <div class="mt-input-row">
        <button :aria-label="recording ? '结束录音' : '开始录音'" :title="recording ? '点击结束录音' : '点击开始录音'" class="mt-voice-btn" :class="{ rec: recording }"
          @click="recording ? stopVoice() : startVoice()" :disabled="recognizing || loading"><el-icon><Microphone /></el-icon></button>
        <input v-model="inputText" class="mt-input" aria-label="导览问题" :disabled="loading || recognizing || recording"
          :placeholder="recording ? '录音中，点击麦克风结束' : recognizing ? '正在识别录音…' : '有什么想问的？'" enterkeyhint="send" @keydown.enter="send(inputText)" />
        <button class="mt-send-btn" @click="send(inputText)" :disabled="!inputText.trim() || loading || recording || recognizing">发送</button>
      </div>
    </footer>

    <section class="mt-spot" v-if="spotCards.length" aria-label="当前景点">
      <div class="mts-row">
        <button class="mts-nav" aria-label="浏览上一个景点" @click="prevSpot" :disabled="spotCards.length < 2"><el-icon><ArrowLeft /></el-icon></button>
        <button class="mts-summary" @click="spotExpanded = !spotExpanded" :aria-expanded="spotExpanded" aria-controls="mobile-spot-description">
          <strong>{{ spotCards[spotIdx]?.spot_name }}</strong>
          <span>{{ spotIdx + 1 }} / {{ spotCards.length }}</span>
          <el-icon :class="{ expanded: spotExpanded }"><ArrowDown /></el-icon>
        </button>
        <button class="mts-nav" aria-label="浏览下一个景点" @click="nextSpot" :disabled="spotCards.length < 2"><el-icon><ArrowRight /></el-icon></button>
      </div>
      <p v-if="spotExpanded" id="mobile-spot-description" class="mts-description">{{ spotCards[spotIdx]?.description }}</p>
      <button v-if="!finalSpot" class="mts-advance" @click="advanceSpot" :disabled="advancingSpot || loading || recording || recognizing">{{ advancingSpot ? '正在切换…' : '前往下一景点' }}</button>
      <span v-else class="mts-finished">已到达路线最后一站</span>
    </section>
    <audio ref="ttsAudio" @play="onPlay" @ended="onEnd" @pause="onEnd" />
  </main>
</template>

<script setup lang="ts">
import BrandLogo from '@/components/BrandLogo.vue'
import { computed,ref,onMounted,onUnmounted,nextTick,watch } from 'vue'
import { useRouter,useRoute } from 'vue-router'
import { ElMessage,ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, ArrowDown, Location, Microphone } from '@element-plus/icons-vue'
import { formatTourMessage } from '@/utils/tourPresentation'
import DigitalAvatarPlayer from '@/components/DigitalAvatarPlayer.vue'
import { receiveAvatarToken } from '@/api/xingyunTour'
import { getTourLiveInfo,sendTourChatMessage,endTourSession,getVisitorSpotList,nextSpot as advanceTourSpot } from '@/api/visitor'
import { useRecordedSpeech } from '@/composables/useRecordedSpeech'
import { useGeolocation } from '@/composables/useGeolocation'

const router=useRouter()
const route=useRoute()
const sid=Number(route.params.sessionId)
receiveAvatarToken(sid)

const conversations=ref<any[]>([])
const currentSpot=ref<any>(null)
const guideInfo=ref<any>(null)
const spotCards=ref<any[]>([])
const spotIdx=ref(0)
const isSpeaking=ref(false)
const loading=ref(false)
const inputText=ref('')
const { recording, recognizing, start: startVoice, stop: stopVoice } = useRecordedSpeech(text => { inputText.value=text; send(text) }, message => ElMessage.error(message))
const spotExpanded = ref(false)
const finalSpot = ref(false)
const advancingSpot = ref(false)
const viewportWidth = ref(window.innerWidth)
const viewportHeight = ref(window.innerHeight)
function syncViewport() { viewportWidth.value = window.innerWidth; viewportHeight.value = window.innerHeight }
const chatEl=ref<HTMLElement|null>(null)
const ttsAudio=ref<HTMLAudioElement|null>(null)
const live2dRef=ref<InstanceType<typeof DigitalAvatarPlayer>|null>(null)

const gw = computed(() => viewportWidth.value >= 900 ? Math.min(viewportWidth.value * .52, 1000) : viewportWidth.value - 24)
const gh = computed(() => viewportWidth.value >= 900 ? viewportHeight.value - 100 : Math.max(240, Math.min(viewportHeight.value * .43, 440)))

const gps=useGeolocation(); const gpsTracking=ref(false)

const quickQuestions = [
  { label: '历史故事', message: '这里有什么历史故事？' },
  { label: '拍照位置', message: '最佳拍照点在哪？' },
  { label: '景点特色', message: '请介绍景点特色' },
  { label: '附近设施', message: '附近有什么设施？' },
]

function fmt(message: string, role: string) { return formatTourMessage(message, role === 'guide', [guideInfo.value?.name || '']) }
function sc(){ nextTick(()=>{ if(chatEl.value) chatEl.value.scrollTop=chatEl.value.scrollHeight }) }

function prevSpot(){ if(spotCards.value.length>1) spotIdx.value=(spotIdx.value-1+spotCards.value.length)%spotCards.value.length }
function nextSpot(){ if(spotCards.value.length>1) spotIdx.value=(spotIdx.value+1)%spotCards.value.length }

async function advanceSpot() {
  if (advancingSpot.value || finalSpot.value || loading.value) return
  advancingSpot.value = true
  try {
    const res = await advanceTourSpot(sid)
    if (res.data?.success) {
      await refresh()
      spotExpanded.value = false
      ElMessage.success('已切换景点')
    } else {
      ElMessage.error(res.data?.message || '切换失败')
    }
  } catch {
    ElMessage.error('切换失败，请重试')
  } finally {
    advancingSpot.value = false
  }
}

function onPlay(){ isSpeaking.value=true }
function onEnd(){ isSpeaking.value=false }

function toggleGps(){ if(gpsTracking.value){ gps.stopTracking();gpsTracking.value=false }else{ gps.startTracking(sid,8000);gpsTracking.value=true } }
watch(()=>gps.closestSpot.value,s=>{ if(s?.within_range) refresh() })

async function send(text:string){
  const msg=text.trim(); if(!msg||loading.value) return
  inputText.value=''
  conversations.value.push({role:'user',message:msg,send_time:new Date().toISOString()}); sc()
  loading.value=true
  try{
    const viewingSpot=spotCards.value[spotIdx.value]
    const nextViewingSpot=spotCards.value[spotIdx.value+1]
    live2dRef.value?.stop()
    const res=await sendTourChatMessage(sid,msg,viewingSpot?.spot_id||currentSpot.value?.spot_id,nextViewingSpot?.spot_id||0,(await live2dRef.value?.getMode())||'audio')
    const b=res.data
    if(b?.success){
      await live2dRef.value?.acceptPerformance(b.data?.avatarPerformance)
      const videoPending=live2dRef.value?.speak(b.data?.message)||live2dRef.value?.acceptJob(b.data?.avatarJob)
      if(!videoPending&&b.data?.ttsAudioUrl&&ttsAudio.value){
        ttsAudio.value.pause();ttsAudio.value.currentTime=0
        ttsAudio.value.src=b.data.ttsAudioUrl.replace(/^https?:\/\/[^/]+/,'')
        try{ttsAudio.value.play()}catch{}
      }
      await refresh()
    }else{ ElMessage.error(b?.message||'回复失败') }
  }catch(e:any){ ElMessage.error('发送失败') }
  finally{ loading.value=false; sc() }
}

async function refresh(){
  try{
    const res=await getTourLiveInfo(sid)
    if(res?.data?.success){
      const d=res.data.data
      conversations.value=d.conversation||[]
      finalSpot.value=Boolean(d.final_spot)
      currentSpot.value=d.current_spot_info; guideInfo.value=d.guide_info
      try{
        const prefs=JSON.parse(d.visitor_preferences||'{}')
        if(prefs.spot_ids?.length){
          const sr=await getVisitorSpotList().catch(()=>null)
          const all:any[]=(sr as any)?.data?.data?.spot_list||(sr as any)?.data?.spot_list||[]
          spotCards.value=prefs.spot_ids.map((id:number)=>all.find((s:any)=>s.spot_id===id)).filter(Boolean)
          if(d.current_spot_info){ const idx=spotCards.value.findIndex((s:any)=>s.spot_id===d.current_spot_info.spot_id); if(idx>=0) spotIdx.value=idx }
        }
      }catch{}
    }
  }catch(e){ console.error(e) }
}

async function confirmEnd(){
  try{ await ElMessageBox.confirm('结束本次导览？','退出',{confirmButtonText:'结束',cancelButtonText:'继续'}); await endTourSession(sid); router.push('/m/home') }catch{}
}

onMounted(() => { refresh(); window.addEventListener('resize', syncViewport) })
onUnmounted(() => { window.removeEventListener('resize', syncViewport); if (gpsTracking.value) gps.stopTracking() })
</script>

<style lang="scss" scoped>
.mt-root {
  position: fixed; inset: 0; display: grid; min-width: 0; min-height: 0;
  grid-template-areas: "top" "hero" "chat" "bar" "spot";
  grid-template-rows: auto clamp(230px, 40dvh, 440px) minmax(0, 1fr) auto auto;
  gap: 8px; padding: 8px 10px max(8px, env(safe-area-inset-bottom)); color: var(--text); font-size: 16px; background: var(--canvas); overflow: hidden;
}
.mt-top { grid-area: top; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 10px; border-radius: 16px; }
.mt-title { flex: 1; min-width: 0; }
.mt-title strong { font-size: 18px; font-weight: 700; }
.mt-btn-gps, .mt-btn-end { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 40px; border: 0; border-radius: 12px; padding: 0 10px; font-size: 14px; color: var(--text-secondary); background: #f1f5f9; cursor: pointer; white-space: nowrap; }
.mt-btn-gps.on { color: var(--success); background: #ecfdf5; }
.mt-btn-end { color: var(--danger); }
.mt-hero { grid-area: hero; position: relative; min-width: 0; min-height: 0; overflow: hidden; border-radius: 20px; background: var(--glass); }
.mt-guide-heading { position: absolute; z-index: 2; top: 14px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; pointer-events: none; }
.mt-guide-heading h1 { margin: 0; font-size: 20px; font-weight: 700; }
.mt-status { display: flex; align-items: center; gap: 6px; color: var(--champagne-text); font-size: 14px; }
.mt-status i { width: 6px; height: 6px; border-radius: 50%; background: var(--champagne); }
.mt-3d-wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.mt-hero :deep(.digital-avatar) { padding: 0; }
.mt-hero :deep(.viewport) { border: 0; border-radius: 0; background: transparent; position: relative; }
.mt-hero :deep(.xingyun-guide) { position: relative; }
.mt-hero :deep(.xingyun-frame) { min-height: 0; }
.mt-hero :deep(.xingyun-controls) { position: absolute; z-index: 3; left: 12px; right: 12px; bottom: 10px; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; padding: 0; font-size: 14px; }
.mt-hero :deep(.xingyun-controls button) { min-height: 36px; padding: 6px 12px; font-size: 14px; border: 0; border-radius: 12px; background: rgba(255,255,255,.93); box-shadow: 0 3px 14px rgba(30,41,59,.08); }
.mt-hero :deep(.xingyun-controls p) { margin: 0; padding: 4px 8px; font-size: 14px; line-height: 1.4; border-radius: 8px; background: rgba(255,255,255,.93); max-width: 100%; overflow-wrap: anywhere; }
.mt-hero :deep(.playback-message) { position: absolute; bottom: 8px; left: 12px; right: 12px; margin: 0; text-align: center; font-size: 14px; padding: 6px; background: rgba(255,255,255,.9); }
.mt-avatar-loading { display: grid; place-items: center; height: 100%; margin: 0; color: var(--text-secondary); font-size: 16px; }
.mt-spot { grid-area: spot; min-width: 0; max-height: 180px; overflow-y: auto; padding: 6px 10px; border: 0; border-radius: 16px !important; box-shadow: none !important; }
.mts-row { display: flex; align-items: center; gap: 8px; min-height: 40px; }
.mts-nav { display: grid; place-items: center; width: 36px; min-height: 40px; flex: 0 0 36px; border: 0; border-radius: 10px; background: #f1f5f9; color: var(--text-secondary); font-size: 16px; cursor: pointer; }
.mts-nav:disabled { opacity: .35; cursor: default; }
.mts-summary { display: flex; align-items: center; justify-content: center; gap: 12px; flex: 1; min-width: 0; min-height: 40px; padding: 0 4px; border: 0; background: transparent; color: var(--text); cursor: pointer; }
.mts-summary strong { font-size: 16px; font-weight: 700; }
.mts-summary span { font-size: 14px; color: var(--text-muted); white-space: nowrap; }
.mts-summary .el-icon { color: var(--text-muted); font-size: 14px; transition: transform .2s; }
.mts-summary .expanded { transform: rotate(180deg); }
.mts-description { margin: 4px 4px 10px; color: var(--text-secondary); font-size: 15px; line-height: 1.6; max-height: 96px; overflow: auto; }
.mts-advance { display: block; width: 100%; min-height: 36px; margin-top: 6px; padding: 6px 12px; border: 0; border-radius: 12px; background: var(--champagne) !important; color: #fff !important; font-size: 15px; cursor: pointer; }
.mts-finished { display: block; padding: 4px 0; color: var(--text-secondary); font-size: 14px; text-align: center; }
.mt-chat-panel { grid-area: chat; display: flex; flex-direction: column; min-height: 0; min-width: 0; background: var(--glass); border-radius: 18px; overflow: hidden; }
.mt-chat-heading { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px 6px; gap: 10px; flex: 0 0 auto; }
.mt-chat-heading h2 { font-size: 17px; font-weight: 700; margin: 0; }
.mt-chat-heading > span { font-size: 14px; color: var(--text-muted); }
.mt-chat { min-height: 0; flex: 1; overflow-y: auto; padding: 8px 14px 12px; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.mt-chat-empty { margin: 14px 0; font-size: 15px; color: var(--text-secondary); text-align: center; }
.mc-row { display: flex; margin-bottom: 12px; }
.mc-row.user { justify-content: flex-end; }
.mc-row.guide { justify-content: flex-start; }
.mc-bubble { max-width: 94%; padding: 10px 12px; border-radius: 14px; }
.mc-row.guide .mc-bubble { border-radius: 4px 14px 14px; background: #f8fafc; }
.mc-row.user .mc-bubble { border-radius: 14px 4px 14px 14px; background: var(--glass-raised); }
.mc-text { font-size: 15px; line-height: 1.65; overflow-wrap: anywhere; }
.mc-source { margin-top: 8px; font-size: 14px; color: var(--text-secondary); line-height: 1.5; }
.mc-source summary { cursor: pointer; width: fit-content; }
.mc-source p { margin: 6px 0; }
.mc-loading { color: var(--text-secondary); font-size: 15px; line-height: 1.5; margin: 8px 0; }
.mt-bar { grid-area: bar; min-width: 0; padding: 6px 10px 8px; border: 0; border-radius: 18px; background: var(--glass); }
.mt-quick-row { display: flex; gap: 6px; overflow-x: auto; padding: 0 0 8px; scrollbar-width: none; }
.mt-quick-btn { min-height: 32px; padding: 4px 10px; flex-shrink: 0; border: 0; border-radius: 9px; background: #f1f5f9; color: var(--text-secondary); font-size: 14px; white-space: nowrap; cursor: pointer; }
.mt-input-row { display: flex; align-items: center; gap: 8px; }
.mt-voice-btn { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; padding: 0; border: 0; border-radius: 12px; background: #f1f5f9; color: var(--text-secondary); font-size: 20px; cursor: pointer; }
.mt-voice-btn.rec { color: var(--danger); background: #fff1f2; }
.mt-input { flex: 1; min-width: 0; height: 40px; padding: 0 10px; border: 0; border-radius: 12px; color: var(--text); font-size: 15px; outline: none; }
.mt-input:focus { box-shadow: 0 0 0 2px var(--champagne) inset !important; }
.mt-send-btn { min-height: 40px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--champagne) !important; background-image: none !important; box-shadow: none !important; color: #fff !important; font-size: 15px; cursor: pointer; }
button:disabled { opacity: .4; cursor: default; }
@media (min-width: 900px) {
  .mt-root { grid-template-areas: "top top" "hero chat" "hero bar" "hero spot"; grid-template-columns: minmax(360px, 1.08fr) minmax(0, 1fr); grid-template-rows: 56px minmax(0, 1fr) auto auto; gap: 16px; padding: 16px 24px; }
  .mt-top { padding: 0 18px; }
  .mt-title strong { font-size: 21px; }
  .mt-guide-heading { top: 20px; left: 22px; right: 22px; }
  .mt-guide-heading h1 { font-size: 22px; }
  .mt-chat-heading { padding: 14px 16px 8px; }
  .mt-chat-heading h2 { font-size: 19px; }
  .mt-chat { padding: 8px 16px 12px; }
  .mc-bubble { max-width: 90%; padding: 10px 12px; }
  .mt-spot { padding: 10px 14px; }
  .mt-bar { padding: 10px 14px; }
  .mt-quick-row { padding-bottom: 10px; }
}
@media (max-height: 650px) and (max-width: 899px) {
  .mt-root { grid-template-rows: auto clamp(150px, 32dvh, 210px) minmax(0, 1fr) auto auto; gap: 4px; padding-top: 4px; }
  .mt-guide-heading { top: 10px; }
  .mt-chat-heading { padding-top: 7px; }
  .mt-bar { padding: 4px 8px; }
  .mt-quick-row { padding-bottom: 4px; }
}
@media (max-height: 460px) and (min-width: 600px) {
  .mt-root { grid-template-areas: "top top" "hero chat" "hero bar" "hero spot"; grid-template-columns: minmax(220px, 1fr) minmax(0, 1fr); grid-template-rows: 44px minmax(0, 1fr) auto auto; }
}
@media (prefers-reduced-motion: reduce) { *, :deep(*) { transition: none !important; } }
</style>
