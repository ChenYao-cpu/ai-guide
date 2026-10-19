<template>
  <view class="page aurora-page" :class="tabEnterClass">
    <!-- #ifdef APP-PLUS -->
    <view class="app-status-bar-shield" aria-hidden="true"></view>
    <!-- #endif -->
    <view class="aurora-background" aria-hidden="true"><view class="aurora-wave aurora-wave-one"></view><view class="aurora-wave aurora-wave-two"></view><view class="aurora-shine"></view></view>

    <view class="ink-bg">
      <view class="ink-mountain ink-mt-1"></view>
      <view class="ink-mountain ink-mt-2"></view>
    </view>

    <!-- 自定义导航栏（毛体标题） -->
    <view class="nav" :style="{paddingTop:statusH+'px'}">
    </view>

    <!-- 头像卡片 -->
    <view class="profile-card">
      <view class="pc-avatar-wrap">
        <image v-if="avatarUrl" :src="avatarUrl" class="pc-avatar" mode="aspectFill" @error="avatarUrl=''"></image>
        <view v-else class="pc-avatar-df">
          <text class="pca-txt">{{ avatarText }}</text>
        </view>
      </view>
      <view class="pc-name-row">
        <text class="pc-name">{{ username || t('游客') }}</text>
      </view>
      <text class="pc-id">ID: {{ userId }}</text>
    </view>

    <!-- 菜单 -->
    <view class="menu-section">
      <view class="menu-group">
        <view class="menu-item" @tap="goHistory">
          <view class="mi-left"><text class="mi-icon iconfont icon-liulanjilu"></text><text class="mi-label">{{ t('游览记录') }}</text></view>
          <text class="mi-arrow">›</text>
        </view>

      </view>
      <view class="menu-group">
        <view class="menu-item">
          <view class="mi-left"><text class="mi-icon iconfont icon-pianhao"></text><text class="mi-label">{{ t('界面语言') }}</text></view>
          <view class="lang-switch" role="group" :aria-label="t('界面语言')">
            <button class="lang-btn" :class="{active:tourLanguage==='zh'}" :aria-pressed="tourLanguage==='zh'" @tap="setTourLanguage('zh')">中文</button>
            <button class="lang-btn" :class="{active:tourLanguage==='en'}" :aria-pressed="tourLanguage==='en'" @tap="setTourLanguage('en')">English</button>
          </view>
        </view>
        <view class="menu-item" @tap="showAbout=true">
          <view class="mi-left"><text class="mi-icon iconfont icon-guanyuwomen"></text><text class="mi-label">{{ t('关于我们') }}</text></view>
          <text class="mi-arrow">›</text>
        </view>
      </view>
      <view class="menu-group">
        <view class="menu-item logout-item" @tap="handleLogout">
          <view class="mi-left"><text class="mi-icon iconfont icon-tuichu" style="color:var(--ng-secondary);"></text><text class="mi-label" style="color:var(--ng-secondary);">{{ t('退出登录') }}</text></view>
          <text class="mi-arrow" style="color:var(--ng-secondary);">›</text>
        </view>
      </view>
    </view>

    <!-- 关于我们抽屉 -->
    <view class="drawer-overlay" v-if="showAbout" @tap="showAbout=false">
      <view class="drawer-mask"></view>
      <view class="drawer-panel" @tap.stop="">
        <view class="dp-handle"></view>
        <view class="dp-hd"><text class="dp-title">{{ t('关于我们') }}</text><text class="dp-close" @tap="showAbout=false">✕</text></view>
        <view class="dp-content about-content">
          <text class="about-intro">{{ t('景区数字人导览与路线规划。') }}</text>
        </view>
      </view>
    </view>

    <NocturneConfirm v-if="showLogout" :title="t('退出登录')" :content="t('确定要退出登录吗？')" :cancel-label="t('取消')" :confirm-label="t('确定')" @cancel="showLogout=false" @confirm="confirmLogout" />

    <TabBarNav current="mine" />
  </view>
</template>

<script>
import TabBarNav from '../../components/TabBarNav.vue'
import NocturneConfirm from '../../components/NocturneConfirm.vue'
import { BASE_URL, assetUrl } from '../../common/config.js'
import { LANGUAGE_STORAGE_KEY, translateTour } from '../../common/tour-language.js'
export default {
  components:{TabBarNav,NocturneConfirm},
  data: function () {
    return {
      // 与 pages/tour/tour.vue 共用同一个 storage key，切换后全 App 一致。

      username: '', userId: '', avatarUrl: '', statusH: 20,
      showAbout: false, showLogout: false,
    }
  },
  computed: {
    avatarText: function () { var name = (this.username || '').trim(); return name ? name.charAt(0).toUpperCase() : '游' },
  },
  methods: {
    // 与网页端 LanguageSwitch 行为一致：切换界面语言并持久化，用户自填内容保持原样。
    setTourLanguage: function (language) {
      var next = language === 'en' ? 'en' : 'zh'
      var previous = this.tourLanguage
      this.tourLanguage = next
      uni.setStorageSync(LANGUAGE_STORAGE_KEY, next)
      if (previous !== next) this.translateAiChatHistory(next)
    },
    // 切换语言时，把本地保存的 AI 小导游问答一起转换成新语言。
    translateAiChatHistory: function (target) {
      var raw = ''
      try { raw = uni.getStorageSync('ai_chat_msgs') || '' } catch (e) { raw = '' }
      if (!raw) return
      var list
      try { list = JSON.parse(raw) } catch (e) { return }
      if (!Array.isArray(list) || !list.length) return
      var guess = function (text) {
        var value = String(text || '')
        var cjk = (value.match(/[\u4e00-\u9fff]/g) || []).length
        var latin = (value.match(/[A-Za-z]/g) || []).length
        if (latin >= 5 && latin >= cjk * 2) return 'en'
        if (cjk > 0) return 'zh'
        if (latin > 0) return 'en'
        return target
      }
      var pending = []
      list.forEach(function (m, index) {
        if (!m || typeof m.content !== 'string' || !m.content.trim()) return
        m.lang = guess(m.content)
        var body = String(m.content || '')
        var mixedForEnglish = target === 'en' && /[\u4e00-\u9fff]/.test(body)
        var englishForChinese = target === 'zh' && !/[\u4e00-\u9fff]/.test(body) && /[A-Za-z]/.test(body)
        if (m.lang === target && !mixedForEnglish && !englishForChinese) return
        if (m.translations && typeof m.translations[target] === 'string' && m.translations[target].trim()) {
          m.content = m.translations[target]
          m.lang = target
          return
        }
        pending.push({ index: index, text: body, from: m.lang })
      })
      if (!pending.length) { try { uni.setStorageSync('ai_chat_msgs', JSON.stringify(list)) } catch (e) {} return }
      uni.request({
        url: BASE_URL + '/tour-session/translate-texts', method: 'POST',
        header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (uni.getStorageSync('token') || '') },
        timeout: 90000,
        data: { texts: pending.map(function (x) { return x.text }), target: target },
        success: function (res) {
          try {
            var translations = res.data && res.data.data && res.data.data.translations
            if (!Array.isArray(translations)) return
            pending.forEach(function (p, k) {
              var m = list[p.index]
              if (!m) return
              var translated = translations[k]
              if (typeof translated !== 'string' || !translated.trim()) return
              var nextText = translated.trim()
              var hasCJK = /[\u4e00-\u9fff]/.test(nextText)
              if (nextText !== String(m.content || '').trim()) {
                if (!m.translations) m.translations = {}
                m.translations[m.lang || p.from] = m.content
                m.content = nextText
                m.lang = target
              } else if ((target === 'zh' && hasCJK) || (target === 'en' && !hasCJK)) {
                m.lang = target
              }
            })
            uni.setStorageSync('ai_chat_msgs', JSON.stringify(list))
          } catch (e) {}
        }
      })
    },
    // 只翻译界面文案；用户昵称等用户自填内容保持原样。
    t: function (value, params) {
      return translateTour(value, this.tourLanguage, params || {})
    },
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
  onHide:function(){this.showAbout=false;this.showLogout=false},
  onShow: function () {
    this.showAbout=false
    var token = uni.getStorageSync('token')
    if (!token) { uni.reLaunch({ url: '/pages/auth/auth' }); return }
    uni.request({url:BASE_URL+'/user/me',header:{Authorization:'Bearer '+token},
      success:r=>{
        const d=r.data||{}
        if(r.statusCode===401){uni.removeStorageSync('token');uni.reLaunch({url:'/pages/auth/auth'});return}
        if(r.statusCode!==200||!d.success||!d.data){uni.showToast({title:this.t('个人资料加载失败'),icon:'none'});return}
        this.username=d.data.username||''
        this.userId=d.data.user_id
        this.avatarUrl=assetUrl(d.data.avatar||'')
        uni.setStorageSync('username',this.username)
        uni.setStorageSync('avatar',d.data.avatar||'')
      },fail:()=>{uni.showToast({title:this.t('个人资料加载失败，请检查网络'),icon:'none'})}})
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

/* 中英文切换（与「我的」菜单同排，样式沿用主题变量） */
.lang-switch { display:flex; align-items:center; gap:6rpx; padding:8rpx; border-radius:28rpx; background:var(--ng-raised); border:1rpx solid var(--ng-border); }
.lang-btn { border:0; background:transparent; color:var(--ng-secondary); font-size:26rpx; line-height:1.2; padding:14rpx 20rpx; border-radius:20rpx; margin:0; }
.lang-btn.active { background:var(--ng-surface); color:var(--ng-accent-text); font-weight:700; box-shadow:0 4rpx 14rpx rgba(30,41,59,.10); }
.lang-btn::after { border:0; }
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
.dp-content{padding:0 32rpx 32rpx;box-sizing:border-box}

/* 关于我们 */
.about-content{display:flex;flex-direction:column}
.about-intro{font-size:24rpx;color:var(--ng-text);line-height:1.8;display:block;margin-bottom:20rpx}
.about-credit{font-size:20rpx;color:var(--ng-secondary);display:block;text-align:right}
.about-row{display:flex;padding:20rpx 0;border-bottom:1rpx solid var(--ng-border)}
.about-row text:first-child{font-size:22rpx;color:var(--ng-secondary);width:80rpx;flex-shrink:0}
.about-row text:last-child{font-size:22rpx;color:var(--ng-text)}
</style>
