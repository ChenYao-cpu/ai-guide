<template>
  <view class="page">

    <view class="tour-gradient" aria-hidden="true"></view>

    <NocturneConfirm v-if="showEndConfirm" title="结束导览" content="确定要结束本次导览吗？" @cancel="showEndConfirm=false" @confirm="endTour" />
    <!-- 导航栏 -->
    <view class="nav" :style="{paddingTop:statusH+'px'}">
      <view class="nav-back" @tap="goBack"><text>‹</text></view>
    <!-- 游览进度时间轴 -->
    <view class="tour-progress nav-progress" v-if="spotCards.length > 1">
      <scroll-view scroll-x class="tp-track" :scroll-into-view="'tpn-' + spotIdx" scroll-with-animation>
        <view class="tp-nodes">
          <view v-for="(s, i) in spotCards" :key="s.spot_id" :id="'tpn-' + i" class="tp-node" :class="{done: i < spotIdx, active: i === spotIdx}" @tap="jumpSpot(i)">
            <view class="tp-dot"><text v-if="i < spotIdx" class="tp-check">✓</text><text v-else-if="i === spotIdx" class="tp-now">●</text></view>
            <text class="tp-label">{{ s.spot_name }}</text>
          </view>
        </view>
      </scroll-view>

    </view>
      <view v-if="spotCards.length <= 1" class="nav-spacer"></view>
      <view class="nav-end" @tap="confirmEnd"><text>✕</text></view>
    </view>

    <!-- 数字导游 -->
    <view class="guide-stage">
      <view v-if="spotCards.length" class="tp-stats stage-progress">
        <text class="tp-stat" v-if="remainingDuration > 0">预计剩余约 {{ remainingDuration }} 分钟</text>
        <text class="tp-stat done" v-else>路线游览完毕</text>
      </view>
      <text v-if="guideDisplayName" class="stage-guide-name">{{ guideDisplayName }}</text>
      <!-- #ifdef APP-PLUS -->
      <tour-xingyun v-if="guideProvider==='xingyun'" :payload="xingyunPayload" @state="onXingyunState" />
      <!-- #endif -->
      <image v-if="currentSpot.image_path" :src="fixImg(currentSpot.image_path)" class="spot-bg-img" mode="aspectFill" />
      <view class="spot-bg-shade"></view>
      <!-- 知识卡片弹出 -->
      <view class="know-card" v-if="knowCard.visible" @tap="dismissKnowCard">
        <view class="kc-inner">
          <text class="kc-tag"> 景点知识</text>
          <text class="kc-text">{{ knowCard.text }}</text>
          <image v-if="knowCard.image" :src="knowCard.image" class="kc-img" mode="aspectFill"></image>
        </view>
      </view>
      <template v-if="!(appXingyun && guideProvider==='xingyun' && xingyunConnected)">
      <view v-if="avatarMode==='3d'&&threeDModelUrl&&!threeDError" class="native-3d-stage">
        <tour-avatar-3d v-if="avatarWidth>0&&avatarHeight>0" id="guide-avatar-3d" :motion-url="threeDModelUrl" :motion-started-at="motionStartedAt" :portrait="true" :width="Math.round(avatarWidth*avatarPixelRatio)" :height="Math.round(avatarHeight*avatarPixelRatio)" :key="threeDSceneUrl||threeDModelUrl" :scene-url="threeDSceneUrl||threeDModelUrl" :animation="threeDAnimation" :progress="threeDProgress" :duration="threeDDuration" :speaking="speaking" :style="{width:avatarWidth+'px',height:avatarHeight+'px',display:'block'}" @ready="threeDReady" @error="threeDFailed" />
      </view>
      <video v-else-if="videoUrl" key="speech-video" id="guide-speech-video" :muted="false" :loop="false" :src="videoUrl" class="avatar-video" object-fit="contain" :controls="true" :autoplay="true" @play="speaking=true" @pause="speaking=false" @ended="speaking=false" @error="videoError"></video>
      <image v-else-if="guideAvatar" :src="fixImg(guideAvatar)" class="selected-guide-image" mode="widthFix" @error="guideAvatar=''" />
      <view v-else class="guide-img-df"><text class="guide-df-name">{{ guideName || '数字导游' }}</text><text class="avatar-notice">形象未配置</text></view>
      </template>
      <view class="stage-status" :class="{on:speaking}">
        <text>{{ speaking ? '讲解中' : appXingyun&&guideProvider==='xingyun' ? (xingyunConnected ? '已连接' : xingyunFailed ? '连接失败' : '连接中…') : '待命中' }}</text>
      </view>
    </view>

    <view v-if="avatarMessage" class="stage-footer">
      <view class="avatar-runtime-status"><text>{{ avatarMessage }}</text></view>

    </view>
    <!-- #ifdef APP-PLUS -->
    <button v-if="guideProvider==='xingyun'&&xingyunFailed" class="xingyun-open" @tap="connectXingyun">重新连接数字人</button>
    <!-- #endif -->
    <!-- #ifndef APP-PLUS -->
    <button v-if="guideProvider==='xingyun'" class="xingyun-open" @tap="openXingyun">打开数字人导览</button>
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <tour-xfyun ref="xfyun" :tour-id="sid" />
    <!-- #endif -->
    <!-- 景点切换卡片 -->
    <view class="spot-switch" v-if="spotCards.length">
      <view class="ss-arrow" @tap="prevSpot"><text>‹</text></view>
      <view class="ss-card" @tap="switchSpotDetail">
        <image v-if="currentSpot.image_path||currentSpot.route_cover_image" :src="fixImg(currentSpot.image_path||currentSpot.route_cover_image)" class="ss-img" mode="aspectFill"></image>
        <view v-else class="ss-img-df"></view>
        <view class="ss-info">
          <view class="ss-top">
            <text class="ss-cat">{{ spotIdx+1 }}/{{ spotCards.length }}</text><text class="ss-name">{{ currentSpot.spot_name }}</text>
            <text class="ss-cat">{{ !currentSpot.image_path && currentSpot.route_cover_image ? '路线示意图' : (currentSpot.category||'景点') }}</text>
          </view>
          <text class="ss-desc">{{ (currentSpot.description||'').substring(0,50) }}...</text>
        </view>
      </view>
      <view class="ss-arrow" @tap="nextSpot"><text>›</text></view>
    </view>

    <!-- 对话区 -->
    <scroll-view scroll-y class="chat-area" :scroll-into-view="lastMsgId">
      <view v-if="!msgs.length && !loading" class="chat-empty">

        <text class="ce-title">选择问题或直接提问</text>

      </view>
      <view v-for="(m,i) in msgs" :key="i" :id="'msg-'+i" class="msg-row" :class="m.role==='guide'?'msg-l':'msg-r'">
        <view class="msg-bubble" :class="m.role">
          <text class="msg-text">{{ m.message }}</text>
          <text class="msg-time">{{ fmtTime(m.send_time) }}</text>
        </view>
      </view>
      <view v-if="loading" class="loading-tip"><text>AI导游思考中...</text></view>
      <view id="bottom" style="height:20rpx;"></view>
    </scroll-view>

    <!-- 底部输入区 -->
    <view class="bottom-bar">
      <view class="input-row">
        <view class="voice-btn" :class="{rec:voiceMode}" @tap="toggleVoiceMode">
          <text class="iconfont" :class="voiceMode ? 'icon-liaotian' : 'icon-yuyin'"></text>
        </view>
        <input v-if="!voiceMode" v-model="text" class="msg-input" placeholder="输入你想了解的问题..." confirm-type="send" @confirm="onConfirm" :disabled="loading||transcribing" />
        <view v-else class="voice-hold-btn" :class="{pressing:voicePressing}" @touchstart="startRecord" @touchend="stopRecord" @touchcancel="cancelRecord">
          <text>{{ transcribing ? '正在识别…' : loading ? '正在回答…' : voicePressing ? '松开发送' : '按住说话' }}</text>
        </view>
        <view v-if="!voiceMode" class="send-btn" @tap="onSend" :class="{disabled:!text||loading||transcribing}">发送</view>
      </view>
    </view>
  </view>
</template>

<script>
import NocturneConfirm from '../../components/NocturneConfirm.vue'
import TourXingyun from '../../components/tour-xingyun.vue'
// #ifdef MP-WEIXIN
import TourXfyun from '../../components/tour-xfyun.vue'
// #endif
import { BASE_URL, assetUrl } from '../../common/config.js'
import { wgs84ToGcj02, gcj02ToWgs84 } from '../../../shared/coordinates.js'

function request(options) {
  return new Promise(function(resolve, reject) {
    var url = options.url
    if (url.indexOf('http') !== 0) url = BASE_URL + url
    var token = uni.getStorageSync('token') || ''
    var header = { 'Content-Type': 'application/json' }
    if (token) header['Authorization'] = 'Bearer ' + token
    uni.request({
      url: url, method: options.method || 'GET',
      data: options.data || {}, header: header,
      timeout: options.timeout || 20000,
      success: function(res) {
        if (res.statusCode === 200) resolve({ data: res.data })
        else if (res.statusCode === 401) { uni.reLaunch({url:'/pages/auth/auth'}) }
        else reject(new Error(res.data && (res.data.detail || res.data.message) || '服务请求失败（HTTP ' + res.statusCode + '）'))
      },
      fail: reject
    })
  })
}
var api = {
  getLiveInfo: function(sid) { return request({ url: '/tour-session/live-info/' + sid }) },
  sendMessage: function(sid, message, avatarMode, currentSpotId, nextSpotId) { return request({ url: '/tour-session/chat', method: 'PUT', timeout: 90000, data: { sessionId: sid, message: message, avatarMode: avatarMode, currentSpotId: currentSpotId, nextSpotId: nextSpotId } }) },
  aiChatRecommend: function(msg) { return request({ url: '/tour-session/ai-chat-recommend?message=' + encodeURIComponent(msg||''), method: 'POST' }) },
  endSession: function(sid) { return request({ url: '/tour-session/end/' + sid, method: 'PUT' }) },
  checkNearby: function(lat, lng, sid, target) { return request({ url: '/tour-session/check-nearby?latitude='+lat+'&longitude='+lng+'&session_id='+sid+'&target_spot_id='+target, method: 'POST', timeout: 8000 }) },
}

export default {
  components: {NocturneConfirm,TourXingyun,
    // #ifdef MP-WEIXIN
    TourXfyun,
    // #endif
  },
  data: function() {
    return {
      showEndConfirm: false,appXingyun:false,xingyunPayload:{},xingyunConnected:false,xingyunFailed:false,xingyunActive:false,
      motionStartedAt:0,sid: 0, msgs: [], spotCards: [], spotIdx: 0, avatarWidth:0, avatarHeight:0, avatarPixelRatio:1,
      guideName: '', guideAvatar: '', guideSourceVideo:'', guideProvider:'', statusH: 20,
      speaking: false, loading: false, text: '', recording: false, voicePressing: false, transcribing: false, voiceMode: false,
      threeDSceneUrl:'',threeDAnimation:'idle',threeDProgress:0,threeDDuration:0,threeDError:false,
      avatarMode:'audio',avatarMessage:'语音导览',videoUrl:'',avatarCapability:null,guideId:0,
      lastMsgId: 'bottom', _voiceManager: null,
      quick: ['这里有什么历史故事？','最佳拍照点在哪里？','附近有哪些服务设施？','请介绍景点特色','下一站推荐去哪里？'],
      mediaExpanded: false,
      gpsTracking: false, mapExpanded: false, userLat: 0, userLng: 0,
      distanceStatus: '正在获取当前位置…',
      nearestDistance: 0, nearestSpotName: '', nearestSpotIdx: -1, gpsTimer: null,
      knowCard: { visible: false, text: '', image: '' }, _knowTimer: null,
    }
  },
  watch: {
    spotIdx: function() { if(this.gpsTracking) { this.distanceStatus='正在更新目标景点距离…'; this.checkNearby() } },
  },
  computed: {
    guideDisplayName: function() { return this.guideName.replace(/^默认星云(?:数字人)?导游(?:数字人)?\s*/, '').trim() || this.guideName },
    threeDModelUrl:function(){return assetUrl(this.avatarCapability&&this.avatarCapability.threeD&&this.avatarCapability.threeD.modelUrl||'')},
    cartoonPreviewUrl:function(){return assetUrl(this.avatarCapability && this.avatarCapability.cartoon.previewUrl || '')},
    spotName: function() {
      var c = this.spotCards[this.spotIdx]
      return c ? c.spot_name : '景区导览中'
    },
    currentSpot: function() {
      return this.spotCards[this.spotIdx] || {}
    },
    visitedDuration: function() {
      var total = 0
      for (var i = 0; i < this.spotIdx && i < this.spotCards.length; i++) {
        total += this.spotCards[i].visit_duration || 20
      }
      return total
    },
    remainingDuration: function() {
      var total = 0
      for (var i = this.spotIdx + 1; i < this.spotCards.length; i++) {
        total += this.spotCards[i].visit_duration || 20
      }
      return total
    },
    hasSpotCoords: function() {
      return this.spotCards.some(function(s) { return s.latitude && s.longitude && s.latitude != 0 })
    },
    spotCenterLat: function() {
      var spots = this.spotCards.filter(function(s) { return s.latitude && s.latitude != 0 })
      if (!spots.length) return 39.999
      return spots.reduce(function(a, s) { return a + wgs84ToGcj02(Number(s.latitude), Number(s.longitude))[0] }, 0) / spots.length
    },
    spotCenterLng: function() {
      var spots = this.spotCards.filter(function(s) { return s.longitude && s.longitude != 0 })
      if (!spots.length) return 116.397
      return spots.reduce(function(a, s) { return a + wgs84ToGcj02(Number(s.latitude), Number(s.longitude))[1] }, 0) / spots.length
    },
    mapMarkers: function() {
      var markers = []
      for (var i = 0; i < this.spotCards.length; i++) {
        var s = this.spotCards[i]
        if (!s.latitude || !s.longitude || s.latitude == 0) continue
        var isActive = i === this.spotIdx
        var point = wgs84ToGcj02(Number(s.latitude), Number(s.longitude))
        markers.push({
          id: s.spot_id || i,
          latitude: point[0], longitude: point[1],
          width: isActive ? 24 : 16, height: isActive ? 24 : 16,
          callout: {
            content: s.spot_name,
            color: isActive ? '#4f46e5' : '#999',
            fontSize: 12, borderRadius: 8,
            padding: 6, display: 'ALWAYS',
            bgColor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.5)',
          },
        })
      }
      return markers
    },
  },
  methods: {
    connectXingyun:function(){
      // #ifdef APP-PLUS
      if(this.xingyunActive||!this.guideId||!this.sid)return
      this.xingyunActive=true;this.xingyunFailed=false;this.avatarMessage=''
      var self=this,version=this._xingyunVersion=(this._xingyunVersion||0)+1
      request({url:'/xingyun/config/'+this.guideId}).then(function(res){
        if(version!==self._xingyunVersion)return
        if(!res.data.configured)throw new Error('所选星云数字人未启用或未绑定')
        self._xingyunGateway=BASE_URL+'/xingyun/session/'+self.guideId+'?tour_id='+self.sid
        self.xingyunPayload={id:Date.now(),command:'connect',text:self._xingyunPending||'',gateway:self._xingyunGateway,sdkUrl:res.data.sdkUrl,accessToken:uni.getStorageSync('xingyun-tour-'+self.sid),token:uni.getStorageSync('token')}
      }).catch(function(error){if(version!==self._xingyunVersion)return;self.xingyunActive=false;self.xingyunFailed=true;self.avatarMessage=error.message||'星云连接失败，请重试'})
      // #endif
    },
    onXingyunState:function(event){
      if(event.gateway!==this._xingyunGateway)return
      if(event.state==='connected'){this.xingyunConnected=true;this.xingyunFailed=false;this.avatarMessage=''}
      else if(event.state==='playing'){this.speaking=true;this.avatarMessage='星云数字人正在讲解'}
      else if(event.state==='ended'){this.speaking=false;this.avatarMessage=''}
      else if(event.state==='error'){this.speaking=false;this.xingyunConnected=false;this.xingyunActive=false;this.xingyunFailed=true;this.avatarMessage=event.message||'星云连接失败，请重试'}
      else if(event.state!=='progress'&&event.message)this.avatarMessage=event.message
    },
    speakXingyun:function(text){if(!text)return;if(this.xingyunActive&&!this._xingyunGateway){this._xingyunPending=text;return}if(!this.xingyunActive){this.avatarMessage='数字人尚未连接，回答已显示；请重新连接';return}this.xingyunPayload=Object.assign({},this.xingyunPayload,{id:Date.now(),gateway:this._xingyunGateway,command:'speak',text:text})},
    closeXingyun:function(){this._xingyunVersion=(this._xingyunVersion||0)+1;this._xingyunGateway='';this.xingyunPayload={command:'close',id:Date.now()};this.xingyunActive=false;this.xingyunConnected=false},
    openXingyun: function() { uni.navigateTo({url:'/pages/xingyun/xingyun?sessionId='+this.sid}) },
    measureAvatar:function(){this.avatarPixelRatio=Math.min(uni.getSystemInfoSync().pixelRatio||1,3);var self=this;uni.createSelectorQuery().in(this).select('.guide-stage').boundingClientRect(function(rect){if(rect&&rect.width&&rect.height){self.avatarWidth=rect.width;self.avatarHeight=rect.height}}).exec()},
    stopPlayback:function(){if(this.xingyunActive)this.xingyunPayload=Object.assign({},this.xingyunPayload,{command:'stop',text:'',id:Date.now()});this._xingyunPending='';if(this._audio){this._audio.destroy();this._audio=null}if(this._avatarTimer){clearTimeout(this._avatarTimer);this._avatarTimer=null}if(this._threeDTimer){clearInterval(this._threeDTimer);this._threeDTimer=null}if(this._threeDLoadTimer){clearTimeout(this._threeDLoadTimer);this._threeDLoadTimer=null}this._pending3DAudio=null;this.threeDSceneUrl='';this.threeDAnimation='idle';this.threeDProgress=0;this.threeDDuration=0;this._playbackVersion=(this._playbackVersion||0)+1;this.speaking=false;this.videoUrl=''},
    switchMode:function(mode){if(this.loading)return;this.stopPlayback();this.avatarMode=mode;this.updateAvatarMessage()},
    updateAvatarMessage:function(){if(this.avatarMode==='audio'){this.avatarMessage='语音导览';return}var capability=this.avatarCapability&&this.avatarCapability[this.avatarMode==='3d'?'threeD':this.avatarMode];this.avatarMessage=capability?capability.message:'正在查询数字人服务状态'},
    threeDReady:function(){if(!this.motionStartedAt)this.motionStartedAt=Date.now();if(this._threeDLoadTimer){clearTimeout(this._threeDLoadTimer);this._threeDLoadTimer=null}var p=this._pending3DAudio;if(p&&p.version===this._playbackVersion){this._pending3DAudio=null;this.playAudio(p.url);this.avatarMessage='3D导览'}},
    threeDFailed:function(e){this.threeDError=true;this.threeDReady();this.avatarMessage=(e&&e.detail&&e.detail.message||'3D模型加载失败')+'，本轮使用语音讲解'},
    prepare3D:function(p,audio,version){var self=this;self.threeDError=false;self.threeDProgress=0;self.threeDDuration=p.duration;self.threeDAnimation=p.animation;self._pending3DAudio={url:audio,version:version};self.avatarMessage='正在加载3D讲解动作';self.threeDSceneUrl=assetUrl(p.scene_url);self._threeDLoadTimer=setTimeout(function(){if(version===self._playbackVersion){self.threeDError=true;self.threeDReady();self.avatarMessage='3D加载超时，本轮先播放语音'}},30000)},
    videoError:function(){this.speaking=false;this.videoUrl='';this.avatarMessage='视频播放失败，请检查视频地址与网络'},
    playAudio:function(value){this._audio=uni.createInnerAudioContext();var self=this,a=this._audio;a.src=assetUrl(value);a.onPlay(function(){self.speaking=true;if(self.avatarMode==='3d'&&self.threeDDuration){self._threeDTimer=setInterval(function(){self.threeDProgress=Math.min(1,(a.currentTime||0)/self.threeDDuration)},100)}});function finish(){if(self._audio!==a){a.destroy();return}self.speaking=false;if(self._threeDTimer){clearInterval(self._threeDTimer);self._threeDTimer=null}self.threeDSceneUrl='';self.threeDAnimation='idle';self.threeDProgress=0;a.destroy();if(self._audio===a)self._audio=null}a.onEnded(finish);a.onError(function(){finish();uni.showToast({title:'语音播放失败',icon:'none'})});a.play()},
    startSpeechVideo:function(value){var self=this;if(self._audio){self._audio.destroy();self._audio=null}self.videoUrl=assetUrl(value);self.$nextTick(function(){if(self.videoUrl)uni.createVideoContext('guide-speech-video',self).play()})},
    pollAvatar:function(job,version){var self=this;if(version!==self._playbackVersion)return;request({url:'/avatar/jobs/'+job.job_id+'?token='+encodeURIComponent(job.access_token)}).then(function(r){if(version!==self._playbackVersion)return;var d=r.data&&r.data.data;if(!d)throw new Error('任务状态缺失');if(d.status==='completed'){self.startSpeechVideo(d.video_url);self.avatarMessage='讲解视频已生成，若未自动播放请点播放';return}if(d.status==='failed'){self.avatarMessage=d.message||'视频生成失败';return}self.avatarMessage=d.status==='processing'?'正在生成口型视频…':'视频生成排队中';self._avatarTimer=setTimeout(function(){self.pollAvatar(job,version)},1500)}).catch(function(){if(version===self._playbackVersion)self.avatarMessage='获取视频状态失败，请重新提问'})},
    fixImg:function(u){if(!u)return'';return assetUrl(u)},
    switchSpotDetail:function(){this.send('请介绍「'+this.spotName+'」')},
    fmtTime: function(t) {
      if (!t) return ''
      try { return new Date(t).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) } catch(e) { return '' }
    },
    prevSpot: function(){ if(this.spotCards.length>1){ this.spotIdx=(this.spotIdx-1+this.spotCards.length)%this.spotCards.length; this.mediaExpanded=false; this.send('请介绍「'+this.spotName+'」') }},
    nextSpot: function(){ if(this.spotCards.length>1){ this.spotIdx=(this.spotIdx+1)%this.spotCards.length; this.mediaExpanded=false; this.send('请介绍「'+this.spotName+'」') }},
    jumpSpot: function(i){ if(i===this.spotIdx||this.loading) return; this.spotIdx=i; this.mediaExpanded=false; this.send('请介绍「'+this.spotName+'」') },
    send: function(msg) {
      var self = this; var t = (msg||'').trim()
      if (!t || self.loading) return
      if(!self.guideId){uni.showToast({title:'导游信息加载中，请稍后再试',icon:'none'});return}
      self.stopPlayback();self.text = ''; self.loading = true
      var playbackVersion=self._playbackVersion
      var currentSpot = self.spotCards[self.spotIdx]
      var nextSpot = self.spotCards[self.spotIdx+1]
      self.msgs.push({ role:'user', message:t, send_time: new Date().toISOString() })
      self.lastMsgId = 'bottom'
      // AI推荐
      api.aiChatRecommend(t).then(function(r) {
        var d = r.data
        if (d && d.success && d.data && d.data.spot_ids && d.data.spot_ids.length) {
          uni.setStorageSync('ai_spot_ids', JSON.stringify(d.data.spot_ids))
        }
      }).catch(function() {})
      // 发送消息（附带景点上下文）
      Promise.resolve(self._capabilityPromise).then(function(){return api.sendMessage(self.sid, t, self.avatarMode, currentSpot&&currentSpot.spot_id, nextSpot?nextSpot.spot_id:null)}).then(function(res) {
        var d = res.data
        if (d && d.success) {
          // TTS自动播报
          if(playbackVersion===self._playbackVersion){
            // #ifdef MP-WEIXIN
            if(self.$refs.xfyun&&self.$refs.xfyun.sessionId){self.$refs.xfyun.speak(d.data&&d.data.message);self.refresh();return}
            // #endif
            // #ifdef APP-PLUS
            if(self.guideProvider==='xingyun')self.speakXingyun(d.data&&d.data.message)
            // #endif
            var job=d.data&&d.data.avatarJob
            var performance=d.data&&d.data.avatarPerformance
            if(performance&&performance.scene_url){self.prepare3D(performance,d.data.ttsAudioUrl,playbackVersion)}
            else if(job&&job.job_id){self.pollAvatar(job,playbackVersion)}
            else{if(job)self.avatarMessage=job.message;if(d.data&&d.data.ttsAudioUrl)self.playAudio(d.data.ttsAudioUrl)}
          }

          self.refresh()
        } else { uni.showToast({title:(d&&d.message)||'回复失败',icon:'none'}) }
      }).catch(function(e) {
        uni.showToast({title:e.message || (/timeout/i.test(e.errMsg||'')?'回答等待超时，请重试':'无法连接服务器，请检查网络'),icon:'none'})
      })
        .finally(function() { self.loading = false; self.lastMsgId = 'bottom' })
    },
    onConfirm: function(e) { this.send(e.detail ? e.detail.value : '') },
    onSend: function() { this.send(this.text) },
    refresh: function() {
      var self = this
      api.getLiveInfo(self.sid).then(function(res) {
        var d = res.data
        if (d && d.success) {
          var data = d.data
          self.msgs = data.conversation || []
          if (data.guide_info) {
            self.guideProvider = data.guide_info.render_mode || ''
            self.guideName = data.guide_info.name || ''
            var gid=data.guide_info.guide_id
            self.guideAvatar=data.guide_info.avatar||data.guide_info.poster_image||''
            self.guideSourceVideo=assetUrl(data.guide_info.base_mp4_path||'')
            if(self.guideProvider==='xingyun'){self.guideId=gid;self.avatarMode='audio';
              // #ifdef APP-PLUS
              self.avatarMode='xingyun';self.connectXingyun()
              // #endif
              // #ifndef APP-PLUS
              self.avatarMessage='星云未连接 · 可使用语音导览'
              // #endif
            }else if(gid&&gid!==self.guideId){self.guideId=gid;self._capabilityPromise=request({url:'/avatar/capabilities/'+gid}).then(function(r){self.avatarCapability=r.data.data;self.avatarMode=self.avatarCapability.preferredMode==='3d'&&self.avatarCapability.threeD&&self.avatarCapability.threeD.ready?'3d':self.avatarCapability.realistic.ready?'realistic':(self.avatarCapability.cartoon.ready?'cartoon':'audio');self.updateAvatarMessage();if(!self.guideAvatar&&self.avatarCapability.cartoon.previewUrl)self.guideAvatar=self.avatarCapability.cartoon.previewUrl}).catch(function(){self.avatarMessage='数字人服务状态查询失败'})}
          }
          // 加载景点卡片
          var selectedIds=[];try{selectedIds=JSON.parse(data.visitor_preferences||'{}').spot_ids||[]}catch(e){}
          if(!selectedIds.length&&data.route_info)selectedIds=data.route_info.spot_ids||[]
          if (selectedIds.length) {
            request({url:'/tour-session/spots'}).then(function(sr){
              var spots = (sr.data&&sr.data.data&&sr.data.data.spot_list) ? sr.data.data.spot_list : []
              var ids = selectedIds
              var viewed = self.spotCards[self.spotIdx]
              self.spotCards = ids.map(function(id){return spots.find(function(s){return s.spot_id===id})}).filter(Boolean)
              var activeId = viewed?viewed.spot_id:(data.current_spot_info&&data.current_spot_info.spot_id)
              if (activeId) {
                for (var i=0;i<self.spotCards.length;i++) {
                  if (self.spotCards[i].spot_id === activeId) { self.spotIdx = i; break }
                }
              }
            }).catch(function(){})
          }
        }
      }).catch(function() {})
    },
    goBack: function() {
      uni.navigateBack({ delta: 1, fail: function() { uni.reLaunch({url:'/pages/tour-guide/tour-guide'}) } })
    },
    confirmEnd: function() { this.showEndConfirm=true },
    endTour: function() {
      this.showEndConfirm=false
      var sid=this.sid
      api.endSession(sid).catch(function(){})
      uni.redirectTo({ url:'/pages/tour-summary/tour-summary?sessionId='+sid })
    },
    toggleGps: function() {
      if (this.gpsTracking) { this.stopGps() }
      else { this.startGps() }
    },
    startGps: function() {
      var self = this
      this.stopGps()
      this.gpsTracking = true
      this.distanceStatus = '正在获取当前位置…'
      uni.getLocation({
        type: 'gcj02', isHighAccuracy: true,
        success: function(res) { self.userLat = res.latitude; self.userLng = res.longitude; self.checkNearby() },
        fail: function() { self.distanceStatus='定位失败，请开启手机定位并允许位置权限'; uni.showToast({ title: '定位失败，请检查权限', icon: 'none' }) }
      })
      this.gpsTimer = setInterval(function() {
        uni.getLocation({
          type: 'gcj02',
          success: function(res) { self.userLat = res.latitude; self.userLng = res.longitude; self.checkNearby() },
          fail: function() { self.distanceStatus='定位暂时失败，正在重试…' }
        })
      }, 5000)
    },
    stopGps: function() {
      this.gpsTracking = false
      this.mapExpanded = false
      if (this.gpsTimer) { clearInterval(this.gpsTimer); this.gpsTimer = null }
    },
    checkNearby: function() {
      if (!this.userLat || !this.userLng || !this.sid) return
      var self = this
      var gps = gcj02ToWgs84(this.userLat, this.userLng)
      var target = this.currentSpot.spot_id || 0
      api.checkNearby(gps[0], gps[1], this.sid, target).then(function(res) {
        if (!self.gpsTracking || target !== (self.currentSpot.spot_id || 0)) return
        var d = res.data && res.data.data
        if (!d) return
        self.distanceStatus = d.target_spot ? '距'+d.target_spot.spot_name+'约 '+(d.target_spot.distance >= 1000 ? (d.target_spot.distance/1000).toFixed(2)+' 公里' : Math.round(d.target_spot.distance)+' 米')+'（直线距离）' : '当前景点暂无坐标，无法测距'
        if (d.closest_spot) {
          self.nearestSpotName = d.closest_spot.spot_name || ''
          self.nearestDistance = Math.round(d.closest_spot.distance || 0)
        }
        if (d.auto_switched) {
          var newIdx = self.spotCards.findIndex(function(s) { return s.spot_name === self.nearestSpotName })
          if (newIdx >= 0 && newIdx !== self.spotIdx) {
            self.spotIdx = newIdx
            self.mediaExpanded = false
            uni.showToast({ title: '到达「' + self.nearestSpotName + '」', icon: 'none', duration: 2000 })
            self.send('请介绍「' + self.spotName + '」')
          }
        }
      }).catch(function() { if(self.gpsTracking) self.distanceStatus='距离更新失败，请检查导览服务器连接' })
    },
    showKnowCard: function() {
      var s = this.currentSpot
      var fact = ''
      if (s.history_detail && s.history_detail.length > 20) {
        fact = s.history_detail.substring(0, 80)
        if (s.history_detail.length > 80) fact += '...'
      } else if (s.description && s.description.length > 20) {
        fact = s.description.substring(0, 80)
        if (s.description.length > 80) fact += '...'
      } else if (s.photo_tips) {
        fact = '最佳拍摄：' + s.photo_tips.substring(0, 60)
      }
      if (!fact) return
      var img = s.image_path ? this.fixImg(s.image_path) : ''
      this.knowCard = { visible: true, text: fact, image: img }
      var self = this
      if (this._knowTimer) clearTimeout(this._knowTimer)
      this._knowTimer = setTimeout(function() { self.knowCard.visible = false }, 6000)
    },
    dismissKnowCard: function() {
      this.knowCard.visible = false
      if (this._knowTimer) { clearTimeout(this._knowTimer); this._knowTimer = null }
    },
    toggleVoiceMode:function(){if(this.recording||this.transcribing)return;this.voiceMode=!this.voiceMode;if(this.voiceMode)uni.hideKeyboard()},
    initRecorder: function() {
      if(this._voiceManager)return this._voiceManager
      var self=this,rm=uni.getRecorderManager();self._voiceManager=rm
      rm.onStart(function(){self._recordStartedAt=Date.now();if(!self.voicePressing)rm.stop()})
      rm.onStop(function(res){
        self.recording=false;self.voicePressing=false
        if(self._recordCancelled)return
        var duration=Number(res.duration)||(self._recordStartedAt?Date.now()-self._recordStartedAt:0)
        if(!res.tempFilePath||duration<500){uni.showToast({title:'请按住说话至少半秒',icon:'none'});return}
        self.transcribing=true
        uni.uploadFile({url:BASE_URL+'/tour-session/asr-upload',filePath:res.tempFilePath,name:'file',timeout:120000,
          header:{Authorization:'Bearer '+uni.getStorageSync('token')},
          success:function(r){
            try{var d=JSON.parse(r.data)
              if(r.statusCode===200&&d.success&&d.data){self.text=d.data;self.send(d.data);return}
              uni.showToast({title:typeof d.detail==='string'?d.detail:d.message||'语音识别服务返回错误',icon:'none',duration:4000})
            }catch(e){uni.showToast({title:'语音识别返回格式异常',icon:'none'})}
          },
          fail:function(){uni.showToast({title:'语音上传失败，请检查网络连接',icon:'none'})},
          complete:function(){self.transcribing=false}
        })
      })
      rm.onError(function(){self.recording=false;self.voicePressing=false;uni.showToast({title:'录音失败，请检查麦克风权限',icon:'none'})})
      return rm
    },
    startRecord: function() {
      if(this.recording||this.transcribing||this.loading)return
      this._recordStartedAt=0;this._recordCancelled=false;this.voicePressing=true;this.recording=true
      try{this.initRecorder().start({duration:60000,sampleRate:16000,numberOfChannels:1,format:'mp3'})}
      catch(e){this.recording=false;this.voicePressing=false;uni.showToast({title:'无法启动录音，请检查麦克风权限',icon:'none'})}
    },
    stopRecord: function() {this.voicePressing=false;if(this._voiceManager&&this._recordStartedAt)this._voiceManager.stop()},
    cancelRecord: function(){this._recordCancelled=true;this.voicePressing=false;this.recording=false;if(this._voiceManager&&this._recordStartedAt)this._voiceManager.stop()},
  },
  onReady:function(){this.measureAvatar()},
  onResize:function(){this.$nextTick(this.measureAvatar)},
  onUnload:function(){this.cancelRecord();this.stopPlayback();this.closeXingyun();this.stopGps()},
  onHide:function(){this.cancelRecord();this.stopPlayback();this.closeXingyun();
    // #ifdef MP-WEIXIN
    if(this.$refs.xfyun)this.$refs.xfyun.close()
    // #endif
  },
  onShow:function(){if(this.guideProvider==='xingyun')this.connectXingyun()},
  onLoad: function(opts) {
    // #ifdef APP-PLUS
    this.appXingyun=true
    // #endif
    this.sid = Number(opts.sessionId || 0)
    if (!this.sid) { uni.showToast({title:'会话ID无效',icon:'none'}); return }
    var s = uni.getSystemInfoSync()
    this.statusH = (s.statusBarHeight || 20) + 6
    this.refresh()
  },
}
</script>

<style scoped>
.xingyun-open{margin:8rpx 24rpx;padding:8rpx 24rpx;border:1rpx solid var(--ng-border);border-radius:14rpx;color:var(--ng-secondary);background:var(--ng-surface);font-size:26rpx;flex-shrink:0}
.native-3d-stage{width:100%;height:100%;overflow:hidden;border-radius:24rpx;}
.stage-footer{position:relative;z-index:1;display:flex;align-items:center;gap:12rpx;padding:10rpx 24rpx;flex-shrink:0}
.stage-footer .avatar-runtime-status{flex:1;min-width:0;padding:0;color:var(--ng-secondary);font-size:22rpx;line-height:1.6}
.stage-location{display:flex;align-items:center;justify-content:flex-end;gap:10rpx;max-width:70%;margin-left:auto}
.selected-guide-image{position:absolute;top:0;left:0;width:100%;height:auto}.guide-stage{flex-shrink:0}
.avatar-modes{display:flex;margin:18rpx 24rpx;gap:12rpx;flex-shrink:0}.avatar-mode{padding:14rpx 28rpx;border-radius:14rpx;background:var(--ng-surface);color:var(--ng-secondary);font-size:24rpx;border:1rpx solid var(--ng-border)}.avatar-mode.selected{background:var(--ng-surface);border-color:rgba(99,102,241,0.25);color:var(--ng-secondary)}.avatar-video{width:100%;height:100%}.avatar-notice{font-size:24rpx;line-height:1.7;color:var(--ng-secondary);padding:0 28rpx;text-align:center;max-width:560rpx}
.page{height:100vh;display:flex;flex-direction:column;background-color:var(--ng-surface);position:relative;overflow:hidden}
.avatar-runtime-status,.xingyun-open,.tour-progress,.spot-media{position:relative;z-index:1}
.nav-spacer{flex:1;min-width:0}
.nav .nav-progress{flex:1;min-width:0;padding:4rpx 0}
.nav-progress .tp-nodes{min-width:100%;justify-content:center}
.nav-progress .tp-stats{justify-content:center;flex-wrap:wrap;gap:4rpx 12rpx}
.nav-progress .tp-stat{font-size:18rpx}
.nav-distance{max-width:56vw;font-size:20rpx;line-height:1.4;color:var(--ng-accent-text)}
.stage-guide-name{position:absolute;left:20rpx;top:58rpx;z-index:4;padding:8rpx 18rpx;border-radius:14rpx;background:rgba(255,255,255,.82);color:var(--ng-text);font-size:28rpx;font-weight:600;max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tour-gradient{position:absolute;inset:0;pointer-events:none;z-index:0;background:linear-gradient(135deg,#e5dcff 0%,#f0eaff 28%,#f8f9ff 52%,#dff4fb 76%,#e5dcff 100%);background-size:220% 220%;animation:tourGradientFlow 16s ease-in-out infinite alternate}
@keyframes tourGradientFlow{from{background-position:0% 0%}to{background-position:100% 100%}}
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}

/* 导航 */
.nav{position:relative;z-index:1;display:flex;align-items:center;padding:4rpx 20rpx;gap:12rpx;align-items:flex-start}
.nav-back{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.15);font-size:40rpx;color:var(--ng-secondary);flex-shrink:0}
.nav-title{flex:1;font-size:36rpx;font-weight:600;color:var(--ng-text);letter-spacing:4rpx;font-family:var(--app-font-family);text-align:center}
.nav-end{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);font-size:30rpx;color:var(--ng-secondary);flex-shrink:0}
.nav-gps{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.06);font-size:26rpx;color:var(--ng-secondary);flex-shrink:0}
.nav-gps.on{background:rgba(99,102,241,0.25);box-shadow:0 0 0 4rpx rgba(99,102,241,0.08)}

/* 实时小地图 */
.mini-map{position:absolute;right:12rpx;bottom:12rpx;z-index:2;width:140rpx;height:140rpx;border-radius:16rpx;overflow:hidden;border:2rpx solid rgba(99,102,241,0.25);box-shadow:0 4rpx 16rpx rgba(0,0,0,.3);transition:all .3s}
.mini-map.expanded{width:100%;height:100%;left:0;right:0;bottom:0;border-radius:0;border:none}
.mm-canvas{width:100%;height:100%}
.mm-no-coords{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--ng-surface)}
.mm-nc-text{font-size:20rpx;color:var(--ng-secondary)}
.mm-info{position:absolute;left:0;right:0;bottom:0;padding:4rpx 8rpx;background:rgba(0,0,0,.5);backdrop-filter: none}
.mm-dist{font-size:18rpx;color:#1f2937}
.mm-close{position:absolute;top:12rpx;right:12rpx;width:48rpx;height:48rpx;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:28rpx;color:#fff;z-index:3}

/* 知识卡片 */
.know-card{position:absolute;left:12rpx;top:12rpx;z-index:3;max-width:55%;animation:kcSlide .3s ease}
@keyframes kcSlide{from{opacity:0;transform:translateX(-20rpx)}to{opacity:1;transform:translateX(0)}}
.kc-inner{display:flex;flex-direction:column;gap:6rpx;padding:12rpx 14rpx;border-radius:12rpx;background:rgba(0,0,0,.65);backdrop-filter: none;border:1rpx solid rgba(99,102,241,0.2)}
.kc-tag{font-size:18rpx;color:rgba(99,102,241,0.25)}
.kc-text{font-size:20rpx;color:#1f2937;line-height:1.5}
.kc-img{width:100%;height:120rpx;border-radius:8rpx;margin-top:4rpx}

/* 数字导游区域 — 大半屏 */
.guide-stage{position:relative;z-index:1;height:34vh;display:flex;align-items:center;justify-content:center;margin:0 8rpx;border-radius:24rpx;overflow:hidden;background:linear-gradient(180deg,var(--ng-surface) 0%,var(--ng-surface) 50%,var(--ng-surface) 100%)}
.spot-bg-img{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:.28}
.spot-bg-shade{position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,rgba(0,0,0,.25) 0%,transparent 40%,transparent 60%,rgba(0,0,0,.35) 100%)}
.spot-nav-bar{position:absolute;top:16rpx;left:0;right:0;z-index:3;display:flex;align-items:center;justify-content:center;gap:12rpx;padding:0 20rpx}
.spot-arrow{width:52rpx;height:52rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);backdrop-filter: none;font-size:36rpx;color:var(--ng-text);flex-shrink:0}
.spot-label-text{padding:8rpx 16rpx;border-radius:10rpx;background:rgba(0,0,0,.45);backdrop-filter: none;color:var(--ng-text);font-size:22rpx;font-weight:700;white-space:nowrap}
.stage-status{position:absolute;bottom:16rpx;right:20rpx;z-index:2;padding:6rpx 14rpx;border-radius:10rpx;background:rgba(0,0,0,.35);backdrop-filter: none}
.stage-status text{color:var(--ng-text);font-size:22rpx}
.stage-status.on{background:rgba(99,102,241,0.12)}
.guide-img{width:80%;height:80%;background:transparent}
.guide-img.speaking{animation:guideTalk .3s ease-in-out infinite}
@keyframes guideBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@keyframes guideTalk{0%,100%{transform:scale(1)}25%{transform:scale(1.01) translateY(-2rpx)}75%{transform:scale(1.01) translateY(2rpx)}}
.guide-img-df{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16rpx}
.guide-df-icon{font-size:120rpx}
.guide-df-name{font-size:36rpx;font-weight:600;color:var(--ng-secondary);font-family:var(--app-font-family)}

/* 景点切换卡片 */
.spot-switch{position:relative;z-index:1;display:flex;align-items:center;gap:8rpx;padding:8rpx 16rpx}
.ss-arrow{width:44rpx;height:44rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ng-surface);border:1rpx solid var(--ng-border);font-size:30rpx;color:var(--ng-secondary);flex-shrink:0}
.ss-card{flex:1;display:flex;gap:12rpx;padding:10rpx 14rpx;background:var(--ng-surface);border-radius:14rpx;border:1rpx solid var(--ng-border);min-width:0}
.ss-img{width:72rpx;height:72rpx;border-radius:12rpx;flex-shrink:0}
.ss-img-df{width:72rpx;height:72rpx;border-radius:12rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);font-size:32rpx;flex-shrink:0}
.ss-info{flex:1;min-width:0}
.ss-top{display:flex;align-items:center;gap:8rpx;margin-bottom:4rpx}
.ss-name{font-size:26rpx;font-weight:600;color:var(--ng-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-cat{font-size:18rpx;color:var(--ng-secondary);background:rgba(99,102,241,0.08);padding:2rpx 10rpx;border-radius:6rpx;flex-shrink:0}
.ss-desc{font-size:20rpx;color:var(--ng-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}

/* 对话区 */
.chat-area{position:relative;z-index:1;flex:1;min-height:0;padding:12rpx 20rpx}
.chat-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}
.ce-icon{font-size:64rpx;margin-bottom:12rpx}
.ce-title{font-size:28rpx;font-weight:600;color:var(--ng-text);margin-bottom:8rpx}
.ce-sub{font-size:22rpx;color:var(--ng-secondary)}
.msg-row{margin-bottom:18rpx;display:flex}
.msg-l{justify-content:flex-start}
.msg-r{justify-content:flex-end}
.msg-bubble{max-width:82%;padding:16rpx 22rpx;border-radius:18rpx}
.msg-bubble.user{background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));border-bottom-right-radius:6rpx}
.msg-bubble.guide{background:var(--ng-surface);border:1rpx solid var(--ng-border);border-bottom-left-radius:6rpx}
.msg-bubble.user .msg-text{color:var(--ng-text)}
.msg-bubble.guide .msg-text{color:var(--ng-text)}
.msg-text{font-size:28rpx;line-height:1.8;word-break:break-word;white-space:pre-wrap}
.msg-time{font-size:20rpx;text-align:right;display:block;margin-top:6rpx}
.msg-l .msg-time{color:var(--ng-secondary)}
.msg-r .msg-time{color:var(--ng-text)}
.loading-tip{text-align:center;padding:16rpx;color:var(--ng-secondary);font-size:24rpx}

/* 底部输入 */
.bottom-bar{position:relative;z-index:1;flex-shrink:0;border-top:1rpx solid var(--ng-border);background:var(--ng-surface)}
.input-row{display:flex;align-items:center;gap:10rpx;padding:10rpx 16rpx}
.voice-btn{width:68rpx;height:68rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.15);flex-shrink:0}
.voice-btn .iconfont{font-size:32rpx;color:var(--ng-secondary)}
.voice-btn.rec{background:rgba(99,102,241,0.18)}
.voice-btn.rec .iconfont{color:var(--ng-text)}
.voice-hold-btn{flex:1;height:68rpx;display:flex;align-items:center;justify-content:center;border:1rpx solid var(--ng-border);border-radius:34rpx;background:var(--ng-surface);font-size:26rpx;color:var(--ng-secondary);font-weight:600;user-select:none}
.voice-hold-btn.pressing{background:rgba(99,102,241,.18);color:var(--ng-text)}
@keyframes recPulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.15)}50%{box-shadow:0 0 0 12rpx rgba(99,102,241,0.15)}}
.msg-input{flex:1;height:68rpx;padding:0 20rpx;border:1rpx solid var(--ng-border);border-radius:34rpx;background:var(--ng-surface);font-size:26rpx;color:var(--ng-text)}
.send-btn{height:68rpx;padding:0 26rpx;line-height:68rpx;border-radius:34rpx;background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));color:var(--ng-text);font-size:26rpx;font-weight:700;flex-shrink:0}
.send-btn.disabled{opacity:.35}
.spot-switch{flex-shrink:0}.ss-desc{line-height:1.4}.ss-card{align-items:center}.ss-img{height:80rpx;width:80rpx}

/* 游览进度时间轴 */
.tour-progress{flex-shrink:0;padding:6rpx 16rpx 8rpx}
.tp-track{white-space:nowrap}
.tp-nodes{display:inline-flex;align-items:center;gap:0;padding:4rpx 0}
.tp-node{display:inline-flex;flex-direction:column;align-items:center;min-width:100rpx;position:relative;padding:0 8rpx}
.tp-node::after{content:'';position:absolute;top:14rpx;right:-40rpx;width:40rpx;height:2rpx;background:var(--ng-border)}
.tp-node:last-child::after{display:none}
.tp-dot{width:28rpx;height:28rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ng-surface);border:2rpx solid var(--ng-border);z-index:1}
.tp-node.active .tp-dot{border-color:rgba(99,102,241,0.25);background:rgba(99,102,241,0.15);box-shadow:0 0 0 6rpx rgba(99,102,241,0.08)}
.tp-node.done .tp-dot{border-color:rgba(99,102,241,0.25);background:rgba(99,102,241,0.2)}
.tp-check{font-size:18rpx;color:var(--ng-secondary);font-weight:700}
.tp-now{font-size:14rpx;color:var(--ng-text)}
.tp-label{font-size:18rpx;color:var(--ng-secondary);margin-top:6rpx;max-width:100rpx;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-node.active .tp-label{color:var(--ng-text);font-weight:600}
.tp-node.done .tp-label{color:var(--ng-secondary)}
.guide-stage .stage-progress{position:absolute;top:0;left:0;right:0;z-index:5;box-sizing:border-box;padding:8rpx 16rpx;background:rgba(255,255,255,.82);pointer-events:none;gap:12rpx}
.tp-stats{display:flex;justify-content:space-between;align-items:center;padding:2rpx 4rpx 0}
.tp-stat{font-size:20rpx;color:var(--ng-secondary)}
.tp-stat.done{color:rgba(99,102,241,0.25)}

/* 景点沉浸式媒体 */
.spot-media{flex-shrink:0;margin:0 16rpx 4rpx;border-radius:14rpx;border:1rpx solid var(--ng-border);overflow:hidden;background:var(--ng-surface)}
.sm-bar{display:flex;align-items:center;gap:12rpx;padding:8rpx 14rpx}
.sm-thumb{width:56rpx;height:56rpx;border-radius:10rpx;flex-shrink:0}
.sm-thumb-df{width:56rpx;height:56rpx;border-radius:10rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.08);font-size:28rpx;flex-shrink:0}
.sm-bar-info{flex:1;min-width:0}
.sm-bar-title{font-size:24rpx;font-weight:600;color:var(--ng-text);display:block}
.sm-bar-sub{font-size:20rpx;color:var(--ng-secondary);display:block;margin-top:2rpx}
.sm-arrow{font-size:32rpx;color:var(--ng-secondary);flex-shrink:0;transition:transform .2s}
.sm-arrow.open{transform:rotate(90deg)}
.sm-body{padding:4rpx 14rpx 12rpx;max-height:22vh;overflow-y:auto}
.sm-section{margin-top:8rpx}
.sm-section-title{font-size:22rpx;font-weight:600;color:var(--ng-text);display:block;margin-bottom:4rpx}
.sm-section-text{font-size:22rpx;color:var(--ng-secondary);line-height:1.6}
</style>
