<template>
  <view class="tb-root liquid-nav" :class="{leaving:leaving}">
    <view class="tb-inner liquid-inner">
      <view class="liquid-pill" :class="{moving:pillMoving}" :style="pillStyle"></view>
      <view v-for="(item,index) in tabs" :key="item.key" class="tb-item" :class="{on:selected===index, 'liquid-pop':bouncing===index}" @tap="switchTab(index)">
        <text class="tb-icon iconfont" :class="item.icon" :style="bouncing===index?{animationDelay:popDelay+'ms'}:{}"></text>
        <text class="tb-label">{{ t(item.label) }}</text>
      </view>
    </view>
    <view class="tb-safe"></view>
  </view>
</template>
<script>
import { tabMotion } from '../common/tab-motion.js'
export default {
  props:{current:{type:String,default:'tour'},leaving:{type:Boolean,default:false},hideOnEnter:{type:Boolean,default:false}},
  data(){return {selected:0,bouncing:-1,left:0,right:0,pillMoving:false,busy:false,timer:null,navigateTimer:null,popDelay:0,tabs:[
    {key:'tour',icon:'icon-daolan',label:'智能导览',path:'/pages/tour-guide/tour-guide'},
    {key:'ai',icon:'icon-aishuziren',label:'AI小导游',path:'/pages/ai-chat/ai-chat'},
    {key:'mine',icon:'icon-wode1',label:'我的',path:'/pages/mine/mine'}]}},
  computed:{pillStyle(){return {left:(this.left*100/3+6.5)+'%',right:((2-this.right)*100/3+6.5)+'%'}}},
  created(){
    this.selected=Math.max(0,this.tabs.findIndex(t=>t.key===this.current))
    this.left=this.right=this.selected
    if(this.hideOnEnter)return
    const age=Date.now()-tabMotion.at
    if(age<560&&tabMotion.to===this.selected&&tabMotion.from!==tabMotion.to){
      this.bouncing=this.selected;this.popDelay=-Math.max(0,age)
      setTimeout(()=>{this.bouncing=-1},620)
      this.left=this.right=tabMotion.from
      this.runPillTab(tabMotion.from,tabMotion.to,Math.max(80,540-age))
    }
  },
  beforeUnmount(){clearTimeout(this.timer);clearTimeout(this.navigateTimer)},
  methods:{
    runPillTab(from,to,duration){
      const dir=to>from?1:-1,started=Date.now()
      const ease=x=>{x=Math.max(0,Math.min(1,x));const c1=1.25,c3=c1+1;return Math.max(0,Math.min(1.05,1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)))}
      this.pillMoving=true
      const frame=()=>{
        const p=Math.min(1,(Date.now()-started)/duration)
        const lead=ease(Math.min(1,p/0.78)),tail=ease(Math.max(0,(p-0.22)/0.78))
        this.left=from+(to-from)*(dir>0?tail:lead)
        this.right=from+(to-from)*(dir>0?lead:tail)
        if(p<1){this.timer=setTimeout(frame,16);return}
        this.left=this.right=to;this.pillMoving=false;this.busy=false
      };frame()
    },
    switchTab(index){
      if(this.busy||index===this.selected)return
      const from=this.selected,started=Date.now()
      this.busy=true;this.bouncing=index;this.popDelay=0
      Object.assign(tabMotion,{direction:index>from?1:-1,at:started,from,to:index})
      this.selected=index
      this.navigateTimer=setTimeout(()=>uni.reLaunch({url:this.tabs[index].path,fail:()=>{this.left=this.right=from;this.selected=from;this.busy=false;this.bouncing=-1}}),16)
    }
  }
}
</script>
<style scoped>
.liquid-nav{position:fixed;bottom:0;left:0;right:0;z-index:999;background:var(--ng-surface);transition:transform .52s cubic-bezier(.34,1.45,.45,1),opacity .44s ease}
.liquid-nav.leaving{transform:translateY(130%);opacity:0;pointer-events:none}
.liquid-inner{position:relative;display:flex;align-items:center;padding:6px!important;min-height:64px;box-sizing:border-box}
.liquid-pill{position:absolute;top:7px;bottom:7px;border-radius:30px;background:var(--ng-raised);pointer-events:none;will-change:left,right,transform;transform-origin:50% 50%}
.liquid-pill.moving{animation:pillLiquid 520ms cubic-bezier(.25,.9,.3,1) both}
@keyframes pillLiquid{0%,100%{transform:scale(1,1)}20%{transform:scale(1.12,.8)}62%{transform:scale(.9,1.16)}82%{transform:scale(1.05,.96)}}
.liquid-nav .tb-item{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50px;gap:3px;padding:0}
.liquid-nav .tb-icon{font-size:26px;line-height:1.15;color:var(--ng-secondary)}
.liquid-nav .tb-label{font-size:13px;line-height:1.3;color:var(--ng-secondary);transition:color 400ms}
.liquid-nav .tb-item.on .tb-label{color:var(--ng-text)}
.liquid-pop .tb-icon{animation:liquidIcon 400ms both}
.tb-safe{height:env(safe-area-inset-bottom);min-height:0}
@keyframes liquidIcon{0%{transform:scale(1)}22%{transform:scale(.76)}68%{transform:scale(1.14)}85%{transform:scale(.97)}100%{transform:scale(1)}}
</style>
