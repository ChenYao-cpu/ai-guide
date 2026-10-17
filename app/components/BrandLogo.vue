<template>
  <view class="zhiyou-logo" :class="{ stacked, animated }" :aria-label="$t(&quot;智游知境&quot;)">
    <view class="zhiyou-icon"><image class="zhiyou-app-icon" src="/static/brand/brand-app-icon.png" mode="aspectFit" /></view>
    <view v-if="appLanguage==='zh'" class="zhiyou-wordmark"><text class="brand-name-zh">{{ $t('智游知境') }}</text><text class="brand-tagline-zh">{{ $t('AI数字人景区导览') }}</text></view>
    <view v-else class="zhiyou-wordmark-en"><text class="brand-name-en">ZHIYOU</text><text class="brand-tagline-en">AI TOUR GUIDE</text></view>
  </view>
</template>
<script>
export default { props: { stacked: { type: Boolean, default: false }, animated: { type: Boolean, default: false } } }
</script>
<style scoped>
.zhiyou-logo { display:flex; align-items:center; justify-content:center; gap:12rpx; height:72rpx; mix-blend-mode:multiply; }
.zhiyou-icon,.zhiyou-wordmark { position:relative; overflow:hidden; flex-shrink:0; }
.zhiyou-icon { width:72rpx; height:72rpx; border-radius:16rpx; }
.zhiyou-wordmark {display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5rpx;width:230rpx;min-height:72rpx;color:#252164;}
.brand-name-zh{font-family:'Songti SC','SimSun',serif;font-size:46rpx;font-weight:700;letter-spacing:4rpx;line-height:1.25;white-space:nowrap}.brand-tagline-zh{font-size:14rpx;letter-spacing:3rpx;white-space:nowrap}
.zhiyou-app-icon { position:absolute; display:block; width:114.5%; height:110.3%; left:-7.25%; top:-5.15%; }
.zhiyou-wordmark-en{display:flex;flex-direction:column;align-items:center;color:#312e81;gap:4rpx}.brand-name-en{font-size:38rpx;font-weight:800;letter-spacing:5rpx}.brand-tagline-en{font-size:16rpx;letter-spacing:3rpx}.stacked .brand-name-en{font-size:62rpx}.stacked .brand-tagline-en{font-size:20rpx}
.stacked { height:auto; flex-direction:column; gap:20rpx; }
.stacked .zhiyou-icon { width:184rpx; height:184rpx; border-radius:40rpx; }
.stacked .zhiyou-wordmark {width:440rpx;min-height:120rpx;gap:10rpx}.stacked .brand-name-zh{font-size:78rpx;letter-spacing:8rpx}.stacked .brand-tagline-zh{font-size:23rpx;letter-spacing:5rpx}

.animated .zhiyou-icon{animation:logoBounce 3.2s ease-in-out infinite;transform-origin:center bottom;}
@keyframes logoBounce{0%,70%,100%{transform:translateY(0)}80%{transform:translateY(-16rpx)}90%{transform:translateY(0)}95%{transform:translateY(-5rpx)}}
@media(prefers-reduced-motion:reduce){.animated .zhiyou-icon{animation:none;}}
</style>
