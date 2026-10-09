<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowLeft,
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
  View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getVisitorSpotList, getVisitorGuideList, getVisitorRouteList, getRouteRecommendation, aiChatRecommend } from '@/api/visitor'
import type { RouteRecommendationResult } from '@/api/visitor'
import type { DigitalGuide } from '@/api/digitalHuman'
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue'
import QrFloating from '@/components/QrFloating.vue'

const router = useRouter()
const mapDiv = ref<HTMLDivElement | null>(null)
let leafletMap: any = null
let leafletMarkers: any[] = []
let mapHasFittedSpots = false

// 高德瓦片（无需 API Key，国内可用）
const AMAP_TILE = 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

// 数据库存储 WGS-84 坐标，高德瓦片采用 GCJ-02；展示前转换，避免标记整体偏移。
const MAP_PI = Math.PI
const MAP_A = 6378245.0
const MAP_EE = 0.00669342162296594323
const outOfChina = (lat: number, lng: number) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
function transformLat(lng: number, lat: number) {
  let ret = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng))
  ret += (20 * Math.sin(6 * lng * MAP_PI) + 20 * Math.sin(2 * lng * MAP_PI)) * 2 / 3
  ret += (20 * Math.sin(lat * MAP_PI) + 40 * Math.sin(lat / 3 * MAP_PI)) * 2 / 3
  ret += (160 * Math.sin(lat / 12 * MAP_PI) + 320 * Math.sin(lat * MAP_PI / 30)) * 2 / 3
  return ret
}
function transformLng(lng: number, lat: number) {
  let ret = 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng))
  ret += (20 * Math.sin(6 * lng * MAP_PI) + 20 * Math.sin(2 * lng * MAP_PI)) * 2 / 3
  ret += (20 * Math.sin(lng * MAP_PI) + 40 * Math.sin(lng / 3 * MAP_PI)) * 2 / 3
  ret += (150 * Math.sin(lng / 12 * MAP_PI) + 300 * Math.sin(lng / 30 * MAP_PI)) * 2 / 3
  return ret
}
function wgs84ToGcj02(lat: number, lng: number): [number, number] {
  if (outOfChina(lat, lng)) return [lat, lng]
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = lat / 180 * MAP_PI
  let magic = Math.sin(radLat)
  magic = 1 - MAP_EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / ((MAP_A * (1 - MAP_EE)) / (magic * sqrtMagic) * MAP_PI)
  dLng = (dLng * 180) / (MAP_A / sqrtMagic * Math.cos(radLat) * MAP_PI)
  return [lat + dLat, lng + dLng]
}

function loadLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    if ((window as any).L) { resolve((window as any).L); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve((window as any).L)
    document.head.appendChild(script)
  })
}

function initLeafletMap() {
  if (!mapDiv.value || leafletMap) return
  loadLeaflet().then((L) => {
    if (!mapDiv.value || leafletMap) return
    leafletMap = L.map(mapDiv.value, {
      center: [39.997, 116.269],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer(AMAP_TILE, { maxZoom: 18 }).addTo(leafletMap)
    refreshMapMarkers(L)
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize() }, 300)
  })
}

function refreshMapMarkers(L?: any) {
  const Lref = L || (window as any).L
  if (!Lref || !leafletMap) return
  leafletMarkers.forEach((m: any) => leafletMap.removeLayer(m))
  leafletMarkers = []
  const spots = spotList.value.filter((s: any) => s.latitude && s.longitude && s.latitude !== 0)
  const bounds = Lref.latLngBounds([])
  spots.forEach((s: any, i: number) => {
    const isSelected = selectedSpotIds.value.has(s.spot_id)
    const size = isSelected ? 28 : 22
    const icon = Lref.divIcon({
      className: 'spot-marker',
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${isSelected ? '#3b5bff' : '#151925'};border:2px solid #fff;box-shadow:0 4px 12px rgba(18,25,46,.26);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;transition:all .2s">${i + 1}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
    const mapPoint = wgs84ToGcj02(Number(s.latitude), Number(s.longitude))
    const marker = Lref.marker(mapPoint, { icon }).addTo(leafletMap)
    bounds.extend(mapPoint)
    marker.bindPopup(`<b>${s.spot_name}</b><br>${s.location || '颐和园景区'}`)
    marker.on('click', () => { toggleSpot(s.spot_id); refreshMapMarkers() })
    leafletMarkers.push(marker)
  })
  if (!mapHasFittedSpots && bounds.isValid()) {
    leafletMap.fitBounds(bounds.pad(0.2), { maxZoom: 15, animate: false })
    mapHasFittedSpots = true
  }
}

function scrollToSpot(id: number) {
  const el = document.querySelector(`[data-spot-id="${id}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const activeMenuTab = ref<'route' | 'personal'>('route')
// 选择卡片展示后端保存的角色照片。
const modelCategories = computed(() => {
  const cats: Record<string, { label: string; icon: string; models: { guideId: number; name: string; path: string; voice: string; poster: string; voiceLabel: string }[] }> = {}
  for (const g of guideList.value) {
    const path = g.model3d_url || ''
    const name = g.name || ''
    let cat = 'other'
    if (path.includes('汉服')) cat = 'hanfu'
    else if (path.includes('西装女')) cat = 'suit_female'
    else if (path.includes('西装男')) cat = 'suit_male'
    else if (path.includes('休闲')) cat = 'casual'
    if (!cats[cat]) {
      const labels: Record<string, { label: string; icon: string }> = {
        hanfu: { label: '汉服风华', icon: '🏮' },
        suit_female: { label: '商务女导游', icon: '💼' },
        suit_male: { label: '商务男导游', icon: '🤵' },
        casual: { label: '休闲风女导游', icon: '🌸' },
        other: { label: '默认形象', icon: '✨' },
      }
      cats[cat] = { ...labels[cat], models: [] }
    }
    cats[cat].models.push({ guideId: g.guide_id, name: g.name, path, voice: g.voice_style || '', poster:g.poster_image || g.avatar || '', voiceLabel:g.render_mode==='xingyun'?(g.voice_label||'星云应用音色'):(g.voice_style?.startsWith('male_')?'男声':'女声') })
  }
  return Object.values(cats)
})
const visitorName = ref('')
const selectedGuide = ref<any>(null)
const selectedSpotIds = ref<Set<number>>(new Set())
const loading = ref(false)
const starting = ref(false)
const guideList = ref<DigitalGuide[]>([])
const routeList = ref<any[]>([])
const selectedRouteId = ref<number | null>(null)
const spotList = ref<any[]>([])
const searchKeyword = ref('')
const categoryFilter = ref('all')
const showSelectedOnly = ref(false)
const detailVisible = ref(false)
const activeSpot = ref<any>(null)
const collapsedCategories = ref<Set<string>>(new Set())

const getSpotTags = (spot: any) => String(spot?.tags || '')
  .split(/[;；,，]/)
  .map((tag) => tag.trim())
  .filter(Boolean)
  .slice(0, 6)

const formatCoordinate = (value: unknown) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue.toFixed(5) : '--'
}

const selectedPreferences = ref<string[]>([])
const preferenceRecommendation = ref<RouteRecommendationResult | null>(null)
const preferenceRecommendationLoading = ref(false)
const preferenceOptions = [
  { value: 'history', icon: OfficeBuilding, label: '历史文化' },
  { value: 'nature', icon: Compass, label: '自然风光' },
  { value: 'photography', icon: Camera, label: '影像记录' },
  { value: 'family', icon: User, label: '亲子游览' },
  { value: 'comprehensive', icon: Guide, label: '综合游览' },
]

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
  for (const spot of spotList.value) cats.add(spot.category || '其他')
  return [...cats]
})
const filteredSpotList = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return spotList.value.filter((spot) => {
    const category = spot.category || '其他'
    if (categoryFilter.value !== 'all' && category !== categoryFilter.value) return false
    if (showSelectedOnly.value && !selectedSpotIds.value.has(spot.spot_id)) return false
    if (!keyword) return true
    const text = `${spot.spot_name || ''} ${spot.description || ''} ${spot.location || ''} ${getCategoryLabel(category)}`.toLowerCase()
    return text.includes(keyword)
  })
})
const spotCategories = computed(() => {
  const cats = new Map<string, any[]>()
  for (const spot of filteredSpotList.value) {
    const category = spot.category || '其他'
    if (!cats.has(category)) cats.set(category, [])
    cats.get(category)!.push(spot)
  }
  return [...cats.entries()]
})
const spotCount = computed(() => selectedSpotIds.value.size)
const selectedSpotNames = computed(() => spotList.value.filter((spot) => selectedSpotIds.value.has(spot.spot_id)).map((spot) => spot.spot_name))
const selectedSummary = computed(() => {
  if (!selectedSpotNames.value.length) return '暂未选择景点'
  const names = selectedSpotNames.value.slice(0, 4).join('、')
  return selectedSpotNames.value.length > 4 ? `${names} 等 ${selectedSpotNames.value.length} 个` : names
})

const toggleSpot = (id: number) => {
  const selected = new Set(selectedSpotIds.value)
  selected.has(id) ? selected.delete(id) : selected.add(id)
  selectedSpotIds.value = selected
}

const toggleAllByCategory = (spots: any[]) => {
  const selected = new Set(selectedSpotIds.value)
  const allSelected = spots.every((spot) => selected.has(spot.spot_id))
  for (const spot of spots) allSelected ? selected.delete(spot.spot_id) : selected.add(spot.spot_id)
  selectedSpotIds.value = selected
}

const getCategorySelectedCount = (spots: any[]) => spots.filter((spot) => selectedSpotIds.value.has(spot.spot_id)).length
const toggleCategoryCollapse = (cat: string) => {
  const next = new Set(collapsedCategories.value)
  next.has(cat) ? next.delete(cat) : next.add(cat)
  collapsedCategories.value = next
}
const clearSelection = async () => {
  if (!selectedSpotIds.value.size) return
  await ElMessageBox.confirm('确定清空已选景点吗？', '清空选择', { confirmButtonText: '清空', cancelButtonText: '取消', type: 'warning' })
    .then(() => { selectedSpotIds.value = new Set(); ElMessage.success('已清空选择') })
    .catch(() => {})
}
const openSpotDetail = (spot: any) => {
  activeSpot.value = spot
  detailVisible.value = true
}

const togglePref = (value: string) => {
  const index = selectedPreferences.value.indexOf(value)
  index >= 0 ? selectedPreferences.value.splice(index, 1) : selectedPreferences.value.push(value)
}

const generatePreferenceRoute = async () => {
  if (!selectedPreferences.value.length) {
    ElMessage.warning('请先选择至少一个游览偏好')
    return
  }
  preferenceRecommendationLoading.value = true
  try {
    const response = await getRouteRecommendation(selectedPreferences.value)
    const body = response.data
    if (body.code !== 0 || !body.data?.spot_ids?.length) {
      ElMessage.error(body.message || '暂无符合偏好的景点')
      return
    }
    preferenceRecommendation.value = body.data
    selectedRouteId.value = null
    selectedSpotIds.value = new Set(body.data.spot_ids)
    refreshMapMarkers()
    ElMessage.success(`已生成 ${body.data.spot_count} 个景点的个性化路线`)
  } catch {
    ElMessage.error('个性化路线生成失败，请检查后端服务')
  } finally {
    preferenceRecommendationLoading.value = false
  }
}

// ======================== AI 对话推荐 ========================
const aiChatExpanded = ref(true)
const aiChatMessage = ref('')
const aiChatLoading = ref(false)
const aiChatMessages = ref<Array<{
  role: 'user' | 'ai'
  content: string
  meta?: { mode: string; model?: string; selected?: number; excluded?: number }
}>>([])

const handleAiChatSend = async () => {
  const msg = aiChatMessage.value.trim()
  if (!msg) return
  aiChatMessages.value.push({ role: 'user', content: msg })
  aiChatMessage.value = ''
  aiChatLoading.value = true

  try {
    const res = await aiChatRecommend(msg)
    if ((res.data as any).code === 0) {
      const data = (res.data as any).data
      // 显示 AI 回复
      const reply = data.ai_response || `已为您推荐 ${data.spot_count} 个景点（预计 ${data.total_duration} 分钟）`
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
        selectedSpotIds.value = new Set(data.spot_ids)
        activeMenuTab.value = 'route'
      }
    } else {
      aiChatMessages.value.push({ role: 'ai', content: '抱歉，AI推荐失败：' + ((res.data as any).message || '未知错误') })
    }
  } catch (e) {
    aiChatMessages.value.push({ role: 'ai', content: '抱歉，AI服务请求失败，请稍后重试' })
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
  selectedRouteId.value = route.route_id
  selectedSpotIds.value = new Set(route.spot_ids || [])
  ElMessage.success(`已选择路线「${route.name}」`)
}

/**
 * 数字人形象不是单独的皮肤：它与导游人设、声音和讲解风格绑定。
 * 选择形象时同步选择对应导游，避免出现男模型仍使用女导游会话的情况。
 */
const selectGuideModel = (model: { guideId: number }) => {
  selectedGuide.value = guideList.value.find((guide) => guide.guide_id === model.guideId) || null
}

const startTour = async () => {
  if (!selectedSpotIds.value.size) {
    ElMessage.warning('请至少选择 1 个景点后继续')
    return
  }
  if (!selectedGuide.value) { ElMessage.warning('请选择数字人形象'); return }
  if (!selectedPreferences.value.length) { ElMessage.warning('请选择游览偏好'); return }
  const name = visitorName.value.trim() || '游客'
  starting.value = true
  const guideId = selectedGuide.value.guide_id
  const params = new URLSearchParams({
    name: `${name}的导览`,
    guide_id: String(guideId),
    route_id: String(selectedRouteId.value || 0),
    visitor_preferences: selectedPreferences.value.join(','),
    spot_ids: JSON.stringify([...selectedSpotIds.value]),
  })

  try {
    const response = await fetch(`/tour-session/visitor-create?${params.toString()}`, { method: 'POST' })
    const json = await response.json()
    const sid = json?.data?.session_id
    if (sid) {
      if (json.data.avatar_access_token) sessionStorage.setItem('xingyun-tour-' + sid, json.data.avatar_access_token)
      // 模型、姓名、声音均以服务端会话中的 guide_id 为准，防止前后端配置不一致。
      router.push({ path: `/visitor/${sid}` })
    } else {
      ElMessage.error('创建会话失败: ' + (json?.message || '未知错误'))
    }
  } catch (e: any) {
    console.error('[VisitorHome] 创建异常:', e)
    ElMessage.error('网络异常，请重试')
  } finally {
    starting.value = false
  }
}

const goBack = () => router.push('/login')
onMounted(() => { fetchData() })

// 选中变化时刷新地图标记
watch(selectedSpotIds, () => { nextTick(() => refreshMapMarkers()) }, { deep: true })
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

<template>
  <main class="visitor-home">
    <div class="visitor-topbar-shell">
      <header class="visitor-topbar">
        <div class="visitor-brand">
          <div class="visitor-mark">AI</div>
          <div>
            <h1>智游灵境</h1>
          </div>
        </div>
        <div class="visitor-top-actions">
          <div class="selection-counter"><el-icon><Location /></el-icon><span>已选景点</span><strong>{{ spotCount }}</strong></div>
          <el-button plain :icon="ArrowLeft" @click="goBack">返回登录</el-button>
        </div>
      </header>
    </div>

    <div class="visitor-intro">
      <div>
        <h2>定制你的景区游览方案</h2>
      </div>
      <div class="process-steps">
        <span><i>01</i>选择景点</span><b></b><span><i>02</i>选择导游</span><b></b><span><i>03</i>开始导览</span>
      </div>
    </div>

    <!-- 三栏布局 -->
    <div v-loading="loading" class="visitor-main">
      <!-- 左侧菜单 -->
      <nav class="visitor-menu">
        <div class="menu-item" :class="{ active: activeMenuTab === 'route' }" @click="activeMenuTab = 'route'">
          <el-icon><Location /></el-icon>
          <span>游览路线</span>
        </div>
        <div class="menu-item" :class="{ active: activeMenuTab === 'personal' }" @click="activeMenuTab = 'personal'">
          <el-icon><User /></el-icon>
          <span>个性化</span>
        </div>
      </nav>

      <!-- 中间内容区 -->
      <section class="visitor-content">
        <!-- 游览路线选择 TAB -->
        <div v-show="activeMenuTab === 'route'" class="tab-content">
          <!-- 地图 -->
          <div class="content-card map-card">
            <div class="card-title">景区地图</div>
            <div class="map-container" ref="mapDiv"></div>
            <div class="map-spots" v-if="spotList.length">
              <el-tag v-for="spot in spotList.slice(0, 8)" :key="spot.spot_id" size="small" effect="plain" type="info" class="map-spot-tag" @click="scrollToSpot(spot.spot_id)">📍 {{ spot.spot_name }}</el-tag>
            </div>
          </div>

          <!-- 推荐游览路线 -->
          <div class="content-card" v-if="routeList.length > 0">
            <div class="card-title">推荐游览路线 <span class="card-sub">管理员预设路线，点击即可一键选择所有对应景点</span></div>
            <div class="routes-grid">
              <div v-for="route in routeList" :key="route.route_id" class="route-card" :class="{ selected: selectedRouteId === route.route_id }" @click="selectRoute(route)">
                <div v-if="route.cover_image" class="route-cover"><img :src="route.cover_image" :alt="route.name" loading="lazy" /><small v-if="route.cover_generated">AI路线示意图</small></div>
                <div class="route-card-top"><span class="route-theme-tag">{{ route.theme || '综合' }}</span><span class="route-time">{{ route.estimated_time_minutes || '--' }} 分钟</span></div>
                <h3 class="route-name">{{ route.name }}</h3>
                <p class="route-desc">{{ route.description || '综合游览路线' }}</p>
                <div class="route-spots"><el-icon :size="14"><Location /></el-icon><span>{{ (route.spot_names || []).join(' → ') || `${route.spot_count || 0} 个景点` }}</span></div>
                <div class="route-card-bottom"><el-tag size="small" round>{{ route.spot_count || 0 }} 个景点</el-tag><span class="route-check" v-if="selectedRouteId === route.route_id"><el-icon><Check /></el-icon> 已选择</span><span class="route-select-hint" v-else>点击选择</span></div>
              </div>
            </div>
          </div>

          <!-- 选择导览景点 -->
          <div class="content-card spot-card-section">
            <div class="card-title">选择导览景点 <span class="card-sub">按分类选择或搜索指定景点</span><span class="panel-total"><strong>{{ spotCount }}</strong>/ {{ spotList.length }} 已选</span></div>
            <div class="selection-toolbar">
              <el-input v-model="searchKeyword" :prefix-icon="Search" placeholder="搜索景点..." clearable size="small" />
              <el-select v-model="categoryFilter" placeholder="全部分类" size="small" class="category-select">
                <el-option label="全部分类" value="all" />
                <el-option v-for="cat in categoryOptions" :key="cat" :label="getCategoryLabel(cat)" :value="cat" />
              </el-select>
              <el-button size="small" :type="showSelectedOnly ? 'primary' : 'default'" plain @click="showSelectedOnly = !showSelectedOnly">只看已选</el-button>
              <el-button size="small" plain :icon="Delete" @click="clearSelection" :disabled="spotCount === 0 || !selectedGuide || !selectedPreferences.length">清空</el-button>
            </div>
            <div class="selected-summary" :class="{ empty: spotCount === 0 }"><span>已选 {{ spotCount }} 个景点</span><p>{{ selectedSummary }}</p></div>
            <div v-if="spotList.length === 0 && !loading" class="empty-hint compact"><el-icon><Location /></el-icon><strong>暂无景点数据</strong></div>
            <div v-else-if="filteredSpotList.length === 0 && !loading" class="empty-hint compact"><el-icon><Search /></el-icon><strong>未找到相关景点</strong></div>
            <div v-for="[cat, spots] in spotCategories" :key="cat" class="category-group">
              <div class="category-header"><div><span class="category-line"></span><strong>{{ getCategoryLabel(cat) }}</strong><small>{{ spots.length }} 个 · 已选 {{ getCategorySelectedCount(spots) }}</small></div><div class="category-actions"><el-button size="small" plain @click="toggleAllByCategory(spots)">{{ spots.every((s) => selectedSpotIds.has(s.spot_id)) ? '取消本类' : '全选本类' }}</el-button><el-button size="small" text @click="toggleCategoryCollapse(cat)">{{ collapsedCategories.has(cat) ? '展开' : '收起' }}</el-button></div></div>
              <div v-show="!collapsedCategories.has(cat)" class="spot-grid">
                <article v-for="spot in spots" :key="spot.spot_id" :data-spot-id="spot.spot_id" class="spot-card" :class="{ selected: selectedSpotIds.has(spot.spot_id) }" @click="toggleSpot(spot.spot_id)" tabindex="0">
                  <div v-if="spot.image_path" class="spot-photo-background" aria-hidden="true">
                    <img :src="spot.image_path" alt="" class="spot-photo-clear" loading="lazy" />
                    <img :src="spot.image_path" alt="" class="spot-photo-blur" loading="lazy" />
                    <span class="spot-photo-wash"></span>
                  </div>
                  <span class="spot-check"><el-icon><Check /></el-icon></span>
                  <span class="spot-info"><span class="spot-title-row"><strong>{{ spot.spot_name }}</strong><em>{{ getCategoryLabel(spot.category || '其他') }}</em></span><small>{{ spot.description || spot.location || '景区特色景点' }}</small></span>
                  <button class="detail-link" type="button" @click.stop="openSpotDetail(spot)"><el-icon><View /></el-icon>详情</button>
                </article>
              </div>
            </div>
          </div>
        </div>

        <!-- 个性化选择 TAB -->
        <div v-show="activeMenuTab === 'personal'" class="tab-content">
          <!-- 数字人形象 -->
          <div class="content-card">
            <div class="card-title">数字人形象</div>
            <div v-for="cat in modelCategories" :key="cat.label" class="model-cat">
              <div class="model-grid">
                <button v-for="m in cat.models" :key="m.guideId" type="button" class="model-card" :class="{ selected: selectedGuide?.guide_id === m.guideId }" @click="selectGuideModel(m)">
                  <span class="model-preview">
                    <img v-if="m.poster" :src="m.poster" :alt="m.name" class="guide-selection-photo" /><span v-else>暂无形象照片</span>
                  </span>
                  <span class="model-name">{{ m.name }}<small>{{ m.voiceLabel }}</small></span>
                  <el-icon class="selected-icon" v-if="selectedGuide?.guide_id === m.guideId"><Check /></el-icon>
                </button>
              </div>
            </div>
            <div v-if="selectedGuide" class="selected-guide-photo"><img v-if="selectedGuide.poster_image || selectedGuide.avatar" :src="selectedGuide.poster_image || selectedGuide.avatar" :alt="selectedGuide.name" /><span v-else>暂无形象照片</span></div>
          </div>
          <!-- 游览偏好 -->
          <div class="content-card">
            <div class="card-title">游览偏好 <span class="card-sub">基于偏好匹配、路线多样性与地理距离生成</span></div>
            <div class="preference-grid">
              <button v-for="pref in preferenceOptions" :key="pref.value" type="button" class="pref-card" :class="{ selected: selectedPreferences.includes(pref.value) }" @click="togglePref(pref.value)">
                <el-icon><component :is="pref.icon" /></el-icon><span>{{ pref.label }}</span><el-icon class="selected-icon"><Check /></el-icon>
              </button>
            </div>
            <div class="preference-action">
              <el-button type="primary" :loading="preferenceRecommendationLoading" @click="generatePreferenceRoute">
                生成个性化路线
              </el-button>
            </div>
            <div v-if="preferenceRecommendation" class="algorithm-result">
              <div class="algorithm-result-head">
                <strong>{{ preferenceRecommendation.name }}</strong>
                <el-tag size="small" effect="plain">{{ preferenceRecommendation.algorithm_version }}</el-tag>
              </div>
              <p>{{ preferenceRecommendation.recommendation_explanation }}</p>
              <div class="algorithm-route">
                {{ preferenceRecommendation.spot_names.join(' → ') }}
              </div>
              <div class="algorithm-meta">
                <span>{{ preferenceRecommendation.spot_count }} 个景点</span>
                <span>预计 {{ preferenceRecommendation.estimated_time_minutes }} 分钟</span>
                <span>最高匹配分 {{ preferenceRecommendation.score_details[0]?.score || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 底部操作区：AI 推荐为主，导览启动为辅 -->
      <aside class="visitor-start">
        <!-- 开启专属导览 -->
        <div class="start-panel">
          <h2>开启专属导览</h2>
          <el-input v-model="visitorName" placeholder="输入昵称（选填）" maxlength="12" />
          <el-button v-if="spotCount>0 && (!selectedGuide || !selectedPreferences.length)" @click="activeMenuTab='personal'">去选数字人形象</el-button>
          <el-button type="primary" size="large" class="start-btn" @click="startTour" :loading="starting" :disabled="spotCount === 0 || !selectedGuide || !selectedPreferences.length">开始智能导览</el-button>
        </div>

        <!-- AI 对话推荐 -->
        <div class="ai-chat-panel" :class="{ expanded: aiChatExpanded }">
          <div class="ai-chat-header" @click="aiChatExpanded = !aiChatExpanded">
            <div class="ai-chat-title">
              <span class="ai-icon">🤖</span>
              <span>AI 智能推荐</span>
              <el-tag size="small" type="warning" effect="plain" round>对话</el-tag>
            </div>
            <el-icon :class="{ rotated: aiChatExpanded }"><ArrowDown /></el-icon>
          </div>
          <div v-show="aiChatExpanded" class="ai-chat-body">
            <!-- 对话消息区 -->
            <div class="ai-chat-messages">
              <div v-if="!aiChatMessages.length" class="ai-chat-placeholder">
                💬 告诉我你的需求，例如：<br>
                "我想带孩子玩2小时，喜欢自然风光"
              </div>
              <div v-for="(msg, i) in aiChatMessages" :key="i" class="ai-msg" :class="msg.role">
                <div>
                  <div class="ai-msg-bubble">{{ msg.content }}</div>
                  <div v-if="msg.role === 'ai' && msg.meta" class="ai-evidence">
                    <span>{{ msg.meta.mode === 'llm_with_budget_guardrail' ? 'DeepSeek Flash 推理' : '可解释推荐算法' }}</span>
                    <span v-if="msg.meta.selected">精选 {{ msg.meta.selected }} 个景点</span>
                    <span v-if="msg.meta.excluded">排除 {{ msg.meta.excluded }} 个不匹配景点</span>
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
                placeholder="描述你的游览需求..."
                :disabled="aiChatLoading"
                @keyup.enter="handleAiChatSend"
                size="small"
              />
              <el-button type="primary" size="small" :loading="aiChatLoading" :disabled="!aiChatMessage.trim()" @click="handleAiChatSend">
                <el-icon><Promotion /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <el-drawer v-model="detailVisible" size="520px" :with-header="false" class="spot-detail-drawer">
      <div v-if="activeSpot" class="spot-detail">
        <header class="spot-detail-hero">
          <button class="spot-detail-close" type="button" aria-label="关闭景点详情" @click="detailVisible = false">
            <el-icon><Close /></el-icon>
          </button>
          <span class="spot-category">{{ getCategoryLabel(activeSpot.category || '其他') }}</span>
          <h2>{{ activeSpot.spot_name }}</h2>
          <p>{{ activeSpot.description || '暂无景点简介。' }}</p>
          <div v-if="getSpotTags(activeSpot).length" class="spot-tag-list">
            <span v-for="tag in getSpotTags(activeSpot)" :key="tag">{{ tag }}</span>
          </div>
        </header>

        <section class="spot-detail-metrics">
          <div><small>建议游览</small><strong>{{ activeSpot.visit_duration || 20 }} 分钟</strong></div>
          <div><small>最佳季节</small><strong>{{ activeSpot.best_season || '四季皆宜' }}</strong></div>
          <div><small>自动播报</small><strong>{{ Math.round(activeSpot.trigger_radius || 50) }} 米内</strong></div>
        </section>

        <section class="spot-location-card">
          <el-icon><Location /></el-icon>
          <div>
            <small>景点位置</small>
            <strong>{{ activeSpot.location || '颐和园景区内' }}</strong>
            <span v-if="activeSpot.latitude && activeSpot.longitude">
              {{ formatCoordinate(activeSpot.latitude) }}, {{ formatCoordinate(activeSpot.longitude) }}
            </span>
          </div>
        </section>

        <section v-if="activeSpot.history_detail" class="spot-story-card">
          <div class="spot-section-title"><el-icon><OfficeBuilding /></el-icon><strong>历史与文化</strong></div>
          <p>{{ activeSpot.history_detail }}</p>
        </section>

        <div class="spot-guide-grid">
          <article v-if="activeSpot.photo_tips">
            <div class="spot-section-title"><el-icon><Camera /></el-icon><strong>推荐取景</strong></div>
            <p>{{ activeSpot.photo_tips }}</p>
          </article>
          <article v-if="activeSpot.tour_tips">
            <div class="spot-section-title"><el-icon><Compass /></el-icon><strong>游览提示</strong></div>
            <p>{{ activeSpot.tour_tips }}</p>
          </article>
          <article v-if="activeSpot.service_facilities" class="wide">
            <div class="spot-section-title"><el-icon><Guide /></el-icon><strong>周边服务</strong></div>
            <p>{{ activeSpot.service_facilities }}</p>
          </article>
        </div>

        <footer class="spot-detail-footer">
          <div><strong>AI 数字导游已就绪</strong><span>加入路线后，可获得位置触发讲解与知识问答服务</span></div>
          <el-button type="primary" size="large" @click="toggleSpot(activeSpot.spot_id)">
            {{ selectedSpotIds.has(activeSpot.spot_id) ? '移出路线' : '加入路线' }}
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
  background:
    radial-gradient(circle at 91% 0%, rgba(56, 189, 248, 0.2), transparent 24rem),
    linear-gradient(rgba(14, 165, 233, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.03) 1px, transparent 1px),
    var(--canvas);
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
  border: 1px solid rgba(125, 211, 252, 0.58);
  border-radius: 16px;
  background:
    radial-gradient(circle at 92% 0%, rgba(255, 255, 255, 0.82), transparent 16rem),
    linear-gradient(112deg, rgba(224, 247, 255, 0.94), rgba(125, 211, 252, 0.58));
  box-shadow: 0 14px 32px rgba(14, 116, 144, 0.1);
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
    color: #ffffff;
    background: linear-gradient(135deg, #38bdf8, #0284c7);
    box-shadow: 0 9px 18px rgba(14, 116, 144, 0.2);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  h1 { margin: 0; color: #083f63; font-size: 18px; font-weight: 850; letter-spacing: 0; }
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
  border: 1px solid rgba(125, 211, 252, 0.72);
  border-radius: 16px;
  color: #0b4166;
  background:
    radial-gradient(circle at 84% 22%, rgba(255, 255, 255, 0.68), transparent 16rem),
    linear-gradient(113deg, #e0f7ff 0%, #7dd3fc 100%);
  box-shadow: 0 18px 32px rgba(14, 116, 144, 0.13);

  h2 { margin: 0; color: #083f63; font-size: 24px; font-weight: 850; }
}

.process-steps { display: flex; align-items: center; gap: 10px; padding-bottom: 4px;
  span { display: flex; align-items: center; gap: 7px; color: #075985; font-size: 11px; font-weight: 750; letter-spacing: 0; white-space: nowrap; }
  i { display: grid; width: 22px; height: 22px; place-items: center; border: 1px solid rgba(2, 132, 199, 0.22); border-radius: 50%; color: #0369a1; background: rgba(255, 255, 255, 0.48); font-style: normal; font-size: 9px; }
  b { width: 20px; height: 1px; background: rgba(2, 132, 199, 0.22); }
}

/* 三栏布局 */
.visitor-main { display: flex; gap: 0; max-width: 1440px; margin: 0 auto; align-items: flex-start; min-height: calc(100vh - 260px); }

/* 左侧菜单 */
.visitor-menu { width: 72px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; padding: 8px 4px; background: rgba(255,255,255,.9); border-radius: 12px; border: 1px solid var(--line-soft); }
.menu-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border-radius: 10px; cursor: pointer; font-size: 11px; color: var(--ink-500); transition: all .16s; text-align: center;
  .el-icon { font-size: 20px; }
  &:hover { background: #f0f9ff; color: var(--brand-700); }
  &.active { background: #e0f2fe; color: var(--brand-700); font-weight: 700; }
}

/* 中间内容区 */
.visitor-content { flex: 1; min-width: 0; margin: 0 14px; }
.tab-content { display: flex; flex-direction: column; gap: 14px; }
.content-card { background: rgba(255,255,255,.94); border: 1px solid var(--line-soft); border-radius: 12px; padding: 16px 18px; }
.card-title { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 12px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  .card-sub { font-size: 11px; font-weight: 400; color: #94a3b8; }
  .panel-total { margin-left: auto; font-size: 12px; color: var(--ink-500); strong { color: var(--brand-700); font-size: 20px; font-weight: 900; } }
}

/* 地图 */
.map-card { padding: 14px 18px; }
.map-container { width: 100%; height: 220px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-soft); background: #f0f9ff; z-index: 1; margin-bottom: 8px; }
.map-spots { display: flex; flex-wrap: wrap; gap: 5px; }
.map-spot-tag { font-size: 11px !important; cursor: pointer; }
:deep(.leaflet-control-zoom) { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,.15) !important; border-radius: 8px !important; overflow: hidden; }
:deep(.leaflet-control-zoom a) { width: 30px !important; height: 30px !important; line-height: 30px !important; }
:deep(.leaflet-popup-content) { margin: 8px 12px; font-size: 13px; }
:deep(.spot-marker) { background: transparent !important; border: none !important; }

/* 路线卡片 */
.routes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.route-card { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 14px 16px 12px; border: 1px solid #d6e6f2; border-radius: 12px; cursor: pointer; background: #fff; transition: all .16s;
  &:hover { border-color: #a9d5f3; transform: translateY(-1px); background: #f8fcff; box-shadow: 0 6px 14px rgba(14,80,120,.06); }
  &.selected { border-color: var(--brand-600); background: #eaf6ff; .route-check { color: var(--brand-700); } }
}
.route-card-top { display: flex; align-items: center; justify-content: space-between; }
.route-theme-tag { display: inline-flex; padding: 2px 8px; border-radius: 999px; color: #075985; background: #e0f2fe; font-size: 10px; font-weight: 750; }
.route-time { color: var(--ink-400); font-size: 11px; }
.route-name { margin: 0; font-size: 15px; font-weight: 850; color: var(--ink-900); }
.route-desc { margin: 0; font-size: 11px; color: var(--ink-500); display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.route-spots { display: flex; align-items: flex-start; gap: 4px; color: var(--ink-500); font-size: 11px; .el-icon { flex-shrink: 0; margin-top: 1px; color: var(--brand-600); } span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
.route-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(14,80,120,.05); }
.route-check { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 750; }
.route-select-hint { color: var(--ink-400); font-size: 11px; }

/* 景点选择 */
.spot-card-section { padding-bottom: 12px; }
.selection-toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; .el-input { width: 200px; } .category-select { width: 130px; } }
.selected-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 8px 12px; border: 1px solid rgba(14,165,233,.14); border-radius: 10px; color: #075985; background: #f0f9ff; font-size: 12px;
  span { font-weight: 850; } p { margin: 0; color: var(--ink-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &.empty { color: var(--ink-400); background: #fbfdff; }
}
.category-group { padding: 12px 0; border-bottom: 1px solid var(--line-soft); &:last-child { border-bottom: 0; } }
.category-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
  > div { display: flex; align-items: center; gap: 8px; } strong { font-size: 14px; } small { color: var(--ink-400); font-size: 11px; } .category-line { width: 3px; height: 18px; border-radius: 2px; background: var(--brand-600); }
}
.category-actions { display: flex; align-items: center; gap: 4px; }
.spot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.spot-card { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px 36px; border: 1px solid #d6e6f2; border-radius: 12px; cursor: pointer; background: #fff; transition: all .14s;
  &:hover { border-color: #a9d5f3; background: #f8fcff; }
  &.selected { border-color: var(--brand-600); background: #eaf6ff; .spot-check { color: #fff; background: var(--brand-600); border-color: var(--brand-600); } }
}
.spot-check { display: grid; width: 18px; height: 18px; place-items: center; border: 1px solid #cbd9df; border-radius: 5px; color: transparent; font-size: 11px; flex-shrink: 0; margin-top: 2px; }
.spot-info { min-width: 0; flex: 1; }
.spot-title-row { display: flex; align-items: center; justify-content: space-between; gap: 6px;
  strong { overflow: hidden; color: var(--ink-900); font-size: 14px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
  em { flex-shrink: 0; color: var(--brand-700); font-size: 10px; font-style: normal; font-weight: 750; }
}
.spot-info small { display: -webkit-box; margin-top: 4px; overflow: hidden; color: var(--ink-500); font-size: 11px; line-height: 1.4; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.detail-link { position: absolute; right: 10px; bottom: 8px; display: inline-flex; align-items: center; gap: 3px; border: 0; color: var(--brand-700); cursor: pointer; background: transparent; font-size: 11px; font-weight: 750; }
.empty-hint.compact { display: grid; place-items: center; min-height: 120px; color: var(--ink-400); .el-icon { font-size: 24px; } strong { font-size: 13px; } }

/* 个性化 TAB */
.guide-list { display: flex; flex-wrap: wrap; gap: 8px; }
.guide-card { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--line-soft); border-radius: 10px; cursor: pointer; background: #fff; transition: all .14s;
  &:hover { border-color: #a8cbd4; }
  &.selected { border-color: var(--brand-600); background: #f2fafb; .selected-icon { opacity: 1; } }
  .el-avatar { color: var(--brand-700); background: var(--brand-100); font-size: 11px; font-weight: 800; }
  > span strong { color: var(--ink-900); font-size: 13px; }
}
.preference-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.preference-action { margin-top: 14px; }
.algorithm-result { margin-top: 14px; padding: 13px 14px; border: 1px solid #bae6fd; border-radius: 10px; background: linear-gradient(135deg, #f0f9ff, #f8fafc);
  p { margin: 8px 0; color: var(--ink-500); font-size: 11px; line-height: 1.6; }
}
.algorithm-result-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; strong { color: #0c4a6e; font-size: 14px; } }
.algorithm-route { color: var(--ink-800); font-size: 12px; font-weight: 700; line-height: 1.6; }
.algorithm-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; color: #0369a1; font-size: 11px; }
.pref-card { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--line-soft); border-radius: 8px; cursor: pointer; background: #fff; font-size: 12px; font-weight: 650; transition: all .14s;
  &:hover { border-color: #a8cbd4; }
  &.selected { border-color: var(--brand-600); color: var(--brand-700); background: #f2fafb; .selected-icon { opacity: 1; } }
  .el-icon:first-child { color: var(--brand-600); font-size: 14px; }
}
.selected-icon { margin-left: auto; opacity: 0; color: var(--brand-600); transition: opacity .14s; }

/* 数字人形象选择 */
.model-cat { margin-bottom: 14px; &:last-child { margin-bottom: 0; } }
.model-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.model-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px 10px; border: 1px solid var(--line-soft); border-radius: 10px; cursor: pointer; background: #fff; transition: all .14s; text-align: center;
  &:hover { border-color: #a8cbd4; background: #f8fcff; }
  &.selected { border-color: var(--brand-600); background: #eaf6ff; .model-type { color: #fff; background: #0284c7; } .selected-icon { opacity: 1; } }
}
.guide-selection-photo{width:100%;height:100%;object-fit:contain}.selected-guide-photo{height:360px;text-align:center}.selected-guide-photo img{height:100%;max-width:100%;object-fit:contain}
.model-preview { width: 80px; height: 110px; display: flex; align-items: center; justify-content: center; }
.model-type { display:grid; width:48px; height:48px; place-items:center; border-radius:12px; color:#315d75; background:#e8f2f6; font-size:12px; font-weight:900; letter-spacing:.08em; transition:all .14s; }
.model-name { display:flex; flex-direction:column; gap:2px; font-size:11px; color:#374151; font-weight:700; small { color:#8a98a8; font-size:9px; font-weight:600; } }

/* ======================== AI 对话推荐面板 ======================== */
.ai-chat-panel {
  margin-bottom: 14px;
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.35);
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.08);
  overflow: hidden;
  transition: box-shadow 0.2s;

  &.expanded {
    box-shadow: 0 12px 28px rgba(99, 102, 241, 0.14);
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

  &:hover { background: rgba(99, 102, 241, 0.06); }

  .el-icon {
    font-size: 14px;
    color: #5b21b6;
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
  color: #4c1d95;
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
  &::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 4px; }
}

.ai-chat-placeholder {
  text-align: center;
  padding: 18px 8px;
  color: #a78bfa;
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
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  &.ai .ai-msg-bubble {
    background: #fff;
    color: #374151;
    border: 1px solid #e5e7eb;
    border-bottom-left-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }

  &.ai .typing {
    display: flex;
    gap: 4px;
    padding: 10px 16px;

    span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a78bfa;
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
    border: 1px solid #dfe3f8;
    border-radius: 999px;
    color: #4053b5;
    background: #f4f6ff;
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
  border-top: 1px solid #e5e7eb;
  background: rgba(255,255,255,.55);

  :deep(.el-input__wrapper) {
    background: #fff;
    border-radius: 20px;
  }
}

/* 右侧开启专属导览 */
.visitor-start { width: 280px; flex-shrink: 0; }
.start-panel { padding: 20px; border-radius: 14px; border: 1px solid rgba(125,211,252,.4); color: #0b4166; background: linear-gradient(135deg,#e0f7ff,#7dd3fc); box-shadow: 0 14px 25px rgba(14,116,144,.14);
  h2 { margin: 0 0 14px; color: #083f63; font-size: 17px; font-weight: 850; }
  :deep(.el-input__wrapper) { background: rgba(255,255,255,.94); }
  .start-btn { width: 100%; margin-top: 10px; color: #fff; border-color: var(--brand-600); background: var(--brand-600); font-size: 16px; font-weight: 700; height: 48px; &:hover { color: #fff; background: var(--brand-700); } }
}

/* 景点详情抽屉 */
:global(.spot-detail-drawer .el-drawer__body) { padding: 0; overflow: auto; background: #f5f7fb; }
.spot-detail {
  min-height: 100%;
  color: #182033;
}
.spot-detail-hero {
  position: relative;
  padding: 32px 30px 38px;
  color: #fff;
  background:
    radial-gradient(circle at 90% 10%, rgba(99, 124, 255, .34), transparent 15rem),
    linear-gradient(145deg, #111521, #202d55);
  h2 { margin: 12px 0 10px; font-size: 30px; font-weight: 800; letter-spacing: -.04em; }
  > p { max-width: 430px; margin: 0; color: #c8d0e5; font-size: 14px; line-height: 1.85; }
}
.spot-detail-close {
  position: absolute;
  top: 20px;
  right: 20px;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  background: rgba(255,255,255,.08);
  transition: background .15s;
  &:hover { background: rgba(255,255,255,.16); }
}
.spot-category {
  display: inline-flex;
  padding: 5px 10px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 999px;
  color: #dfe4ff;
  background: rgba(255,255,255,.09);
  font-size: 11px;
  font-weight: 800;
}
.spot-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 18px;
  span { padding: 4px 8px; border-radius: 6px; color: #bfcaff; background: rgba(91,111,216,.18); font-size: 10px; font-weight: 700; }
}
.spot-detail-metrics {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin: -18px 24px 18px;
  overflow: hidden;
  border: 1px solid #e3e7f0;
  border-radius: 14px;
  background: #e3e7f0;
  box-shadow: 0 14px 32px rgba(20, 30, 59, .1);
  div { min-width: 0; padding: 15px 12px; background: #fff; text-align: center; }
  small { display: block; margin-bottom: 6px; color: #929bad; font-size: 10px; }
  strong { display: block; overflow: hidden; color: #1a2234; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
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
  border: 1px solid #e1e6ef;
  border-radius: 12px;
  background: #fff;
  .el-icon { display: grid; width: 38px; height: 38px; flex-shrink: 0; place-items: center; border-radius: 10px; color: #3b5bff; background: #edf0ff; font-size: 18px; }
  div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
  small { color: #969fb0; font-size: 10px; }
  strong { color: #20283a; font-size: 13px; }
  span { color: #9aa3b3; font-size: 10px; letter-spacing: .04em; }
}
.spot-story-card {
  margin-top: 14px;
  padding: 18px;
  border: 1px solid #e1e6ef;
  border-radius: 12px;
  background: #fff;
  > p { margin: 11px 0 0; color: #657086; font-size: 12px; line-height: 1.85; }
}
.spot-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #252e43;
  .el-icon { color: #3b5bff; font-size: 16px; }
  strong { font-size: 13px; font-weight: 800; }
}
.spot-guide-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
  article { padding: 17px; border: 1px solid #e1e6ef; border-radius: 12px; background: #fff; }
  article.wide { grid-column: 1 / -1; }
  p { margin: 10px 0 0; color: #6b7588; font-size: 11px; line-height: 1.75; }
}
.spot-detail-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding: 16px 0 20px;
  border-top: 1px solid rgba(218,223,233,.9);
  background: rgba(245,247,251,.94);
  backdrop-filter: blur(12px);
  div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
  strong { color: #20283a; font-size: 12px; }
  span { color: #8d96a7; font-size: 10px; line-height: 1.45; }
  .el-button { flex-shrink: 0; min-width: 108px; border-color: #3b5bff; border-radius: 10px; background: #3b5bff; box-shadow: 0 9px 20px rgba(59,91,255,.22); }
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
  color: #101c2b;
  background:
    radial-gradient(circle at 92% -8%, rgba(20, 184, 166, 0.08), transparent 28rem),
    linear-gradient(rgba(15, 95, 102, 0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 95, 102, 0.018) 1px, transparent 1px),
    #f3f5f7;
  background-size: auto, 40px 40px, 40px 40px, auto;
}

.visitor-topbar {
  height: 58px;
  margin-bottom: 12px;
  border-color: #dce3e7;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 24px rgba(7, 25, 35, 0.055);
  backdrop-filter: blur(18px);
}

.visitor-brand {
  .visitor-mark {
    border-radius: 8px;
    background: linear-gradient(145deg, #14b8a6, #0f5f66);
    box-shadow: 0 8px 20px rgba(13, 148, 136, 0.2);
  }

  h1 { color: #142434; font-size: 17px; font-weight: 760; letter-spacing: 0.01em; }
}

.selection-counter {
  color: #687789;
  .el-icon { color: #0d9488; }
  strong { color: #0f5f66; background: #e6f5f2; }
}

.visitor-intro {
  position: relative;
  overflow: hidden;
  margin-bottom: 14px;
  padding: 22px 28px;
  border: 1px solid rgba(105, 142, 157, 0.2);
  border-radius: 14px;
  color: #dce9ed;
  background:
    radial-gradient(circle at 85% 0%, rgba(45, 212, 191, 0.14), transparent 20rem),
    linear-gradient(135deg, #0b2431, #103748);
  box-shadow: 0 16px 36px rgba(7, 25, 35, 0.13);

  &::after {
    content: '';
    position: absolute;
    right: -3rem;
    bottom: -6rem;
    width: 18rem;
    height: 18rem;
    border: 1px solid rgba(94, 234, 212, 0.1);
    border-radius: 50%;
    box-shadow: 0 0 0 48px rgba(94, 234, 212, 0.025);
    pointer-events: none;
  }

  h2 { position: relative; z-index: 1; color: #f4f8f9; font-size: 23px; font-weight: 730; letter-spacing: -0.02em; }
}

.process-steps {
  position: relative;
  z-index: 1;
  span { color: #afc3ca; font-weight: 620; }
  i { border-color: rgba(94, 234, 212, 0.22); color: #78d7cb; background: rgba(7, 25, 35, 0.32); }
  b { background: rgba(121, 167, 177, 0.24); }
}

.visitor-main { gap: 12px; }
.visitor-menu {
  width: 78px;
  gap: 5px;
  padding: 8px 6px;
  border-color: rgba(126, 158, 171, 0.2);
  border-radius: 11px;
  background: #0d2935;
  box-shadow: 0 12px 30px rgba(7, 25, 35, 0.1);
}
.menu-item {
  color: #8fa7b2;
  border-radius: 8px;
  font-weight: 600;
  &:hover { color: #dff8f4; background: rgba(45, 212, 191, 0.08); }
  &.active { color: #e8faf7; background: rgba(20, 184, 166, 0.18); font-weight: 700; box-shadow: inset 2px 0 0 #2dd4bf; }
}

.visitor-content { margin: 0; }
.tab-content { gap: 12px; }
.content-card {
  border-color: #e0e6ea;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 28px rgba(7, 25, 35, 0.05);
}
.card-title {
  color: #172634;
  font-size: 15px;
  font-weight: 760;
  .card-sub { color: #8997a5; }
  .panel-total strong { color: #0d9488; }
}

.map-container { border-color: #dce4e8; background: #e9eef0; }
:deep(.leaflet-control-zoom) { box-shadow: 0 4px 14px rgba(7, 25, 35, 0.14) !important; }

.routes-grid { gap: 10px; }
.route-card {
  border-color: #e0e6ea;
  border-radius: 9px;
  background: #fff;
  &:hover { border-color: #92bdb7; background: #fbfdfd; box-shadow: 0 10px 22px rgba(7, 25, 35, 0.06); }
  &.selected { border-color: #0d9488; background: #eff9f7; .route-check { color: #0f5f66; } }
}
.route-theme-tag { color: #0f5f66; background: #e6f5f2; }
.route-spots .el-icon { color: #0d9488; }

.selected-summary {
  border-color: #cce7e2;
  border-radius: 8px;
  color: #0f5f66;
  background: #f1f8f7;
  &.empty { background: #f7f9fa; }
}
.category-header .category-line { background: #0d9488; }
.spot-card {
  border-color: #e0e6ea;
  border-radius: 9px;
  &:hover { border-color: #a8cbc6; background: #fbfdfd; }
  &.selected { border-color: #0d9488; background: #eff9f7; .spot-check { background: #0d9488; border-color: #0d9488; } }
}
.spot-title-row em,
.detail-link { color: #0f5f66; }

.guide-card,
.pref-card,
.model-card { border-color: #e0e6ea; border-radius: 9px; }
.guide-card.selected,
.pref-card.selected,
.model-card.selected { border-color: #0d9488; color: #0f5f66; background: #eff9f7; }
.pref-card .el-icon:first-child,
.selected-icon { color: #0d9488; }
.model-card.selected .model-type { background: #0d9488 !important; }
.algorithm-result { border-color: #cce7e2; background: #f3f9f8; }
.algorithm-result-head strong,
.algorithm-meta { color: #0f5f66; }

.visitor-start { width: 292px; }
.ai-chat-panel {
  border-color: #dce5e7;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(7, 25, 35, 0.06);
  &.expanded { border-color: #aed5cf; box-shadow: 0 16px 34px rgba(7, 25, 35, 0.09); }
}
.ai-chat-header {
  border-bottom: 1px solid transparent;
  &:hover { background: #f4f9f8; }
  .el-icon { color: #0f5f66; }
}
.ai-chat-panel.expanded .ai-chat-header { border-bottom-color: #edf1f2; }
.ai-chat-title { color: #17394a; }
.ai-chat-placeholder { color: #8295a0; }
.ai-chat-messages::-webkit-scrollbar-thumb { background: #9bc9c3; }
.ai-msg.user .ai-msg-bubble { background: linear-gradient(135deg, #0d9488, #0f5f66); }
.ai-msg.ai .ai-msg-bubble { border-color: #e1e7ea; color: #344456; background: #f8fafb; }
.ai-msg.ai .typing span { background: #14b8a6; }
.ai-chat-input { border-top-color: #e8edf1; background: #f7f9fa; }

.start-panel {
  padding: 20px;
  border-color: rgba(105, 142, 157, 0.2);
  border-radius: 11px;
  color: #dbe8ec;
  background: linear-gradient(145deg, #0b2431, #103748);
  box-shadow: 0 14px 32px rgba(7, 25, 35, 0.14);
  h2 { color: #f2f7f8; font-size: 16px; font-weight: 720; }
  :deep(.el-input__wrapper) { background: rgba(255, 255, 255, 0.96); }
  .start-btn { border-color: #14b8a6; background: #0d9488; box-shadow: 0 10px 22px rgba(13, 148, 136, 0.2); &:hover { background: #14a596; } }
}

@media (max-width: 1100px) {
  .visitor-main { gap: 0; }
  .visitor-menu { background: #0d2935; }
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
  color: #11141d;
  background:
    radial-gradient(circle at 86% 0%, rgba(74,103,255,.08), transparent 30rem),
    #f6f7fa;
}
.visitor-topbar-shell {
  width: auto;
  margin: 0 calc(-1 * var(--page-gutter)) 18px;
  border-bottom: 1px solid #e6e8ef;
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(22px);
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
  background: #111521;
  box-shadow: 0 10px 24px rgba(15,19,31,.15);
}
.visitor-brand h1 { color: #11141d; font-size: 18px; font-weight: 760; letter-spacing: -.02em; }
.selection-counter .el-icon { color: #3b5bff; }
.selection-counter strong { color: #2948c8; background: #e9edff; }

.visitor-intro {
  margin-bottom: 18px;
  padding: 28px 32px;
  border: 1px solid #e4e7ef;
  border-radius: 20px;
  color: #11141d;
  background:
    radial-gradient(circle at 92% 20%, rgba(59,91,255,.1), transparent 22rem),
    #fff;
  box-shadow: 0 16px 44px rgba(19,26,48,.06);
}
.visitor-intro::before {
  content: 'SCENIC INTELLIGENCE';
  position: absolute;
  right: 32px;
  bottom: 18px;
  color: rgba(42,52,85,.05);
  font-size: 42px;
  font-weight: 900;
  letter-spacing: -.04em;
}
.visitor-intro::after { display: none; }
.visitor-intro h2 { color: #11141d; font-size: 30px; font-weight: 760; letter-spacing: -.045em; }
.process-steps span { color: #687083; }
.process-steps i { border-color: #dde2f8; color: #3b5bff; background: #f1f3ff; }
.process-steps b { background: #dfe3ee; }

.visitor-main { gap: 14px; }
.visitor-menu {
  width: 86px;
  padding: 8px;
  border: 1px solid #e3e6ed;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 36px rgba(20,26,48,.06);
}
.menu-item {
  color: #8a91a2;
  border-radius: 11px;
  font-weight: 620;
}
.menu-item:hover { color: #2948c8; background: #f4f6ff; }
.menu-item.active { color: #fff; background: #111521; box-shadow: none; }

.tab-content { gap: 14px; }
.content-card {
  border-color: #e5e7ed;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 38px rgba(18,25,46,.055);
}
.card-title { color: #151924; font-size: 16px; }
.card-title .card-sub { color: #939aaa; }
.card-title .panel-total strong { color: #3b5bff; }
.map-container { border: 0; border-radius: 12px; background: #eceff5; }
.routes-grid { gap: 12px; }
.route-card {
  border-color: #e8eaf0;
  border-radius: 12px;
  background: #fff;
}
.route-card:hover { border-color: #b9c4ff; background: #fafbff; box-shadow: 0 12px 30px rgba(59,91,255,.08); }
.route-card.selected { border-color: #3b5bff; background: #f3f5ff; box-shadow: 0 0 0 3px rgba(59,91,255,.08); }
.route-card.selected .route-check { color: #2948c8; }
.route-theme-tag { color: #2948c8; background: #e9edff; }
.route-spots .el-icon { color: #3b5bff; }
.selected-summary { border-color: #dfe3f5; color: #2948c8; background: #f5f6fb; }
.selected-summary.empty { background: #f7f8fa; }
.category-header .category-line { background: #3b5bff; }
.spot-card { border-color: #e7e9ef; border-radius: 12px; }
.spot-card:hover { border-color: #bfc8fa; background: #fafbff; }
.spot-card.selected { border-color: #3b5bff; background: #f3f5ff; }
.spot-card.selected .spot-check { border-color: #3b5bff; background: #3b5bff; }
.spot-title-row em, .detail-link { color: #2948c8; }
.guide-card,.pref-card,.model-card { border-color: #e7e9ef; border-radius: 12px; }
.guide-card.selected,.pref-card.selected,.model-card.selected { border-color: #3b5bff; color: #2948c8; background: #f3f5ff; }
.pref-card .el-icon:first-child,.selected-icon { color: #3b5bff; }
.model-card.selected .model-type { background: #3b5bff !important; }
.algorithm-result { border-color: #dfe3f8; background: #f6f7ff; }
.algorithm-result-head strong,.algorithm-meta { color: #2948c8; }

.visitor-start { width: 306px; }
.ai-chat-panel {
  border-color: #e3e6ed;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 38px rgba(18,25,46,.055);
}
.ai-chat-panel.expanded { border-color: #cdd4fa; box-shadow: 0 18px 44px rgba(31,43,88,.1); }
.ai-chat-header:hover { background: #f6f7ff; }
.ai-chat-header .el-icon { color: #3b5bff; }
.ai-chat-panel.expanded .ai-chat-header { border-bottom-color: #eceef4; }
.ai-chat-title { color: #151924; }
.ai-chat-messages::-webkit-scrollbar-thumb { background: #b8c1f5; }
.ai-msg.user .ai-msg-bubble { background: #3b5bff; }
.ai-msg.ai .ai-msg-bubble { border-color: #e7e9f0; color: #444c5e; background: #f7f8fb; }
.ai-msg.ai .typing span { background: #617bff; }
.ai-chat-input { border-top-color: #eceef3; background: #fafbfc; }
.start-panel {
  padding: 24px;
  border: 0;
  border-radius: 16px;
  color: #dfe4f6;
  background:
    radial-gradient(circle at 92% 0%, rgba(92,116,255,.36), transparent 14rem),
    #111521;
  box-shadow: 0 18px 44px rgba(15,19,31,.16);
}
.start-panel h2 { color: #fff; font-size: 18px; }
.start-panel :deep(.el-input__wrapper) { background: rgba(255,255,255,.96); }
.start-panel .start-btn { border-color: #3b5bff; background: #3b5bff; box-shadow: 0 12px 28px rgba(59,91,255,.3); }
.start-panel .start-btn:hover { background: #526cff; }
@media (max-width: 1100px) {
  .visitor-main { gap: 0; }
  .visitor-menu { background: #fff; }
}
@media (max-width: 760px) {
  .visitor-home { --page-gutter: 8px; }
  .visitor-topbar-shell { margin-bottom: 12px; }
  .visitor-topbar { height: 64px; padding: 0 12px; }
  .visitor-top-actions { gap: 8px; }
  .selection-counter span { display: none; }
}

/* Bottom decision workspace: keep the primary AI capability prominent and uncluttered. */
.visitor-main {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  grid-template-areas:
    'menu content'
    'menu actions';
  gap: 14px;
}

.visitor-menu { grid-area: menu; }
.visitor-content { grid-area: content; min-width: 0; }

.visitor-start {
  grid-area: actions;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 285px);
  grid-template-areas: 'ai start';
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
  grid-area: ai;
  min-width: 0;
  min-height: 330px;
  margin-bottom: 0;
}

.ai-chat-header { padding: 16px 20px; }
.ai-chat-title { font-size: 16px; }
.ai-chat-title .ai-icon { font-size: 22px; }
.ai-chat-messages {
  min-height: 210px;
  max-height: 420px;
  padding: 12px 18px 14px;
}
.ai-chat-placeholder {
  display: grid;
  min-height: 180px;
  place-items: center;
  padding: 14px;
  border: 1px dashed #dbe0f4;
  border-radius: 12px;
  background: #fafbff;
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
      'menu'
      'content'
      'actions';
    gap: 12px;
  }
  .visitor-content { margin: 0; }
  .visitor-start {
    position: static;
    z-index: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(230px, 270px);
    grid-template-areas: 'ai start';
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
    grid-template-areas:
      'ai'
      'start';
  }
  .start-panel { min-height: auto; padding: 20px; }
  .ai-chat-panel { min-height: 300px; }
  .ai-chat-messages { min-height: 180px; max-height: 320px; }
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

.route-cover{position:relative;margin:-16px -16px 14px;height:155px;overflow:hidden;border-radius:12px 12px 0 0}.route-cover img{width:100%;height:100%;object-fit:cover}.route-cover small{position:absolute;right:8px;bottom:8px;padding:3px 6px;background:rgba(255,255,255,.85);border-radius:5px;font-size:10px}.spot-list-photo{width:70px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0}
.spot-card{overflow:hidden;isolation:isolate;min-height:112px}
.spot-photo-background{position:absolute;inset:0;z-index:-1;pointer-events:none}
.spot-photo-background img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:left center}
.spot-photo-clear{mask-image:linear-gradient(to right,#000 0%,#000 15%,transparent 65%);-webkit-mask-image:linear-gradient(to right,#000 0%,#000 15%,transparent 65%)}
.spot-photo-blur{filter:blur(7px);transform:scale(1.05);mask-image:linear-gradient(to right,transparent 10%,#000 48%,transparent 100%);-webkit-mask-image:linear-gradient(to right,transparent 10%,#000 48%,transparent 100%)}
.spot-photo-wash{position:absolute;inset:0;background:linear-gradient(to right,rgba(255,255,255,.12),rgba(255,255,255,.78) 40%,rgba(255,255,255,.97) 80%,#fff)}
.spot-card .spot-check,.spot-card .spot-info,.spot-card .detail-link{position:relative;z-index:1}
.spot-card .spot-info{padding-left:54px}
.spot-card .detail-link{position:absolute}
</style>
