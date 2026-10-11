<template>
  <view class="zhiyou-logo" :class="{ stacked }" aria-label="智游灵境">
    <view class="zhiyou-icon"><image class="zhiyou-icon-sheet" src="/static/brand/brand-sheet.png" mode="scaleToFill" /></view>
    <view class="zhiyou-wordmark"><image class="zhiyou-wordmark-sheet" src="/static/brand/brand-sheet.png" mode="scaleToFill" /></view>
  </view>
</template>
<script>
export default { props: { stacked: { type: Boolean, default: false } } }
</script>
<style scoped>
.zhiyou-logo { display:flex; align-items:center; justify-content:center; gap:12rpx; height:72rpx; }
.zhiyou-icon,.zhiyou-wordmark { position:relative; overflow:hidden; flex-shrink:0; }
.zhiyou-icon { width:56.19rpx; height:72rpx; }
.zhiyou-wordmark { width:210rpx; height:64.02rpx; }
.zhiyou-icon-sheet { position:absolute; width:363.8191%; height:212.9412%; left:-43.4673%; top:-26.0784%; }
.zhiyou-wordmark-sheet { position:absolute; width:206.2678%; height:507.4766%; left:-86.0399%; top:-130.8411%; }
.stacked { height:auto; flex-direction:column; gap:20rpx; }
.stacked .zhiyou-icon { width:156.08rpx; height:200rpx; }
.stacked .zhiyou-wordmark { width:390rpx; height:118.89rpx; }
</style>
