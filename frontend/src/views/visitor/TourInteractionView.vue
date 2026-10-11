<template>
  <main class="tour-interaction-container">
    <header class="tour-banner">
      <div class="banner-left">
        <h1 class="banner-title"><BrandLogo /></h1>
        <nav
          class="banner-route-flow"
          aria-label="游览路线"
          :aria-busy="switchingSpot || sessionLoading"
        >
          <div v-if="currentSpot" class="flow-node current-stop" aria-current="step">
            <span class="flow-label">当前站</span><strong>{{ currentSpot.spot_name }}</strong>
          </div>
          <template v-for="(spot, index) in upcomingStops" :key="spot.spot_id">
            <el-icon class="flow-arrow"><ArrowRight /></el-icon>
            <button
              v-if="index === 0"
              class="flow-node next-stop"
              type="button"
              :aria-label="'前往' + spot.spot_name"
              :title="'前往' + spot.spot_name"
              :disabled="
                disableInput || switchingSpot || sessionLoading || !!sessionError || finalSpot
              "
              @click="handleNextSpot"
            >
              <span class="flow-label">{{ switchingSpot ? '切换中…' : '下一站' }}</span
              ><strong>{{ spot.spot_name }}</strong>
            </button>
            <div v-else class="flow-node later-stop">
              <span class="flow-label">下下一站</span><strong>{{ spot.spot_name }}</strong>
            </div>
          </template>
          <span v-if="currentSpot && finalSpot" class="flow-end">最后一站</span>
          <span v-if="!currentSpot && !sessionError" class="flow-loading">正在加载路线…</span>
        </nav>
      </div>
      <div class="banner-right">
        <el-tooltip
          :content="gpsEnabled ? '定位已开启，接近景点时自动播报' : '开启定位，接近景点时自动播报'"
          placement="bottom"
        >
          <el-button
            :type="gpsEnabled ? 'success' : 'default'"
            plain
            :icon="Location"
            @click="toggleGps"
            >{{ gpsEnabled ? '定位已开' : '定位' }}</el-button
          >
        </el-tooltip>
        <span v-if="gpsEnabled && closestSpot" class="gps-nearby-hint">{{
          closestSpot.within_range
            ? '已到达' + closestSpot.spot_name
            : '距' + closestSpot.spot_name + closestSpot.distance + '米'
        }}</span>
        <el-button type="danger" plain @click="handleEndTour">结束导览</el-button>
      </div>
    </header>

    <div v-if="sessionError" class="tour-alert" role="alert">
      <span>{{ sessionError }}</span
      ><el-button :loading="sessionLoading" @click="refreshSessionInfo">重新加载</el-button>
    </div>
    <div class="tour-main">
      <section class="tour-left" aria-label="数字人导游">
        <div class="guide-stage">
          <div class="stage-heading">
            <h2>{{ guideInfo?.name || '数字导游' }}</h2>
            <span class="speaking-state" :class="{ speaking: isSpeaking }" role="status"
              ><i></i>{{ playbackStatus }}</span
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

      <section class="tour-side" aria-label="景区问答区域">
        <section class="tour-right" aria-label="景区问答">
          <header class="chat-heading">
            <h2>景区问答</h2>
            <span v-if="viewingSpot"
              ><el-icon><Location /></el-icon>{{ viewingSpot.spot_name }}</span
            >
          </header>
          <div class="quick-questions" aria-label="快捷提问">
            <button
              v-for="q in quickQuestions"
              :key="q.message"
              type="button"
              :disabled="disableInput || recognizing"
              @click="handleQuickQuestion(q.message)"
            >
              {{ q.label }}
            </button>
          </div>
          <div
            class="chat-area"
            role="log"
            aria-label="导览对话"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <section v-if="conversations.length === 0" class="chat-welcome">
              <div class="welcome-icon">
                <el-icon><ChatDotRound /></el-icon>
              </div>
              <h3>想了解{{ viewingSpot?.spot_name || '景区' }}的什么？</h3>
              <p>点击上方问题，或直接输入、语音提问。</p>
            </section>
            <div
              v-for="(msg, idx) in conversations"
              :key="idx"
              class="chat-message"
              :class="msg.role === 'guide' ? 'guide-msg' : 'user-msg'"
            >
              <div class="msg-content">
                <div v-if="msg.role === 'guide'" class="msg-name">
                  {{ guideInfo?.name || '数字导游' }}
                </div>
                <div class="msg-text" v-html="formatMessage(msg.message, msg.role)"></div>
                <details
                  v-if="
                    msg.role === 'guide' &&
                    (msg.aiMeta?.spotContext ||
                      msg.aiMeta?.references?.length ||
                      msg.message?.includes('以上内容来自景区知识档案'))
                  "
                  class="msg-sources"
                >
                  <summary>参考资料</summary>
                  <p v-if="msg.aiMeta?.spotContext">{{ msg.aiMeta.spotContext }}景点资料</p>
                  <p v-else-if="msg.message?.includes('以上内容来自景区知识档案')">景区知识档案</p>
                  <ul v-if="msg.aiMeta?.references?.length">
                    <li v-for="(source, index) in msg.aiMeta.references" :key="index">
                      {{ source }}
                    </li>
                  </ul>
                </details>
              </div>
            </div>
            <div v-if="loadingResponse" class="loading-indicator" role="status">
              <el-icon class="is-loading"><Loading /></el-icon>{{ generationStage }}
            </div>
          </div>
          <div class="chat-input-area">
            <div class="input-row">
              <el-input
                v-model="inputValue"
                aria-label="导览问题"
                type="textarea"
                :rows="2"
                placeholder="有什么想问的？"
                :disabled="disableInput"
                @keydown.enter.exact.prevent="handleSend"
                resize="none"
              />
              <div class="composer-actions">
                <el-button
                  :type="isRecording ? 'danger' : 'default'"
                  :icon="Microphone"
                  :aria-label="isRecording ? '结束录音' : '开始录音'"
                  :title="isRecording ? '再次点击结束录音' : '点击录音，录完再次点击'"
                  @click="handleRecord"
                  :loading="disableInput || recognizing"
                  >{{ isRecording ? '结束录音' : '语音' }}</el-button
                >
                <el-button
                  type="primary"
                  :icon="Promotion"
                  aria-label="发送问题"
                  @click="handleSend"
                  :disabled="!inputValue.trim() || isRecording"
                  :loading="disableInput || recognizing"
                  >发送</el-button
                >
              </div>
            </div>
            <p v-if="isRecording || recognizing" class="recording-status" role="status">
              {{ isRecording ? '录音中，点击“结束录音”发送识别（最长60秒）' : '正在识别录音…' }}
            </p>
          </div>
        </section>
      </section>
    </div>

    <el-dialog v-model="showWelcomeDialog" title="本次导览路线" width="600px" class="tour-dialog">
      <div class="route-result" v-if="routeInfo">
        <h3>{{ routeInfo.name }}</h3>
        <div class="route-summary">
          <span>{{ themeLabel(routeInfo.theme) }}</span
          ><span>约 {{ routeInfo.estimated_time }} 分钟</span>
        </div>
        <div v-if="visitorSpots.length" class="route-spots">
          <div v-for="(spot, idx) in visitorSpots" :key="idx" class="route-spot-item">
            <span class="spot-num">{{ idx + 1 }}</span
            >{{ spot }}
          </div>
        </div>
        <div v-if="visitorPrefs.length" class="route-preferences">
          <span v-for="pref in visitorPrefs" :key="pref">{{ prefLabel(pref) }}</span>
        </div>
      </div>
      <template #footer
        ><el-button type="primary" @click="showWelcomeDialog = false">开始导览</el-button></template
      >
    </el-dialog>
    <PwaInstallPrompt />
  </main>
</template>

<script setup lang="ts">
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
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue'
import { getTourLiveInfo, sendTourChatMessage, endTourSession } from '@/api/visitor'
import { useRecordedSpeech } from '@/composables/useRecordedSpeech'
import { useGeolocation } from '@/composables/useGeolocation'
import { formatTourMessage } from '@/utils/tourPresentation'

const router = useRouter()
const props = defineProps<{ sessionId: string }>()

// ── GPS 位置追踪 ──
const gps = useGeolocation()
const closestSpot = computed(() => gps.closestSpot.value)
const gpsEnabled = ref(false)

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
const inputValue = ref('')
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
    ElMessage.success('识别完成')
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
const welcomeShown = ref(false)
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
  if (isSpeaking.value) return '正在讲解'
  if (playbackError.value) return '语音未播放，可查看文字'
  return avatarConnected.value ? '数字人已就绪' : '可文字或语音问答'
})

/** 情感标签映射: 后端 sentment label → Live2D emotion */
const SENTIMENT_TO_EMOTION: Record<string, string> = {
  positive: 'happy',
  negative: 'sad',
  neutral: 'neutral'
}

const quickQuestions = [
  { label: '历史故事', message: '这里有什么历史故事？' },
  { label: '拍照位置', message: '最佳拍照点在哪里？' },
  { label: '附近设施', message: '附近有哪些服务设施？' },
  { label: '景点特色', message: '请介绍景点特色' },
  { label: '下一站建议', message: '下一站推荐去哪里？' }
]

async function refreshSessionInfo() {
  if (sessionLoading.value) return false
  sessionLoading.value = true
  try {
    const response = await getTourLiveInfo(Number(props.sessionId))
    if (disposed) return false
    if (response?.data?.success) {
      const data = response.data.data
      sessionError.value = ''
      conversations.value = data.conversation || []
      currentSpot.value = data.current_spot_info
      nextTourSpot.value = data.next_spot_info
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
          const allSpots: any[] =
            (spotResponse as any)?.data?.data?.spot_list ||
            (spotResponse as any)?.data?.spot_list ||
            []
          visitorSpots.value = prefs.spot_ids.map(
            (id: number) =>
              allSpots.find((spot: any) => spot.spot_id === id)?.spot_name || `景点 ${id}`
          )
          // 存储完整景点信息用于滑动浏览
          routeSpots.value = prefs.spot_ids
            .map((id: number) => allSpots.find((spot: any) => spot.spot_id === id))
            .filter(Boolean)
        }
      } catch {
        /* ignore preference parsing failure */
      }
      // 路线介绍窗口只在进入时弹一次
      if (data.route_info?.name && !welcomeShown.value) {
        showWelcomeDialog.value = true
        welcomeShown.value = true
      }
      return true
    }
    sessionError.value = response?.data?.message || '导览信息不可用，请重新加载'
  } catch {
    if (!disposed) sessionError.value = '暂时无法连接导览服务，请重新加载'
  } finally {
    sessionLoading.value = false
  }
  return false
}

// 问答回复照常播放，页面不再提供独立的景点讲解或播放控制。
function stopPlayback() {
  playbackVersion++
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
  const version = playbackVersion
  try {
    if (live2dRef.value?.speak(data.message)) return
    await live2dRef.value?.acceptPerformance(data.avatarPerformance)
    if (disposed || version !== playbackVersion) return
    if (live2dRef.value?.acceptJob(data.avatarJob)) return
    if (data.ttsAudioUrl && ttsAudio.value) {
      ttsAudio.value.src = data.ttsAudioUrl.replace(/^https?:\/\/[^/]+/, '')
      ttsAudio.value.currentTime = 0
      await ttsAudio.value.play()
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
  if (disableInput.value || disposed || sessionError.value) return false
  const nextViewingSpot = nextTourSpot.value || upcomingStops.value[0]
  conversations.value.push({
    role: 'user',
    userName: '游客',
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
    const response = await sendTourChatMessage(
      Number(props.sessionId),
      message,
      currentSpot.value?.spot_id,
      nextViewingSpot?.spot_id || 0,
      (await live2dRef.value?.getMode()) || 'audio',
      { signal: chatController.signal, timeout: 90000 }
    )
    if (disposed) return false
    const body = response.data
    if (body && body.success) {
      conversations.value.push({
        role: 'guide',
        message: body.data?.message || '',
        aiMeta: body.data?.aiMeta,
        send_time: new Date().toISOString()
      })
      await playReply(body.data)

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
      ElMessage.error(body?.message || '回复失败')
    }
  } catch (e: any) {
    console.error('Send error:', e.message, e)
    if (!disposed)
      ElMessage.error(e.code === 'ECONNABORTED' ? '讲解准备超时，请重试' : '发送失败，请重试')
  } finally {
    stopGenerationStages()
    disableInput.value = false
    loadingResponse.value = false
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
    const res = await fetch(`/tour-session/next-spot/${sid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    const data = await res.json()
    if (disposed) return
    if (data.success) {
      playbackError.value = false
      if (await refreshSessionInfo()) {
        ElMessage.success('已切换到' + currentSpot.value.spot_name)
      }
    } else {
      ElMessage.error(data.message || '切换失败')
    }
  } catch (e: any) {
    console.error('[handleNextSpot] 异常:', e)
    ElMessage.error('切换失败: ' + (e.message || e.toString()))
  } finally {
    switchingSpot.value = false
  }
}
async function handleEndTour() {
  try {
    await ElMessageBox.confirm('确定要结束本次导览吗？', '结束导览', {
      confirmButtonText: '结束',
      cancelButtonText: '取消'
    })
    await endTourSession(Number(props.sessionId))
    ElMessage.success('导览已结束')
    router.push('/visitor/home')
  } catch {
    /* user cancelled */
  }
}
function handleRecord() {
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
    history: '历史文化',
    nature: '自然风光',
    photography: '拍照打卡',
    family: '亲子家庭',
    comprehensive: '综合游览'
  }
  return map[key] || key
}
function themeLabel(key: string): string {
  const map: Record<string, string> = {
    comprehensive: '综合游览',
    historical: '历史文化',
    history: '历史文化',
    natural: '自然风光',
    nature: '自然风光',
    cultural: '文化古迹',
    modern: '现代景观',
    family: '亲子游览',
    photography: '影像记录'
  }
  return map[key] || key
}
onMounted(() => {
  refreshSessionInfo()
})
onUnmounted(() => {
  disposed = true
  chatController?.abort()
  stopPlayback()
  if (gpsEnabled.value) gps.stopTracking()
  stopGenerationStages()
  if (emotionResetTimer) clearTimeout(emotionResetTimer)
})
</script>

<style scoped lang="scss">
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
@media (prefers-reduced-motion: reduce) {
  *,
  :deep(*) {
    transition: none !important;
    animation: none !important;
  }
}
</style>
