<template>
  <main class="tour-interaction-container">
    <header class="tour-banner">
      <div class="banner-left">
        <div class="banner-mark">AI</div>
        <div class="banner-copy">
          <span>SUMMER PALACE · INTELLIGENT TOUR</span>
          <h1 class="banner-title">智游灵境</h1>
        </div>
        <span class="banner-spot" v-if="viewingSpot"><el-icon><Location /></el-icon>{{ viewingSpot.spot_name }}</span>
      </div>
      <div class="banner-right">
        <!-- GPS 状态指示器 -->
        <el-tooltip :content="gpsEnabled ? `GPS已开启 | 精度${gps.accuracy.value}米 | 附近${gps.nearbySpots.value.length}个景点` : '点击开启GPS自动播报'" placement="bottom">
          <el-button :type="gpsEnabled ? 'success' : 'info'" plain size="small" @click="toggleGps" class="gps-btn">
            <el-icon><Location /></el-icon>
            {{ gpsEnabled ? 'GPS ON' : 'GPS' }}
          </el-button>
        </el-tooltip>
        <!-- 附近景点提示 -->
        <span v-if="gpsEnabled && closestSpot" class="gps-nearby-hint">
          <el-icon><Location /></el-icon>
          {{ closestSpot.within_range ? `已到达「${closestSpot.spot_name}」` : `距「${closestSpot.spot_name}」${closestSpot.distance}米` }}
        </span>
        <el-button plain :icon="Compass" @click="showPreferenceDialog = true">偏好设置</el-button>
        <el-button type="danger" plain @click="handleEndTour">结束导览</el-button>
      </div>
    </header>

    <div class="tour-main">
      <section class="tour-left">
        <div class="guide-stage">
          <div class="stage-label">
            <small>DIGITAL GUIDE</small>
            <strong>{{ guideInfo?.name || '数字导游' }}</strong>
            <span>{{ guideInfo?.character || '专业、亲切的 AI 导游' }}</span>
          </div>
          <DigitalAvatarPlayer
            ref="live2dRef"
            :tour-id="Number(props.sessionId)"
            :audioElement="ttsAudio"
            :width="360"
            :height="520"
            :frame-padding="1.28"
            :model-path="guideModelPath"
            :speaking="isSpeaking"
            :guide-id="guideInfo?.guide_id"
            :poster-image="guideInfo?.poster_image"
            :source-video="guideInfo?.base_mp4_path"
            :busy="loadingResponse"
            @playing="isSpeaking = $event"
          />
          <span class="speaking-state" :class="{ active: isSpeaking || loadingResponse }"><i></i>{{ isSpeaking ? '正在播放讲解语音' : loadingResponse ? generationStage : '可开始文字或语音导览' }}</span>
        </div>
        <audio ref="ttsAudio" @play="onAudioPlay" @ended="onAudioEnded" @pause="onAudioEnded" @timeupdate="onAudioTimeUpdate" />
        <div class="audio-bar" v-if="audioDuration > 0" @click="seekAudio">
          <div class="audio-bar-track">
            <div class="audio-bar-fill" :style="{ width: audioProgress + '%' }"></div>
          </div>
        </div>

        <nav v-if="routeSpots.length" class="route-rail" aria-label="导览路线进度">
          <button
            v-for="(spot, index) in routeSpots"
            :key="spot.spot_id"
            type="button"
            :class="{ active: index === spotIndex, done: index < spotIndex }"
            @click="spotIndex = index"
          >
            <span>{{ index + 1 }}</span><strong>{{ spot.spot_name }}</strong>
          </button>
        </nav>

        <!-- 景点滑动浏览器 -->
        <article class="spot-card" v-if="routeSpots.length > 0">
          <!-- 左箭头 -->
          <button class="spot-nav spot-prev" @click="prevSpot" :disabled="routeSpots.length <= 1">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <!-- 景点内容 -->
          <div class="spot-slide">
            <div v-if="routeSpots[spotIndex].image_path || routeSpots[spotIndex].route_cover_image" class="spot-image scenic-diagonal"><img :src="routeSpots[spotIndex].image_path || routeSpots[spotIndex].route_cover_image" alt="景点照片" /><img class="diagonal-blur" :src="routeSpots[spotIndex].image_path || routeSpots[spotIndex].route_cover_image" alt="" /><i></i><small v-if="!routeSpots[spotIndex].image_path">路线示意图</small></div>
            <div class="spot-image fallback" v-else><el-icon><Location /></el-icon></div>
            <div class="spot-info">
              <div class="spot-meta">
                <span>{{ spotIndex + 1 }} / {{ routeSpots.length }}</span>
                <el-tag size="small" effect="plain">{{ routeSpots[spotIndex].category || '景点' }}</el-tag>
              </div>
              <h3>{{ routeSpots[spotIndex].spot_name }}</h3>
              <p class="spot-desc">{{ routeSpots[spotIndex].description }}</p>
            </div>
          </div>
          <!-- 右箭头 -->
          <button class="spot-nav spot-next" @click="nextSpot" :disabled="routeSpots.length <= 1">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </article>
        <article class="spot-card spot-empty" v-else>
          <div class="spot-image fallback"><el-icon><Location /></el-icon></div>
          <div class="spot-info"><h3>暂无景点信息</h3><p class="spot-desc">等待路线加载...</p></div>
        </article>
      </section>

      <section class="tour-right">
        <div class="pipeline-bar">
          <span><b>01</b>理解游客问题</span><i></i><span><b>02</b>检索景区知识</span><i></i><span><b>03</b>生成个性化讲解</span>
        </div>
        <div class="quick-questions">
          <span>推荐问题</span>
          <el-tag v-for="q in quickQuestions" :key="q" class="quick-tag" @click="handleQuickQuestion(q)" effect="plain">{{ q }}</el-tag>
        </div>
        <div class="chat-area">
          <section v-if="conversations.length === 0" class="chat-welcome">
            <div class="welcome-kicker"><i></i>导览会话已建立</div>
            <h3>你好，我是{{ guideInfo?.name || '小颐' }}</h3>
            <p>我已载入本次路线、当前景点档案与颐和园专题知识库。你可以直接询问历史典故、建筑特色、拍摄机位或下一站安排。</p>
            <div class="welcome-context">
              <div><small>当前景点</small><strong>{{ viewingSpot?.spot_name || currentSpot?.spot_name || '路线起点' }}</strong></div>
              <div><small>路线进度</small><strong>{{ routeProgressText }}</strong></div>
              <div><small>知识引擎</small><strong>{{ aiServiceLabel }}</strong></div>
            </div>
            <div class="knowledge-sources"><span>颐和园总览</span><span>历史建筑</span><span>湖山景观</span><span>游览路线</span></div>
          </section>
          <div v-for="(msg, idx) in conversations" :key="idx" class="chat-message" :class="msg.role === 'guide' ? 'guide-msg' : 'user-msg'">
            <div class="msg-content">
              <div class="msg-name">{{ msg.role === 'guide' ? (guideInfo?.name || '数字导游') : '访客' }}</div>
              <div class="msg-text" v-html="formatMessage(msg.message, msg.role)"></div>
              <el-button
                v-if="msg.role === 'guide'"
                size="small"
                plain
                :disabled="!isSpeaking || idx !== conversations.map(item => item.role).lastIndexOf('guide')"
                @click="pauseAnswerVoice"
              >暂停语音</el-button>
              <div v-if="msg.role === 'guide' && msg.aiMeta" class="msg-ai-evidence">
                <span class="ai-mode">{{ aiModeLabel(msg.aiMeta) }}</span>
                <span v-if="msg.aiMeta.spotContext">上下文：{{ msg.aiMeta.spotContext }}</span>
                <span v-if="msg.aiMeta.ragApplied">知识检索 {{ msg.aiMeta.referenceCount || 0 }} 条</span>
                <span v-else-if="msg.aiMeta.answerMode !== 'local_knowledge'">景点档案上下文</span>
              </div>
              <div class="msg-time">{{ formatTime(msg.send_time) }}</div>
            </div>
          </div>
          <div v-if="loadingResponse" class="loading-indicator"><el-icon class="is-loading"><Loading /></el-icon><span>{{ generationStage }}</span></div>
        </div>
        <div class="chat-input-area">
          <div class="input-row">
            <el-button :type="isRecording ? 'danger' : 'default'" :icon="Microphone" :aria-label="isRecording ? '结束录音' : '开始录音'" :title="isRecording ? '再次点击结束录音' : '点击录音，录完再次点击'" circle @click="handleRecord" :loading="disableInput || recognizing" />
            <el-input v-model="inputValue" type="textarea" :rows="2" placeholder="输入想了解的景区内容" :disabled="disableInput" @keydown.enter.exact.prevent="handleSend" resize="none" />
            <el-button type="primary" :icon="Promotion" circle @click="handleSend" :loading="disableInput || recognizing" />
          </div>
          <div class="action-row">
            <span v-if="isRecording || recognizing">{{ isRecording ? '正在录音，再次点击麦克风结束（最长60秒）' : '正在识别录音，请稍候' }}</span>
            <span v-else><i></i>{{ aiService.checked ? (aiService.rag ? '景区知识检索可用；回答来源见消息标记' : '使用本地景点档案；回答来源见消息标记') : '正在查询知识服务状态' }}</span>
            <el-button v-if="!finalSpot" plain :icon="Location" @click="handleNextSpot" :disabled="disableInput">前往下一景点</el-button>
          </div>
        </div>
      </section>
    </div>

    <el-dialog v-model="showPreferenceDialog" title="设置游览偏好" width="520px">
      <div class="preference-options">
        <button v-for="pref in preferenceOptions" :key="pref.value" type="button" class="preference-card" :class="{ selected: selectedPreferences.includes(pref.value) }" @click="togglePreference(pref.value)">
          <el-icon class="pref-icon"><component :is="pref.icon" /></el-icon><span class="pref-label">{{ pref.label }}</span><span class="pref-desc">{{ pref.desc }}</span><el-icon class="selected-icon"><Check /></el-icon>
        </button>
      </div>
      <template #footer><el-button @click="showPreferenceDialog = false">取消</el-button><el-button type="primary" @click="applyPreferences" :loading="loadingRecommendation">生成推荐路线</el-button></template>
    </el-dialog>

    <el-dialog v-model="showWelcomeDialog" title="本次导览路线" width="600px">
      <div class="route-result" v-if="routeInfo">
        <h3>{{ routeInfo.name }}</h3>
        <div class="route-summary"><el-tag effect="plain">{{ themeLabel(routeInfo.theme) }}</el-tag><span><el-icon><Timer /></el-icon>预计 {{ routeInfo.estimated_time }} 分钟</span></div>
        <div v-if="visitorSpots.length > 0" class="route-block"><p>已选择景点</p><div class="route-spots"><div v-for="(spot, idx) in visitorSpots" :key="idx" class="route-spot-item"><span class="spot-num">{{ idx + 1 }}</span><span>{{ spot }}</span></div></div></div>
        <div v-if="visitorPrefs.length > 0" class="route-block"><p>游览偏好</p><el-tag v-for="pref in visitorPrefs" :key="pref" size="small" style="margin-right: 6px" effect="plain">{{ prefLabel(pref) }}</el-tag></div>
      </div>
      <template #footer><el-button type="primary" @click="showWelcomeDialog = false">开始导览</el-button></template>
    </el-dialog>

    <!-- PWA安装引导 -->
    <PwaInstallPrompt />
  </main>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, Camera, Check, Compass, Guide, Loading, Location, Microphone, OfficeBuilding, Promotion, Timer, User } from '@element-plus/icons-vue'
import DigitalAvatarPlayer from '@/components/DigitalAvatarPlayer.vue'
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue'
import { getTourLiveInfo, sendTourChatMessage, getRouteRecommendation, endTourSession } from '@/api/visitor'
import { useRecordedSpeech } from '@/composables/useRecordedSpeech'
import { useGeolocation } from '@/composables/useGeolocation'

const router = useRouter()
const props = defineProps<{ sessionId: string }>()

// ── GPS 位置追踪 ──
const gps = useGeolocation()
const closestSpot = computed(() => gps.closestSpot.value)
const gpsEnabled = ref(false)
const showGpsPanel = ref(false)

function toggleGps() {
  if (!gps.isSupported()) {
    ElMessage.warning('您的设备不支持GPS定位')
    return
  }
  if (gpsEnabled.value) {
    gps.stopTracking()
    gpsEnabled.value = false
    ElMessage.info('GPS追踪已关闭')
  } else {
    gps.startTracking(Number(props.sessionId), 8000)
    gpsEnabled.value = true
    ElMessage.success('GPS追踪已开启，接近景点时自动播报')
  }
}

// 监听GPS接近的景点
watch(() => gps.closestSpot.value, (spot) => {
  if (spot && spot.within_range && gpsEnabled.value && gps.autoSwitchEnabled.value) {
    // GPS检测到进入新景点范围，自动切换
    refreshSessionInfo()
  }
})

const conversations = ref<any[]>([])
const inputValue = ref('')
const disableInput = ref(false)
const loadingResponse = ref(false)
const generationStage = ref('正在理解问题')
const finalSpot = ref(false)
const currentSpot = ref<any>(null)
const guideInfo = ref<any>(null)
const guideModelPath = computed(() => {
  if (guideInfo.value?.live2d_model_path) return guideInfo.value.live2d_model_path
  return '/models/西装女.vrm'
})
const visitorDisplayName = ref('')
const routeInfo = ref<any>(null)
const ttsAudio = ref<HTMLAudioElement | null>(null)
const isSpeaking = ref(false)
const audioDuration = ref(0)
const audioProgress = ref(0)
const currentEmotion = ref('neutral')
const live2dRef = ref<InstanceType<typeof DigitalAvatarPlayer> | null>(null)
const { recording: isRecording, recognizing, start: startRecognition, stop: stopRecognition } = useRecordedSpeech(text => { inputValue.value = text; ElMessage.success('识别完成') }, message => ElMessage.error(message))
let emotionResetTimer: ReturnType<typeof setTimeout> | null = null
let generationTimer: ReturnType<typeof setInterval> | null = null
const showPreferenceDialog = ref(false)
const showWelcomeDialog = ref(false)
const selectedPreferences = ref<string[]>([])
const visitorSpots = ref<string[]>([])
const visitorPrefs = ref<string[]>([])
const loadingRecommendation = ref(false)
// 路线全部景点（含图片/描述等完整信息）
const routeSpots = ref<any[]>([])
const spotIndex = ref(0)
// 路线窗口只弹一次
const welcomeShown = ref(false)
const aiService = ref({ checked: false, llm: false, rag: false, model: 'deepseek-flash' })
const viewingSpot = computed(() => routeSpots.value[spotIndex.value] || currentSpot.value)
const routeProgressText = computed(() => routeSpots.value.length ? `${spotIndex.value + 1} / ${routeSpots.value.length}` : '准备中')
const aiServiceReady = computed(() => aiService.value.llm && aiService.value.rag)
const aiServiceLabel = computed(() => !aiService.value.checked ? '正在查询服务状态' : aiServiceReady.value ? '大模型已配置 · 知识检索可用' : '本地景区知识')

/** 情感标签映射: 后端 sentment label → Live2D emotion */
const SENTIMENT_TO_EMOTION: Record<string, string> = {
  positive: 'happy',
  negative: 'sad',
  neutral: 'neutral',
}

const preferenceOptions = [
  { value: 'history', icon: OfficeBuilding, label: '历史文化', desc: '优先了解典故与历史脉络' },
  { value: 'nature', icon: Compass, label: '自然风光', desc: '侧重山水景观与生态故事' },
  { value: 'photography', icon: Camera, label: '影像记录', desc: '推荐构图视角与拍摄点位' },
  { value: 'family', icon: User, label: '亲子游览', desc: '提供更轻松易懂的讲解' },
  { value: 'comprehensive', icon: Guide, label: '综合游览', desc: '均衡介绍特色与服务信息' },
]
const quickQuestions = ['这里有什么历史故事？', '最佳拍照点在哪里？', '附近有哪些服务设施？', '请介绍景点特色', '下一站推荐去哪里？']

function togglePreference(value: string) { const index = selectedPreferences.value.indexOf(value); index >= 0 ? selectedPreferences.value.splice(index, 1) : selectedPreferences.value.push(value) }

async function loadAiServiceStatus() {
  try {
    const response = await fetch('/system/status')
    const status = await response.json()
    aiService.value = {
      checked: true,
      llm: Boolean(status?.llm?.key_configured),
      rag: status?.rag?.status === 'available',
      model: status?.llm?.model || 'deepseek-flash',
    }
  } catch {
    aiService.value.checked = true
  }
}

function prevSpot() {
  if (routeSpots.value.length > 1) {
    spotIndex.value = (spotIndex.value - 1 + routeSpots.value.length) % routeSpots.value.length
  }
}
function nextSpot() {
  if (routeSpots.value.length > 1) {
    spotIndex.value = (spotIndex.value + 1) % routeSpots.value.length
  }
}

async function applyPreferences() {
  if (!selectedPreferences.value.length) { ElMessage.warning('请至少选择一个偏好'); return }
  loadingRecommendation.value = true
  try {
    const response = await getRouteRecommendation(selectedPreferences.value)
    if (response?.data?.success) { showPreferenceDialog.value = false; ElMessage.success('已更新推荐偏好') }
  } catch { ElMessage.error('获取推荐失败') }
  finally { loadingRecommendation.value = false }
}

async function refreshSessionInfo() {
  try {
    const response = await getTourLiveInfo(Number(props.sessionId))
    if (response?.data?.success) {
      const data = response.data.data
      conversations.value = data.conversation || []
      currentSpot.value = data.current_spot_info
      guideInfo.value = data.guide_info
      visitorDisplayName.value = (data.name || '').replace(/的导览$/, '').trim()
      routeInfo.value = data.route_info
      finalSpot.value = data.final_spot
      try {
        const prefs = JSON.parse(data.visitor_preferences || '{}')
        visitorPrefs.value = prefs.preferences || prefs.prefs || []
        if (prefs.spot_ids?.length > 0) {
          const { getVisitorSpotList } = await import('@/api/visitor')
          const spotResponse = await getVisitorSpotList().catch(() => null)
          const allSpots: any[] = (spotResponse as any)?.data?.data?.spot_list || (spotResponse as any)?.data?.spot_list || []
          visitorSpots.value = prefs.spot_ids.map((id: number) => allSpots.find((spot: any) => spot.spot_id === id)?.spot_name || `景点 ${id}`)
          // 存储完整景点信息用于滑动浏览
          routeSpots.value = prefs.spot_ids
            .map((id: number) => allSpots.find((spot: any) => spot.spot_id === id))
            .filter(Boolean)
          // 定位当前景点索引
          if (data.current_spot_info) {
            const curId = data.current_spot_info.spot_id
            const idx = routeSpots.value.findIndex((s: any) => s.spot_id === curId)
            if (idx >= 0) spotIndex.value = idx
          }
        }
      } catch { /* ignore preference parsing failure */ }
      // 路线介绍窗口只在进入时弹一次
      if (data.route_info?.name && !welcomeShown.value) {
        showWelcomeDialog.value = true
        welcomeShown.value = true
      }
    }
  } catch (error) { console.error(error) }
}

// ── 音频事件处理 ──
function pauseAnswerVoice() {
  ttsAudio.value?.pause()
  live2dRef.value?.stop()
  isSpeaking.value = false
}

function onAudioPlay() {
  isSpeaking.value = true
  const a = ttsAudio.value
  if (a) audioDuration.value = a.duration || 0
}

function onAudioEnded() {
  isSpeaking.value = false
  audioProgress.value = 0
  audioDuration.value = 0
}

function onAudioTimeUpdate() {
  const a = ttsAudio.value
  if (a && a.duration) {
    audioProgress.value = (a.currentTime / a.duration) * 100
  }
}

function seekAudio(e: MouseEvent) {
  const a = ttsAudio.value
  if (!a || !a.duration) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  a.currentTime = pct * a.duration
}

// ── 核心：发送消息 ──
function startGenerationStages() {
  generationStage.value = '正在等待后端讲解与语音合成结果'
}

function stopGenerationStages() {
  if (generationTimer) clearInterval(generationTimer)
  generationTimer = null
}

function aiModeLabel(meta: any) {
  if (meta?.answerMode === 'llm_rag') return `${meta.model || '大模型'} · RAG 增强`
  if (meta?.answerMode === 'llm_context') return `${meta.model || '大模型'} · 上下文生成`
  return '本地景区知识 · 兜底回答'
}

async function handleSend() {
  const message = inputValue.value.trim()
  if (!message || disableInput.value) return
  // 将卡片中正在查看的景点作为结构化上下文传给后端，避免问答仍绑定会话起点。
  const viewingSpot = routeSpots.value[spotIndex.value]
  const nextViewingSpot = routeSpots.value[spotIndex.value + 1]
  conversations.value.push({ role: 'user', userName: '游客', message, send_time: new Date().toISOString() })
  inputValue.value = ''; disableInput.value = true; loadingResponse.value = true; startGenerationStages()
  await nextTick(); const chat = document.querySelector('.chat-area'); if (chat) chat.scrollTop = chat.scrollHeight
  try {
    live2dRef.value?.stop()
    const response = await sendTourChatMessage(
      Number(props.sessionId),
      message,
      viewingSpot?.spot_id || currentSpot.value?.spot_id,
      nextViewingSpot?.spot_id || 0,
      (await live2dRef.value?.getMode()) || 'audio',
    )
    const body = response.data
    if (body && body.success) {
      // ── TTS 音频播放 ──
      const ttsUrl = body.data?.ttsAudioUrl
      await live2dRef.value?.acceptPerformance(body.data?.avatarPerformance)
      const videoPending = live2dRef.value?.speak(body.data?.message) || live2dRef.value?.acceptJob(body.data?.avatarJob)
      if (!videoPending && ttsUrl && ttsAudio.value) {
        // 停止当前播放，准备新音频
        ttsAudio.value.pause()
        ttsAudio.value.currentTime = 0

        // 保留 /api/v1 前缀：FastAPI 的静态资源挂载位于该 root_path 下，
        // 同时去掉固定 localhost 主机名以便手机通过局域网地址访问。
        const path = ttsUrl.replace(/^https?:\/\/[^/]+/, '')
        ttsAudio.value.src = path

        // Chrome 自动播放策略：play() 返回 Promise
        const playPromise = ttsAudio.value.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // 播放成功 — onAudioPlay 事件会自动触发 isSpeaking
              console.log('[TourInteraction] TTS 播放开始')
            })
            .catch((e: any) => {
              console.warn('[TourInteraction] TTS 自动播放被阻止:', e.message)
              // 用户可点击音频控件手动播放
            })
        }
      }

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

      const aiMeta = body.data?.aiMeta
      if (aiMeta?.answerMode === 'llm_rag') {
        aiService.value.llm = true
        aiService.value.rag = true
        aiService.value.model = aiMeta.model || aiService.value.model
      }
      await refreshSessionInfo()
      // 历史消息来自数据库；将本次请求的可验证 AI 执行信息补回最新回复。
      const latestGuideMessage = [...conversations.value].reverse().find((item: any) => item.role === 'guide')
      if (latestGuideMessage && aiMeta) latestGuideMessage.aiMeta = aiMeta
    } else {
      console.error('Chat API fail:', body?.message, body)
      ElMessage.error(body?.message || '回复失败')
    }
  } catch (e: any) {
    console.error('Send error:', e.message, e)
    ElMessage.error('发送失败: ' + (e.message || '网络错误'))
  }
  finally { stopGenerationStages(); disableInput.value = false; loadingResponse.value = false }
}

async function handleQuickQuestion(question: string) { inputValue.value = question; await handleSend() }
async function handleNextSpot() {
  try {
    const sid = Number(props.sessionId)
    console.log('[handleNextSpot] fetch 开始, sessionId:', sid)
    const res = await fetch(`/tour-session/next-spot/${sid}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    console.log('[handleNextSpot] fetch 结果:', data)
    if (data.success) {
      ElMessage.success('已切换景点')
      await refreshSessionInfo()
    } else {
      ElMessage.error(data.message || '切换失败')
    }
  } catch (e: any) {
    console.error('[handleNextSpot] 异常:', e)
    ElMessage.error('切换失败: ' + (e.message || e.toString()))
  }
}
async function handleEndTour() { try { await ElMessageBox.confirm('确定要结束本次导览吗？', '结束导览', { confirmButtonText: '结束', cancelButtonText: '取消' }); await endTourSession(Number(props.sessionId)); ElMessage.success('导览已结束'); router.push('/visitor/home') } catch { /* user cancelled */ } }
function handleRecord() { isRecording.value ? stopRecognition() : startRecognition() }
function formatMessage(message: string, role = '') {
  let content = message || ''
  if (role === 'guide') {
    const names = [visitorDisplayName.value, guideInfo.value?.name].filter(Boolean)
    for (const name of names) {
      const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      content = content.replace(
        new RegExp(`(^|\\n)\\s*${escaped}(?:先生|女士|老师|小朋友)?\\s*[，,：:、]\\s*`, 'gm'),
        '$1',
      )
    }
  }
  return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
}
function formatTime(time: string) { if (!time) return ''; try { return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
function prefLabel(key: string): string {
  const map: Record<string, string> = { history: '历史文化', nature: '自然风光', photography: '拍照打卡', family: '亲子家庭', comprehensive: '综合游览' }
  return map[key] || key
}
function themeLabel(key: string): string {
  const map: Record<string, string> = { comprehensive: '综合游览', historical: '历史文化', natural: '自然风光', cultural: '文化古迹', modern: '现代景观' }
  return map[key] || key
}
onMounted(() => {
  refreshSessionInfo()
  loadAiServiceStatus()
})
onUnmounted(() => {
  if (gpsEnabled.value) gps.stopTracking()
  stopGenerationStages()
  if (emotionResetTimer) clearTimeout(emotionResetTimer)
})
</script>

<style scoped lang="scss">
.tour-interaction-container { display: flex; height: 100vh; flex-direction: column; padding: 0 28px 22px; color: #172033; background: #f2f5fa; overflow: hidden; }
.tour-banner { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 1580px; min-height: 78px; margin: 0 auto 14px; padding: 0 22px; border: 1px solid #dfe5ef; border-top: 0; border-radius: 0 0 18px 18px; background: rgba(255,255,255,.94); box-shadow: 0 12px 30px rgba(28,39,66,.06); }
.banner-left, .banner-right { display: flex; align-items: center; gap: 12px; }
.banner-mark { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 12px; color: #fff; background: #3b5bff; box-shadow: 0 8px 18px rgba(59,91,255,.2); font-size: 12px; font-weight: 850; letter-spacing: .08em; }
.banner-copy { display: flex; flex-direction: column; gap: 2px; } .banner-copy > span { color: #8791a6; font-size: 8px; font-weight: 800; letter-spacing: .16em; }
.banner-title { margin: 0; color: #172033; font-size: 19px; font-weight: 850; letter-spacing: -.02em; }
.banner-spot { display: flex !important; align-items: center; gap: 5px; margin-left: 8px; padding: 7px 10px; border: 1px solid #e1e6ef; border-radius: 8px; color: #59647b !important; background: #f8f9fc; font-size: 11px !important; font-weight: 700 !important; letter-spacing: 0 !important; }
.tour-main { display: grid; grid-template-columns: minmax(480px, .94fr) minmax(560px, 1.06fr); flex: 1; gap: 16px; width: 100%; max-width: 1580px; margin: 0 auto; min-height: 0; }
.tour-left { display: flex; min-height: 0; flex-direction: column; gap: 10px; }
.guide-stage, .spot-card, .route-rail, .tour-right { border: 1px solid #dfe5ef; border-radius: 16px; background: #fff; box-shadow: 0 12px 28px rgba(28,39,66,.055); }
.guide-stage { position: relative; display: flex; min-height: 360px; flex: 1; align-items: center; justify-content: center; overflow: hidden; background: radial-gradient(circle at 50% 44%, #fff 0, #edf4f8 72%); }
.guide-stage::before { content: ''; position: absolute; inset: 0; opacity: .75; background-image: linear-gradient(rgba(52,84,108,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(52,84,108,.045) 1px, transparent 1px); background-size: 28px 28px; }
.guide-stage::after { content: ''; position: absolute; right: -70px; bottom: -95px; width: 330px; height: 330px; border: 1px solid rgba(59,91,255,.12); border-radius: 50%; box-shadow: 0 0 0 54px rgba(59,91,255,.025), 0 0 0 108px rgba(59,91,255,.018); }
.guide-stage::before, .guide-stage::after { pointer-events: none; }
.guide-stage :deep(.digital-avatar) { position: relative; z-index: 2; }
.stage-label { position: absolute; z-index: 3; top: 20px; left: 22px; display: flex; max-width: 220px; flex-direction: column; gap: 3px; } .stage-label small { color: #3b5bff; font-size: 8px; font-weight: 850; letter-spacing: .16em; } .stage-label strong { color: #172033; font-size: 18px; font-weight: 850; } .stage-label span { overflow: hidden; color: #7b8599; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.speaking-state { position: absolute; z-index: 3; right: 18px; bottom: 16px; display: flex; align-items: center; gap: 7px; padding: 7px 10px; border: 1px solid #e1e6ef; border-radius: 9px; color: #657086; background: rgba(255,255,255,.92); font-size: 10px; font-weight: 700; backdrop-filter: blur(8px); } .speaking-state i { width: 6px; height: 6px; border-radius: 50%; background: #a6b5bc; } .speaking-state.active i { background: #19a974; box-shadow: 0 0 0 4px rgba(25,169,116,.12); }
.audio-bar { width: 100%; height: 5px; cursor: pointer; margin: -3px 0 0; } .audio-bar-track { position: relative; top: 2px; width: 100%; height: 2px; border-radius: 2px; background: #dde3ec; } .audio-bar-fill { min-width: 2px; height: 100%; border-radius: 2px; background: #3b5bff; transition: width .1s linear; }
.route-rail { display: flex; min-height: 58px; align-items: center; padding: 9px 12px; overflow-x: auto; } .route-rail button { position: relative; display: flex; min-width: 98px; flex: 1; align-items: center; gap: 7px; border: 0; color: #98a1b3; cursor: pointer; background: transparent; } .route-rail button:not(:last-child)::after { content: ''; position: absolute; top: 50%; right: 4px; width: 18px; height: 1px; background: #dce2eb; } .route-rail button > span { display: grid; width: 24px; height: 24px; flex: 0 0 24px; place-items: center; border: 1px solid #dce2eb; border-radius: 50%; background: #fff; font-size: 9px; font-weight: 800; } .route-rail button strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; } .route-rail button.active { color: #2948c8; } .route-rail button.active > span { border-color: #3b5bff; color: #fff; background: #3b5bff; box-shadow: 0 0 0 4px rgba(59,91,255,.09); } .route-rail button.done > span { border-color: #a9dfcb; color: #087653; background: #eaf8f2; }
.spot-card { display: flex; min-height: 102px; align-items: center; gap: 10px; padding: 10px 14px; } .spot-card.spot-empty { justify-content: flex-start; gap: 13px; padding: 14px; }
.spot-nav { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; border: 1px solid #dfe5ef; border-radius: 50%; color: #778196; cursor: pointer; background: #fff; transition: all .15s; } .spot-nav:hover:not(:disabled) { border-color: #3b5bff; color: #3b5bff; background: #f3f5ff; } .spot-nav:disabled { opacity: .25; cursor: default; }
.spot-slide { display: flex; min-width: 0; flex: 1; align-items: center; gap: 13px; }
.spot-image { width: 104px; height: 76px; flex: 0 0 104px; overflow: hidden; border-radius: 11px; object-fit: cover; } .spot-image.fallback { display: grid; place-items: center; color: #3b5bff; background: #f0f3ff; font-size: 24px; } .spot-info { min-width: 0; } .spot-meta { display: flex; align-items: center; gap: 8px; } .spot-meta > span { color: #3b5bff; font-size: 9px; font-weight: 850; letter-spacing: .12em; } .spot-info h3 { margin: 4px 0; overflow: hidden; color: #172033; font-size: 16px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; } .spot-desc { display: -webkit-box; margin: 0; overflow: hidden; color: #687389; font-size: 11px; line-height: 1.65; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.tour-right { display: flex; min-height: 0; flex-direction: column; overflow: hidden; }
.pipeline-bar { display: flex; align-items: center; gap: 8px; padding: 9px 20px; border-bottom: 1px solid #e9edf3; color: #727d92; background: #f8f9fc; } .pipeline-bar span { display: flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 700; white-space: nowrap; } .pipeline-bar b { color: #3b5bff; font-size: 8px; } .pipeline-bar > i { width: 18px; height: 1px; background: #cfd6e2; }
.quick-questions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px 20px; border-bottom: 1px solid #e9edf3; } .quick-questions > span { margin-right: 2px; color: #98a1b2; font-size: 10px; font-weight: 750; } .quick-tag { cursor: pointer; color: #677289; transition: all .16s ease; &:hover { border-color: #aebafb; color: #2948c8; background: #f3f5ff; } }
.chat-area { flex: 1; min-height: 260px; overflow-y: auto; padding: 18px 20px; background: #f7f9fc; }
.chat-welcome { max-width: 650px; margin: 8px auto 0; padding: 24px; border: 1px solid #dfe5ef; border-radius: 16px; background: #fff; } .welcome-kicker { display: flex; align-items: center; gap: 7px; color: #087653; font-size: 9px; font-weight: 800; letter-spacing: .08em; } .welcome-kicker i { width: 7px; height: 7px; border-radius: 50%; background: #19a974; box-shadow: 0 0 0 5px rgba(25,169,116,.09); } .chat-welcome h3 { margin: 13px 0 8px; color: #172033; font-size: 22px; font-weight: 850; letter-spacing: -.03em; } .chat-welcome > p { margin: 0; color: #667187; font-size: 12px; line-height: 1.8; }
.welcome-context { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 18px; overflow: hidden; border: 1px solid #e3e7ef; border-radius: 11px; background: #e3e7ef; } .welcome-context > div { min-width: 0; padding: 12px; background: #f8f9fc; } .welcome-context small { display: block; margin-bottom: 4px; color: #9aa3b4; font-size: 8px; } .welcome-context strong { display: block; overflow: hidden; color: #303a50; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.knowledge-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; } .knowledge-sources span { padding: 5px 8px; border-radius: 6px; color: #53617c; background: #eef1f8; font-size: 9px; font-weight: 700; }
.chat-message { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 16px; &.guide-msg { justify-content: flex-start; .msg-content { border-radius: 4px 13px 13px 13px; background: #fff; } } &.user-msg { justify-content: flex-end; .msg-content { order: -1; border-color: #3b5bff; border-radius: 13px 4px 13px 13px; color: #fff; background: #3b5bff; .msg-name,.msg-time,.msg-text { color: inherit; } .msg-name { opacity: .74; } .msg-time { opacity: .62; } } } } .msg-content { max-width: 82%; padding: 11px 13px; border: 1px solid #dfe5ef; box-shadow: 0 5px 14px rgba(28,39,66,.04); } .msg-name { color: #7c879b; font-size: 9px; font-weight: 750; } .msg-text { margin-top: 4px; color: #253047; font-size: 12px; line-height: 1.75; } .msg-time { margin-top: 5px; color: #a0a8b6; font-size: 9px; text-align: right; }
.msg-ai-evidence { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; } .msg-ai-evidence span { padding: 4px 7px; border: 1px solid #dbe1ec; border-radius: 999px; color: #5e6a81; background: #f7f8fb; font-size: 8px; font-weight: 750; } .msg-ai-evidence .ai-mode { border-color: #b9e4d4; color: #087653; background: #eaf8f2; }
.loading-indicator { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 11px; color: #667187; font-size: 11px; }
.chat-input-area { padding: 12px 16px 13px; border-top: 1px solid #e1e6ef; background: #fff; } .input-row { display: flex; align-items: flex-end; gap: 9px; } .input-row :deep(.el-textarea__inner) { min-height: 58px !important; border: 0; border-radius: 10px; background: #f7f8fb; box-shadow: 0 0 0 1px #dfe5ef inset; } .action-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; } .action-row > span { display: flex; align-items: center; gap: 6px; color: #8993a6; font-size: 9px; } .action-row > span i { width: 6px; height: 6px; border-radius: 50%; background: #19a974; }
.preference-options { display: flex; flex-direction: column; gap: 8px; } .preference-card { display: flex; align-items: center; width: 100%; gap: 10px; padding: 13px; border: 1px solid var(--line-soft); border-radius: 9px; color: var(--ink-900); cursor: pointer; text-align: left; background: #fff; transition: all .16s ease; &:hover { border-color: #a6cbd4; } &.selected { border-color: var(--brand-600); background: var(--brand-50); .selected-icon { opacity: 1; } } } .pref-icon { display: grid; width: 30px; height: 30px; flex: 0 0 30px; place-items: center; border-radius: 7px; color: var(--brand-700); background: var(--brand-100); } .pref-label { width: 75px; font-size: 13px; font-weight: 800; } .pref-desc { color: var(--ink-500); font-size: 12px; } .selected-icon { margin-left: auto; opacity: 0; color: var(--brand-600); }
.route-result h3 { margin: 6px 0 12px; color: var(--ink-900); font-size: 20px; } .route-summary { display: flex; align-items: center; gap: 10px; padding-bottom: 15px; border-bottom: 1px solid var(--line-soft); .el-tag { color: var(--brand-700); } span { display: flex; align-items: center; gap: 5px; color: var(--ink-500); font-size: 12px; } } .route-block { margin-top: 16px; > p { margin: 0 0 8px; color: var(--ink-700); font-size: 12px; font-weight: 750; } } .route-spots { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; } .route-spot-item { display: flex; align-items: center; gap: 7px; padding: 8px; border: 1px solid var(--line-soft); border-radius: 7px; color: var(--ink-700); font-size: 12px; } .spot-num { display: grid; width: 20px; height: 20px; place-items: center; border-radius: 50%; color: var(--brand-700); background: var(--brand-100); font-size: 10px; font-weight: 800; }

/* ═══════════════════════════════════════════
   📱 移动端适配（APP模式）
   ═══════════════════════════════════════════ */

/* GPS按钮样式 */
.gps-btn { transition: all .3s ease; }
.gps-nearby-hint {
  display: flex; align-items: center; gap: 4px;
  max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 4px 10px; border-radius: 20px;
  color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0;
  font-size: 11px; font-weight: 600;
  animation: pulse-gps 2s ease-in-out infinite;
}
@keyframes pulse-gps {
  0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,.3); }
  50% { box-shadow: 0 0 0 6px rgba(22,163,74,0); }
}

/* 平板竖屏/小屏笔记本 */
@media (max-width: 1024px) {
  .tour-main {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .tour-left {
    max-height: 50vh;
  }
  .guide-stage {
    min-height: 280px;
    max-height: 400px;
  }
  .guide-stage :deep(.vrm-container) {
    transform: scale(.72);
  }
  .tour-right {
    max-height: none;
  }
}

/* 手机竖屏 (<768px) — 主要APP模式 */
@media (max-width: 768px) {
  .tour-interaction-container {
    padding: 0 0 0;
    height: 100dvh;
    overflow: hidden;
  }

  /* 顶部栏压缩 */
  .tour-banner {
    min-height: 52px;
    margin: 0;
    padding: 0 10px;
    border-radius: 0;
    flex-wrap: wrap;
    gap: 6px;
  }
  .banner-left { gap: 6px; }
  .banner-mark { width: 28px; height: 28px; font-size: 9px; border-radius: 7px; }
  .banner-title { font-size: 14px; }
  .banner-spot { display: none !important; }
  .banner-right { gap: 6px; flex-wrap: wrap; }
  .banner-right .el-button { font-size: 11px; padding: 5px 8px; }
  .gps-nearby-hint { display: none; }

  /* 主区域：垂直堆叠 */
  .tour-main {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: calc(100dvh - 52px);
    overflow: hidden;
  }

  /* 上部：数字人 + 景点卡片 */
  .tour-left {
    flex: 0 0 auto;
    display: flex; flex-direction: column;
  }
  .guide-stage {
    height: 260px;
    min-height: 200px;
  }
  .guide-stage :deep(.vrm-container) {
    transform: scale(.48);
  }
  .stage-label { top: 8px; left: 10px; }
  .stage-label strong { font-size: 12px; }
  .speaking-state { right: 10px; bottom: 8px; font-size: 10px; padding: 4px 8px; }

  /* 景点卡片 */
  .spot-card {
    flex-shrink: 0;
    padding: 8px 10px;
    gap: 6px;
  }
  .spot-image { width: 80px; height: 60px; flex: 0 0 80px; }
  .spot-info h3 { font-size: 14px; }
  .spot-desc { font-size: 11px; -webkit-line-clamp: 1; }
  .spot-nav { width: 26px; height: 26px; font-size: 12px; }

  /* 下部：聊天区域 */
  .tour-right {
    flex: 1;
    display: flex; flex-direction: column;
    min-height: 0;
    border-radius: 14px 14px 0 0;
    overflow: hidden;
  }
  .quick-questions { padding: 8px 12px; gap: 5px; overflow-x: auto; flex-wrap: nowrap; }
  .quick-tag { font-size: 10px; white-space: nowrap; }
  .chat-area { flex: 1; padding: 10px 12px; }
  .msg-content { max-width: 88%; }
  .msg-text { font-size: 12px; }
  .chat-input-area { padding: 8px 10px 12px; }
  .input-row { gap: 6px; }
  .input-row :deep(.el-textarea__inner) { font-size: 13px; }

  /* 对话框适配 */
  :deep(.el-dialog) { width: 92% !important; max-width: 420px; margin-top: 10vh !important; }
  :deep(.el-dialog__body) { padding: 14px; }
}

/* 小手机 (<480px) */
@media (max-width: 480px) {
  .guide-stage {
    height: 200px;
    min-height: 180px;
  }
  .guide-stage :deep(.vrm-container) {
    transform: scale(.36);
  }
  .banner-title { font-size: 12px; }
  .banner-right .el-button { font-size: 10px; padding: 4px 6px; }
  .spot-image { width: 60px; height: 48px; flex: 0 0 60px; }
  .spot-info h3 { font-size: 12px; }
  .spot-nav { width: 22px; height: 22px; }
}
.scenic-diagonal{position:relative}.scenic-diagonal img{position:absolute;width:100%;height:100%;object-fit:cover}.diagonal-blur{filter:blur(8px);transform:scale(1.1);mask-image:linear-gradient(135deg,transparent 15%,black 85%)}.scenic-diagonal i{position:absolute;inset:0;background:linear-gradient(135deg,transparent 20%,rgba(240,243,255,.35) 55%,#f0f3ff 100%)}
.scenic-diagonal small{position:absolute;bottom:3px;left:4px;font-size:9px;color:#334155;background:#ffffffc9;padding:1px 3px;border-radius:3px}
</style>
