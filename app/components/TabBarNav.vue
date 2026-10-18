<template>
  <view class="tb-root liquid-nav">
    <view class="tb-inner liquid-inner">
      <view class="liquid-pill" :style="pillStyle"></view>
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
  props:{current:{type:String,default:'tour'}},
  data(){return {selected:0,bouncing:-1,left:0,right:0,flat:1,busy:false,timer:null,navigateTimer:null,popDelay:0,tabs:[
    {key:'tour',icon:'icon-daolan',label:'智能导览',path:'/pages/tour-guide/tour-guide'},
    {key:'ai',icon:'icon-aishuziren',label:'AI小导游',path:'/pages/ai-chat/ai-chat'},
    {key:'mine',icon:'icon-wode1',label:'我的',path:'/pages/mine/mine'}]}},
  computed:{pillStyle(){return {left:(this.left*100/3+6.5)+'%',right:((2-this.right)*100/3+6.5)+'%',transform:'scaleY('+this.flat+')'}}},
  created(){
    this.selected=Math.max(0,this.tabs.findIndex(t=>t.key===this.current))
    this.left=this.right=this.selected
    const age=Date.now()-tabMotion.at
    if(age<400&&tabMotion.to===this.selected){this.busy=true;this.bouncing=this.selected;this.popDelay=-age;this.animatePill(tabMotion.from,tabMotion.to,tabMotion.at)}
  },
  beforeUnmount(){clearTimeout(this.timer);clearTimeout(this.navigateTimer)},
  methods:{
    animatePill(from,index,started){
      const direction=index>from?1:-1,settle=x=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3)
      const frame=()=>{
        const p=Math.min(1,(Date.now()-started)/400)
        const front=settle(Math.min(1,p/0.925)),tail=settle(Math.max(0,(p-0.075)/0.925))
        this.left=from+(index-from)*(direction>0?tail:front)
        this.right=from+(index-from)*(direction>0?front:tail)
        this.flat=1-0.17*Math.sin(Math.PI*p)
        if(p<1){this.timer=setTimeout(frame,16);return}
        this.left=this.right=index;this.flat=1;this.busy=false;this.bouncing=-1
      };frame()
    },
    switchTab(index){
      if(this.busy||index===this.selected)return
      const from=this.selected,started=Date.now()
      this.busy=true;this.selected=index;this.bouncing=index;this.popDelay=0
      Object.assign(tabMotion,{direction:index>from?1:-1,at:started,from,to:index})
      this.animatePill(from,index,started)
      this.navigateTimer=setTimeout(()=>uni.reLaunch({url:this.tabs[index].path,fail:()=>{clearTimeout(this.timer);this.left=this.right=from;this.selected=from;this.busy=false;this.bouncing=-1}}),48)
    }
  }
}
</script>
<style scoped>
.liquid-nav{position:fixed;bottom:0;left:0;right:0;z-index:999;background:var(--ng-surface)}
.liquid-inner{position:relative;display:flex;align-items:center;padding:6px!important;min-height:64px;box-sizing:border-box}
.liquid-pill{position:absolute;top:7px;bottom:7px;border-radius:30px;background:var(--ng-raised);pointer-events:none;will-change:left,right,transform}
.liquid-nav .tb-item{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50px;gap:3px;padding:0}
.liquid-nav .tb-icon{font-size:26px;line-height:1.15;color:var(--ng-secondary)}
.liquid-nav .tb-label{font-size:13px;line-height:1.3;color:var(--ng-secondary);transition:color 400ms}
.liquid-nav .tb-item.on .tb-label{color:var(--ng-text)}
.liquid-pop .tb-icon{animation:liquidIcon 400ms both}
.tb-safe{height:env(safe-area-inset-bottom);min-height:0}
@keyframes liquidIcon{0%{transform:scale(1)}22%{transform:scale(.76)}68%{transform:scale(1.14)}85%{transform:scale(.97)}100%{transform:scale(1)}}
</style>
