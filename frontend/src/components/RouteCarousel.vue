<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeft, ArrowRight, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { locale } from '@/i18n'
import type { RecommendedRoute } from '@/types/recommendedRoute'
const props=defineProps<{routes:RecommendedRoute[];suspended?:boolean}>()
const viewport=ref<HTMLElement|null>(null),active=ref(0),playing=ref(true),focused=ref(false),dragging=ref(false),stageHeight=ref(320)
let timer:ReturnType<typeof setInterval>|undefined,observer:IntersectionObserver|undefined,resize:ResizeObserver|undefined,motion:MediaQueryList|undefined
let visible=true,reduced=false,nextTurn=Date.now()+4500,pointer=-1,startX=0,deltaX=0,suppressClick=false
function offset(index:number){
 const count=props.routes.length;if(count<2)return 0
 let distance=(index-active.value+count)%count
 if(distance>count/2)distance-=count
 return distance
}
function position(index:number){const d=offset(index);return {
 '--offset':d,'--depth':d===0?'0px':'-160px','--tilt':(-d*42)+'deg','--lean':(d*2)+'deg',
 '--scale':d===0?1:.84, zIndex:d===0?3:Math.abs(d)===1?1:0,
 opacity:Math.abs(d)>1?0:d===0?1:.68,
}}
function go(index:number){
 if(!props.routes.length)return
 active.value=(index+props.routes.length)%props.routes.length;nextTurn=Date.now()+4500
}
function pointerDown(event:PointerEvent){
 suppressClick=false
 if(event.pointerType==='mouse'&&event.button!==0)return
 pointer=event.pointerId;startX=event.clientX;deltaX=0
}
function pointerMove(event:PointerEvent){
 if(pointer!==event.pointerId)return
 deltaX=event.clientX-startX
 if(Math.abs(deltaX)<12&&!dragging.value)return
 if(!dragging.value){dragging.value=true;viewport.value?.setPointerCapture?.(event.pointerId)}
 event.preventDefault();suppressClick=true
}
function pointerUp(){
 if(pointer<0)return
 pointer=-1
 if(dragging.value&&Math.abs(deltaX)>38)go(active.value+(deltaX<0?1:-1))
 dragging.value=false;nextTurn=Date.now()+4500
}
function cancelPointer(){pointer=-1;dragging.value=false;deltaX=0;nextTurn=Date.now()+4500}
function slideClick(event:MouseEvent,index:number){
 if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;return}
 nextTurn=Date.now()+4500
 if(index!==active.value){event.preventDefault();event.stopPropagation();go(index)}
}
function measure(){
 const cards=viewport.value?.querySelectorAll<HTMLElement>('.route-card')
 if(cards?.length)stageHeight.value=Math.max(320,...Array.from(cards,c=>c.offsetHeight+44))
}
function updateMotion(){reduced=!!motion?.matches;if(reduced)playing.value=false}
function onFocus(event:FocusEvent){focused.value=!!(event.target as HTMLElement)?.matches?.(':focus-visible')}
watch(()=>props.routes.map(r=>r.route_id).join(','),async()=>{go(0);await nextTick();measure()})
watch(locale,async()=>{await nextTick();measure()})
watch(()=>props.suspended,value=>{if(!value)nextTurn=Date.now()+4500})
onMounted(()=>{
 motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');updateMotion();motion?.addEventListener?.('change',updateMotion)
 if(typeof IntersectionObserver!=='undefined'&&viewport.value){observer=new IntersectionObserver(entries=>{
  const entering=entries[0]?.isIntersecting??false;if(entering&&!visible)nextTurn=Date.now()+4500;visible=entering
 },{threshold:.3});observer.observe(viewport.value)}
 if(typeof ResizeObserver!=='undefined'&&viewport.value){resize=new ResizeObserver(measure);resize.observe(viewport.value)}
 measure()
 timer=setInterval(()=>{if(playing.value&&!props.suspended&&!focused.value&&!dragging.value&&visible&&!document.hidden&&props.routes.length>1&&Date.now()>=nextTurn)go(active.value+1)},100)
})
onBeforeUnmount(()=>{clearInterval(timer);observer?.disconnect();resize?.disconnect();motion?.removeEventListener?.('change',updateMotion)})
</script>

<template>
 <section class="route-carousel" role="region" aria-roledescription="carousel" :aria-label="$t('推荐路线')" @focusin="onFocus" @focusout="focused=false">
  <header class="carousel-heading">
   <h3>{{ $t('推荐路线') }}</h3>
   <div v-if="routes.length>1" class="carousel-actions">
    <span class="carousel-count">{{ String(active+1).padStart(2,'0') }} <i>/ {{ String(routes.length).padStart(2,'0') }}</i></span>
    <button type="button" :aria-label="$t('上一条路线')" @click="go(active-1)"><el-icon><ArrowLeft /></el-icon></button>
    <button type="button" :aria-label="$t('下一条路线')" @click="go(active+1)"><el-icon><ArrowRight /></el-icon></button>
   </div>
  </header>
  <div ref="viewport" class="carousel-viewport" :class="{dragging,reduced}" :style="{height:stageHeight+'px'}" tabindex="0" :aria-label="$t('左右滑动浏览路线')" @keydown.left.prevent="go(active-1)" @keydown.right.prevent="go(active+1)" @keydown.home.prevent="go(0)" @keydown.end.prevent="go(routes.length-1)" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="cancelPointer" @pointerleave="pointer<0?undefined:!dragging&&cancelPointer()">
   <div v-for="(route,index) in routes" :key="route.route_id" class="route-slide" :class="{active:active===index,solo:routes.length===1}" :style="position(index)" role="group" aria-roledescription="slide" :aria-hidden="active!==index" :aria-label="`${index+1} / ${routes.length} · ${$t(route.name)}`" @click.capture="slideClick($event,index)">
    <slot :route="route" :index="index" :active="active===index" />
   </div>
  </div>
  <footer v-if="routes.length>1" class="carousel-footer">
   <span class="carousel-hint"><i :class="{paused:!playing||focused}"></i>{{ $t(playing?'自动翻转浏览 · 点击卡片选择路线':'左右滑动，发现不同玩法') }}</span>
   <div class="carousel-pagination" :aria-label="$t('切换推荐路线')">
    <button v-for="(route,index) in routes" :key="route.route_id" type="button" :aria-label="$t('查看路线：{p0}',{p0:route.name})" :aria-current="active===index?'true':undefined" @click="go(index)"><span></span></button>
   </div>
   <button type="button" class="carousel-play" :aria-label="$t(playing?'暂停轮播':'继续轮播')" @click="playing=!playing;nextTurn=Date.now()+4500"><el-icon><VideoPause v-if="playing" /><VideoPlay v-else /></el-icon></button>
  </footer>
 </section>
</template>

<style scoped>
.route-carousel{min-width:0;--carousel-gap:20px;--slide-width:72%}
.carousel-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}
.carousel-heading h3{font-size:21px;font-weight:600;margin:0;color:#283347}
.carousel-actions{display:flex;align-items:center;gap:10px}.carousel-count{font:600 18px Arial;color:#6552b0;margin-right:8px}.carousel-count i{font-style:normal;color:#8993a5;font-weight:400;font-size:15px}
.carousel-actions button,.carousel-play{display:grid;place-items:center;width:38px;height:38px;border:1px solid #e2deee;border-radius:50%;background:#f7f5fc;color:#6653b4;font:inherit;cursor:pointer;transition:background .2s,transform .2s}
.carousel-actions button:hover:not(:disabled),.carousel-play:hover{background:#eae4fb;transform:translateY(-2px)}.carousel-actions button:disabled{opacity:.35;cursor:default}
.carousel-viewport{position:relative;overflow:hidden;perspective:1400px;isolation:isolate;cursor:grab;touch-action:pan-y;outline-offset:4px;user-select:none}
.carousel-viewport.dragging{cursor:grabbing}
.route-slide{position:absolute;top:50%;left:50%;width:76%;min-width:0;transform:translate(-50%,-50%) translate3d(calc(var(--offset)*82%),0,var(--depth)) rotateY(var(--tilt)) rotateZ(var(--lean)) scale(var(--scale));transform-origin:center;transition:transform 1.05s cubic-bezier(.22,.72,.2,1),opacity .85s ease;backface-visibility:hidden;will-change:transform,opacity}
.route-slide.solo{width:100%}.route-slide :deep(.route-card){height:auto;user-select:none;box-shadow:0 18px 35px -26px #54417870!important}
.route-slide.active :deep(.route-card){border-color:#c9bce6!important;box-shadow:0 20px 36px -25px #67509480!important}
.route-slide:not(.active) :deep(.route-card){cursor:pointer;box-shadow:none!important}
.carousel-footer{display:flex;align-items:center;gap:18px;margin-top:6px;min-height:34px}.carousel-hint{font-size:15px;color:#7a8398;display:flex;align-items:center;gap:8px}.carousel-hint i{width:7px;height:7px;border-radius:50%;background:#9a84cd;animation:carousel-breathe 1.6s ease-in-out infinite}.carousel-hint i.paused{animation:none;opacity:.45}@keyframes carousel-breathe{50%{box-shadow:0 0 0 4px #9277c51a;opacity:.55}}.carousel-pagination{display:flex;align-items:center;gap:5px;margin-left:auto}
.carousel-pagination button{border:0;padding:10px 5px;background:none;cursor:pointer}.carousel-pagination span{display:block;width:8px;height:6px;background:#ddd7ed;border-radius:9px;transition:width .45s ease,background .3s}
.carousel-pagination button[aria-current=true] span{width:34px;background:#8572c2}.carousel-play{width:32px;height:32px;flex-shrink:0}
.carousel-viewport.reduced .route-slide{transition:none}
button:focus-visible{outline:2px solid #8a74cc;outline-offset:3px}
@media(max-width:700px){.route-carousel{--carousel-gap:12px}.route-slide{width:88%}.carousel-viewport{perspective:1000px}.carousel-heading h3{font-size:20px}.carousel-hint{font-size:14px}.carousel-footer{gap:8px}.carousel-count{margin-right:0}.carousel-actions{gap:7px}}
@media(prefers-reduced-motion:reduce){.route-slide,.carousel-pagination span,.carousel-actions button,.carousel-play{transition:none}.route-slide{transition:none}.carousel-hint i{animation:none}}
</style>
