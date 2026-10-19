<template>
  <view class="select-overlay" :class="{'select-overlay-upper':placement==='upper'}" @tap="$emit('close')">
    <view class="select-panel" role="dialog" aria-modal="true" :aria-label="$t(title)" @tap.stop>
      <text class="select-title">{{ $t(title) }}</text>
      <scroll-view scroll-y class="select-options" :style="{height:Math.min(options.length*(placement==='upper'?48:56),placement==='upper'?240:280)+'px'}">
        <button v-for="(option,index) in options" :key="index" class="select-option" :class="{selected:index===selectedIndex}" :aria-pressed="index===selectedIndex" @tap="choose(index)">
          <text>{{ $t(option) }}</text><text v-if="index===selectedIndex" aria-hidden="true">✓</text>
        </button>
      </scroll-view>
      <button class="select-cancel" @tap="$emit('close')">{{ $t('取消') }}</button>
    </view>
  </view>
</template>
<script>
export default {
  props: {title:{type:String,default:''},options:{type:Array,default:()=>[]},selectedIndex:{type:Number,default:-1},placement:{type:String,default:'bottom'}},
  emits:['change','close'],
  methods:{choose(index){this.$emit('change',{detail:{value:index}});this.$emit('close')}},
}
</script>
<style scoped>
.select-overlay{position:fixed!important;inset:0;z-index:2200!important;display:flex;align-items:flex-end;background:rgba(30,41,59,.28);padding:20rpx;box-sizing:border-box}
.select-panel{width:100%;max-width:640px;margin:0 auto;background:var(--ng-surface,#fff);border-radius:30rpx;padding:28rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));box-sizing:border-box;color:var(--ng-text,#1f2937);box-shadow:0 12px 40px rgba(30,41,59,.12)}
.select-title{display:block;font-size:32rpx;font-weight:700;line-height:1.5;padding:8rpx 12rpx 24rpx}
.select-options{width:100%;box-sizing:border-box}.select-option{display:flex;align-items:center;justify-content:space-between;gap:16rpx;min-height:56px;padding:12px 14px;margin:0;width:100%;box-sizing:border-box;text-align:left;font-size:16px;line-height:1.5;background:transparent;color:inherit;border-radius:16rpx}.select-option::after,.select-cancel::after{border:0}
.select-option.selected{background:var(--ng-raised,#eef2ff);color:var(--ng-accent-text,#4338ca);font-weight:600}.select-option:active{background:var(--ng-raised,#eef2ff)}
.select-cancel{margin:20rpx 0 0;padding:12px;min-height:48px;line-height:1.5;font-size:16px;border-radius:16rpx;color:var(--ng-secondary,#475569);background:var(--ng-night,#f8fafc)}
.select-overlay-upper{align-items:flex-start;padding:0 24rpx 16rpx;padding-top:max(12vh,calc(env(safe-area-inset-top) + 24px))}
.select-overlay-upper .select-panel{width:100%;max-width:340px;max-height:calc(84vh - env(safe-area-inset-top));padding:20rpx;border-radius:24rpx;overflow-y:auto}
.select-overlay-upper .select-title{font-size:30rpx;padding:8rpx 12rpx 16rpx}
.select-overlay-upper .select-options{max-height:40vh}
.select-overlay-upper .select-option{min-height:48px;padding:10px 12px;font-size:15px}
.select-overlay-upper .select-cancel{min-height:44px;margin-top:16rpx;padding:10px;font-size:15px}
</style>
