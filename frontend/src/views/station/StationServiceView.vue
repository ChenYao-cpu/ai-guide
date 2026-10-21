<script setup lang="ts">
import { computed, ref, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import { serverIP, serverPort } from 'virtual:server-info'
import BrandLogo from '@/components/BrandLogo.vue'
import DigitalAvatarPlayer from '@/components/DigitalAvatarPlayer.vue'
import ScenicSpotCover from '@/components/ScenicSpotCover.vue'
import ScenicVisitContext from '@/components/ScenicVisitContext.vue'
import RouteOverview from '@/components/RouteOverview.vue'
import TourVisualContext from '@/components/TourVisualContext.vue'
import StationWalkingDirections from '@/components/StationWalkingDirections.vue'
import StationVisitorInfo from '@/components/StationVisitorInfo.vue'
import {
  Guide,
  ChatDotRound,
  MapLocation,
  Picture,
  ArrowRight,
  House,
  Microphone,
  Position,
  Location,
  InfoFilled,
  Notebook,
  Check,
  Plus
} from '@element-plus/icons-vue'
import { useStationIdle } from '@/composables/useStationIdle'
import { locale, setLocale, t } from '@/i18n'
import {
  getStation,
  heartbeatStation,
  beginStationVisit,
  endStationVisit,
  extendStationVisit,
  planAtStation,
  consultStation,
  speakAtStation,
  shareStationPlan,
  stationDirections,
  stationError,
  defaultStationPlanningInput,
  type StationCatalog,
  type StationVisit,
  type StationPlan,
  type StationReply,
  type StationSpot,
  type StationDirections
} from '@/api/serviceStation'

const route = useRoute()
const stationId = computed(() => String(route.params.stationId || 'summer-palace-east'))
const S = (zh: string, en: string) => (locale.value === 'en' ? en : zh)
type Task = 'home' | 'plan' | 'chat' | 'info' | 'explore' | 'facilities' | 'result'
const task = ref<Task>('home'),
  catalog = ref<StationCatalog | null>(null),
  visit = ref<StationVisit | null>(null)
// The live receptionist stays connected on the welcome screen. Only a visitor's
// interaction starts the idle countdown and exposes the "finish" action.
const engaged = ref(false),
  receptionError = ref('')
const loading = ref(true),
  offline = ref(false),
  stale = ref(false),
  error = ref(''),
  busy = ref(false),
  speechBusy = ref(false),
  speaking = ref(false)
const prefs = reactive(defaultStationPlanningInput()),
  plans = ref<StationPlan[]>([]),
  planIndex = ref(0),
  planStale = ref(false)
const plan = computed(() => plans.value[planIndex.value]),
  station = computed(() => catalog.value?.station)
const question = ref(''),
  reply = ref<StationReply | null>(null),
  messages = ref<Array<{ role: string; text: string }>>([]),
  lastQuestion = ref('')
const selectedSpot = ref<StationSpot | null>(null),
  search = ref(''),
  directions = ref<StationDirections | null>(null),
  directionTitle = ref('')
const explorePage = ref(0)
const directionsResult = ref<HTMLElement | null>(null)
const wayfindingKind = ref<'exits' | 'attractions' | 'services'>('exits'),
  facilitySearch = ref('')
const showShare = ref(false),
  shareQr = ref(''),
  shareUrl = ref(''),
  shareExpiry = ref(0),
  clock = ref(Date.now()),
  shareBusy = ref(false),
  shareError = ref(''),
  endConfirm = ref(false)
const avatar = ref<InstanceType<typeof DigitalAvatarPlayer> | null>(null),
  audio = ref<HTMLAudioElement | null>(null),
  textOnly = ref(false),
  voiceError = ref('')
const recording = ref(false),
  recognition = ref<any>(null),
  listenError = ref(''),
  heroIndex = ref(0)
let controller: AbortController | undefined,
  speechController: AbortController | undefined,
  configurationController: AbortController | undefined
let version = 0,
  visitVersion = 0,
  speechVersion = 0,
  configurationVersion = 0,
  disposed = false,
  starting: Promise<StationVisit | null> | null = null,
  blobUrl = '',
  lastExtend = 0
let interval: ReturnType<typeof setInterval> | undefined,
  heartbeat: ReturnType<typeof setInterval> | undefined
let recordingTimer: ReturnType<typeof setTimeout> | undefined,
  speakingTimer: ReturnType<typeof setTimeout> | undefined
const focusCleanup = new WeakMap<HTMLElement, () => void>()
const vDialogFocus = {
  mounted(el: HTMLElement) {
    const previous = document.activeElement as HTMLElement | null
    const controls = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)'
        )
      )
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = controls()
      if (!items.length) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && index <= 0) {
        event.preventDefault()
        items.at(-1)?.focus()
      } else if (!event.shiftKey && index === items.length - 1) {
        event.preventDefault()
        items[0].focus()
      }
    }
    el.addEventListener('keydown', key)
    void nextTick(() => {
      ;(el.querySelector<HTMLElement>('.station-primary') || controls()[0])?.focus({
        preventScroll: true
      })
    })
    focusCleanup.set(el, () => {
      el.removeEventListener('keydown', key)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    })
  },
  beforeUnmount(el: HTMLElement) {
    focusCleanup.get(el)?.()
    focusCleanup.delete(el)
  }
}
const remainingSeconds = computed(() =>
  Math.max(0, Math.ceil((shareExpiry.value - clock.value) / 1000))
)
const stationName = computed(() =>
  locale.value === 'en' ? station.value?.name_en : station.value?.name
)
const locationName = computed(() =>
  locale.value === 'en' ? station.value?.location_en : station.value?.location
)
const hero = computed(
  () =>
    catalog.value?.spots.filter((s) =>
      ['昆明湖', '长廊', '佛香阁', '十七孔桥'].includes(s.spot_name)
    )[heroIndex.value % 4] || catalog.value?.spots[0]
)
const filteredSpots = computed(
  () =>
    catalog.value?.spots.filter((s) =>
      (t(s.spot_name) + ' ' + s.spot_name).toLowerCase().includes(search.value.toLowerCase())
    ) || []
)
const pagedSpots = computed(() =>
  filteredSpots.value.slice(explorePage.value * 6, explorePage.value * 6 + 6)
)
const activeNotices = computed(
  () =>
    station.value?.announcements.filter(
      (a) => !a.expires_at || Date.parse(a.expires_at) > clock.value
    ) || []
)
watch(search, () => {
  explorePage.value = 0
})
const options = computed(() => [
  {
    key: 'plan' as Task,
    name: S('帮我规划游览', 'Plan my visit'),
    icon: Guide
  },
  {
    key: 'info' as Task,
    name: S('游园须知', 'Visitor essentials'),
    icon: Notebook
  },
  {
    key: 'facilities' as Task,
    name: S('找景点与设施', 'Find your way'),
    icon: MapLocation
  },
  {
    key: 'explore' as Task,
    name: S('了解这座景区', 'Discover the park'),
    icon: Picture
  }
])
const facilityItems = computed(() =>
  wayfindingKind.value === 'attractions'
    ? (catalog.value?.spots || [])
        .filter((s) =>
          (s.spot_name + t(s.spot_name)).toLowerCase().includes(facilitySearch.value.toLowerCase())
        )
        .map((s) => ({
          key: 'spot:' + s.spot_name,
          name: t(s.spot_name),
          kind: S('景点', 'Attraction'),
          disabled: false
        }))
    : wayfindingKind.value === 'services'
      ? (station.value?.facilities || [])
          .filter((f) => f.verified)
          .map((f) => ({
            key: f.key,
            name: locale.value === 'en' ? f.name_en : f.name,
            kind:
              f.status === 'closed'
                ? S('暂不可用', 'Unavailable')
                : S('已核实位置', 'Verified location'),
            disabled: f.status === 'closed'
          }))
      : [
          {
            key: 'gate:east',
            name: S('东宫门', 'East Palace Gate'),
            kind: S('出口', 'Exit'),
            disabled: false
          },
          {
            key: 'gate:north',
            name: S('北宫门', 'North Palace Gate'),
            kind: S('出口', 'Exit'),
            disabled: false
          },
          {
            key: 'gate:south',
            name: S('新建宫门', 'New Palace Gate'),
            kind: S('出口', 'Exit'),
            disabled: false
          }
        ]
)
const idle = useStationIdle({
  seconds: () => station.value?.idle_seconds || 120,
  active: () => engaged.value,
  busy: () =>
    busy.value || speaking.value || recording.value || speechBusy.value || shareBusy.value,
  onExpire: () => reset()
})
const idleRemaining = idle.remaining
const moneyFreeNote = computed(() =>
  S(
    '预计用时包含步行、停留和休息；开放、票务与排队以现场为准。',
    'Estimates include walking, visits and breaks. Check access, tickets and queues on site.'
  )
)
const distance = (m: number | null | undefined) =>
  m == null ? '—' : m >= 1000 ? (m / 1000).toFixed(2) + ' km' : m + ' m'
function metricTime(minutes: number | null | undefined) {
  return minutes == null ? '—' : minutes + ' ' + S('分钟', 'min')
}

async function load() {
  const own = ++configurationVersion,
    id = stationId.value
  configurationController?.abort()
  configurationController = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const data = await getStation(id, configurationController.signal)
    if (disposed || own !== configurationVersion) return
    catalog.value = data
    offline.value = false
    stale.value = false
    if (!visit.value) setLocale(data.station.default_language)
    try {
      localStorage.setItem(
        'station-public-' + stationId.value,
        JSON.stringify({ data, saved: Date.now() })
      )
    } catch {}
    void prepareReception()
  } catch (e: any) {
    if (disposed || own !== configurationVersion || e.code === 'ERR_CANCELED') return
    if (e.response?.status === 404) {
      catalog.value = null
      try {
        localStorage.removeItem('station-public-' + stationId.value)
      } catch {}
      offline.value = true
      error.value = stationError(e)
      return
    }
    try {
      const cached = JSON.parse(localStorage.getItem('station-public-' + stationId.value) || 'null')
      if (cached && Date.now() - cached.saved < 7 * 86400000) {
        catalog.value = cached.data
        stale.value = true
      }
    } catch {}
    offline.value = true
    error.value = stationError(e)
  } finally {
    if (!disposed && own === configurationVersion) loading.value = false
  }
}
async function ensureVisit() {
  if (visit.value) return visit.value
  if (starting) return starting
  const own = visitVersion
  const pending = beginStationVisit(stationId.value, locale.value)
    .then((v) => {
      if (disposed || own !== visitVersion) {
        void endStationVisit(v).catch(() => {})
        return null
      }
      visit.value = v
      lastExtend = Date.now()
      if (engaged.value) idle.touch()
      return v
    })
    .finally(() => {
      if (starting === pending) starting = null
    })
  starting = pending
  return pending
}
async function prepareReception() {
  if (disposed || offline.value || !catalog.value?.guide) return
  const own = visitVersion
  receptionError.value = ''
  try {
    await ensureVisit()
  } catch (e) {
    if (!disposed && own === visitVersion) receptionError.value = stationError(e)
  }
}
async function go(next: Task) {
  stopSpeech()
  stopListening()
  error.value = ''
  task.value = next
  if (next === 'home') return
  engaged.value = true
  idle.touch()
  if (next === 'info') return
  if (offline.value) return
  try {
    await ensureVisit()
  } catch (e) {
    error.value = stationError(e)
  }
}
function stopSpeech() {
  speechVersion++
  speechController?.abort()
  speechBusy.value = false
  speaking.value = false
  audio.value?.pause()
  if (audio.value) {
    audio.value.removeAttribute('src')
    audio.value.load()
  }
  avatar.value?.stop()
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl)
    blobUrl = ''
  }
}
function stopListening() {
  if (recordingTimer) clearTimeout(recordingTimer)
  recordingTimer = undefined
  recognition.value?.abort()
  recognition.value = null
  recording.value = false
}
function cancel() {
  version++
  controller?.abort()
  busy.value = false
  stopSpeech()
  stopListening()
  idle.touch()
}
function reset(reconnect = true) {
  const previous = visit.value
  visitVersion++
  cancel()
  engaged.value = false
  receptionError.value = ''
  visit.value = null
  starting = null
  plans.value = []
  planIndex.value = 0
  reply.value = null
  messages.value = []
  question.value = ''
  lastQuestion.value = ''
  selectedSpot.value = null
  search.value = ''
  directions.value = null
  showShare.value = false
  shareBusy.value = false
  shareQr.value = ''
  shareUrl.value = ''
  shareExpiry.value = 0
  shareError.value = ''
  endConfirm.value = false
  error.value = ''
  voiceError.value = ''
  listenError.value = ''
  textOnly.value = false
  planStale.value = false
  task.value = 'home'
  Object.assign(prefs, defaultStationPlanningInput())
  setLocale(station.value?.default_language || 'zh')
  idle.touch()
  explorePage.value = 0
  wayfindingKind.value = 'exits'
  facilitySearch.value = ''
  if (previous) void endStationVisit(previous).catch(() => {})
  if (reconnect) {
    if (stale.value || !catalog.value) void load()
    else void prepareReception()
  }
}
function toggleStop(s: StationSpot) {
  prefs.spot_ids = prefs.spot_ids.includes(s.spot_id)
    ? prefs.spot_ids.filter((id) => id !== s.spot_id)
    : [...prefs.spot_ids, s.spot_id]
}
async function calculate() {
  if (busy.value || offline.value) return
  const own = ++version
  controller?.abort()
  controller = new AbortController()
  busy.value = true
  error.value = ''
  stopSpeech()
  try {
    const v = await ensureVisit()
    if (!v || own !== version) return
    const data = await planAtStation(
      v,
      { ...prefs, spot_ids: [...prefs.spot_ids], language: locale.value },
      controller.signal
    )
    if (disposed || own !== version) return
    plans.value = data.plans
    planIndex.value = 0
    planStale.value = false
    task.value = 'result'
    showShare.value = false
  } catch (e: any) {
    if (own === version && e.code !== 'ERR_CANCELED') handleError(e)
  } finally {
    if (own === version) busy.value = false
    idle.touch()
  }
}
function handleError(e: any) {
  error.value = stationError(e)
  if ([403, 410].includes(e?.response?.status)) {
    const message = error.value
    reset()
    error.value = message
  }
}
async function ask(value = question.value) {
  if (!value.trim() || busy.value || offline.value) return
  const own = ++version
  controller?.abort()
  controller = new AbortController()
  busy.value = true
  error.value = ''
  stopSpeech()
  stopListening()
  task.value = 'chat'
  lastQuestion.value = value
  question.value = ''
  try {
    const v = await ensureVisit()
    if (!v || own !== version) return
    const data = await consultStation(
      v,
      {
        question: value,
        language: locale.value,
        preferences: { ...prefs, language: locale.value },
        spot_id: selectedSpot.value?.spot_id
      },
      controller.signal
    )
    if (disposed || own !== version) return
    reply.value = data
    const { budget, end_area, avoid_steps, spot_ids } = data.preferences
    Object.assign(prefs, {
      budget,
      end_area,
      avoid_steps,
      spot_ids: [...spot_ids],
      language: locale.value
    })
    messages.value = [
      ...messages.value,
      { role: 'user', text: value },
      { role: 'assistant', text: data.answer }
    ].slice(-12)
    if (data.spot_id)
      selectedSpot.value = catalog.value?.spots.find((s) => s.spot_id === data.spot_id) || null
    if (!textOnly.value) void playAnswer()
  } catch (e: any) {
    if (own === version && e.code !== 'ERR_CANCELED') {
      question.value = value
      handleError(e)
    }
  } finally {
    if (own === version) busy.value = false
    idle.touch()
  }
}
async function playAnswer() {
  if (!visit.value || !reply.value || textOnly.value) return
  stopSpeech()
  const own = speechVersion
  speechBusy.value = true
  voiceError.value = ''
  speechController = new AbortController()
  try {
    if (avatar.value?.speak(reply.value.answer)) {
      speechBusy.value = false
      return
    }
    const blob = await speakAtStation(visit.value, locale.value, speechController.signal)
    if (disposed || own !== speechVersion) return
    blobUrl = URL.createObjectURL(blob)
    if (audio.value) {
      audio.value.src = blobUrl
      audio.value.volume = station.value?.volume ?? 0.7
      await audio.value.play()
    }
  } catch (e: any) {
    if (own === speechVersion && e.code !== 'ERR_CANCELED')
      voiceError.value = S(
        '语音暂不可用，可继续阅读字幕或重试播放。',
        'Audio is unavailable. You can read the answer or retry playback.'
      )
  } finally {
    if (own === speechVersion) speechBusy.value = false
  }
}
function listen() {
  if (recording.value) {
    stopListening()
    return
  }
  stopSpeech()
  listenError.value = ''
  const Constructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!Constructor) {
    listenError.value = S(
      '此浏览器暂不支持语音输入，请使用触屏键盘。',
      'Voice input is unavailable in this browser. Please use the on-screen keyboard.'
    )
    return
  }
  const rec = new Constructor()
  recognition.value = rec
  rec.lang = locale.value === 'en' ? 'en-US' : 'zh-CN'
  rec.interimResults = false
  rec.continuous = false
  rec.onresult = (event: any) => {
    question.value = event.results[0][0].transcript
    stopListening()
  }
  rec.onerror = () => {
    listenError.value = S(
      '没有听清或麦克风不可用，请重试或输入文字。',
      'Microphone unavailable or speech not understood. Retry or type your question.'
    )
    stopListening()
  }
  rec.onend = () => {
    recording.value = false
    if (recordingTimer) clearTimeout(recordingTimer)
    recordingTimer = undefined
    idle.touch()
  }
  try {
    rec.start()
    recording.value = true
    recordingTimer = setTimeout(stopListening, 20000)
  } catch {
    listenError.value = S('请检查麦克风权限。', 'Please check microphone permission.')
  }
}
async function showDirections(key: string, title: string) {
  if (busy.value || offline.value) return
  const own = ++version
  controller?.abort()
  controller = new AbortController()
  busy.value = true
  error.value = ''
  directions.value = null
  try {
    const data = await stationDirections(stationId.value, key, controller.signal)
    if (own === version && !disposed) {
      directions.value = data
      directionTitle.value = title
      await nextTick()
      directionsResult.value?.scrollIntoView?.({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start'
      })
    }
  } catch (e: any) {
    if (own === version && e.code !== 'ERR_CANCELED') error.value = stationError(e)
  } finally {
    if (own === version) busy.value = false
  }
}
async function openReplyDirections() {
  if (!reply.value?.destination_key) return
  const key = reply.value.destination_key
  await go('facilities')
  wayfindingKind.value = 'attractions'
  await showDirections(key, t(key.slice(5)))
}
async function share() {
  if (!plan.value || !visit.value || shareBusy.value || planStale.value) return
  const own = version,
    planId = plan.value.plan_id
  shareBusy.value = true
  shareError.value = ''
  showShare.value = true
  shareQr.value = ''
  try {
    const data = await shareStationPlan(visit.value, planId)
    if (disposed || own !== version || plan.value?.plan_id !== planId) return
    const origin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      ? `http://${serverIP}:${serverPort}`
      : location.origin
    const url = origin + '/m/receive#claim=' + encodeURIComponent(data.token)
    const qr = await QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: '#252243', light: '#ffffff' }
    })
    if (disposed || own !== version) return
    shareQr.value = qr
    shareUrl.value = url
    shareExpiry.value = Date.parse(data.expires_at)
    clock.value = Date.now()
  } catch (e) {
    if (own === version) shareError.value = stationError(e)
  } finally {
    if (own === version) shareBusy.value = false
  }
}
async function poll() {
  if (disposed) return
  try {
    const data = await heartbeatStation(stationId.value)
    offline.value = false
    if (disposed) return
    if (
      catalog.value &&
      (data.revision !== catalog.value.station.revision ||
        data.network_version !== catalog.value.network_version ||
        data.catalog_version !== catalog.value.catalog_version)
    ) {
      stale.value = true
      planStale.value = true
      if (!engaged.value) {
        reset(false)
        await load()
      }
    }
    if (visit.value && Date.now() - lastExtend > 60000) {
      await extendStationVisit(visit.value)
      lastExtend = Date.now()
    }
    if (catalog.value?.guide && !visit.value && !receptionError.value) void prepareReception()
  } catch (e: any) {
    offline.value = true
    if (e.response?.status === 404) {
      reset(false)
      catalog.value = null
      error.value = stationError(e)
    }
  }
}
function online() {
  void load()
  void poll()
}
function onOffline() {
  offline.value = true
  stopListening()
  stopSpeech()
}
watch(locale, () => {
  stopSpeech()
  stopListening()
  reply.value = null
  messages.value = []
  question.value = ''
  selectedSpot.value = null
  directions.value = null
  prefs.language = locale.value
  idle.touch()
})
watch(
  () => JSON.stringify(prefs),
  () => {
    if (plans.value.length) {
      planStale.value = true
      showShare.value = false
    }
  }
)
watch(planIndex, () => {
  showShare.value = false
  shareQr.value = ''
  shareUrl.value = ''
})
watch(
  () => route.params.stationId,
  () => {
    reset(false)
    catalog.value = null
    void load()
  }
)
watch(textOnly, (value) => {
  if (value) stopSpeech()
})
watch(speaking, (value) => {
  if (speakingTimer) clearTimeout(speakingTimer)
  speakingTimer = undefined
  if (value) speakingTimer = setTimeout(stopSpeech, 120000)
  else idle.touch()
})
onMounted(() => {
  void load()
  void poll()
  interval = setInterval(() => {
    clock.value = Date.now()
    if (task.value === 'home' && !document.hidden && Date.now() % 12000 < 1100) heroIndex.value++
  }, 1000)
  heartbeat = setInterval(poll, 30000)
  window.addEventListener('online', online)
  window.addEventListener('offline', onOffline)
})
onBeforeUnmount(() => {
  disposed = true
  visitVersion++
  configurationController?.abort()
  const previous = visit.value
  cancel()
  if (previous) void endStationVisit(previous).catch(() => {})
  if (interval) clearInterval(interval)
  if (heartbeat) clearInterval(heartbeat)
  if (speakingTimer) clearTimeout(speakingTimer)
  window.removeEventListener('online', online)
  window.removeEventListener('offline', onOffline)
})

function discoverHero() {
  selectedSpot.value = hero.value || null
  void go('explore')
}
function suggestPlan() {
  selectedSpot.value = null
  void ask(
    S(
      '我有两小时，最后从东宫门离园，请帮我规划路线',
      'I have two hours. Please plan a route ending at the east gate.'
    )
  )
}
function suggestCorridor() {
  selectedSpot.value = catalog.value?.spots.find((s) => s.spot_name === '长廊') || null
  void ask(S('长廊有什么值得看？', 'What should I notice in the Long Corridor?'))
}
function addSelectedSpot() {
  if (!selectedSpot.value) return
  if (!prefs.spot_ids.includes(selectedSpot.value.spot_id))
    prefs.spot_ids.push(selectedSpot.value.spot_id)
  void go('plan')
}
function selectWayfinding(kind: 'exits' | 'attractions' | 'services') {
  wayfindingKind.value = kind
  directions.value = null
}
function audioEnded() {
  speaking.value = false
  idle.touch()
}
function backToAttractions() {
  selectedSpot.value = null
}
</script>

<template>
  <main class="station-app" @pointerdown="idle.touch">
    <header class="station-top">
      <BrandLogo />
      <div class="station-title">
        <strong>{{ S('景区数字人服务站', 'Digital Visitor Service Station') }}</strong
        ><span><i></i>{{ locationName || S('正在连接本站', 'Connecting to this station') }}</span>
      </div>
      <span v-if="station?.demo" class="station-demo">{{ S('示范站', 'Demo station') }}</span>
      <div class="station-top-actions">
        <div class="station-language" :aria-label="S('选择语言', 'Choose language')">
          <button :aria-pressed="locale === 'zh'" @click="setLocale('zh')">中文</button
          ><button :aria-pressed="locale === 'en'" @click="setLocale('en')">English</button>
        </div>
        <button v-if="engaged" class="station-end" @click="endConfirm = true">
          {{ S('结束本次使用', 'Finish this visit') }}
        </button>
      </div>
    </header>
    <div v-if="loading && !catalog" class="station-splash" role="status">
      <ChatDotRound class="station-orbit" aria-hidden="true" />
      <h1>{{ S('正在准备您的景区服务站', 'Preparing your service station') }}</h1>
    </div>
    <template v-else-if="catalog">
      <div v-if="offline || stale" class="station-network" role="status">
        <span>{{
          offline
            ? S(
                '网络暂不可用，仍可浏览已缓存的景点资料；咨询、路线计算与领取需恢复连接。',
                'Offline. Cached attraction information is available; consultation, routing and pickup require a connection.'
              )
            : S(
                '资料有更新，请重新规划后领取；当前展示保留供参考。',
                'Information has changed. Recalculate before taking a plan to your phone.'
              )
        }}</span
        ><button @click="load">{{ S('重新连接', 'Reconnect') }}</button>
      </div>
      <div class="station-workspace">
        <aside class="station-reception" :aria-label="S('实时数字人', 'Live digital guide')">
          <div class="station-avatar-stage">
            <DigitalAvatarPlayer
              v-if="catalog.guide"
              :key="catalog.guide.guide_id"
              ref="avatar"
              station-mode
              :guide-id="catalog.guide.guide_id"
              :station-visit="visit || undefined"
              :audio-element="audio"
              :width="640"
              :height="900"
              :speaking="speaking"
              :busy="busy"
              @playing="speaking = $event"
            />
            <div v-else class="station-no-avatar">
              <ChatDotRound aria-hidden="true" /><span>{{ S('文字咨询', 'Text assistance') }}</span>
            </div>
            <div v-if="receptionError" class="station-avatar-error" role="alert">
              <p>{{ t(receptionError) }}</p>
              <button class="station-secondary" @click="prepareReception">
                {{ S('重新连接数字人', 'Reconnect guide') }}
              </button>
            </div>
          </div>
          <button class="station-ask-button" :aria-pressed="task === 'chat'" @click="go('chat')">
            <ChatDotRound aria-hidden="true" />{{ S('和数字人聊一聊', 'Talk to the guide')
            }}<ArrowRight aria-hidden="true" />
          </button>
        </aside>
        <section class="station-task-area" :aria-busy="busy">
          <nav
            v-if="task !== 'home'"
            class="station-task-nav"
            :aria-label="S('服务导航', 'Services')"
          >
            <button class="station-home-button" @click="go('home')">
              <House aria-hidden="true" />{{ S('首页', 'Home') }}</button
            ><button
              v-for="item in options"
              :key="item.key"
              :aria-current="
                task === item.key || (task === 'result' && item.key === 'plan') ? 'page' : undefined
              "
              @click="go(item.key)"
            >
              {{ item.name }}
            </button>
          </nav>
          <div v-if="error" class="station-error" role="alert">
            <span>{{ t(error) }}</span
            ><button @click="error = ''">{{ S('关闭', 'Dismiss') }}</button>
          </div>
          <Transition name="station-page" mode="out-in">
            <div v-if="task === 'home'" key="home" class="station-home-content">
              <div class="station-home-heading">
                <h1>{{ S('今天，想怎样游览？', 'How would you like to explore?') }}</h1>
              </div>
              <div class="station-home-showcase">
                <div class="station-feature-card">
                  <ScenicSpotCover
                    v-if="hero"
                    :key="hero.spot_id"
                    :spot="hero"
                    position="50% 40%"
                  />
                  <div class="station-feature-caption">
                    <strong>{{ t(hero?.spot_name || '昆明湖') }}</strong>
                    <button @click="discoverHero">
                      {{ S('查看景点', 'View attraction') }}<ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <ScenicVisitContext
                  v-if="station"
                  class="station-home-weather"
                  weather-only
                  :latitude="station.anchor.latitude"
                  :longitude="station.anchor.longitude"
                />
              </div>
              <div class="station-service-cards">
                <button v-for="item in options" :key="item.key" @click="go(item.key)">
                  <span class="station-service-icon"
                    ><component :is="item.icon" aria-hidden="true"
                  /></span>
                  <h2>{{ item.name }}</h2>
                  <ArrowRight class="station-service-arrow" aria-hidden="true" />
                </button>
              </div>
              <div v-if="activeNotices.length" class="station-announcements">
                <strong>{{ S('景区公告', 'Park notices') }}</strong>
                <p v-for="(notice, index) in activeNotices" :key="index">
                  {{ locale === 'en' ? notice.text_en : notice.text }}
                </p>
              </div>
            </div>
            <div v-else-if="task === 'plan'" key="plan" class="station-planner">
              <div class="station-section-title">
                <h1>{{ S('游览规划', 'Plan your visit') }}</h1>
              </div>
              <div class="station-planning-form">
                <fieldset>
                  <legend>{{ S('您有多少时间？', 'How much time do you have?') }}</legend>
                  <div class="station-choice-row">
                    <button
                      v-for="m in [60, 120, 180, 240]"
                      :key="m"
                      :aria-pressed="prefs.budget === m"
                      @click="prefs.budget = m"
                    >
                      {{ m / 60 }} {{ S('小时', 'h') }}</button
                    ><label class="station-custom-time"
                      ><input
                        v-model.number="prefs.budget"
                        type="number"
                        min="20"
                        max="480"
                        :aria-label="S('自定义分钟数', 'Custom minutes')"
                      />{{ S('分钟', 'min') }}</label
                    >
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{{ S('最后去哪里？', 'Where will you finish?') }}</legend>
                  <div
                    class="station-choice-row station-endpoint-options"
                    role="group"
                    :aria-label="S('选择游览终点', 'Choose an end point')"
                  >
                    <button
                      v-for="end in [
                        ['east', '东宫门', 'East Palace Gate'],
                        ['north', '北宫门', 'North Palace Gate'],
                        ['south', '新建宫门', 'New Palace Gate'],
                        ['return', '返回本站', 'Return to this station']
                      ] as const"
                      :key="end[0]"
                      :aria-pressed="prefs.end_area === end[0]"
                      @click="prefs.end_area = end[0]"
                    >
                      <Check v-if="prefs.end_area === end[0]" aria-hidden="true" />{{
                        S(end[1], end[2])
                      }}
                    </button>
                  </div>
                </fieldset>
                <label class="station-step-option"
                  ><input type="checkbox" v-model="prefs.avoid_steps" /><span
                    >{{ S('避开路网已标注的台阶', 'Avoid steps marked in the walking network')
                    }}<small>{{
                      S(
                        '不代表无障碍认证，现场通行条件仍需确认。',
                        'This does not certify an accessible route; check actual conditions on site.'
                      )
                    }}</small></span
                  ></label
                >
                <section class="station-manual-stops" aria-labelledby="station-manual-stops-title">
                  <header class="station-manual-heading">
                    <h2 id="station-manual-stops-title">
                      <MapLocation aria-hidden="true" />{{
                        S('自选景点', 'Choose your attractions')
                      }}
                    </h2>
                    <span class="station-stop-count"
                      >{{ prefs.spot_ids.length }} {{ S('处已选', 'selected') }}</span
                    >
                    <button
                      v-if="prefs.spot_ids.length"
                      class="station-clear-stops"
                      @click="prefs.spot_ids = []"
                    >
                      {{ S('清空选择', 'Clear selection') }}
                    </button>
                  </header>
                  <p>
                    {{
                      S(
                        '不选景点时，按时间和终点安排路线；自选后保留全部景点并优化顺序。',
                        'Leave this empty for a route based on your time and end point, or select stops to keep them all and optimize their order.'
                      )
                    }}
                  </p>
                  <div class="station-stop-options">
                    <button
                      v-for="spot in catalog.spots"
                      :key="spot.spot_id"
                      :aria-pressed="prefs.spot_ids.includes(spot.spot_id)"
                      @click="toggleStop(spot)"
                    >
                      <Check v-if="prefs.spot_ids.includes(spot.spot_id)" aria-hidden="true" />
                      <Plus v-else aria-hidden="true" />
                      {{ t(spot.spot_name) }}
                    </button>
                  </div>
                </section>
              </div>
              <div class="station-inline-footer">
                <span
                  ><Location aria-hidden="true" />{{ S('起点', 'Start') }} · {{ stationName }}</span
                ><button
                  class="station-primary"
                  :disabled="
                    busy ||
                    offline ||
                    !Number.isFinite(prefs.budget) ||
                    prefs.budget < 20 ||
                    prefs.budget > 480
                  "
                  @click="calculate"
                >
                  {{
                    busy
                      ? S('正在计算步行方案…', 'Calculating your walk…')
                      : S('生成我的游览方案', 'Create my walking plan')
                  }}
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
            <div v-else-if="task === 'result' && plan" key="result" class="station-result">
              <div class="station-section-title">
                <h1>{{ S('游览方案', 'Your itinerary') }}</h1>
              </div>
              <div class="station-plan-tabs">
                <button
                  v-for="(item, index) in plans"
                  :key="item.plan_id"
                  :aria-pressed="planIndex === index"
                  @click="planIndex = index"
                >
                  {{ locale === 'en' ? item.title_en : item.title
                  }}<span
                    >{{ metricTime(item.route.total_minutes) }} · {{ item.route.stops.length }}
                    {{ S('站', 'stops') }}</span
                  >
                </button>
              </div>
              <div class="station-plan-summary">
                <div>
                  <strong>{{ distance(plan.route.walking_meters) }}</strong
                  ><span>{{ S('沿园内步道', 'on park paths') }}</span>
                </div>
                <div>
                  <strong>{{ metricTime(plan.route.total_minutes) }}</strong
                  ><span>{{ S('预计总用时', 'estimated total time') }}</span>
                </div>
                <p>
                  {{ S('步行', 'Walking') }}
                  {{ metricTime((plan.route.walking_minutes || 0) + (plan.route.exit_minutes || 0))
                  }}<br />{{ S('停留', 'Visits') }} {{ metricTime(plan.route.visit_minutes) }} ·
                  {{ S('休息', 'Breaks') }} {{ metricTime(plan.route.rest_minutes) }}
                </p>
              </div>
              <RouteOverview :overview="plan.route" :compact="true" :map-only="true" />
              <ol class="station-plan-stops">
                <li class="station-stop-origin">
                  <b>⌖</b><span>{{ S('本站出发', 'Start here') }} · {{ stationName }}</span
                  ><small>{{ metricTime(plan.route.entry_leg?.minutes) }} →</small>
                </li>
                <li v-for="stop in plan.route.stops" :key="stop.spot_id">
                  <b>{{ stop.order }}</b
                  ><span>{{ t(stop.spot_name) }}</span
                  ><small>{{ S('停留', 'Visit') }} {{ metricTime(stop.visit_minutes) }}</small>
                </li>
                <li class="station-stop-origin">
                  <b>↗</b
                  ><span>{{
                    plan.preferences.end_area === 'return'
                      ? stationName
                      : t(plan.route.exit_leg?.to_name)
                  }}</span
                  ><small>{{ metricTime(plan.route.exit_leg?.minutes) }}</small>
                </li>
              </ol>
              <p v-if="planStale" class="station-audio-note">
                {{
                  S(
                    '需求或资料已变化，请重新计算后领取。',
                    'Route details or information changed. Recalculate before pickup.'
                  )
                }}
                <button @click="calculate" :disabled="busy || offline">
                  {{ S('重新计算', 'Recalculate') }} ↗
                </button>
              </p>
              <p class="station-estimate-note">{{ moneyFreeNote }}</p>
              <div class="station-inline-footer">
                <button class="station-secondary" @click="go('plan')">
                  {{ S('修改路线条件', 'Edit route details') }}</button
                ><button
                  class="station-primary"
                  :disabled="planStale || offline || shareBusy"
                  @click="share"
                >
                  {{ S('把这条路线带到手机', 'Take this route to my phone') }} ↗
                </button>
              </div>
            </div>
            <StationVisitorInfo
              v-else-if="task === 'info'"
              key="info"
              :now="clock"
              :announcements="activeNotices"
            />
            <div v-else-if="task === 'chat'" key="chat" class="station-chat">
              <div class="station-section-title">
                <h1>{{ S('数字人咨询', 'Ask the digital guide') }}</h1>
              </div>
              <div class="station-quick-questions">
                <button @click="suggestPlan">
                  {{ S('帮我安排两小时游览', 'Plan a two-hour visit') }}</button
                ><button @click="suggestCorridor">
                  {{ S('长廊有什么值得看？', 'What is special about the Long Corridor?') }}</button
                ><button @click="go('facilities')">
                  {{ S('从这里怎么到出口？', 'How do I reach an exit?') }}
                </button>
              </div>
              <div class="station-conversation" aria-live="polite">
                <template v-if="reply"
                  ><div class="station-user-question">{{ lastQuestion }}</div>
                  <div class="station-answer">
                    <p>{{ reply.answer }}</p>
                    <TourVisualContext :context="reply.visuals" :expanded="true" />
                    <div class="station-answer-actions">
                      <button
                        v-if="reply.actions.includes('plan')"
                        class="station-primary"
                        @click="go('plan')"
                      >
                        {{ S('查看路线条件', 'Review route details') }} ↗</button
                      ><button
                        v-if="reply.destination_key"
                        class="station-primary"
                        @click="openReplyDirections"
                      >
                        {{ S('查看从本站出发的路线', 'Show directions from this station') }}
                        ↗</button
                      ><button
                        v-else-if="reply.actions.includes('facilities')"
                        class="station-secondary"
                        @click="go('facilities')"
                      >
                        {{ S('查看设施与出口', 'View facilities and exits') }} ↗</button
                      ><button v-if="reply.actions.includes('explore')" @click="go('explore')">
                        {{ S('看景点资料', 'Explore attraction details') }} ↗
                      </button>
                    </div>
                  </div>
                  <details v-if="messages.length > 2" class="station-chat-history">
                    <summary>{{ S('查看本次较早对话', 'Earlier in this conversation') }}</summary>
                    <p v-for="(m, index) in messages.slice(0, -2)" :key="index">
                      <b>{{ m.role === 'user' ? S('您', 'You') : S('接待员', 'Guide') }}：</b
                      >{{ m.text }}
                    </p>
                  </details></template
                >
                <div v-else class="station-chat-empty">
                  <ChatDotRound aria-hidden="true" />
                  <h2>{{ S('有什么想问的？', 'What would you like to know?') }}</h2>
                </div>
                <div v-if="busy" class="station-generating" role="status">
                  <span class="station-dot-pulse">● ● ●</span
                  >{{ S('正在为您准备回答…', 'Preparing your answer…')
                  }}<button @click="cancel">{{ S('取消', 'Cancel') }}</button>
                </div>
              </div>
              <p v-if="voiceError" class="station-audio-note" role="status">{{ voiceError }}</p>
              <p v-if="listenError" class="station-audio-note" role="status">{{ listenError }}</p>
              <div class="station-audio-controls">
                <label
                  ><input type="checkbox" v-model="textOnly" />{{ S('仅文字', 'Text only') }}</label
                ><button
                  v-if="reply && !textOnly"
                  @click="speaking || speechBusy ? stopSpeech() : playAnswer()"
                >
                  {{
                    speaking || speechBusy
                      ? S('停止讲解', 'Stop audio')
                      : S('播放讲解', 'Play answer')
                  }}</button
                ><span v-if="recording" role="status">{{
                  S(
                    '正在聆听，说完后文字会出现在输入框',
                    'Listening. Review the transcription before sending.'
                  )
                }}</span>
              </div>
              <form class="station-chat-input" @submit.prevent="ask()">
                <input
                  v-model="question"
                  maxlength="1000"
                  :placeholder="S('输入您想了解的内容…', 'What would you like to know?')"
                  :aria-label="S('咨询问题', 'Your question')"
                /><button
                  type="button"
                  :class="{ recording }"
                  :disabled="busy || offline"
                  @click="listen"
                >
                  <Microphone aria-hidden="true" />{{
                    recording ? S('停止', 'Stop') : S('说话', 'Speak')
                  }}</button
                ><button
                  class="station-primary"
                  :disabled="busy || offline || !question.trim()"
                  type="submit"
                >
                  {{ S('发送', 'Send') }}<Position aria-hidden="true" />
                </button>
              </form>
            </div>
            <div v-else-if="task === 'explore'" key="explore" class="station-explore">
              <template v-if="selectedSpot"
                ><button class="station-back" @click="backToAttractions">
                  ← {{ S('全部景点', 'All attractions') }}
                </button>
                <div class="station-spot-detail">
                  <div class="station-spot-overview">
                    <ScenicSpotCover
                      class="station-spot-photo"
                      :spot="selectedSpot"
                      framing="natural"
                    />
                    <div class="station-spot-summary">
                      <h1>{{ t(selectedSpot.spot_name) }}</h1>
                      <p>{{ t(selectedSpot.description) }}</p>
                      <div class="station-answer-actions">
                        <button
                          class="station-primary"
                          :disabled="offline"
                          @click="
                            ask(
                              S(
                                '请介绍' + selectedSpot.spot_name,
                                'Tell me about ' + t(selectedSpot.spot_name)
                              )
                            )
                          "
                        >
                          {{ S('请数字人讲一讲', 'Ask the guide about this place') }} ✧</button
                        ><button class="station-secondary" @click="addSelectedSpot">
                          {{ S('放进我的游览计划', 'Add to my visit') }} ＋
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="station-spot-notes">
                    <details open>
                      <summary>{{ S('历史与文化', 'History and culture') }}</summary>
                      <p>{{ t(selectedSpot.history_detail) }}</p>
                    </details>
                    <details>
                      <summary>{{ S('值得留意', 'Things to notice') }}</summary>
                      <p>{{ t(selectedSpot.tour_tips) }}</p>
                    </details>
                  </div>
                </div></template
              >
              <template v-else
                ><div class="station-section-title">
                  <h1>{{ S('景点介绍', 'Explore attractions') }}</h1>
                </div>
                <input
                  class="station-search"
                  v-model="search"
                  :placeholder="S('搜索景点', 'Search attractions')"
                  :aria-label="S('搜索景点', 'Search attractions')"
                />
                <div class="station-attraction-grid">
                  <button
                    v-for="spot in pagedSpots"
                    :key="spot.spot_id"
                    @click="selectedSpot = spot"
                  >
                    <ScenicSpotCover :spot="spot" />
                    <div>
                      <h2>{{ t(spot.spot_name) }}</h2>
                      <ArrowRight aria-hidden="true" />
                    </div>
                  </button>
                </div>
                <div v-if="filteredSpots.length > 6" class="station-explore-pages">
                  <button :disabled="explorePage === 0" @click="explorePage--">
                    ← {{ S('上一页', 'Previous') }}</button
                  ><span>{{ explorePage + 1 }} / {{ Math.ceil(filteredSpots.length / 6) }}</span
                  ><button
                    :disabled="(explorePage + 1) * 6 >= filteredSpots.length"
                    @click="explorePage++"
                  >
                    {{ S('下一页', 'Next') }} →
                  </button>
                </div>
                <p v-if="!filteredSpots.length">
                  {{
                    S(
                      '没有找到相关景点，请换个关键词。',
                      'No matching attractions. Try another keyword.'
                    )
                  }}
                </p></template
              >
            </div>
            <div v-else-if="task === 'facilities'" key="facilities" class="station-facilities">
              <div class="station-section-title">
                <h1>{{ S('景点与设施', 'Attractions and facilities') }}</h1>
              </div>
              <div class="station-choice-row station-wayfinding-tabs">
                <button
                  :aria-pressed="wayfindingKind === 'exits'"
                  @click="selectWayfinding('exits')"
                >
                  {{ S('出入口', 'Exits') }}</button
                ><button
                  :aria-pressed="wayfindingKind === 'attractions'"
                  @click="selectWayfinding('attractions')"
                >
                  {{ S('景点', 'Attractions') }}</button
                ><button
                  :aria-pressed="wayfindingKind === 'services'"
                  @click="selectWayfinding('services')"
                >
                  {{ S('服务设施', 'Facilities') }}
                </button>
              </div>
              <input
                v-if="wayfindingKind === 'attractions'"
                class="station-search"
                v-model="facilitySearch"
                :placeholder="S('搜索目的景点', 'Find an attraction')"
                :aria-label="S('搜索目的景点', 'Find an attraction')"
              />
              <div class="station-facility-grid">
                <button
                  v-for="item in facilityItems"
                  :key="item.key"
                  :disabled="item.disabled || busy || offline"
                  @click="showDirections(item.key, item.name)"
                >
                  <Location class="station-facility-icon" aria-hidden="true" /><strong>{{
                    item.name
                  }}</strong
                  ><small>{{ item.kind }}</small
                  ><ArrowRight class="station-facility-arrow" aria-hidden="true" />
                </button>
              </div>
              <div
                v-if="wayfindingKind === 'services' && !station?.facilities.some((f) => f.verified)"
                class="station-facility-note"
              >
                <InfoFilled aria-hidden="true" />
                <p>
                  {{
                    S(
                      '本站尚未发布经核实的卫生间、饮水点等设施位置。请咨询现场工作人员，系统不会推测标注。',
                      'Verified restroom and drinking-water locations have not been published for this station. Please ask on-site staff.'
                    )
                  }}
                </p>
              </div>
              <div v-if="directions" ref="directionsResult" class="station-direction-result">
                <StationWalkingDirections
                  :directions="directions"
                  :origin-name="stationName || S('本站', 'This station')"
                  :destination-name="directionTitle"
                />
              </div>
            </div>
          </Transition>
        </section>
      </div>
    </template>
    <div v-else class="station-splash" role="alert">
      <h1>{{ S('本站暂时无法连接', 'This station is temporarily unavailable') }}</h1>
      <p>{{ t(error) }}</p>
      <button class="station-primary" @click="load">{{ S('重新连接', 'Reconnect') }}</button>
    </div>
    <div v-if="showShare" class="station-overlay" @keydown.esc="showShare = false">
      <section
        v-dialog-focus
        class="station-dialog station-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-share-title"
      >
        <button
          class="station-dialog-close"
          @click="showShare = false"
          :aria-label="S('关闭', 'Close')"
        >
          ×
        </button>
        <h2 id="station-share-title">
          {{ S('手机扫码，继续这段旅程', 'Scan and continue on your phone') }}
        </h2>
        <p>
          {{
            S(
              '景点顺序、步行路线和预计用时会一起带走。',
              'Your stop order, walking route and estimated time travel with you.'
            )
          }}
        </p>
        <img
          v-if="shareQr && remainingSeconds > 0"
          :src="shareQr"
          :alt="S('扫码领取当前游览方案', 'Scan to receive this itinerary')"
        />
        <div v-else class="station-qr-placeholder">
          {{
            shareBusy
              ? S('正在准备领取码…', 'Preparing your code…')
              : S('领取码已失效', 'This code has expired')
          }}
        </div>
        <p class="station-share-clock" v-if="remainingSeconds > 0">
          {{ Math.floor(remainingSeconds / 60) }}:{{
            String(remainingSeconds % 60).padStart(2, '0')
          }}
          {{ S('内有效 · 仅限领取一次', 'remaining · one recipient') }}
        </p>
        <p v-if="shareError" role="alert">{{ t(shareError) }}</p>
        <button
          v-if="!shareQr || !remainingSeconds"
          class="station-primary"
          :disabled="shareBusy"
          @click="share"
        >
          {{ S('重新生成领取码', 'Generate a new code') }}</button
        ><a
          v-if="shareUrl && remainingSeconds > 0"
          :href="shareUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ S('在本机预览领取页', 'Preview pickup on this device') }} ↗</a
        >
        <p class="station-share-note">
          {{
            S(
              '领取后可结束本次使用，手机行程会独立保留。',
              'After pickup, you can finish here. Your phone itinerary remains available.'
            )
          }}
        </p>
        <button class="station-secondary" @click="reset()">
          {{ S('完成，结束本次使用', 'Done, finish this visit') }}
        </button>
      </section>
    </div>
    <div v-if="idleRemaining !== null" class="station-overlay station-idle-overlay">
      <section
        v-dialog-focus
        class="station-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="station-idle-title"
      >
        <h2 id="station-idle-title">
          {{ S('我们会为下一位游客准备好屏幕', 'This screen will reset for the next visitor') }}
        </h2>
        <p>
          {{ idleRemaining }}
          {{
            S(
              '秒后结束本次使用，已领取的手机方案不受影响。',
              'seconds until reset. A plan already received on your phone is safe.'
            )
          }}
        </p>
        <div class="station-dialog-actions">
          <button class="station-secondary" @click="reset()">{{ S('结束使用', 'Finish') }}</button
          ><button class="station-primary" @click="idle.touch">
            {{ S('我还在，继续使用', 'I am here, keep going') }}
          </button>
        </div>
      </section>
    </div>
    <div v-if="endConfirm" class="station-overlay">
      <section
        v-dialog-focus
        class="station-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-end-title"
      >
        <h2 id="station-end-title">{{ S('结束本次使用？', 'Finish this visit?') }}</h2>
        <p>
          {{
            S(
              '屏幕上的对话和选择会清空。已领取的手机方案会保留。',
              'This screen will clear your conversation and choices. A plan already received on your phone will remain available.'
            )
          }}
        </p>
        <div class="station-dialog-actions">
          <button class="station-secondary" @click="endConfirm = false">
            {{ S('继续使用', 'Keep using') }}</button
          ><button class="station-primary" @click="reset()">
            {{ S('结束并复位', 'Finish and reset') }}
          </button>
        </div>
      </section>
    </div>
    <audio
      ref="audio"
      @play="speaking = true"
      @ended="audioEnded"
      @pause="speaking = false"
      @error="speaking = false"
    />
  </main>
</template>
<style src="./station.scss" lang="scss"></style>
