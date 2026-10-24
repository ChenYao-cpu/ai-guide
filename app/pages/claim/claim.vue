<template>
  <view class="claim-page"><view class="claim-card">
    <text class="claim-title">领取电脑上的路线</text>
    <text class="claim-note">{{ scanned ? '正在接收你在电脑上选择的行程，登录后即可继续游览。' : '输入网页上的领取码，或扫描路线二维码。' }}</text>
    <input v-if="!scanned" v-model="code" class="claim-input" placeholder="输入12位领取码" maxlength="100" :disabled="busy" />
    <button v-if="!scanned" class="scan" :disabled="busy" @tap="scan">扫描路线二维码</button>
    <text v-if="error" class="claim-error">{{ error }}</text>
    <button class="claim-primary" :disabled="busy || !code.trim()" @tap="receive">{{ busy ? '正在领取…' : '领取路线' }}</button>
    <button class="cancel" :disabled="busy" @tap="leave">稍后领取</button>
  </view></view>
</template>
<script>
import { BASE_URL, SERVER_ORIGIN, setStationServerOrigin, isLocalStationOrigin } from '../../common/config.js'
import { pendingClaim, saveClaim, clearPendingClaim } from '../../common/station-claim.js'
export default {
  data() { return { code:'', origin:'', scanned:false, busy:false, error:'' } },
  onLoad() { const pending=pendingClaim(); if(pending) { this.code=pending.token; this.origin=pending.origin; this.scanned=!!pending.token } },
  onReady() { if(this.scanned) this.receive() },
  methods: {
    scan() {
      uni.scanCode({onlyFromCamera:true,success:result=>{
        try { const pending=saveClaim(result.result); this.code=pending.token; this.origin=pending.origin; this.scanned=true; this.error=''; this.receive() }
        catch(e) { this.error=e.message }
      },fail:()=>{this.error='扫码未完成，可以输入领取码'}})
    },
    async receive() {
      if(this.busy)return
      this.error=''
      const token=this.code.trim().replace(/\s/g,'')
      if(!/^[A-HJ-NP-Z2-9]{12}$/i.test(token)&&!/^[A-Za-z0-9_-]{32,100}$/.test(token)){this.error='领取码格式不正确';return}
      const origin=this.origin||SERVER_ORIGIN
      if(!isLocalStationOrigin(origin)){this.error='只允许连接局域网电脑的18000端口';return}
      if(origin!==SERVER_ORIGIN){
        const accepted=await new Promise(resolve=>uni.showModal({title:'连接服务电脑',content:'将连接 '+origin+'，需要重新登录。请确认这是你扫码的电脑。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
        if(!accepted)return
        setStationServerOrigin(origin)
      }
      saveClaim('zhiyouguide://claim?claim='+encodeURIComponent(token)+'&server='+encodeURIComponent(origin))
      if(!uni.getStorageSync('token')){uni.reLaunch({url:'/pages/auth/auth'});return}
      let receipt=uni.getStorageSync('station-app-receipt')
      if(!receipt){receipt=Array.from({length:48},()=>Math.floor(Math.random()*16).toString(16)).join('');uni.setStorageSync('station-app-receipt',receipt)}
      this.busy=true
      uni.request({url:BASE_URL+'/service-stations/claim/receive-app',method:'POST',data:{token,receipt},header:{Authorization:'Bearer '+uni.getStorageSync('token')},timeout:20000,
        success:r=>{
          if(r.statusCode===401){uni.removeStorageSync('token');uni.reLaunch({url:'/pages/auth/auth'});return}
          if(r.statusCode!==200||!r.data.session_id){this.error=typeof r.data.detail==='string'?r.data.detail:'领取失败，请重试';return}
          const sid=r.data.session_id
          if(r.data.avatar_access_token)uni.setStorageSync('xingyun-tour-'+sid,r.data.avatar_access_token)
          clearPendingClaim();uni.reLaunch({url:'/pages/tour/tour?sessionId='+sid})
        },fail:()=>{this.error='无法连接服务电脑，请确认在同一个 Wi-Fi 且后端已启动'},complete:()=>{this.busy=false}
      })
    },
    leave(){clearPendingClaim();uni.reLaunch({url:'/pages/tabs/tabs?tab=mine'})},
  },
}
</script>
<style scoped>
.claim-page{min-height:100vh;box-sizing:border-box;padding:32rpx 24rpx;background:#f8fafc;color:#1f2937}.claim-card{padding:36rpx 28rpx;background:#fff;border-radius:28rpx}.claim-title{display:block;font-size:38rpx;font-weight:700;text-align:center;margin-bottom:24rpx}.claim-note{display:block;font-size:26rpx;line-height:1.7;color:#64748b;overflow-wrap:anywhere;margin:20rpx 0}.claim-input{height:96rpx;padding:0 20rpx;border:1rpx solid #e2e8f0;border-radius:16rpx;font-size:30rpx;box-sizing:border-box}.server-input{font-size:24rpx}.claim-card button{margin-top:24rpx;min-height:88rpx;font-size:30rpx;border-radius:16rpx}.claim-primary{background:#4f46e5;color:#fff}.scan{background:#eef2ff;color:#4338ca}.cancel{background:#f8fafc;color:#64748b}.claim-error{display:block;margin-top:24rpx;color:#b42342;font-size:26rpx;line-height:1.5}
</style>
