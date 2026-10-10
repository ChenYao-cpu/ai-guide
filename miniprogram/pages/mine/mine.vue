<template>
  <view class="page aurora-page">
    <view class="aurora-background" aria-hidden="true"><view class="aurora-wave aurora-wave-one"></view><view class="aurora-wave aurora-wave-two"></view><view class="aurora-shine"></view></view>

    <view class="ink-bg">
      <view class="ink-mountain ink-mt-1"></view>
      <view class="ink-mountain ink-mt-2"></view>
    </view>

    <!-- 自定义导航栏（毛体标题） -->
    <view class="nav" :style="{paddingTop:statusH+'px'}">
      <text class="nav-title">我的</text>
    </view>

    <!-- 头像卡片 -->
    <view class="profile-card">
      <view class="pc-avatar-wrap">
        <image v-if="avatarUrl" :src="avatarUrl" class="pc-avatar" mode="aspectFill"></image>
        <view v-else class="pc-avatar-df">
          <text class="pca-txt">{{ avatarText }}</text>
        </view>
      </view>
      <view class="pc-name-row">
        <text class="pc-name">{{ username || '游客' }}</text>
      </view>
      <text class="pc-id">ID: {{ userId }}</text>
    </view>

    <!-- 菜单 -->
    <view class="menu-section">
      <view class="menu-group">
        <view class="menu-item" @tap="goHistory">
          <view class="mi-left"><text class="mi-icon iconfont icon-liulanjilu"></text><text class="mi-label">游览记录</text></view>
          <text class="mi-arrow">›</text>
        </view>

      </view>
      <view class="menu-group">
        <view class="menu-item" @tap="showPrefs=true">
          <view class="mi-left"><text class="mi-icon iconfont icon-pianhao"></text><text class="mi-label">偏好设置</text></view>
          <text class="mi-arrow">›</text>
        </view>
        <view class="menu-item" @tap="showAbout=true">
          <view class="mi-left"><text class="mi-icon iconfont icon-guanyuwomen"></text><text class="mi-label">关于我们</text></view>
          <text class="mi-arrow">›</text>
        </view>
      </view>
      <view class="menu-group">
        <view class="menu-item logout-item" @tap="handleLogout">
          <view class="mi-left"><text class="mi-icon iconfont icon-tuichu" style="color:var(--ng-secondary);"></text><text class="mi-label" style="color:var(--ng-secondary);">退出登录</text></view>
          <text class="mi-arrow" style="color:var(--ng-secondary);">›</text>
        </view>
      </view>
    </view>

    <!-- 偏好设置抽屉 -->
    <view class="drawer-overlay" v-if="showPrefs" @tap="showPrefs=false">
      <view class="drawer-mask"></view>
      <view class="drawer-panel" @tap.stop="">
        <view class="dp-handle"></view>
        <view class="dp-hd"><text class="dp-title">偏好设置</text><text class="dp-close" @tap="showPrefs=false">✕</text></view>
        <scroll-view scroll-y class="dp-content prefs-scroll">
          <view class="pref-item" v-for="p in preferenceOptions" :key="p.value">
            <text class="pref-label">{{ p.label }}</text>
            <text class="pref-desc">{{ p.desc }}</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 关于我们抽屉 -->
    <view class="drawer-overlay" v-if="showAbout" @tap="showAbout=false">
      <view class="drawer-mask"></view>
      <view class="drawer-panel" @tap.stop="">
        <view class="dp-handle"></view>
        <view class="dp-hd"><text class="dp-title">关于我们</text><text class="dp-close" @tap="showAbout=false">✕</text></view>
        <view class="dp-content about-content">
          <text class="about-intro">景区数字人导览与路线规划。</text>
          <text class="about-credit">西南民族大学 · 李英玲 · 苗加纯 刘梓轩 陈瑶</text>
        </view>
      </view>
    </view>

    <NocturneConfirm v-if="showLogout" title="退出登录" content="确定要退出登录吗？" @cancel="showLogout=false" @confirm="confirmLogout" />

    <view class="tb-root"><view class="tb-ink-line"></view><view class="tb-inner"><view class="tb-item highlight" @tap="goTab('/pages/tour-guide/tour-guide')"><view class="tb-hl-ring"><text class="tb-icon iconfont icon-daolan"></text></view><text class="tb-label">智能导览</text></view><view class="tb-item highlight" @tap="goTab('/pages/ai-chat/ai-chat')"><view class="tb-hl-ring"><text class="tb-icon iconfont icon-aishuziren"></text></view><text class="tb-label">AI小导游</text></view><view class="tb-item on"><view class="tb-hl-ring"><text class="tb-icon iconfont icon-wode1"></text></view><text class="tb-label">我的</text><view class="tb-dot"></view></view></view><view class="tb-safe"></view></view>
  </view>
</template>

<script>
import NocturneConfirm from '../../components/NocturneConfirm.vue'
import { BASE_URL, assetUrl } from '../../common/config.js'
export default {
  components: {NocturneConfirm},
  data: function () {
    return {
      username: '', userId: '', avatarUrl: '', statusH: 20,
      showPrefs: false, showAbout: false, showLogout: false,
      preferenceOptions: [
        { value:'history', label:'历史文化', desc:'优先了解典故与历史脉络' },
        { value:'nature', label:'自然风光', desc:'侧重山水景观与生态故事' },
        { value:'photography', label:'拍照打卡', desc:'推荐构图视角与拍摄点位' },
        { value:'family', label:'亲子游览', desc:'提供更轻松易懂的讲解' },
        { value:'comprehensive', label:'综合游览', desc:'均衡介绍特色与服务信息' },
      ],
    }
  },
  computed: {
    avatarText: function () { return this.username ? this.username[0] : '游' },
  },
  methods: {
    goTab:function(p){uni.reLaunch({url:p})},
    goHistory:function(){uni.navigateTo({url:'/pages/mine/history'})},
    handleLogout: function () { this.showLogout=true },
    confirmLogout: function () {
      this.showLogout=false
      uni.setStorageSync('login_auto_disabled',true)
      uni.removeStorageSync('token')
      uni.removeStorageSync('avatar')
      uni.removeStorageSync('login_provider')
      uni.removeStorageSync('user_id')
      uni.removeStorageSync('username')
      uni.removeStorageSync('wx_nickName')
      uni.removeStorageSync('wx_avatarUrl')
      uni.removeStorageSync('login_time')
      uni.reLaunch({ url: '/pages/auth/auth' })
    },
  },
  mounted:function(){
    this.statusH=(uni.getSystemInfoSync().statusBarHeight||20)+6
  },
  onHide:function(){this.showPrefs=false;this.showAbout=false;this.showLogout=false},
  onShow: function () {
    this.showPrefs=false
    this.showAbout=false
    var token = uni.getStorageSync('token')
    if (!token) { uni.reLaunch({ url: '/pages/auth/auth' }); return }
    uni.request({url:BASE_URL+'/user/me',header:{Authorization:'Bearer '+token},
      success:r=>{
        const d=r.data||{}
        if(r.statusCode===401){uni.removeStorageSync('token');uni.reLaunch({url:'/pages/auth/auth'});return}
        if(r.statusCode!==200||!d.success||!d.data){uni.showToast({title:'个人资料加载失败',icon:'none'});return}
        this.username=d.data.username||''
        this.userId=d.data.user_id
        this.avatarUrl=assetUrl(d.data.avatar||'')
        uni.setStorageSync('username',this.username)
        uni.setStorageSync('avatar',d.data.avatar||'')
      },fail:()=>{uni.showToast({title:'个人资料加载失败，请检查网络',icon:'none'})}})
  },
}
</script>

<style scoped>
.page.aurora-page .profile-card{background:transparent;border:0;box-shadow:none}
.page { min-height:100vh; background-color:var(--ng-surface); position:relative; overflow:hidden; padding-bottom:140rpx; }
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.ink-bg { position:absolute; inset:0; pointer-events:none; z-index:0; overflow:hidden; }
.ink-mountain { position:absolute; left:0; right:0; background:var(--ng-night); border-radius:50% 70% 0 0; }
.ink-mt-1 { bottom:20%; height:200rpx; opacity:0.03; transform:scaleX(1.4); }
.ink-mt-2 { bottom:25%; height:150rpx; opacity:0.025; transform:scaleX(1.2) translateX(10%); }
/* 毛体导航 */
.nav{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;padding:16rpx 24rpx;background:var(--ng-surface)}
.nav-title{font-size:44rpx;font-weight:900;color:var(--ng-text);letter-spacing:8rpx;font-family:var(--app-font-family);text-align:center}

/* 头像卡片 */
.profile-card { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; padding:40rpx 32rpx 32rpx; }
.pc-avatar-wrap{position:relative;width:120rpx;height:120rpx}
.pc-avatar { width:120rpx;height:120rpx;border-radius:50%;border:3rpx solid rgba(99,102,241,0.25); }
.pc-avatar-df { width:120rpx;height:120rpx;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));display:flex;align-items:center;justify-content:center; }
.pca-txt { font-size:52rpx;font-weight:600;color:var(--ng-text);font-family:var(--app-font-family); }
.pc-name-row{margin-top:20rpx}
.pc-name { font-size:36rpx; font-weight:800; color:var(--ng-text); }
.pc-id { font-size:22rpx; color:var(--ng-secondary); margin-top:8rpx; }
.menu-section { position:relative; z-index:1; padding:0 28rpx; }
.menu-group { margin-bottom:16rpx; border-radius:16rpx; overflow:hidden; background:var(--ng-surface); border:1rpx solid var(--ng-border); }
.menu-item { display:flex; align-items:center; justify-content:space-between; padding:28rpx 24rpx; border-bottom:1rpx solid var(--ng-border); }
.menu-item:last-child { border-bottom:0; }
.mi-left { display:flex; align-items:center; gap:16rpx; }
.mi-icon { font-size:32rpx; }
.mi-label { font-size:28rpx; font-weight:600; color:var(--ng-text); }
.mi-arrow { font-size:32rpx; color:var(--ng-secondary); }
.logout-item:active { background:rgba(228,155,168,0.04); }
.footer-tag { position:relative; z-index:1; text-align:center; padding:40rpx 0 20rpx; }
.footer-tag text { font-size:20rpx; color:var(--ng-secondary); letter-spacing:2rpx; }

.tb-root{position:fixed;bottom:0;left:0;right:0;z-index:999;background:var(--ng-surface)}
.tb-ink-line{height:1rpx;background:linear-gradient(90deg,transparent,rgba(99,102,241,0.12),transparent);margin:0 32rpx}
.tb-inner{display:flex;align-items:center;justify-content:space-around;padding:4rpx 8rpx}
.tb-item{display:flex;flex-direction:column;align-items:center;gap:4rpx;padding:2rpx 10rpx;position:relative;flex:1}
.tb-icon{font-size:38rpx}.tb-label{font-size:20rpx;font-weight:600;color:var(--ng-secondary)}
.tb-dot{position:absolute;bottom:-4rpx;width:24rpx;height:4rpx;border-radius:2rpx;background:rgba(99,102,241,0.18);opacity:.6}
.tb-item.on .tb-label{color:var(--ng-secondary);font-weight:600}.tb-item.on .tb-icon{transform:scale(1.1)}
.tb-hl-ring{width:68rpx;height:68rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.18);border:2rpx solid rgba(99,102,241,0.25);margin-bottom:-2rpx}
.tb-hl-ring.on{background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));border-color:transparent;box-shadow:0 6rpx 18rpx rgba(99,102,241,0.15);animation:tabBounce .4s ease-out}
.tb-hl-ring .tb-icon{font-size:34rpx}.tb-safe{height:env(safe-area-inset-bottom,10rpx);min-height:2rpx}
@keyframes tabBounce{0%{transform:scale(1)}30%{transform:scale(1.15)}60%{transform:scale(.95)}100%{transform:scale(1)}}

/* 抽屉（复用tour-guide风格） */
.drawer-overlay{position:fixed;top:0;bottom:0;left:0;right:0;z-index:1000}
.drawer-mask{position:absolute;inset:0;background:rgba(30,41,59,0.28)}
.drawer-panel{position:absolute;bottom:0;left:0;right:0;max-height:80vh;background:var(--ng-surface);border-radius:28rpx 28rpx 0 0;overflow:hidden;padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}
.dp-handle{width:56rpx;height:5rpx;border-radius:3rpx;background:rgba(99,102,241,0.12);margin:14rpx auto 8rpx}
.dp-hd{display:flex;justify-content:space-between;padding:8rpx 32rpx 14rpx}
.dp-title{font-size:30rpx;font-weight:600;color:var(--ng-text)}
.dp-close{font-size:32rpx;color:var(--ng-secondary)}
.dp-content{padding:0 32rpx 32rpx;box-sizing:border-box}.prefs-scroll{height:55vh;width:100%}

/* 偏好设置项 */
.pref-item{padding:18rpx 0;border-bottom:1rpx solid var(--ng-border)}
.pref-item:last-child{border-bottom:0}
.pref-label{display:block;font-size:28rpx;font-weight:700;color:var(--ng-text);margin-bottom:6rpx}
.pref-desc{display:block;font-size:22rpx;color:var(--ng-secondary)}

/* 关于我们 */
.about-content{display:flex;flex-direction:column}
.about-intro{font-size:24rpx;color:var(--ng-text);line-height:1.8;display:block;margin-bottom:20rpx}
.about-credit{font-size:20rpx;color:var(--ng-secondary);display:block;text-align:right}
.about-row{display:flex;padding:20rpx 0;border-bottom:1rpx solid var(--ng-border)}
.about-row text:first-child{font-size:22rpx;color:var(--ng-secondary);width:80rpx;flex-shrink:0}
.about-row text:last-child{font-size:22rpx;color:var(--ng-text)}
</style>
