<template>
  <view class="auth-page">
    <view class="ambient-field" aria-hidden="true"><view class="ambient-light light-a"></view><view class="ambient-light light-b"></view><view class="ambient-wave"></view><view class="glass-panel glass-one"></view><view class="glass-panel glass-two"></view><view class="glass-panel glass-three"></view><view class="flow-track track-one"><view class="flow-glow"></view></view><view class="flow-track track-two"><view class="flow-glow"></view></view><view class="flow-track track-three"><view class="flow-glow"></view></view><view class="light-bars"><view v-for="n in 7" :key="n" class="light-bar" :style="{animationDelay: (-n * 0.28) + 's'}"></view></view></view>
    <view class="auth-brand">
      <view class="logo">AI</view>
      <text class="brand-name">智游灵境</text>
      <text class="brand-subtitle">一园山水，一路故事</text>
    </view>
    <view class="guide-display">
      <view class="display-summary">
        <view class="summary-card"><text class="summary-title">AI</text><text class="summary-caption">智能导览</text></view>
        <view class="summary-card"><text class="summary-title">山水</text><text class="summary-caption">景区故事</text></view>
        <view class="summary-card"><text class="summary-title">同行</text><text class="summary-caption">探索灵境</text></view>
      </view>
      <view class="display-console">
        <view class="console-heading"><text>山水之间 · 智游相伴</text><view class="heading-light"></view></view>
        <view class="story-flow story-one"><text>听见故事</text><view class="story-shimmer"></view></view>
        <view class="story-flow story-two"><text>发现风景</text><view class="story-shimmer"></view></view>
        <view class="story-flow story-three"><text>一路同行</text><view class="story-shimmer"></view></view>
        <view class="console-bars" aria-hidden="true"><view v-for="n in 7" :key="n" class="console-bar" :style="{animationDelay: (-n * 0.28) + 's'}"></view></view>
      </view>
    </view>
    <view class="login-area">
      <button class="primary" :disabled="logining" @tap="beginLogin">{{ logining ? '正在登录…' : developmentLogin ? '开发测试登录' : '微信授权登录' }}</button>
      <text v-if="error && !showProfileDialog" class="error">{{ error }}</text>
      <text v-if="developmentLogin" class="notice">测试号模式 · 使用真实后端测试账号</text>
    </view>
    <view v-if="showProfileDialog" class="profile-overlay" @touchmove.stop.prevent="">
      <view class="profile-dialog">
      <text class="dialog-title">完善个人资料</text>
      <text class="dialog-description">请选择头像并填写昵称，用于“我的”页面</text>
      <form @submit="handleProfileLogin">
        <view class="profile-fields">
          <button class="avatar-picker" :disabled="logining" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image v-if="avatarPath" :src="avatarPath" class="profile-avatar" mode="aspectFill" />
            <text v-else>选择头像</text>
          </button>
          <input class="nickname-input" type="nickname" name="nickname" :value="nickname" placeholder="填写微信昵称" maxlength="40" />
        </view>
      <view class="dialog-actions">
      <button class="dialog-cancel" :disabled="logining" @tap="showProfileDialog=false">取消</button>
      <button class="primary dialog-confirm" form-type="submit" :disabled="logining">{{ logining ? '正在保存…' : '确定' }}</button>
      </view>
      </form>
      <text v-if="error" class="error">{{ error }}</text>
      </view>
    </view>
  </view>
</template>
<script>
import { BASE_URL, DEVELOPMENT_LOGIN, LOGIN_PROVIDER } from '../../common/config.js'
export default {
  data() { return {logining:false,error:'',developmentLogin:DEVELOPMENT_LOGIN,avatarPath:'',nickname:'',showProfileDialog:false} },
  onShow() { uni.setNavigationBarColor({frontColor:'#ffffff',backgroundColor:'#12172f',animation:{duration:0,timingFunc:'linear'}}) },
  onLoad() {
    if(uni.getStorageSync('login_provider')===LOGIN_PROVIDER && !uni.getStorageSync('login_auto_disabled')) {
      if(uni.getStorageSync('token'))this.restoreSession()
      else this.handleWxLogin()
    } else if(DEVELOPMENT_LOGIN)this.enterDevelopment()
  },
  methods: {
    networkError(e) {
      const message=e&&e.errMsg||''
      this.error=/domain|url not in domain/i.test(message) ? '连接被微信拦截，请配置服务器合法域名' : '无法连接导览服务，请稍后重试'
    },
    finishLogin(user) {
      if(user.user_id)uni.setStorageSync('user_id',user.user_id)
      uni.setStorageSync('username',user.username||'')
      uni.setStorageSync('avatar',user.avatar||'')
      uni.setStorageSync('login_provider',LOGIN_PROVIDER)
      uni.removeStorageSync('login_auto_disabled')
      this.logining=false
      this.showProfileDialog=false
      uni.reLaunch({url:'/pages/tour-guide/tour-guide',fail:e=>{this.logining=false;this.error='进入导览页面失败，请重新编译小程序后重试';console.error('Login navigation failed',e)}})
    },
    restoreSession() {
      this.logining=true;this.error=''
      uni.request({url:BASE_URL+'/user/me',header:{Authorization:'Bearer '+uni.getStorageSync('token')},timeout:15000,
        success:r=>{
          this.logining=false
          if(r.statusCode===401){uni.removeStorageSync('token');this.handleWxLogin();return}
          const d=r.data||{}
          if(r.statusCode!==200||!d.success||!d.data){this.error=d.detail||d.message||'登录状态验证失败';return}
          if(d.data.avatar)this.finishLogin(d.data)
          else this.openProfileDialog()
        },
        fail:e=>{this.logining=false;this.networkError(e)}})
    },
    enterDevelopment() {this.handleWxLogin()},
    beginLogin() {
      if(this.logining)return
      if(uni.getStorageSync('token')&&uni.getStorageSync('login_provider')===LOGIN_PROVIDER)this.restoreSession()
      else this.handleWxLogin()
    },
    openProfileDialog() {this.error='';this.showProfileDialog=true},
    onChooseAvatar(e) {
      const path=e.detail&&e.detail.avatarUrl
      if(path){this.avatarPath=path;this.error=''}
    },
    handleProfileLogin(e) {
      this.nickname=(e.detail.value.nickname||'').trim()
      if(!this.avatarPath||!this.nickname){this.error='请先选择头像并填写微信昵称';return}
      if(uni.getStorageSync('token'))this.saveProfile(uni.getStorageSync('token'))
      else this.handleWxLogin()
    },
    saveProfile(token) {
      this.logining=true
      uni.uploadFile({url:BASE_URL+'/user/profile',filePath:this.avatarPath,name:'avatar',header:{Authorization:'Bearer '+token},formData:{nickname:this.nickname},
        success:r=>{try{const d=JSON.parse(r.data);if(r.statusCode!==200||!d.success)throw new Error(d.message||'资料保存失败');this.finishLogin(d.data)}catch(e){this.error=e.message}},
        fail:e=>{this.networkError(e)},complete:()=>{this.logining=false}})
    },
    handleWxLogin() {
      if(this.logining)return
      if(DEVELOPMENT_LOGIN){let code=uni.getStorageSync('development_login_code');if(!code){code='dev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);uni.setStorageSync('development_login_code',code)}this.doLogin(code,'开发测试用户');return}
      this.logining=true;this.error=''
      let settled=false
      const settle=()=>{if(settled)return false;settled=true;clearTimeout(this._wxLoginTimer);this.logining=false;return true}
      this._wxLoginTimer=setTimeout(()=>{if(settle())this.error='微信登录超时，请检查网络；开发者工具请重新扫码登录后重试'},15000)
      try {
        uni.login({provider:'weixin',
          success:r=>{if(!settle())return;if(r.code)this.doLogin(r.code,'');else this.error='微信未返回登录凭证，请检查小程序 AppID'},
          fail:e=>{if(!settle())return;const message=e&&e.errMsg||'';this.error=/login|登录|ticket/i.test(message)?'微信登录失败，请在开发者工具重新扫码登录后重试':'微信授权失败，请检查小程序 AppID 和网络连接';console.error('Weixin login failed',e)}
        })
      } catch(e) {if(settle())this.error='微信登录无法启动，请重新扫码登录开发者工具后重试';console.error('Weixin login exception',e)}
    },
    doLogin(code,nickName) {
      if(this.logining)return;this.logining=true;this.error=''
      uni.request({url:BASE_URL+'/user/wx-login',method:'POST',data:{code},timeout:15000,
        success:r=>{
          const d=r.data||{}
          if(r.statusCode!==200||!d.success||!d.data||!d.data.access_token){this.logining=false;this.error=d.detail||d.message||'登录失败';return}
          uni.setStorageSync('token',d.data.access_token)
          uni.setStorageSync('user_id',d.data.user_id)
          uni.setStorageSync('login_provider',LOGIN_PROVIDER)
          if(d.data.profile_completed||DEVELOPMENT_LOGIN)this.finishLogin(d.data)
          else if(this.avatarPath&&this.nickname)this.saveProfile(d.data.access_token)
          else{this.logining=false;this.openProfileDialog()}
        },
        fail:e=>{this.logining=false;this.networkError(e)}})
    }
  }
}
</script>

<style scoped>
.profile-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:40rpx;box-sizing:border-box;background:rgba(0,0,0,.6)}
.profile-dialog{width:100%;max-width:640rpx;box-sizing:border-box;padding:36rpx 28rpx;border-radius:28rpx;background:#202942;box-shadow:0 24rpx 70rpx rgba(0,0,0,.3)}
.dialog-title{display:block;text-align:center;font-size:calc(32rpx + 3px);font-weight:600}.dialog-description{display:block;margin:18rpx 0 32rpx;font-size:calc(24rpx + 3px);line-height:1.6;color:#aeb9d6;text-align:center}
.dialog-actions{display:flex;gap:20rpx}.dialog-cancel{flex:1;margin:0;padding:0;height:calc(96rpx + 6px);line-height:calc(96rpx + 6px);border-radius:999rpx;background:rgba(255,255,255,.08);color:#fff;font-size:calc(28rpx + 3px)}.dialog-confirm{flex:1}.dialog-cancel::after{border:0}
.profile-fields{display:flex;align-items:center;gap:20rpx;margin-bottom:24rpx}
.avatar-picker{margin:0;padding:0;width:120rpx;height:120rpx;flex-shrink:0;border-radius:20rpx;background:rgba(255,255,255,.08);color:#fff;font-size:calc(22rpx + 3px);display:flex;align-items:center;justify-content:center}
.profile-avatar{width:100%;height:100%}.nickname-input{flex:1;min-width:0;height:96rpx;padding:0 20rpx;border-radius:20rpx;background:rgba(255,255,255,.08);color:#fff;font-size:calc(28rpx + 3px)}
.display-console{margin-top:16rpx}
.auth-page{position:relative;box-sizing:border-box;min-height:100vh;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:180rpx 40rpx calc(90rpx + env(safe-area-inset-bottom));background:#12172f;color:#f4f6ff}
.ambient-field{position:absolute;inset:0;pointer-events:none;overflow:hidden;background:radial-gradient(ellipse at 75% 55%,rgba(60,82,183,.32),transparent 70%)}
.ambient-light{position:absolute;width:160%;height:260rpx;left:-35%;background:linear-gradient(105deg,transparent,rgba(91,113,221,.12),transparent);animation:lightPass 9s ease-in-out infinite}.light-a{top:24%}.light-b{bottom:4%;animation-delay:-4s}
.ambient-wave{position:absolute;width:950rpx;height:950rpx;right:-640rpx;top:28%;border:1rpx solid rgba(115,138,255,.13);border-radius:50%;background:rgba(5,9,24,.24);animation:orbitDrift 14s ease-in-out infinite}
.glass-panel{position:absolute;height:132rpx;border:1rpx solid rgba(170,182,240,.14);border-radius:28rpx;background:linear-gradient(135deg,rgba(255,255,255,.055),rgba(111,131,223,.025));animation:glassDrift 12s ease-in-out infinite}
.glass-one{width:240rpx;left:-70rpx;top:24%;transform:rotate(-12deg)}.glass-two{width:270rpx;right:-90rpx;top:37%;animation-delay:-4s}.glass-three{width:380rpx;left:-150rpx;bottom:10%;animation-delay:-8s}
.flow-track{position:absolute;height:42rpx;border:1rpx solid rgba(151,168,237,.1);border-radius:18rpx;background:rgba(255,255,255,.025);overflow:hidden;transform:rotate(-10deg)}.track-one{width:380rpx;left:-90rpx;top:39%}.track-two{width:360rpx;right:-100rpx;bottom:27%}.track-three{width:420rpx;left:-80rpx;bottom:17%}
.flow-glow{position:absolute;top:0;bottom:0;width:110rpx;background:linear-gradient(90deg,transparent,rgba(106,135,255,.18),transparent);animation:flow 6s linear infinite}.track-two .flow-glow{animation-delay:-2s}.track-three .flow-glow{animation-delay:-4s}
.light-bars{position:absolute;right:48rpx;bottom:11%;display:flex;align-items:flex-end;gap:10rpx;height:78rpx;opacity:.48}.light-bar{width:9rpx;height:100%;border-radius:8rpx;background:linear-gradient(#7387ff,#45d3f6);transform-origin:bottom;animation:barWave 2.4s ease-in-out infinite}
.auth-brand{position:relative;z-index:1;display:flex;align-items:center;flex-direction:column;margin-bottom:56rpx;text-align:center}
.logo{width:calc(120rpx + 6px);height:calc(120rpx + 6px);line-height:calc(120rpx + 6px);text-align:center;background:linear-gradient(145deg,#5267ff,#7164e8);color:#fff;font-size:calc(52rpx + 3px);font-weight:700;border-radius:22rpx;margin-bottom:32rpx;box-shadow:0 16rpx 42rpx rgba(64,91,255,.25);transform:rotate(-3deg);animation:stoneBounce 2s ease-out both}
.brand-name{font-size:calc(44rpx + 3px);font-weight:600}.brand-subtitle{display:block;margin-top:18rpx;color:#aeb9d6;font-size:calc(28rpx + 3px);letter-spacing:2rpx}
.login-area{margin-top:84rpx;position:relative;z-index:2;width:100%;padding:0;background:none;border:0;border-radius:0;box-shadow:none;color:#f4f6ff}.primary{display:block;margin:0;height:calc(96rpx + 6px);line-height:calc(96rpx + 6px);padding:0;font-size:calc(32rpx + 3px);font-weight:600;border-radius:999rpx;background:linear-gradient(120deg,#405bff,#617aff);color:#fff;box-shadow:0 12rpx 28rpx rgba(64,91,255,.18)}.primary::after{border:0}.primary[disabled]{opacity:.6;color:#fff}.notice{display:block;text-align:center;margin-top:22rpx;font-size:calc(26rpx + 3px);line-height:1.7;color:#aeb9d6}.error{display:block;margin-top:18rpx;font-size:calc(24rpx + 3px);line-height:1.7;color:#b8354d}

.guide-display{position:relative;z-index:1;width:100%;box-sizing:border-box}
.display-summary{display:flex;gap:12rpx}.summary-card{flex:1;min-width:0;box-sizing:border-box;border:1rpx solid rgba(255,255,255,.12);border-radius:22rpx;padding:20rpx 18rpx;background:rgba(255,255,255,.045)}
.summary-title{display:block;text-align:center;font-size:calc(36rpx + 3px);font-weight:700;color:#91a3ff;line-height:1.2}.summary-caption{display:block;text-align:center;margin-top:10rpx;font-size:calc(22rpx + 3px);color:#aeb6cc}
.display-console{position:relative;height:calc(210rpx + 24px);padding:20rpx;box-sizing:border-box;border:1rpx solid rgba(255,255,255,.1);border-radius:24rpx;background:rgba(6,10,25,.4);overflow:hidden}
.console-heading{display:flex;justify-content:space-between;align-items:center;color:#aeb6cc;font-size:calc(22rpx + 3px)}.heading-light{width:54rpx;height:6rpx;border-radius:10rpx;background:linear-gradient(90deg,#5270ff,#54d8ff);animation:nodePulse 3s ease-in-out infinite}
.story-flow{position:absolute;height:calc(38rpx + 6px);line-height:calc(38rpx + 6px);box-sizing:border-box;padding:0 16rpx;border:1rpx solid rgba(255,255,255,.07);border-radius:14rpx;background:rgba(255,255,255,.045);color:#dfe4f5;font-size:calc(22rpx + 3px);overflow:hidden;animation:storyFloat 8s ease-in-out infinite}
.story-one{left:20rpx;top:calc(65rpx + 6px);width:58%}.story-two{right:20rpx;top:calc(112rpx + 12px);width:56%;animation-delay:-3s}.story-three{left:100rpx;top:calc(159rpx + 18px);width:52%;animation-delay:-5s}.story-shimmer{position:absolute;top:0;bottom:0;width:80rpx;background:linear-gradient(90deg,transparent,rgba(119,143,255,.16),transparent);animation:flow 5s linear infinite}.story-two .story-shimmer{animation-delay:-2s}.story-three .story-shimmer{animation-delay:-4s}
.console-bars{position:absolute;right:24rpx;bottom:22rpx;display:flex;align-items:flex-end;gap:6rpx;height:68rpx}.console-bar{width:7rpx;height:100%;border-radius:6rpx;background:linear-gradient(#6b84ff,#50d4ff);transform-origin:bottom;animation:barWave 2.4s ease-in-out infinite}
@keyframes storyFloat{0%,100%{transform:translateX(0)}50%{transform:translateX(12rpx)}}
@keyframes nodePulse{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes lightPass{0%,100%{transform:translateX(-8%) rotate(-18deg);opacity:.35}50%{transform:translateX(15%) rotate(-12deg);opacity:.8}}
@keyframes glassDrift{0%,100%{transform:translate(0,0)}50%{transform:translate(24rpx,-30rpx)}}
@keyframes orbitDrift{0%,100%{transform:translateY(0)}50%{transform:translateY(55rpx)}}
@keyframes flow{0%{left:-110rpx}100%{left:100%}}
@keyframes barWave{0%,100%{transform:scaleY(.3);opacity:.5}50%{transform:scaleY(1);opacity:1}}
@keyframes stoneBounce{0%{transform:rotate(-3deg) translateY(-300rpx);opacity:0}10%{transform:rotate(-3deg) translateY(0);opacity:1}15%{transform:rotate(-3deg) translateY(0) scaleY(.85) scaleX(1.1)}22%{transform:rotate(-3deg) translateY(-50rpx) scaleY(1) scaleX(1)}30%{transform:rotate(-3deg) translateY(0) scaleY(.9) scaleX(1.05)}36%{transform:rotate(-3deg) translateY(-18rpx) scaleY(1) scaleX(1)}42%{transform:rotate(-3deg) translateY(0) scaleY(.95) scaleX(1.02)}47%{transform:rotate(-3deg) translateY(-6rpx) scaleY(1) scaleX(1)}52%,100%{transform:rotate(-3deg) translateY(0)}}
</style>
