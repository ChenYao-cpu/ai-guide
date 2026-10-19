<script setup lang="ts">import LanguageSwitch from '@/components/LanguageSwitch.vue'
import { t, locale } from '@/i18n'

import BrandLogo from '@/components/BrandLogo.vue'
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { wgs84ToGcj02 } from '../../../../shared/coordinates.js'
import { roadPaths } from '@/utils/routeGeometry'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Close,
  Compass,
  Delete,
  Guide,
  Location,
  OfficeBuilding,
  Promotion,
  Search,
  User,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getVisitorSpotList, getVisitorGuideList, getVisitorRouteList, getRouteRecommendation, aiChatRecommend, getTourLiveInfo } from '@/api/visitor'
import type { RouteRecommendationResult } from '@/api/visitor'
import type { DigitalGuide } from '@/api/digitalHuman'
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue'
import QrFloating from '@/components/QrFloating.vue'
import ScenicVisitContext from '@/components/ScenicVisitContext.vue'
import VisitorAtmosphere from '@/components/VisitorAtmosphere.vue'
import RouteOverview from '@/components/RouteOverview.vue'
import { getRouteOverview, type RouteOverviewData } from '@/api/tourExperience'
import { loadScenicMap } from '@/utils/leaflet'

const router = useRouter()
const mapDiv = ref<HTMLDivElement | null>(null)
let leafletMap: any = null
let leafletMarkers: any[] = []
let mapHasFittedSpots = false
let mapResizeObserver: ResizeObserver | null = null
let scenicBounds: any = null
let mapIsOverview = true
let routeLineLayer:any = null
const mapLoadError=ref(false), routePreview=ref<RouteOverviewData|null>(null)
const routePreviewLoading=ref(false),routePreviewError=ref(false)
let previewVersion=0,previewController:AbortController|undefined

// 高德瓦片（无需 API Key，国内可用）
const AMAP_TILE = 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

function loadLeaflet(): Promise<any> {
  return loadScenicMap()
}

function initLeafletMap() {
  if (!mapDiv.value || leafletMap) return
  loadLeaflet().then((L) => {
    if (!mapDiv.value || leafletMap) return
    leafletMap = L.map(mapDiv.value, {
      center: [39.997, 116.269],
      zoom: 14,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBoundsViscosity: 1,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer(AMAP_TILE, { maxZoom: 18 }).addTo(leafletMap)
    leafletMap.on('zoomstart dragstart', () => { mapIsOverview = false })
    mapLoadError.value=false
    refreshMapMarkers(L)
    drawSelectedRoute(L)
    if (typeof ResizeObserver !== 'undefined') {
      mapResizeObserver = new ResizeObserver(() => {
        if (!leafletMap) return
        leafletMap.invalidateSize({ pan: false })
        updateScenicViewport(mapIsOverview)
      })
      mapResizeObserver.observe(mapDiv.value)
    }
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize() }, 300)
  }).catch(()=>{mapLoadError.value=true})
}

function drawSelectedRoute(L=(window as any).L) {
 if(!L||!leafletMap)return
 if(routeLineLayer)leafletMap.removeLayer(routeLineLayer)
 routeLineLayer=null
 const paths=roadPaths(routePreview.value)
 if(paths.length)routeLineLayer=L.polyline(paths,{color:'#7758ca',weight:5,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(leafletMap)
 refreshMapMarkers(L)
}
async function refreshRoutePreview(){
 const own=++previewVersion;previewController?.abort();routePreviewError.value=false
 const ids=[...selectedSpotIds.value]
 routePreview.value=null;drawSelectedRoute()
 if(!ids.length){routePreview.value=null;routePreviewLoading.value=false;drawSelectedRoute();return}
 previewController=new AbortController();routePreviewLoading.value=true
 const plan=activeMenuTab.value==='personal'?preferenceRecommendation.value:null
 try{const response=await getRouteOverview(ids,plan?.pace||walkingPace.value,previewController.signal,plan?{start_area:plan.start_area,end_area:plan.end_area,avoid_steps:plan.avoid_steps,reserve:plan.queue_reserve_minutes}:undefined);if(own!==previewVersion)return;if(!response.data.success)throw new Error();routePreview.value=response.data.data;drawSelectedRoute()}
 catch(e:any){if(own===previewVersion&&e.code!=='ERR_CANCELED'){routePreview.value=null;routePreviewError.value=true;drawSelectedRoute()}}
 finally{if(own===previewVersion)routePreviewLoading.value=false}
}

function refreshMapMarkers(L?: any) {
  const Lref = L || (window as any).L
  if (!Lref || !leafletMap) return
  const spots = spotList.value.filter((s: any) => s.latitude && s.longitude && s.latitude !== 0)
  leafletMarkers = leafletMarkers.filter((marker: any) => {
    if (spots.some((spot: any) => spot.spot_id === marker.spotId)) return true
    leafletMap.removeLayer(marker)
    return false
  })
  const bounds = Lref.latLngBounds([])
  spots.forEach((s: any, i: number) => {
    const isSelected = selectedSpotIds.value.has(s.spot_id)
    const size = isSelected ? 28 : 22
    const icon = Lref.divIcon({
      className: 'spot-marker',
      html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center"><div style="box-sizing:border-box;width:${size}px;height:${size}px;border-radius:50%;background:${isSelected ? '#7356c5' : '#151925'};border:2px solid #fff;box-shadow:0 4px 12px rgba(18,25,46,.26);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;transition:background .2s,box-shadow .2s">${isSelected ? [...selectedSpotIds.value].indexOf(s.spot_id)+1 : i + 1}</div></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
    const mapPoint = wgs84ToGcj02(Number(s.latitude), Number(s.longitude))
    bounds.extend(mapPoint)
    let marker = leafletMarkers.find((m: any) => m.spotId === s.spot_id)
    if (marker) {
      // 选择景点只更新样式，保留已打开的位置说明与地图视角。
      marker.setIcon(icon).setLatLng(mapPoint)
    } else {
      marker = Lref.marker(mapPoint, { icon, title: `${i + 1} ${t(s.spot_name)}` }).addTo(leafletMap)
      marker.spotId = s.spot_id
      const content = document.createElement('div')
      const title = document.createElement('b')
      title.textContent = `${i + 1} ${t(s.spot_name)}`
      content.append(title, document.createElement('br'), document.createTextNode(t(s.location || '景点游览点')))
      marker.bindPopup(content)
      marker.on('click', () => toggleSpot(s.spot_id))
      leafletMarkers.push(marker)
    }
  })
  if (bounds.isValid()) scenicBounds = bounds
  if (!mapHasFittedSpots && scenicBounds) {
    updateScenicViewport(true)
    mapHasFittedSpots = true
  }
}

function updateScenicViewport(showOverview = false) {
  const L = (window as any).L
  if (!leafletMap || !scenicBounds || !L) return
  const size = leafletMap.getSize()
  // 个性化标签页会隐藏地图，不以 0px 容器计算缩放下限。
  if (size.x <= 40 || size.y <= 40) return
  // 范围来自实际景点，少量留边用于完整显示标记；不是官方景区边界。
  const overviewZoom = Math.min(16, Math.floor(leafletMap.getBoundsZoom(scenicBounds, false, L.point(40, 40)) * 4) / 4)
  leafletMap.setMinZoom(overviewZoom)
  leafletMap.setMaxBounds(scenicBounds.pad(0.12))
  if (showOverview) {
    leafletMap.closePopup()
    leafletMap.fitBounds(scenicBounds, { padding: [20, 20], maxZoom: 16, animate: false })
    mapIsOverview = true
  }
}

function showMapOverview() { updateScenicViewport(true) }

function focusMapSpot(id: number) {
  const marker = leafletMarkers.find((m: any) => m.spotId === id)
  if (!marker || !leafletMap) return
  mapIsOverview = false
  leafletMap.setView(marker.getLatLng(), 18, { animate: false })
  marker.openPopup()
}

type PlanningMode = 'route' | 'personal'
const activeMenuTab = ref<PlanningMode>('route')
const personalMapOpen=ref(false)
const recoveryTour=ref<{id:number;spot:string;at:number}|null>(null),resuming=ref(false)
try{const saved=JSON.parse(sessionStorage.getItem('zhiyou-active-tour')||'null');if(saved&&Number.isSafeInteger(saved.id)&&Date.now()-saved.at<86400000&&sessionStorage.getItem('xingyun-tour-'+saved.id))recoveryTour.value=saved}catch{/* No valid local tour. */}
async function resumeTour(){
 if(!recoveryTour.value||resuming.value)return
 resuming.value=true
 try{const id=recoveryTour.value.id;const response=await getTourLiveInfo(id)
 if(!response.data.success||response.data.data?.live_status===2){dismissRecovery();ElMessage.info(t('本次导览已结束，请返回重新规划'));return}
 const failure=await router.push({path:props.tourPathPrefix+id});if(failure)throw failure
 }catch{ElMessage.error(t('暂时无法恢复导览，请重试'))}finally{resuming.value=false}
}
function dismissRecovery(){recoveryTour.value=null;sessionStorage.removeItem('zhiyou-active-tour')}
// 两种规划方式各自保留行程与数字人，切换模块不修改另一份行程。
const drafts = reactive<Record<PlanningMode, {
  guide: DigitalGuide | null
  spotIds: Set<number>
  routeId: number | null
  visitorName: string
}>>({
  route: { guide: null, spotIds: new Set(), routeId: null, visitorName: '' },
  personal: { guide: null, spotIds: new Set(), routeId: null, visitorName: '' },
})
const activeDraft = computed(() => drafts[activeMenuTab.value])
const guidePickerVisible = ref(false)
const guidePickerMode = ref<PlanningMode>('route')
const openGuidePicker = () => {
  guidePickerMode.value = activeMenuTab.value
  guidePickerVisible.value = true
}
// 选择卡片展示后端保存的角色照片（不再按 3D/VRM 模型文件名分组）。
const modelCategories = computed(() => {
  const models = guideList.value.map(g => ({
    guideId: g.guide_id,
    name: g.name,
    voice: g.voice_style || '',
    poster: g.poster_image || g.avatar || '',
    voiceLabel: g.render_mode === 'xingyun' ? (g.voice_label || '星云应用音色') : (g.voice_style?.startsWith('male_') ? '男声' : '女声'),
  }))
  return models.length ? [{ label: t('选择数字人'), models }] : []
})
const visitorName = computed({ get: () => activeDraft.value.visitorName, set: value => { activeDraft.value.visitorName = value } })
const selectedGuide = computed(() => activeDraft.value.guide)
const selectedSpotIds = computed({ get: () => activeDraft.value.spotIds, set: value => { activeDraft.value.spotIds = value } })
const loading = ref(false)
const starting = ref(false)
const startError = ref('')
let pendingTour: { key: string; sessionId: number; avatarToken?: string } | null = null
const guideList = ref<DigitalGuide[]>([])
const guideChoicePoster = computed(() => {
  const guide = selectedGuide.value || guideList.value[0]
  return guide?.poster_image || guide?.avatar || ''
})
const guideChoicePosterFailed = ref(false)
watch(guideChoicePoster, () => { guideChoicePosterFailed.value = false })
const routeList = ref<any[]>([])
const selectedRouteId = computed({ get: () => activeDraft.value.routeId, set: value => { activeDraft.value.routeId = value } })
const spotList = ref<any[]>([])
const weatherCoordinates = computed(() => {
  const located = spotList.value.filter(spot => Number.isFinite(Number(spot.latitude)) && Number.isFinite(Number(spot.longitude)) && Number(spot.latitude) !== 0 && Number(spot.longitude) !== 0)
  if (!located.length) return { latitude: 39.999, longitude: 116.273 }
  return {
    latitude: Number((located.reduce((sum, spot) => sum + Number(spot.latitude), 0) / located.length).toFixed(4)),
    longitude: Number((located.reduce((sum, spot) => sum + Number(spot.longitude), 0) / located.length).toFixed(4)),
  }
})
const searchKeyword = ref('')
const categoryFilter = ref('all')
const showSelectedOnly = ref(false)
const detailVisible = ref(false)
const activeSpot = ref<any>(null)

const props = withDefaults(defineProps<{ tourPathPrefix?: string }>(), { tourPathPrefix: '/visitor/' })
const selectedPreferences = ref<string[]>([])
const preferenceRecommendation = ref<RouteRecommendationResult | null>(null)
const preferenceRecommendationLoading = ref(false)
const timeBudget = ref(120)
const walkingPace = ref<'standard' | 'relaxed'>('standard')
const startArea = ref<'auto' | 'east' | 'north' | 'south'>('auto')
const endArea = ref<'auto' | 'east' | 'north' | 'south'>('east')
const queueReserve = ref(10)
const avoidSpot = ref(0)
const budgetOptions = [60, 90, 120, 180, 240, 360]
const planningOptions = computed(() => ({ time_budget_minutes: timeBudget.value, pace: walkingPace.value, start_area: startArea.value,
  end_area: endArea.value, queue_reserve_minutes: queueReserve.value, excluded_spot_ids: avoidSpot.value ? [avoidSpot.value] : [] }))
const plannerSignature = computed(() => JSON.stringify([selectedPreferences.value, planningOptions.value]))
const generatedSignature = ref('')
const planNeedsRefresh = computed(() => !!preferenceRecommendation.value && generatedSignature.value !== plannerSignature.value)
const recommendationReasons = computed(() => new Map((preferenceRecommendation.value?.score_details || []).map(item => [item.spot_id, item])))
const preferenceOptions = [
  { value: 'history', icon: OfficeBuilding, label: '历史文化', hint: '宫廷院落 · 建筑故事' },
  { value: 'nature', icon: Compass, label: '自然风光', hint: '湖岸 · 园中园 · 岛景' },
  { value: 'photography', icon: Camera, label: '影像记录', hint: '桥景 · 倒影 · 构图' },
  { value: 'family', icon: User, label: '亲子游览', hint: '趣味观察 · 少台阶' },
  { value: 'comprehensive', icon: Guide, label: '综合游览', hint: '兼顾多种景点特色' },
]
const preferenceCount = (value: string) => spotList.value.filter(spot => {
  const profile = spot.preference_profile
  if (value === 'comprehensive') return !!profile || !!spot.category
  if (profile) return Number(profile.affinities?.[value]) >= 3 && (value !== 'family' || !profile.stairs)
  return ({ history: ['historical', 'cultural'], nature: ['natural'], photography: ['cultural', 'natural'], family: ['comprehensive'] }[value] || []).includes(spot.category)
}).length

const categoryLabels: Record<string, string> = {
  cultural: '文化古迹',
  historical: '历史遗迹',
  natural: '自然风光',
  modern: '现代景观',
  comprehensive: '综合景点',
}

const getCategoryLabel = (cat: string) => categoryLabels[cat] || cat
const categoryOptions = computed(() => {
  const cats = new Set<string>()
  for (const spot of spotList.value) cats.add(spot.category || t("其他"))
  return [...cats]
})
const filteredSpotList = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return spotList.value.filter((spot) => {
    const category = spot.category || t("其他")
    if (categoryFilter.value !== 'all' && category !== categoryFilter.value) return false
    if (showSelectedOnly.value && !selectedSpotIds.value.has(spot.spot_id)) return false
    if (!keyword) return true
    const fields = [spot.spot_name, spot.description, spot.location, getCategoryLabel(category)]
    const text = fields.flatMap(value => [value || '', t(value)]).join(' ').toLowerCase()
    return text.includes(keyword)
  })
})
const spotCount = computed(() => selectedSpotIds.value.size)
const selectedSpots = computed(() => [...selectedSpotIds.value].map(id => spotList.value.find(spot => spot.spot_id === id)).filter(Boolean))
const selectedSpotNames = computed(() => selectedSpots.value.map(spot => spot.spot_name))
const selectedDuration = computed(() => {
  const estimate = activeMenuTab.value === 'route'
    ? routePreview.value?.total_minutes ?? routeList.value.find(route => route.route_id === selectedRouteId.value)?.estimated_time_minutes
    : preferenceRecommendation.value?.estimated_time_minutes
  return Number(estimate) || selectedSpots.value.reduce((sum, spot) => sum + (Number(spot.visit_duration) || 20), 0)
})
const selectedSummary = computed(() => {
  if (!selectedSpotNames.value.length) return t("暂未选择景点")
  const names = selectedSpotNames.value.slice(0, 4).map(name => t(name)).join(locale.value === 'en' ? ', ' : '、')
  return selectedSpotNames.value.length > 4 ? t("{p0} 等 {p1} 个", {p0: names, p1: selectedSpotNames.value.length}) : names
})

const toggleSpot = (id: number) => {
  const selected = new Set(selectedSpotIds.value)
  selected.has(id) ? selected.delete(id) : selected.add(id)
  selectedSpotIds.value = selected
  selectedRouteId.value = null
  if (activeMenuTab.value === 'personal') preferenceRecommendation.value = null
}

const toggleSpots = (spots: any[]) => {
  const selected = new Set(selectedSpotIds.value)
  const allSelected = spots.every((spot) => selected.has(spot.spot_id))
  for (const spot of spots) allSelected ? selected.delete(spot.spot_id) : selected.add(spot.spot_id)
  selectedSpotIds.value = selected
  selectedRouteId.value = null
}

const getCategoryCount = (cat: string) => spotList.value.filter(spot => (spot.category || '其他') === cat).length
const clearSelection = async () => {
  if (!selectedSpotIds.value.size) return
  const draft = activeDraft.value
  await ElMessageBox.confirm(t("确定清空已选景点吗？"), t("清空选择"), { confirmButtonText: t("清空"), cancelButtonText: t("取消"), type: 'warning' })
    .then(() => { draft.spotIds = new Set(); draft.routeId = null; ElMessage.success(t("已清空选择")) })
    .catch(() => {})
}
const openSpotDetail = (spot: any) => {
  activeSpot.value = spot
  detailVisible.value = true
}

const togglePref = (value: string) => {
  if (value === 'comprehensive') {
    selectedPreferences.value = selectedPreferences.value.includes(value) ? [] : [value]
    return
  }
  const values = selectedPreferences.value.filter(pref => pref !== 'comprehensive')
  selectedPreferences.value = values.includes(value) ? values.filter(pref => pref !== value) : [...values, value]
}

const generatePreferenceRoute = async () => {
  if (preferenceRecommendationLoading.value || aiChatLoading.value) return
  if (!selectedPreferences.value.length) {
    ElMessage.warning(t("请先选择至少一个游览偏好"))
    return
  }
  preferenceRecommendationLoading.value = true
  try {
    const response = await getRouteRecommendation([...selectedPreferences.value], { ...planningOptions.value })
    const body = response.data
    if (body.code !== 0 || !body.data?.spot_ids?.length) {
      ElMessage.error(body.message || t("暂无符合偏好的景点"))
      return
    }
    preferenceRecommendation.value = body.data
    if (body.data.pace) walkingPace.value = body.data.pace
    generatedSignature.value = plannerSignature.value
    drafts.personal.spotIds = new Set(body.data.spot_ids)
    ElMessage.success(t("已生成 {p0} 个景点的个性化路线", {p0: body.data.spot_count}))
  } catch {
    ElMessage.error(t("个性化路线生成失败，请检查后端服务"))
  } finally {
    preferenceRecommendationLoading.value = false
  }
}

// ======================== AI 对话推荐 ========================
const aiChatExpanded = ref(false)
const aiChatMessage = ref('')
const aiChatLoading = ref(false)
const aiChatMessages = ref<Array<{
  role: 'user' | 'ai'
  content: string
  meta?: { mode: string; model?: string; selected?: number; excluded?: number }
}>>([])

const handleAiChatSend = async () => {
  const msg = aiChatMessage.value.trim()
  if (!msg || aiChatLoading.value || preferenceRecommendationLoading.value) return
  aiChatMessages.value.push({ role: 'user', content: msg })
  aiChatMessage.value = ''
  aiChatLoading.value = true

  try {
    const res = await aiChatRecommend(msg, { ...planningOptions.value })
    if ((res.data as any).code === 0) {
      const data = (res.data as any).data
      // 显示 AI 回复
      const reply = data.ai_response || t("已为您推荐 {p0} 个景点（预计 {p1} 分钟）", {p0: data.spot_count, p1: data.total_duration})
      aiChatMessages.value.push({
        role: 'ai',
        content: reply,
        meta: {
          mode: data.answer_mode,
          model: data.model,
          selected: data.spot_count,
          excluded: data.excluded_spot_count,
        },
      })
      // 自动选中推荐景点
      if (data.spot_ids?.length) {
        drafts.personal.spotIds = new Set(data.spot_ids)
        selectedPreferences.value = (data.preferences || []).filter((value: string) => preferenceOptions.some(option => option.value === value))
        if (data.requested_time_minutes) timeBudget.value = data.requested_time_minutes
        if (data.pace) walkingPace.value = data.pace
        if (data.start_area) startArea.value = data.start_area
        preferenceRecommendation.value = data
        generatedSignature.value = plannerSignature.value
      }
    } else {
      aiChatMessages.value.push({ role: 'ai', content: t("抱歉，AI推荐失败：") + ((res.data as any).message || t("未知错误")) })
    }
  } catch (e) {
    aiChatMessages.value.push({ role: 'ai', content: t("抱歉，AI服务请求失败，请稍后重试") })
  } finally {
    aiChatLoading.value = false
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const [guideRes, spotRes, routeRes] = await Promise.all([
      getVisitorGuideList().catch(() => null),
      getVisitorSpotList().catch(() => null),
      getVisitorRouteList().catch(() => null),
    ])
    const guideData = (guideRes as any)?.data
    if (guideData) guideList.value = guideData.data?.guide_list || guideData.guide_list || []

    const spotData = (spotRes as any)?.data
    if (spotData) spotList.value = spotData.data?.spot_list || spotData.spot_list || []
    const routeData = (routeRes as any)?.data
    if (routeData) routeList.value = routeData.data?.route_list || routeData.route_list || []
  } catch { /* public visitor view stays available when individual requests fail */ }
  finally {
    loading.value = false
    nextTick(() => { initLeafletMap(); refreshMapMarkers() })
  }
}

const selectRoute = (route: any) => {
  drafts.route.routeId = route.route_id
  drafts.route.spotIds = new Set(route.spot_ids || [])
  ElMessage.success(t("已选择路线「{p0}」", {p0: route.name}))
}

/**
 * 数字人形象不是单独的皮肤：它与导游人设、声音和讲解风格绑定。
 * 选择形象时同步选择对应导游，避免出现男模型仍使用女导游会话的情况。
 */
const selectGuideModel = (model: { guideId: number }) => {
  drafts[guidePickerMode.value].guide = guideList.value.find((guide) => guide.guide_id === model.guideId) || null
  guidePickerVisible.value = false
}

const startTour = async () => {
  if (starting.value) return
  startError.value = ''
  if (activeMenuTab.value === 'personal' && planNeedsRefresh.value) {
    ElMessage.warning(t("条件已修改，请重新生成路线"))
    return
  }
  if (!selectedSpotIds.value.size) {
    ElMessage.warning(t("请至少选择 1 个景点后继续"))
    return
  }
  if (!selectedGuide.value) { ElMessage.warning(t("请选择数字人形象")); return }
  const name = visitorName.value.trim() || t("游客")
  starting.value = true
  const guideId = selectedGuide.value.guide_id
  const params = new URLSearchParams({
    name: `${name}的导览`,
    guide_id: String(guideId),
    route_id: String(selectedRouteId.value || 0),
    visitor_preferences: activeMenuTab.value === 'personal' ? selectedPreferences.value.join(',') : '',
    spot_ids: JSON.stringify([...selectedSpotIds.value]),
    ...(activeMenuTab.value === 'personal' ? {planning: JSON.stringify({...planningOptions.value, avoid_steps:preferenceRecommendation.value?.avoid_steps})} : {}),
  })

  let navigating = false
  try {
    const key = params.toString()
    if (!pendingTour || pendingTour.key !== key) {
      const response = await fetch(`/tour-session/visitor-create?${key}`, { method: 'POST' })
      const json = await response.json()
      const sid = Number(json?.data?.session_id)
      if (response.ok === false || json?.success === false || !Number.isSafeInteger(sid) || sid <= 0) {
        startError.value = t("创建会话失败: ") + (json?.message || t("未知错误"))
        ElMessage.error(startError.value)
        return
      }
      pendingTour = { key, sessionId: sid, avatarToken: json.data.avatar_access_token }
    }
    const { sessionId: sid, avatarToken } = pendingTour
    if (avatarToken) sessionStorage.setItem('xingyun-tour-' + sid, avatarToken)
    try{sessionStorage.setItem('zhiyou-active-tour',JSON.stringify({id:sid,spot:'',at:Date.now()}))}catch{/* Optional recovery shortcut. */}
    // Keep the loading state until the lazy-loaded tour page actually opens.
    // If navigation fails, retry the existing session rather than creating another.
    navigating = true
    const failure = await router.push({ path: `${props.tourPathPrefix}${sid}` })
    if (failure) throw failure
  } catch (e: any) {
    console.error('[VisitorHome] 导览启动异常:', e)
    startError.value = t(navigating ? '导览页面打开失败，请再次点击开始导览' : '网络异常，请重试')
    ElMessage.error(startError.value)
  } finally {
    starting.value = false
  }
}

const goBack = () => router.push('/login')
onMounted(() => { fetchData() })
onBeforeUnmount(() => {
  previewVersion++;previewController?.abort()
  mapResizeObserver?.disconnect()
  leafletMap?.remove()
  leafletMap = null
})

// 选中变化时刷新地图标记
watch(locale, () => { for (const marker of leafletMarkers) marker.remove(); leafletMarkers = []; nextTick(() => refreshMapMarkers()) })
watch(selectedSpotIds, () => { nextTick(() => refreshMapMarkers()) }, { deep: true })
watch(()=>[[...selectedSpotIds.value],walkingPace.value,preferenceRecommendation.value,activeMenuTab.value],refreshRoutePreview,{deep:true})
// 切到游览路线 tab 时刷新地图尺寸
watch(activeMenuTab, (tab) => {
  if (tab === 'route') {
    nextTick(() => {
      initLeafletMap()
      setTimeout(() => { if (leafletMap) leafletMap.invalidateSize() }, 100)
    })
  }
})
</script>

<style scoped>
.tour-recovery-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 20px;margin:0 0 18px;border-radius:16px;background:#f0edf9;color:#514275;font-size:15px}.tour-recovery-bar>div{display:flex;gap:8px}.tour-recovery-bar strong{font-weight:400}.route-order-note{font-size:13px;line-height:1.6;color:var(--text-secondary);margin:10px 0 0}.selected-route-overview{border-top:1px solid #ece8f5;margin-top:12px;padding-top:4px}
</style>

<template>
  <main class="visitor-home">
    <VisitorAtmosphere />
    <div class="visitor-topbar-shell">
      <header class="visitor-topbar">
        <div class="visitor-brand">
          <h1><BrandLogo /></h1>
        </div>
        <div class="visitor-top-actions">
        <LanguageSwitch />
          <div class="selection-counter"><el-icon><Location /></el-icon><span>{{ $t("已选景点") }}</span><strong>{{ $t(spotCount) }}</strong></div>
          <el-button plain :icon="ArrowLeft" @click="goBack">{{ $t("返回登录") }}</el-button>
        </div>
      </header>
    </div>

    <div class="visitor-intro">
      <svg class="planner-landscape" viewBox="0 0 500 140" fill="none" aria-hidden="true">
        <path d="M0 121Q58 90 92 106L163 40Q173 30 184 42L237 95L286 60Q297 51 307 64L354 112Q425 88 500 119V140H0Z" fill="#d4cdeb" opacity=".5" />
        <path d="M64 140L162 83Q172 77 182 84L252 131L316 99Q330 91 342 104L392 140Z" fill="#bfd8dc" opacity=".48" />
        <g stroke="#959ac5" stroke-width="1.3" stroke-linecap="round" opacity=".65">
          <path d="M296 119Q365 66 434 119M296 126Q365 77 434 126M312 110V120M336 96V106M365 91V101M394 96V106M418 110V120" />
          <path class="planner-ripple" d="M24 127Q86 119 153 130T292 130M341 135H454" />
          <path d="M64 37H114M79 28Q99 19 122 28T163 28" opacity=".55" />
        </g>
      </svg>
      <div>
        <h2>{{ $t("规划行程") }}</h2>
      </div>

      <nav class="visitor-menu" :aria-label='$t("行程规划方式")'>
        <button type="button" class="menu-item" :aria-pressed="activeMenuTab === 'route'" :class="{ active: activeMenuTab === 'route' }" @click="activeMenuTab = 'route'">
          <el-icon><Location /></el-icon>
          <span>{{ $t("浏览路线") }}</span>
        </button>
        <button type="button" class="menu-item" :aria-pressed="activeMenuTab === 'personal'" :class="{ active: activeMenuTab === 'personal' }" @click="activeMenuTab = 'personal'">
          <el-icon><User /></el-icon>
          <span>{{ $t("个性化") }}</span>
        </button>
      </nav>

    </div>

    <aside v-if="recoveryTour" class="tour-recovery-bar"><span>{{ $t('上次导览') }}<strong v-if="recoveryTour.spot"> · {{ $t(recoveryTour.spot) }}</strong></span><div><el-button :loading="resuming" @click="resumeTour">{{ $t('继续导览') }}</el-button><el-button text @click="dismissRecovery">{{ $t('忽略') }}</el-button></div></aside>
    <!-- 两种独立的行程规划方式 -->
    <div v-loading="loading" class="visitor-main">
      <!-- 中间内容区 -->
      <section class="visitor-content">
        <!-- 游览路线选择 TAB -->
        <div v-show="activeMenuTab === 'route'" class="tab-content">
          <!-- 地图与景区信息各占一列 -->
          <div class="map-overview">
          <div class="content-card map-card">
            <div class="map-card-heading"><h3>{{ $t("景区地图") }}</h3><div class="map-heading-actions"><span>{{ $t("点击标记选择景点") }}</span><button type="button" class="map-overview-button" @click="showMapOverview">{{ $t("景区全景") }}</button></div></div>
            <div class="map-container" ref="mapDiv"></div>
            <p v-if="mapLoadError" role="alert">{{ $t('地图暂时无法加载') }} <button type="button" @click="initLeafletMap">{{ $t('重试') }}</button></p>
            <div v-if="spotCount" class="selected-route-overview">
              <p v-if="routePreviewLoading" role="status">{{ $t('正在计算路线详情…') }}</p>
              <p v-else-if="routePreviewError" role="alert">{{ $t('路线详情暂时无法加载') }} <button type="button" @click="refreshRoutePreview">{{ $t('重试') }}</button></p>
              <RouteOverview v-else :overview="routePreview" :show-map="false" compact />
              <p class="route-order-note">{{ $t('紫色线沿园内步道连接，数字表示游览顺序。') }}</p>
            </div>
            <div class="map-spots" v-if="spotList.length">
              <button v-for="(spot, index) in spotList.slice(0, 6)" :key="spot.spot_id" type="button" class="map-spot-tag" @click="focusMapSpot(spot.spot_id)">{{ $t(index + 1) }} {{ $t(spot.spot_name) }}</button>
              <select v-if="spotList.length > 6" class="map-locate-select" :aria-label='$t("定位更多景点")' @change="focusMapSpot(Number(($event.target as HTMLSelectElement).value))">
                <option value="" disabled selected>{{ $t("更多景点 ·") }} {{ $t(spotList.length - 6) }}</option>
                <option v-for="(spot, index) in spotList" :key="spot.spot_id" :value="spot.spot_id">{{ $t(index + 1) }} {{ $t(spot.spot_name) }}</option>
              </select>
            </div>
          </div>
            <ScenicVisitContext :latitude="weatherCoordinates.latitude" :longitude="weatherCoordinates.longitude" :spot-count="spotList.length" :route-count="routeList.length" :guide-count="guideList.length" />
          </div>

          <!-- 推荐路线 -->
          <div class="content-card recommended-routes" v-if="routeList.length > 0">
            <div class="card-title">{{ $t("推荐路线") }}</div>
            <div class="routes-grid">
              <div v-for="route in routeList" :key="route.route_id" class="route-card" :class="{ selected: selectedRouteId === route.route_id }" @click="selectRoute(route)">
                <div v-if="route.cover_image" class="route-cover"><img :src="route.cover_image" :alt="$t(route.name)" loading="lazy" /></div>
                <div class="route-card-top"><span class="route-theme-tag">{{ $t(preferenceOptions.find(pref => pref.value === route.theme)?.label || '综合游览') }}</span><span class="route-time">{{ $t(route.estimated_time_minutes || '--') }} {{ $t("分钟") }}</span></div>
                <h3 class="route-name">{{ $t(route.name) }}</h3>
                <p class="route-desc">{{ $t(route.description || '综合游览路线') }}</p>
                <div class="route-spots"><el-icon :size="14"><Location /></el-icon><span>{{ $t((route.spot_names || []).map((name: string) => $t(name)).join(' → ') || `${route.spot_count || 0} 个景点`) }}</span></div>
                <div class="route-card-bottom"><el-tag size="small" round>{{ $t(route.spot_count || 0) }} {{ $t("个景点") }}</el-tag><span class="route-check" v-if="selectedRouteId === route.route_id"><el-icon><Check /></el-icon>{{ $t("已选择") }}</span></div>
              </div>
            </div>
          </div>

          <!-- 选择景点 -->
          <section class="content-card spot-card-section" :aria-label='$t("选择景点")'>
            <div class="spot-section-heading">
              <h3>{{ $t("选择景点") }}</h3>
              <span class="spot-selection-count"><strong>{{ $t(spotCount) }}</strong> / {{ $t(spotList.length) }} {{ $t("已选") }}</span>
            </div>
            <div class="spot-selection-tools">
              <el-input v-model="searchKeyword" :prefix-icon="Search" :placeholder='$t("搜索景点")' clearable />
              <el-button :type="showSelectedOnly ? 'primary' : 'default'" :aria-pressed="showSelectedOnly" plain @click="showSelectedOnly = !showSelectedOnly">{{ $t("只看已选") }}</el-button>
              <el-button plain @click="toggleSpots(filteredSpotList)" :disabled="!filteredSpotList.length">{{ $t(filteredSpotList.length && filteredSpotList.every(spot => selectedSpotIds.has(spot.spot_id)) ? '取消全选' : '全选当前结果') }}</el-button>
              <el-button plain :icon="Delete" @click="clearSelection" :disabled="spotCount === 0">{{ $t("清空") }}</el-button>
            </div>
            <div class="spot-category-filters" role="group" :aria-label='$t("景点分类")'>
              <button type="button" :class="{ active: categoryFilter === 'all' }" :aria-pressed="categoryFilter === 'all'" @click="categoryFilter = 'all'">{{ $t("全部") }}<span>{{ $t(spotList.length) }}</span></button>
              <button v-for="cat in categoryOptions" :key="cat" type="button" :class="{ active: categoryFilter === cat }" :aria-pressed="categoryFilter === cat" @click="categoryFilter = cat">{{ $t(getCategoryLabel(cat)) }}<span>{{ $t(getCategoryCount(cat)) }}</span></button>
            </div>
            <div v-if="spotCount" class="spot-selection-summary"><span>{{ $t("已选") }}</span><p>{{ $t(selectedSummary) }}</p></div>
            <div v-if="spotList.length === 0 && !loading" class="empty-hint compact"><el-icon><Location /></el-icon><strong>{{ $t("暂无景点数据") }}</strong></div>
            <div v-else-if="filteredSpotList.length === 0 && !loading" class="empty-hint compact"><el-icon><Search /></el-icon><strong>{{ $t(showSelectedOnly && !spotCount ? '尚未选择景点' : '未找到相关景点') }}</strong></div>
            <div v-else class="spot-options-grid">
              <article v-for="spot in filteredSpotList" :key="spot.spot_id" :data-spot-id="spot.spot_id" class="spot-option" :class="{ selected: selectedSpotIds.has(spot.spot_id) }">
                <button class="spot-choice" type="button" :aria-label="$t(selectedSpotIds.has(spot.spot_id) ? '取消选择 {p0}' : '选择景点 {p0}', {p0: spot.spot_name})" :aria-pressed="selectedSpotIds.has(spot.spot_id)" @click="toggleSpot(spot.spot_id)">
                  <span class="spot-choice-check" aria-hidden="true"><el-icon v-if="selectedSpotIds.has(spot.spot_id)"><Check /></el-icon></span>
                  <img v-if="spot.image_path" :src="spot.image_path" alt="" class="spot-option-photo" loading="lazy" />
                  <span class="spot-choice-copy">
                    <span class="spot-choice-title"><strong>{{ $t(spot.spot_name) }}</strong></span>
                  </span>
                </button>
                <button class="spot-option-detail" type="button" :aria-label="$t('{p0}详情', {p0: spot.spot_name})" @click="openSpotDetail(spot)">{{ $t("详情") }}<el-icon><ArrowRight /></el-icon></button>
              </article>
            </div>
          </section>
        </div>

        <!-- 个性化选择 TAB -->
        <div v-show="activeMenuTab === 'personal'" class="tab-content">
          <section v-if="routePreview" class="content-card"><button type="button" class="map-overview-button" :aria-expanded="personalMapOpen" @click="personalMapOpen=!personalMapOpen">{{ $t(personalMapOpen?'收起路线地图':'查看路线地图') }}</button><RouteOverview v-if="personalMapOpen" :overview="routePreview" compact /></section>
          <!-- 游览偏好 -->
          <div class="content-card">
            <div class="spot-section-heading"><h3>{{ $t("游览偏好") }}</h3><span class="spot-selection-count">{{ $t(spotList.length) }} {{ $t("个景点可规划") }}</span></div>
            <div class="preference-grid">
              <button v-for="pref in preferenceOptions" :key="pref.value" type="button" class="pref-card" :class="{ selected: selectedPreferences.includes(pref.value) }" :aria-pressed="selectedPreferences.includes(pref.value)" :disabled="preferenceRecommendationLoading || aiChatLoading" @click="togglePref(pref.value)">
                <span class="pref-name"><el-icon><component :is="pref.icon" /></el-icon>{{ $t(pref.label) }}<el-icon v-if="selectedPreferences.includes(pref.value)"><Check /></el-icon></span>
                <small>{{ $t(pref.hint) }}</small><small class="pref-coverage">{{ $t(preferenceCount(pref.value)) }} {{ $t("个匹配景点") }}</small>
              </button>
            </div>
            <p class="preference-note">{{ $t("兴趣可多选；综合游览单独选择。亲子路线降低步行速度并避开台阶较多的景点。") }}</p>
            <div class="planning-controls">
              <label>{{ $t("可用时长") }}<select v-model.number="timeBudget" :aria-label='$t("可用时长")' :disabled="preferenceRecommendationLoading || aiChatLoading"><option v-if="!budgetOptions.includes(timeBudget)" :value="timeBudget">{{ $t(timeBudget) }} {{ $t("分钟") }}</option><option v-for="minutes in budgetOptions" :key="minutes" :value="minutes">{{ $t(minutes) }} {{ $t("分钟") }}</option></select></label>
              <label>{{ $t("步行节奏") }}<select v-model="walkingPace" :aria-label='$t("步行节奏")' :disabled="preferenceRecommendationLoading || aiChatLoading"><option value="standard">{{ $t("正常游览") }}</option><option value="relaxed">{{ $t("轻松慢走 · 少台阶") }}</option></select></label>
              <label>{{ $t("出发区域") }}<select v-model="startArea" :aria-label='$t("出发区域")' :disabled="preferenceRecommendationLoading || aiChatLoading"><option value="auto">{{ $t("按兴趣选择首站") }}</option><option value="east">{{ $t("东宫门附近 · 仁寿殿") }}</option><option value="north">{{ $t("北宫门附近 · 苏州街") }}</option><option value="south">{{ $t("新建宫门附近 · 铜牛") }}</option></select></label>
              <label>{{ $t("离园区域") }}<select v-model="endArea" :aria-label='$t("离园区域")' :disabled="preferenceRecommendationLoading || aiChatLoading"><option value="auto">{{ $t("末站结束 · 不计算离园") }}</option><option value="east">{{ $t("东宫门附近") }}</option><option value="north">{{ $t("北宫门附近") }}</option><option value="south">{{ $t("新建宫门附近") }}</option></select></label>
              <label>{{ $t("排队预留") }}<select v-model.number="queueReserve" :aria-label='$t("排队预留")' :disabled="preferenceRecommendationLoading || aiChatLoading"><option v-for="minutes in [0,10,20,30,60]" :key="minutes" :value="minutes">{{ $t(minutes) }} {{ $t("分钟 · 自行预留") }}</option></select></label>
              <label>{{ $t("临时避开") }}<select v-model.number="avoidSpot" :aria-label='$t("临时避开景点")' :disabled="preferenceRecommendationLoading || aiChatLoading"><option :value="0">{{ $t("不避开景点") }}</option><option v-for="spot in spotList" :key="spot.spot_id" :value="spot.spot_id">{{ $t(spot.spot_name) }}</option></select></label>
            </div>
            <div class="preference-action">
              <el-button type="primary" :loading="preferenceRecommendationLoading" :disabled="aiChatLoading || !selectedPreferences.length" @click="generatePreferenceRoute">{{ $t("生成个性化路线") }}</el-button>
            </div>
          </div>
        <!-- AI 对话推荐 -->
        <div class="ai-chat-panel" :class="{ expanded: aiChatExpanded }">
          <button type="button" class="ai-chat-header" :aria-expanded="aiChatExpanded" @click="aiChatExpanded = !aiChatExpanded">
            <div class="ai-chat-title">

              <span>{{ $t("AI 推荐") }}</span>

            </div>
            <el-icon :class="{ rotated: aiChatExpanded }"><ArrowDown /></el-icon>
          </button>
          <div v-show="aiChatExpanded" class="ai-chat-body">
            <!-- 对话消息区 -->
            <div class="ai-chat-messages">
              <div v-if="!aiChatMessages.length" class="ai-chat-placeholder">{{ $t("试试：带孩子玩2小时，喜欢自然风光") }}</div>
              <div v-for="(msg, i) in aiChatMessages" :key="i" class="ai-msg" :class="msg.role">
                <div>
                  <div class="ai-msg-bubble">{{ msg.content }}</div>
                  <div v-if="msg.role === 'ai' && msg.meta" class="ai-evidence">

                    <span v-if="msg.meta.selected">{{ $t("精选") }} {{ $t(msg.meta.selected) }} {{ $t("个景点") }}</span>
                    <span v-if="msg.meta.excluded">{{ $t(msg.meta.excluded) }} {{ $t("个未纳入本次行程") }}</span>
                  </div>
                </div>
              </div>
              <div v-if="aiChatLoading" class="ai-msg ai">
                <div class="ai-msg-bubble typing"><span></span><span></span><span></span></div>
              </div>
            </div>
            <!-- 输入区 -->
            <div class="ai-chat-input">
              <el-input
                v-model="aiChatMessage"
                :placeholder='$t("描述你的游览需求...")'
                :aria-label='$t("游览需求")'
                :disabled="aiChatLoading || preferenceRecommendationLoading"
                @keyup.enter="handleAiChatSend"
                size="small"
              />
              <el-button type="primary" size="small" :loading="aiChatLoading" :disabled="!aiChatMessage.trim() || preferenceRecommendationLoading" :aria-label='$t("发送游览需求")' @click="handleAiChatSend">
                <el-icon><Promotion /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
          <section class="content-card personal-itinerary" :aria-label='$t("个性化行程")'>
            <div class="spot-section-heading"><h3>{{ $t(preferenceRecommendation?.name || '个性化行程') }}</h3><span class="spot-selection-count">{{ $t(spotCount) }} {{ $t("个景点") }}</span></div>
            <p v-if="planNeedsRefresh" class="plan-refresh" role="status">{{ $t("条件已修改，请重新生成路线。") }}</p>
            <template v-if="preferenceRecommendation?.visit_time_minutes !== undefined">
              <div class="plan-metrics"><span><strong>{{ $t(preferenceRecommendation.estimated_time_minutes) }}</strong> / {{ $t(preferenceRecommendation.requested_time_minutes) }} {{ $t("分钟") }}</span><span>{{ $t("停留") }} {{ $t(preferenceRecommendation.visit_time_minutes) }} {{ $t("分钟") }}</span><span>{{ $t("步行") }} {{ $t(preferenceRecommendation.walking_time_minutes) }} {{ $t("分钟 ·") }} {{ $t(((preferenceRecommendation.walking_distance_meters || 0) / 1000).toFixed(1)) }} {{ $t("公里") }}</span><span>{{ $t("休息") }} {{ $t(preferenceRecommendation.rest_time_minutes) }} {{ $t("分钟") }}</span><span>{{ $t("离园") }} {{ $t(preferenceRecommendation.exit_time_minutes || 0) }} {{ $t("分钟") }}</span><span>{{ $t("排队预留") }} {{ $t(preferenceRecommendation.queue_reserve_minutes || 0) }} {{ $t("分钟") }}</span></div>
              <p class="plan-explanation">{{ $t(preferenceRecommendation.start_label) }} · {{ $t(preferenceRecommendation.recommendation_explanation) }}</p>
            </template>
            <p v-if="!spotCount" class="planning-empty">{{ $t("选择游览偏好或使用 AI 推荐，生成你的行程。") }}</p>
            <ol v-else class="personal-spot-list">
              <li v-for="(spot, index) in selectedSpots" :key="spot.spot_id">
                <span class="itinerary-order">{{ $t(index + 1) }}</span>
                <div class="itinerary-copy"><strong>{{ $t(spot.spot_name) }}</strong><small>{{ $t("停留") }} {{ $t(spot.visit_duration || 20) }} {{ $t("分钟") }}<span v-if="recommendationReasons.get(spot.spot_id)?.walk_from_previous_minutes"> · {{ $t(index ? '上一站' : '出发区域') }} {{ $t("步行约") }} {{ $t(recommendationReasons.get(spot.spot_id)?.walk_from_previous_minutes) }} {{ $t("分钟") }}</span></small><p v-if="recommendationReasons.get(spot.spot_id)?.reason" class="itinerary-reason">{{ $t(recommendationReasons.get(spot.spot_id)?.reason) }}</p></div>
                <button type="button" :aria-label="$t('{p0}详情', {p0: spot.spot_name})" @click="openSpotDetail(spot)">{{ $t("详情") }}</button>
                <button type="button" :aria-label="$t('移除 {p0}', {p0: spot.spot_name})" @click="toggleSpot(spot.spot_id)"><el-icon><Close /></el-icon></button>
              </li>
            </ol>
            <details v-if="preferenceRecommendation?.data_basis" class="plan-basis"><summary>{{ $t("推荐依据与时间说明") }}</summary><p>{{ $t(preferenceRecommendation.data_basis) }}</p><p>{{ $t(preferenceRecommendation.end_label) }}。{{ $t(preferenceRecommendation.planning_note) }}</p><p>{{ $t(preferenceRecommendation.accessibility_status) }}</p><a v-for="url in preferenceRecommendation.source_urls" :key="url" :href="url" target="_blank" rel="noopener noreferrer">{{ $t(url.includes('openstreetmap.org') ? '步行路网：OpenStreetMap contributors（ODbL）' : '景点资料：北京市公园管理中心') }}</a></details>
          </section>
        </div>
      </section>

      <!-- 当前模块的数字人选择与导览入口 -->
      <aside class="visitor-start">
        <!-- 开始导览 -->
        <div class="start-panel">
          <div class="start-heading">
          <h2>{{ $t(activeMenuTab === 'route' ? '路线导览' : '个性化导览') }}</h2>
          <div class="start-summary"><span>{{ $t(spotCount) }} {{ $t("个景点") }}</span><span v-if="spotCount">{{ $t("约") }} {{ $t(selectedDuration) }} {{ $t("分钟") }}</span></div>
          <p v-if="!spotCount" class="start-hint">{{ $t(activeMenuTab === 'route' ? '请先选择路线或景点' : '请先生成个性化行程') }}</p>
          </div>
          <section class="start-guide-choice" :class="{ 'has-guide': selectedGuide }" :aria-label='$t("当前数字人")'>
            <div class="guide-choice-portrait" aria-hidden="true">
              <span class="guide-choice-aura"></span>
              <img v-if="guideChoicePoster && !guideChoicePosterFailed" :src="guideChoicePoster" alt="" @error="guideChoicePosterFailed = true" />
              <el-icon v-else><User /></el-icon>
            </div>
            <div class="guide-choice-main">
              <div class="guide-choice-heading">
                <span class="guide-choice-label">{{ $t("数字人导游") }}</span>
                <span class="guide-choice-state"><el-icon v-if="selectedGuide" aria-hidden="true"><Check /></el-icon>{{ $t(selectedGuide ? '已选择' : '待选择') }}</span>
              </div>
              <div v-if="selectedGuide" class="chosen-guide"><strong>{{ $t(selectedGuide.name) }}</strong></div>
              <p v-else class="guide-choice-caption">{{ $t("形象与声音") }}</p>
              <el-button plain class="guide-select-button" @click="openGuidePicker">{{ $t(selectedGuide ? '更换数字人' : '选择数字人') }}<el-icon aria-hidden="true"><ArrowRight /></el-icon></el-button>
            </div>
          </section>
          <el-input v-model="visitorName" :placeholder='$t("输入昵称（选填）")' :aria-label='$t("导览昵称")' maxlength="12" />
          <el-button type="primary" size="large" class="start-btn" @click="startTour" :loading="starting" :disabled="spotCount === 0 || !selectedGuide || (activeMenuTab === 'personal' && planNeedsRefresh)">{{ $t("开始导览") }}</el-button>
        </div>
        <p v-if="startError" class="start-error" role="alert">{{ startError }}</p>
      </aside>
    </div>

    <el-dialog v-model="guidePickerVisible" :title="$t(guidePickerMode === 'route' ? '浏览路线' : '个性化') + ' · ' + $t('选择数字人')" width="min(760px, calc(100vw - 32px))" class="guide-picker-dialog" align-center>
          <div class="content-card">
            <div v-for="cat in modelCategories" :key="cat.label" class="model-cat">
              <div class="model-grid">
                <button v-for="m in cat.models" :key="m.guideId" type="button" class="model-card" :class="{ selected: drafts[guidePickerMode].guide?.guide_id === m.guideId }" @click="selectGuideModel(m)">
                  <span class="model-preview">
                    <img v-if="m.poster" :src="m.poster" :alt="$t(m.name)" class="guide-selection-photo" /><span v-else>{{ $t("暂无形象照片") }}</span>
                  </span>
                  <span class="model-name">{{ $t(m.name) }}<small>{{ $t(m.voiceLabel) }}</small></span>
                  <el-icon class="selected-icon" v-if="drafts[guidePickerMode].guide?.guide_id === m.guideId"><Check /></el-icon>
                </button>
              </div>
            </div>
          </div>
      <p v-if="!guideList.length" class="planning-empty">{{ $t("暂无可用数字人") }}</p>
    </el-dialog>

    <el-drawer v-model="detailVisible" size="min(640px, 100vw)" :with-header="false" class="spot-detail-drawer">
      <div v-if="activeSpot" class="spot-detail">
        <header class="spot-detail-hero">
          <button class="spot-detail-close" type="button" :aria-label='$t("关闭景点详情")' @click="detailVisible = false">
            <el-icon><Close /></el-icon>
          </button>
          <span class="spot-category">{{ $t(getCategoryLabel(activeSpot.category || '其他')) }}</span>
          <h2>{{ $t(activeSpot.spot_name) }}</h2>
          <p>{{ $t(activeSpot.description || '暂无景点简介。') }}</p>
        </header>

        <section class="spot-detail-metrics">
          <div><small>{{ $t("建议游览") }}</small><strong>{{ $t(activeSpot.visit_duration || 20) }} {{ $t("分钟") }}</strong></div>
          <div><small>{{ $t("自动播报") }}</small><strong>{{ $t(Math.round(activeSpot.trigger_radius || 50)) }} {{ $t("米内") }}</strong></div>
        </section>

        <section class="spot-location-card">
          <el-icon><Location /></el-icon>
          <div>
            <small>{{ $t("景点位置") }}</small>
            <strong>{{ $t(activeSpot.location || '颐和园景区内') }}</strong>
          </div>
        </section>

        <section v-if="activeSpot.history_detail" class="spot-story-card">
          <div class="spot-section-title"><el-icon><OfficeBuilding /></el-icon><strong>{{ $t("历史与文化") }}</strong></div>
          <p>{{ $t(activeSpot.history_detail) }}</p>
        </section>

        <div class="spot-guide-grid">
          <article v-if="activeSpot.best_season">
            <div class="spot-section-title"><el-icon><Compass /></el-icon><strong>{{ $t("最佳季节") }}</strong></div>
            <p>{{ $t(activeSpot.best_season) }}</p>
          </article>
          <article v-if="activeSpot.photo_tips">
            <div class="spot-section-title"><el-icon><Camera /></el-icon><strong>{{ $t("推荐取景") }}</strong></div>
            <p>{{ $t(activeSpot.photo_tips) }}</p>
          </article>
          <article v-if="activeSpot.tour_tips">
            <div class="spot-section-title"><el-icon><Compass /></el-icon><strong>{{ $t("游览提示") }}</strong></div>
            <p>{{ $t(activeSpot.tour_tips) }}</p>
          </article>
          <article v-if="activeSpot.service_facilities" class="wide">
            <div class="spot-section-title"><el-icon><Guide /></el-icon><strong>{{ $t("周边服务") }}</strong></div>
            <p>{{ $t(activeSpot.service_facilities) }}</p>
          </article>
        </div>

        <footer class="spot-detail-footer">
          <el-button type="primary" size="large" @click="toggleSpot(activeSpot.spot_id)">
            {{ $t(selectedSpotIds.has(activeSpot.spot_id) ? '移出路线' : '加入路线') }}
          </el-button>
        </footer>
      </div>
    </el-drawer>

    <PwaInstallPrompt />
    <QrFloating />
  </main>
</template>

<style lang="scss" scoped>
.visitor-home {
  min-height: 100vh;
  padding: 14px 24px 28px;
  color: var(--ink-900);
  background: var(--glass);
  background-size: auto, 30px 30px, 30px 30px, auto;
}

.visitor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1440px;
  height: 64px;
  margin: 0 auto 14px;
  padding: 0 18px;
  border: 1px solid var(--glass-line);
  border-radius: 16px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}

.visitor-brand {
  display: flex;
  align-items: center;
  gap: 11px;

  .visitor-mark {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 10px;
    color: var(--text);
    background: var(--glass);
    box-shadow: var(--glass-shadow);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  h1 { margin: 0; color: var(--text); font-size: 18px; font-weight: 850; letter-spacing: 0; }
}

.visitor-top-actions { display: flex; align-items: center; gap: 14px; }
.selection-counter { display: flex; align-items: center; gap: 7px; color: var(--ink-500); font-size: 12px;
  .el-icon { color: var(--brand-600); } strong { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 50%; color: var(--brand-700); background: var(--brand-100); font-size: 12px; }
}

.visitor-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  max-width: 1440px;
  margin: 0 auto 18px;
  padding: 22px 30px;
  border: 1px solid var(--glass-line);
  border-radius: 16px;
  color: var(--champagne-text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);

  h2 { margin: 0; color: var(--text); font-size: 24px; font-weight: 850; }
}

.process-steps { display: flex; align-items: center; gap: 10px; padding-bottom: 4px;
  span { display: flex; align-items: center; gap: 7px; color: var(--champagne-text); font-size: 11px; font-weight: 750; letter-spacing: 0; white-space: nowrap; }
  i { display: grid; width: 22px; height: 22px; place-items: center; border: 1px solid var(--glass-line); border-radius: 50%; color: var(--champagne-text); background: var(--glass); font-style: normal; font-size: 9px; }
  b { width: 20px; height: 1px; background: var(--glass); }
}

/* 三栏布局 */
.visitor-main { display: flex; gap: 0; max-width: 1440px; margin: 0 auto; align-items: flex-start; min-height: calc(100vh - 260px); }

/* 左侧菜单 */
.visitor-menu { width: 72px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; padding: 8px 4px; background: var(--glass); border-radius: 12px; border: 1px solid var(--line-soft); }
.menu-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border-radius: 10px; cursor: pointer; font-size: 11px; color: var(--ink-500); transition: all .16s; text-align: center;
  .el-icon { font-size: 20px; }
  &:hover { background: var(--glass); color: var(--brand-700); }
  &.active { background: var(--glass); color: var(--brand-700); font-weight: 700; }
}

/* 中间内容区 */
.visitor-content { flex: 1; min-width: 0; margin: 0 14px; }
.tab-content { display: flex; flex-direction: column; gap: 14px; }
.content-card { background: var(--glass); border: 1px solid var(--line-soft); border-radius: 12px; padding: 16px 18px; }
.card-title { font-size: 16px; font-weight: 800; color: var(--text); margin-bottom: 12px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  .card-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); }
  .panel-total { margin-left: auto; font-size: 12px; color: var(--ink-500); strong { color: var(--brand-700); font-size: 20px; font-weight: 900; } }
}

/* 地图 */
.map-card { padding: 14px 18px; }
.map-container { width: 100%; height: 220px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-soft); background: var(--glass); z-index: 1; margin-bottom: 8px; }
.map-spots { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }
.map-spot-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--glass-line);
  border-radius: 10px;
  background: rgba(99,102,241,0.05);
  color: var(--text);
  font-family: var(--app-font-family);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: .02em;
  white-space: nowrap;
  cursor: pointer;
  transition: background .18s, border-color .18s, color .18s;
  &:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.25); color: var(--champagne-text); }
  &:focus-visible { outline: 2px solid var(--champagne); outline-offset: 3px; }
}
:deep(.leaflet-control-zoom) { border: none !important; box-shadow: var(--glass-shadow) !important; border-radius: 8px !important; overflow: hidden; }
:deep(.leaflet-control-zoom a) { width: 30px !important; height: 30px !important; line-height: 30px !important; }
:deep(.leaflet-popup-content) { margin: 8px 12px; font-size: 13px; }
:deep(.spot-marker) { background: transparent !important; border: none !important; }

/* 路线卡片 */
.routes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.route-card { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 14px 16px 12px; border: 1px solid var(--glass-line); border-radius: 12px; cursor: pointer; background: var(--glass); transition: all .16s;
  &:hover { border-color: var(--glass-line); transform: translateY(-1px); background: var(--glass); box-shadow: var(--glass-shadow); }
  &.selected { border-color: var(--brand-600); background: var(--glass); .route-check { color: var(--brand-700); } }
}
.route-card-top { display: flex; align-items: center; justify-content: space-between; }
.route-theme-tag { display: inline-flex; padding: 2px 8px; border-radius: 999px; color: var(--champagne-text); background: var(--glass); font-size: 10px; font-weight: 750; }
.route-time { color: var(--ink-400); font-size: 11px; }
.route-name { margin: 0; font-size: 15px; font-weight: 850; color: var(--ink-900); }
.route-desc { margin: 0; font-size: 11px; color: var(--ink-500); display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.route-spots { display: flex; align-items: flex-start; gap: 4px; color: var(--ink-500); font-size: 11px; .el-icon { flex-shrink: 0; margin-top: 1px; color: var(--brand-600); } span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
.route-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--glass-line); }
.route-check { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 750; }
.route-select-hint { color: var(--ink-400); font-size: 11px; }

.empty-hint.compact { display: grid; place-items: center; min-height: 120px; color: var(--text-muted); gap: 8px; .el-icon { font-size: 24px; } strong { font-size: 14px; font-weight: 400; } }

/* 个性化 TAB */
.guide-list { display: flex; flex-wrap: wrap; gap: 8px; }
.guide-card { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--line-soft); border-radius: 10px; cursor: pointer; background: var(--glass); transition: all .14s;
  &:hover { border-color: var(--glass-line); }
  &.selected { border-color: var(--brand-600); background: var(--glass); .selected-icon { opacity: 1; } }
  .el-avatar { color: var(--brand-700); background: var(--brand-100); font-size: 11px; font-weight: 800; }
  > span strong { color: var(--ink-900); font-size: 13px; }
}
.preference-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.preference-action { margin-top: 14px; }
.algorithm-result { margin-top: 14px; padding: 13px 14px; border: 1px solid var(--glass-line); border-radius: 10px; background: var(--glass);
  p { margin: 8px 0; color: var(--ink-500); font-size: 11px; line-height: 1.6; }
}
.algorithm-result-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; strong { color: var(--champagne-text); font-size: 14px; } }
.algorithm-route { color: var(--ink-800); font-size: 12px; font-weight: 700; line-height: 1.6; }
.algorithm-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; color: var(--champagne-text); font-size: 11px; }
.pref-card { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--line-soft); border-radius: 8px; cursor: pointer; background: var(--glass); font-size: 12px; font-weight: 650; transition: all .14s;
  &:hover { border-color: var(--glass-line); }
  &.selected { border-color: var(--brand-600); color: var(--brand-700); background: var(--glass); .selected-icon { opacity: 1; } }
  .el-icon:first-child { color: var(--brand-600); font-size: 14px; }
}
.selected-icon { margin-left: auto; opacity: 0; color: var(--brand-600); transition: opacity .14s; }

/* 数字人形象选择 */
.model-cat { margin-bottom: 14px; &:last-child { margin-bottom: 0; } }
.model-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.model-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px 10px; border: 1px solid var(--line-soft); border-radius: 10px; cursor: pointer; background: var(--glass); transition: all .14s; text-align: center;
  &:hover { border-color: var(--glass-line); background: var(--glass); }
  &.selected { border-color: var(--brand-600); background: var(--glass); .model-type { color: var(--text); background: var(--glass); } .selected-icon { opacity: 1; } }
}
.guide-selection-photo{width:100%;height:100%;object-fit:contain}.selected-guide-photo{height:360px;text-align:center}.selected-guide-photo img{height:100%;max-width:100%;object-fit:contain}
.model-preview { width: 80px; height: 110px; display: flex; align-items: center; justify-content: center; }
.model-type { display:grid; width:48px; height:48px; place-items:center; border-radius:12px; color: var(--champagne-text); background: var(--glass); font-size:12px; font-weight:900; letter-spacing:.08em; transition:all .14s; }
.model-name { display:flex; flex-direction:column; gap:2px; font-size:11px; color: var(--text-secondary); font-weight:700; small { color: var(--text-muted); font-size:9px; font-weight:600; } }

/* ======================== AI 对话推荐面板 ======================== */
.ai-chat-panel {
  margin-bottom: 14px;
  border-radius: 14px;
  border: 1px solid var(--glass-line);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  transition: box-shadow 0.2s;

  &.expanded {
    box-shadow: var(--glass-shadow);
  }
}

.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;

  &:hover { background: var(--glass); }

  .el-icon {
    font-size: 14px;
    color: var(--text);
    transition: transform 0.25s ease;
    &.rotated { transform: rotate(180deg); }
  }
}

.ai-chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 750;
  color: var(--text);
  .ai-icon { font-size: 20px; }
}

.ai-chat-body {
  display: flex;
  flex-direction: column;
}

.ai-chat-messages {
  max-height: 240px;
  overflow-y: auto;
  padding: 0 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 80px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--glass); border-radius: 4px; }
}

.ai-chat-placeholder {
  text-align: center;
  padding: 18px 8px;
  color: var(--champagne-text);
  font-size: 12px;
  line-height: 1.8;
}

.ai-msg {
  display: flex;
  max-width: 92%;

  &.user { align-self: flex-end; }
  &.ai { align-self: flex-start; }

  .ai-msg-bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.6;
    word-break: break-word;
  }

  &.user .ai-msg-bubble {
    background: var(--glass);
    color: var(--text);
    border-bottom-right-radius: 4px;
  }

  &.ai .ai-msg-bubble {
    background: var(--glass);
    color: var(--text-secondary);
    border: 1px solid var(--glass-line);
    border-bottom-left-radius: 4px;
    box-shadow: var(--glass-shadow);
  }

  &.ai .typing {
    display: flex;
    gap: 4px;
    padding: 10px 16px;

    span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--glass);
      animation: typing-bounce 1.2s ease-in-out infinite;
      &:nth-child(2) { animation-delay: 0.15s; }
      &:nth-child(3) { animation-delay: 0.3s; }
    }
  }
}

.ai-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 5px 0 0 2px;

  span {
    padding: 3px 7px;
    border: 1px solid var(--glass-line);
    border-radius: 999px;
    color: var(--champagne-text);
    background: var(--glass);
    font-size: 9px;
    font-weight: 700;
  }
}

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

.ai-chat-input {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--glass-line);
  background: var(--glass);

  :deep(.el-input__wrapper) {
    background: var(--glass);
    border-radius: 20px;
  }
}

/* 右侧开始导览 */
.visitor-start { width: 280px; flex-shrink: 0; }
.start-panel { padding: 20px; border-radius: 14px; border: 1px solid var(--glass-line); color: var(--champagne-text); background: var(--glass); box-shadow: var(--glass-shadow);
  h2 { margin: 0 0 14px; color: var(--text); font-size: 17px; font-weight: 850; }
  :deep(.el-input__wrapper) { background: var(--glass); }
  .start-btn { width: 100%; margin-top: 10px; color: var(--text); border-color: var(--brand-600); background: var(--brand-600); font-size: 16px; font-weight: 700; height: 48px; &:hover { color: var(--text); background: var(--brand-700); } }
}

/* 景点详情抽屉 */
:global(.spot-detail-drawer .el-drawer__body) { padding: 0; overflow: auto; background: var(--glass); }
.spot-detail {
  min-height: 100%;
  color: var(--text);
}
.spot-detail-hero {
  position: relative;
  padding: 32px 30px 38px;
  color: var(--text);
  background: var(--glass);
  h2 { margin: 12px 0 10px; font-size: 30px; font-weight: 800; letter-spacing: -.04em; }
  > p { margin: 0; color: var(--text-secondary); font-size: 18px; line-height: 1.9; overflow-wrap: anywhere; }
}
.spot-detail-close {
  position: absolute;
  top: 20px;
  right: 20px;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--glass-line);
  border-radius: 10px;
  color: var(--text);
  cursor: pointer;
  background: rgba(99,102,241,0.08);
  transition: background .15s;
  &:hover { background: var(--glass); }
}
.spot-category {
  display: inline-flex;
  padding: 5px 10px;
  border: 1px solid var(--glass-line);
  border-radius: 999px;
  color: var(--text-muted);
  background: rgba(99,102,241,0.09);
  font-size: 15px;
  font-weight: 800;
}
.spot-detail-metrics {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: -18px 24px 18px;
  overflow: hidden;
  border: 1px solid var(--glass-line);
  border-radius: 14px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
  div { min-width: 0; padding: 15px 12px; background: var(--glass); text-align: center; }
  small { display: block; margin-bottom: 7px; color: var(--text-secondary); font-size: 15px; }
  strong { display: block; color: var(--text); font-size: 18px; line-height: 1.6; font-weight: 500; overflow-wrap: anywhere; }
}
.spot-location-card,
.spot-story-card,
.spot-guide-grid,
.spot-detail-footer { margin-right: 24px; margin-left: 24px; }
.spot-location-card {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 15px 16px;
  border: 1px solid var(--glass-line);
  border-radius: 12px;
  background: var(--glass);
  .el-icon { display: grid; width: 38px; height: 38px; flex-shrink: 0; place-items: center; border-radius: 10px; color: var(--champagne-text); background: var(--glass); font-size: 18px; }
  div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
  small { color: var(--text-secondary); font-size: 15px; }
  strong { color: var(--text); font-size: 17px; line-height: 1.7; font-weight: 500; overflow-wrap: anywhere; }
}
.spot-story-card {
  margin-top: 14px;
  padding: 18px;
  border: 1px solid var(--glass-line);
  border-radius: 12px;
  background: var(--glass);
  > p { margin: 14px 0 0; color: var(--text-secondary); font-size: 18px; line-height: 1.9; white-space: pre-line; overflow-wrap: anywhere; }
}
.spot-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  .el-icon { color: var(--champagne-text); font-size: 20px; }
  strong { font-size: 20px; font-weight: 600; }
}
.spot-guide-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
  article { padding: 17px; border: 1px solid var(--glass-line); border-radius: 12px; background: var(--glass); }
  article.wide { grid-column: 1 / -1; }
  p { margin: 14px 0 0; color: var(--text-secondary); font-size: 18px; line-height: 1.9; white-space: pre-line; overflow-wrap: anywhere; }
}
.spot-detail-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 18px;
  padding: 16px 0 20px;
  border-top: 1px solid var(--glass-line);
  background: var(--glass);
  backdrop-filter: none;
  .el-button { flex-shrink: 0; min-width: 132px; min-height: 46px; font-size: 17px; border-color: var(--glass-line); border-radius: 10px; background: var(--glass); box-shadow: var(--glass-shadow); }
}

@media (max-width: 1100px) {
  .visitor-main { flex-direction: column; }
  .visitor-menu { flex-direction: row; width: 100%; padding: 6px; }
  .menu-item { flex-direction: row; padding: 8px 14px; }
  .visitor-content { margin: 8px 0; }
  .visitor-start { width: 100%; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; padding: 0 8px 8px; }
  .start-panel { border-radius: 16px 16px 0 0; }
  .ai-chat-panel { margin-bottom: 0; border-radius: 14px 14px 0 0; }
}
@media (max-width: 760px) {
  .visitor-home { padding: 0 8px 80px; }
  .visitor-intro { flex-direction: column; gap: 8px; align-items: flex-start; }
  .process-steps { flex-wrap: wrap; }
  .spot-grid { grid-template-columns: 1fr; }
  .routes-grid { grid-template-columns: 1fr; }
}

/* Competition-ready research product skin */
.visitor-home {
  padding: 16px 28px 34px;
  color: var(--text);
  background: var(--glass);
  background-size: auto, 40px 40px, 40px 40px, auto;
}

.visitor-topbar {
  height: 58px;
  margin-bottom: 12px;
  border-color: var(--glass-line);
  border-radius: 12px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
  backdrop-filter: none;
}

.visitor-brand {
  .visitor-mark {
    border-radius: 8px;
    background: var(--glass);
    box-shadow: var(--glass-shadow);
  }

  h1 { color: var(--text); font-size: 17px; font-weight: 760; letter-spacing: 0.01em; }
}

.selection-counter {
  color: var(--text-secondary);
  .el-icon { color: var(--champagne-text); }
  strong { color: var(--champagne-text); background: var(--glass); }
}

.visitor-intro {
  position: relative;
  overflow: hidden;
  margin-bottom: 14px;
  padding: 22px 28px;
  border: 1px solid var(--glass-line);
  border-radius: 14px;
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);

  &::after {
    content: '';
    position: absolute;
    right: -3rem;
    bottom: -6rem;
    width: 18rem;
    height: 18rem;
    border: 1px solid var(--glass-line);
    border-radius: 50%;
    box-shadow: var(--glass-shadow);
    pointer-events: none;
  }

  h2 { position: relative; z-index: 1; color: var(--text); font-size: 23px; font-weight: 730; letter-spacing: -0.02em; }
}

.process-steps {
  position: relative;
  z-index: 1;
  span { color: var(--text-muted); font-weight: 620; }
  i { border-color: var(--glass-line); color: var(--champagne-text); background: var(--glass); }
  b { background: var(--glass); }
}

.visitor-main { gap: 12px; }
.visitor-menu {
  width: 78px;
  gap: 5px;
  padding: 8px 6px;
  border-color: var(--glass-line);
  border-radius: 11px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.menu-item {
  color: var(--text-muted);
  border-radius: 8px;
  font-weight: 600;
  &:hover { color: var(--text); background: var(--glass); }
  &.active { color: var(--text); background: var(--glass); font-weight: 700; box-shadow: var(--glass-shadow); }
}

.visitor-content { margin: 0; }
.tab-content { gap: 12px; }
.content-card {
  border-color: var(--glass-line);
  border-radius: 11px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.card-title {
  color: var(--text);
  font-size: 15px;
  font-weight: 760;
  .card-sub { color: var(--text-muted); }
  .panel-total strong { color: var(--champagne-text); }
}

.map-container { border-color: var(--glass-line); background: var(--glass); }
:deep(.leaflet-control-zoom) { box-shadow: var(--glass-shadow) !important; }

.routes-grid { gap: 10px; }
.route-card {
  border-color: var(--glass-line);
  border-radius: 9px;
  background: var(--glass);
  &:hover { border-color: var(--glass-line); background: var(--glass); box-shadow: var(--glass-shadow); }
  &.selected { border-color: var(--glass-line); background: var(--glass); .route-check { color: var(--champagne-text); } }
}
.route-theme-tag { color: var(--champagne-text); background: var(--glass); }
.route-spots .el-icon { color: var(--champagne-text); }

.selected-summary {
  border-color: var(--glass-line);
  border-radius: 8px;
  color: var(--champagne-text);
  background: var(--glass);
  &.empty { background: var(--glass); }
}
.category-header .category-line { background: var(--glass); }
.spot-card {
  border-color: var(--glass-line);
  border-radius: 9px;
  &:hover { border-color: var(--glass-line); background: var(--glass); }
  &.selected { border-color: var(--glass-line); background: var(--glass); .spot-check { background: var(--glass); border-color: var(--glass-line); } }
}
.spot-title-row em,
.detail-link { color: var(--champagne-text); }

.guide-card,
.pref-card,
.model-card { border-color: var(--glass-line); border-radius: 9px; }
.guide-card.selected,
.pref-card.selected,
.model-card.selected { border-color: var(--glass-line); color: var(--champagne-text); background: var(--glass); }
.pref-card .el-icon:first-child,
.selected-icon { color: var(--champagne-text); }
.model-card.selected .model-type { background: var(--glass) !important; }
.algorithm-result { border-color: var(--glass-line); background: var(--glass); }
.algorithm-result-head strong,
.algorithm-meta { color: var(--champagne-text); }

.visitor-start { width: 292px; }
.ai-chat-panel {
  border-color: var(--glass-line);
  border-radius: 11px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
  &.expanded { border-color: var(--glass-line); box-shadow: var(--glass-shadow); }
}
.ai-chat-header {
  border-bottom: 1px solid transparent;
  &:hover { background: var(--glass); }
  .el-icon { color: var(--champagne-text); }
}
.ai-chat-panel.expanded .ai-chat-header { border-bottom-color: var(--glass-line); }
.ai-chat-title { color: var(--text); }
.ai-chat-placeholder { color: var(--text-muted); }
.ai-chat-messages::-webkit-scrollbar-thumb { background: var(--glass); }
.ai-msg.user .ai-msg-bubble { background: var(--glass); }
.ai-msg.ai .ai-msg-bubble { border-color: var(--glass-line); color: var(--text-secondary); background: var(--glass); }
.ai-msg.ai .typing span { background: var(--glass); }
.ai-chat-input { border-top-color: var(--glass-line); background: var(--glass); }

.start-panel {
  padding: 20px;
  border-color: var(--glass-line);
  border-radius: 11px;
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
  h2 { color: var(--text); font-size: 16px; font-weight: 720; }
  :deep(.el-input__wrapper) { background: var(--glass); }
  .start-btn { border-color: var(--glass-line); background: var(--glass); box-shadow: var(--glass-shadow); &:hover { background: var(--glass); } }
}

@media (max-width: 1100px) {
  .visitor-main { gap: 0; }
  .visitor-menu { background: var(--glass); }
  .visitor-content { margin: 8px 0; }
}
@media (max-width: 760px) {
  .visitor-home { padding: 8px 8px 82px; }
  .visitor-topbar { margin-top: 0; }
  .visitor-intro { padding: 20px; }
}

/* 2026 showcase skin — spatial, quiet, unmistakably AI */
.visitor-home {
  --page-gutter: 30px;
  padding: 0 30px 42px;
  color: var(--text);
  background: var(--glass);
}
.visitor-topbar-shell {
  width: auto;
  margin: 0 calc(-1 * var(--page-gutter)) 18px;
  border-bottom: 1px solid var(--glass-line);
  background: var(--glass);
  backdrop-filter: none;
}
.visitor-topbar {
  height: 76px;
  width: auto;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 32px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}
.visitor-brand .visitor-mark {
  border: 0;
  border-radius: 11px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.visitor-brand h1 { color: var(--text); font-size: 18px; font-weight: 760; letter-spacing: -.02em; }
.selection-counter .el-icon { color: var(--champagne-text); }
.selection-counter strong { color: var(--champagne-text); background: var(--glass); }

.visitor-intro {
  margin-bottom: 18px;
  padding: 28px 32px;
  border: 1px solid var(--glass-line);
  border-radius: 20px;
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.visitor-intro::before {
  content: none;
  position: absolute;
  right: 32px;
  bottom: 18px;
  color: var(--text-muted);
  font-size: 42px;
  font-weight: 900;
  letter-spacing: -.04em;
}
.visitor-intro::after { display: none; }
.visitor-intro h2 { color: var(--text); font-size: 30px; font-weight: 760; letter-spacing: -.045em; }
.process-steps span { color: var(--text-secondary); }
.process-steps i { border-color: var(--glass-line); color: var(--champagne-text); background: var(--glass); }
.process-steps b { background: var(--glass); }

.visitor-main { gap: 14px; }
.visitor-menu {
  width: 86px;
  padding: 8px;
  border: 1px solid var(--glass-line);
  border-radius: 16px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.menu-item {
  color: var(--text-muted);
  border-radius: 11px;
  font-weight: 620;
}
.menu-item:hover { color: var(--champagne-text); background: var(--glass); }
.menu-item.active { color: var(--text); background: var(--glass); box-shadow: none; }

.tab-content { gap: 14px; }
.content-card {
  border-color: var(--glass-line);
  border-radius: 16px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.card-title { color: var(--text); font-size: 16px; }
.card-title .card-sub { color: var(--text-muted); }
.card-title .panel-total strong { color: var(--champagne-text); }
.map-container { border: 0; border-radius: 12px; background: var(--glass); }
.routes-grid { gap: 12px; }
.route-card {
  border-color: var(--glass-line);
  border-radius: 12px;
  background: var(--glass);
}
.route-card:hover { border-color: var(--glass-line); background: var(--glass); box-shadow: var(--glass-shadow); }
.route-card.selected { border-color: var(--glass-line); background: var(--glass); box-shadow: var(--glass-shadow); }
.route-card.selected .route-check { color: var(--champagne-text); }
.route-theme-tag { color: var(--champagne-text); background: var(--glass); }
.route-spots .el-icon { color: var(--champagne-text); }
.selected-summary { border-color: var(--glass-line); color: var(--champagne-text); background: var(--glass); }
.selected-summary.empty { background: var(--glass); }
.category-header .category-line { background: var(--glass); }
.spot-card { border-color: var(--glass-line); border-radius: 12px; }
.spot-card:hover { border-color: var(--glass-line); background: var(--glass); }
.spot-card.selected { border-color: var(--glass-line); background: var(--glass); }
.spot-card.selected .spot-check { border-color: var(--glass-line); background: var(--glass); }
.spot-title-row em, .detail-link { color: var(--champagne-text); }
.guide-card,.pref-card,.model-card { border-color: var(--glass-line); border-radius: 12px; }
.guide-card.selected,.pref-card.selected,.model-card.selected { border-color: var(--glass-line); color: var(--champagne-text); background: var(--glass); }
.pref-card .el-icon:first-child,.selected-icon { color: var(--champagne-text); }
.model-card.selected .model-type { background: var(--glass) !important; }
.algorithm-result { border-color: var(--glass-line); background: var(--glass); }
.algorithm-result-head strong,.algorithm-meta { color: var(--champagne-text); }

.visitor-start { width: 306px; }
.ai-chat-panel {
  border-color: var(--glass-line);
  border-radius: 16px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.ai-chat-panel.expanded { border-color: var(--glass-line); box-shadow: var(--glass-shadow); }
.ai-chat-header:hover { background: var(--glass); }
.ai-chat-header .el-icon { color: var(--champagne-text); }
.ai-chat-panel.expanded .ai-chat-header { border-bottom-color: var(--glass-line); }
.ai-chat-title { color: var(--text); }
.ai-chat-messages::-webkit-scrollbar-thumb { background: var(--glass); }
.ai-msg.user .ai-msg-bubble { background: var(--glass); }
.ai-msg.ai .ai-msg-bubble { border-color: var(--glass-line); color: var(--text-secondary); background: var(--glass); }
.ai-msg.ai .typing span { background: var(--glass); }
.ai-chat-input { border-top-color: var(--glass-line); background: var(--glass); }
.start-panel {
  padding: 24px;
  border: 0;
  border-radius: 16px;
  color: var(--text-muted);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.start-panel h2 { color: var(--text); font-size: 18px; }
.start-panel :deep(.el-input__wrapper) { background: var(--glass); }
.start-panel .start-btn { border-color: var(--glass-line); background: var(--glass); box-shadow: var(--glass-shadow); }
.start-panel .start-btn:hover { background: var(--glass); }
@media (max-width: 1100px) {
  .visitor-main { gap: 0; }
  .visitor-menu { background: var(--glass); }
}
@media (max-width: 760px) {
  .visitor-home { --page-gutter: 8px; }
  .visitor-topbar-shell { margin-bottom: 12px; }
  .visitor-topbar { height: 64px; padding: 0 12px; }
  .visitor-top-actions { gap: 8px; }
  .selection-counter span { display: none; }
}

/* 每个规划模块使用自己的行程内容与启动面板。 */
.visitor-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  grid-template-areas: 'content actions';
  gap: 14px;
}

.visitor-content { grid-area: content; min-width: 0; margin: 0; }

.visitor-start {
  grid-area: actions;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'start';
  gap: 14px;
  width: auto;
  min-width: 0;
  align-items: start;
}

.start-panel {
  grid-area: start;
  display: flex;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  padding: 22px;
}

.ai-chat-panel {
  min-width: 0;
  min-height: 0;
  margin-bottom: 0;
}

.ai-chat-header { padding: 16px 20px; }
.ai-chat-title { font-size: 16px; }
.ai-chat-title .ai-icon { font-size: 22px; }
.ai-chat-messages {
  min-height: 80px;
  max-height: 420px;
  padding: 12px 18px 14px;
}
.ai-chat-placeholder {
  display: grid;
  min-height: 60px;
  place-items: center;
  padding: 14px;
  border: 1px dashed var(--glass-line);
  border-radius: 12px;
  background: var(--glass);
}
.ai-chat-input { padding: 12px 18px 16px; }
.ai-chat-input :deep(.el-input__wrapper) { min-height: 40px; }
.ai-chat-input .el-button { width: 44px; height: 40px; }
.visitor-home :deep(.qr-float) { right: 8px; bottom: 8px; }
.visitor-home :deep(.qr-fab) { width: 42px; height: 42px; font-size: 18px; }

@media (max-width: 1100px) {
  .visitor-main {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas:
      'content'
      'actions';
    gap: 12px;
  }
  .visitor-content { margin: 0; }
  .visitor-start {
    position: static;
    z-index: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'start';
    width: auto;
    padding: 0;
  }
  .start-panel,
  .ai-chat-panel { border-radius: 16px; }
}

@media (max-width: 760px) {
  .visitor-home { padding-bottom: 28px; }
  .visitor-start {
    grid-template-columns: 1fr;
    grid-template-areas: 'start';
  }
  .start-panel { min-height: auto; padding: 20px; }
  .ai-chat-panel { min-height: 0; }
  .ai-chat-messages { min-height: 80px; max-height: 320px; }
  :global(.spot-detail-drawer) { width: 100% !important; }
  .spot-detail-hero { padding: 28px 22px 36px; }
  .spot-detail-metrics { margin-right: 14px; margin-left: 14px; }
  .spot-location-card,
  .spot-story-card,
  .spot-guide-grid,
  .spot-detail-footer { margin-right: 14px; margin-left: 14px; }
  .spot-guide-grid { grid-template-columns: 1fr; }
  .spot-guide-grid article.wide { grid-column: auto; }
}

.route-cover{position:relative;margin:-16px -16px 14px;height:155px;overflow:hidden;border-radius:12px 12px 0 0}.route-cover img{width:100%;height:100%;object-fit:cover}.route-cover small{position:absolute;right:8px;bottom:8px;padding:3px 6px;background: var(--glass);border-radius:5px;font-size:10px}.spot-list-photo{width:70px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0}


/* Let the visitor page use its existing responsive layout on narrow screens. */
:global(html:has(.visitor-home)),
:global(body:has(.visitor-home)),
:global(#app:has(.visitor-home)) { min-width: 0; }

/* A continuous selection grid avoids empty columns after every category. */
.spot-card-section { padding: 20px 22px; container-type: inline-size; }
.spot-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.spot-section-heading h3 { margin: 0; color: var(--text); font-size: 22px; font-weight: 600; }
.spot-selection-count { color: var(--text-secondary); font-size: 16px; white-space: nowrap; }
.spot-selection-count strong { color: var(--champagne-text); font-size: 20px; font-weight: 600; }
.spot-selection-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.spot-selection-tools .el-input { flex: 1 1 240px; max-width: 400px; }
.spot-selection-tools .el-button { margin: 0; min-height: 40px; font-size: 16px; }
.spot-selection-tools :deep(.el-input__inner) { font-size: 16px; }
.spot-category-filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 0; border-bottom: 1px solid rgba(99,102,241,0.08); }
.spot-category-filters button { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 7px 14px; border: 0; border-radius: 10px; color: var(--text-secondary); background: transparent; font-size: 18px; font-weight: 400; cursor: pointer; transition: background .18s, color .18s; }
.spot-category-filters button span { font-size: 16px; color: var(--text-secondary); }
.spot-category-filters button:hover { color: var(--text); background: rgba(99,102,241,0.04); }
.spot-category-filters button.active { color: var(--champagne-text); background: rgba(99,102,241,0.1); }
.spot-category-filters button.active span { color: var(--champagne-text); }
.spot-selection-summary { display: flex; align-items: baseline; gap: 10px; margin-top: 12px; color: var(--text-secondary); font-size: 16px; }
.spot-selection-summary > span { color: var(--champagne-text); white-space: nowrap; }
.spot-selection-summary p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
.spot-options-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0 22px; margin-top: 6px; }
.spot-option { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 80px; padding: 14px 10px; border: 1px solid transparent; border-bottom-color: rgba(99,102,241,0.08); border-radius: 0; background: transparent; transition: background .18s, border-color .18s; }
.spot-option:hover { background: rgba(99,102,241,0.035); }
.spot-option.selected { background: rgba(99,102,241,0.06); border-bottom-color: rgba(99,102,241,0.25); }
.spot-choice { display: flex; align-items: center; flex: 1; min-width: 0; gap: 12px; padding: 0; border: 0; text-align: left; background: transparent; color: var(--text); cursor: pointer; font: inherit; }
.spot-choice-check { display: grid; place-items: center; flex: 0 0 22px; width: 22px; height: 22px; border: 1px solid rgba(99,102,241,0.18); border-radius: 6px; color: var(--champagne-text); background: rgba(99,102,241,0.03); }
.spot-option.selected .spot-choice-check { border-color: rgba(99,102,241,0.25); background: rgba(99,102,241,0.16); }
.spot-option-photo { flex: 0 0 64px; width: 64px; height: 64px; object-fit: cover; border-radius: 8px; }
.spot-choice-copy { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 6px; }
.spot-choice-title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 10px; }
.spot-choice-title strong { color: var(--text); font-size: 20px; line-height: 1.6; font-weight: 600; overflow-wrap: anywhere; }
.spot-option-detail { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; gap: 4px; min-height: 44px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--champagne-text); font-size: 16px; font-weight: 400; cursor: pointer; }
.spot-option-detail:hover { background: rgba(99,102,241,0.08); }
@container (min-width: 1100px) { .spot-options-grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }
@container (max-width: 620px) {
  .spot-options-grid { grid-template-columns: minmax(0,1fr); }
  .spot-selection-tools .el-input { max-width: none; flex-basis: 100%; }
  .spot-option { padding: 14px 2px; }
}


/* 模块入口、行程摘要与数字人选择使用一致的紧凑排版。 */
.menu-item { border: 0; font-family: inherit; background: transparent; }
.visitor-start { position: sticky; top: 16px; }
.start-summary { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; color: var(--text-muted); font-size: 13px; }
.start-guide-choice { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.chosen-guide { display: flex; align-items: center; gap: 12px; }
.chosen-guide img { width: 54px; height: 68px; object-fit: contain; border-radius: 10px; background: rgba(99,102,241,0.04); }
.chosen-guide strong { color: var(--text); font-size: 15px; font-weight: 600; }
.start-hint,.planning-empty { margin: 12px 0; color: var(--text-muted); font-size: 13px; line-height: 1.7; }
.personal-spot-list { padding: 0; margin: 12px 0 0; list-style: none; }
.personal-spot-list li { display: flex; align-items: center; gap: 12px; min-height: 62px; border-bottom: 1px solid rgba(99,102,241,0.08); }
.personal-spot-list li:last-child { border-bottom: 0; }
.itinerary-order { color: var(--champagne-text); font-size: 13px; width: 22px; }
.personal-spot-list li > div { flex: 1; display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; }
.personal-spot-list strong { font-size: 15px; font-weight: 600; }
.personal-spot-list small { color: var(--text-muted); font-size: 12px; }
.personal-spot-list button { display: flex; align-items: center; justify-content: center; min-width: 32px; min-height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--champagne-text); cursor: pointer; }
.personal-spot-list button:hover { background: rgba(99,102,241,0.08); }
:global(.guide-picker-dialog .el-dialog__body) { max-height: 65vh; overflow-y: auto; }
.guide-picker-dialog .content-card { padding: 0; border: 0; background: transparent; }
.guide-picker-dialog .model-grid { grid-template-columns: repeat(auto-fill,minmax(120px,1fr)); gap: 10px; }
.guide-picker-dialog .model-name small { display: block; margin-top: 4px; color: var(--text-muted); font-size: 12px; font-weight: 400; }
@media (max-width: 1100px) { .visitor-start { position: static; top: auto; } }

/* 规划方式切换集中在标题栏右侧，正文不再预留侧栏。 */
.visitor-intro { flex-direction: row; align-items: center; gap: 20px; }
.visitor-intro .visitor-menu {
  width: auto; flex-direction: row; gap: 6px; padding: 5px;
  border-radius: 14px; background: rgba(99,102,241,0.04);
}
.visitor-intro .menu-item {
  flex-direction: row; justify-content: center; gap: 8px;
  min-height: 42px; padding: 10px 18px; font-size: 15px;
  white-space: nowrap; border-radius: 10px;
}
.visitor-intro .menu-item .el-icon { font-size: 18px; }
.visitor-intro .menu-item.active { color: var(--champagne-text); background: rgba(99,102,241,0.12); }
@media (max-width: 520px) {
  .visitor-intro { flex-direction: column; align-items: stretch; gap: 14px; }
  .visitor-intro .visitor-menu { align-self: flex-end; }
  .visitor-intro .menu-item { padding: 9px 12px; font-size: 14px; }
}

/* 上方地图 + 资讯，下方选择行程，再开始导览。 */
.visitor-main { display: flex; flex-direction: column; align-items: stretch; gap: 18px; }
.visitor-content { width: 100%; }
.map-overview { display: grid; grid-template-columns: minmax(0,1fr) 340px; align-items: stretch; gap: 18px; margin-bottom: 18px; }
.map-overview .map-card { display: flex; flex-direction: column; min-width: 0; margin: 0; padding: 24px; }
.map-overview :deep(.visit-context) { margin: 0; }
.map-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.map-card-heading h3 { margin: 0; font-size: 18px; font-weight: 600; }
.map-card-heading span { font-size: 12px; color: var(--text-muted); }
.map-heading-actions { display: flex; align-items: center; gap: 12px; }
.map-overview-button { border: 0; border-radius: 12px; background: #eef0ff; color: #5042e8; padding: 8px 14px; font: inherit; font-size: 14px; white-space: nowrap; cursor: pointer; }
.map-overview-button:hover { background: #e1e4ff; }
.map-overview-button:focus-visible { outline: 2px solid #5042e8; outline-offset: 2px; }
.map-overview .map-container { flex: 1; min-height: 350px; height: auto; margin: 0; border-radius: 16px; }
.map-overview .map-spots { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.visitor-start { position: static; top: auto; z-index: auto; display: block; width: 100%; padding: 0; }
.start-panel { display: grid; grid-template-columns: minmax(180px,1fr) minmax(220px,1.2fr) minmax(160px,1fr) 180px; align-items: center; gap: 20px; min-height: 0; padding: 24px; border-color: transparent; }
.start-heading h2 { margin: 0 0 10px; }
.start-summary { justify-content: flex-start; flex-wrap: wrap; gap: 12px; margin: 0; }
.start-heading .start-hint { margin: 8px 0 0; }
.start-guide-choice { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 10px; margin: 0; }
.start-guide-choice .el-button { margin: 0; min-height: 42px; }
.chosen-guide { gap: 8px; }
.chosen-guide img { width: 34px; height: 42px; }
.start-panel .start-btn { margin: 0; width: 100%; min-height: 46px; }
.start-panel :deep(.el-input__wrapper) { min-height: 42px; }
@media (max-width: 1100px) {
  .start-panel { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width: 900px) {
  .map-overview { grid-template-columns: minmax(0,1fr); }
  .map-overview .map-container { flex: none; height: 320px; min-height: 0; }
}
@media (max-width: 600px) {
  .map-overview .map-card { padding: 18px; }
  .map-card-heading { align-items: flex-start; gap: 8px; }
  .map-card-heading span { max-width: 110px; text-align: right; line-height: 1.5; }
  .map-heading-actions span { display: none; }
  .map-overview .map-container { height: 280px; }
  .start-panel { grid-template-columns: minmax(0,1fr); gap: 16px; padding: 20px; }
  .start-guide-choice .el-button { flex: 1; }
}
.preference-grid .pref-card { flex-direction: column; align-items: flex-start; gap: 8px; padding: 16px; text-align: left; min-width: 0; border: 1px solid transparent; border-radius: 18px; background: #f7f8fc; font-size: 17px; font-weight: 400; }
.preference-grid .pref-card.selected { border-color: #a9a5ff; background: #f0efff; }
.pref-name { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.pref-card small { color: #64748b; font-size: 14px; line-height: 1.5; }
.pref-card .pref-coverage { color: #5447db; font-size: 13px; }
.preference-note, .plan-explanation, .plan-basis { font-size: 14px; color: #64748b; line-height: 1.7; margin: 14px 0 0; }
.planning-controls { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; margin-top: 20px; }
.planning-controls label { display: flex; flex-direction: column; gap: 9px; color: #334155; font-size: 15px; }
.planning-controls select, .map-locate-select { padding: 10px 12px; color: #334155; background: #f7f8fc; border: 1px solid #e6e8f2; border-radius: 12px; min-width: 0; font: inherit; outline-offset: 3px; }
.plan-metrics { display: flex; gap: 14px 24px; flex-wrap: wrap; margin-top: 18px; padding: 16px; background: #f7f8fc; border-radius: 14px; font-size: 15px; color: #64748b; }
.plan-metrics strong { color: #5447db; font-size: 23px; font-weight: 400; }
.personal-spot-list li { padding: 14px 0; }
.personal-spot-list li > .itinerary-copy { display: block; min-width: 0; }
.itinerary-copy strong { font-size: 18px; }
.itinerary-copy small { display: block; font-size: 14px; margin-top: 7px; line-height: 1.5; }
.itinerary-reason { font-size: 14px; color: #475569; line-height: 1.6; margin: 6px 0 0; }
.plan-refresh { padding: 10px 14px; border-radius: 12px; background: #fff7e6; color: #8b5a16; font-size: 15px; }
.plan-basis summary { cursor: pointer; color: #5447db; }
.plan-basis p { margin: 8px 0; }
.plan-basis a { display: block; color: #5447db; }
.ai-chat-messages { min-height: 100px; }
.ai-chat-header { width: 100%; border: 0; text-align: left; font: inherit; background: transparent; cursor: pointer; }
.ai-chat-placeholder { min-height: 90px; }
@media (max-width: 1050px) { .preference-grid { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@media (max-width: 600px) {
  .preference-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  .preference-grid .pref-card:last-child { grid-column: 1 / -1; }
  .preference-grid .pref-card { padding: 12px; font-size: 16px; }
  .pref-card small { font-size: 13px; }
  .planning-controls { grid-template-columns: minmax(0,1fr); gap: 14px; }
  .plan-metrics { gap: 10px 16px; }
}
/* Keep the full wordmark and navigation actions visible on narrow phones. */
@media (max-width: 600px) {
  .visitor-topbar { height: auto; min-height: 64px; flex-wrap: wrap; row-gap: 8px; padding: 10px 12px; }
  .visitor-brand { flex: 0 0 100%; }
  .visitor-top-actions { width: 100%; min-width: 0; gap: 6px; justify-content: space-between; }
  .visitor-top-actions .el-button { padding-inline: 10px; margin-left: 0; min-width: 0; }
  .visitor-intro .visitor-menu { width: 100%; min-width: 0; align-self: stretch; gap: 3px; }
  .visitor-intro .menu-item { flex: 1; min-width: 0; padding-inline: 8px; gap: 4px; white-space: normal; }
  .map-spot-tag { max-width: 100%; white-space: normal; text-align: left; }
  .routes-grid { grid-template-columns: minmax(0, 1fr); }
  .route-card { min-width: 0; }
  .route-spots span { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
  .pref-name { white-space: normal; }
}

/* Quiet scenic identity: colour lives in the canvas and a few supporting surfaces. */
.visitor-home {
  position: relative;
  isolation: isolate;
}
.visitor-home > .visitor-topbar-shell,
.visitor-intro,
.visitor-main {
  position: relative;
}
.visitor-home .visitor-intro {
  overflow: hidden;
  min-height: 106px;
  background-color: #f3f1fb !important;
  background-image: linear-gradient(110deg, #f2eefb, #f4f5fb 53%, #edf5f4) !important;
  box-shadow: 0 8px 30px -16px rgba(73, 69, 112, .2) !important;
}
.visitor-intro > div,
.visitor-intro .visitor-menu {
  position: relative;
  z-index: 1;
}
.planner-landscape {
  position: absolute;
  right: 22%;
  bottom: -1px;
  width: 420px;
  height: 118px;
  pointer-events: none;
}
.planner-ripple {
  animation: planner-ripple-drift 9s ease-in-out infinite alternate;
}
.visitor-home .visitor-intro .visitor-menu {
  background-color: rgba(255, 255, 255, .74) !important;
  border-radius: 16px !important;
  box-shadow: 0 4px 18px -10px rgba(84, 74, 137, .18) !important;
}
.visitor-main { min-height: 0; justify-content: flex-start; }
.tab-content { gap: 18px; }
.map-overview { margin-bottom: 0; }
.visitor-home .content-card {
  box-shadow: 0 8px 26px -14px rgba(53, 66, 98, .19) !important;
}
.visitor-home .map-overview :deep(.visit-context) {
  background-color: #edf4f5 !important;
  background-image: linear-gradient(145deg, #f1f2fb, #edf6f3) !important;
}
.map-overview :deep(.weather-symbol) {
  background: rgba(255, 255, 255, .78);
  color: #7088ad;
  box-shadow: 0 5px 18px -10px rgba(88, 119, 130, .25);
}
.map-overview :deep(.context-tip) { background: rgba(255, 255, 255, .7); }
.map-overview :deep(.context-overview),
.map-overview :deep(.weather-details) { border-color: rgba(94, 123, 142, .12); }
.visitor-home .recommended-routes { padding: 22px 24px 24px; }
.routes-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.visitor-home .route-card {
  --route-tint: #f1eef9;
  --route-ink: #67558e;
  position: relative;
  min-width: 0;
  padding: 20px;
  overflow: hidden;
  background-color: var(--route-tint) !important;
  background-image: linear-gradient(145deg, rgba(255,255,255,.5), transparent 80%) !important;
  box-shadow: none !important;
  border: 1px solid rgba(129, 130, 170, .08) !important;
  border-radius: 18px !important;
  transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
}
.visitor-home .route-card:nth-child(3n + 2) { --route-tint: #edf3fa; --route-ink: #4c6f94; }
.visitor-home .route-card:nth-child(3n) { --route-tint: #edf5f0; --route-ink: #466e5e; }
.visitor-home .route-card:hover {
  transform: translateY(-3px);
  background-color: var(--route-tint) !important;
  border-color: rgba(117, 108, 178, .2) !important;
  box-shadow: 0 10px 24px -16px rgba(64, 77, 116, .35) !important;
}
.visitor-home .route-card.selected {
  background-color: var(--route-tint) !important;
  border-color: #9b91d6 !important;
  box-shadow: inset 0 0 0 1px #9b91d6 !important;
}
.route-theme-tag { color: var(--route-ink); background: rgba(255,255,255,.72); font-size: 13px; padding: 4px 10px; }
.route-time { font-size: 13px; }
.route-name { margin-top: 14px; font-size: 18px; line-height: 1.5; }
.route-desc, .route-spots { font-size: 14px; line-height: 1.7; }
.route-spots span { white-space: normal; }
.route-card-bottom { margin-top: 16px; border-color: rgba(102, 123, 142, .12); }
.visitor-home .spot-card-section {
  background-image: linear-gradient(180deg, #f8f8fd 0, #fff 155px) !important;
}
.spot-options-grid { column-gap: 24px; }
.spot-option { border-bottom-color: rgba(123, 139, 161, .1); }
.visitor-home .start-panel {
  background: linear-gradient(110deg, #f1effa, #f0f6f5);
  border: 1px solid rgba(123, 136, 161, .08);
  box-shadow: 0 8px 26px -14px rgba(53, 66, 98, .19);
}
@keyframes planner-ripple-drift {
  from { transform: translateX(-8px); }
  to { transform: translateX(8px); }
}
@media (max-width: 1100px) {
  .planner-landscape { right: 25%; width: 300px; opacity: .7; }
  .routes-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .planner-landscape { right: 2%; width: 245px; opacity: .5; }
  .visitor-home .visitor-intro { min-height: 100px; }
  .visitor-home .recommended-routes { padding: 20px; }
  .routes-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .visitor-home .route-card { padding: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .planner-ripple { animation: none; }
  .visitor-home .route-card { transition: none; }
  .visitor-home .route-card:hover { transform: none; }
}

/* The guide choice is the focal action in the otherwise quiet launch bar. */
.visitor-home .start-panel {
  grid-template-columns: minmax(150px, .8fr) minmax(280px, 1.35fr) minmax(160px, 1fr) 180px;
}
.visitor-home .start-guide-choice {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  min-width: 0;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid #cfc6ee;
  border-radius: 20px;
  background: linear-gradient(120deg, #eee9fa, #f7f6fc);
  box-shadow: 0 6px 20px -12px rgba(95, 76, 156, .32);
  transition: border-color .25s ease, box-shadow .25s ease;
}
.visitor-home .start-guide-choice:hover,
.visitor-home .start-guide-choice:focus-within {
  border-color: #a898db;
  box-shadow: 0 7px 24px -12px rgba(95, 76, 156, .4);
}
.guide-choice-portrait {
  position: relative;
  isolation: isolate;
  display: grid;
  flex: 0 0 70px;
  place-items: center;
  height: 90px;
  border: 1px solid rgba(155, 137, 207, .16);
  border-radius: 16px;
  background: #faf9fe;
}
.guide-choice-portrait img {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}
.guide-choice-portrait > .el-icon { color: #8a79b5; font-size: 30px; }
.guide-choice-aura {
  position: absolute;
  inset: -5px;
  z-index: -1;
  border: 1px solid #b5a2dc;
  border-radius: 21px;
  opacity: .3;
  animation: guide-choice-breathe 4.5s ease-in-out infinite;
}
.guide-choice-main { flex: 1; min-width: 0; }
.guide-choice-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 8px; }
.guide-choice-label { color: #5b4c82; font-size: 14px; line-height: 1.5; }
.guide-choice-state { display: inline-flex; align-items: center; gap: 3px; color: #726588; font-size: 12px; line-height: 1.5; white-space: nowrap; }
.has-guide .guide-choice-state { color: #3d7761; }
.guide-choice-caption { margin: 7px 0 10px; color: #6d6185; font-size: 14px; line-height: 1.5; }
.start-guide-choice .chosen-guide { margin: 7px 0 10px; min-height: 21px; color: #3e325d; }
.start-guide-choice .chosen-guide strong { font-size: 17px; font-weight: 500; overflow-wrap: anywhere; }
.visitor-home .start-guide-choice .guide-select-button.el-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 38px;
  height: auto;
  margin: 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: #6652bd !important;
  color: #fff !important;
  box-shadow: 0 5px 14px -7px rgba(83, 63, 156, .5) !important;
  font-size: 15px;
  font-weight: 400;
  white-space: normal;
  line-height: 1.35;
}
.guide-select-button :deep(> span) { min-width: 0; max-width: 100%; white-space: normal; line-height: 1.35; }
.visitor-home .start-guide-choice .guide-select-button.el-button:hover { background: #5843ad !important; }
.guide-select-button .el-icon { margin-left: 8px; transition: transform .25s ease; }
.guide-select-button:hover .el-icon { transform: translateX(3px); }
.has-guide .guide-choice-aura { animation: none; opacity: .18; }
.start-error { grid-column: 1 / -1; margin: 12px 0 0; color: #b42336; font-size: 15px; line-height: 1.5; }
@keyframes guide-choice-breathe {
  0%, 100% { opacity: .18; transform: scale(.98); }
  50% { opacity: .52; transform: scale(1.04); }
}
@media (max-width: 1100px) {
  .visitor-home .start-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .visitor-home .start-panel { grid-template-columns: minmax(0, 1fr); }
  .visitor-home .start-guide-choice { gap: 14px; padding: 14px; }
  .guide-select-button .el-icon { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .guide-choice-aura { animation: none; }
  .visitor-home .start-guide-choice, .guide-select-button .el-icon { transition: none; }
}
</style>
