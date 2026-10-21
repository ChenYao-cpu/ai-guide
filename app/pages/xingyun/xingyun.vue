<template>
  <web-view v-if="src" :src="src" @error="failed" />
  <view v-else class="notice">
    <text>{{ message }}</text>
    <button v-if="!loading" @tap="load">{{ t("重试") }}</button>
    <button @tap="back">{{ t("返回导览") }}</button>
  </view>
</template>
<script>
import { BASE_URL } from '../../common/config.js'
export default {
  data: function() { return { sid: 0, src: '', message: '正在打开所选数字人的半身导览…', loading: false } },
  onLoad: function(options) { this.sid = Number(options.sessionId); this.load() },
  methods: {
    load: function() {
      var self = this, token = uni.getStorageSync('xingyun-tour-' + self.sid)
      if (!token) { self.message = '导览凭证已失效，请返回选择数字人重新开始'; return }
      self.loading = true
      uni.request({ url: BASE_URL + '/xingyun/webview/' + self.sid, header: { 'X-Tour-Access': token },
        success: function(r) {
          if(r.statusCode === 200 && r.data.url) self.src = r.data.url
          else self.message = r.data.detail || '无法打开星云导览，请联系管理员检查配置'
        },
        fail: function() { self.message = '无法连接导览服务器，请检查网络' },
        complete: function() { self.loading = false },
      })
    },
    failed: function() { this.src = ''; this.message = '网页加载失败，请确认 HTTPS 地址及微信业务域名已配置' },
    back: function() { uni.navigateBack() },
  },
}
</script>
<style scoped>
.notice{margin:calc(100rpx + env(safe-area-inset-top)) 32rpx 32rpx;padding:40rpx 32rpx;display:flex;flex-direction:column;gap:28rpx;line-height:1.8;color:var(--ng-secondary);background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:32rpx;box-shadow:var(--ng-glass-shadow)}
.notice button{width:100%;margin:0;border-radius:20rpx;font-size:28rpx;background:var(--ng-raised);color:var(--ng-accent-text)}
.notice button:first-of-type{background:var(--ng-accent);color:#fff}
</style>
