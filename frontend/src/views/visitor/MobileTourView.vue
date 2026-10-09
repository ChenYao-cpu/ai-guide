<template>
  <div class="mt-root">
    <!-- 顶栏 -->
    <header class="mt-top">
      <button class="mt-btn-x" @click="confirmEnd">✕</button>
      <div class="mt-title">
        <strong>{{ currentSpot?.spot_name || '景区导览中' }}</strong>
        <span>{{ spotIdx+1 }}/{{ spotCards.length||1 }} · {{ guideInfo?.name||'AI导游' }}</span>
      </div>
      <button class="mt-btn-gps" :class="{on:gpsTracking}" @click="toggleGps">📍</button>
    </header>

    <!-- 数字人 ~1/3屏幕 -->
    <div class="mt-hero">
      <div v-if="guideReady" class="mt-3d-wrap">
        <DigitalAvatarPlayer ref="live2dRef" :audioElement="ttsAudio" :width="gw" :height="gh"
          :tour-id="sid" :framing="route.query.framing === 'half' ? 'half' : 'full'"
          :guide-id="guideInfo?.guide_id" :speaking="isSpeaking" :busy="loading" @playing="isSpeaking=$event" />
      </div>
      <div v-else class="mt-fallback" @click="guideReady=true">
        <span class="mt-model-mark">AI</span>
        <strong>{{ guideInfo?.name||'AI导游' }}</strong>
        <small>{{ guideInfo?.character||'专业景区讲解' }}</small>
        <span class="mt-load-hint">轻触查看数字人接入状态</span>
      </div>
      <div class="mt-status" :class="{on:isSpeaking}">{{ isSpeaking ? '🔊 正在播放讲解语音' : loading ? '✨ 正在思考' : '可开始文字或语音导览' }}</div>
    </div>

    <!-- 景点位置 -->
    <div class="mt-spot" v-if="spotCards.length">
      <button class="mts-nav" @click="prevSpot">◀</button>
      <div class="mts-card">
        <span class="mts-idx">{{ spotIdx+1 }}/{{ spotCards.length }}</span>
        <strong>{{ spotCards[spotIdx]?.spot_name }}</strong>
        <p>{{ spotCards[spotIdx]?.description?.slice(0,80)||'' }}</p>
      </div>
      <button class="mts-nav" @click="nextSpot">▶</button>
    </div>

    <!-- 对话区 — 可滚动，占满剩余空间 -->
    <div class="mt-chat" ref="chatEl">
      <div v-if="!conversations.length" class="mt-chat-empty">
        <span>💬</span>
        <p>点击推荐问题或语音输入<br/>开始与AI导游对话</p>
      </div>
      <div v-for="(m,i) in conversations" :key="i" class="mc-row" :class="m.role">
        <div class="mc-bubble">
          <div class="mc-text" v-html="fmt(m.message)"></div>
          <div class="mc-time">{{ fmtTime(m.send_time) }}</div>
        </div>
      </div>
      <div v-if="loading" class="mc-loading">
        <i></i><i></i><i></i> 思考中
      </div>
    </div>

    <!-- 底部输入 — 固定不动 -->
    <div class="mt-bar">
      <div class="mt-quick-row">
        <button v-for="q in quickQuestions.slice(0,4)" :key="q" class="mt-quick-btn" @click="send(q)">{{ q.length>8?q.slice(0,8)+'…':q }}</button>
      </div>
      <div class="mt-input-row">
        <button aria-label="按住录音，松开识别" class="mt-voice-btn" :class="{rec:recording}" @touchstart.prevent="startVoice" @touchend.prevent="stopVoice" @touchcancel.prevent="stopVoice" :disabled="recognizing || loading">🎤</button>
        <input v-model="inputText" class="mt-input" :placeholder="recording ? '正在录音，松开后识别' : recognizing ? '正在识别录音...' : '输入你想了解的...'" enterkeyhint="send" @keydown.enter="send(inputText)" />
        <button class="mt-send-btn" @click="send(inputText)" :disabled="!inputText.trim()||loading">发送</button>
      </div>
    </div>

    <audio ref="ttsAudio" @play="onPlay" @ended="onEnd" @pause="onEnd" />
  </div>
</template>

<script setup lang="ts">
import { computed,ref,onMounted,onUnmounted,nextTick,watch } from 'vue'
import { useRouter,useRoute } from 'vue-router'
import { ElMessage,ElMessageBox } from 'element-plus'
import DigitalAvatarPlayer from '@/components/DigitalAvatarPlayer.vue'
import { receiveAvatarToken } from '@/api/xingyunTour'
import { getTourLiveInfo,sendTourChatMessage,endTourSession,getVisitorSpotList } from '@/api/visitor'
import { useRecordedSpeech } from '@/composables/useRecordedSpeech'
import { useGeolocation } from '@/composables/useGeolocation'

const router=useRouter()
const route=useRoute()
const sid=Number(route.params.sessionId)
receiveAvatarToken(sid)

const conversations=ref<any[]>([])
const currentSpot=ref<any>(null)
const guideInfo=ref<any>(null)
const guideModelPath=computed(()=>guideInfo.value?.live2d_model_path||'/models/西装女.vrm')
const spotCards=ref<any[]>([])
const spotIdx=ref(0)
const isSpeaking=ref(false)
const loading=ref(false)
const inputText=ref('')
const { recording, recognizing, start: startVoice, stop: stopVoice } = useRecordedSpeech(text => { inputText.value=text; send(text) }, message => ElMessage.error(message))
const guideReady=ref(route.query.framing === 'half')
const chatEl=ref<HTMLElement|null>(null)
const ttsAudio=ref<HTMLAudioElement|null>(null)
const live2dRef=ref<InstanceType<typeof DigitalAvatarPlayer>|null>(null)

const gw=Math.min(window.innerWidth-32,360)
const gh=Math.round(gw*1.15)

const gps=useGeolocation(); const gpsTracking=ref(false)

const quickQuestions=['这里有什么历史故事？','最佳拍照点在哪？','请介绍景点特色','附近有什么设施？']

function fmt(m:string){ return m?.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br/>')||'' }
function fmtTime(t:string){ if(!t)return''; try{return new Date(t).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}catch{return''} }
function sc(){ nextTick(()=>{ if(chatEl.value) chatEl.value.scrollTop=chatEl.value.scrollHeight }) }

function prevSpot(){ if(spotCards.value.length>1) spotIdx.value=(spotIdx.value-1+spotCards.value.length)%spotCards.value.length }
function nextSpot(){ if(spotCards.value.length>1) spotIdx.value=(spotIdx.value+1)%spotCards.value.length }

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

onMounted(refresh)
onUnmounted(()=>{ if(gpsTracking.value) gps.stopTracking() })
</script>

<style lang="scss" scoped>
.mt-root { position:fixed; inset:0; display:flex; flex-direction:column; background:#111827; color:#e5e7eb; }

// 顶栏
.mt-top { flex:0 0 auto; display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(0,0,0,.4); }
.mt-btn-x { width:30px;height:30px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font-size:14px;cursor:pointer; }
.mt-title { flex:1;min-width:0; strong{display:block;font-size:15px;} span{font-size:11px;color:#9ca3af;} }
.mt-btn-gps { width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.1);font-size:16px;cursor:pointer; &.on{background:rgba(34,197,94,.3);} }

// 数字人 ~1/3屏
.mt-hero { flex:0 0 auto; height:32vh; min-height:200px; position:relative; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 35%,#1e293b,#0f172a); overflow:hidden;
  :deep(canvas){ max-width:100%;max-height:100%; }
}
.mt-3d-wrap { width:100%;height:100%;display:flex;align-items:center;justify-content:center; }
.mt-fallback { display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer; strong{font-size:17px;} small{font-size:12px;color:#9ca3af;} }
.mt-model-mark { display:grid; width:72px; height:72px; place-items:center; border-radius:18px; color:#0369a1; background:#e0f2fe; font-size:17px; font-weight:900; letter-spacing:.1em; }
.mt-load-hint { font-size:11px;color:#38bdf8;margin-top:4px;padding:4px 14px;border:1px solid rgba(56,189,248,.3);border-radius:20px; }
.mt-status { position:absolute;bottom:8px;left:50%;transform:translateX(-50%);padding:4px 14px;border-radius:20px;background:rgba(255,255,255,.06);font-size:11px; &.on{background:rgba(34,197,94,.15);color:#4ade80;} }

// 景点
.mt-spot { flex:0 0 auto; display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.03); }
.mts-nav { width:28px;height:28px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:12px;cursor:pointer; }
.mts-card { flex:1;min-width:0; .mts-idx{font-size:10px;color:#6b7280;} strong{display:block;font-size:14px;margin:2px 0;} p{font-size:12px;color:#9ca3af;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} }

// 对话 — 滚动区
.mt-chat { flex:1 1 auto; min-height:0; overflow-y:auto; padding:12px 14px; -webkit-overflow-scrolling:touch; }
.mt-chat-empty { height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#6b7280; span{font-size:40px;margin-bottom:12px;} p{font-size:15px;text-align:center;line-height:1.6;margin:0;} }

.mc-row { margin-bottom:16px; display:flex;
  &.guide { justify-content:flex-start; .mc-bubble{background:#1f2937;border-bottom-left-radius:4px;} }
  &.user  { justify-content:flex-end;   .mc-bubble{background:#0284c7;border-bottom-right-radius:4px;} }
}
.mc-bubble { max-width:85%; padding:12px 14px; border-radius:16px; }
.mc-text { font-size:15px; line-height:1.6; word-break:break-word; }
.mc-time { font-size:10px; color:#9ca3af; text-align:right; margin-top:6px; }

.mc-loading { text-align:center;padding:8px;color:#9ca3af;font-size:14px;
  i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#9ca3af;margin:0 2px;animation:dot 1.4s infinite both;
    &:nth-child(2){animation-delay:.2s} &:nth-child(3){animation-delay:.4s}
  }
}
@keyframes dot{0%,80%,100%{opacity:0;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}

// 底部输入 — 固定
.mt-bar { flex:0 0 auto; border-top:1px solid rgba(255,255,255,.06); background:rgba(0,0,0,.3); padding-bottom:env(safe-area-inset-bottom); }
.mt-quick-row { display:flex;gap:6px;padding:6px 12px;overflow-x:auto; }
.mt-quick-btn { padding:6px 12px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:transparent;color:#9ca3af;font-size:12px;white-space:nowrap;cursor:pointer; }
.mt-input-row { display:flex;align-items:center;gap:8px;padding:8px 12px; }
.mt-voice-btn { width:44px;height:44px;border:2px solid rgba(255,255,255,.12);border-radius:50%;background:transparent;font-size:22px;cursor:pointer;display:grid;place-items:center; &.rec{border-color:#ef4444;background:rgba(239,68,68,.15);animation:rec 1s infinite;} }
@keyframes rec{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 10px rgba(239,68,68,0)}}
.mt-input { flex:1;min-width:0;height:42px;padding:0 14px;border:1px solid rgba(255,255,255,.08);border-radius:21px;background:rgba(255,255,255,.04);color:#e5e7eb;font-size:15px;outline:none; &::placeholder{color:#6b7280;} }
.mt-send-btn { height:42px;padding:0 18px;border:0;border-radius:21px;background:#0284c7;color:#fff;font-size:15px;font-weight:700;cursor:pointer; &:disabled{opacity:.3;} }
</style>
