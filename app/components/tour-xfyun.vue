<template>
  <view class="xfyun">
    <live-player v-if="stream" :src="stream" mode="RTC" :autoplay="true" :muted="false" object-fit="contain" @statechange="state" @error="failed" class="player" />
    <text>{{ $t(message) }}</text>
    <button v-if="!sessionId&&!busy" @tap="connect">{{ $t("连接讯飞数字人") }}</button>
    <button v-if="sessionId" @tap="close">{{ $t("断开数字人") }}</button>
  </view>
</template>
<script>
import { BASE_URL } from '../common/config.js'
export default {
  props: { tourId: Number },
  data() { return { sessionId: 0, stream: '', busy: false, message: '讯飞数字人尚未连接' } },
  methods: {
    api(path, data) {
      return new Promise((resolve, reject) => uni.request({ url: BASE_URL+'/miniprogram/xfyun'+path, method: 'POST', data,
        header: { 'Authorization': 'Bearer '+uni.getStorageSync('token'), 'X-Tour-Access': uni.getStorageSync('xingyun-tour-'+this.tourId)||'' },
        timeout: 35000,
        success: r => r.statusCode===200 ? resolve(r.data) : reject(new Error(r.data.detail||'讯飞请求失败')),
        fail: () => reject(new Error('无法连接服务器，请检查网络')) }))
    },
    async connect() {
      if(this.busy||this.sessionId)return
      this.busy=true; this.message='正在申请讯飞会话…'
      const version=this._version=(this._version||0)+1
      try {
        const result=await this.api('/sessions/'+this.tourId,{})
        if(version!==this._version){await this.api('/sessions/'+result.id+'/command',{action:'stop'});return}
        this.sessionId=result.id; this.stream=result.stream_url; this.message='会话已创建，正在拉流…'
        this._heartbeat=setInterval(()=>this.command('ping').catch(e=>{this.message=e.message;this.close(false)}),20000)
      } catch(e) {this.message=e.message} finally {this.busy=false}
    },
    command(action,text='') { return this.api('/sessions/'+this.sessionId+'/command',{action,text}) },
    async speak(text) {
      if(!this.sessionId)return false
      try {await this.command('speak',text);return true} catch(e){this.message=e.message;return false}
    },
    state(event) {if(event.detail.code===2004)this.message='讯飞视频流播放中';else if(event.detail.code<0){this.message='拉流失败（'+event.detail.code+'），请检查播放权限和域名';this.close(false)}},
    failed() {this.message='播放失败，请检查 live-player 权限与拉流域名';this.close(false)},
    async close(reset=true) {
      this._version=(this._version||0)+1;clearInterval(this._heartbeat)
      const id=this.sessionId;this.sessionId=0;this.stream=''
      if(id)try{await this.api('/sessions/'+id+'/command',{action:'stop'});if(reset)this.message='讯飞数字人已断开'}catch(e){this.message='关闭失败：'+e.message+'；云端将于心跳超时后释放'}
    },
  },
  beforeUnmount() {this.close()},
}
</script>
<style scoped>
.xfyun{margin:12rpx 20rpx;padding:16rpx;border-radius:20rpx;background:var(--ng-surface);font-size:24rpx}.player{width:100%;height:500rpx}.xfyun button{font-size:26rpx;margin-top:12rpx}
</style>
