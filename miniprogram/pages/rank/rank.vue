<template>
  <view class="page">
    
    <view class="ink-bg"><view class="ink-mt ink-mt-1"></view><view class="ink-mt ink-mt-2"></view></view>

    <view class="nav">
      <view class="nav-back" @tap="goBack"><text>‹</text></view>
      <text class="nav-title">{{ title }}</text>
      <view class="nav-back" style="opacity:0"><text>‹</text></view>
    </view>

    <scroll-view scroll-y class="main">
      <view v-if="loading" class="load">加载中...</view>
      <view class="card-grid">
        <view v-for="(s,i) in spots" :key="s.spot_id" class="card" :style="s.image_path?'background-image:url('+fixImg(s.image_path)+')':''" @tap="openDetail(s)">
          <view class="card-overlay"></view>
          <view class="c-rank" :class="'r'+Math.min(i+1,3)">{{ i+1 }}</view>
          <view class="c-info">
            <text class="c-name">{{ s.spot_name }}</text>
            <text class="c-desc">{{ (s.description||s.location||'').substring(0,30) }}</text>
          </view>
          <view v-if="countsLoaded" class="c-like-count">
            <text class="iconfont icon-huore"></text>
            <text>{{ likes[s.spot_id]||0 }}</text>
          </view>
        </view>
      </view>
      <view style="height:40rpx"></view>
    </scroll-view>

    <!-- 详情抽屉 -->
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
          <view class="dp-row"><text>标签</text><text>{{ detailSpot.tags||'暂无' }}</text></view>
        </scroll-view>
        <view class="dp-like-bar">
          <view class="dpl-btn" :class="{on:liked[detailSpot.spot_id]}" @tap="toggleLike(detailSpot.spot_id)">
            <text class="iconfont icon-huore"></text>
            <text>{{ liked[detailSpot.spot_id]?'已收藏':'收藏' }}</text>
          </view>
          <view class="dpl-btn-star" @tap="toggleLike(detailSpot.spot_id)">
            <text>{{ liked[detailSpot.spot_id]?'★ 已收藏':'☆ 收藏景点' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { BASE_URL, assetUrl } from '../../common/config.js'

function req(o){return new Promise(function(rs,rj){uni.request({url:BASE_URL+o.url,method:o.method||'GET',data:o.data||{},header:{'Content-Type':'application/json','Authorization':'Bearer '+uni.getStorageSync('token')},success:function(r){if(r.statusCode===200&&r.data&&r.data.success)rs({data:r.data});else rj(new Error('请求失败'))},fail:rj})})}
export default {
  data:function(){return{title:'',type:'',spots:[],loading:true,detailSpot:null,liked:{},likes:{},countsLoaded:false,saving:false}},
  methods:{
    fixImg:function(u){if(!u)return'';return assetUrl(u)},
    openDetail:function(s){this.detailSpot=s;req({url:'/spot-favorites/history/'+s.spot_id,method:'PUT'}).catch(function(){uni.showToast({title:'浏览记录保存失败',icon:'none'})})},
    toggleLike:function(id){if(this.saving)return;var s=this;s.saving=true;req({url:'/spot-favorites/'+id,method:s.liked[id]?'DELETE':'PUT'}).then(function(r){s.liked={...s.liked,[id]:r.data.data.favorited};s.loadFavorites()}).catch(function(){uni.showToast({title:'收藏失败，请重试',icon:'none'})}).finally(function(){s.saving=false})},
    loadFavorites:function(){var s=this;req({url:'/spot-favorites'}).then(function(r){var liked={};r.data.data.spot_list.forEach(function(x){liked[x.spot_id]=true});s.liked=liked}).catch(function(){uni.showToast({title:'收藏状态加载失败',icon:'none'})});req({url:'/spot-favorites/counts'}).then(function(r){s.likes=r.data.data;s.countsLoaded=true}).catch(function(){s.countsLoaded=false})},
    goBack:function(){uni.navigateBack()},
    loadData:function(){var s=this
      var pages=getCurrentPages();var opts=pages[pages.length-1].options||{}
      var t=opts.type||'must';s.type=t;s.title=t==='must'?'探索景点':'景点图鉴';s.loadFavorites()
      req({url:'/tour-session/spots'}).then(function(r){
        var d=r.data;var list=(d&&d.data&&d.data.spot_list)?d.data.spot_list:(d&&d.spot_list)||[]
        list=list.filter(function(x){return x.image_path}).sort(function(a,b){return (b.visit_duration||0)-(a.visit_duration||0)})
        s.spots=list.slice(0,20);s.loading=false;if(opts.spotId){var selected=list.find(function(x){return x.spot_id===Number(opts.spotId)});if(selected)s.openDetail(selected)}
      }).catch(function(){s.loading=false})
    },
  },
  onLoad:function(){this.loadData()},
}
</script>

<style scoped>
.page{min-height:100vh;background-color:#f2f5fa;position:relative;overflow:hidden}
.ink-bg{position:absolute;inset:0;pointer-events:none;z-index:0}.ink-mt{position:absolute;left:0;right:0;background:#172033;border-radius:55% 75% 0 0}.ink-mt-1{bottom:20%;height:220rpx;opacity:.04;transform:scaleX(1.3)}.ink-mt-2{bottom:25%;height:160rpx;opacity:.025;transform:scaleX(1.5) translateX(-8%)}
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.nav{position:relative;z-index:1;display:flex;align-items:center;padding:50rpx 24rpx 16rpx;gap:16rpx}
.nav-back{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(59,91,255,.15);font-size:40rpx;color:#7b8599;flex-shrink:0}
.nav-title{flex:1;font-size:34rpx;font-weight:600;color:#172033;letter-spacing:0;font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;text-align:center}
.main{position:relative;z-index:1;padding:0 24rpx;height:calc(100vh - 130rpx);box-sizing:border-box;width:100%}.load{text-align:center;padding:80rpx;color:#7b8599}
.card-grid{display:flex;flex-wrap:wrap;gap:14rpx;justify-content:space-between}
.card{width:calc(50% - 7rpx);height:280rpx;padding:16rpx;background-color:#edf4f8;background-size:cover;background-position:center;border-radius:18rpx;box-sizing:border-box;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
.card-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1) 0%,rgba(0,0,0,.25) 50%,rgba(0,0,0,.65) 100%);z-index:1;border-radius:18rpx}
.c-rank{position:absolute;top:12rpx;left:12rpx;width:44rpx;height:44rpx;border-radius:12rpx;display:flex;align-items:center;justify-content:center;font-size:22rpx;font-weight:600;color:#f6f7fa;background:rgba(255,255,255,.15);z-index:2}
.c-rank.r1{background:linear-gradient(135deg,#3b5bff,#617bff)}
.c-rank.r2{background:rgba(59,91,255,.7)}
.c-rank.r3{background:rgba(116,125,145,.6)}
.c-info{z-index:2;position:relative}.c-name{font-size:26rpx;font-weight:600;color:#ffffff;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 2rpx 6rpx rgba(0,0,0,.4)}.c-desc{font-size:20rpx;color:rgba(255,255,255,.8);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2rpx}
.dp-body{padding:0 28rpx 16rpx;max-height:50vh;box-sizing:border-box}
.dp-body .dp-hero{width:100%;box-sizing:border-box}
.dp-body .dp-desc,.dp-body .dp-row{padding-right:0}

.drawer-overlay{position:fixed;inset:0;z-index:1000}.drawer-mask{position:absolute;inset:0;background:rgba(23,32,51,.4)}.drawer-panel{position:absolute;bottom:0;left:0;right:0;max-height:75vh;background:#ffffff;border-radius:28rpx 28rpx 0 0;overflow:hidden}.dp-handle{width:56rpx;height:5rpx;border-radius:3rpx;background:rgba(89,100,123,.2);margin:14rpx auto 8rpx}.dp-hd{display:flex;justify-content:space-between;padding:8rpx 28rpx 14rpx}.dp-title{font-size:30rpx;font-weight:600;color:#172033}.dp-close{font-size:32rpx;color:#7b8599}.dp-body{padding:0 28rpx 16rpx;max-height:50vh}.dp-hero{width:100%;height:260rpx;border-radius:14rpx;margin-bottom:16rpx}.dp-desc{font-size:24rpx;color:#3f4657;line-height:1.7;display:block;margin-bottom:18rpx}.dp-row{display:flex;padding:14rpx 0;border-top:1rpx solid rgba(89,100,123,.08)}.dp-row text:first-child{font-size:22rpx;color:#7b8599;width:80rpx;flex-shrink:0}.dp-row text:last-child{font-size:22rpx;color:#172033;flex:1}
.dp-like-bar{display:flex;gap:12rpx;padding:12rpx 28rpx 20rpx;padding-bottom:calc(20rpx + env(safe-area-inset-bottom))}
.dpl-btn-star{flex:1;padding:18rpx;text-align:center;border-radius:14rpx;background:linear-gradient(135deg,#3b5bff,#617bff);color:#f6f7fa;font-size:26rpx;font-weight:700}
.c-like-count{position:absolute;bottom:10rpx;right:10rpx;display:flex;align-items:center;gap:4rpx;font-size:18rpx;color:rgba(255,255,255,.7);z-index:2}.c-like-count .iconfont{font-size:22rpx}
.c-badge{position:absolute;top:10rpx;right:10rpx;z-index:2;padding:4rpx 12rpx;border-radius:8rpx;background:linear-gradient(135deg,#3b5bff,#617bff);color:#f6f7fa;font-size:18rpx;font-weight:600}
</style>
