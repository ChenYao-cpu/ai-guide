<template>
  <view class="itinerary-widget">
    <view class="itinerary-panel">
        <view class="itinerary-totals"><view class="total-stations"><text class="metric-value">{{ ids.length }}{{ t('站') }}</text></view><view><text>{{ t('预计步行') }}</text><text class="metric-value">{{ overview?distance(overview.walking_meters):(busy?'…':'—') }}</text></view><view><text>{{ t('预计用时') }}</text><text class="metric-value">{{ overview?.total_minutes??(busy?'…':'—') }} {{ t('分钟') }}</text></view></view>
        <view v-if="error" class="itinerary-error"><text>{{ t(error) }}</text><button @tap="refresh">{{ t('重试') }}</button></view>
        <scroll-view :bounces="false" :show-scrollbar="false" class="stop-scroll" :scroll-y="dragId===null" :scroll-top="scrollTarget" @scroll="onScroll">
          <view class="stop-stack" :style="{height:ids.length*rowHeight+'px'}">
            <view v-for="(id,index) in ids" :key="id" class="itinerary-stop" :class="{'stop-dragging':dragId===id}" :style="stopStyle(id,index)" @touchstart.stop="holdRow($event,id)" @touchmove.stop.prevent="moveRow" @touchend.stop="endRow" @touchcancel.stop="cancelRow">
              <text class="itinerary-number">{{ (dragId===null?ids:dragOrder).indexOf(id)+1 }}</text>
              <text class="itinerary-name">{{ t(spots.find(s=>s.spot_id===id)?.spot_name||'景点') }}</text>
              <button class="stop-remove" :disabled="disabled||dragId!==null" :aria-label="t('移除')" @touchstart.stop @touchmove.stop @touchend.stop @tap.stop="$emit('remove',id)">×</button>
            </view>
          </view>
        </scroll-view>
        <text v-if="overview&&!overview.complete&&!busy" class="itinerary-error">{{ t('部分路段无法确认可步行路径，请调整景点或通行条件。') }}</text>
        <button class="itinerary-details" :disabled="dragId!==null" @tap="openDetails">{{ t('路线与用时') }} <text>↗</text></button>
    </view>
    <view v-if="details" class="route-sheet-mask" @tap="$emit('close')"><view class="route-sheet" :style="{transformOrigin:detailOrigin}" @tap.stop><view class="route-sheet-heading"><text>{{ t('路线与用时') }}</text><button @tap="$emit('close')" :aria-label="t('关闭')">×</button></view><scroll-view :scroll-y="!mapInteracting" :bounces="false" class="route-sheet-body"><text v-if="busy" class="itinerary-note">{{ t('正在计算路线详情…') }}</text><view v-else-if="error" class="itinerary-error"><text>{{ t(error) }}</text><button @tap="refresh">{{ t('重试') }}</button></view><RouteOverview v-else-if="overview" :overview="overview" @map-interacting="mapInteracting=$event" /></scroll-view></view></view>

  </view>
</template>
<script>
import RouteOverview from './RouteOverview.vue'
import { previewOptions, routeRequest } from '../common/route-planning.js'
export default {
  components:{RouteOverview},props:{ids:{type:Array,default:()=>[]},spots:Array,plan:Object,pace:String,details:Boolean,disabled:Boolean},
  data(){return{busy:false,error:'',overview:null,mapInteracting:false,detailOrigin:'50% 85%',dragId:null,dragOrder:[],dragY:0,startY:0,startIndex:0,rowHeight:72,scrollOffset:0,scrollTarget:0,dragScrollStart:0}},
  computed:{options(){return previewOptions(this.ids,this.plan,this.pace)},signature(){return JSON.stringify(this.options)}},
  watch:{details(value){if(!value)this.mapInteracting=false},ids(){if(this.dragId!==null)this.cancelDrag()},signature:{immediate:true,handler(){this.refresh()}}},
  methods:{
    openDetails(){
      const info=uni.getWindowInfo?uni.getWindowInfo():uni.getSystemInfoSync()
      uni.createSelectorQuery().in(this).select('.itinerary-details').boundingClientRect(rect=>{
        if(rect){const w=Math.min(560,info.windowWidth-32),h=info.windowHeight*.82;this.detailOrigin=(rect.left+rect.width/2-(info.windowWidth-w)/2)+'px '+(rect.top+rect.height/2-(info.windowHeight-h)/2)+'px'}
        this.$emit('open')
      }).exec()
    },

    holdRow(e,id){
      if(this.disabled||!e.touches?.length)return
      this.cancelRow();const touch=e.touches[0];this._heldTouch={clientX:touch.clientX,clientY:touch.clientY};this.$emit('dragging',true)
      this._holdRowTimer=setTimeout(()=>{this._holdRowTimer=null;this.startDrag({touches:[this._heldTouch]},id)},280)
    },
    moveRow(e){
      if(!e.touches?.length)return
      if(this.dragId!==null){e.preventDefault?.();this.moveDrag(e);return}
      const p=e.touches[0],start=this._heldTouch
      if(start&&Math.abs(p.clientX-start.clientX)+Math.abs(p.clientY-start.clientY)>8){clearTimeout(this._holdRowTimer);this._holdRowTimer=null}
    },
    endRow(){clearTimeout(this._holdRowTimer);this._holdRowTimer=null;this._heldTouch=null;this.endDrag();this.$emit('dragging',false)},
    cancelRow(){clearTimeout(this._holdRowTimer);this._holdRowTimer=null;this._heldTouch=null;this.cancelDrag()},
    onScroll(e){if(this._holdRowTimer)this.cancelRow();this.scrollOffset=e.detail.scrollTop},
    stopStyle(id,index){const active=this.dragId===id;const slot=this.dragId===null?index:this.dragOrder.indexOf(id);return {height:this.rowHeight+'px',transform:'translate3d(0,'+(active?this.startIndex*this.rowHeight+this.dragY:slot*this.rowHeight)+'px,0)',transition:active?'none':'transform 240ms cubic-bezier(.2,.8,.2,1)'}},
    startDrag(e,id){
      if(this.disabled||!e.touches?.length)return
      this.dragId=id;this.$emit('dragging',true);this.dragOrder=this.ids.slice();this.startIndex=this.ids.indexOf(id);this.startY=e.touches[0].clientY;this.dragY=0;this.dragScrollStart=this.scrollOffset
      uni.createSelectorQuery().in(this).select('.stop-scroll').boundingClientRect(rect=>{this._dragRect=rect}).exec()
      try{uni.vibrateShort({type:'light'})}catch(_){}
    },
    updateDrag(y){
      this.dragY=Math.max(-this.startIndex*this.rowHeight,Math.min((this.ids.length-1-this.startIndex)*this.rowHeight,y-this.startY+this.scrollOffset-this.dragScrollStart))
      const target=Math.max(0,Math.min(this.ids.length-1,Math.round(this.startIndex+this.dragY/this.rowHeight)))
      const from=this.dragOrder.indexOf(this.dragId)
      if(from!==target){const order=this.dragOrder.slice();order.splice(from,1);order.splice(target,0,this.dragId);this.dragOrder=order}
    },
    moveDrag(e){
      if(this.dragId===null||!e.touches?.length)return
      this._fingerY=e.touches[0].clientY;this.updateDrag(this._fingerY)
      if(!this._autoScroll)this._autoScroll=setInterval(()=>{
        if(this.dragId===null||!this._dragRect)return
        const r=this._dragRect,y=this._fingerY,dir=y<r.top+44?-1:y>r.bottom-44?1:0
        const next=Math.max(0,Math.min(Math.max(0,this.ids.length*this.rowHeight-r.height),this.scrollOffset+dir*8))
        if(next!==this.scrollOffset){this.scrollOffset=next;this.scrollTarget=next;this.updateDrag(y)}
      },16)
    },
    endDrag(){if(this.dragId===null)return;const order=this.dragOrder.slice();this.cancelDrag();if(order.some((id,i)=>id!==this.ids[i]))this.$emit('reorder',order)},
    cancelDrag(){this.$emit('dragging',false);clearInterval(this._autoScroll);this._autoScroll=null;this.dragId=null;this.dragY=0},

    distance(n){return n==null?'—':n>=1000?(n/1000).toFixed(2)+' km':n+' m'},
    async refresh(){
      const version=this._version=(this._version||0)+1;this._request?.abort();this.error='';this.busy=!!this.ids.length
      const signature=this.signature;this.$emit('state',{key:signature,busy:this.busy,error:'',data:null})
      if(!this.ids.length){this.overview=null;return}
      const request=this._request=routeRequest('/tour-experience/route-preview',this.options,0,15000)
      try{const data=await request.promise;if(this._disposed||version!==this._version)return;this.overview=data}
      catch(error){if(this._disposed||version!==this._version)return;this.error=error.message}
      finally{if(!this._disposed&&version===this._version){this.busy=false;this.$emit('state',{key:signature,busy:false,error:this.error,data:this.overview})}}
    },
  },
  beforeUnmount(){this.cancelRow();this._disposed=true;this._version++;this._request?.abort()},
}
</script>
<style scoped>
.itinerary-block{margin:26rpx 0;padding:26rpx;border-radius:24rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);color:var(--ng-text)}.itinerary-title{display:flex;justify-content:space-between;align-items:center;font-size:33rpx;font-weight:600}.itinerary-count{font-size:25rpx;color:var(--ng-secondary);font-weight:400}.itinerary-totals{display:flex;gap:24rpx;padding:24rpx 0}.itinerary-totals>view{flex:1}.itinerary-totals text,.itinerary-totals .metric-value{display:block}.itinerary-totals text{font-size:24rpx;color:var(--ng-secondary)}.itinerary-totals .metric-value{font-size:35rpx;font-weight:600;margin-top:5rpx}.itinerary-note{display:block;font-size:24rpx;line-height:1.7;color:var(--ng-secondary);margin:12rpx 0}.itinerary-error{display:block;font-size:25rpx;color:#a43c50;line-height:1.7}.itinerary-error button{font-size:25rpx;color:#6550aa;background:#f4effb;margin:10rpx 0}.itinerary-details{display:flex;justify-content:space-between;align-items:center;margin:18rpx 0;width:100%;padding:0 22rpx;background:#f0ecf8;color:#5b4695;border-radius:14rpx;font-size:28rpx}.itinerary-stop{display:flex;align-items:center;gap:13rpx;padding:17rpx 0;border-bottom:1rpx solid var(--ng-border)}.itinerary-number{font-size:24rpx;color:#6a549c;flex-shrink:0}.itinerary-name{font-size:28rpx;flex:1;min-width:0;overflow-wrap:anywhere}.itinerary-actions{display:flex;gap:6rpx;flex-shrink:0}.itinerary-actions button{display:grid;place-items:center;width:56rpx;height:60rpx;min-height:0;margin:0;padding:0;font-size:30rpx;line-height:1;background:#f6f4fa;color:#665282;border-radius:10rpx}.itinerary-actions button[disabled]{opacity:.3}.route-sheet-mask{position:fixed;inset:0;z-index:1500;display:flex;align-items:flex-end;background:rgba(25,30,50,.35)}.route-sheet{width:100%;height:88vh;max-height:88vh;background:var(--ng-surface,#fff);border-radius:32rpx 32rpx 0 0;display:flex;flex-direction:column;padding:28rpx;box-sizing:border-box;padding-bottom:calc(28rpx + env(safe-area-inset-bottom))}.route-sheet-heading{display:flex;align-items:center;justify-content:space-between;font-size:34rpx;font-weight:600;padding-bottom:22rpx;flex-shrink:0}.route-sheet-heading button{font-size:38rpx;margin:0;padding:0 18rpx;line-height:1.5;background:#f4f2f8;color:#655574}.route-sheet-body{flex:1;min-height:0;height:0}.route-sheet-done{margin:22rpx 0 0;background:#6551af;color:#fff;border-radius:16rpx;font-size:29rpx;flex-shrink:0}

.itinerary-panel{padding:4px 20px 16px;color:var(--ng-text)}.itinerary-totals{padding:16px 0 4px}.stop-scroll{height: min(42vh,432px);margin:10px 0}.stop-stack{position:relative}.itinerary-stop{position:absolute;top:0;left:0;right:0;box-sizing:border-box;padding:8px 10px;gap:10px;background:var(--ng-surface,#fff);border-bottom:1px solid var(--ng-border);border-radius:14px;will-change:transform;user-select:none}.stop-dragging{z-index:5;box-shadow:0 9px 24px rgba(89,70,165,.2);background:#f1edff;border-color:transparent}.itinerary-number{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#eee9fc;font-size:12px}.itinerary-name{font-size:15px;line-height:1.4}.stop-remove{width:30px;height:34px;padding:0;margin:0;font-size:23px;line-height:32px;background:transparent;color:var(--ng-secondary)}.stop-remove:after{border:0}.drag-handle{width:40px;height:52px;display:flex;align-items:center;justify-content:center;font-size:29px;color:#8a7cad;touch-action:none}.handle-disabled{opacity:.3}.itinerary-details{margin:12px 0 0}

.itinerary-widget{margin-top:0;padding-top:0}
.itinerary-panel{padding:0}.itinerary-title{font-size:17px}.stop-scroll{height: min(42vh,432px)}
.stop-dragging{touch-action:none}
.itinerary-stop{touch-action:none;-webkit-user-select:none}.stop-scroll{overscroll-behavior:contain;overflow-anchor:none}

.route-sheet-mask{align-items:center;justify-content:center;padding:calc(var(--status-bar-height) + 12px) 16px calc(env(safe-area-inset-bottom) + 12px);box-sizing:border-box}
.route-sheet{width:100%;max-width:560px;height:82vh;max-height:100%;border-radius:28px;padding:20px 16px 16px;animation:routeWindowEnter 380ms cubic-bezier(.2,1.12,.3,1)}
@keyframes routeWindowEnter{from{opacity:0;transform:scale(.15)}to{opacity:1;transform:scale(1)}}
.expanded-map-mask{position:fixed;inset:0;z-index:2500;padding:calc(var(--status-bar-height) + 12px) 12px calc(env(safe-area-inset-bottom) + 16px);box-sizing:border-box;background:rgba(25,30,50,.48);display:flex;align-items:center;justify-content:center}
.expanded-map-panel{width:100%;max-width:720px;box-sizing:border-box;border-radius:26px;background:var(--ng-surface);padding:18px 12px;animation:routeWindowEnter 250ms ease-out}
.itinerary-update-status{display:block;height:20px;line-height:20px;font-size:12px;color:var(--ng-secondary);opacity:0;transition:opacity 180ms;pointer-events:none}.itinerary-update-status.updating{opacity:1}.metric-value{font-variant-numeric:tabular-nums}
.itinerary-totals{padding:4px 0 8px;align-items:center;gap:12px}.itinerary-totals .total-stations{flex:0 0 auto;min-width:48px}.itinerary-totals .total-stations .metric-value{margin:0;font-size:30rpx}.itinerary-totals .metric-value{font-size:31rpx;margin-top:2rpx}.itinerary-totals text{font-size:23rpx}
.itinerary-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;align-items:center;text-align:center}.itinerary-totals>view,.itinerary-totals .total-stations{min-width:0;width:100%}
</style>
