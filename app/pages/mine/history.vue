<template>
  <view class="page">
    <view class="nav" :style="{paddingTop:headerTop+'px'}"><text class="nav-back" @tap="goBack">‹</text><text class="nav-title">{{ t("游览记录") }}</text></view>
    <scroll-view scroll-y class="main">
      <view v-if="loading" class="empty">{{ t("加载中…") }}</view>
      <view v-else-if="error" class="empty" @tap="loadData">{{ t(error) }}{{ t("，点击重试") }}</view>
      <view v-else-if="list.length===0" class="empty"><image class="empty-art" src="/static/empty-state.png" mode="widthFix"></image><text>{{ t("暂无导览历史，开始导览后会自动记录") }}</text></view>
      <view v-for="s in list" :key="s.session_id" class="card" @tap="openSession(s)">
        <view class="c-info">
          <text class="c-name">{{ t(s.city) ? t(s.city)+' · ' : '' }}{{ t(s.name) }}</text>
          <text class="c-desc">{{ (s.spot_names || []).map(function(n){ return t(n) }).join(' → ') }}</text>
          <text class="c-desc">{{ s.live_status===2 ? t('已结束') : s.live_status===1 ? t('进行中') : t('未开始') }}</text>
          <text class="c-time">{{ t('开始：') }}{{ s.start_time }}</text><text v-if="s.end_time" class="c-time">{{ t('结束：') }}{{ s.end_time }}</text>
        </view>
      </view>
      <view v-if="selected" class="history-detail">
        <text class="c-name">{{ t(selected.name) }} · {{ t('· 对话记录') }}</text>
        <view class="history-close" @tap="selected=null">{{ t("关闭") }}</view>
        <view v-if="messagesLoading" class="empty">{{ t("对话加载中…") }}</view>
        <view v-else-if="messagesError" class="empty" @tap="openSession(selected)">{{ t(messagesError) }}{{ t('，点击重试') }}</view>
        <view v-else-if="!messages.length" class="empty">{{ t("这次导览暂无对话记录") }}</view>
        <view v-for="(m,i) in messages" :key="i" class="history-message"><text class="c-desc">{{ m.role==='user' ? t('我') : t('导游') }} · {{ m.send_time }}</text><text class="message-text">{{ m.message }}</text></view>
      </view>
    </scroll-view>
  </view>
</template>
<script>
import { BASE_URL } from '../../common/config.js'
export default {
  data:function(){return{headerTop:48,list:[],loading:false,error:'',selected:null,messages:[],messagesLoading:false,messagesError:''}},
  onLoad:function(){var info=uni.getSystemInfoSync();this.headerTop=Math.max(info.statusBarHeight||0,info.safeArea&&info.safeArea.top||0)+16},
  methods:{
    goBack:function(){uni.navigateBack()},
    openSession:function(s){this.selected=s;this.messages=[];this.messagesLoading=true;this.messagesError='';uni.request({url:BASE_URL+'/tour-session/my-history/'+s.session_id+'/messages',header:{Authorization:'Bearer '+uni.getStorageSync('token')},success:r=>{if(!this.selected||this.selected.session_id!==s.session_id)return;if(r.statusCode===200&&r.data.success)this.messages=r.data.data.messages;else this.messagesError='对话加载失败'},fail:()=>{if(this.selected&&this.selected.session_id===s.session_id)this.messagesError='对话加载失败'},complete:()=>{if(this.selected&&this.selected.session_id===s.session_id)this.messagesLoading=false}})},
    loadData:function(){this.loading=true;this.error='';uni.request({url:BASE_URL+'/tour-session/my-history',header:{Authorization:'Bearer '+uni.getStorageSync('token')},success:r=>{if(r.statusCode===200&&r.data.success)this.list=r.data.data.session_list;else this.error=r.statusCode===401?'请重新登录':'记录加载失败'},fail:()=>{this.error='记录加载失败'},complete:()=>{this.loading=false}})},
  },
  onShow:function(){this.loadData()},
}
</script>
<style scoped>
.page{height:100vh;display:flex;flex-direction:column;background-color:var(--ng-surface);position:relative;overflow:hidden}
.ink-bg{position:absolute;inset:0;pointer-events:none;z-index:0}.ink-mt{position:absolute;left:0;right:0;background:var(--ng-night);border-radius:55% 75% 0 0}.ink-mt-1{bottom:20%;height:220rpx;opacity:.04;transform:scaleX(1.3)}.ink-mt-2{bottom:25%;height:160rpx;opacity:.025;transform:scaleX(1.5) translateX(-8%)}
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.nav{position:relative;z-index:1;display:flex;flex-shrink:0;align-items:center;padding:50rpx 24rpx 16rpx}
.nav-back{font-size:56rpx;color:var(--ng-text);padding-right:20rpx;line-height:1}
.nav-title{flex:1;font-size:34rpx;font-weight:600;color:var(--ng-text);letter-spacing:0;font-family:var(--app-font-family);text-align:center}
.main{position:relative;z-index:1;padding:0 24rpx;height:0;min-height:0;flex:1;box-sizing:border-box;width:100%}
.empty{text-align:center;padding:100rpx;color:var(--ng-secondary);font-size:28rpx}
.card{display:flex;align-items:center;gap:14rpx;padding:16rpx 18rpx;margin-bottom:14rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:18rpx}
.c-img{width:88rpx;height:88rpx;border-radius:14rpx;flex-shrink:0}.c-img-df{width:88rpx;height:88rpx;border-radius:14rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);font-size:36rpx;flex-shrink:0}
.c-info{flex:1;min-width:0}.c-name{font-size:28rpx;font-weight:600;color:var(--ng-text);display:block}.c-desc{font-size:22rpx;color:var(--ng-secondary);display:block;margin-top:4rpx}.c-time{font-size:20rpx;color:var(--ng-secondary);margin-top:4rpx;display:block}
.history-detail{padding:24rpx;background:var(--ng-surface);border-radius:18rpx;margin-bottom:30rpx}.history-close{padding:18rpx 0;color:var(--ng-secondary)}.history-message{padding:20rpx 0;border-bottom:1rpx solid var(--ng-border)}.message-text{display:block;font-size:28rpx;line-height:1.7;margin-top:8rpx}
.empty-art{width:280rpx;margin:0 auto 16rpx;opacity:.95}</style>
