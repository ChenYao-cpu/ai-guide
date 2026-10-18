<template>
  <main class="tour-interaction-container" :class="{ 'large-reading': largeReading }">
    <header class="tour-banner">
      <div class="banner-left">
        <h1 class="banner-title"><BrandLogo /></h1>
        <nav
          class="banner-route-flow"
          :aria-label='$t("游览路线")'
          :aria-busy="switchingSpot || sessionLoading"
        >
          <div v-if="currentSpot" class="flow-node current-stop" aria-current="step">
            <span class="flow-label">{{ $t("当前站") }}</span><strong>{{ $t(currentSpot.spot_name) }}</strong>
          </div>
          <template v-for="(spot, index) in upcomingStops" :key="spot.spot_id">
            <el-icon class="flow-arrow"><ArrowRight /></el-icon>
            <button
              v-if="index === 0"
              class="flow-node next-stop"
              type="button"
              :aria-label="$t('前往{p0}', {p0: spot.spot_name})"
              :title="$t('前往{p0}', {p0: spot.spot_name})"
              :disabled="
                disableInput || switchingSpot || sessionLoading || !!sessionError || finalSpot
              "
              @click="handleNextSpot"
            >
              <span class="flow-label">{{ $t(switchingSpot ? '切换中…' : '下一站') }}</span
              ><strong>{{ $t(spot.spot_name) }}</strong>
            </button>
            <div v-else class="flow-node later-stop">
              <span class="flow-label">{{ $t("下下一站") }}</span><strong>{{ $t(spot.spot_name) }}</strong>
            </div>
          </template>
          <button v-if="currentSpot && finalSpot && plannedExit" class="flow-node next-stop" type="button" @click="routeMapOpen=true"><span class="flow-label">{{ $t('前往出口') }}</span><strong>{{ $t(plannedExit) }}</strong></button>
          <span v-else-if="currentSpot && finalSpot" class="flow-end">{{ $t("最后一站") }}</span>
          <span v-if="!currentSpot && sessionLoading && !sessionError" class="flow-loading">{{ $t("正在加载路线…") }}</span>
        </nav>
      </div>
      <div class="banner-right">
        <el-button plain :disabled="sessionLoading || !!sessionError" @click="routeMapOpen=true">{{ $t('查看路线') }}</el-button>
        <el-button plain :disabled="sessionLoading || !!sessionError || switchingSpot" @click="openRepair('')">{{ $t('调整行程') }}</el-button>
        <LanguageSwitch :disabled="disableInput || isRecording || recognizing" />
        <el-tooltip
          :content="$t(gpsEnabled ? '定位已开启，接近景点时自动播报' : '开启定位，接近景点时自动播报')"
          placement="bottom"
        >
          <el-button
            :type="gpsEnabled ? 'success' : 'default'"
            plain
            :icon="Location"
            @click="toggleGps"
            >{{ $t(gpsEnabled ? '定位已开' : '定位') }}</el-button
          >
        </el-tooltip>
        <span v-if="gpsEnabled && closestSpot" class="gps-nearby-hint">{{
          $t(closestSpot.within_range
            ? '已到达' + closestSpot.spot_name
            : '距' + closestSpot.spot_name + closestSpot.distance + '米')
        }}</span>
        <el-button type="danger" plain @click="handleEndTour">{{ $t("结束导览") }}</el-button>
      </div>
    </header>

    <div v-if="sessionError" class="tour-alert" role="alert">
      <span>{{ $t(sessionError) }}</span
      ><el-button :loading="sessionLoading" @click="refreshSessionInfo">{{ $t("重新加载") }}</el-button><el-button @click="router.push(planningHome)">{{ $t('返回规划') }}</el-button>
    </div>
    <div class="tour-main">
      <section class="tour-left" :aria-label='$t("数字人导游")'>
        <div class="guide-stage">
          <GuideScenicBackdrop :spot-name="currentSpot?.spot_name" />
          <div class="stage-heading">
            <div><h2>{{ $t(guideInfo?.name || '数字导游') }}</h2><span v-if="persona === 'qianlong'" class="era-stage-label">{{ $t('演绎乾隆时期') }} · 1736–1795</span></div>
            <span class="speaking-state" :class="{ speaking: isSpeaking }" role="status"
              ><i></i>{{ $t(playbackStatus) }}</span
            >
          </div>
          <div class="avatar-space">
            <DigitalAvatarPlayer
              ref="live2dRef"
              :tour-id="Number(props.sessionId)"
              :audioElement="ttsAudio"
              :width="1000"
              :height="800"
              framing="full"
              :speaking="isSpeaking"
              :guide-id="guideInfo?.guide_id"
              :poster-image="guideInfo?.poster_image"
              :source-video="guideInfo?.base_mp4_path"
              :busy="loadingResponse"
              @playing="onAvatarPlaying"
              @connected="avatarConnected = $event"
            />
          </div>
          <audio
            ref="ttsAudio"
            @play="onAudioPlay"
            @ended="onAudioEnded"
            @pause="onAudioEnded"
            @error="onAudioError"
          />
        </div>
      </section>

      <section class="tour-side" :aria-label='$t("景区问答区域")'>
        <section class="tour-right" :aria-label='$t("景区问答")'>
          <header class="chat-heading">
            <h2>{{ $t(tourLanguage === 'en' ? 'Scenic Q&A' : '景区问答') }}</h2>
            <div class="chat-heading-actions">
              <select v-model="persona" class="persona-select" :aria-label="$t('对话角色')" :disabled="disableInput" @change="stopPlayback()"><option value="modern">{{ $t('现代导游') }}</option><option value="qianlong">{{ $t('乾隆时期·史料对话') }}</option></select>
              <span v-if="viewingSpot"><el-icon><Location /></el-icon>{{ $t(viewingSpot.spot_name) }}</span>

            </div>
          </header>
          <p v-if="persona === 'qianlong'" class="era-notice">{{ $t('依据史料演绎；后世问题交由现代导游回答。') }}</p>
          <div class="reading-tools" role="group" :aria-label='$t("讲解与阅读辅助")'>
            <label>{{ $t("讲解方式") }}<select v-model="explanationMode" :aria-label='$t("讲解方式")' :disabled="disableInput"><option value="standard">{{ $t("标准讲解") }}</option><option value="child">{{ $t("儿童讲解") }}</option><option value="deep">{{ $t("深入讲解") }}</option></select></label>
            <button type="button" :aria-pressed="largeReading" @click="largeReading = !largeReading">{{ $t("大字阅读") }}</button>
            <button type="button" :aria-pressed="textOnly" @click="textOnly = !textOnly; stopPlayback()">{{ $t("仅文字") }}</button>
          </div>
          <div class="quick-questions" :aria-label='$t("快捷提问")'>
            <button
              v-for="q in quickQuestions"
              :key="q.message"
              type="button"
              :disabled="disableInput || recognizing"
              @click="handleQuickQuestion(q.message)"
            >
              {{ $t(q.label) }}
            </button>
          </div>
          <div
            class="chat-area"
            role="log"
            :aria-label='$t("导览对话")'
            aria-live="polite"
            aria-relevant="additions text"
          >
            <section v-if="conversations.length === 0" class="chat-welcome">
              <div class="welcome-icon">
                <el-icon><ChatDotRound /></el-icon>
              </div>
              <h3>{{ $t(tourLanguage === 'en' ? 'What would you like to know?' : t('想了解{p0}的什么？', { p0: viewingSpot?.spot_name || '景区' })) }}</h3>
              <p>{{ $t(tourLanguage === 'en' ? 'Choose a question or type in English or Chinese.' : '点击上方问题，或直接输入、语音提问。') }}</p>
            </section>
            <div
              v-for="(msg, idx) in conversations"
              :key="idx"
              class="chat-message"
              :class="msg.role === 'guide' ? 'guide-msg' : 'user-msg'"
            >
              <div class="msg-content">
                <div v-if="msg.role === 'guide'" class="msg-name">
                  {{ $t(messageSpeaker(msg)) }}
                </div>
                <span v-if="msg.aiMeta?.persona" class="era-message-tag">{{ $t(msg.aiMeta.persona.mode === 'modern_handoff' ? '已交由现代导游' : msg.aiMeta.persona.mode === 'insufficient' ? '史料不足，未作推测' : '乾隆时期 · 史料演绎') }}</span>
                <div class="msg-text" v-html="formatMessage(msg.message, msg.role)"></div>
                <TourVisualContext v-if="msg.role==='guide'" :context="msg.aiMeta?.visuals" :expanded="idx===conversations.length-1" />
                <div v-if="msg.role === 'guide' && msg.aiMeta?.serviceActions?.length" class="service-actions">
                  <template v-for="action in msg.aiMeta.serviceActions" :key="action.url"><a v-if="isKnowledgeSourceUrl(action.url) || action.url === 'tel:01062860608'" :href="action.url" :target="action.url.startsWith('https:') ? '_blank' : undefined" rel="noopener noreferrer">{{ $t(action.label) }}</a></template>
                </div>
                <details
                  v-if="
                    msg.role === 'guide' &&
                    (msg.aiMeta?.sources?.length || msg.aiMeta?.persona || msg.aiMeta?.spotContext ||
                      msg.aiMeta?.references?.length ||
                      msg.message?.includes('以上内容来自景区知识档案'))
                  "
                  class="msg-sources"
                >
                  <summary>{{ $t("参考资料") }}</summary>
                  <div v-if="msg.aiMeta?.persona?.timeline?.length" class="era-timeline"><p v-for="point in msg.aiMeta.persona.timeline" :key="point.year + point.text"><strong>{{ point.year }}</strong><span>{{ point.text }}</span></p><p>{{ $t('事实摘要依据官方资料整理，不是历史人物原话。') }}</p></div>
                  <p v-if="msg.aiMeta?.spotContext">{{ $t(msg.aiMeta.spotContext) }} {{ $t("景点资料") }}</p>
                  <p v-if="msg.aiMeta?.claimReview?.status === 'model_checked'">{{ $t("回答经过模型辅助核对，引用原文可展开查看；不代表人工逐句认证。") }}</p>
                  <details v-if="msg.aiMeta?.claimReview?.checks?.length"><summary>{{ $t("回答对应原文") }}</summary><div v-for="check in msg.aiMeta.claimReview.checks" :key="check.segment"><strong>{{ $t("第") }} {{ $t(check.segment) }} {{ $t("段依据") }}</strong><blockquote v-for="quote in check.quotes" :key="quote.evidence_id + quote.quote">{{ quote.quote }}</blockquote></div></details>
                  <p v-else-if="msg.message?.includes('以上内容来自景区知识档案')">{{ $t("景区知识档案") }}</p>
                  <ul v-if="msg.aiMeta?.sources?.length">
                    <li v-for="source in msg.aiMeta.sources" :key="source.url">
                      <a v-if="isKnowledgeSourceUrl(source.url)" :href="source.url" target="_blank" rel="noopener noreferrer">{{ $t(source.title) }}</a>
                      <span v-else>{{ $t(source.title) }}</span>
                    </li>
                  </ul>
                  <ul v-else-if="msg.aiMeta?.references?.length">
                    <li v-for="(source, index) in msg.aiMeta.references" :key="index">
                      {{ source }}
                    </li>
                  </ul>
                  <details v-if="msg.aiMeta?.evidence?.length" class="evidence-excerpts">
                    <summary>{{ $t(msg.aiMeta?.persona ? '查看史料摘要' : '查看检索原文') }}</summary>
                    <article v-for="piece in msg.aiMeta.evidence" :key="piece.id"><strong>{{ $t(piece.spot) }} · {{ $t(piece.document) }}</strong><p>{{ piece.excerpt }}</p><span>{{ $t("版本") }} {{ piece.version }} {{ $t("· 片段") }} {{ piece.id }}</span></article>
                    <p>{{ $t(msg.aiMeta.evidenceNote) }}</p>
                  </details>
                </details>
              </div>
            </div>
            <div v-if="loadingResponse" class="loading-indicator" role="status">
              <el-icon class="is-loading"><Loading /></el-icon>{{ $t(generationStage) }}
            </div>
          </div>
          <div class="chat-input-area">
            <p v-if="chatError" class="chat-request-error" role="alert">{{ chatError }}</p>
            <div class="input-row">
              <el-input
                v-model="inputValue"
                :aria-label='$t("导览问题")'
                type="textarea"
                :rows="2"
                :placeholder="$t(tourLanguage === 'en' ? 'Ask in English or Chinese…' : '有什么想问的？')"
                :disabled="disableInput"
                @keydown.enter.exact.prevent="handleSend"
                resize="none"
              />
              <div class="composer-actions">
                <el-button v-if="loadingResponse || loadingSpeech || isSpeaking" class="interrupt-button" @click="interruptAnswer">{{ $t(loadingResponse ? '停止回答' : '打断讲解') }}</el-button>
                <el-button
                  :type="isRecording ? 'danger' : 'default'"
                  :icon="Microphone"
                  :aria-label="$t(isRecording ? '结束录音' : '开始录音')"
                  :title="$t(isRecording ? '再次点击结束录音' : '点击录音，录完再次点击')"
                  @click="handleRecord"
                  :loading="disableInput || recognizing"
                  >{{ $t(isRecording ? '结束录音' : '语音') }}</el-button
                >
                <el-button
                  type="primary"
                  :icon="Promotion"
                  :aria-label='$t("发送问题")'
                  @click="handleSend"
                  :disabled="!inputValue.trim() || isRecording"
                  :loading="disableInput || recognizing"
                  >{{ $t("发送") }}</el-button
                >
              </div>
            </div>
            <p v-if="isRecording || recognizing" class="recording-status" role="status">
              {{ $t(isRecording ? '录音中，点击“结束录音”发送识别（最长60秒）' : '正在识别录音…') }}
            </p>
          </div>
        </section>
      </section>
    </div>

    <el-dialog v-model="showWelcomeDialog" :title='$t("本次导览路线")' width="600px" class="tour-dialog">
      <div class="route-result" v-if="routeInfo">
        <h3>{{ $t(routeInfo.name) }}</h3>
        <div class="route-summary">
          <span>{{ $t(themeLabel(routeInfo.theme)) }}</span
          ><span>{{ $t("约") }} {{ $t(routeInfo.estimated_time) }} {{ $t("分钟") }}</span>
        </div>
        <div v-if="visitorSpots.length" class="route-spots">
          <div v-for="(spot, idx) in visitorSpots" :key="idx" class="route-spot-item">
            <span class="spot-num">{{ $t(idx + 1) }}</span
            >{{ $t(spot) }}
          </div>
        </div>
        <div v-if="visitorPrefs.length" class="route-preferences">
          <span v-for="pref in visitorPrefs" :key="pref">{{ $t(prefLabel(pref)) }}</span>
        </div>
      </div>
      <template #footer
        ><el-button type="primary" @click="showWelcomeDialog = false">{{ $t("开始导览") }}</el-button></template
      >
    </el-dialog>
    <TourRouteRepair v-if="repairOpen" :session-id="Number(props.sessionId)" :current-name="currentSpot?.spot_name || ''" :remaining-spots="routeSpots.slice(activeSpotIndex + 1)" :prompt="repairPrompt" :initial-minutes="remainingBudget" :initial-pace="savedPlan.pace" :initial-exit="savedPlan.end_area" :initial-avoid-steps="savedPlan.avoid_steps" :initial-required="savedPlan.required_spot_ids" @close="repairOpen = false" @applied="repairApplied" />
    <el-dialog v-model="routeMapOpen" :title="$t('剩余游览路线')" width="min(760px,94vw)" class="tour-route-map-dialog" destroy-on-close><RouteOverview v-if="routeMapOpen" :overview="currentRouteOverview" :spot-ids="routeSpots.slice(activeSpotIndex).map(s=>s.spot_id)" :current-id="currentSpot?.spot_id" :pace="savedPlan.pace" /></el-dialog>
    <PwaInstallPrompt />
  </main>
</template>

<script setup lang="ts">import { t, locale } from '@/i18n'
import LanguageSwitch from '@/components/LanguageSwitch.vue'

import BrandLogo from '@/components/BrandLogo.vue'
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowRight,
  ChatDotRound,
  Loading,
  Location,
  Microphone,
  Promotion
} from '@element-plus/icons-vue'
import DigitalAvatarPlayer from '@/components/DigitalAvatarPlayer.vue'
import GuideScenicBackdrop from '@/components/GuideScenicBackdrop.vue'
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue'
import { receiveAvatarToken } from '@/api/xingyunTour'
import TourRouteRepair from '@/components/TourRouteRepair.vue'
import TourVisualContext from '@/components/TourVisualContext.vue'
import RouteOverview from '@/components/RouteOverview.vue'
import type { RouteOverviewData } from '@/api/tourExperience'
import { getTourLiveInfo, sendTourChatMessage, endTourSession, getReplyMedia } from '@/api/visitor'
import { useRecordedSpeech } from '@/composables/useRecordedSpeech'
import { useGeolocation } from '@/composables/useGeolocation'
import { formatTourMessage, isKnowledgeSourceUrl } from '@/utils/tourPresentation'

const router = useRouter()
const planningHome = computed(()=>router.currentRoute.value.path.startsWith('/m/')?'/m/home':'/station/summer-palace-east')
const props = defineProps<{ sessionId: string }>()

// ── GPS 位置追踪 ──
const gps = useGeolocation()
const closestSpot = computed(() => gps.closestSpot.value)
const gpsEnabled = ref(false)

function toggleGps() {
  if (!gps.isSupported()) {
    ElMessage.warning(t("您的设备不支持GPS定位"))
    return
  }
  if (gpsEnabled.value) {
    gps.stopTracking()
    gpsEnabled.value = false
    ElMessage.info(t("GPS追踪已关闭"))
  } else {
    gps.startTracking(Number(props.sessionId), 8000)
    gpsEnabled.value = true
    ElMessage.success(t("GPS追踪已开启，接近景点时自动播报"))
  }
}

// 监听GPS接近的景点
watch(
  () => gps.closestSpot.value,
  (spot) => {
    if (spot && spot.within_range && gpsEnabled.value && gps.autoSwitchEnabled.value) {
      // GPS检测到进入新景点范围，自动切换
      refreshSessionInfo()
    }
  }
)

const conversations = ref<any[]>([])
const inputValue = ref(sessionStorage.getItem('tour-draft-'+props.sessionId)||'')
watch(inputValue,value=>{try{sessionStorage.setItem('tour-draft-'+props.sessionId,value)}catch{/* Optional draft storage. */}})
const chatError=ref(''),routeMapOpen=ref(false)
const persona = ref<'modern'|'qianlong'>('modern')
const repairOpen=ref(false), repairPrompt=ref(''), remainingBudget=ref<number|undefined>()
const savedPlan=ref<{pace?:'standard'|'relaxed';end_area?:'auto'|'east'|'north'|'south';avoid_steps?:boolean;required_spot_ids?:number[]}>({})
const currentRouteOverview=ref<RouteOverviewData|null>(null)
const plannedExit=computed(()=>(({east:'东宫门',north:'北宫门',south:'新建宫门'} as Record<string,string>)[savedPlan.value.end_area||'auto']||''))
const loadingSpeech=ref(false)
let speechController:AbortController|undefined
let turnVersion=0
function messageSpeaker(msg:any) {
  return msg.aiMeta?.persona?.mode === 'historical' ? '乾隆时期讲解' : msg.aiMeta?.persona ? '现代导游' : guideInfo.value?.name || '数字导游'
}
function isRouteChange(message:string) {
  return !/不(?:需要|用|要)调整|不用改|不累|not tired|do not replan/i.test(message) && /只剩|还剩|剩下|提前离园|早点离园|回出口|调整路线|改.*路线|少走|走不动|累了|跳过|不去|不想去|不想爬|避开|minutes? left|hours? left|tired|skip|replan|leave early|less walking|avoid stairs/i.test(message)
}
function openRepair(message:string){interruptAnswer();repairPrompt.value=message;repairOpen.value=true}
async function repairApplied(){repairOpen.value=false;stopPlayback();await refreshSessionInfo();ElMessage.success(t('路线已更新'))}
function interruptAnswer(){turnVersion++;chatController?.abort();chatController=undefined;stopPlayback();stopGenerationStages();disableInput.value=false;loadingResponse.value=false}

const explanationMode = ref<'standard' | 'child' | 'deep'>(['standard','child','deep'].includes(localStorage.getItem('tour-explanation-mode')||'') ? localStorage.getItem('tour-explanation-mode') as 'standard'|'child'|'deep' : 'standard')
watch(explanationMode,value=>{try{localStorage.setItem('tour-explanation-mode',value)}catch{/* Optional preference storage. */}})
const largeReading = ref(localStorage.getItem('tour-large-reading') === 'true')
const textOnly = ref(localStorage.getItem('tour-text-only') === 'true')
watch(largeReading,value => localStorage.setItem('tour-large-reading',String(value)))
watch(textOnly,value => localStorage.setItem('tour-text-only',String(value)))
const tourLanguage = locale
watch(locale, () => stopPlayback())
const disableInput = ref(false)
const loadingResponse = ref(false)
const switchingSpot = ref(false)
const sessionLoading = ref(false)
const sessionError = ref('')
const generationStage = ref('正在理解问题')
const finalSpot = ref(false)
const currentSpot = ref<any>(null)
const guideInfo = ref<any>(null)
const visitorDisplayName = ref('')
const routeInfo = ref<any>(null)
const ttsAudio = ref<HTMLAudioElement | null>(null)
const isSpeaking = ref(false)
const avatarConnected = ref(false)
const playbackError = ref(false)
let playbackVersion = 0
let disposed = false
let chatController: AbortController | undefined
let sessionController:AbortController|undefined,sessionVersion=0
const currentEmotion = ref('neutral')
const live2dRef = ref<InstanceType<typeof DigitalAvatarPlayer> | null>(null)
const {
  recording: isRecording,
  recognizing,
  start: startRecognition,
  stop: stopRecognition
} = useRecordedSpeech(
  (text) => {
    inputValue.value = text
    ElMessage.success(t("识别完成"))
  },
  (message) => ElMessage.error(message)
)
let emotionResetTimer: ReturnType<typeof setTimeout> | null = null
let generationTimer: ReturnType<typeof setInterval> | null = null
const showWelcomeDialog = ref(false)
const visitorSpots = ref<string[]>([])
const visitorPrefs = ref<string[]>([])
// 路线全部景点（含图片/描述等完整信息）
const routeSpots = ref<any[]>([])
// 路线窗口只弹一次
const welcomeShown = ref(sessionStorage.getItem('tour-welcome-'+props.sessionId)==='true')
const viewingSpot = computed(() => currentSpot.value)
const activeSpotIndex = computed(() =>
  routeSpots.value.findIndex((spot) => spot.spot_id === currentSpot.value?.spot_id)
)
const nextTourSpot = ref<any>(null)
const upcomingStops = computed(() => {
  if (finalSpot.value) return []
  const following =
    activeSpotIndex.value >= 0
      ? routeSpots.value.slice(activeSpotIndex.value + 1, activeSpotIndex.value + 3)
      : []
  if (!following.length && nextTourSpot.value) return [nextTourSpot.value]
  return following
})
const playbackStatus = computed(() => {
  if (loadingResponse.value) return generationStage.value
  if (loadingSpeech.value) return t('文字已就绪，正在准备语音')
  if (isSpeaking.value) return t("正在讲解")
  if (playbackError.value) return t("语音未播放，可查看文字")
  return avatarConnected.value ? t("数字人已就绪") : t("可文字或语音问答")
})

/** 情感标签映射: 后端 sentment label → Live2D emotion */
const SENTIMENT_TO_EMOTION: Record<string, string> = {
  positive: 'happy',
  negative: 'sad',
  neutral: 'neutral'
}

const quickQuestions = computed(() => persona.value === 'qianlong' ? (tourLanguage.value === 'en' ? [
  {label:'Garden origins',message:'Why was Qingyi Yuan built?'},
  {label:'A later era',message:'What happened in 1860?'},
  {label:'Private thoughts',message:'What were your private thoughts?'}
] : [
  {label:'建园故事',message:'清漪园为什么修建？'},
  {label:'后世变迁',message:'1860年这里发生了什么？'},
  {label:'史料边界',message:'你建园时心里怎么想的？'}
]) : tourLanguage.value === 'en' ? [
  { label: 'History', message: 'What is the history of this place?' },
  { label: 'Photo spots', message: 'Where can I take good photos here?' },
  { label: 'Facilities', message: 'What facilities are nearby?' },
  { label: 'Highlights', message: 'What are the highlights of this place?' },
  { label: 'Next stop', message: 'What is the next stop on my route?' }
] : [
  { label: t("历史故事"), message: t("这里有什么历史故事？") },
  { label: t("拍照位置"), message: t("最佳拍照点在哪里？") },
  { label: t("附近设施"), message: t("附近有哪些服务设施？") },
  { label: t("景点特色"), message: t("请介绍景点特色") },
  { label: t("下一站建议"), message: t("下一站推荐去哪里？") }
])

async function refreshSessionInfo() {
  if (sessionLoading.value) return false
  sessionLoading.value = true
  const own=++sessionVersion,sid=props.sessionId
  sessionController?.abort();sessionController=new AbortController()
  try {
    const response = await getTourLiveInfo(Number(sid),sessionController.signal)
    if (disposed || own!==sessionVersion || sid!==props.sessionId) return false
    if (response?.data?.success) {
      const data = response.data.data
      if(data.live_status===2){sessionStorage.removeItem('zhiyou-active-tour');sessionError.value=t('本次导览已结束，请返回重新规划');return false}
      sessionError.value = ''
      conversations.value = data.conversation || []
      currentSpot.value = data.current_spot_info
      nextTourSpot.value = data.next_spot_info
      guideInfo.value = data.guide_info
      visitorDisplayName.value = (data.name || '').replace(/的导览$/, '').trim()
      routeInfo.value = data.route_info
      finalSpot.value = data.final_spot
      routeSpots.value = data.route_spots || []
      currentRouteOverview.value = data.remaining_route_overview || data.route_overview || null
      try {
        const prefs = JSON.parse(data.visitor_preferences || '{}')
        visitorPrefs.value = prefs.preferences || prefs.prefs || []
        const plan = prefs.last_replan || prefs.planning || {}
        savedPlan.value = {pace:plan.pace,end_area:plan.end_area,avoid_steps:plan.avoid_steps??plan.pace==='relaxed',required_spot_ids:plan.required_spot_ids}
        const started = prefs.last_replan?.applied_at ? prefs.last_replan.applied_at * 1000 : Date.parse(data.start_time || '')
        const initial = prefs.last_replan?.remaining_minutes ?? plan.time_budget_minutes
        remainingBudget.value = initial ? Math.max(1, Math.floor(initial - (Number.isFinite(started) ? (Date.now()-started)/60000 : 0))) : undefined
        if (!routeSpots.value.length && prefs.spot_ids?.length > 0) {
          const { getVisitorSpotList } = await import('@/api/visitor')
          const spotResponse = await getVisitorSpotList().catch(() => null)
          const allSpots: any[] =
            (spotResponse as any)?.data?.data?.spot_list ||
            (spotResponse as any)?.data?.spot_list ||
            []
          visitorSpots.value = prefs.spot_ids.map(
            (id: number) =>
              allSpots.find((spot: any) => spot.spot_id === id)?.spot_name || t("景点 {p0}", {p0: id})
          )
          // 存储完整景点信息用于滑动浏览
          routeSpots.value = prefs.spot_ids
            .map((id: number) => allSpots.find((spot: any) => spot.spot_id === id))
            .filter(Boolean)
        }
      } catch {
        /* ignore preference parsing failure */
      }
      visitorSpots.value = routeSpots.value.map((spot) => spot.spot_name)
      try{sessionStorage.setItem('zhiyou-active-tour',JSON.stringify({id:Number(sid),spot:currentSpot.value?.spot_name||'',at:Date.now()}))}catch{/* Optional recovery shortcut. */}
      if (!currentSpot.value) {
        sessionError.value = data.route_error || t("路线景点未能加载，请重新加载或重新规划行程")
        return false
      }
      // 路线介绍窗口只在进入时弹一次
      if (data.route_info?.name && !welcomeShown.value) {
        showWelcomeDialog.value = true
        welcomeShown.value = true
        sessionStorage.setItem('tour-welcome-'+props.sessionId,'true')
      }
      return true
    }
    sessionError.value = response?.data?.message || t("导览信息不可用，请重新加载")
  } catch {
    if (!disposed && own===sessionVersion) sessionError.value = '暂时无法连接导览服务，请重新加载'
  } finally {
    if(own===sessionVersion)sessionLoading.value = false
  }
  return false
}

// 问答回复照常播放，页面不再提供独立的景点讲解或播放控制。
function stopPlayback() {
  playbackVersion++
  speechController?.abort()
  loadingSpeech.value=false
  live2dRef.value?.stop()
  ttsAudio.value?.pause()
  isSpeaking.value = false
}
function onAvatarPlaying(value: boolean) {
  isSpeaking.value = value
}
function onAudioPlay() {
  isSpeaking.value = true
  playbackError.value = false
}
function onAudioEnded() {
  isSpeaking.value = false
}
function onAudioError() {
  isSpeaking.value = false
  playbackError.value = true
}
async function playReply(data: any) {
  if (textOnly.value) return
  const version = playbackVersion
  try {
    if (live2dRef.value?.speak(data.spokenText || data.message)) return
    await live2dRef.value?.acceptPerformance(data.avatarPerformance)
    if (disposed || version !== playbackVersion) return
    if (live2dRef.value?.acceptJob(data.avatarJob)) return
    if (data.ttsAudioUrl && ttsAudio.value) {
      ttsAudio.value.src = data.ttsAudioUrl.replace(/^https?:\/\/[^/]+/, '')
      ttsAudio.value.currentTime = 0
      await ttsAudio.value.play()
    } else {
      playbackError.value = true
      ElMessage.info(t('当前音色的语音服务暂时不可用，请查看文字'))
    }
  } catch {
    if (!disposed && version === playbackVersion) onAudioError()
  }
}

// ── 核心：发送消息 ──
function startGenerationStages() {
  generationStage.value = '正在准备讲解…'
  stopGenerationStages()
  generationTimer = setInterval(() => {
    generationStage.value = '讲解仍在准备，请稍候…'
  }, 15000)
}

function stopGenerationStages() {
  if (generationTimer) clearInterval(generationTimer)
  generationTimer = null
}

async function handleSend() {
  const message = inputValue.value.trim()
  if (!message || disableInput.value || switchingSpot.value) return
  inputValue.value = ''
  const success = await sendMessage(message)
  if (!success && !inputValue.value) inputValue.value = message
}
async function sendMessage(message: string) {
  if (disableInput.value || disposed || sessionError.value || sessionLoading.value || !currentSpot.value) return false
  if (isRouteChange(message)) {openRepair(message);return true}
  const ownTurn = ++turnVersion
  chatError.value=''
  const sentAt = performance.now()
  const nextViewingSpot = nextTourSpot.value || upcomingStops.value[0]
  conversations.value.push({
    role: 'user',
    userName: t("游客"),
    message,
    send_time: new Date().toISOString()
  })
  disableInput.value = true
  loadingResponse.value = true
  startGenerationStages()
  await nextTick()
  const chat = document.querySelector('.chat-area')
  if (chat) chat.scrollTop = chat.scrollHeight
  try {
    stopPlayback()
    playbackError.value = false
    chatController = new AbortController()
    const signal = chatController.signal
    const response = await sendTourChatMessage(
      Number(props.sessionId),
      message,
      currentSpot.value?.spot_id,
      nextViewingSpot?.spot_id || 0,
      (await live2dRef.value?.getMode()) || 'audio',
      { signal, timeout: 75000, language: tourLanguage.value,
        explanation_mode: explanationMode.value, text_only: textOnly.value, persona: persona.value, defer_speech: true }
    )
    if (disposed || ownTurn !== turnVersion) return true
    const body = response.data
    if (body && body.success) {
      conversations.value.push({
        role: 'guide',
        message: body.data?.message || '',
        aiMeta: body.data?.aiMeta,
        send_time: new Date().toISOString()
      })
      if (body.data?.aiMeta) body.data.aiMeta.clientTextReadyMs = Math.round(performance.now()-sentAt)
      if(body.data?.speechPending && body.data?.messageId && !textOnly.value) {
        const mediaVersion=playbackVersion
        speechController=new AbortController();loadingSpeech.value=true
        void getReplyMedia(Number(props.sessionId),body.data.messageId,speechController.signal).then(async media=>{
          if(disposed || mediaVersion!==playbackVersion || ownTurn!==turnVersion || textOnly.value)return
          loadingSpeech.value=false
          await playReply({...body.data,...media.data.data})
        }).catch((e:any)=>{
          if(!disposed && mediaVersion===playbackVersion && e.code!=='ERR_CANCELED')onAudioError()
        }).finally(()=>{if(mediaVersion===playbackVersion)loadingSpeech.value=false})
      } else await playReply(body.data)

      // ── 情感分析 → 数字人表情 ──
      const sentimentLabel = body.data?.sentiment?.label
      if (sentimentLabel) {
        const emotion = SENTIMENT_TO_EMOTION[sentimentLabel] || 'neutral'
        currentEmotion.value = emotion

        // 非中性表情 8 秒后自动恢复为 neutral
        if (emotionResetTimer) clearTimeout(emotionResetTimer)
        if (emotion !== 'neutral') {
          emotionResetTimer = setTimeout(() => {
            currentEmotion.value = 'neutral'
          }, 8000)
        }
      }

      return true
    } else {
      console.error('Chat API fail:', body?.message, body)
      ElMessage.error(body?.message || t("回复失败"))
      chatError.value=body?.message||t('回复失败，请重试')
    }
  } catch (e: any) {
    if (ownTurn !== turnVersion || e.code === 'ERR_CANCELED') return true
    console.error('Send error:', e.message, e)
    if (!disposed)
      ElMessage.error(e.code === 'ECONNABORTED' ? t("讲解准备超时，请重试") : t("发送失败，请重试"))
    if(!disposed)chatError.value=t(e.code==='ECONNABORTED'?'讲解准备超时，请重试':'发送失败，请重试')
    if(!inputValue.value)inputValue.value=message
  } finally {
    if (ownTurn === turnVersion) {
    stopGenerationStages()
    disableInput.value = false
    loadingResponse.value = false
    }
    if (!disposed) {
      await nextTick()
      const chat = document.querySelector('.chat-area')
      if (chat) chat.scrollTop = chat.scrollHeight
    }
  }
  return false
}

async function handleQuickQuestion(question: string) {
  if (!switchingSpot.value) await sendMessage(question)
}
async function handleNextSpot() {
  if (
    switchingSpot.value ||
    disableInput.value ||
    finalSpot.value ||
    !currentSpot.value ||
    sessionError.value
  )
    return
  switchingSpot.value = true
  try {
    const sid = Number(props.sessionId)
    stopPlayback()
    const timeoutController=new AbortController()
    const deadline=setTimeout(()=>timeoutController.abort(),15000)
    let data:any
    try {
    const res = await fetch(`/tour-session/next-spot/${sid}`, {
      method: 'POST',
      signal:timeoutController.signal,
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    data = await res.json()
    } finally {clearTimeout(deadline)}
    if (disposed) return
    if (data.success) {
      playbackError.value = false
      if (await refreshSessionInfo()) {
        ElMessage.success(t("已切换到") + currentSpot.value.spot_name)
      }
    } else {
      ElMessage.error(data.message || t("切换失败"))
    }
  } catch (e: any) {
    console.error('[handleNextSpot] 异常:', e)
    ElMessage.error(t("切换失败: ") + (e.message || e.toString()))
  } finally {
    switchingSpot.value = false
  }
}
async function handleEndTour() {
  try {
    await ElMessageBox.confirm(t("确定要结束本次导览吗？"), t("结束导览"), {
      confirmButtonText: t("结束"),
      cancelButtonText: t("取消")
    })
    await endTourSession(Number(props.sessionId))
    sessionStorage.removeItem('zhiyou-active-tour')
    sessionStorage.removeItem('tour-draft-'+props.sessionId)
    ElMessage.success(t("导览已结束"))
    router.push(planningHome.value)
  } catch {
    /* user cancelled */
  }
}
function handleRecord() {
  if (!isRecording.value) stopPlayback()
  isRecording.value ? stopRecognition() : startRecognition()
}
function formatMessage(message: string, role = '') {
  return formatTourMessage(message, role === 'guide', [
    visitorDisplayName.value,
    guideInfo.value?.name || ''
  ])
}
function prefLabel(key: string): string {
  const map: Record<string, string> = {
    history: t("历史文化"),
    nature: t("自然风光"),
    photography: t("拍照打卡"),
    family: t("亲子家庭"),
    comprehensive: t("综合游览")
  }
  return map[key] || key
}
function themeLabel(key: string): string {
  const map: Record<string, string> = {
    comprehensive: t("综合游览"),
    historical: t("历史文化"),
    history: t("历史文化"),
    natural: t("自然风光"),
    nature: t("自然风光"),
    cultural: t("文化古迹"),
    modern: t("现代景观"),
    family: t("亲子游览"),
    photography: t("影像记录")
  }
  return map[key] || key
}
function recoverOnline(){if(sessionError.value&&!sessionLoading.value&&!disposed)void refreshSessionInfo()}
watch(()=>props.sessionId,()=>{
  interruptAnswer();sessionVersion++;sessionController?.abort();sessionLoading.value=false
  conversations.value=[];currentSpot.value=null;routeSpots.value=[];guideInfo.value=null;sessionError.value='';chatError.value='';welcomeShown.value=sessionStorage.getItem('tour-welcome-'+props.sessionId)==='true'
  receiveAvatarToken(Number(props.sessionId));inputValue.value=sessionStorage.getItem('tour-draft-'+props.sessionId)||''
  void refreshSessionInfo()
})
onMounted(() => {
  window.addEventListener('online',recoverOnline)
  receiveAvatarToken(Number(props.sessionId))
  refreshSessionInfo()
})
onUnmounted(() => {
  disposed = true
  sessionVersion++;sessionController?.abort();window.removeEventListener('online',recoverOnline)
  chatController?.abort()
  stopPlayback()
  if (gpsEnabled.value) gps.stopTracking()
  stopGenerationStages()
  if (emotionResetTimer) clearTimeout(emotionResetTimer)
})
</script>

<style scoped lang="scss">
:global(.tour-route-map-dialog.el-dialog){margin:3dvh auto!important;max-height:94dvh;display:flex;flex-direction:column}
:global(.tour-route-map-dialog .el-dialog__header){flex-shrink:0}
:global(.tour-route-map-dialog .el-dialog__body){min-height:0;overflow:auto}
.chat-request-error{margin:0 0 8px;color:#b42342;font-size:14px;line-height:1.5}
@media (min-width:769px) and (max-width:1366px){.banner-route-flow .later-stop,.banner-route-flow:has(.later-stop)>.flow-arrow:last-of-type{display:none}.tour-banner .banner-route-flow{scrollbar-width:none}.tour-banner .banner-route-flow::-webkit-scrollbar{display:none}}
.persona-select{font:inherit;font-size:14px;color:#59459b;background:#f3effc;border:1px solid #e6dcf7;border-radius:12px;padding:8px 10px;max-width:210px}
.era-stage-label{display:block;color:#89764b;font-size:14px;margin-top:5px}.era-notice{margin:0;padding:0 22px 10px;font-size:13px;color:#85754d;line-height:1.5}.era-message-tag{display:inline-block;padding:4px 8px;border-radius:7px;color:#866a36;background:#fbf4e6;font-size:12px;margin-bottom:8px}.era-timeline p{display:flex;gap:12px;font-size:14px;line-height:1.65}.era-timeline strong{color:#806ab1;flex-shrink:0}.interrupt-button{color:#7b5273!important;background:#f7eef4!important}.composer-actions{flex-wrap:wrap}.persona-select:focus-visible{outline:2px solid #7460c5;outline-offset:3px}

.chat-heading-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:flex-end}
.chat-heading-actions > span{display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:16px}
.tour-language{display:flex;gap:2px;padding:3px;border-radius:12px;background:var(--glass)}
.tour-language button{border:0;padding:7px 12px;border-radius:9px;background:transparent;font:inherit;font-size:15px;color:var(--text-secondary);cursor:pointer}
.tour-language button[aria-pressed="true"]{background:#eeedff;color:#5145e8}
.tour-language button:disabled{cursor:wait;opacity:.6}
.tour-interaction-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 0;
  padding: 14px 22px 18px;
  box-sizing: border-box;
  color: var(--text);
  font-size: 16px;
  overflow: hidden;
}
.tour-banner {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto 16px;
  padding: 12px 20px;
  box-sizing: border-box;
  background: var(--glass);
  border-radius: 24px;
  box-shadow: var(--glass-shadow);
}
.banner-left,
.banner-right {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.banner-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 16px;
  color: var(--champagne);
  background: var(--glass-raised);
  font-size: 24px;
}
.banner-title {
  margin: 0;
  font-size: 22px;
  white-space: nowrap;
  font-weight: 700;
}
.banner-left {
  flex: 1;
  overflow: hidden;
}
.banner-right {
  flex: 0 0 auto;
}
.banner-title {
  flex-shrink: 0;
}
.banner-route-flow {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  border-left: 1px solid var(--glass-line);
  padding-left: 20px;
}
.flow-node {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 12px;
  flex: 0 0 auto;
  box-sizing: border-box;
}
.flow-node strong {
  color: var(--text);
  font-size: 16px;
  font-weight: 400;
  white-space: nowrap;
}
.flow-label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.current-stop {
  background: #eef2ff;
}
.current-stop strong {
  color: var(--champagne-text);
}
.next-stop {
  border: 0;
  background: #f1f5f9;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}
.next-stop:hover:not(:disabled) {
  background: #e0e7ff;
}
.next-stop:disabled {
  opacity: 0.55;
  cursor: default;
}
.flow-arrow {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 16px;
}
.flow-end,
.flow-loading {
  white-space: nowrap;
  font-size: 14px;
  color: var(--text-secondary);
}
.tour-alert {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto 12px;
  padding: 10px 16px;
  box-sizing: border-box;
  border-radius: 16px;
  color: var(--danger);
  background: #fff;
  font-size: 15px;
}
.chat-heading > span {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 16px;
}
.gps-nearby-hint {
  font-size: 16px;
  color: var(--success);
}
.tour-interaction-container :deep(.el-button) {
  height: 38px;
  padding: 0 12px;
  margin-left: 0;
  font-size: 15px;
  font-family: inherit;
  box-shadow: 0 4px 14px rgba(30, 41, 59, 0.06) !important;
  background-image: none !important;
}
.tour-interaction-container :deep(.el-button--primary) {
  background: var(--champagne) !important;
  border-color: var(--champagne) !important;
  color: #fff !important;
  box-shadow: 0 6px 18px rgba(79, 70, 229, 0.18) !important;
}
.tour-interaction-container :deep(.el-button--primary:not(.is-disabled):hover) {
  background: #4338ca !important;
}
.tour-main {
  display: grid;
  grid-template-columns: minmax(360px, 1.08fr) minmax(0, 1fr);
  flex: 1;
  gap: 18px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  min-height: 0;
}
.tour-left {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}
.tour-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}
.guide-stage,
.tour-right {
  background: var(--glass);
  border-radius: 24px;
  box-shadow: var(--glass-shadow);
}
.guide-stage {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}
.stage-heading {
  position: absolute;
  z-index: 3;
  top: 16px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}
.stage-heading h2,
.spot-heading h2,
.chat-heading h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.4;
}
.speaking-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}
.speaking-state i {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  background: #94a3b8;
  border-radius: 50%;
}
.speaking-state.speaking {
  color: var(--champagne-text);
}
.speaking-state.speaking i {
  background: var(--champagne);
  box-shadow: 0 0 0 4px #eef2ff;
}
.avatar-space {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-space :deep(.digital-avatar) {
  padding: 0;
}
.avatar-space :deep(.viewport) {
  border: 0;
  background: transparent;
  border-radius: 0;
  position: relative;
}
.avatar-space :deep(.xingyun-guide) {
  position: relative;
}
.avatar-space :deep(.xingyun-frame) {
  min-height: 0;
}
.avatar-space :deep(.xingyun-guide:not(.half) .xingyun-canvas) {
  inset: 28px 10px 42px !important;
  width: calc(100% - 20px) !important;
  height: calc(100% - 70px) !important;
}
.avatar-space :deep(.xingyun-controls) {
  position: absolute;
  z-index: 3;
  bottom: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  font-size: 14px;
}
.avatar-space :deep(.xingyun-controls button) {
  min-height: 36px;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.93);
  border: 0;
  box-shadow: 0 3px 14px rgba(30, 41, 59, 0.08);
}
.avatar-space :deep(.xingyun-controls p) {
  margin: 0;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.93);
}
.avatar-space :deep(.playback-message) {
  margin: 4px 12px;
  font-size: 14px;
  line-height: 1.5;
}
.tour-right {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
.chat-heading {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 10px;
}
.quick-questions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 0 0 auto;
  padding: 0 16px 10px;
  border-bottom: 1px solid var(--line-soft);
}
.reading-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 16px 10px;flex:0 0 auto}
.reading-tools label{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--text-secondary)}
.reading-tools select,.reading-tools button{font:inherit;font-size:15px;border:1px solid #e3e8f1;background:#f8fafc;color:#334155;border-radius:10px;padding:6px 9px;cursor:pointer}
.reading-tools button[aria-pressed="true"]{background:#eeedff;color:#5145e8;border-color:#c7c3ff}
.reading-tools button:focus-visible,.reading-tools select:focus-visible{outline:2px solid #5145e8;outline-offset:3px}
.large-reading .msg-text{font-size:20px;line-height:1.8}
.large-reading .quick-questions button,.large-reading .reading-tools,.large-reading .msg-sources{font-size:18px}
.large-reading .reading-tools button,.large-reading .reading-tools select,.large-reading .reading-tools label{font-size:18px}
.large-reading :deep(.el-textarea__inner){font-size:20px}
.evidence-excerpts article{padding:12px 0;border-top:1px solid #e3e8f1}
.evidence-excerpts article p{white-space:pre-wrap}
.evidence-excerpts article span{overflow-wrap:anywhere;font-size:14px}
.service-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.service-actions a{font-size:15px;display:inline-block;padding:7px 10px;background:#eeedff;border-radius:10px;color:#5145e8;text-decoration:none}
.quick-questions button {
  min-height: 32px;
  padding: 4px 10px;
  border: 0;
  border-radius: 12px;
  background: #f1f5f9;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.quick-questions button:hover:not(:disabled) {
  background: var(--glass-raised);
  color: var(--champagne-text);
}
.quick-questions button:disabled {
  opacity: 0.45;
  cursor: default;
}
.chat-area {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  border-radius: 16px;
  text-align: center;
}
.welcome-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: var(--glass-raised);
  color: var(--champagne-text);
  font-size: 22px;
}
.chat-welcome h3 {
  margin: 4px 0 0;
  font-size: 18px;
}
.chat-welcome p {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-secondary);
}
.chat-message {
  display: flex;
  margin-bottom: 12px;
}
.user-msg {
  justify-content: flex-end;
}
.msg-content {
  max-width: 92%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 14px;
  min-width: 0;
}
.guide-msg .msg-content {
  background: #f8fafc;
  border-top-left-radius: 6px;
}
.user-msg .msg-content {
  background: var(--glass-raised);
  border-top-right-radius: 6px;
  color: #312e81;
}
.msg-name {
  color: var(--champagne-text);
  font-size: 14px;
  margin-bottom: 6px;
  font-weight: 700;
}
.msg-text {
  font-size: 15px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.msg-text :deep(strong) {
  font-weight: 700;
}
.pause-voice {
  margin-top: 14px;
}
.msg-sources {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}
.msg-sources summary {
  cursor: pointer;
  width: fit-content;
}
.msg-sources p {
  margin: 8px 0;
}
.msg-sources ul {
  margin: 8px 0 0;
  padding-left: 20px;
  overflow-wrap: anywhere;
}
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  color: var(--text-secondary);
  padding: 8px 0;
}
.chat-input-area {
  flex: 0 0 auto;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--line-soft);
}
.input-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.input-row :deep(.el-textarea) {
  min-width: 0;
  flex: 1;
}
.input-row :deep(.el-textarea__inner) {
  min-height: 56px !important;
  padding: 8px 12px;
  font-size: 15px;
  line-height: 1.5;
  font-family: inherit;
}
.composer-actions {
  display: flex;
  flex: 0 0 auto;
  flex-direction: row;
  justify-content: space-between;
  gap: 8px;
}
.recording-status {
  margin: 12px 0 0;
  color: var(--danger);
  font-size: 16px;
  line-height: 1.6;
}
.tour-dialog {
  max-width: calc(100vw - 32px);
}
:deep(.tour-dialog .el-dialog__title) {
  font-size: 24px;
}
:deep(.tour-dialog .el-button) {
  font-size: 16px;
  height: 44px;
}
.route-result h3 {
  margin: 0 0 16px;
  font-size: 23px;
  line-height: 1.5;
}
.route-summary,
.route-preferences {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 16px;
}
.route-spots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.route-spot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  font-size: 17px;
}
.spot-num {
  color: var(--champagne-text);
  font-size: 16px;
}
@media (max-width: 1180px) {
  .tour-interaction-container {
    padding: 12px 16px;
  }
  .tour-banner {
    gap: 12px;
    padding: 10px 14px;
    margin-bottom: 12px;
  }
  .banner-left {
    gap: 12px;
  }
  .banner-right {
    gap: 8px;
  }
  .banner-route-flow {
    gap: 8px;
    padding-left: 12px;
  }
  .flow-node {
    padding: 5px 10px;
  }
  .gps-nearby-hint {
    display: none;
  }
  .tour-main {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
    gap: 14px;
  }
  .msg-content {
    max-width: 98%;
  }
}
@media (max-width: 850px) {
  .tour-banner {
    flex-wrap: wrap;
  }
  .banner-left {
    flex-basis: 100%;
  }
  .banner-route-flow {
    flex: 1;
  }
  .banner-right {
    margin-left: auto;
  }
  .chat-heading,
  .chat-area {
    padding-left: 12px;
    padding-right: 12px;
  }
  .quick-questions {
    padding-left: 12px;
    padding-right: 12px;
    gap: 6px;
  }
  .quick-questions button {
    padding: 4px 8px;
  }
  .input-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  .input-row :deep(.el-textarea) {
    flex-basis: 100%;
  }
  .composer-actions {
    margin-left: auto;
  }
  .chat-welcome {
    padding: 16px 8px;
  }
}
@media (max-width: 600px) {
  .tour-interaction-container {
    padding: 8px;
  }
  .banner-left {
    flex-wrap: wrap;
    gap: 8px;
  }
  .banner-route-flow {
    flex-basis: 100%;
    border-left: 0;
    padding-left: 0;
  }
  .banner-right {
    position: absolute;
    top: 18px;
    right: 20px;
  }
  .banner-right :deep(.el-button) {
    height: 32px;
    padding: 0 8px;
    font-size: 14px;
  }
  .tour-main {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 8px;
  }
  .guide-stage,
  .tour-right {
    border-radius: 16px;
  }
  .stage-heading {
    top: 12px;
    left: 12px;
    right: 12px;
    flex-wrap: wrap;
    gap: 4px;
  }
  .stage-heading h2,
  .chat-heading h2 {
    font-size: 16px;
  }
  .speaking-state {
    font-size: 14px;
  }
  .chat-heading > span {
    display: none;
  }
  .chat-input-area {
    padding: 8px;
  }
  .composer-actions {
    gap: 6px;
  }
  .tour-interaction-container :deep(.el-button) {
    padding: 0 8px;
    font-size: 14px;
  }
  .quick-questions {
    max-height: 80px;
    overflow-y: auto;
  }
  .chat-welcome h3 {
    font-size: 16px;
  }
  .chat-welcome p {
    font-size: 14px;
  }
  .msg-content {
    padding: 8px;
  }
  .route-spots {
    grid-template-columns: 1fr;
  }
}
@media (max-height: 600px) {
  .tour-interaction-container {
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .tour-banner {
    padding-top: 6px;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .quick-questions {
    max-height: 42px;
    overflow-y: auto;
  }
  .chat-input-area {
    padding-top: 8px;
    padding-bottom: 8px;
  }
}
@media (max-width: 767px) {
  .tour-interaction-container{padding:6px;height:100dvh}
  .tour-banner{display:grid;grid-template-columns:1fr;padding:8px 10px;gap:7px;margin-bottom:7px;border-radius:18px}
  .banner-left{display:flex;flex-wrap:nowrap;gap:8px;width:100%;min-width:0}
  .banner-title :deep(.brand-logo-wordmark),.banner-title :deep(.brand-logo-english){display:none}
  .banner-route-flow{flex:1;border:0;padding:0;gap:5px}
  .flow-node{padding:3px 7px;gap:2px}.flow-node strong{font-size:14px}.flow-label{font-size:12px}
  .banner-right{position:static;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:6px;margin:0}
  .banner-right :deep(.el-button){height:28px;padding:0 8px;margin:0;font-size:13px}
  .banner-right :deep(.language-switch button){font-size:12px;padding:4px 8px}
  .tour-main{grid-template-columns:minmax(0,1fr);grid-template-rows:clamp(170px,28dvh,280px) minmax(0,1fr);gap:7px}
  .tour-left,.tour-side{min-height:0}.guide-stage{height:100%}
  .stage-heading{top:10px;left:12px;right:12px;flex-wrap:nowrap;align-items:flex-start}
  .stage-heading h2{font-size:16px}.era-stage-label,.speaking-state{font-size:12px}
  .chat-heading{padding:9px 12px 5px;gap:8px}.chat-heading h2{font-size:16px}
  .chat-heading-actions{gap:6px;flex-wrap:nowrap}.chat-heading-actions>span{display:none}
  .persona-select{font-size:13px;max-width:210px;padding:5px 8px}
  .reading-tools{padding:3px 10px;flex-wrap:nowrap;overflow-x:auto;flex-shrink:0;gap:6px;white-space:nowrap}
  .reading-tools label,.reading-tools select,.reading-tools button{font-size:12px}
  .quick-questions{padding:6px 10px;flex-wrap:nowrap;overflow-x:auto;max-height:none;flex-shrink:0}
  .quick-questions button{white-space:nowrap;font-size:13px;padding:5px 8px}
  .era-notice{font-size:12px;padding:0 12px 4px}
  .chat-area{padding:6px 10px;min-height:40px}
  .chat-welcome{min-height:0;padding:10px}.chat-welcome h3{margin:5px 0;font-size:15px}.chat-welcome p{font-size:13px;margin:0}.chat-welcome-icon{display:none}
  .msg-text{font-size:14px;line-height:1.65}.msg-content{padding:9px 10px}
  .chat-input-area{padding:7px 10px}.input-row{flex-wrap:nowrap;align-items:flex-end;gap:6px}
  .input-row :deep(.el-textarea){flex:1;min-width:0}.input-row :deep(.el-textarea__inner){font-size:14px;padding:8px;min-height:44px!important}
  .composer-actions{gap:5px;margin:0;flex-wrap:wrap;max-width:128px}
  .composer-actions :deep(.el-button){height:32px;padding:0 7px;margin:0;font-size:13px}
}
@media (max-width:767px) and (max-height:650px){.tour-main{grid-template-rows:145px minmax(0,1fr)}.reading-tools{max-height:28px}.chat-welcome p{display:none}}
@media (prefers-reduced-motion: reduce) {
  *,
  :deep(*) {
    transition: none !important;
    animation: none !important;
  }
}
</style>
