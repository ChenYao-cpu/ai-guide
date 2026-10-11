<template>
  <view class="tb-root">
    <view class="tb-ink-line"></view>
    <view class="tb-inner">
      <view
        v-for="item in tabs"
        :key="item.key"
        class="tb-item"
        :class="{ on: current === item.key, highlight: item.highlight }"
        @tap="switchTab(item)"
      >
        <!-- 高亮项圆形外框 -->
        <view v-if="item.highlight" class="tb-hl-ring" :class="{ on: current === item.key }">
          <text class="tb-icon iconfont" :class="item.icon"></text>
        </view>
        <text v-else class="tb-icon iconfont" :class="item.icon"></text>
        <text class="tb-label">{{ item.label }}</text>
        <!-- 选中指示 -->
        <view v-if="current === item.key" class="tb-dot"></view>
      </view>
    </view>
    <view class="tb-safe"></view>
  </view>
</template>

<script>
export default {
  props: { current: { type: String, default: 'tour' } },
  data: function () {
    return {
      tabs: [
        { key: 'tour', icon: 'icon-daolan', label: '智能导览', highlight: true, path: '/pages/tour-guide/tour-guide' },
        { key: 'ai', icon: 'icon-aishuziren', label: 'AI小导游', highlight: true, path: '/pages/ai-chat/ai-chat' },
        { key: 'mine', icon: 'icon-wode1', label: '我的', highlight: false, path: '/pages/mine/mine' },
      ],
    }
  },
  methods: {
    switchTab: function (item) {
      if (item.key === this.current) return
      uni.reLaunch({ url: item.path })
    },
  },
}
</script>

<style scoped>
.tb-root { position:fixed; bottom:0; left:0; right:0; z-index:999; background:var(--ng-surface); }
.tb-ink-line { height:1rpx; background:linear-gradient(90deg, transparent, rgba(99,102,241,0.12), transparent); margin:0 32rpx; }
.tb-inner { display:flex; align-items:flex-end; justify-content:space-around; padding:8rpx 12rpx 0; }
.tb-item { display:flex; flex-direction:column; align-items:center; gap:4rpx; padding:8rpx 16rpx; position:relative; flex:1; }
.tb-icon { font-size:36rpx; transition:all 0.2s; }
.tb-label { font-size:20rpx; font-weight:600; color:var(--ng-secondary); transition:all 0.2s; }
.tb-dot { position:absolute; bottom:-4rpx; width:24rpx; height:4rpx; border-radius:2rpx; background:rgba(99,102,241,0.18); opacity:0.6; }

/* 选中态 */
.tb-item.on .tb-label { color:var(--ng-secondary); font-weight:800; }
.tb-item.on .tb-icon { transform:scale(1.1); }

/* 核心功能圆形外框 */
.tb-hl-ring {
  width:80rpx; height:80rpx; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:rgba(99,102,241,0.18);
  border:2rpx solid rgba(99,102,241,0.25);
  margin-bottom:-2rpx;
  transition:all 0.2s;
}
.tb-hl-ring.on {
  background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.18));
  border-color:transparent;
  box-shadow:0 6rpx 18rpx rgba(99,102,241,0.15);
}
.tb-hl-ring .tb-icon { font-size:32rpx; }
.tb-hl-ring.on .tb-icon { filter:brightness(2); }

.tb-safe { height:env(safe-area-inset-bottom, 10rpx); min-height:10rpx; }
</style>
