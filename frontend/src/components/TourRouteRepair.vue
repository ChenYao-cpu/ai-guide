<template>
  <el-dialog :model-value="true" :title="$t('调整剩余行程')" :width="proposal ? 'min(960px, 94vw)' : 'min(560px, 94vw)'" class="repair-dialog" @close="emit('close')">
    <form class="repair-form" @submit.prevent="preview">
      <p class="repair-context">{{ $t('当前位置') }} · {{ $t(currentName) }}<span>{{ $t('已游览的景点保持不变') }}</span></p>
      <label class="repair-message">{{ $t('告诉我想怎么调整') }}<input v-model="message" :placeholder="$t('例如：孩子累了，只剩四十分钟，从东门离园')" maxlength="2000" /></label>
      <div class="repair-fields">
        <label>{{ $t('剩余时间（分钟）') }}<input v-model.number="minutes" type="number" min="1" max="480" /></label>
        <label>{{ $t('行走节奏') }}<select v-model="pace"><option value="standard">{{ $t('正常游览') }}</option><option value="relaxed">{{ $t('轻松少台阶') }}</option></select></label>
        <label>{{ $t('离园方向') }}<select v-model="exit"><option value="auto">{{ $t('暂不计算离园') }}</option><option value="east">{{ $t('东侧 · 仁寿殿附近') }}</option><option value="north">{{ $t('北侧 · 苏州街附近') }}</option><option value="south">{{ $t('南侧 · 铜牛附近') }}</option></select></label>
      </div>
      <details class="repair-extra"><summary>{{ $t('跳过景点与时间预留') }}</summary><div class="repair-skips"><label v-for="spot in remainingSpots" :key="spot.spot_id"><input v-model="excluded" type="checkbox" :value="spot.spot_id" />{{ $t(spot.spot_name) }}</label></div><label>{{ $t('额外预留（分钟）') }}<input v-model.number="reserve" type="number" min="0" max="120" /></label></details>
      <button class="repair-preview-button" type="submit" :disabled="busy || applying">{{ $t(busy ? '正在计算…' : '生成调整方案') }}</button>
    </form>
    <p v-if="error" role="alert" class="repair-error">{{ error }}</p>
    <section v-if="proposal" class="repair-result" aria-live="polite">
      <h3>{{ $t(!proposal.feasible ? '时间不足以完成当前离园方案' : proposal.exit_only ? '建议结束景点游览' : '调整方案待确认') }}</h3>
      <div class="repair-metrics"><div><span>{{ $t('原剩余行程') }}</span><strong>{{ proposal.original_totals.total_minutes }} <small>{{ $t('分钟') }}</small></strong></div><div><span>{{ $t('调整后预计') }}</span><strong>{{ proposal.totals.total_minutes }} <small>{{ $t('分钟') }}</small></strong></div><div><span>{{ $t('步行含离园') }}</span><strong>{{ (proposal.totals.walking_meters / 1000).toFixed(1) }} <small>km</small></strong></div></div>
      <ol class="repair-stops"><li>{{ $t(proposal.current_spot) }} <small>{{ $t('当前站') }}</small></li><li v-for="spot in proposal.next_spots" :key="spot.spot_id">{{ $t(spot.spot_name) }}</li><li v-if="proposal.end_anchor">{{ $t(proposal.end_anchor) }}{{ $t('附近离园') }}</li></ol>
      <div v-if="proposal.removed.length" class="repair-removed"><p>{{ $t('本次暂不前往') }}</p><span v-for="spot in proposal.removed" :key="spot.spot_id">{{ $t(spot.spot_name) }} · {{ $t(reason(spot.reason)) }}</span></div>
      <details class="repair-basis"><summary>{{ $t('查看时间组成与依据') }}</summary><p>{{ $t('停留') }} {{ proposal.totals.visit_minutes }} + {{ $t('步行') }} {{ proposal.totals.walk_minutes }} + {{ $t('休息') }} {{ proposal.totals.rest_minutes }} + {{ $t('离园') }} {{ proposal.totals.exit_minutes }} + {{ $t('预留') }} {{ proposal.totals.reserve_minutes }} = {{ proposal.totals.total_minutes }} {{ $t('分钟') }}</p><p>{{ $t('从离开当前站起估算，使用园内步行路网快照。出口按附近景点加5分钟估算；不含实时排队，不保证轮椅通行。') }}</p></details>
      <p v-if="!proposal.end_anchor" class="repair-note">{{ $t('未计离园时间；需要按时出园时，请选择离园方向。') }}</p>
      <p v-if="dirty" class="repair-note">{{ $t('条件已修改，请重新生成方案') }}</p>
      <button class="repair-apply" type="button" :disabled="!proposal.feasible || dirty || busy || applying" @click="apply">{{ $t(applying ? '正在更新…' : '确认调整路线') }}</button>
    </section>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { t } from '@/i18n'
import { previewTourRepair, applyTourRepair, type RouteRepair } from '@/api/visitor'
const props = defineProps<{sessionId:number; currentName:string; remainingSpots:Array<{spot_id:number;spot_name:string}>; prompt?:string; initialMinutes?:number; initialPace?:'standard'|'relaxed'; initialExit?:'auto'|'east'|'north'|'south'}>()
const emit = defineEmits<{close:[]; applied:[]}>()
const message=ref(props.prompt || ''), minutes=ref<number|undefined>(props.initialMinutes), pace=ref(props.initialPace || 'standard'), exit=ref(props.initialExit || 'auto')
const excluded=ref<number[]>([]), reserve=ref(0), proposal=ref<RouteRepair|null>(null)
const busy=ref(false), applying=ref(false), error=ref(''), acceptedSignature=ref('')
const signature=computed(()=>JSON.stringify([message.value,minutes.value,pace.value,exit.value,excluded.value,reserve.value]))
const dirty=computed(()=>signature.value!==acceptedSignature.value)
let controller:AbortController|undefined, disposed=false, version=0
const reason=(key:string)=>({visitor:'按你的要求',stairs:'避开较多台阶',budget:'保留时间更合适的景点'}[key] || key)
watch(signature,()=>{version++;controller?.abort();busy.value=false})
async function preview() {
  if (busy.value || applying.value) return
  const hasTime=/\d|[一二两三四五六七八九十半].*(?:分钟|小时)|half an? hour/i.test(message.value)
  if (!minutes.value && !hasTime) {error.value=t('请填写剩余时间，再生成方案');return}
  error.value='';busy.value=true;proposal.value=null
  controller=new AbortController(); const own=++version
  try {
    const response=await previewTourRepair(props.sessionId,{message:message.value,remaining_minutes:minutes.value,pace:pace.value,end_area:exit.value,excluded_spot_ids:excluded.value,reserve_minutes:reserve.value},controller.signal)
    if(disposed || own!==version)return
    const result=response.data.data
    // Reflect extracted spoken constraints in the form so the visitor can
    // inspect the exact values before committing. Clear the consumed sentence.
    message.value='';minutes.value=result.options.remaining_minutes;pace.value=result.options.pace;exit.value=result.options.end_area;excluded.value=result.options.excluded_spot_ids
    proposal.value=result
    acceptedSignature.value=JSON.stringify(['',minutes.value,pace.value,exit.value,excluded.value,reserve.value])
  } catch(e:any) {
    if(!disposed && own===version && e.code!=='ERR_CANCELED') error.value=t(e.response?.data?.detail || '调整方案生成失败，请重试')
  } finally {if(!disposed)busy.value=false}
}
async function apply(){
  if(!proposal.value || dirty.value || applying.value || !proposal.value.feasible)return
  applying.value=true;error.value=''
  try {await applyTourRepair(props.sessionId,proposal.value.proposal_token);if(!disposed)emit('applied')}
  catch(e:any){if(!disposed)error.value=t(e.response?.data?.detail || '路线更新失败，请重试')}
  finally{applying.value=false}
}
onMounted(()=>{if(props.prompt && /\d|[一二两三四五六七八九十半].*(?:分钟|小时)|half an? hour/i.test(props.prompt))preview()})
onUnmounted(()=>{disposed=true;controller?.abort()})
</script>

<style scoped>
.repair-form{display:grid;gap:16px}.repair-context{display:flex;justify-content:space-between;gap:10px;margin:0;color:#302851;font-size:16px}.repair-context span{color:#768096;font-size:14px}.repair-form label{display:grid;gap:8px;font-size:14px;color:#4f5870}.repair-form input:not([type=checkbox]),.repair-form select{box-sizing:border-box;min-width:0;width:100%;border:1px solid #deddec;border-radius:12px;padding:10px 12px;font:inherit;background:#f8f9fc;color:#283247}.repair-fields{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:12px}.repair-extra,.repair-basis{font-size:14px;color:#6b7280;line-height:1.65}.repair-extra summary,.repair-basis summary{cursor:pointer}.repair-skips{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}.repair-skips label{display:flex;align-items:center}.repair-extra>label{max-width:180px}.repair-preview-button,.repair-apply{border:0;border-radius:12px;padding:12px 18px;font:inherit;font-size:15px;cursor:pointer;background:#eeebfa;color:#5845a1}.repair-apply{background:#6652bd;color:white;width:100%;margin-top:14px}.repair-apply:disabled,.repair-preview-button:disabled{opacity:.5;cursor:default}.repair-error{color:#b42342;font-size:15px}.repair-result{margin-top:20px;border-top:1px solid #e9e5f3;padding-top:18px}.repair-result h3{font-size:18px;margin:0 0 14px;color:#302851}.repair-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.repair-metrics>div{background:#f6f4fc;border-radius:14px;padding:12px}.repair-metrics span{display:block;font-size:13px;color:#687186}.repair-metrics strong{display:block;font-size:24px;color:#4e4294;margin-top:6px}.repair-metrics small{font-size:13px;font-weight:normal}.repair-stops{padding:0;display:flex;gap:8px;flex-wrap:wrap;list-style:none;margin:16px 0}.repair-stops li{font-size:15px;background:#f3f6f9;border-radius:9px;padding:8px 10px}.repair-stops li+li:before{content:'→';margin-right:8px;color:#9b90bb}.repair-stops small{color:#827796}.repair-removed{font-size:14px;color:#687186}.repair-removed p{margin-bottom:8px}.repair-removed span{display:inline-block;margin:0 12px 8px 0}.repair-note{font-size:14px;line-height:1.6;color:#927232}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid #7460c5;outline-offset:3px}@media(max-width:600px){.repair-fields{grid-template-columns:1fr}.repair-context{flex-direction:column}.repair-metrics strong{font-size:20px}}
</style>

<style>
.repair-dialog.el-dialog{margin:5dvh auto!important;max-height:90dvh;display:flex;flex-direction:column}
.repair-dialog .el-dialog__header{flex-shrink:0}
.repair-dialog .el-dialog__body{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;gap:24px;min-height:0;overflow:auto}
.repair-dialog .el-dialog__body:has(.repair-result){grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.repair-dialog .repair-form{grid-column:1;grid-row:1}
.repair-dialog .repair-result{grid-column:2;grid-row:1;margin-top:0;padding:0 0 0 22px;border-top:0;border-left:1px solid #e9e5f3}
.repair-dialog .repair-error{grid-column:1/-1;margin:0}
.repair-dialog .repair-context{flex-direction:column;gap:5px}
.repair-dialog .repair-fields{grid-template-columns:1fr 1fr}
.repair-dialog .repair-fields>label:last-child{grid-column:1/-1}
.repair-dialog .repair-metrics{gap:7px}.repair-dialog .repair-metrics>div{padding:10px 8px}
.repair-dialog .repair-metrics strong{font-size:23px}
@media(max-width:767px){.repair-dialog.el-dialog{margin:3dvh auto!important;max-height:94dvh}.repair-dialog .el-dialog__body,.repair-dialog .el-dialog__body:has(.repair-result){grid-template-columns:minmax(0,1fr);gap:16px}.repair-dialog .repair-form,.repair-dialog .repair-result{grid-column:1;grid-row:auto}.repair-dialog .repair-result{padding:16px 0 0;border:0;border-top:1px solid #e9e5f3}}
</style>
