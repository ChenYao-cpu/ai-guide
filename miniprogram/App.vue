<script>
import { LOGIN_PROVIDER } from './common/config.js'
export default {
  onLaunch: function() {
    console.log('App Launch')
  },
  onShow: function() {
    var token = uni.getStorageSync('token')
    var pages = getCurrentPages()
    var currentPage = ''
    if (pages && pages.length) {
      currentPage = (pages[pages.length - 1] || {}).route || ''
    }
    if ((!token || uni.getStorageSync('login_provider') !== LOGIN_PROVIDER) && currentPage.indexOf('pages/auth/auth') === -1) {
      uni.reLaunch({ url: '/pages/auth/auth' })
    }
  },
}
</script>

<style>
@import "./common/soft-ui.css";
@import url("/static/iconfont/iconfont-inline.css");
page { background:var(--ng-night); color:var(--ng-text); font-family:var(--app-font-family); }
.page { background:var(--ng-night); color:var(--ng-text); }
.page .nav { border-color:var(--ng-border); }
.page .card,.page .menu-group,.page .profile-card,.page .map-card,.page .rank-block,.page .block { background:var(--ng-surface); border-color:var(--ng-border); border-radius:24rpx; }
.page .ink-bg,.auth-page .ink-bg { display:none; }
.page .nav { background:var(--ng-surface); border-bottom:1rpx solid var(--ng-border); padding-bottom:24rpx; }
.page .nav-title { font-family:var(--app-font-family); font-size:36rpx; font-weight:700; letter-spacing:0; }
.page .tb-root { background:var(--ng-surface); border-top:1rpx solid var(--ng-border); box-shadow:0 -8rpx 30rpx rgba(30,41,59,.06); }
.page .tb-ink-line { display:none; }
.page .tb-hl-ring { background:transparent; border:none; box-shadow:none; }
.page .tb-hl-ring.on { background:var(--ng-surface); border-radius:20rpx; }
.page .tb-label,.page .tb-icon { color:var(--ng-secondary); }
.page .tb-item.on .tb-label,.page .tb-item.on .tb-icon { color:var(--ng-secondary); }
.page .map-card,.page .rank-block,.page .block,.page .menu-group,.page .profile-card { border:1rpx solid transparent; border-radius:32rpx; box-shadow:var(--ng-glass-shadow); }
.page .bottom-bar,.page .input-bar,.page .bottom-fixed { background:var(--ng-surface); }
.page .msg-bubble.ai,.page .msg-bubble.guide { background:var(--ng-surface); border-color:var(--ng-border); }
.page .msg-bubble.user { background:rgba(99,102,241,0.18); color:var(--ng-text); }
.aurora-page{background:transparent!important;color:var(--ng-text)}
.aurora-background{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:linear-gradient(145deg,var(--ng-surface) 0%,var(--ng-surface) 35%,var(--ng-surface) 70%,var(--ng-surface) 100%)}
.aurora-page>view:not(.aurora-background):not(.tb-root):not(.bottom-fixed):not(.drawer-overlay):not(.spot-drawer):not(.fab-btn){position:relative;z-index:1}
.aurora-page .nav{background:transparent!important;border-bottom-color:var(--ng-border)!important;gap:18rpx}
.aurora-page .nav-title{color:var(--ng-text)}
.aurora-page .tb-root{position:fixed!important;background:var(--ng-surface)!important;border-top-color:var(--ng-border)!important}
.aurora-page .input-bar,.aurora-page .bottom-bar,.aurora-page .bottom-fixed{background:var(--ng-surface)!important}
.aurora-wave{position:absolute;width:180%;height:65%;left:-40%;border-radius:45%;background:radial-gradient(ellipse,rgba(99,102,241,0.18),rgba(99,102,241,0.1) 55%,transparent 72%);animation:auroraDrift 16s ease-in-out infinite alternate;will-change:transform}
.aurora-wave-one{top:-10%;transform:rotate(-18deg)}
.aurora-wave-two{bottom:-20%;background:radial-gradient(ellipse,rgba(99,102,241,0.12),rgba(99,102,241,0.12) 55%,transparent 72%);animation-delay:-8s;animation-duration:22s}
.aurora-shine{position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 35%,var(--ng-surface) 47%,var(--ng-surface) 54%,transparent 66%);animation:auroraShimmer 12s ease-in-out infinite alternate;will-change:transform}
.brand-ai{display:flex;align-items:center;justify-content:center;width:72rpx;height:72rpx;flex-shrink:0;border-radius:20rpx;background:var(--ng-night);color:var(--ng-text);font-size:26rpx;font-weight:700;box-shadow:0 10rpx 28rpx rgba(30,41,59,0.28)}
.aurora-page{--tab-icon-size:26px;--tab-label-size:14px;--tab-touch-height:68px;padding-bottom:calc(84px + env(safe-area-inset-bottom))!important}
.aurora-page .tb-inner{display:flex;align-items:center;justify-content:space-around;padding:8px 6px!important;min-height:var(--tab-touch-height);box-sizing:border-box}
.aurora-page .tb-item{flex:1;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.aurora-page .tb-hl-ring{width:48px!important;height:32px!important;border-radius:12px!important}
.aurora-page .tb-icon,.aurora-page .tb-hl-ring .tb-icon{font-size:var(--tab-icon-size)!important;line-height:1.15}
.aurora-page .tb-label{font-size:var(--tab-label-size)!important;line-height:1.3;white-space:nowrap;font-weight:600!important}
.aurora-page .tb-safe{height:env(safe-area-inset-bottom)!important;min-height:0!important}
.aurora-page .bottom-fixed .tb-root{position:relative!important;bottom:auto!important}
.aurora-page .bottom-fixed~view{z-index:1}
@media(min-width:390px){.aurora-page{--tab-icon-size:28px;--tab-label-size:15px;--tab-touch-height:72px}}
@media(min-width:430px){.aurora-page{--tab-icon-size:30px;--tab-label-size:16px;--tab-touch-height:76px}}
@keyframes auroraDrift{from{transform:translate(-6%,0) rotate(-18deg)}to{transform:translate(9%,12%) rotate(12deg)}}
@keyframes auroraShimmer{from{transform:translateX(-18%) rotate(-6deg);opacity:.4}to{transform:translateX(18%) rotate(6deg);opacity:1}}
</style>
