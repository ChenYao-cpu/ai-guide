<template>
  <view class="itinerary-block">
    <view class="itinerary-title"><text>{{ t('我的行程') }}</text><text class="itinerary-count">{{ ids.length }} {{ t('站') }}</text></view>
    <view class="itinerary-totals"><view><text>{{ t('预计步行') }}</text><text class="metric-value">{{ busy?'…':distance(overview?.walking_meters) }}</text></view><view><text>{{ t('预计用时') }}</text><text class="metric-value">{{ busy?'…':overview?.total_minutes??'—' }} {{ t('分钟') }}</text></view></view>
    <text v-if="busy" class="itinerary-note">{{ t('正在计算路线详情…') }}</text>
    <view v-else-if="error" class="itinerary-error"><text>{{ t(error) }}</text><button @tap="refresh">{{ t('重试') }}</button></view>
    <text v-else-if="overview" class="itinerary-note">{{ t('停留') }} {{ overview.visit_minutes }} · {{ t('步行') }} {{ overview.walking_minutes??'—' }} · {{ t('休息') }} {{ overview.rest_minutes }} {{ t('分钟') }}</text>
    <button class="itinerary-details" @tap="$emit('open')">{{ t('路线与用时') }} <text>↗</text></button>
    <view v-for="(id,index) in ids" :key="id" class="itinerary-stop"><text class="itinerary-number">{{ index+1 }}</text><text class="itinerary-name">{{ t(spots.find(s=>s.spot_id===id)?.spot_name||'景点') }}</text><view class="itinerary-actions"><button :disabled="disabled||index===0" :aria-label="t('上移')" @tap="$emit('move',id,-1)">↑</button><button :disabled="disabled||index===ids.length-1" :aria-label="t('下移')" @tap="$emit('move',id,1)">↓</button><button :disabled="disabled" :aria-label="t('移除')" @tap="$emit('remove',id)">×</button></view></view>
    <text v-if="overview&&!overview.complete&&!busy" class="itinerary-error">{{ t('部分路段无法确认可步行路径，请调整景点或通行条件。') }}</text>
    <text class="itinerary-note">{{ t('调整顺序后，距离与用时会自动更新。') }}</text>
    <view v-if="details" class="route-sheet-mask" @tap="$emit('close')"><view class="route-sheet" @tap.stop><view class="route-sheet-heading"><text>{{ t('路线与用时') }}</text><button @tap="$emit('close')" :aria-label="t('关闭')">×</button></view><scroll-view scroll-y class="route-sheet-body"><text v-if="busy" class="itinerary-note">{{ t('正在计算路线详情…') }}</text><view v-else-if="error" class="itinerary-error"><text>{{ t(error) }}</text><button @tap="refresh">{{ t('重试') }}</button></view><RouteOverview v-else-if="overview" :overview="overview" /></scroll-view><button class="route-sheet-done" @tap="$emit('close')">{{ t('返回行程') }}</button></view></view>
  </view>
</template>
<script>
import RouteOverview from './RouteOverview.vue'
import { previewOptions, routeRequest } from '../common/route-planning.js'
export default {
  components:{RouteOverview},props:{ids:{type:Array,default:()=>[]},spots:Array,plan:Object,pace:String,details:Boolean,disabled:Boolean},
  data(){return{busy:false,error:'',overview:null}},
  computed:{options(){return previewOptions(this.ids,this.plan,this.pace)},signature(){return JSON.stringify(this.options)}},
  watch:{signature:{immediate:true,handler(){this.refresh()}}},
  methods:{
    distance(n){return n==null?'—':n>=1000?(n/1000).toFixed(2)+' km':n+' m'},
    async refresh(){
      const version=this._version=(this._version||0)+1;this._request?.abort();this.overview=null;this.error='';this.busy=!!this.ids.length
      const signature=this.signature;this.$emit('state',{key:signature,busy:this.busy,error:'',data:null})
      if(!this.ids.length)return
      const request=this._request=routeRequest('/tour-experience/route-preview',this.options,0,15000)
      try{const data=await request.promise;if(this._disposed||version!==this._version)return;this.overview=data}
      catch(error){if(this._disposed||version!==this._version)return;this.error=error.message}
      finally{if(!this._disposed&&version===this._version){this.busy=false;this.$emit('state',{key:signature,busy:false,error:this.error,data:this.overview})}}
    },
  },
  beforeUnmount(){this._disposed=true;this._version++;this._request?.abort()},
}
</script>
<style scoped>
.itinerary-block{margin:26rpx 0;padding:26rpx;border-radius:24rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);color:var(--ng-text)}.itinerary-title{display:flex;justify-content:space-between;align-items:center;font-size:33rpx;font-weight:600}.itinerary-count{font-size:25rpx;color:var(--ng-secondary);font-weight:400}.itinerary-totals{display:flex;gap:24rpx;padding:24rpx 0}.itinerary-totals>view{flex:1}.itinerary-totals text,.itinerary-totals .metric-value{display:block}.itinerary-totals text{font-size:24rpx;color:var(--ng-secondary)}.itinerary-totals .metric-value{font-size:35rpx;font-weight:600;margin-top:5rpx}.itinerary-note{display:block;font-size:24rpx;line-height:1.7;color:var(--ng-secondary);margin:12rpx 0}.itinerary-error{display:block;font-size:25rpx;color:#a43c50;line-height:1.7}.itinerary-error button{font-size:25rpx;color:#6550aa;background:#f4effb;margin:10rpx 0}.itinerary-details{display:flex;justify-content:space-between;align-items:center;margin:18rpx 0;width:100%;padding:0 22rpx;background:#f0ecf8;color:#5b4695;border-radius:14rpx;font-size:28rpx}.itinerary-stop{display:flex;align-items:center;gap:13rpx;padding:17rpx 0;border-bottom:1rpx solid var(--ng-border)}.itinerary-number{font-size:24rpx;color:#6a549c;flex-shrink:0}.itinerary-name{font-size:28rpx;flex:1;min-width:0;overflow-wrap:anywhere}.itinerary-actions{display:flex;gap:6rpx;flex-shrink:0}.itinerary-actions button{display:grid;place-items:center;width:56rpx;height:60rpx;min-height:0;margin:0;padding:0;font-size:30rpx;line-height:1;background:#f6f4fa;color:#665282;border-radius:10rpx}.itinerary-actions button[disabled]{opacity:.3}.route-sheet-mask{position:fixed;inset:0;z-index:1500;display:flex;align-items:flex-end;background:rgba(25,30,50,.35)}.route-sheet{width:100%;height:88vh;max-height:88vh;background:var(--ng-surface,#fff);border-radius:32rpx 32rpx 0 0;display:flex;flex-direction:column;padding:28rpx;box-sizing:border-box;padding-bottom:calc(28rpx + env(safe-area-inset-bottom))}.route-sheet-heading{display:flex;align-items:center;justify-content:space-between;font-size:34rpx;font-weight:600;padding-bottom:22rpx;flex-shrink:0}.route-sheet-heading button{font-size:38rpx;margin:0;padding:0 18rpx;line-height:1.5;background:#f4f2f8;color:#655574}.route-sheet-body{flex:1;min-height:0;height:0}.route-sheet-done{margin:22rpx 0 0;background:#6551af;color:#fff;border-radius:16rpx;font-size:29rpx;flex-shrink:0}
</style>
