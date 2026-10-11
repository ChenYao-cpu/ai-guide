<template>
  <view class="page aurora-page">
    <view class="aurora-background" aria-hidden="true"><view class="aurora-wave aurora-wave-one"></view><view class="aurora-wave aurora-wave-two"></view><view class="aurora-shine"></view></view>

    <view class="ink-bg"><view class="ink-mountain ink-mt-1"></view><view class="ink-mountain ink-mt-2"></view></view>

    <!-- 毛体标题 -->
    <view class="nav" :style="{paddingTop:statusH+'px',height:(statusH+44)+'px'}"><BrandLogo /></view>
    <!-- 双按钮切换 -->
    <view class="top-tabs">
      <view class="tt-item" :class="{on:tab==='route'}" @tap="switchPlanningTab('route')">
        <text class="iconfont icon-zuobiao tt-icon"></text>
        <text class="tt-label">游览路线</text>
      </view>
      <view class="tt-item" :class="{on:tab==='personal'}" @tap="switchPlanningTab('personal')">
        <text class="iconfont icon-xueshengdenglu tt-icon"></text>
        <text class="tt-label">个性化</text>
      </view>
    </view>

    <scroll-view scroll-y class="main" :style="{height:mainHeight+'px'}" :scroll-into-view="selectionTarget" scroll-with-animation>
      <!-- 沉浸式 Hero Banner -->
      <view class="hero-banner">
        <image v-if="heroImage" :src="heroImage" class="hero-bg" mode="aspectFill" />
        <view v-else class="hero-bg-fallback"></view>
        <view class="hero-overlay"></view>
        <view class="hero-content">
          <view class="hero-meta">
            <text class="hero-date">{{ heroDate }}</text>

          </view>
          <text class="hero-title">{{ heroCity }}</text>

        </view>
        <view class="hero-route-card" @tap="heroRouteTap">
          <view class="hrc-left">
            <text class="iconfont icon-zuobiao hrc-icon"></text>
            <view class="hrc-info">
              <text class="hrc-label">推荐路线</text>
              <text class="hrc-name">{{ heroRouteName }}</text>
            </view>
          </view>
          <text class="iconfont icon-left hrc-arrow"></text>
        </view>
      </view>
      <view v-if="loading" class="load">加载中...</view>
      <view v-if="error" class="err"><text>{{error}}</text><view class="retry" @tap="loadData">重试</view></view>

      <!-- ===== 游览路线 ===== -->
      <view v-show="tab==='route'">
        <view class="block">
          <view class="bl-hd"><view class="bl-dot"></view><text>景区地图</text></view>
          <view class="map-wrap">
            <map v-if="spots.length" class="mini-map" :latitude="mapCenter.latitude" :longitude="mapCenter.longitude" :markers="mapMarkers" :scale="12" @markertap="onMarkerTap"></map>
            <view v-else class="map-empty">暂无景点</view>
          </view>
        </view>

        <view class="block" v-if="routes.length">
          <view class="bl-hd"><view class="bl-dot"></view><text>导览路线</text></view>
          <view class="route-carousel-wrap">
            <swiper class="route-carousel" :current="routeIndex" @change="routeIndex=$event.detail.current" :autoplay="routes.length > 1 && !routeDetail" :interval="4500" :indicator-dots="routes.length > 1" :circular="routes.length > 1" indicator-color="#64748b" indicator-active-color="#ffffff" :duration="350">
              <swiper-item v-for="r in routes" :key="r.route_id" class="route-slide">
                <view class="route-card" :class="{on:pickedRouteId===r.route_id}" @tap="openRoute(r)">
                  <image v-if="r.cover_image" :src="fixImg(r.cover_image)" class="route-cover-photo" mode="aspectFill" />
                  <view v-else class="route-cover-empty">暂无路线图片</view>
                  <view class="route-cover-shade"></view>
                  <view class="rc-top"><text class="rc-tag"><text class="iconfont" :class="themeIcon(r.theme)"></text> {{ themeMap[r.theme]||'综合' }}</text><text class="rc-time">{{ r.estimated_time_minutes ? r.estimated_time_minutes+'分钟' : '时长待配置' }}</text></view>
                  <view class="rc-bottom">
                    <text v-if="r.cover_generated" class="route-cover-note">AI路线示意图</text>
                    <text class="rc-name">{{ r.city ? r.city+' · ' : '' }}{{ r.name }}</text>
                    <text class="rc-meta">{{ (r.spot_ids||[]).length }}个景点</text>
                  </view>
                </view>
              </swiper-item>
            </swiper>
            <view v-if="routes.length > 1" class="route-arrow route-arrow-left" @tap.stop="switchRoute(-1)"><text class="iconfont icon-zuoyoujiantou"></text></view>
            <view v-if="routes.length > 1" class="route-arrow route-arrow-right" @tap.stop="switchRoute(1)"><text class="iconfont icon-left"></text></view>
          </view>
        </view>

        <view class="block">
          <view class="bl-hd"><view class="bl-dot"></view><text>景点选择</text><text class="sub">{{ pickedCount }}/{{ filteredSpots.length }}</text></view>
          <view class="search-row"><input class="search-input" v-model="keyword" placeholder="搜索景点或城市"/></view>
          <scroll-view scroll-x class="cat-tabs">
            <text v-for="c in spotCats" :key="c.value" class="cat-tab" :class="{on:spotCat===c.value}" @tap="spotCat=c.value">{{ c.label }}</text>
          </scroll-view>
          <view class="spot-list" v-if="filteredSpots.length">
            <view v-for="s in filteredSpots" :key="s.spot_id" class="spot-card" :class="{on:isPicked(s.spot_id)}">
              <image v-if="s.image_path" :src="fixImg(s.image_path)" class="sc-img" mode="aspectFill"></image>
              <view v-else class="sc-img-df"></view>
              <view class="sc-body" @tap="toggleSpot(s.spot_id)">
                <view class="sc-info"><text class="sc-name">{{ s.spot_name }}</text><text class="sc-cat">{{ s.city ? s.city+' · ' : '' }}{{ s.category||'景点' }}</text></view>
              </view>
              <view class="sc-btn" @tap="openDetail(s)">详情</view>
            </view>
          </view>
          <view class="empty" v-else-if="!loading">暂无景点</view>
        </view>
      </view>

      <view v-if="tab==='route'&&pickedCount>0&&!canStart" class="selection-next" @tap="goSelectGuide">选择导游</view>
      <!-- ===== 个性化 ===== -->
      <view v-show="tab==='personal'">
        <view class="block">
          <view id="guide-selection" class="bl-hd"><view class="bl-dot"></view><text>数字人形象</text></view>
          <view class="guide-grid" v-if="guides.length">
            <view v-for="g in guides" :key="g.guide_id" class="guide-card" :class="{on:pickedGuide&&pickedGuide.guide_id===g.guide_id}" @tap="pickedGuide=g">
              <image v-if="guideImage(g)" :src="guideImage(g)" class="gc-image" mode="aspectFit" @error="imageFailed(g)" />
              <view v-else-if="g.model3dUrl" class="gc-empty">暂无预览</view>
              <view v-else class="gc-empty">{{ g.previewLoading ? '正在加载形象…' : '形象未配置' }}</view>
              <view v-if="g.model3dUrl||guideImage(g)||g.base_mp4_path" class="gc-preview" @tap.stop="previewGuide(g)">预览</view>
              <view class="gc-name">{{ g.name }}{{ pickedGuide&&pickedGuide.guide_id===g.guide_id ? ' · 已选择' : '' }}</view>
            </view>
          </view>
          <view class="empty" v-else-if="!loading">暂无导游</view>

        </view>

        <view class="block">
          <view class="bl-hd"><view class="bl-dot"></view><text>游览偏好</text></view>
          <view class="pref-wrap">
            <view v-for="p in prefs" :key="p.value" class="pref-chip" :class="{on:pickedPrefs.indexOf(p.value)>=0}" @tap="togglePref(p.value)"><text class="iconfont" :class="p.cls"></text><text> {{ p.label }} · {{ preferenceCount(p.value) }}</text></view>
          </view>
          <view class="planner-note">{{ spots.length }} 个景点可规划；兴趣多选，综合单选。亲子路线少台阶。</view>
          <picker :range="budgetOptions" :value="budgetIndex" @change="changeBudget"><view class="planner-control">可用时长：{{ budgetOptions[budgetIndex] }} 分钟</view></picker>
          <picker :range="['正常游览','轻松慢走 · 少台阶']" :value="paceIndex" @change="changePace"><view class="planner-control">步行节奏：{{ paceIndex ? '轻松慢走 · 少台阶' : '正常游览' }}</view></picker>
          <view class="planner-generate" @tap="generatePersonalPlan">{{ recommending ? '正在规划…' : '生成个性化路线' }}</view>
          <view v-if="personalPlan" class="planner-result">
            <view>{{ personalPlan.spot_count }} 个景点 · 合计 {{ personalPlan.estimated_time_minutes }} 分钟</view>
            <view class="planner-note">停留 {{ personalPlan.visit_time_minutes }} · 步行 {{ personalPlan.walking_time_minutes }} · 休息 {{ personalPlan.rest_time_minutes }} 分钟</view>
            <view v-for="(item,index) in personalPlan.score_details" :key="item.spot_id" class="planner-stop"><text>{{ index+1 }} {{ item.spot_name }}</text><text class="planner-note">{{ item.reason }}</text></view>
            <view class="planner-note">{{ personalPlan.data_basis }} {{ personalPlan.planning_note }} 步行路网：OpenStreetMap contributors（ODbL）。</view>
          </view>
        </view>
      </view>

      <view style="height:120rpx"></view>
    </scroll-view>

    <view v-if="previewingGuide" class="drawer-overlay" @tap="previewingGuide=null">
      <view class="drawer-mask"></view>
      <view class="drawer-panel guide-preview-panel" @tap.stop="">
        <view class="dp-hd"><text class="dp-title">{{ previewingGuide.name }}</text><text class="dp-close" @tap="previewingGuide=null">✕</text></view>
        <view v-if="previewPhoto(previewingGuide)" class="guide-preview-half"><image :key="previewingGuide.guide_id" :src="previewPhoto(previewingGuide)" class="guide-preview-photo" mode="widthFix" @load="previewModelReady" @error="previewImageError" /></view>
        <text v-if="previewModelStatus" class="guide-description">{{ previewModelStatus }}</text>
        <text class="guide-description">{{ previewingGuide.character || '暂无角色介绍' }}</text>
        <text class="guide-description">{{ previewingGuide.previewMessage }}</text>
      </view>
    </view>
    <view v-if="guidePicker" class="drawer-overlay" @tap="guidePicker=false"><view class="drawer-mask"></view><view class="drawer-panel" @tap.stop=""><view class="dp-hd"><text class="dp-title">选择数字人</text><text @tap="guidePicker=false">关闭</text></view><view class="guide-grid"><view v-for="g in guides" :key="g.guide_id" class="guide-card" @tap="pickedGuide=g;guidePicker=false"><image v-if="guideImage(g)" :src="guideImage(g)" class="gc-image" mode="aspectFit" /><view class="gc-name">{{ g.name }}</view></view></view></view></view>
    <!-- 悬浮开始按钮 -->
    <view class="fab-btn" :class="{show:canStart}" @tap="startTour">
      <text class="fab-icon">▶</text>
      <text class="fab-text">{{ pickedCount||'' }}</text>
    </view>

    <!-- 景点详情 -->
    <view class="drawer-overlay" v-if="detailSpot" @tap="detailSpot=null">
      <view class="drawer-mask"></view>
      <view class="drawer-panel" @tap.stop="">
        <view class="dp-handle"></view>
        <view class="dp-hd"><text class="dp-title">景点详情</text><text class="dp-close" @tap="detailSpot=null">✕</text></view>
        <scroll-view scroll-y class="dp-body"><view class="dp-content">
          <view v-if="detailSpot.image_path" class="scenic-fade"><image :src="fixImg(detailSpot.image_path)" class="scenic-clear" mode="aspectFill" /><image :src="fixImg(detailSpot.image_path)" class="scenic-blur" mode="aspectFill" /><view class="scenic-veil"></view></view>
          <text class="dp-name">{{ detailSpot.spot_name }}</text>
          <text class="dp-desc">{{ detailSpot.description||'暂无简介' }}</text>
          <view class="dp-row"><text>位置</text><text>{{ detailSpot.city ? detailSpot.city+' · ' : '' }}{{ detailSpot.location||'暂无' }}</text></view>
        </view></scroll-view>
        <view class="dp-btn" :class="{added:isPicked(detailSpot.spot_id)}" @tap="toggleSpot(detailSpot.spot_id);detailSpot=null">
          <text>{{ isPicked(detailSpot.spot_id)?'✓ 取消选择':'加入选择' }}</text>
        </view>
      </view>
    </view>

    <!-- 路线时间轴抽屉 -->
    <view class="drawer-overlay" v-if="routeDetail" @tap="routeDetail=null">
      <view class="drawer-mask"></view>
      <view class="drawer-panel route-detail-panel" @tap.stop="">
        <view v-if="routeDetail.cover_image" class="route-detail-background"><image :src="fixImg(routeDetail.cover_image)" class="route-detail-photo" mode="aspectFill" /><image :src="fixImg(routeDetail.cover_image)" class="route-detail-photo route-detail-blur" mode="aspectFill" /><view class="route-detail-wash"></view></view>
        <view class="dp-handle"></view>
        <view class="dp-hd"><text class="dp-title">{{ routeDetail.city ? routeDetail.city+' · ' : '' }}{{ routeDetail.name }}</text><text class="dp-close" @tap="routeDetail=null">✕</text></view>
        <scroll-view scroll-y class="dp-body"><view class="dp-content">
          <view class="rd-tag"><text class="iconfont" :class="themeIcon(routeDetail.theme)"></text> {{ themeMap[routeDetail.theme]||'综合' }} · {{ (routeDetail.spot_ids||[]).length }}个景点 · {{ routeTotalTime ? routeTotalTime+'分钟' : '时长待配置' }}</view>
          <text class="rd-desc">{{ routeDetail.description||'' }}</text>
          <!-- 竖点时间轴 -->
          <view class="timeline">
            <view v-for="(s,i) in routeSpots" :key="s.spot_id" class="tl-item">
              <view class="tl-left">
                <view class="tl-dot" :class="{start:i===0,end:i===routeSpots.length-1}">{{ i+1 }}</view>
                <view class="tl-line" v-if="i<routeSpots.length-1">
                  <view class="tl-pulse"></view>
                  <view class="tl-pulse" style="animation-delay:.75s"></view>
                </view>
              </view>
              <view class="tl-card">
                <image v-if="s.image_path" :src="fixImg(s.image_path)" class="tlc-img" mode="aspectFill"></image>
                <view v-else class="tlc-img-df"></view>
                <view class="tlc-info">
                  <text class="tlc-name">{{ s.spot_name }}</text>
                  <text class="tlc-cat">{{ s.city ? s.city+' · ' : '' }}{{ s.category||'景点' }} · {{ s.visit_duration ? '预计'+s.visit_duration+'分钟' : '时长待配置' }}</text>
                </view>
              </view>
            </view>
          </view>
        </view></scroll-view>
        <view class="dp-actions">
          <view class="dpa-btn pick" :class="{on:pickedRouteId===routeDetail.route_id}" @tap="pickRoute(routeDetail)">
            <text>{{ pickedRouteId===routeDetail.route_id ? '✓ 已选此路线' : '选择此路线' }}</text>
          </view>
          <view class="dpa-btn start" @tap="goSelectGuide" v-if="pickedRouteId===routeDetail.route_id&&!canStart">
            <text>去选数字人形象</text>
          </view>
          <view class="dpa-btn start" @tap="startTour()" v-if="pickedRouteId===routeDetail.route_id&&canStart">
            <text>开始导览</text>
          </view>
        </view>
      </view>
    </view>

    <!-- TabBar -->
      <view class="tb-root">
        <view class="tb-ink-line"></view>
        <view class="tb-inner">

          <view class="tb-item highlight on"><view class="tb-hl-ring on"><text class="tb-icon iconfont icon-daolan"></text></view><text class="tb-label">智能导览</text><view class="tb-dot"></view></view>
          <view class="tb-item highlight" @tap="goTab('/pages/ai-chat/ai-chat')"><view class="tb-hl-ring"><text class="tb-icon iconfont icon-aishuziren"></text></view><text class="tb-label">AI小导游</text></view>
          <view class="tb-item highlight" @tap="goTab('/pages/mine/mine')"><view class="tb-hl-ring"><text class="tb-icon iconfont icon-wode1"></text></view><text class="tb-label">我的</text></view>
        </view>
        <view class="tb-safe"></view>
      </view>
  </view>
</template>

<script>
import BrandLogo from '../../components/BrandLogo.vue'
import { BASE_URL, assetUrl } from '../../common/config.js'
import { wgs84ToGcj02 } from '../../../shared/coordinates.js'

function req(o){return new Promise(function(rs,rj){var u=o.url;if(u.indexOf('http')!==0)u=BASE_URL+u;uni.request({url:u,method:o.method||'GET',data:o.data||{},header:Object.assign({'Content-Type':'application/json'},uni.getStorageSync('token')?{Authorization:'Bearer '+uni.getStorageSync('token')}:{}),success:function(r){if(r.statusCode===200)rs({data:r.data});else rj(new Error('HTTP '+r.statusCode))},fail:rj})})}
var api={
  getSpots:function(){return req({url:'/tour-session/spots'})},
  getGuides:function(){return req({url:'/tour-session/guides'})},
  getRoutes:function(){return req({url:'/tour-session/routes'})},
  createSession:function(n,g,p,s){return req({url:'/tour-session/visitor-create?name='+encodeURIComponent(n||'游客')+'&guide_id='+(g||1)+'&visitor_preferences='+encodeURIComponent(p||'')+'&spot_ids='+encodeURIComponent(JSON.stringify(s||[])),method:'POST'})},
}
export default {
  components: { BrandLogo },
  onReady:function(){
    // #ifdef MP-WEIXIN
    if(wx.hideHomeButton)wx.hideHomeButton()
    // #endif
  },
  data:function(){return{statusH:20,mainHeight:500,
    previewWidth:0,previewPixelRatio:1,previewModelStatus:'',selectionTarget:'',previewingGuide:null,tab:'route',routeIndex:0,spots:[],routes:[],guides:[],pickedIds:{},pickedRouteId:null,pickedGuide:null,pickedPrefs:[],loading:true,error:'',detailSpot:null,keyword:'',routeDetail:null,themeMap:{comprehensive:'综合',history:'历史',nature:'自然',family:'亲子',photography:'摄影'},
    mapCenter:{latitude:0,longitude:0},spotCat:'all',guidePicker:false,planningDrafts:{route:null,personal:null},personalPlan:null,recommending:false,budgetIndex:2,budgetOptions:[60,90,120,180,240,360],paceIndex:0,
    spotCats:[{value:'all',label:'全部'},{value:'natural',label:'自然'},{value:'cultural',label:'文化'},{value:'historical',label:'历史'}],
    prefs:[{value:'history',cls:'icon-lishiwenhua',label:'历史文化'},{value:'nature',cls:'icon-ziranfengguang',label:'自然风光'},{value:'photography',cls:'icon-cam-3',label:'拍照打卡'},{value:'family',cls:'icon-qinzi',label:'亲子'},{value:'comprehensive',cls:'icon-youlan',label:'综合'}],
  }},
  computed:{
    canStart:function(){return this.pickedCount>0&&!!this.pickedGuide&&!this.recommending},
    pickedCount:function(){return Object.keys(this.pickedIds).length},
    filteredSpots:function(){var s=this;var kw=(s.keyword||'').toLowerCase();var list=s.spots;if(s.spotCat!=='all')list=list.filter(function(x){return x.category===s.spotCat});if(kw)list=list.filter(function(x){return(x.spot_name||'').indexOf(kw)>=0||(x.location||'').indexOf(kw)>=0||(x.tags||'').indexOf(kw)>=0});return list},
    mapMarkers:function(){var s=this;return s.spots.filter(function(x){return x.latitude&&x.longitude}).map(function(x,i){var picked=s.isPicked(x.spot_id);var point=wgs84ToGcj02(Number(x.latitude),Number(x.longitude));return{id:x.spot_id||i,latitude:point[0],longitude:point[1],width:28,height:28,iconPath:picked?'/static/pin-blue.png':'/static/pin-red.png',title:x.spot_name,callout:{content:x.spot_name,display:'BYCLICK',fontSize:11,borderRadius:5,padding:5}}})},
    routeSpots:function(){var s=this;if(!s.routeDetail)return[];var ids=s.routeDetail.spot_ids||[];return ids.map(function(id){return s.spots.find(function(x){return x.spot_id===id})}).filter(Boolean)},
    routeTotalTime:function(){return this.routeDetail&&this.routeDetail.estimated_time_minutes||null},
    heroImage:function(){var s=this.spots.find(function(x){return x.image_path});return s?this.fixImg(s.image_path):''},
    heroCity:function(){var s=this.spots.find(function(x){return x.city});return s?s.city:'智游灵境'},
    heroDate:function(){var d=new Date();var w=['日','一','二','三','四','五','六'];return(d.getMonth()+1)+'月'+d.getDate()+'日 星期'+w[d.getDay()]},
    heroRouteName:function(){if(this.routes.length){var r=this.routes[0];return(r.city?r.city+' · ':'')+r.name}return'探索精选路线'},
  },
  mounted:function(){var info=uni.getSystemInfoSync();this.statusH=info.statusBarHeight||20;this.mainHeight=Math.max(240,info.windowHeight-this.statusH-44-uni.upx2px(100)-uni.upx2px(150)-(info.safeAreaInsets&&info.safeAreaInsets.bottom||0))},
  methods:{
    heroRouteTap:function(){if(this.routes.length){this.openRoute(this.routes[0])}else{uni.showToast({title:'路线加载中…',icon:'none'})}},
    fixImg:function(u){if(!u)return'';return assetUrl(u)},
    guideImage:function(g){return this.fixImg(g.poster_image||g.avatar||g.previewUrl)},
    previewPhoto:function(g){return this.fixImg(g.avatar||g.poster_image||g.previewUrl)},
    imageFailed:function(g){if(g.poster_image){g.poster_image='';return}if(g.avatar){g.avatar='';return}g.previewUrl='';g.previewMessage='形象加载失败'},
    previewGuide:function(g){this.previewModelStatus=this.guideImage(g)?'正在加载形象图片':'暂无预览';this.previewingGuide=g},
    previewModelReady:function(){this.previewModelStatus=''},
    previewImageError:function(){this.previewModelStatus='形象图片加载失败，请关闭预览后重试'},
    previewModelError:function(e){this.previewModelStatus=e.detail&&e.detail.message||'3D模型加载失败，请重试';uni.showToast({title:e.detail&&e.detail.message||'3D模型加载失败，请重试',icon:'none'})},
    previewVideoError:function(){uni.showToast({title:'形象视频播放失败，请检查素材',icon:'none'})},
    loadGuidePreview:function(g){if(g.render_mode==='xingyun'){g.model3dUrl='';g.previewLoading=false;g.previewMessage='星云 · '+(g.voice_label||'默认音色');return}var s=this;req({url:'/avatar/capabilities/'+g.guide_id}).then(function(r){if(!r.data.success)throw new Error(r.data.message);var c=r.data.data;g.model3dUrl=c.preferredMode==='3d'&&c.threeD&&c.threeD.ready?c.threeD.modelUrl:'';g.previewUrl=c.cartoon&&c.cartoon.previewUrl||'';g.previewMessage=c.preferredMode==='3d'&&c.threeD&&c.threeD.ready?'3D · '+c.threeD.name:c.realistic.ready?c.realistic.message:(c.cartoon.ready?c.cartoon.message:c.realistic.message+'；'+c.cartoon.message)}).catch(function(){g.previewMessage='数字人状态查询失败，请重试'}).finally(function(){g.previewLoading=false})},
    goTab:function(p){uni.reLaunch({url:p})},
    isPicked:function(id){return!!this.pickedIds[id]},
    toggleSpot:function(id){var selected=this.spots.filter(x=>this.pickedIds[x.spot_id]);var next=this.spots.find(x=>x.spot_id===id);if(!this.pickedIds[id]){if(!next||!next.city){uni.showToast({title:'景点所属城市待配置',icon:'none'});return}if(selected.some(x=>x.city!==next.city)){uni.showToast({title:'一次导览只能选择同一城市',icon:'none'});return}}this.pickedRouteId=null;if(this.tab==='personal')this.personalPlan=null;var n={};Object.keys(this.pickedIds).forEach(function(k){n[k]=true});if(n[id])delete n[id];else n[id]=true;this.pickedIds=n;var s=this;var spot=s.spots.find(function(x){return x.spot_id===id});if(spot)s.saveHistory(spot)},
    pickRoute:function(r){this.pickedRouteId=r.route_id;var i={};(r.spot_ids||[]).forEach(function(id){i[id]=true});this.pickedIds=i},
    switchPlanningTab:function(next){if(next===this.tab)return;this.planningDrafts[this.tab]={ids:this.pickedIds,routeId:this.pickedRouteId,guide:this.pickedGuide};var draft=this.planningDrafts[next]||{ids:{},routeId:null,guide:null};this.pickedIds=draft.ids;this.pickedRouteId=draft.routeId;this.pickedGuide=draft.guide;this.tab=next},
    invalidatePlan:function(){this.personalPlan=null;if(this.tab==='personal')this.pickedIds={};else if(this.planningDrafts.personal)this.planningDrafts.personal.ids={}},
    togglePref:function(v){if(this.recommending)return;if(v==='comprehensive'){this.pickedPrefs=this.pickedPrefs.indexOf(v)>=0?[]:[v]}else{var list=this.pickedPrefs.filter(function(x){return x!=='comprehensive'});this.pickedPrefs=list.indexOf(v)>=0?list.filter(function(x){return x!==v}):list.concat(v)}this.invalidatePlan()},
    preferenceCount:function(v){return this.spots.filter(function(s){var p=s.preference_profile;return v==='comprehensive'||p&&p.affinities[v]>=3&&(v!=='family'||!p.stairs)}).length},
    changeBudget:function(e){if(this.recommending)return;this.budgetIndex=Number(e.detail.value);this.invalidatePlan()},
    changePace:function(e){if(this.recommending)return;this.paceIndex=Number(e.detail.value);this.invalidatePlan()},
    generatePersonalPlan:function(){var s=this;if(s.recommending)return;if(!s.pickedPrefs.length){uni.showToast({title:'请选择游览偏好',icon:'none'});return}s.recommending=true;req({url:'/tour-routes/recommend',method:'POST',data:{preferences:s.pickedPrefs.slice(),time_budget_minutes:s.budgetOptions[s.budgetIndex],pace:s.paceIndex?'relaxed':'standard',start_area:'auto'}}).then(function(r){var b=r.data;if(b.code!==0||!b.data||!b.data.spot_ids.length){uni.showToast({title:b.message||'暂无匹配路线',icon:'none'});return}s.personalPlan=b.data;var ids={};b.data.spot_ids.forEach(function(id){ids[id]=true});if(s.tab==='personal'){s.pickedIds=ids;s.pickedRouteId=null}else{var draft=s.planningDrafts.personal||{guide:null};s.planningDrafts.personal={ids:ids,routeId:null,guide:draft.guide}}}).catch(function(){uni.showToast({title:'规划失败，请检查服务',icon:'none'})}).finally(function(){s.recommending=false})},
    openDetail:function(s){this.detailSpot=s;this.saveHistory(s)},
    saveHistory:function(s){try{var raw=uni.getStorageSync('view_history')||'[]';var list=JSON.parse(raw);list=list.filter(function(x){return x.spot_id!==s.spot_id});list.unshift({spot_id:s.spot_id,spot_name:s.spot_name,image_path:s.image_path||'',location:s.location||'',viewTime:new Date().toLocaleString()});if(list.length>50)list=list.slice(0,50);uni.setStorageSync('view_history',JSON.stringify(list))}catch(e){}},
    themeIcon:function(t){var m={comprehensive:'icon-youlan',history:'icon-lishiwenhua',nature:'icon-ziranfengguang',family:'icon-qinzi',photography:'icon-cam-3'};return m[t]||'icon-youlan'},
    switchRoute:function(direction){if(this.routes.length>1)this.routeIndex=(this.routeIndex+direction+this.routes.length)%this.routes.length},
    openRoute:function(r){this.routeDetail=r},
    goSelectGuide:function(){this.routeDetail=null;this.guidePicker=true},
    startTour:function(){var s=this;if(!s.pickedCount){uni.showToast({title:'请选择景点',icon:'none'});return}
      if(s.recommending)return
      var ids=s.tab==='personal'&&s.personalPlan?s.personalPlan.spot_ids:Object.keys(s.pickedIds).map(Number),gid=s.pickedGuide?s.pickedGuide.guide_id:0
      if(!gid){uni.showToast({title:'请选择数字人形象',icon:'none'});return}
      api.createSession('游客导览',gid,s.tab==='personal'?s.pickedPrefs.join(','):'',ids).then(function(r){
        var sid=null;if(r&&r.data&&r.data.data&&r.data.data.session_id)sid=r.data.data.session_id;else if(r&&r.data&&r.data.session_id)sid=r.data.session_id
        if(sid&&r.data.data&&r.data.data.avatar_access_token)uni.setStorageSync('xingyun-tour-'+sid,r.data.data.avatar_access_token);if(sid)return req({url:'/tour-session/start/'+sid,method:'PUT'}).then(function(start){if(!start.data.success){uni.showToast({title:start.data.message||'开始导览失败',icon:'none'});return}uni.navigateTo({url:'/pages/tour/tour?sessionId='+sid})});else uni.showToast({title:r&&r.data&&r.data.message||'创建失败',icon:'none'})
      }).catch(function(){uni.showToast({title:'网络异常',icon:'none'})})},
    loadData:function(){var s=this;s.loading=true;s.error=''
      Promise.all([api.getGuides().catch(function(){return null}),api.getSpots().catch(function(){return null}),api.getRoutes().catch(function(){return null})]).then(function(r){
        var gr=r[0],sr=r[1],rr=r[2]
        if(gr&&gr.data){var g=gr.data;s.guides=(g.data&&g.data.guide_list)?g.data.guide_list:(g.guide_list||[])}
        if(sr&&sr.data){var sd=sr.data;s.spots=(sd.data&&sd.data.spot_list)?sd.data.spot_list:(sd.spot_list||[])}
        if(rr&&rr.data){var rd=rr.data;s.routes=(rd.data&&rd.data.route_list)?rd.data.route_list:(rd.route_list||[])}
        var located=s.spots.find(function(x){return x.latitude&&x.longitude});if(located){var point=wgs84ToGcj02(Number(located.latitude),Number(located.longitude));s.mapCenter={latitude:point[0],longitude:point[1]}}
        s.guides=s.guides.map(function(g){return Object.assign({},g,{model3dUrl:(g.model3d_url||'').replace('.gltf','.glb'),previewUrl:'',previewMessage:'正在查询数字人服务状态',previewLoading:true})});var previous=s.pickedGuide&&s.pickedGuide.guide_id;s.pickedGuide=s.guides.find(function(g){return g.guide_id===previous})||null;s.guides.forEach(function(g){s.loadGuidePreview(g)})
        if(!gr||!sr||!rr)s.error='部分数据加载失败，请重试'
        var stored=uni.getStorageSync('ai_spot_ids')
        if(stored){try{var ids=JSON.parse(stored);var picked={};ids.forEach(function(id){picked[id]=true});s.pickedIds=picked;uni.removeStorageSync('ai_spot_ids')}catch(e){}}
        s.loading=false
      }).catch(function(){s.error='网络连接失败';s.loading=false})},
    onMarkerTap:function(e){var id=e.detail&&e.detail.markerId;if(id){this.toggleSpot(id);this.$forceUpdate()}},
    checkAuth:function(){var t=uni.getStorageSync('token');if(!t){uni.reLaunch({url:'/pages/auth/auth'});return false}return true},
  },
  onShow:function(){if(this.checkAuth())this.loadData()},
}
</script>

<style scoped>
.guide-preview-half{height:600rpx;margin:0 24rpx;overflow:hidden;background:var(--ng-surface)}.guide-preview-photo{display:block;width:100%}
.guide-preview-panel{overflow-y:auto}.guide-preview-panel .dp-hd{position:relative;justify-content:center;padding:20rpx 80rpx}.guide-preview-panel .dp-title{font-size:46rpx;font-weight:700;line-height:1.4;text-align:center}.guide-preview-panel .dp-close{position:absolute;right:24rpx;top:24rpx}.guide-preview-panel .guide-description{font-size:34.5rpx;line-height:1.65;padding:16rpx 24rpx;color:var(--ng-secondary)}
.gc-image{position:absolute;width:100%;height:100%;left:0;top:0}.gc-empty{padding:70rpx 16rpx;text-align:center;font-size:27.6rpx;color:var(--ng-secondary)}.guide-description{display:block;padding:18rpx;color:var(--ng-secondary);font-size:27.6rpx;line-height:1.7}.guide-description text{display:block}.guide-preview-video{width:100%;height:600rpx}
.gc-preview{position:absolute;right:10rpx;top:10rpx;z-index:3;padding:8rpx 16rpx;border-radius:12rpx;background:rgba(30,41,59,0.28);color:var(--ng-text);font-size:25.3rpx}
.page{height:100vh;box-sizing:border-box;background-color:var(--ng-surface);position:relative;overflow:hidden}
.ink-bg{position:absolute;inset:0;pointer-events:none;z-index:0}.ink-mountain{position:absolute;left:0;right:0;background:var(--ng-night);border-radius:50% 70% 0 0}.ink-mt-1{bottom:20%;height:200rpx;opacity:.03;transform:scaleX(1.4)}.ink-mt-2{bottom:25%;height:150rpx;opacity:.02;transform:scaleX(1.2) translateX(10%)}
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}

/* 双按钮 */
.nav{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;padding:16rpx 24rpx;background:var(--ng-surface)}.nav-title{font-size:39.1rpx;font-weight:600;color:var(--ng-text);letter-spacing:0;font-family:var(--app-font-family);text-align:center}
/* 【修改】padding-top 8rpx → 0 向上移动 */
.top-tabs{position:relative;z-index:1;display:flex;gap:16rpx;padding:0 20rpx 16rpx}
.tt-item{flex:1;display:flex;align-items:center;justify-content:center;gap:10rpx;padding:22rpx 0;border-radius:16rpx;font-size:var(--tab-label-size);font-weight:600;color:var(--ng-secondary);background:var(--ng-surface);border:1rpx solid var(--ng-border);transition:all .15s}
.tt-label{font-size:var(--tab-label-size);line-height:1.3;font-weight:600}
.tt-item.on{color:var(--ng-text);background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));border-color:transparent}
.tt-icon{font-size:30rpx}

.main{position:relative;z-index:1;padding:0 20rpx;min-height:0;box-sizing:border-box;width:100%}.load{text-align:center;padding:80rpx;color:var(--ng-secondary)}.err{text-align:center;padding:32rpx;background:var(--ng-surface);border-radius:14rpx;border:1rpx solid rgba(99,102,241,0.25)}.err text{display:block;color:var(--ng-secondary);font-size:27.6rpx;margin-bottom:12rpx}.retry{display:inline-block;padding:10rpx 28rpx;background:rgba(99,102,241,0.18);color:var(--ng-text);border-radius:10rpx;font-size:27.6rpx}

/* ═══════ 输入栏：弹性定位紧贴tab上沿 ═══════ */




.block{margin:14rpx 0;background:var(--ng-surface);border-radius:16rpx;padding:18rpx;border:1rpx solid var(--ng-border)}
.bl-hd{display:flex;align-items:center;gap:8rpx;margin-bottom:14rpx}.bl-dot{width:7rpx;height:20rpx;border-radius:3rpx;background:rgba(99,102,241,0.18)}.bl-hd text{font-size:32.2rpx;font-weight:600;color:var(--ng-text)}.sub{font-weight:400;color:var(--ng-secondary);font-size:25.3rpx;margin-left:8rpx}
.map-wrap{border-radius:14rpx;overflow:hidden}.mini-map{width:100%;height:280rpx}.map-empty{height:180rpx;display:flex;align-items:center;justify-content:center;background:var(--ng-surface);color:var(--ng-secondary)}
.route-carousel-wrap{position:relative;border-radius:20rpx;overflow:hidden}.route-carousel{height:440rpx;width:100%}.route-slide{height:100%}.route-card{position:relative;width:100%;height:100%;overflow:hidden;background:var(--ng-night);box-sizing:border-box}.route-card.on{box-shadow:inset 0 0 0 4rpx rgba(99,102,241,0.15)}.route-carousel .route-cover-photo{position:absolute;inset:0;width:100%;height:100%;border-radius:0;margin:0}.route-cover-empty{height:100%;display:flex;align-items:center;justify-content:center;color:var(--ng-text)}.route-cover-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.48),transparent 38%,rgba(0,0,0,.12) 55%,rgba(0,0,0,.78));pointer-events:none}.rc-top{position:absolute;top:22rpx;left:24rpx;right:24rpx;display:flex;justify-content:space-between;align-items:center}.rc-tag{font-size:25.3rpx;color:var(--ng-text);background:rgba(0,0,0,.3);padding:6rpx 14rpx;border-radius:24rpx}.rc-time{font-size:25.3rpx;color:var(--ng-text);text-shadow:0 2rpx 6rpx #000}.rc-bottom{position:absolute;left:26rpx;right:26rpx;bottom:48rpx}.route-carousel .route-cover-note{display:block;font-size:20.7rpx;color:var(--ng-text);margin-bottom:6rpx}.rc-name{font-size:34.5rpx;line-height:1.4;font-weight:600;color:var(--ng-text);display:block;text-shadow:0 2rpx 8rpx rgba(0,0,0,.4)}.rc-meta{display:block;font-size:25.3rpx;color:var(--ng-text);margin-top:8rpx}.route-arrow{position:absolute;top:50%;transform:translateY(-50%);width:64rpx;height:84rpx;display:flex;align-items:center;justify-content:center;font-size:42rpx;color:var(--ng-text);background:rgba(0,0,0,.32);border-radius:12rpx;z-index:2}.route-arrow .iconfont{font-size:36rpx;color:var(--ng-text)}.route-arrow-left{left:12rpx}.route-arrow-right{right:12rpx}
.search-row{margin-bottom:14rpx;width:100%;box-sizing:border-box}.search-input{width:100%;height:68rpx;padding:0 20rpx;border:1rpx solid var(--ng-border);border-radius:34rpx;background:var(--ng-surface);font-size:27.6rpx;color:var(--ng-text);box-sizing:border-box}
.cat-tabs{white-space:nowrap;margin-bottom:14rpx}.cat-tab{display:inline-block;font-size:25.3rpx;color:var(--ng-secondary);padding:8rpx 20rpx;margin-right:10rpx;border-radius:20rpx;background:rgba(99,102,241,0.08)}.cat-tab.on{background:rgba(99,102,241,0.18);color:var(--ng-text);font-weight:700}
.spot-list{display:flex;flex-direction:column;gap:10rpx}.spot-card{display:flex;align-items:center;gap:12rpx;padding:14rpx;border:1rpx solid var(--ng-border);border-radius:14rpx;background:var(--ng-surface)}.spot-card.on{border-color:rgba(99,102,241,0.25);background:rgba(99,102,241,0.06)}.sc-img{width:64rpx;height:64rpx;border-radius:12rpx;flex-shrink:0}.sc-img-df{width:64rpx;height:64rpx;border-radius:12rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);font-size:32.2rpx;flex-shrink:0}.sc-body{display:flex;align-items:center;flex:1;min-width:0}.sc-info{flex:1;min-width:0}.sc-name{font-size:29.9rpx;font-weight:700;color:var(--ng-text);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc-cat{font-size:23rpx;color:var(--ng-secondary);margin-top:2rpx}.sc-btn{font-size:23rpx;color:var(--ng-secondary);padding:6rpx 12rpx;border:1rpx solid rgba(99,102,241,0.25);border-radius:8rpx;flex-shrink:0}
.guide-grid{display:flex;flex-wrap:wrap;gap:12rpx}.guide-card{width:calc(50% - 6rpx);min-height:200rpx;display:flex;align-items:flex-end;justify-content:flex-end;padding:10rpx;border:2rpx solid var(--ng-border);border-radius:16rpx;background-color:var(--ng-surface);background-size:contain;background-repeat:no-repeat;background-position:center;box-sizing:border-box;position:relative;overflow:hidden}.guide-card.on{border-color:rgba(99,102,241,0.25);box-shadow:0 0 0 3rpx rgba(99,102,241,0.15)}.guide-card::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.4) 0%,transparent 50%);z-index:1}.gc-name{position:relative;z-index:2;padding:6rpx 14rpx;border-radius:8rpx;background:rgba(0,0,0,.5);backdrop-filter: none;color:var(--ng-text);font-size:27.6rpx;font-weight:700}
.pref-wrap{display:flex;flex-wrap:wrap;gap:10rpx}.pref-chip{padding:12rpx 22rpx;border:1rpx solid var(--ng-border);border-radius:26rpx;background:var(--ng-surface);font-size:27.6rpx;color:var(--ng-text)}.pref-chip.on{border-color:rgba(99,102,241,0.25);background:rgba(99,102,241,0.1);color:var(--ng-secondary)}
.fab-btn{position:fixed;right:24rpx;bottom:200rpx;width:100rpx;height:100rpx;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));box-shadow:0 8rpx 24rpx rgba(99,102,241,0.15);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100;opacity:0;transform:scale(.5);transition:all .3s}.fab-btn.show{opacity:1;transform:scale(1)}.fab-icon{font-size:28rpx;color:var(--ng-text)}.fab-text{font-size:23rpx;color:var(--ng-text);font-weight:600;margin-top:2rpx}
.empty{color:var(--ng-secondary);font-size:27.6rpx;text-align:center;padding:40rpx}

/* 详情抽屉 — 优化版 */
.drawer-overlay{position:fixed;inset:0;z-index:1000}.drawer-mask{position:absolute;inset:0;background:rgba(30,41,59,0.28)}.drawer-panel{position:absolute;bottom:0;left:16rpx;right:16rpx;max-height:75vh;background:var(--ng-surface);border-radius:32rpx 32rpx 0 0;overflow:hidden;box-shadow:0 -8rpx 40rpx rgba(0,0,0,.12)}.dp-handle{width:48rpx;height:5rpx;border-radius:3rpx;background:rgba(99,102,241,0.12);margin:16rpx auto 10rpx}.dp-hd{display:flex;justify-content:space-between;align-items:center;padding:6rpx 28rpx 16rpx}.dp-title{font-size:36.8rpx;font-weight:600;color:var(--ng-text)}.dp-close{width:48rpx;height:48rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.08);font-size:32.2rpx;color:var(--ng-secondary)}
.dp-body{width:100%;padding:0;max-height:50vh;box-sizing:border-box}.dp-content{padding:0 32rpx 16rpx;box-sizing:border-box;min-width:0}.dp-desc{overflow-wrap:anywhere}.dp-row text:last-child{min-width:0;overflow-wrap:anywhere}
.dp-hero{width:100%;height:280rpx;border-radius:18rpx;margin-bottom:20rpx;box-shadow:0 4rpx 16rpx rgba(0,0,0,.06)}
.dp-name{font-size:41.4rpx;font-weight:600;color:var(--ng-text);display:block;margin-bottom:12rpx}
.dp-desc{font-size:27.6rpx;color:var(--ng-text);line-height:1.8;display:block;margin-bottom:20rpx}
.dp-row{display:flex;padding:16rpx 0;border-top:1rpx solid var(--ng-border)}.dp-row text:first-child{font-size:27.6rpx;color:var(--ng-secondary);width:80rpx;flex-shrink:0}.dp-row text:last-child{font-size:27.6rpx;color:var(--ng-text);flex:1}
.dp-btn{padding:12rpx 28rpx 28rpx;padding-bottom:calc(28rpx + env(safe-area-inset-bottom))}.dp-btn text{display:block;padding:24rpx;text-align:center;border-radius:18rpx;background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));color:var(--ng-text);font-size:34.5rpx;font-weight:600;box-shadow:0 6rpx 20rpx rgba(99,102,241,0.15)}.dp-btn.added text{background:rgba(99,102,241,0.08);color:var(--ng-secondary);box-shadow:none}
.rd-tag{display:inline-block;font-size:25.3rpx;color:var(--ng-secondary);background:rgba(99,102,241,0.06);padding:8rpx 18rpx;border-radius:22rpx;margin-bottom:16rpx}
.rd-desc{font-size:29.9rpx;color:var(--ng-text);line-height:1.8;display:block;margin-bottom:24rpx}
.dp-actions{display:flex;gap:14rpx;padding:12rpx 28rpx 28rpx;padding-bottom:calc(28rpx + env(safe-area-inset-bottom))}
.dpa-btn{flex:1;padding:24rpx;text-align:center;border-radius:18rpx;font-size:32.2rpx;font-weight:600;transition:all .2s}
.dpa-btn.pick{background:var(--ng-surface);color:var(--ng-secondary);border:2rpx solid rgba(99,102,241,0.25)}.dpa-btn.pick.on{background:rgba(99,102,241,0.06);color:var(--ng-secondary);border-color:rgba(99,102,241,0.25)}
.dpa-btn.start{background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));color:var(--ng-text);box-shadow:0 6rpx 20rpx rgba(99,102,241,0.15)}

/* 路线时间轴 */
.timeline{display:flex;flex-direction:column;padding:8rpx 0}
.tl-item{display:flex;gap:16rpx}
.tl-left{display:flex;flex-direction:column;align-items:center;width:56rpx;flex-shrink:0}
.tl-dot{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:27.6rpx;font-weight:600;color:var(--ng-secondary);background:rgba(99,102,241,0.12);border:2rpx solid var(--ng-border);z-index:1;flex-shrink:0;box-shadow:0 2rpx 8rpx rgba(0,0,0,.04)}
.tl-dot.start{background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));border-color:transparent;color:var(--ng-text);box-shadow:0 4rpx 14rpx rgba(99,102,241,0.15)}
.tl-dot.end{background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));border-color:transparent;color:var(--ng-text);box-shadow:0 4rpx 14rpx rgba(99,102,241,0.15)}
.tl-line{width:3rpx;flex:1;min-height:60rpx;background:rgba(99,102,241,0.12);position:relative;overflow:hidden}
.tl-card{flex:1;display:flex;gap:16rpx;padding:16rpx 18rpx;margin-bottom:12rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:16rpx;box-shadow:0 2rpx 10rpx rgba(0,0,0,.03);transition:all .2s}
.tl-card:active{transform:scale(.98)}
.tlc-img{width:88rpx;height:88rpx;border-radius:14rpx;flex-shrink:0;box-shadow:0 2rpx 8rpx rgba(0,0,0,.06)}
.tlc-img-df{width:88rpx;height:88rpx;border-radius:14rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);font-size:41.4rpx;flex-shrink:0}
.tlc-info{flex:1;display:flex;flex-direction:column;justify-content:center;gap:6rpx}.tlc-name{font-size:32.2rpx;font-weight:600;color:var(--ng-text)}.tlc-cat{font-size:25.3rpx;color:var(--ng-secondary)}

/* TabBar */
.tb-root{position:fixed;bottom:0;left:0;right:0;z-index:999;background:var(--ng-surface)}
.tb-ink-line{height:1rpx;background:linear-gradient(90deg,transparent,rgba(99,102,241,0.12),transparent);margin:0 32rpx}
.tb-inner{display:flex;align-items:center;justify-content:space-around;padding:4rpx 8rpx}
.tb-item{display:flex;flex-direction:column;align-items:center;gap:4rpx;padding:2rpx 10rpx;position:relative;flex:1}
.tb-icon{font-size:38rpx}.tb-label{font-size:23rpx;font-weight:600;color:var(--ng-secondary)}
.tb-dot{position:absolute;bottom:-4rpx;width:24rpx;height:4rpx;border-radius:2rpx;background:rgba(99,102,241,0.18);opacity:.6}
.tb-item.on .tb-label{color:var(--ng-secondary);font-weight:600}.tb-item.on .tb-icon{transform:scale(1.1)}
.tb-hl-ring{width:68rpx;height:68rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.18);border:2rpx solid rgba(99,102,241,0.25);margin-bottom:-2rpx}
.tb-hl-ring.on{background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));border-color:transparent;box-shadow:0 6rpx 18rpx rgba(99,102,241,0.15);animation:tabBounce .4s ease-out}
.tb-hl-ring .tb-icon{font-size:34rpx}.tb-safe{height:env(safe-area-inset-bottom,10rpx);min-height:2rpx}
.tl-pulse{position:absolute;top:0;left:-5rpx;width:13rpx;height:24rpx;border-radius:7rpx;background:linear-gradient(180deg,transparent,rgba(99,102,241,0.18),var(--ng-surface),rgba(99,102,241,0.18),transparent);animation:pulseDown 1.5s ease-in-out infinite;box-shadow:0 0 12rpx rgba(99,102,241,0.15)}.tl-pulse:nth-child(2){animation-delay:.75s}
@keyframes pulseDown{0%{transform:translateY(-12rpx);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateY(65rpx);opacity:0}}
@keyframes tabBounce{0%{transform:scale(1)}30%{transform:scale(1.15)}60%{transform:scale(.95)}100%{transform:scale(1)}}

.nav{box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;padding-left:0;padding-right:0;padding-bottom:0;background:var(--ng-surface);border-bottom:1rpx solid var(--ng-border)}.nav .nav-title{font-size:18.4px;line-height:44px}.nav .nav-ai{position:absolute;left:16px;bottom:8px;width:28px;height:28px;border-radius:8px;font-size:13.8px;box-shadow:none}

.selection-next{padding:24rpx;margin:20rpx 0;border-radius:16rpx;background:rgba(99,102,241,0.18);color:var(--ng-text);text-align:center;font-weight:600}

.route-cover-photo{width:100%;height:220rpx;border-radius:14rpx;margin-bottom:14rpx}.route-cover-note{font-size:20.7rpx;color:var(--ng-secondary)}.scenic-fade{position:relative;height:360rpx;overflow:hidden}.scenic-clear,.scenic-blur{position:absolute;width:100%;height:100%;top:0;left:0}.scenic-blur{filter:blur(10px);mask-image:linear-gradient(to bottom,transparent 30%,black 70%,transparent 100%)}.scenic-veil{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 35%,var(--ng-surface) 60%,var(--ng-surface) 100%)}

.route-detail-background{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.route-detail-photo{position:absolute;top:0;left:0;width:100%;height:520rpx;opacity:.52}
.route-detail-blur{filter:blur(12px);transform:scale(1.06);mask-image:linear-gradient(to bottom,transparent 10%,black 65%)}
.route-detail-wash{position:absolute;inset:0;background:linear-gradient(to bottom,var(--ng-surface) 0%,var(--ng-surface) 20%,var(--ng-surface) 45%,var(--ng-surface) 68%)}
.route-detail-panel>.dp-handle,.route-detail-panel>.dp-hd,.route-detail-panel>.dp-body,.route-detail-panel>.dp-start,.route-detail-panel>.dp-actions{position:relative;z-index:1}
.route-detail-panel .dp-title{font-size:40.25rpx;line-height:1.4}
.route-detail-panel .dp-desc,.route-detail-panel .rd-desc{font-size:31.05rpx;color:var(--ng-secondary)}
.route-detail-panel .dp-tag,.route-detail-panel .rd-tag{font-size:27.6rpx}
.route-detail-panel .tlc-name{font-size:33.35rpx}
.route-detail-panel .tlc-cat,.route-detail-panel .tlc-trans text{font-size:26.45rpx}
.route-detail-panel .tl-card{background:var(--ng-surface)}
/* 顶部标签与底部导航共用放大后的响应式字号。 */
.page.aurora-page{--tab-label-size:16.1px}
@media(min-width:390px){.page.aurora-page{--tab-label-size:17.25px}}
@media(min-width:430px){.page.aurora-page{--tab-label-size:18.4px}}

/* ═══════ 沉浸式 Hero Banner ═══════ */
.hero-banner{position:relative;width:100%;height:460rpx;overflow:hidden;border-radius:0 0 28rpx 28rpx;margin-bottom:10rpx;flex-shrink:0}
.hero-bg{position:absolute;inset:0;width:100%;height:100%}
.hero-bg-fallback{position:absolute;inset:0;background:linear-gradient(135deg,var(--ng-night) 0%,rgba(99,102,241,0.22) 55%,var(--ng-surface) 100%)}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.12) 38%,rgba(0,0,0,0.18) 60%,rgba(0,0,0,0.62) 100%);pointer-events:none}
.hero-content{position:absolute;left:32rpx;right:32rpx;top:36rpx;z-index:2}
.hero-meta{display:flex;align-items:center;gap:18rpx;margin-bottom:18rpx}
.hero-date{font-size:25.3rpx;color:rgba(255,255,255,0.88);text-shadow:0 2rpx 6rpx rgba(0,0,0,0.35)}
.hero-weather{font-size:25.3rpx;color:rgba(255,255,255,0.96);text-shadow:0 2rpx 6rpx rgba(0,0,0,0.35)}
.hero-title{display:block;font-size:66.7rpx;font-weight:700;color:#fff;line-height:1.2;text-shadow:0 4rpx 18rpx rgba(0,0,0,0.55)}
.hero-subtitle{display:block;font-size:27.6rpx;color:rgba(255,255,255,0.82);margin-top:10rpx;text-shadow:0 2rpx 8rpx rgba(0,0,0,0.45)}
.hero-route-card{position:absolute;left:24rpx;right:24rpx;bottom:26rpx;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:22rpx 26rpx;border-radius:20rpx;background:rgba(99,102,241,0.12);backdrop-filter: none;-webkit-backdrop-filter: none;border:1rpx solid rgba(99,102,241,0.12);box-shadow:0 10rpx 30rpx rgba(0,0,0,0.22)}
.hero-route-card:active{transform:scale(0.98);transition:transform .15s}
.hrc-left{display:flex;align-items:center;gap:16rpx;flex:1;min-width:0}
.hrc-icon{font-size:38rpx;color:rgba(99,102,241,0.25)}
.hrc-info{display:flex;flex-direction:column;flex:1;min-width:0}
.hrc-label{font-size:23rpx;color:#4b5563}
.hrc-name{font-size:29.9rpx;font-weight:600;color:#fff;margin-top:2rpx;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hrc-arrow{font-size:32rpx;color:#1f2937}
.planner-note{display:block;font-size:26rpx;line-height:1.7;color:var(--ng-secondary);margin-top:14rpx}.planner-control{margin-top:18rpx;padding:20rpx;border-radius:16rpx;background:#f7f8fc;color:var(--ng-text);font-size:29rpx}.planner-generate{margin-top:22rpx;padding:22rpx;text-align:center;background:#5447db;border-radius:18rpx;color:#fff;font-size:30rpx}.planner-result{margin-top:28rpx;font-size:30rpx;color:var(--ng-text)}.planner-stop{padding:20rpx 0;border-bottom:1rpx solid var(--ng-border)}
</style>

