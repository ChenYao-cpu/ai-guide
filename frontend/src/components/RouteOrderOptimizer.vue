<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowRight, Check, Close, Compass } from '@element-plus/icons-vue'
import { t } from '@/i18n'
import { optimizeRouteOrder, type RouteOrderProposal } from '@/api/tourExperience'
import RouteOverview from './RouteOverview.vue'

const props=defineProps<{spots:Array<{spot_id:number;spot_name:string}>;pace:string}>()
const emit=defineEmits<{close:[];apply:[ids:number[]]}>()
const fixedStart=ref(true),fixedEnd=ref(false),busy=ref(false),error=ref('')
const proposal=ref<RouteOrderProposal|null>(null),accepted=ref('')
const signature=computed(()=>JSON.stringify([props.spots.map(s=>s.spot_id),props.pace,fixedStart.value,fixedEnd.value]))
const originalOrder=computed(()=>new Map(props.spots.map((s,i)=>[s.spot_id,i+1])))
const ready=computed(()=>!!proposal.value&&!busy.value&&accepted.value===signature.value)
let controller:AbortController|undefined,version=0,disposed=false
const distance=(m:number|null)=>m==null?'—':m>=1000?(m/1000).toFixed(2)+' km':m+' m'
watch(signature,()=>{version++;controller?.abort();busy.value=false;proposal.value=null;error.value=''}, {flush:'sync'})
async function generate(){
  if(busy.value)return
  if(props.spots.length<2||props.spots.length>20){error.value=t('请选择2至20个景点再优化顺序');return}
  const ids=props.spots.map(s=>s.spot_id),requestSignature=signature.value,own=++version
  error.value='';busy.value=true;proposal.value=null;controller=new AbortController()
  try{
    const response=await optimizeRouteOrder(ids,{fixed_start:fixedStart.value,fixed_end:fixedEnd.value,pace:props.pace==='relaxed'?'relaxed':'standard'},controller.signal)
    if(disposed||own!==version)return
    const result=response.data.data
    if(!response.data.success||!result||JSON.stringify(result.input_spot_ids)!==JSON.stringify(ids)||
      result.spot_ids.length!==ids.length||new Set(result.spot_ids).size!==ids.length||
      result.spot_ids.some(id=>!ids.includes(id))||!result.proposed_route.complete||
      fixedStart.value&&result.spot_ids[0]!==ids[0]||fixedEnd.value&&result.spot_ids[ids.length-1]!==ids[ids.length-1]||
      result.proposed_route.walking_meters==null||result.original_route.walking_meters==null||
      result.proposed_route.total_minutes==null||result.original_route.total_minutes==null||
      result.proposed_route.walking_meters>result.original_route.walking_meters||
      result.proposed_route.total_minutes>result.original_route.total_minutes)throw new Error()
    proposal.value=result;accepted.value=requestSignature
  }catch(e:any){if(!disposed&&own===version&&e.code!=='ERR_CANCELED'){const detail=e.response?.data?.detail;error.value=t(typeof detail==='string'?detail:'路线顺序优化失败，请重试')}}
  finally{if(!disposed&&own===version)busy.value=false}
}
function apply(){if(!ready.value||!proposal.value)return;if(proposal.value.unchanged){emit('close');return}emit('apply',[...proposal.value.spot_ids])}
onMounted(generate)
onBeforeUnmount(()=>{disposed=true;version++;controller?.abort()})
</script>

<template>
  <el-dialog :model-value="true" :title="t('优化游览顺序')" :show-close="false" width="min(1120px,96vw)" class="route-order-dialog" @close="emit('close')">
    <template #header="{titleId}"><div class="order-dialog-heading"><h2 :id="titleId" class="el-dialog__title">{{ t('优化游览顺序') }}</h2><button type="button" :aria-label="t('关闭路线详情')" @click="emit('close')"><el-icon><Close /></el-icon></button></div></template>
    <div class="order-optimizer-intro"><span><el-icon><Check /></el-icon>{{ t('保留全部 {p0} 个景点，仅调整顺序',{p0:spots.length}) }}</span><p>{{ t('沿园内步道减少绕路，应用前可对比路线与时间。') }}</p></div>
    <div class="order-optimizer-controls">
      <label><input v-model="fixedStart" type="checkbox" /><span>{{ t('固定首站') }}<strong>{{ t(spots[0]?.spot_name||'') }}</strong></span></label>
      <label><input v-model="fixedEnd" type="checkbox" /><span>{{ t('固定末站') }}<strong>{{ t(spots[spots.length-1]?.spot_name||'') }}</strong></span></label>
      <button type="button" class="order-generate" :disabled="busy" @click="generate"><el-icon><Compass /></el-icon>{{ t(busy?'正在优化顺序…':'重新计算顺序') }}</button>
    </div>
    <p v-if="error" class="order-error" role="alert">{{ error }}</p>
    <div v-if="busy" class="order-optimizer-empty" role="status">{{ t('正在比较步行路径，请稍候…') }}</div>
    <div v-else-if="proposal" class="order-optimizer-workspace">
      <section class="order-optimizer-map"><h3>{{ t('步行路线对比') }}</h3><RouteOverview :overview="proposal.proposed_route" :compare="proposal.original_route" compact map-only /></section>
      <section class="order-optimizer-result" aria-live="polite">
        <div class="order-saving"><span>{{ t(proposal.unchanged?'当前顺序可继续使用':'减少步行与回头路') }}</span><strong v-if="!proposal.unchanged"><small>{{ t('少走') }}</small> {{ distance(proposal.saved_meters) }}<span> · </span><small>{{ t('节省') }}</small> {{ proposal.saved_minutes }} <small>{{ t('分钟') }}</small></strong><p v-else>{{ t(proposal.optimal?'在所选首末站条件下，当前顺序已是最短步行方案。':'当前条件下暂无更省路且不增加用时的方案。') }}</p></div>
        <div class="order-comparison"><div class="order-comparison-labels"><span></span><span>{{ t('调整前') }}</span><span>{{ t('调整后') }}</span></div><div><span>{{ t('步行距离') }}</span><b>{{ distance(proposal.original_route.walking_meters) }}</b><strong>{{ distance(proposal.proposed_route.walking_meters) }}</strong></div><div><span>{{ t('步行时间') }}</span><b>{{ proposal.original_route.walking_minutes }} {{ t('分钟') }}</b><strong>{{ proposal.proposed_route.walking_minutes }} {{ t('分钟') }}</strong></div><div><span>{{ t('总用时') }}</span><b>{{ proposal.original_route.total_minutes }} {{ t('分钟') }}</b><strong>{{ proposal.proposed_route.total_minutes }} {{ t('分钟') }}</strong></div></div>
        <h3 class="order-stops-heading">{{ t('优化后顺序') }}<small>{{ spots.length }} {{ t('站') }}</small></h3>
        <ol class="order-proposed-stops"><li v-for="(stop,index) in proposal.proposed_route.stops" :key="stop.spot_id"><i>{{ index+1 }}</i><strong>{{ t(stop.spot_name) }}</strong><small v-if="originalOrder.get(stop.spot_id)!==index+1">{{ t('原第 {p0} 站',{p0:originalOrder.get(stop.spot_id)}) }}</small></li></ol>
        <p class="order-total-note">{{ t('停留与休息计入总用时；首末站未选择园门时，不计进出园步行。') }}</p>
      </section>
    </div>
    <p v-else-if="!busy&&!error" class="order-optimizer-empty">{{ t('条件已修改，请重新计算顺序。') }}</p>
    <template #footer><div class="order-optimizer-footer"><span>{{ t('确认应用后才会改变我的行程。') }}</span><button type="button" class="order-cancel" @click="emit('close')">{{ t('取消') }}</button><button type="button" class="order-apply" :disabled="!ready" @click="apply">{{ t(proposal?.unchanged?'保留当前顺序':'采用此顺序') }}<el-icon><ArrowRight /></el-icon></button></div></template>
  </el-dialog>
</template>

<style scoped>
:global(.route-order-dialog.el-dialog){display:flex;flex-direction:column;margin:3dvh auto!important;max-height:94dvh;border-radius:24px;background:#fff;overflow:hidden}
:global(.route-order-dialog .el-dialog__header){margin:0;padding:24px 26px 16px}:global(.route-order-dialog .el-dialog__title){font-size:25px;color:#40354e}:global(.route-order-dialog .el-dialog__body){padding:0 26px 20px;overflow:auto;overscroll-behavior:contain;min-height:0}:global(.route-order-dialog .el-dialog__footer){padding:16px 26px;border-top:1px solid #ece6f2}
.order-dialog-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.order-dialog-heading h2{margin:0;line-height:1.4;font-weight:500}.order-dialog-heading>button{display:grid;place-items:center;flex-shrink:0;width:36px;height:36px;border:1px solid #e7ddf0;border-radius:10px;background:#f8f4fc;color:#8a74a0;font-size:21px;cursor:pointer}
.order-optimizer-intro>span{display:flex;align-items:center;gap:7px;color:#608472;font-size:17px}.order-optimizer-intro>p{font-size:16px;color:#8a7d94;margin:8px 0 18px;line-height:1.6}
.order-optimizer-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:20px;padding:14px;background:#f7f4fa;border:1px solid #e8e0f0;border-radius:14px}.order-optimizer-controls label{display:flex;align-items:center;gap:9px;padding:2px 8px;font-size:15px;color:#887695;min-width:0}.order-optimizer-controls input{width:17px;height:17px;accent-color:#8e6cba;flex-shrink:0}.order-optimizer-controls label>span{display:grid;gap:5px}.order-optimizer-controls strong{font-size:17px;color:#685079;font-weight:500;overflow-wrap:anywhere}
.order-generate,.order-apply,.order-cancel{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #8762b4;border-radius:11px;background:#8966b6;color:white;padding:11px 16px;min-height:44px;font:inherit;font-size:17px;cursor:pointer}.order-generate{margin-left:auto}.order-apply:disabled,.order-generate:disabled{opacity:.5;cursor:default}.order-cancel{color:#877194;background:#f8f5fb;border-color:#e5dced}
.order-optimizer-workspace{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,1fr);gap:22px;align-items:start}.order-optimizer-map>h3{font-size:19px;color:#534063;margin:0 0 12px}.order-optimizer-map :deep(.route-overview-map){height:clamp(240px,calc(94dvh - 410px),390px)!important}.order-optimizer-map :deep(.route-data-source){font-size:14px}
.order-saving{padding:16px;border-radius:13px;background:linear-gradient(110deg,#f1edf8,#edf6f1);color:#638374}.order-saving>span{font-size:17px}.order-saving>strong{display:block;margin-top:9px;font:600 23px/1.7 Arial;color:#70538f}.order-saving small{font:400 15px var(--app-font-family);color:#857293}.order-saving p{font-size:17px;line-height:1.7;margin:8px 0 0}
.order-comparison{margin:16px 0}.order-comparison>div{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #eee8f3;font-size:16px;color:#8a7b96}.order-comparison b{font-weight:400;color:#9a8ca5;font-family:Arial}.order-comparison strong{font-weight:500;color:#775a96;font-family:Arial}.order-comparison-labels{font-size:14px!important;padding-top:0!important}.order-stops-heading{display:flex;justify-content:space-between;align-items:center;font-size:19px;margin:20px 0 10px;color:#5d486e}.order-stops-heading small{font-size:15px;font-weight:400;color:#9a8ba6}.order-proposed-stops{list-style:none;margin:0;padding:0;max-height:200px;overflow:auto;scrollbar-width:thin;scrollbar-color:#d7c8e7 transparent}.order-proposed-stops li{display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #f0eaf5}.order-proposed-stops i{display:grid;place-items:center;flex-shrink:0;width:25px;height:25px;border:1px solid #e2d5ee;border-radius:50%;font:500 14px Arial;color:#8965b2;background:#faf7fd}.order-proposed-stops strong{font-size:17px;font-weight:500;color:#6d5c7b}.order-proposed-stops small{margin-left:auto;white-space:nowrap;font-size:14px;color:#a28caf}.order-total-note{font-size:14px;color:#9a8aa5;line-height:1.7;margin:14px 0 0}
.order-optimizer-footer{display:flex;align-items:center;gap:12px}.order-optimizer-footer>span{margin-right:auto;color:#9987a5;font-size:15px;text-align:left;line-height:1.6}.order-optimizer-empty{display:grid;place-items:center;min-height:240px;text-align:center;color:#9481a2;font-size:18px}.order-error{color:#af4f67;font-size:17px;line-height:1.6}button:focus-visible{outline:3px solid #b89ed0;outline-offset:2px}
@media(max-width:800px){.order-optimizer-workspace{grid-template-columns:minmax(0,1fr)}.order-optimizer-map :deep(.route-overview-map){height:250px!important}.order-proposed-stops{max-height:230px}.order-optimizer-footer{flex-wrap:wrap}.order-optimizer-footer>span{flex-basis:100%}.order-generate{margin-left:0}.order-optimizer-controls{align-items:stretch}.order-optimizer-controls label{flex:1;min-width:130px}:global(.route-order-dialog .el-dialog__body){padding:0 18px 18px}:global(.route-order-dialog .el-dialog__header),:global(.route-order-dialog .el-dialog__footer){padding:18px}}
</style>
