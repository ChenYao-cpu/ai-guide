<template><view class="voice-render" :payload="payload" :change:payload="voice.apply"><view id="ai-chat-voice-avatar"></view></view></template>
<script>
// 只使用星云数字人的声音：容器放到屏幕外，不渲染可见人物。
export default {props:{payload:{type:Object,default:()=>({})}},methods:{runtimeEvent(event){this.$emit('state',event)}}}
</script>
<script module="voice" lang="renderjs">
import {loadXingyunSdk} from '../common/xingyun-sdk.js'
let avatar=null,generation=0,timer=null,ready=false,gateway='',pending='',language='',ownerRef=null
function release(){generation++;clearTimeout(timer);ready=false;gateway='';language='';pending='';const previous=avatar;avatar=null;try{return Promise.resolve(previous&&previous.destroy()).catch(()=>{})}catch(e){return Promise.resolve()}}
export default {
  methods:{
    async apply(value,old,owner){
      ownerRef=owner
      if(!value||value.command==='close'){
        const closing=release(),current=generation
        await closing
        const container=document.getElementById('ai-chat-voice-avatar')
        if(current===generation&&container)container.innerHTML=''
        if(owner)owner.callMethod('runtimeEvent',{state:'closed',id:value&&value.id,gateway:value&&value.gateway})
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
      gateway=value.gateway;language=value.language||'zh';pending=value.text||''
      const current=generation
      const report=(state,message)=>{if(current===generation&&ownerRef){if(state==='error')console.error('[ai-chat-voice]',message);ownerRef.callMethod('runtimeEvent',{state,message,gateway:value.gateway,id:value.id})}}
      const fail=message=>{if(current!==generation)return;report('error',message);release()}
      const connected=()=>{
        if(current!==generation||ready)return
        ready=true;clearTimeout(timer);report('connected')
        if(pending){const text=pending;pending='';try{avatar.interactiveidle();avatar.speak(text,true,true)}catch(e){}}
      }
      report('connecting')
      timer=setTimeout(()=>fail('星云语音连接超时，请检查网络后重试'),60000)
      try{
        await loadXingyunSdk()
        if(current!==generation)return
        const headers={Authorization:'Bearer '+(value.token||'')}
        avatar=new window.XmovAvatar({containerId:'#ai-chat-voice-avatar',appId:'server-proxy',appSecret:'server-proxy',gatewayServer:value.gateway,headers,
          hardwareAcceleration:'prefer-hardware',
          proxyWidget:{subtitle_on:()=>{},subtitle_off:()=>{}},
          onInitEvent:code=>{if(code===4000)connected()},
          onStateChange:state=>{if(state==='idle'||state==='interactive_idle')connected()},
          onVoiceStateChange:state=>{if(String(state).includes('start'))report('playing');if(String(state).includes('end'))report('ended')},
          onMessage:error=>{if(error.code&&error.code!==4000)fail((error.message||'星云语音服务连接失败')+'（错误码：'+error.code+'）')},
        })
        await avatar.init({onDownloadProgress:()=>{},onClose:()=>{if(current===generation)fail('星云语音连接已断开')}})
      }catch(e){if(current===generation)fail(e.message||'星云语音连接失败')}
    },
  },
  beforeUnmount(){release()},
}
</script>
<style scoped>
/* App.vue 会给 .aurora-page 的直接子 view 统一加 position:relative，这里必须用 !important 保住屏幕外容器，
   否则语音容器会进入文档流、把对话区挤成 0 高（表现为输入框跑到屏幕中间、下方大片空白）。 */
.voice-render{position:fixed!important;left:-3000px;top:0;width:360px;height:640px;overflow:hidden;pointer-events:none;opacity:0}
#ai-chat-voice-avatar{width:360px;height:640px}
</style>
