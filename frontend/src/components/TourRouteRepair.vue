<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { t } from '@/i18n'
import { previewTourRepair, applyTourRepair, type RouteRepair, type RouteRepairOptions } from '@/api/visitor'
import RouteOverview from './RouteOverview.vue'
const props=defineProps<{sessionId:number;currentName:string;remainingSpots:Array<{spot_id:number;spot_name:string}>;prompt?:string;initialMinutes?:number;initialPace?:'standard'|'relaxed';initialExit?:'auto'|'east'|'north'|'south';initialAvoidSteps?:boolean;initialRequired?:number[]}>()
const emit=defineEmits<{close:[];applied:[]}>()
type Goal='time'|'less_walking'|'skip'|'exit'
const scenario=ref<Goal>('time'), message=ref(props.prompt||''), minutes=ref<number|string>(props.initialMinutes??'')
const pace=ref(props.initialPace||'standard'), exit=ref(props.initialExit||'auto'), reserve=ref(0)
const avoidSteps=ref(!!props.initialAvoidSteps), reorder=ref(true), choices=reactive<Record<number,string>>(Object.fromEntries((props.initialRequired||[]).map(id=>[id,'required'])))
const editing=ref(true)
const busy=ref(false), applying=ref(false), error=ref(''), plans=ref<RouteRepair[]>([]), selected=ref(0), accepted=ref('')
const clock=ref(Date.now()), proposal=computed(()=>plans.value[selected.value]||null)
const signature=computed(()=>JSON.stringify([props.sessionId,props.remainingSpots.map(s=>s.spot_id),scenario.value,message.value,minutes.value,pace.value,exit.value,reserve.value,avoidSteps.value,reorder.value,choices]))
const dirty=computed(()=>!!plans.value.length&&signature.value!==accepted.value)
const expired=computed(()=>!!proposal.value?.expires_at && clock.value>=proposal.value.expires_at*1000)
const modes:Array<{key:Goal;label:string}>=[{key:'time',label:'时间不够'},{key:'less_walking',label:'想少走路'},{key:'skip',label:'跳过下一站'},{key:'exit',label:'准备离园'}]
let controller:AbortController|undefined,version=0,disposed=false,hydrating=false
const timer=setInterval(()=>{clock.value=Date.now()},1000)
watch(signature,()=>{if(hydrating)return;version++;controller?.abort();busy.value=false},{flush:'sync'})
const distance=(n:number|null|undefined)=>n==null?'—':n>=1000?(n/1000).toFixed(2)+' km':n+' m'
const failure=computed(()=>t(proposal.value?.failure_code==='no_path'?'当前条件下没有连通的步行路线，请调整景点或通行条件。':proposal.value?.failure_code==='required_budget'?'时间不足以保留全部必游景点，请增加时间或减少必游景点。':'剩余时间不足以完成此方案，请增加时间或调整条件。'))
function changeGoal(goal:Goal){editing.value=true;scenario.value=goal
 if(goal==='skip'&&props.remainingSpots[0])choices[props.remainingSpots[0].spot_id]='skip'
 if(goal==='exit')for(const key of Object.keys(choices))delete choices[Number(key)]
}
function reason(key:string){return t(({visitor:'按你的要求',stairs:'避开已标注台阶',budget:'为其他景点与离园保留时间',less_walking:'减少步行与回头路',exit:'按你的要求直接离园',routing:'当前通行条件下没有连通路径'} as Record<string,string>)[key]||key)}
const changeSummary=computed(()=>{
 const p=proposal.value;if(!p)return ''
 if(p.unchanged)return t('当前路线已满足条件，可以保留原路线。')
 if(p.exit_only)return t(p.end_anchor?'停止后续景点游览，沿步道前往所选出口。':'当前条件下没有可继续游览的景点，请选择离园出口或调整条件。')
 return t(p.strategy==='shortest'?'优先减少步行，兼顾原行程中的重点景点。':'在可用时间内优先保留兴趣匹配和必游景点。')
})
function delta(a:number|null|undefined,b:number|null|undefined,unit:string){if(a==null||b==null)return '—';const v=a-b;return (v>0?'+':'')+v+' '+t(unit)}
async function preview(){
 if(busy.value||applying.value)return
 const time=minutes.value===''?null:Number(minutes.value)
 if(time!==null&&(!Number.isInteger(time)||time<1||time>480)){error.value=t('剩余时间须为1至480分钟');return}
 const hasTime=/\d|[一二两三四五六七八九十半].*(?:分钟|小时)|half an? hour/i.test(message.value)
 if(scenario.value==='time'&&!time&&!hasTime){error.value=t('请填写剩余时间，再生成方案');return}
 if(scenario.value==='exit'&&exit.value==='auto'&&!/东门|东宫门|北门|北宫门|南门|新建宫门|east|north|south/i.test(message.value)){error.value=t('请选择具体离园出口');return}
 error.value='';busy.value=true;controller=new AbortController();const own=++version
 const options:RouteRepairOptions={message:message.value,remaining_minutes:time,pace:pace.value,end_area:exit.value,reserve_minutes:Number(reserve.value)||0,
  excluded_spot_ids:props.remainingSpots.filter(s=>choices[s.spot_id]==='skip').map(s=>s.spot_id),
  required_spot_ids:props.remainingSpots.filter(s=>choices[s.spot_id]==='required').map(s=>s.spot_id),
  scenario:scenario.value,strategy:scenario.value==='less_walking'?'shortest':'highlights',avoid_steps:avoidSteps.value,allow_reorder:reorder.value}
 try{const response=await previewTourRepair(props.sessionId,options,controller.signal)
  if(disposed||own!==version)return
  if(!response.data.success)throw new Error('Failed')
  const result=response.data.data,o=result.options
  hydrating=true
  message.value='';minutes.value=o.remaining_minutes??'';pace.value=o.pace;exit.value=o.end_area
  avoidSteps.value=!!o.avoid_steps;scenario.value=o.scenario||scenario.value
  for(const key of Object.keys(choices))delete choices[Number(key)]
  for(const id of o.excluded_spot_ids)choices[id]='skip'
  for(const id of o.required_spot_ids||[])choices[id]='required'
  hydrating=false
  plans.value=[result,...(result.alternatives||[])];selected.value=0;accepted.value=signature.value;editing.value=false
 }catch(e:any){hydrating=false;if(!disposed&&own===version&&e.code!=='ERR_CANCELED')error.value=t(e.response?.data?.detail||'调整方案生成失败，请重试')}
 finally{if(!disposed&&own===version)busy.value=false}
}
async function apply(){
 const p=proposal.value;if(!p||!p.feasible||dirty.value||expired.value||busy.value||applying.value)return
 if(p.unchanged){emit('close');return}
 error.value='';applying.value=true
 try{await applyTourRepair(props.sessionId,p.proposal_token);if(!disposed)emit('applied')}
 catch(e:any){if(!disposed)error.value=t(e.response?.data?.detail||'路线更新失败，请重试')}
 finally{if(!disposed)applying.value=false}
}
onMounted(()=>{if(!props.prompt)return
 const timed=/\d|[一二两三四五六七八九十半].*(?:分钟|小时)|half an? hour/i.test(props.prompt)
 if(!timed){if(/跳过|不去|skip/i.test(props.prompt))scenario.value='skip';else if(/累了|少走|tired|less walking/i.test(props.prompt))scenario.value='less_walking';else if(/离园|leave|exit/i.test(props.prompt))scenario.value='exit'}
 if(timed||scenario.value==='skip'||scenario.value==='less_walking'||scenario.value==='exit'&&/东门|东宫门|北门|北宫门|南门|新建宫门|east|north|south/i.test(props.prompt))void preview()
})
onUnmounted(()=>{disposed=true;controller?.abort();clearInterval(timer)})
</script>
<template>
 <el-dialog :model-value="true" :title="$t('调整剩余行程')" width="min(1160px, 95vw)" class="route-adjust-dialog" :close-on-click-modal="!applying" :close-on-press-escape="!applying" :show-close="!applying" @close="emit('close')">
  <div class="repair-context"><span>{{ $t('当前站') }} · <strong>{{ $t(currentName) }}</strong></span><span>{{ $t('已游览的景点保持不变') }}</span></div>
  <form class="repair-form" @submit.prevent="preview"><fieldset :disabled="applying">
   <div class="repair-goals" role="group" :aria-label="$t('调整目标')"><button v-for="mode in modes" :key="mode.key" type="button" :aria-pressed="scenario===mode.key" @click="changeGoal(mode.key)">{{ $t(mode.label) }}</button></div>
   <button v-if="proposal&&!editing" class="repair-edit" type="button" @click="editing=true">{{ $t('修改调整条件') }} · {{ $t(exit==='east'?'东宫门':exit==='north'?'北宫门':exit==='south'?'新建宫门':'未计离园时间') }}</button>
   <div v-if="editing" class="repair-fields"><label>{{ $t(scenario==='time'?'剩余时间（分钟）':'时间上限（选填）') }}<input v-model.number="minutes" type="number" min="1" max="480" :placeholder="$t('不限制时间')" /></label><label>{{ $t('离园出口') }}<select v-model="exit"><option value="auto">{{ $t(scenario==='exit'?'请选择出口':'末站结束，不计离园') }}</option><option value="east">{{ $t('东宫门') }}</option><option value="north">{{ $t('北宫门') }}</option><option value="south">{{ $t('新建宫门') }}</option></select></label><button class="repair-preview-button" type="submit" :disabled="busy||applying">{{ $t(busy?'正在沿步道计算…':'生成调整方案') }}</button></div>
   <details v-if="editing" class="repair-settings" :open="scenario==='skip'"><summary>{{ $t('保留景点与通行条件') }}</summary>
    <div v-if="scenario!=='exit'&&remainingSpots.length" class="repair-stop-options"><label v-for="spot in remainingSpots" :key="spot.spot_id"><span>{{ $t(spot.spot_name) }}</span><select v-model="choices[spot.spot_id]" :aria-label="$t('安排 {p0}',{p0:spot.spot_name})"><option :value="undefined">{{ $t('交给系统安排') }}</option><option value="required">{{ $t('必须保留') }}</option><option value="skip">{{ $t('跳过') }}</option></select></label></div>
    <div class="repair-preferences"><label>{{ $t('行走节奏') }}<select v-model="pace"><option value="standard">{{ $t('正常游览') }}</option><option value="relaxed">{{ $t('轻松慢走') }}</option></select></label><label>{{ $t('额外预留（分钟）') }}<input v-model.number="reserve" type="number" min="0" max="120" /></label><label class="repair-check"><input v-model="avoidSteps" type="checkbox" />{{ $t('避开已标注台阶') }}</label><label class="repair-check"><input v-model="reorder" type="checkbox" />{{ $t('允许优化未游览景点顺序') }}</label></div>
    <label class="repair-message">{{ $t('补充要求（选填）') }}<input v-model="message" :placeholder="$t('例如：还剩40分钟，想少走路，从东宫门离园')" maxlength="2000" /></label>
   </details>
  </fieldset></form>
  <p v-if="error" role="alert" class="repair-error">{{ error }}</p>
  <div v-if="proposal" class="repair-workspace">
   <section class="repair-map"><RouteOverview :overview="proposal.proposed_route" :compare="proposal.original_route" :current-id="proposal.current_spot_id" compact map-only /></section>
   <section class="repair-result" aria-live="polite"><div class="repair-result-content">
    <div class="repair-plan-choices" role="group" :aria-label="$t('选择调整方案')"><button v-for="(plan,index) in plans" :key="index" type="button" :aria-pressed="selected===index" @click="selected=index"><strong>{{ $t(plan.exit_only?(plan.end_anchor?'直接离园':'结束景点游览'):plan.strategy==='shortest'?'少走路方案':'保留重点方案') }}</strong><span>{{ distance(plan.totals.walking_meters) }} · {{ plan.totals.total_minutes??'—' }} {{ $t('分钟') }} · {{ plan.next_spots.length }} {{ $t('个景点') }}</span></button></div>
    <p class="repair-summary">{{ changeSummary }}</p>
    <p v-if="!proposal.feasible" class="repair-error" role="alert">{{ failure }}</p>
    <div class="repair-changes"><span>{{ $t('时间变化') }} <strong>{{ delta(proposal.totals.total_minutes,proposal.original_totals.total_minutes,'分钟') }}</strong></span><span>{{ $t('步行变化') }} <strong>{{ delta(proposal.totals.walking_meters,proposal.original_totals.walking_meters,'米') }}</strong></span></div>
    <ol class="repair-stops"><li><i></i><strong>{{ $t(currentName) }}</strong><span>{{ $t('当前站') }}</span></li><li v-for="spot in proposal.next_spots" :key="spot.spot_id"><i></i><strong>{{ $t(spot.spot_name) }}</strong><span v-if="proposal.options.required_spot_ids?.includes(spot.spot_id)">{{ $t('必游') }}</span></li><li v-if="proposal.end_anchor" class="repair-gate"><i></i><strong>{{ $t(proposal.end_anchor) }}</strong><span>{{ $t('离园') }}</span></li></ol>
    <p v-if="proposal.reordered" class="repair-note">{{ $t('已优化后续景点顺序，减少回头路。') }}</p>
    <details v-if="proposal.removed.length" class="repair-removed"><summary>{{ $t('本次不再前往') }} · {{ proposal.removed.length }}</summary><p v-for="spot in proposal.removed" :key="spot.spot_id"><strong>{{ $t(spot.spot_name) }}</strong> · {{ reason(spot.reason) }}</p></details>
    <details class="repair-basis"><summary>{{ $t('时间组成') }}</summary><p>{{ $t('停留') }} {{ proposal.totals.visit_minutes }} + {{ $t('步行') }} {{ proposal.totals.walk_minutes??'—' }} + {{ $t('休息') }} {{ proposal.totals.rest_minutes }} + {{ $t('离园') }} {{ proposal.totals.exit_minutes??'—' }} + {{ $t('预留') }} {{ proposal.totals.reserve_minutes }} {{ $t('分钟') }}</p></details>
    <p v-if="!proposal.end_anchor" class="repair-note">{{ $t('未计离园时间') }}</p>
    <p v-if="dirty||expired" role="status" class="repair-warning">{{ $t(dirty?'条件已修改，请重新生成方案':'方案已过期，请重新生成') }}</p>
    </div><button class="repair-apply" type="button" :disabled="!proposal.feasible||dirty||expired||busy||applying" @click="apply">{{ $t(applying?'正在更新…':proposal.unchanged?'保留当前路线':'采用此方案') }}</button>
   </section>
  </div>
  <p v-else class="repair-empty">{{ $t('选择调整目标，生成沿园内步道连接的行程。') }}</p>
 </el-dialog>
</template>
<style scoped>
:global(.route-adjust-dialog.el-dialog){margin:3dvh auto!important;max-height:94dvh;display:flex;flex-direction:column;border-radius:24px}
:global(.route-adjust-dialog .el-dialog__body){overflow:auto;min-height:0;padding-top:12px}
.repair-context{display:flex;justify-content:space-between;gap:12px;color:#566176;font-size:15px;margin-bottom:18px;line-height:1.6}.repair-context strong{color:#302b43;font-size:17px}
.repair-form fieldset{border:0;padding:0;margin:0;min-width:0}.repair-goals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:16px}
.repair-goals button{padding:12px 9px;border:1px solid #e4e2ee;border-radius:12px;background:#f7f8fc;color:#526078;font:inherit;font-size:16px;cursor:pointer}.repair-goals button[aria-pressed="true"]{background:#ede8fa;color:#5b43ae;border-color:#c7bbe8}
.repair-fields{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:end}.repair-form label{display:grid;gap:7px;color:#526078;font-size:15px}.repair-form input:not([type=checkbox]),.repair-form select{width:100%;min-width:0;box-sizing:border-box;border:1px solid #e0dfeb;border-radius:10px;background:#fafbfe;color:#303c51;padding:10px 12px;font:inherit;min-height:43px}
.repair-preview-button,.repair-apply{font:inherit;font-size:16px;min-height:44px;border:0;border-radius:11px;cursor:pointer;background:#6851b9;color:white;padding:11px 16px}.repair-preview-button:disabled,.repair-apply:disabled{opacity:.5;cursor:not-allowed}
.repair-settings{margin-top:15px;color:#647089;font-size:15px}.repair-settings summary,.repair-removed summary,.repair-basis summary{cursor:pointer;padding:4px 0;color:#67549d}
.repair-stop-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-height:210px;overflow:auto;padding:12px 0}.repair-stop-options label{background:#f7f7fc;border-radius:10px;padding:10px}.repair-stop-options label>span{overflow-wrap:anywhere}
.repair-preferences{display:flex;gap:15px;flex-wrap:wrap;align-items:end;margin:14px 0}.repair-preferences>label{min-width:130px;flex:1}.repair-preferences .repair-check{display:flex;align-items:center;align-self:center;min-width:210px}.repair-check input{width:18px;height:18px;accent-color:#6b52bc}.repair-message{margin-top:12px}
.repair-workspace{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:24px;margin-top:12px;padding-top:12px;border-top:1px solid #e8e5f0;align-items:start}.repair-map{min-width:0}.repair-result{min-width:0;display:flex;flex-direction:column;max-height:max(280px,calc(94dvh - 280px))}.repair-result-content{min-height:0;overflow:auto;padding-right:5px}.repair-apply{flex:none}.repair-edit{font:inherit;color:#67549d;border:0;background:#f3f0fa;border-radius:10px;padding:9px 14px;cursor:pointer}.repair-plan-choices{display:grid;gap:9px}.repair-plan-choices button{display:grid;gap:6px;text-align:left;border:1px solid #e2deec;border-radius:12px;padding:12px 14px;background:#fbfbfd;cursor:pointer;color:#536078;font:inherit;font-size:15px}.repair-plan-choices button strong{font-size:18px;color:#354055}.repair-plan-choices button[aria-pressed="true"]{border-color:#a18ccc;background:#f1ecfb;box-shadow:inset 3px 0 #8061ba}.repair-plan-choices button[aria-pressed="true"] strong{color:#6145a2}
.repair-summary{font-size:15px;line-height:1.7;color:#536078}.repair-changes{display:flex;gap:12px;flex-wrap:wrap;font-size:14px;line-height:1.7;padding:11px 12px;background:#f5f7fa;border-radius:10px}.repair-changes span{display:grid;gap:3px}.repair-changes strong{font-size:16px;font-weight:500;color:#5a4899}
.repair-stops{list-style:none;padding:0;margin:16px 0;display:grid;gap:0}.repair-stops li{position:relative;display:flex;align-items:center;gap:9px;min-height:37px;padding-left:4px;font-size:16px}.repair-stops li:not(:last-child):before{position:absolute;content:'';top:22px;bottom:-6px;left:8px;width:1px;background:#d9d1e9}.repair-stops i{width:9px;height:9px;border-radius:50%;background:#a28ac5;flex:none;z-index:1}.repair-stops strong{font-weight:500;overflow-wrap:anywhere}.repair-stops span{font-size:14px;margin-left:auto;white-space:nowrap;color:#7b718c}.repair-gate i{background:#38816d}
.repair-removed,.repair-basis{font-size:14px;line-height:1.75;margin-top:12px;color:#647089}.repair-removed p{margin:7px 0}.repair-removed strong{font-weight:500}.repair-note,.repair-warning{font-size:14px;line-height:1.7;color:#6b778e}.repair-warning{color:#946528}.repair-error{font-size:15px;line-height:1.7;color:#ab344d;padding:10px 12px;border-radius:10px;background:#fff2f4}.repair-apply{width:100%;margin-top:12px}.repair-empty{font-size:16px;color:#79849a;text-align:center;background:#f7f8fc;padding:28px 16px;margin:22px 0 0;border-radius:12px}
@media(max-width:767px){.repair-context{flex-direction:column;gap:4px}.repair-goals{grid-template-columns:repeat(2,minmax(0,1fr))}.repair-fields{grid-template-columns:1fr 1fr}.repair-preview-button{grid-column:1/-1}.repair-workspace{grid-template-columns:minmax(0,1fr);gap:18px}.repair-stop-options{grid-template-columns:repeat(2,minmax(0,1fr))}.repair-goals button{font-size:15px}}
</style>
