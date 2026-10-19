<template><view class="xingyun-stage" :payload="payload" :change:payload="runtime.apply"><view id="tour-xingyun-avatar"></view></view></template>
<script>
export default {props:{payload:{type:Object,default:()=>({})}},methods:{runtimeEvent(event){this.$emit('state',event)}}}
</script>
<script module="runtime" lang="renderjs">
import {loadXingyunSdk,isRecoverableXingyunEvent} from '../common/xingyun-sdk.js'
let avatar=null,generation=0,timer=null,ready=false,gateway='',pending='',ownerRef=null,lastMetricAt=0,destroying=Promise.resolve()
function release(){generation++;clearTimeout(timer);ready=false;gateway='';pending='';lastMetricAt=0;const previous=avatar;avatar=null;const close=()=>{try{return Promise.resolve(previous&&previous.destroy()).catch(()=>{})}catch(e){return Promise.resolve()}};destroying=destroying.then(close,close);return destroying}
export default {
  methods:{
    async apply(value,old,owner){
      ownerRef=owner
      if(!value||value.command==='close'){
        const closing=release(),current=generation
        await closing
        const container=document.getElementById('tour-xingyun-avatar')
        if(current===generation&&container)container.innerHTML=''
        if(owner)owner.callMethod('runtimeEvent',{state:'closed',id:value&&value.id})
        return
      }
      if(value.command==='stop'){pending='';if(ready&&avatar)try{avatar.interactiveidle()}catch(e){}return}
      if(!value.gateway)return
      if(gateway===value.gateway){
        if(value.command==='speak'){pending=value.text||'';if(ready&&avatar){const text=pending;pending='';avatar.speak(text,true,true)}}
        return
      }
      const closing=release(),version=generation
      await closing
      if(version!==generation)return
      gateway=value.gateway;pending=value.text||''
      const current=generation
      const report=(state,message)=>{if(current===generation&&ownerRef){if(state==='error')console.error('[tour-xingyun]',message);ownerRef.callMethod('runtimeEvent',{state,message,gateway:value.gateway})}}
      const fail=message=>{if(current!==generation)return;report('error',message);release()}
      const connected=()=>{
        if(current!==generation||ready)return
        ready=true;clearTimeout(timer);report('connected')
        if(pending){const text=pending;pending='';avatar.speak(text,true,true)}
      }
      report('connecting')
      timer=setTimeout(()=>fail('星云连接超时，请检查网络后重试'),60000)
      try{
        await loadXingyunSdk()
        if(current!==generation)return
        const headers=value.accessToken?{'X-Tour-Access':value.accessToken}:{Authorization:'Bearer '+value.token}
        avatar=new window.XmovAvatar({containerId:'#tour-xingyun-avatar',appId:'server-proxy',appSecret:'server-proxy',gatewayServer:value.gateway,headers,
          hardwareAcceleration:'prefer-hardware',enableLogger:false,enableDebugger:false,
          proxyWidget:{subtitle_on:()=>{},subtitle_off:()=>{},set_character_canvas_offset:()=>{}},
          onInitEvent:code=>{if(code===4000)connected()},
          onStateChange:state=>{if(state==='idle'||state==='interactive_idle')connected()},
          onVoiceStateChange:state=>{if(String(state).includes('start'))report('playing');if(String(state).includes('end'))report('ended')},
          onFPSUpdate:stats=>{const now=Date.now();if(current!==generation||now-lastMetricAt<5000)return;lastMetricAt=now;if(ownerRef)ownerRef.callMethod('runtimeEvent',{state:'performance',gateway:value.gateway,fps:Number(stats.current)||0,average:Number(stats.average)||0,droppedFrames:Number(stats.droppedFrames)||0,totalFrames:Number(stats.totalFrames)||0,decoder:'prefer-hardware',at:now})},
          onMessage:error=>{if(isRecoverableXingyunEvent(error))return;if(error.code&&error.code!==4000)fail((error.message||'星云服务连接失败')+'（错误码：'+error.code+'）')},
        })
        await avatar.init({onDownloadProgress:progress=>report('progress','正在加载星云形象 '+Math.round(progress)+'%'),onClose:()=>{if(current===generation)fail('星云连接已断开，请重试')}})
      }catch(e){if(current===generation)fail(e.message||'星云连接失败')}
    },
  },
  beforeUnmount(){release()},
}
</script>
<style scoped>
.xingyun-stage{position:absolute;inset:0;z-index:1;overflow:hidden;border-radius:24rpx;background:transparent}
#tour-xingyun-avatar{position:relative;width:100%;height:100%;overflow:hidden;transform:none}
/* Show source y=10%..58% (head to waist); CSS sizing does not resize the
   WebGL drawing buffer or repeat layout work for every rendered frame.
   Attribute selectors match the native canvas created by the SDK in App. */
#tour-xingyun-avatar :deep([width][height]){position:absolute!important;left:50%!important;top:-20.833333%!important;right:auto!important;bottom:auto!important;height:208.333333%!important;width:auto!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;margin:0!important;transform:translate3d(-50%,0,0)!important;object-fit:contain!important}
</style>
