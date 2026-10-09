<template>
  <div class="mh-root">
    <div class="mh-top">
      <span>🏔️</span>
      <h1>智游灵境</h1>
    </div>

    <div class="mh-scroll">
      <!-- 路线 -->
      <div class="mh-block" v-if="routeList.length">
        <h2>🗺️ 推荐路线 <small>点击一键选景点</small></h2>
        <div class="mh-route-row">
          <button v-for="r in routeList" :key="r.route_id" class="mh-route" :class="{on:pickedRouteId===r.route_id}" @click="pickRoute(r)">
            <span class="mhr-tag">{{ themeEmoji(r.theme) }} {{ r.theme||'综合' }}</span>
            <strong>{{ r.name }}</strong>
            <span class="mhr-meta">{{ r.spot_count||0 }}景点 · {{ r.estimated_time_minutes||30 }}分钟</span>
          </button>
        </div>
      </div>

      <!-- 景点 -->
      <div class="mh-block">
        <h2>📍 景点 <small>{{ pickedSpots.size }}/{{ spotList.length }}已选</small></h2>
        <div class="mh-chip-wrap">
          <button v-for="s in spotList" :key="s.spot_id" class="mh-chip" :class="{on:pickedSpots.has(s.spot_id)}" @click="toggleSpot(s.spot_id)">
            {{ pickedSpots.has(s.spot_id)?'✓ ':'' }}{{ s.spot_name }}
          </button>
        </div>
        <p v-if="!spotList.length" class="mh-empty">暂无景点数据</p>
      </div>

      <!-- 导游 -->
      <div class="mh-block">
        <h2>🤖 导游</h2>
        <div class="mh-guide-row" v-if="guideList.length">
          <button v-for="g in guideList" :key="g.guide_id" class="mh-guide" :class="{on:pickedGuide?.guide_id===g.guide_id}" @click="pickedGuide=g">
            <span class="mh-guide-mark">{{ g.render_mode === 'xingyun' ? '星云' : '导游' }}</span>
            <strong>{{ g.name }}</strong>
            <small>{{ g.render_mode === 'xingyun' ? g.voice_label || '星云应用音色' : g.voice_style?.startsWith('male_') ? '男声' : '女声' }}</small>
          </button>
        </div>
        <p v-else class="mh-empty">暂无导游</p>
      </div>

      <!-- 偏好 -->
      <div class="mh-block">
        <h2>🎯 偏好</h2>
        <div class="mh-chip-wrap">
          <button v-for="p in prefs" :key="p.value" class="mh-chip" :class="{on:pickedPrefs.includes(p.value)}" @click="togglePref(p.value)">{{ p.emoji }} {{ p.label }}</button>
        </div>
      </div>

      <div style="height:90px"></div>
    </div>

    <div class="mh-bar">
      <div class="mhb-info"><b>{{ pickedSpots.size }}</b>景点 · {{ pickedGuide?.name||'默认导游' }}</div>
      <button class="mhb-start" :disabled="!pickedSpots.size||starting" @click="startTour">{{ starting?'创建中...':'开始智能导览 →' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getVisitorSpotList, getVisitorGuideList, getVisitorRouteList } from '@/api/visitor'

const router = useRouter()
const pickedSpots = ref(new Set<number>())
const pickedRouteId = ref<number|null>(null)
const pickedGuide = ref<any>(null)
const pickedPrefs = ref<string[]>([])
const guideList = ref<any[]>([])
const routeList = ref<any[]>([])
const spotList = ref<any[]>([])
const starting = ref(false)

const prefs=[
  {value:'history',emoji:'🏛️',label:'历史'},
  {value:'nature',emoji:'🌿',label:'自然'},
  {value:'photography',emoji:'📸',label:'拍照'},
  {value:'family',emoji:'👨‍👩‍👧',label:'亲子'},
  {value:'comprehensive',emoji:'🎯',label:'综合'},
]
function themeEmoji(t:string){ const m:Record<string,string>={history:'🏛️',nature:'🌿',photography:'📸',family:'👨‍👩‍👧',comprehensive:'🎯'}; return m[t]||'🎯' }
function toggleSpot(id:number){ const s=new Set(pickedSpots.value); s.has(id)?s.delete(id):s.add(id); pickedSpots.value=s }
function pickRoute(r:any){ pickedRouteId.value=r.route_id; pickedSpots.value=new Set(r.spot_ids||[]) }
function togglePref(v:string){ const i=pickedPrefs.value.indexOf(v); i>=0?pickedPrefs.value.splice(i,1):pickedPrefs.value.push(v) }

async function startTour(){
  if(!pickedSpots.value.size){ ElMessage.warning('请选择景点'); return }
  if(!pickedGuide.value){ ElMessage.warning('请选择数字导游'); return }
  if(!pickedPrefs.value.length){ ElMessage.warning('请选择游览偏好'); return }
  starting.value=true
  try{
    const p=new URLSearchParams({name:'游客导览',guide_id:String(pickedGuide.value?.guide_id||1),visitor_preferences:pickedPrefs.value.join(','),spot_ids:JSON.stringify([...pickedSpots.value])})
    const r=await fetch(`/tour-session/visitor-create?${p.toString()}`,{method:'POST'})
    const j=await r.json()
    if(j?.data?.session_id) {
      if(j.data.avatar_access_token) sessionStorage.setItem('xingyun-tour-' + j.data.session_id, j.data.avatar_access_token)
      router.push(`/m/tour/${j.data.session_id}`)
    }
    else ElMessage.error('创建失败')
  }catch{ ElMessage.error('网络异常') }
  finally{ starting.value=false }
}

onMounted(async()=>{
  try{
    const[gr,sr,rr]=await Promise.all([getVisitorGuideList().catch(()=>null),getVisitorSpotList().catch(()=>null),getVisitorRouteList().catch(()=>null)])
    guideList.value=(gr as any)?.data?.data?.guide_list||(gr as any)?.data?.guide_list||[]
    spotList.value=(sr as any)?.data?.data?.spot_list||(sr as any)?.data?.spot_list||[]
    routeList.value=(rr as any)?.data?.data?.route_list||(rr as any)?.data?.route_list||[]
    if(!pickedGuide.value&&guideList.value.length) pickedGuide.value=guideList.value[0]
  }catch{}
})
</script>

<style lang="scss" scoped>
.mh-root { position:fixed; inset:0; display:flex; flex-direction:column; background:#f1f5f9; }
.mh-top { flex:0 0 auto; display:flex; align-items:center; gap:12px; padding:16px 20px; background:linear-gradient(135deg,#0284c7,#38bdf8); color:#fff;
  span { font-size:30px; }
  h1 { font-size:20px; font-weight:800; margin:0; }
}
.mh-scroll { flex:1 1 auto; overflow-y:auto; padding:12px 16px; -webkit-overflow-scrolling:touch; }
.mh-block { margin-top:20px;
  h2 { font-size:17px; font-weight:800; margin:0 0 12px; color:#0c4a6e; small { font-weight:400; color:#94a3b8; font-size:13px; margin-left:6px; } }
}
.mh-empty { color:#94a3b8; font-size:14px; text-align:center; padding:24px; }

.mh-route-row { display:flex; gap:12px; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:4px; }
.mh-route { flex:0 0 82%; display:flex; flex-direction:column; gap:8px; padding:18px 16px; border:2px solid #e2e8f0; border-radius:18px; background:#fff; text-align:left; cursor:pointer;
  &.on { border-color:#0284c7; background:#f0f9ff; }
  .mhr-tag { font-size:13px; color:#64748b; }
  strong { font-size:16px; color:#0f172a; line-height:1.3; }
  .mhr-meta { font-size:13px; color:#94a3b8; }
}

.mh-chip-wrap { display:flex; flex-wrap:wrap; gap:10px; }
.mh-chip { padding:12px 18px; border:2px solid #e2e8f0; border-radius:24px; background:#fff; font-size:15px; font-weight:600; color:#475569; cursor:pointer;
  &.on { border-color:#0284c7; background:#f0f9ff; color:#0284c7; }
}

.mh-guide-row { display:flex; gap:12px; overflow-x:auto; }
.mh-guide { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 20px; border:2px solid #e2e8f0; border-radius:14px; background:#fff; cursor:pointer;
  &.on { border-color:#0284c7; background:#f0f9ff; }
  strong { font-size:14px; color:#334155; }
  small { color:#94a3b8; font-size:11px; }
}
.mh-guide-mark { display:grid; width:48px; height:48px; place-items:center; border-radius:12px; background:#e0f2fe; color:#0369a1; font-size:13px; font-weight:900; letter-spacing:.08em; }

.mh-bar { flex:0 0 auto; display:flex; align-items:center; gap:14px; padding:14px 16px calc(14px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid #e2e8f0; }
.mhb-info { font-size:13px; color:#64748b; b { color:#0284c7; font-size:16px; } }
.mhb-start { flex:1; height:52px; border:0; border-radius:14px; background:linear-gradient(135deg,#0284c7,#38bdf8); color:#fff; font-size:18px; font-weight:800; cursor:pointer;
  &:disabled { opacity:.4; }
}
</style>
