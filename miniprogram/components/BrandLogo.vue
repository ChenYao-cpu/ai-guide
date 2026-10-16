<template>
  <view class="zhiyou-logo" :class="{ stacked, animated }" aria-label="智游知境">
    <view class="zhiyou-icon"><image class="zhiyou-app-icon" src="/static/brand/zhiyou-zhijing-transparent.png" mode="scaleToFill" /></view>
    <view class="zhiyou-wordmark"><image class="zhiyou-wordmark-sheet" src="/static/brand/zhiyou-zhijing-transparent.png" mode="scaleToFill" /></view>
  </view>
</template>
<script>
export default { props: { stacked: { type: Boolean, default: false }, animated: { type: Boolean, default: false } } }
</script>
<style scoped>
.zhiyou-logo { display:flex; align-items:center; justify-content:center; gap:12rpx; height:72rpx; }
.zhiyou-icon,.zhiyou-wordmark { position:relative; overflow:hidden; flex-shrink:0; }
.zhiyou-icon { width:72rpx; height:72rpx; border-radius:16rpx; }
.zhiyou-wordmark { width:210rpx; height:64.02rpx; }
.zhiyou-app-icon { position:absolute; display:block; width:283.9216%; height:212.9412%; left:-22.9412%; top:-26.0784%; }
.zhiyou-wordmark-sheet { position:absolute; width:206.2678%; height:507.4766%; left:-86.0399%; top:-130.8411%; }
.stacked { height:auto; flex-direction:column; gap:20rpx; }
.stacked .zhiyou-icon { width:184rpx; height:184rpx; border-radius:40rpx; }
.stacked .zhiyou-wordmark { width:390rpx; height:118.89rpx; }

.animated .zhiyou-icon{animation:logoBounce 3.2s ease-in-out infinite;transform-origin:center bottom;}
@keyframes logoBounce{0%,70%,100%{transform:translateY(0)}80%{transform:translateY(-16rpx)}90%{transform:translateY(0)}95%{transform:translateY(-5rpx)}}
@media(prefers-reduced-motion:reduce){.animated .zhiyou-icon{animation:none;}}
</style>
