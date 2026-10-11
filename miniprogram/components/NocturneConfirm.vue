<template>
  <view class="confirm-overlay" @tap="$emit('cancel')">
    <view class="confirm-panel" @tap.stop>
      <text class="confirm-title">{{ title }}</text>
      <text class="confirm-content">{{ content }}</text>
      <view class="confirm-actions">
        <button class="confirm-cancel" @tap="$emit('cancel')">取消</button>
        <button class="confirm-primary" @tap="$emit('confirm')">确定</button>
      </view>
    </view>
  </view>
</template>
<script>
export default {
  props: {title: {type: String, default: ''}, content: {type: String, default: ''}},
  emits: ['confirm', 'cancel'],
}
</script>
<style scoped>
.confirm-overlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:40rpx;box-sizing:border-box;background:rgba(30,41,59,0.28)}
.confirm-panel{width:100%;max-width:600rpx;padding:40rpx;box-sizing:border-box;border-radius:48rpx;background:#ffffff;background-image:linear-gradient(135deg,rgba(99,102,241,0.12),transparent 50%);border:1rpx solid rgba(99,102,241,0.12);box-shadow:var(--ng-glass-shadow);backdrop-filter: none}
.confirm-title{display:block;color:#1f2937;font-size:36rpx;font-family:var(--app-font-family);text-align:center}
.confirm-content{display:block;margin:24rpx 0 36rpx;color:#64748b;font-size:28rpx;line-height:1.8;text-align:center}
.confirm-actions{display:flex;gap:20rpx}.confirm-actions button{flex:1;margin:0;font-size:28rpx;line-height:80rpx;border-radius:32rpx;background:rgba(99,102,241,0.06);color:#1f2937;border:1rpx solid rgba(99,102,241,0.12)}.confirm-actions button::after{border:0}.confirm-actions .confirm-primary{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.25);color:#4338ca}.confirm-primary:active{background:rgba(99,102,241,0.22)}
</style>

<style scoped>
.confirm-panel{background:#fff;background-image:none;border-color:transparent}.confirm-actions .confirm-primary{background:#4f46e5;color:#fff;border-color:transparent}.confirm-actions .confirm-primary:active{background:#4338ca;color:#fff}
</style>
