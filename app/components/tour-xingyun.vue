<template><view class="xingyun-stage" :payload="payload" :change:payload="runtime.apply"><view id="tour-xingyun-avatar"></view></view></template>
<script>
export default {props:{payload:{type:Object,default:()=>({})}},methods:{runtimeEvent(event){this.$emit('state',event)}}}
</script>
<script module="runtime" lang="renderjs">
let avatar=null,generation=0,timer=null,ready=false,gateway='',pending='',ownerRef=null
let voicePlaying=false,lastTelemetry=0
let framingStyle=null
function release(){generation++;clearTimeout(timer);ready=false;voicePlaying=false;lastTelemetry=0;gateway='';pending='';try{if(avatar)avatar.destroy()}catch(e){}avatar=null}
function fitSurfaces(){
  if(framingStyle&&framingStyle.parentNode)return
  // The SDK replaces canvas.style during initialization and walk/anchor events.
  // A scoped stylesheet wins over those inline writes, including the first frame.
  // Keep the decoded pixel buffer intact; crop to a centered waist-up composition.
  framingStyle=document.createElement('style')
  framingStyle.textContent='#tour-xingyun-avatar canvas{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;transform:translateZ(0) scale(2.5)!important;transform-origin:50% 20%!important;object-fit:contain!important;object-position:50% 50%!important;display:block!important;backface-visibility:hidden!important;will-change:transform!important}'
  document.head.appendChild(framingStyle)
}
export default {
  methods:{
    async apply(value,old,owner){
      ownerRef=owner
      if(!value||value.command==='close'){release();return}
      if(value.command==='stop'){pending='';if(ready&&avatar&&voicePlaying)try{avatar.interactiveidle()}catch(e){}voicePlaying=false;return}
      if(!value.gateway)return
      if(gateway===value.gateway){
        fitSurfaces()
        if(value.command==='speak'){pending=value.text||'';if(ready&&avatar){const text=pending;pending='';avatar.speak(text,true,true)}}
        return
      }
      release();gateway=value.gateway;pending=value.text||''
      const current=generation
      const report=(state,message)=>{if(current===generation&&ownerRef)ownerRef.callMethod('runtimeEvent',{state,message,gateway:value.gateway})}
      const metrics={fps:0,average:0,droppedFrames:0,totalFrames:0,rtt:0,downlink:0,online:true}
      const telemetry=()=>{const now=Date.now();if(now-lastTelemetry<5000)return;lastTelemetry=now;report('telemetry',Object.assign({observedAt:now,playing:voicePlaying},metrics))}
      const fail=message=>{if(current!==generation)return;report('error',message);release()}
      const connected=()=>{
        if(current!==generation||ready)return
        ready=true;clearTimeout(timer);fitSurfaces();report('connected')
        if(pending){const text=pending;pending='';avatar.speak(text,true,true)}
      }
      report('connecting','正在连接数字人…')
      timer=setTimeout(()=>fail('数字人加载超时，请检查网络后重试'),120000)
      try{
        if(!window.XmovAvatar)await new Promise((resolve,reject)=>{
          const script=document.createElement('script');script.src=value.sdkUrl
          script.onload=resolve;script.onerror=()=>reject(new Error('星云资源加载失败'));document.head.appendChild(script)
        })
        if(current!==generation)return
        const headers=value.accessToken?{'X-Tour-Access':value.accessToken}:{Authorization:'Bearer '+value.token}
        fitSurfaces()
        avatar=new window.XmovAvatar({containerId:'#tour-xingyun-avatar',appId:'server-proxy',appSecret:'server-proxy',gatewayServer:value.gateway,headers,
          hardwareAcceleration:'prefer-hardware',enableLogger:false,
          onFPSUpdate:stats=>{metrics.fps=Number(stats.current)||0;metrics.average=Number(stats.average)||0;metrics.droppedFrames=Number(stats.droppedFrames)||0;metrics.totalFrames=Number(stats.totalFrames)||0;telemetry()},
          onNetworkInfo:info=>{metrics.rtt=Number(info.rtt)||0;metrics.downlink=Number(info.downlink)||0;metrics.online=info.networkStatus!==false;telemetry()},
          proxyWidget:{subtitle_on:()=>{},subtitle_off:()=>{},set_character_canvas_offset:()=>{}},
          onInitEvent:code=>{if(code===4000)connected()},
          onStateChange:state=>{if(state==='idle'||state==='interactive_idle')connected()},
          onVoiceStateChange:state=>{if(current!==generation)return;if(String(state).includes('start')&&!voicePlaying){voicePlaying=true;report('playing')}if(String(state).includes('end')&&voicePlaying){voicePlaying=false;report('ended')}},
          onMessage:error=>{if(current!==generation)return;if([50001,50002,50003,60001,60002].includes(error.code)){ready=false;report('reconnecting',error.message||'数字人连接正在恢复…');return}if(error.code&&error.code!==4000)fail(error.message||'数字人连接失败，请重试')},
        })
        let lastProgress=-1
        await avatar.init({onDownloadProgress:progress=>{const percent=Math.round(progress);if(!ready&&percent!==lastProgress){lastProgress=percent;report('progress','正在加载数字人 '+percent+'%')}},onClose:()=>{if(current===generation)fail('星云连接已断开，请重试')}})
        if(current===generation)fitSurfaces()
      }catch(e){if(current===generation)fail(e.message||'星云连接失败')}
    },
  },
  beforeUnmount(){release();if(framingStyle)framingStyle.remove();framingStyle=null},
}
</script>
<style scoped>
.xingyun-stage{position:absolute;inset:0;z-index:1;overflow:hidden;border-radius:24rpx;background:transparent;contain:layout paint}
#tour-xingyun-avatar{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;transform:none}
</style>
