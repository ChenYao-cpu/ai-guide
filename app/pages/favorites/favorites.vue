<template>
  <view class="page">

    <view class="ink-bg"><view class="ink-mt ink-mt-1"></view><view class="ink-mt ink-mt-2"></view></view>
    <view class="nav">
      <text class="nav-back" @tap="goBack">‹</text>
      <text class="nav-title">我的收藏</text>
    </view>
    <scroll-view scroll-y class="main">
      <view v-if="loading" class="load">加载中...</view>
      <view v-if="error" class="empty" @tap="loadData">{{ error }}，点击重试</view>
      <view v-else-if="!loading && list.length===0" class="empty">暂无收藏</view>
      <view v-for="s in list" :key="s.spot_id" class="card" @tap="openDetail(s)">
        <image v-if="s.image_path" :src="fixImg(s.image_path)" class="c-img" mode="aspectFill"></image>
        <view v-else class="c-img-df"></view>
        <view class="c-info">
          <text class="c-name">{{ s.spot_name }}</text>
          <text class="c-desc">{{ (s.description||s.location||'').substring(0,40) }}</text>
        </view>
        <view class="c-like liked" @tap.stop="unlike(s.spot_id)">
          <text class="iconfont icon-huore"></text>
          <text>已收藏</text>
        </view>
      </view>
      <view style="height:40rpx"></view>
    </scroll-view>

    <view class="drawer-overlay" v-if="detailSpot" @tap="detailSpot=null">
      <view class="drawer-mask"></view>
      <view class="drawer-panel" @tap.stop="">
        <view class="dp-handle"></view>
        <view class="dp-hd"><text class="dp-title">{{ detailSpot.spot_name }}</text><text class="dp-close" @tap="detailSpot=null">✕</text></view>
        <scroll-view scroll-y class="dp-body">
          <image v-if="detailSpot.image_path" :src="fixImg(detailSpot.image_path)" class="dp-hero" mode="aspectFill"></image>
          <text class="dp-desc">{{ detailSpot.description||'暂无简介' }}</text>
          <view class="dp-row"><text>位置</text><text>{{ detailSpot.location||'暂无' }}</text></view>
          <view class="dp-row"><text>分类</text><text>{{ detailSpot.category||'景点' }}</text></view>
        </scroll-view>
        <view class="dp-like-bar">
          <view class="dpl-btn-star" @tap="unlike(detailSpot.spot_id);detailSpot=null">
            <text>{{ ' 已收藏 (取消)' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { BASE_URL, assetUrl } from '../../common/config.js'

function req(o){return new Promise(function(rs,rj){uni.request({url:BASE_URL+o.url,method:o.method||'GET',header:{'Content-Type':'application/json','Authorization':'Bearer '+uni.getStorageSync('token')},success:function(r){if(r.statusCode===200&&r.data&&r.data.success)rs({data:r.data});else rj(new Error('请求失败'))},fail:rj})})}
export default {
  data:function(){return{list:[],loading:true,detailSpot:null,error:''}},
  methods:{
    goBack:function(){uni.navigateBack()},
    fixImg:function(u){if(!u)return'';return assetUrl(u)},
    openDetail:function(s){this.detailSpot=s;req({url:'/spot-favorites/history/'+s.spot_id,method:'PUT'}).catch(function(){uni.showToast({title:'浏览记录保存失败',icon:'none'})})},
    unlike:function(sid){
      var self=this
      req({url:'/spot-favorites/'+sid,method:'DELETE'}).then(function(){self.loadData();uni.showToast({title:'已取消收藏',icon:'none'})}).catch(function(){uni.showToast({title:'取消失败，请重试',icon:'none'})})
    },
    loadData:function(){var self=this;self.loading=true;self.error=''
      req({url:'/spot-favorites'}).then(function(r){self.list=r.data.data.spot_list;self.loading=false}).catch(function(){self.error='收藏加载失败';self.loading=false})
    },
  },
  onShow:function(){this.loadData()},
}
</script>

<style scoped>
.page{min-height:100vh;background-color:var(--ng-surface);position:relative;overflow:hidden}
.ink-bg{position:absolute;inset:0;pointer-events:none;z-index:0}.ink-mt{position:absolute;left:0;right:0;background:var(--ng-night);border-radius:55% 75% 0 0}.ink-mt-1{bottom:20%;height:220rpx;opacity:.04;transform:scaleX(1.3)}.ink-mt-2{bottom:25%;height:160rpx;opacity:.025;transform:scaleX(1.5) translateX(-8%)}
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.nav{position:relative;z-index:1;display:flex;align-items:center;padding:50rpx 24rpx 16rpx}
.nav-back{font-size:56rpx;color:var(--ng-text);padding-right:20rpx;line-height:1}
.nav-title{flex:1;font-size:34rpx;font-weight:600;color:var(--ng-text);letter-spacing:0;font-family:var(--app-font-family);text-align:center}
.main{position:relative;z-index:1;padding:0 24rpx;height:calc(100vh - 120rpx);box-sizing:border-box;width:100%}.load{text-align:center;padding:80rpx;color:var(--ng-secondary)}.empty{text-align:center;padding:100rpx;color:var(--ng-secondary);font-size:28rpx}
.card{display:flex;align-items:center;gap:14rpx;padding:16rpx 18rpx;margin-bottom:14rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:18rpx;box-sizing:border-box;width:100%}
.c-img{width:88rpx;height:88rpx;border-radius:14rpx;flex-shrink:0}.c-img-df{width:88rpx;height:88rpx;border-radius:14rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);font-size:36rpx;flex-shrink:0}
.c-info{flex:1;min-width:0}.c-name{font-size:28rpx;font-weight:600;color:var(--ng-text);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.c-desc{font-size:22rpx;color:var(--ng-secondary);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4rpx}
.c-like{display:flex;flex-direction:column;align-items:center;gap:4rpx;font-size:20rpx;color:var(--ng-secondary);flex-shrink:0;padding:8rpx}.c-like.liked{color:var(--ng-secondary)}.c-like .iconfont{font-size:30rpx}

.drawer-overlay{position:fixed;inset:0;z-index:1000}.drawer-mask{position:absolute;inset:0;background:rgba(30,41,59,0.28)}.drawer-panel{position:absolute;bottom:0;left:0;right:0;max-height:75vh;background:var(--ng-surface);border-radius:28rpx 28rpx 0 0;overflow:hidden}.dp-handle{width:56rpx;height:5rpx;border-radius:3rpx;background:rgba(99,102,241,0.12);margin:14rpx auto 8rpx}.dp-hd{display:flex;justify-content:space-between;padding:8rpx 28rpx 14rpx}.dp-title{font-size:30rpx;font-weight:600;color:var(--ng-text)}.dp-close{font-size:32rpx;color:var(--ng-secondary)}.dp-body{padding:0 28rpx 16rpx;max-height:50vh}.dp-hero{width:100%;height:260rpx;border-radius:14rpx;margin-bottom:16rpx}.dp-desc{font-size:24rpx;color:var(--ng-text);line-height:1.7;margin-bottom:18rpx}.dp-row{display:flex;padding:14rpx 0;border-top:1rpx solid var(--ng-border)}.dp-row text:first-child{font-size:22rpx;color:var(--ng-secondary);width:80rpx}.dp-row text:last-child{font-size:22rpx;color:var(--ng-text)}
.dp-like-bar{display:flex;padding:12rpx 28rpx 20rpx;padding-bottom:calc(20rpx + env(safe-area-inset-bottom))}
.dpl-btn-star{flex:1;padding:18rpx;text-align:center;border-radius:14rpx;background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));color:var(--ng-text);font-size:26rpx;font-weight:700}
.c-like-count{position:absolute;bottom:10rpx;right:10rpx;display:flex;align-items:center;gap:4rpx;font-size:18rpx;color:var(--ng-text);z-index:2}.c-like-count .iconfont{font-size:22rpx}
</style>
