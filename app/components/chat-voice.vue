<template>
  <view class="voice-render" :payload="payload" :change:payload="voice.apply"><view id="ai-chat-voice-avatar"></view></view>
</template>
<script>
export default {
  props:{payload:{type:Object,default:()=>({})}},
  methods:{voiceEvent(event){this.$emit('state',event)}},
}
</script>
<script module="voice" lang="renderjs">
import {loadXingyunSdk,isRecoverableXingyunEvent} from '../common/xingyun-sdk.js'
let avatar=null,generation=0,timer=null,destroying=Promise.resolve()
function release(){generation++;clearTimeout(timer);const previous=avatar;avatar=null;const close=()=>{try{return Promise.resolve(previous&&previous.destroy()).catch(()=>{})}catch(e){return Promise.resolve()}};destroying=destroying.then(close,close);return destroying}
export default {
  methods:{
    async apply(value,old,owner){
      const closing=release()
      const current=generation
      await closing
      if(current!==generation||!value||!value.text)return
      const report=(state,message)=>{if(current===generation)owner.callMethod('voiceEvent',{state,message,id:value.id})}
      const fail=message=>{report('error',message);release()}
      timer=setTimeout(()=>fail('默认数字人连接超时，请稍后重试'),90000)
      try{
        await loadXingyunSdk()
        if(current!==generation)return
        let started=false
        const speak=()=>{if(current!==generation||started)return;started=true;clearTimeout(timer);avatar.speak(value.text,true,true)}
        avatar=new window.XmovAvatar({
          containerId:'#ai-chat-voice-avatar',appId:'server-proxy',appSecret:'server-proxy',
          gatewayServer:value.gateway,headers:{Authorization:'Bearer '+value.token},
          hardwareAcceleration:'prefer-hardware',audioOnlyMode:true,enableLogger:false,enableDebugger:false,
          proxyWidget:{subtitle_on:()=>{},subtitle_off:()=>{}},
          onInitEvent:code=>{if(code===4000)speak()},
          onStateChange:state=>{if(state==='idle'||state==='interactive_idle')speak()},
          onVoiceStateChange:state=>{if(String(state).includes('start'))report('playing');if(String(state).includes('end')){report('ended');release()}},
          onMessage:error=>{if(isRecoverableXingyunEvent(error))return;if(error.code&&error.code!==4000)fail(error.message||'默认数字人语音连接失败')},
        })
        await avatar.init({onDownloadProgress:()=>{},onClose:()=>{if(current===generation)fail('数字人语音连接已关闭')}})
      }catch(e){if(current===generation)fail(e.message||'默认数字人语音连接失败')}
    },
  },
  beforeUnmount(){release()},
}
</script>
<style scoped>
.voice-render{position:fixed;left:-2000px;top:0;width:240px;height:320px;pointer-events:none}
#ai-chat-voice-avatar{width:240px;height:320px}
</style>
