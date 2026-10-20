<template>
  <view class="auth-page" :class="{ 'auth-english': tourLanguage === 'en' }">
    <view class="auth-language" role="group" :aria-label="t('界面语言')">
      <button :class="{ active: tourLanguage === 'zh' }" :aria-pressed="tourLanguage === 'zh'" @tap="setLanguage('zh')">中文</button>
      <button :class="{ active: tourLanguage === 'en' }" :aria-pressed="tourLanguage === 'en'" @tap="setLanguage('en')">English</button>
    </view>
    <view class="auth-brand"><BrandLogo stacked animated /></view>
    <view class="welcome-card">
      <text class="welcome-title">{{ t('让每一程，都有故事') }}</text>
    <view class="login-area">
      <view v-if="appLogin">
        <input v-if="registering" class="nickname-input" style="margin-bottom:20rpx" v-model="nickname" :placeholder="t('昵称（用于登录）')" maxlength="40" :disabled="logining" />
        <input class="nickname-input" v-model="account" :placeholder="t(registering ? '邮箱地址' : '昵称')" maxlength="254" :disabled="logining" />
        <input class="nickname-input" style="margin:20rpx 0" v-model="password" password :placeholder="t('密码')" :disabled="logining" />
        <input v-if="registering" class="nickname-input" style="margin:20rpx 0" v-model="confirmPassword" password :placeholder="t('再次输入密码（至少8位）')" :disabled="logining" />
        <view v-if="registering">
          <input class="nickname-input" v-model="emailCode" type="number" maxlength="6" :placeholder="t('邮箱验证码')" :disabled="logining" />
          <button class="dialog-cancel" style="margin:20rpx 0" :disabled="sendingCode || logining || codeRetryAt>0" @tap="sendEmailCode">{{ t(sendingCode ? '正在发送…' : codeRetryAt>0 ? '请稍后再发送' : '发送验证码') }}</button>
        </view>
      </view>
      <button class="primary" :disabled="logining" @tap="beginLogin">{{ t(logining ? '正在处理…' : appLogin ? (registering ? '注册并登录' : '登录') : developmentLogin ? '开发测试登录' : '微信授权登录') }}</button>
      <view v-if="appLogin" class="register-row" @tap="toggleRegistration">
        <text class="register-text">{{ t(registering ? '已有账号，去登录' : '没有账号？邮箱注册') }}</text>
      </view>
      <text v-if="appLogin && registering && codeNotice" class="notice">{{ t(codeNotice) }}</text>
      <text v-if="error && !showProfileDialog" class="error">{{ t(error) }}</text>
      <text v-if="developmentLogin" class="notice">{{ t('开发模式') }}</text>
    </view>
    </view>
    <view v-if="showProfileDialog" class="profile-overlay" @touchmove.stop.prevent="">
      <view class="profile-dialog">
      <text class="dialog-title">{{ t('完善个人资料') }}</text>

      <form @submit="handleProfileLogin">
        <view class="profile-fields">
          <button class="avatar-picker" :disabled="logining" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image v-if="avatarPath" :src="avatarPath" class="profile-avatar" mode="aspectFill" />
            <text v-else>{{ t('选择头像') }}</text>
          </button>
          <input class="nickname-input" type="nickname" name="nickname" :value="nickname" :placeholder="t('填写微信昵称')" maxlength="40" />
        </view>
      <view class="dialog-actions">
      <button class="dialog-cancel" :disabled="logining" @tap="showProfileDialog=false">{{ t('取消') }}</button>
      <button class="primary dialog-confirm" form-type="submit" :disabled="logining">{{ t(logining ? '正在保存…' : '确定') }}</button>
      </view>
      </form>
      <text v-if="error" class="error">{{ t(error) }}</text>
      </view>
    </view>
  </view>
</template>
<script>
import { LANGUAGE_STORAGE_KEY, translateTour } from '../../common/tour-language.js'
import BrandLogo from '../../components/BrandLogo.vue'
import { BASE_URL, DEVELOPMENT_LOGIN, LOGIN_PROVIDER, APP_LOGIN } from '../../common/config.js'
export default {
  components: { BrandLogo },
  data() { return {appLogin:APP_LOGIN,emailCode:'',sendingCode:false,codeRetryAt:0,codeNotice:'',registering:false,confirmPassword:'',account:'',password:'',logining:false,error:'',developmentLogin:DEVELOPMENT_LOGIN,avatarPath:'',nickname:'',showProfileDialog:false} },
  onShow() { this.tourLanguage=uni.getStorageSync(LANGUAGE_STORAGE_KEY)==='en'?'en':'zh'; uni.setNavigationBarColor({frontColor:'#000000',backgroundColor:'#f8fafc',animation:{duration:0,timingFunc:'linear'}}) },
  onUnload() { clearTimeout(this._emailCodeTimer);clearTimeout(this._wxLoginTimer) },
  onLoad() {
    if(uni.getStorageSync('login_auto_disabled')) return
    // 登录一次即长期免登录：本地有 token 就直接恢复会话。
    if(uni.getStorageSync('token')) { this.restoreSession(); return }
    if(uni.getStorageSync('login_provider')===LOGIN_PROVIDER) { this.handleWxLogin() }
    else if(DEVELOPMENT_LOGIN) this.enterDevelopment()
  },
  methods: {
    t(value) { return translateTour(value, this.tourLanguage) },
    setLanguage(language) { this.tourLanguage=language;uni.setStorageSync(LANGUAGE_STORAGE_KEY,language) },
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
          if(r.statusCode===401){uni.removeStorageSync('token');if(!APP_LOGIN)this.handleWxLogin();else this.error='登录已过期，请重新输入账号密码';return}
          const d=r.data||{}
          if(r.statusCode!==200||!d.success||!d.data){this.error=d.detail||d.message||'登录状态验证失败';return}
          if(d.data.avatar||DEVELOPMENT_LOGIN||APP_LOGIN)this.finishLogin(d.data)
          else this.openProfileDialog()
        },
        fail:e=>{this.logining=false;this.networkError(e)}})
    },
    enterDevelopment() {this.handleWxLogin()},
    beginLogin() {
      if(this.logining)return
      if(APP_LOGIN){if(this.registering)this.registerWithEmail();else this.loginWithPassword();return}
      if(uni.getStorageSync('token')&&uni.getStorageSync('login_provider')===LOGIN_PROVIDER)this.restoreSession()
      else this.handleWxLogin()
    },
    toggleRegistration() {
      this.registering=!this.registering;this.error='';this.password='';this.confirmPassword='';this.emailCode=''
    },
    sendEmailCode() {
      if(this.sendingCode)return
      if(Date.now()<this.codeRetryAt){this.error='请等待60秒后再发送验证码';return}
      const email=this.account.trim().toLowerCase()
      if(!email){this.error='请先填写注册邮箱';return}
      this.sendingCode=true;this.error='';this.codeNotice=''
      uni.request({url:BASE_URL+'/user/email-code',method:'POST',data:{email},timeout:25000,
        success:r=>{
          const d=r.data||{}
          if(r.statusCode!==200||!d.success){this.error=typeof d.detail==='string'?d.detail:'验证码发送失败';return}
          this.codeNotice=d.message;this.codeRetryAt=Date.now()+(d.retry_after||60)*1000
          clearTimeout(this._emailCodeTimer)
          this._emailCodeTimer=setTimeout(()=>{this.codeRetryAt=0},(d.retry_after||60)*1000)
        },fail:e=>this.networkError(e),complete:()=>{this.sendingCode=false}})
    },
    registerWithEmail() {
      const email=this.account.trim().toLowerCase()
      const nickname=this.nickname.trim()
      if(!nickname||nickname.includes('@')){this.error='请填写昵称，不能包含 @';return}
      if(!email||!this.password){this.error='请输入邮箱和密码';return}
      if(this.password.length<8){this.error='密码至少8位';return}
      if(this.password!==this.confirmPassword){this.error='两次输入的密码不一致';return}
      if(!/^\d{6}$/.test(this.emailCode)){this.error='请输入6位邮箱验证码';return}
      this.logining=true;this.error=''
      uni.request({url:BASE_URL+'/user/register',method:'POST',data:{email,nickname,password:this.password,code:this.emailCode},timeout:15000,
        success:r=>{
          this.logining=false
          const d=r.data||{}
          if(r.statusCode!==200||!d.success){this.error=typeof d.detail==='string'?d.detail:'注册失败，请稍后重试';return}
          this.account=nickname;this.registering=false;this.confirmPassword=''
          this.loginWithPassword()
        },
        fail:e=>{this.logining=false;this.networkError(e)}})
    },
    loginWithPassword() {
      const username=this.account.trim()
      if(!username||!this.password){this.error='请输入账号和密码';return}
      this.logining=true;this.error=''
      uni.request({url:BASE_URL+'/user/login',method:'POST',
        header:{'Content-Type':'application/x-www-form-urlencoded'},
        data:'username='+encodeURIComponent(username)+'&password='+encodeURIComponent(this.password),timeout:15000,
        success:r=>{
          const d=r.data||{}
          if(r.statusCode!==200||!d.access_token){this.logining=false;this.error=r.statusCode===401?'账号或密码错误':typeof d.detail==='string'?d.detail:'登录失败，请稍后重试';return}
          uni.setStorageSync('token',d.access_token)
          uni.setStorageSync('login_provider',LOGIN_PROVIDER)
          this.password=''
          this.restoreSession()
        },
        fail:e=>{this.logining=false;this.networkError(e)}})
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
      if(APP_LOGIN)return
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
.auth-page{box-sizing:border-box;min-height:100vh;padding:calc(110rpx + env(safe-area-inset-top)) 36rpx calc(48rpx + env(safe-area-inset-bottom));background:#f8fafc;color:#1f2937}
.auth-brand{display:flex;flex-direction:column;align-items:flex-start;gap:18rpx;margin-bottom:44rpx}.auth-eyebrow{font-size:24rpx;color:#64748b;letter-spacing:2rpx}
.welcome-card{position:relative;overflow:hidden;padding:40rpx 32rpx 28rpx;border:1rpx solid #e2e8f0;border-radius:32rpx;background:#fff;box-shadow:0 20rpx 64rpx -24rpx rgba(30,41,59,.12)}
.welcome-label{display:block;color:#4338ca;font-size:24rpx;margin-bottom:20rpx}.welcome-title{display:block;font-size:48rpx;line-height:1.45;font-weight:700;letter-spacing:-1rpx}.welcome-accent{display:block;color:#4f46e5}.welcome-copy{display:block;margin-top:20rpx;font-size:27rpx;line-height:1.8;color:#64748b}
.register-row{display:flex;justify-content:center;margin-top:32rpx}
.register-text{font-size:24rpx;line-height:1.6;color:#64748b;text-decoration:underline;text-underline-offset:8rpx;text-decoration-thickness:1rpx}
.login-area{margin-top:36rpx;padding:32rpx;border:1rpx solid #e2e8f0;border-radius:32rpx;background:#fff;box-shadow:0 16rpx 48rpx -24rpx rgba(30,41,59,.1)}.login-heading{display:block;font-size:32rpx;font-weight:600}.login-copy{display:block;font-size:25rpx;color:#64748b;margin:12rpx 0 28rpx}
.primary{margin:0;padding:0;height:96rpx;line-height:96rpx;border-radius:20rpx;font-size:30rpx;font-weight:600;background:#4f46e5;color:#fff;box-shadow:0 12rpx 30rpx -12rpx rgba(79,70,229,.4)}.primary::after{border:0}.primary[disabled]{background:#e2e8f0;color:#64748b;box-shadow:none}.error{display:block;margin-top:20rpx;padding:20rpx;border-radius:16rpx;background:#fff1f2;color:#be123c;font-size:24rpx;line-height:1.7;word-break:break-all}.notice{display:block;margin-top:18rpx;font-size:24rpx;color:#64748b;text-align:center}
.profile-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:36rpx;background:rgba(15,23,42,.35)}.profile-dialog{width:100%;max-width:640rpx;box-sizing:border-box;padding:36rpx 28rpx;border:1rpx solid #e2e8f0;border-radius:32rpx;background:#fff;box-shadow:0 32rpx 80rpx rgba(30,41,59,.15)}.dialog-title{display:block;font-size:34rpx;font-weight:600;margin-bottom:32rpx}.profile-fields{display:flex;align-items:center;gap:20rpx;margin-bottom:28rpx}.avatar-picker{margin:0;padding:0;width:120rpx;height:120rpx;border-radius:24rpx;background:#eef2ff;color:#4338ca;font-size:23rpx;display:flex;align-items:center;justify-content:center;flex-shrink:0}.profile-avatar{width:100%;height:100%}.nickname-input{flex:1;min-width:0;height:96rpx;padding:0 20rpx;border:1rpx solid #e2e8f0;border-radius:20rpx;background:#f8fafc;color:#1f2937;font-size:28rpx}.dialog-actions{display:flex;gap:20rpx}.dialog-actions button{flex:1}.dialog-cancel{margin:0;padding:0;height:96rpx;line-height:96rpx;border-radius:20rpx;background:#f1f5f9;color:#475569;font-size:28rpx}.dialog-cancel::after{border:0}

.auth-brand{align-items:center;}
/* Keep the selected lavender page composition; only the icon moves. */
.auth-page{padding-top:calc(140rpx + env(safe-area-inset-top));background:linear-gradient(135deg,#e5dcff 0%,#f8f9ff 52%,#dff4fb 100%)!important;}
.auth-brand{margin-bottom:48rpx;gap:12rpx;}.auth-eyebrow{font-size:22rpx;color:#8b84ac;letter-spacing:4rpx;}
.welcome-card{border:0;border-radius:36rpx;padding:32rpx;background:rgba(255,255,255,.92);box-shadow:0 20rpx 60rpx -24rpx rgba(70,54,130,.12);}
.welcome-label{font-size:23rpx;color:#8b74c9;margin-bottom:14rpx;display:block;text-align:center;}.welcome-title{font-size:36rpx;color:#30285e;line-height:1.5;display:block;text-align:center;}.welcome-copy{font-size:25rpx;margin-top:14rpx;color:#8a84a0;display:block;text-align:center;}
.register-row{margin-top:26rpx;}
.register-text{color:#8b84a3;font-size:23rpx;letter-spacing:.5rpx;}
.login-area{margin-top:26rpx;padding:0;border:0;box-shadow:none;background:transparent;}.primary{border-radius:22rpx;}
.auth-page{position:relative;}
.auth-language{position:absolute;right:36rpx;top:calc(32rpx + env(safe-area-inset-top));display:flex;padding:6rpx;border:1rpx solid rgba(139,116,201,.2);border-radius:40rpx;background:rgba(255,255,255,.75);}
.auth-language button{margin:0;padding:0 24rpx;height:60rpx;line-height:60rpx;border-radius:32rpx;background:transparent;color:#79718f;font-size:24rpx;}
.auth-language button::after{border:0;}.auth-language button.active{background:#6c4ce4;color:#fff;box-shadow:0 4rpx 14rpx rgba(108,76,228,.2);}
.auth-english .auth-eyebrow{letter-spacing:1rpx;}.auth-english .welcome-title{font-size:36rpx;letter-spacing:0;}.auth-english .register-text{font-size:22rpx;letter-spacing:0;}
</style>
