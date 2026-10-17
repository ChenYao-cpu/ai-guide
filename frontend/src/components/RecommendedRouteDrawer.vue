<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Check, Clock, Close, Compass, Location, Guide } from '@element-plus/icons-vue'
import { t, locale } from '@/i18n'
import type { RecommendedRoute } from '@/types/recommendedRoute'
import ScenicSpotCover from './ScenicSpotCover.vue'

const props = defineProps<{
  modelValue: boolean
  route: RecommendedRoute | null
  spots: Array<{ spot_id: number; spot_name: string; visit_duration?: number; description?: string; image_path?: string; city?: string }>
  selected: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; apply: [route: RecommendedRoute] }>()
const copy = computed(() => props.route?.editorial?.[locale.value === 'en' ? 'en' : 'zh'])
const heroSpot = computed(() => props.spots.find(s => s.spot_name === (props.route?.hero_spot_name || props.route?.spot_names?.[0])))
const stops = computed(() => props.route?.itinerary_stops || (props.route?.spot_ids || []).map((id, index) => {
  const spot = props.spots.find(s => s.spot_id === id)
  return { spot_id: id, spot_name: spot?.spot_name || props.route?.spot_names?.[index] || '', order: index+1,
    visit_minutes: spot?.visit_duration || 20, focus: { zh: spot?.description || '', en: '' } }
}))
function focus(stop: typeof stops.value[number]) { return stop.focus[locale.value === 'en' ? 'en' : 'zh'] || t(stop.focus.zh) }
function distance(meters?: number | null) { return meters == null ? '—' : meters >= 1000 ? (meters/1000).toFixed(2)+' km' : meters+' m' }
</script>

<template>
  <el-drawer :model-value="modelValue" :title="t(route?.name || '路线详情')" size="min(720px,100vw)" :with-header="false" destroy-on-close class="recommended-route-drawer" @update:model-value="emit('update:modelValue',$event)">
    <div v-if="route" :key="route.route_id" class="route-detail">
      <button class="route-detail-close" :aria-label="t('关闭路线详情')" type="button" @click="emit('update:modelValue',false)"><el-icon><Close /></el-icon></button>
      <div class="route-detail-scroll">
        <header class="route-detail-hero">
          <ScenicSpotCover v-if="heroSpot" :spot="heroSpot" class="route-detail-photo" />
          <div class="route-detail-shade" />
          <div class="route-detail-heading"><span>{{ t('主题游览方案') }}</span><h2>{{ t(route.name) }}</h2></div>
        </header>
        <div class="route-detail-body">
          <div class="route-detail-metrics">
            <div><span>{{ t('行程站点') }}</span><strong>{{ route.spot_count || stops.length }} <small>{{ t('站') }}</small></strong></div>
            <div><span>{{ t('沿步道步行') }}</span><strong>{{ distance(route.walking_distance_meters) }}</strong></div>
            <div><span>{{ t('预计用时') }}</span><strong>{{ route.estimated_time_minutes ?? '—' }} <small>{{ t('分钟') }}</small></strong></div>
          </div>
          <p class="route-detail-intro">{{ copy?.summary || t(route.description || '综合游览路线') }}</p>
          <div v-if="copy?.highlights.length" class="route-detail-highlights"><span v-for="highlight in copy.highlights" :key="highlight"><el-icon><Check /></el-icon>{{ highlight }}</span></div>
          <div v-if="copy?.audience" class="route-detail-audience"><el-icon><Compass /></el-icon><div><strong>{{ t('适合人群') }}</strong><p>{{ copy.audience }}</p></div></div>

          <section class="route-stations">
            <h3>{{ t('按站看行程') }}<span>{{ stops.length }} {{ t('站') }}</span></h3>
            <ol>
              <li v-for="(stop,index) in stops" :key="stop.spot_id">
                <span class="route-station-number">{{ index+1 }}</span>
                <div class="route-station-content">
                  <div class="route-station-heading"><h4>{{ t(stop.spot_name) }}</h4><span><el-icon><Clock /></el-icon>{{ t('停留') }} {{ stop.visit_minutes }} {{ t('分钟') }}</span></div>
                  <p v-if="focus(stop)">{{ focus(stop) }}</p>
                  <div v-if="route.walking_legs?.[index]" class="route-next-leg">
                    <el-icon><Guide /></el-icon>
                    <span v-if="route.walking_legs[index].available">{{ t('沿步道至下一站') }} · {{ distance(route.walking_legs[index].meters) }} · {{ route.walking_legs[index].minutes }} {{ t('分钟') }}</span>
                    <span v-else>{{ t('该路段暂不可用') }}</span>
                    <span v-if="route.walking_legs[index].has_steps" class="route-leg-steps">{{ t('含台阶') }}</span>
                  </div>
                </div>
              </li>
            </ol>
          </section>

          <section class="route-time-breakdown">
            <h3>{{ t('时间怎么安排') }}</h3>
            <div><span>{{ t('景点停留') }}</span><strong>{{ route.visit_time_minutes ?? '—' }} {{ t('分钟') }}</strong></div>
            <div><span>{{ t('步行衔接') }}</span><strong>{{ route.walking_time_minutes ?? '—' }} {{ t('分钟') }}</strong></div>
            <div><span>{{ t('休息预留') }}</span><strong>{{ route.rest_time_minutes ?? '—' }} {{ t('分钟') }}</strong></div>
          </section>
          <section v-if="copy?.tips" class="route-detail-tips"><h3>{{ t('出发前了解') }}</h3><p>{{ copy.tips }}</p></section>
          <p class="route-estimate-note">{{ t('距离按园内步行路网测算；总时长包含停留、步行与休息，不含进出园、排队和实时绕行，请以现场通行为准。') }}</p>
        </div>
      </div>
      <footer class="route-detail-footer"><span><el-icon><Location /></el-icon>{{ stops.length }} {{ t('站') }} · {{ distance(route.walking_distance_meters) }}</span><button type="button" :disabled="route.complete===false" @click="emit('apply',route)">{{ t(selected ? '继续使用这条路线' : '使用这条路线') }}<el-icon><ArrowRight /></el-icon></button></footer>
    </div>
  </el-drawer>
</template>

<style scoped>
:global(.recommended-route-drawer){border-radius:26px 0 0 26px;overflow:hidden;box-shadow:-20px 0 80px #252a4129}
:global(.recommended-route-drawer .el-drawer__body){padding:0;overflow:hidden;background:#fff}
.route-detail{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;color:#383447}.route-detail-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#d7cde5 transparent}
.route-detail-close{position:absolute;z-index:3;top:18px;right:20px;width:42px;height:42px;display:grid;place-items:center;border:1px solid #ffffffb3;border-radius:13px;background:#fffffff0;color:#404556;font-size:22px;cursor:pointer}
.route-detail-hero{position:relative;min-height:226px;display:flex;align-items:flex-end;background:#d8d7e6;overflow:hidden}.route-detail-photo{position:absolute;inset:0;height:100%;aspect-ratio:auto}.route-detail-photo :deep(img){transform:none!important}.route-detail-shade{position:absolute;inset:0;background:linear-gradient(180deg,#27304700,#142237c7)}
.route-detail-heading{position:relative;padding:65px 30px 26px;color:white}.route-detail-heading>span{font-size:15px;letter-spacing:.04em;color:#ffffffcf}.route-detail-heading h2{margin:9px 0 0;color:white;font-size:29px;line-height:1.4;font-weight:600;overflow-wrap:anywhere}
.route-detail-body{padding:24px 28px 30px}.route-detail-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:18px 16px;border:1px solid #e8e3ef;border-radius:15px;background:linear-gradient(110deg,#f6f1fb,#f1f7f5)}.route-detail-metrics>div{display:grid;gap:8px}.route-detail-metrics span{font-size:15px;color:#8b7d98}.route-detail-metrics strong{font:600 23px/1.3 Arial;color:#6c548c}.route-detail-metrics small{font-size:15px;font-weight:400}
.route-detail-intro{font-size:18px;line-height:1.85;color:#666578;margin:23px 0 15px}.route-detail-highlights{display:flex;flex-wrap:wrap;gap:9px}.route-detail-highlights>span{display:flex;align-items:center;gap:6px;background:#f6f2fb;padding:6px 10px;border-radius:8px;color:#8a6bab;font-size:15px;line-height:1.5}
.route-detail-audience{display:flex;gap:12px;margin-top:20px;padding:16px;background:#f6f8f8;border-radius:13px}.route-detail-audience>.el-icon{margin-top:3px;color:#769e91;font-size:23px}.route-detail-audience strong{font-size:16px;font-weight:500;color:#567567}.route-detail-audience p{margin:6px 0 0;font-size:17px;line-height:1.65;color:#707b76}
.route-detail-body h3{margin:0 0 18px;font-size:21px;font-weight:600;color:#44364f}.route-stations{margin-top:30px}.route-stations h3{display:flex;align-items:center;justify-content:space-between}.route-stations h3>span{font-size:16px;color:#a28dad;font-weight:400}.route-stations ol{list-style:none;padding:0;margin:0}.route-stations li{position:relative;display:flex;gap:15px}.route-stations li:not(:last-child):before{content:'';position:absolute;top:30px;bottom:0;left:14px;width:1px;background:#e3d9ee}.route-station-number{position:relative;z-index:1;display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;border:1px solid #d9c9ea;border-radius:10px;background:#f7f2fc;color:#916eb4;font:600 16px Arial}.route-station-content{flex:1;min-width:0;padding-bottom:21px}.route-station-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}.route-station-heading h4{margin:0;font-size:20px;line-height:1.5;font-weight:600}.route-station-heading>span{display:flex;align-items:center;gap:5px;white-space:nowrap;font-size:15px;color:#a08fa8}.route-station-content>p{font-size:17px;line-height:1.8;color:#707080;margin:8px 0 12px}.route-next-leg{display:flex;align-items:center;flex-wrap:wrap;gap:7px;font-size:15px;color:#8d94a2;padding:9px 0}.route-next-leg>.el-icon{color:#9f8eb3}.route-leg-steps{padding:2px 7px;border-radius:5px;color:#a48961;background:#faf2e6}
.route-time-breakdown{margin-top:8px;padding:20px;border:1px solid #e9e4ee;border-radius:14px}.route-time-breakdown>div{display:flex;justify-content:space-between;gap:14px;font-size:17px;color:#8a7e95;padding:7px 0}.route-time-breakdown strong{font-weight:500;color:#746183}.route-detail-tips{margin-top:26px}.route-detail-tips>p{font-size:17px;line-height:1.85;color:#777282;margin:0}.route-estimate-note{font-size:15px;line-height:1.75;color:#a094a6;margin:24px 0 0}
.route-detail-footer{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 26px calc(18px + env(safe-area-inset-bottom));border-top:1px solid #ebe5f0;background:#fff;box-shadow:0 -8px 24px #44325c05}.route-detail-footer>span{display:flex;align-items:center;gap:7px;color:#8a789b;font-size:17px}.route-detail-footer>button{display:flex;align-items:center;justify-content:center;gap:10px;padding:13px 22px;min-height:50px;border:0;border-radius:12px;color:#fff;background:linear-gradient(110deg,#997ac5,#7f5daf);font:inherit;font-size:18px;cursor:pointer}.route-detail-footer>button:disabled{opacity:.45;cursor:default}.route-detail-close:focus-visible,.route-detail-footer>button:focus-visible{outline:3px solid #b299cf;outline-offset:-3px}
@media(max-width:520px){:global(.recommended-route-drawer){border-radius:0}.route-detail-body{padding:20px}.route-detail-heading{padding-left:22px;padding-right:22px}.route-detail-heading h2{font-size:25px}.route-detail-metrics{gap:8px;padding:15px 12px}.route-detail-metrics strong{font-size:20px}.route-detail-footer{padding:15px 18px calc(15px + env(safe-area-inset-bottom))}.route-detail-footer>span{font-size:15px}.route-detail-footer>button{font-size:17px;padding:12px 15px}.route-station-heading h4{font-size:19px}}
</style>
