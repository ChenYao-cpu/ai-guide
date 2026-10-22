<template><view class="xingyun-stage" :payload="payload" :change:payload="runtime.apply"><view id="tour-xingyun-avatar"></view></view></template>
<script>
export default {props:{payload:{type:Object,default:()=>({})}},methods:{runtimeEvent(event){this.$emit('state',event)}}}
</script>
<script module="runtime" lang="renderjs">
import {loadXingyunSdk} from '../common/xingyun-sdk.js'
let avatar=null,generation=0,timer=null,ready=false,gateway='',pending='',ownerRef=null
function release(){generation++;clearTimeout(timer);ready=false;gateway='';pending='';const previous=avatar;avatar=null;try{return Promise.resolve(previous&&previous.destroy()).catch(()=>{})}catch(e){return Promise.resolve()}}
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
        if(value.command==='speak'){pending=value.text||'';if(ready&&avatar){const text=pending;pending='';avatar.interactiveidle();avatar.speak(text,true,true)}}
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
          hardwareAcceleration:'prefer-hardware',
          proxyWidget:{subtitle_on:()=>{},subtitle_off:()=>{}},
          onInitEvent:code=>{if(code===4000)connected()},
          onStateChange:state=>{if(state==='idle'||state==='interactive_idle')connected()},
          onVoiceStateChange:state=>{if(String(state).includes('start'))report('playing');if(String(state).includes('end'))report('ended')},
          onMessage:error=>{if(error.code&&error.code!==4000)fail((error.message||'星云服务连接失败')+'（错误码：'+error.code+'）')},
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
#tour-xingyun-avatar{width:100%;height:100%;transform:translateX(-10%)}
</style>
