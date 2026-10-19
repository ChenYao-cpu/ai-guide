<template>
  <view v-if="ready" class="tour-orb" :class="{dragging,snapping}" :style="{left:x+'px',top:y+'px'}" role="button" :aria-label="t('开始导览')" @touchstart.stop="start" @touchmove.stop.prevent="move" @touchend.stop="end" @touchcancel.stop="cancel" @tap.stop="activate">
    <view class="orb-rim"></view><text class="orb-flag">▶</text>
  </view>
</template>
<script>
export default {
  props:{count:Number},emits:['activate','dragging'],
  data(){return{ready:false,snapping:false,x:12,y:400,width:375,height:750,top:20,bottom:0,side:'right',dragging:false}},
  mounted(){this.layout();this.ready=true;this._resize=()=>{this.cancel();this.layout()};uni.onWindowResize?.(this._resize)},
  beforeUnmount(){clearTimeout(this._snapTimer);clearTimeout(this._hold);uni.offWindowResize?.(this._resize);this.$emit('dragging',false)},
  methods:{
    clampY(y){return Math.max(this.top+12,Math.min(y,Math.max(this.top+12,this.height-this.bottom-164)))},
    layout(){const i=uni.getWindowInfo?uni.getWindowInfo():uni.getSystemInfoSync();const first=!this._laidOut;this.width=i.windowWidth;this.height=i.windowHeight;this.top=i.safeAreaInsets?.top||i.statusBarHeight||0;this.bottom=i.safeAreaInsets?.bottom||0;this.x=this.side==='left'?12:Math.max(12,this.width-86);this.y=this.clampY(first?this.height-this.bottom-180:this.y);this._laidOut=true},
    start(e){if(!e.touches?.length)return;clearTimeout(this._snapTimer);this.snapping=false;clearTimeout(this._hold);const p=e.touches[0];this._touch={x:p.clientX,y:p.clientY,left:this.x,top:this.y};this.$emit('dragging',true);this._hold=setTimeout(()=>{if(!this._touch)return;this.dragging=true;this._block=Date.now()+600;try{uni.vibrateShort({type:'light'})}catch(_){}},240)},
    move(e){if(!this._touch||!e.touches?.length)return;const p=e.touches[0],dx=p.clientX-this._touch.x,dy=p.clientY-this._touch.y;if(!this.dragging){if(Math.abs(dx)+Math.abs(dy)>10){clearTimeout(this._hold);this._block=Date.now()+600}return}this.x=Math.max(12,Math.min(this.width-86,this._touch.left+dx));this.y=this.clampY(this._touch.top+dy)},
    end(){clearTimeout(this._hold);if(this.dragging){this.side=this.x+37<this.width/2?'left':'right';this.dragging=false;this.snapping=true;this._snapTimer=setTimeout(()=>{this.snapping=false},400);this.x=this.side==='left'?12:Math.max(12,this.width-86);this._block=Date.now()+600}this._touch=null;this.$emit('dragging',false)},
    cancel(){this.end();this._block=Date.now()+600},
    activate(){if(this.dragging||Date.now()<(this._block||0))return;this.$emit('activate')},
  },
}
</script>
<style scoped>
.tour-orb{position:fixed!important;width:74px;height:74px;box-sizing:border-box;border-radius:50%;z-index:990!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:linear-gradient(145deg,#f3efff,#dbd5ff);border:1px solid rgba(255,255,255,.92);box-shadow:0 8px 25px rgba(89,70,165,.22),inset 0 2px 5px #fff;touch-action:none;user-select:none;transition:transform 180ms,box-shadow 180ms}
.orb-rim{position:absolute;inset:4px;border-radius:50%;border:1px solid rgba(255,255,255,.65);pointer-events:none}.orb-flag{font-size:26px;line-height:1;color:#6551af}.orb-number{font-size:16px;line-height:1.2;color:#534091;font-weight:600}.tour-orb:active{transform:scale(.95)}.tour-orb.dragging{transition:none;transform:scale(1.06);box-shadow:0 14px 36px rgba(89,70,165,.32),inset 0 2px 5px #fff}
.tour-orb.snapping{transition:left 360ms cubic-bezier(.2,1.25,.35,1),top 360ms cubic-bezier(.2,1.25,.35,1),transform 180ms,box-shadow 180ms}
</style>
