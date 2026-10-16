<template>
  <view class="guide3d-container">
    <view class="guide3d-fallback" v-if="loadError || !modelPath">
      <image v-if="fallbackImg" :src="fallbackImg" class="guide3d-img" mode="aspectFit"></image>
      <view v-else class="guide3d-img-df"><text>3D</text></view>
    </view>
    <view class="guide3d-loading" v-if="!loadError && modelPath && loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    modelPath: { type: String, default: '' },
    width:     { type: Number, default: 300 },
    height:    { type: Number, default: 400 },
    speaking:  { type: Boolean, default: false },
    fallbackImg: { type: String, default: '' },
  },
  data() {
    return {
      loadError: false,
      loading: true,
    }
  },
  computed: {
    cam() {
      return {
        position: { x: 0, y: 1.1, z: 3.5 },
        target: { x: 0, y: 0.7, z: 0 },
        fov: 35,
      }
    },
  },
  mounted: function() {
    var self = this
    if (self.modelPath) {
      setTimeout(function() { self.loading = false }, 2000)
      // 检查文件是否存在
      uni.getFileInfo({
        filePath: self.modelPath,
        success: function() { self.loading = false },
        fail: function() { self.loadError = true; self.loading = false },
      })
    } else {
      self.loadError = true
    }
  },
}
</script>

<style scoped>
.guide3d-container{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
.guide3d-view{width:100%;height:100%;border-radius:20rpx;overflow:hidden}
.guide3d-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.guide3d-img{width:80%;height:80%;border-radius:24rpx;animation:breathe 4s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
.guide3d-img-df{width:200rpx;height:200rpx;border-radius:50%;background:linear-gradient(135deg,var(--ng-surface),var(--ng-surface));display:flex;align-items:center;justify-content:center;font-size:36rpx;color:var(--ng-secondary);font-weight:900}
.guide3d-loading{position:absolute;z-index:5;padding:12rpx 24rpx;border-radius:12rpx;background:rgba(0,0,0,.4);color:var(--ng-text);font-size:24rpx}
</style>
