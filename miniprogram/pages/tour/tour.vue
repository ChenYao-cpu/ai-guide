<template>
  <view class="page">
    
    <view class="ink-bg"><view class="ink-mt ink-mt-1"></view><view class="ink-mt ink-mt-2"></view></view>

    <!-- 导航栏 -->
    <view class="nav" :style="{paddingTop: statusH+'px'}">
      <view class="nav-back" @tap="goBack"><text>‹</text></view>
      <text class="nav-title">{{ guideName || 'AI导游' }}</text>
      <view class="nav-end" @tap="confirmEnd"><text>✕</text></view>
    </view>

    <!-- 数字导游 -->
    <view class="guide-stage">
      <view v-if="avatarMode==='3d'&&threeDModelUrl&&!threeDError" class="native-3d-stage">
        <tour-avatar-3d v-if="avatarWidth>0&&avatarHeight>0" id="guide-avatar-3d" :motion-url="threeDModelUrl" :motion-started-at="motionStartedAt" :portrait="true" :width="Math.round(avatarWidth*avatarPixelRatio)" :height="Math.round(avatarHeight*avatarPixelRatio)" :key="threeDSceneUrl||threeDModelUrl" :scene-url="threeDSceneUrl||threeDModelUrl" :animation="threeDAnimation" :progress="threeDProgress" :duration="threeDDuration" :speaking="speaking" :style="{width:avatarWidth+'px',height:avatarHeight+'px',display:'block'}" @ready="threeDReady" @error="threeDFailed" />
      </view>
      <video v-else-if="videoUrl" key="speech-video" id="guide-speech-video" :muted="false" :loop="false" :src="videoUrl" class="avatar-video" object-fit="contain" :controls="true" :autoplay="true" @play="speaking=true" @pause="speaking=false" @ended="speaking=false" @error="videoError"></video>
      <image v-else-if="guideAvatar" :src="fixImg(guideAvatar)" class="selected-guide-image" mode="widthFix" @error="guideAvatar=''" />
      <view v-else class="guide-img-df"><text class="guide-df-name">{{ guideName || '数字导游' }}</text><text class="avatar-notice">待配置：该数字人的形象素材尚未上传</text></view>
      <view class="speaking-wave" v-if="speaking">
        <view v-for="i in 5" :key="i" class="sw-bar" :style="{animationDelay:(i*0.12)+'s'}"></view>
      </view>
      <view class="stage-status" :class="{on:speaking}">
        <text>{{ speaking ? '🔊 讲解中' : '待命中' }}</text>
      </view>
    </view>

    <view class="avatar-runtime-status"><text>{{ avatarMessage }}</text></view>
    <button v-if="guideProvider==='xingyun'" class="xingyun-open" @tap="openXingyun">打开所选数字人的半身导览</button>
    <!-- 景点切换卡片 -->
    <view class="spot-switch" v-if="spotCards.length">
      <view class="ss-arrow" @tap="prevSpot"><text>‹</text></view>
      <view class="ss-card" @tap="switchSpotDetail">
        <image v-if="currentSpot.image_path||currentSpot.route_cover_image" :src="fixImg(currentSpot.image_path||currentSpot.route_cover_image)" class="ss-img" mode="aspectFill"></image>
        <view v-else class="ss-img-df">🏔️</view>
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
        <text class="ce-icon">✨</text>
        <text class="ce-title">开始与AI导游对话</text>
        <text class="ce-sub">语音或文字提问，AI导游为你讲解</text>
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
        <view class="voice-btn" :class="{rec:recording}" @touchstart="startRecord" @touchend="stopRecord">
          <text class="iconfont icon-yuyin"></text>
        </view>
        <input v-model="text" class="msg-input" placeholder="输入你想了解的问题..." confirm-type="send" @confirm="onConfirm" />
        <view class="send-btn" @tap="onSend" :class="{disabled:!text||loading}">发送</view>
      </view>
    </view>
  </view>
</template>

<script>
import { BASE_URL, assetUrl } from '../../common/config.js'

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
        else reject(new Error('HTTP ' + res.statusCode))
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
}

export default {
  data: function() {
    return {
      motionStartedAt:0,sid: 0, msgs: [], spotCards: [], spotIdx: 0, avatarWidth:0, avatarHeight:0, avatarPixelRatio:1,
      guideName: '', guideAvatar: '', guideSourceVideo:'', guideProvider:'', statusH: 20,
      speaking: false, loading: false, text: '', recording: false, voicePressing: false,
      threeDSceneUrl:'',threeDAnimation:'idle',threeDProgress:0,threeDDuration:0,threeDError:false,
      avatarMode:'audio',avatarMessage:'语音导览 · 提问后播放本轮讲解',videoUrl:'',avatarCapability:null,guideId:0,
      lastMsgId: 'bottom', _voiceManager: null,
      quick: ['这里有什么历史故事？','最佳拍照点在哪里？','附近有哪些服务设施？','请介绍景点特色','下一站推荐去哪里？'],
    }
  },
  computed: {
    threeDModelUrl:function(){return assetUrl(this.avatarCapability&&this.avatarCapability.threeD&&this.avatarCapability.threeD.modelUrl||'')},
    cartoonPreviewUrl:function(){return assetUrl(this.avatarCapability && this.avatarCapability.cartoon.previewUrl || '')},
    spotName: function() {
      var c = this.spotCards[this.spotIdx]
      return c ? c.spot_name : '景区导览中'
    },
    currentSpot: function() {
      return this.spotCards[this.spotIdx] || {}
    },
  },
  methods: {
    openXingyun: function() { uni.navigateTo({url:'/pages/xingyun/xingyun?sessionId='+this.sid}) },
    measureAvatar:function(){this.avatarPixelRatio=Math.min(uni.getSystemInfoSync().pixelRatio||1,3);var self=this;uni.createSelectorQuery().in(this).select('.guide-stage').boundingClientRect(function(rect){if(rect&&rect.width&&rect.height){self.avatarWidth=rect.width;self.avatarHeight=rect.height}}).exec()},
    stopPlayback:function(){if(this._audio){this._audio.destroy();this._audio=null}if(this._avatarTimer){clearTimeout(this._avatarTimer);this._avatarTimer=null}if(this._threeDTimer){clearInterval(this._threeDTimer);this._threeDTimer=null}if(this._threeDLoadTimer){clearTimeout(this._threeDLoadTimer);this._threeDLoadTimer=null}this._pending3DAudio=null;this.threeDSceneUrl='';this.threeDAnimation='idle';this.threeDProgress=0;this.threeDDuration=0;this._playbackVersion=(this._playbackVersion||0)+1;this.speaking=false;this.videoUrl=''},
    switchMode:function(mode){if(this.loading)return;this.stopPlayback();this.avatarMode=mode;this.updateAvatarMessage()},
    updateAvatarMessage:function(){if(this.avatarMode==='audio'){this.avatarMessage='语音导览 · 提问后播放本轮讲解';return}var capability=this.avatarCapability&&this.avatarCapability[this.avatarMode==='3d'?'threeD':this.avatarMode];this.avatarMessage=capability?capability.message:'正在查询数字人服务状态'},
    threeDReady:function(){if(!this.motionStartedAt)this.motionStartedAt=Date.now();if(this._threeDLoadTimer){clearTimeout(this._threeDLoadTimer);this._threeDLoadTimer=null}var p=this._pending3DAudio;if(p&&p.version===this._playbackVersion){this._pending3DAudio=null;this.playAudio(p.url);this.avatarMessage='3D讲解 · 定时手臂动作，口型跟随语音'}},
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
    prevSpot: function(){ if(this.spotCards.length>1){ this.spotIdx=(this.spotIdx-1+this.spotCards.length)%this.spotCards.length; this.send('请介绍「'+this.spotName+'」') }},
    nextSpot: function(){ if(this.spotCards.length>1){ this.spotIdx=(this.spotIdx+1)%this.spotCards.length; this.send('请介绍「'+this.spotName+'」') }},
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
            var job=d.data&&d.data.avatarJob
            var performance=d.data&&d.data.avatarPerformance
            if(performance&&performance.scene_url){self.prepare3D(performance,d.data.ttsAudioUrl,playbackVersion)}
            else if(job&&job.job_id){self.pollAvatar(job,playbackVersion)}
            else{if(job)self.avatarMessage=job.message;if(d.data&&d.data.ttsAudioUrl)self.playAudio(d.data.ttsAudioUrl)}
          }
          self.refresh()
        } else { uni.showToast({title:(d&&d.message)||'回复失败',icon:'none'}) }
      }).catch(function(e) {
        uni.showToast({title:'网络超时，请重试',icon:'none'})
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
            if(self.guideProvider==='xingyun'){self.guideId=gid;self.avatarMode='audio';self.avatarMessage='尚未连接星云：点击下方按钮打开半身数字人；本页可使用文字和语音导览'}else if(gid&&gid!==self.guideId){self.guideId=gid;self._capabilityPromise=request({url:'/avatar/capabilities/'+gid}).then(function(r){self.avatarCapability=r.data.data;self.avatarMode=self.avatarCapability.preferredMode==='3d'&&self.avatarCapability.threeD&&self.avatarCapability.threeD.ready?'3d':self.avatarCapability.realistic.ready?'realistic':(self.avatarCapability.cartoon.ready?'cartoon':'audio');self.updateAvatarMessage();if(!self.guideAvatar&&self.avatarCapability.cartoon.previewUrl)self.guideAvatar=self.avatarCapability.cartoon.previewUrl}).catch(function(){self.avatarMessage='数字人服务状态查询失败'})}
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
    confirmEnd: function() {
      var self = this
      uni.showModal({
        title: '结束导览', content: '确定要结束本次导览吗？',
        success: function(res) {
          if (res.confirm) { api.endSession(self.sid).catch(function(){}); uni.navigateBack() }
        },
      })
    },
    startRecord: function() {
      var self = this; self.recording = true; self.voicePressing = true
      var rm = uni.getRecorderManager(); self._voiceManager = rm
      rm.onStop(function(res) {
        self.recording = false; self.voicePressing = false
        if (res.tempFilePath && res.duration > 500) {
          uni.uploadFile({
            url: BASE_URL + '/asr/google', filePath: res.tempFilePath, name: 'file',
            success: function(r) {
              try { var d = JSON.parse(r.data); if (d&&d.success&&d.data) { self.text = d.data; self.send(d.data); return } }
              catch(e) {}
              uni.showToast({ title: '语音识别失败，请重试', icon: 'none' })
            },
            fail: function() { uni.showToast({ title: '语音识别失败，请重试', icon: 'none' }) }
          })
        } else {
          uni.showToast({ title: '语音识别失败，请重试', icon: 'none' })
        }
      })
      rm.onError(function() { self.recording = false; self.voicePressing = false; uni.showToast({ title: '语音识别失败，请重试', icon: 'none' }) })
      rm.start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' })
    },
    stopRecord: function() { if (this._voiceManager) { this._voiceManager.stop() } else { this.recording = false; uni.showToast({ title: '语音识别失败，请重试', icon: 'none' }) } },
  },
  onReady:function(){this.measureAvatar()},
  onResize:function(){this.$nextTick(this.measureAvatar)},
  onUnload:function(){this.stopPlayback()},
  onHide:function(){this.stopPlayback()},
  onLoad: function(opts) {
    this.sid = Number(opts.sessionId || 0)
    if (!this.sid) { uni.showToast({title:'会话ID无效',icon:'none'}); return }
    var s = uni.getSystemInfoSync()
    this.statusH = (s.statusBarHeight || 20) + 6
    this.refresh()
  },
}
</script>

<style scoped>
.xingyun-open{margin:8rpx 24rpx;padding:8rpx 24rpx;border:1rpx solid #dce0e9;border-radius:14rpx;color:#3b5bff;background:#fff;font-size:26rpx;flex-shrink:0}
.native-3d-stage{width:100%;height:100%;overflow:hidden;border-radius:24rpx;}
.avatar-runtime-status{padding:12rpx 24rpx;color:#59657a;font-size:22rpx;line-height:1.6;flex-shrink:0}
.selected-guide-image{position:absolute;top:0;left:0;width:100%;height:auto}.guide-stage{flex-shrink:0}
.avatar-modes{display:flex;margin:18rpx 24rpx;gap:12rpx;flex-shrink:0}.avatar-mode{padding:14rpx 28rpx;border-radius:14rpx;background:#ffffff;color:#7b8599;font-size:24rpx;border:1rpx solid #eceef3}.avatar-mode.selected{background:#e5eaff;border-color:#3b5bff;color:#3b5bff}.avatar-video{width:100%;height:100%}.avatar-notice{font-size:24rpx;line-height:1.7;color:#7b8599;padding:0 28rpx;text-align:center;max-width:560rpx}
.page{height:100vh;display:flex;flex-direction:column;background-color:#f6f7fa;position:relative;overflow:hidden}
.ink-bg{position:absolute;inset:0;pointer-events:none;z-index:0}
.ink-mt{position:absolute;left:0;right:0;background:#172033;border-radius:55% 75% 0 0}
.ink-mt-1{bottom:20%;height:220rpx;opacity:.04;transform:scaleX(1.3)}
.ink-mt-2{bottom:25%;height:160rpx;opacity:.025;transform:scaleX(1.5) translateX(-8%)}
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}

/* 导航 */
.nav{position:relative;z-index:1;display:flex;align-items:center;padding:4rpx 20rpx;gap:12rpx}
.nav-back{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(59,91,255,.15);font-size:40rpx;color:#7b8599;flex-shrink:0}
.nav-title{flex:1;font-size:36rpx;font-weight:600;color:#172033;letter-spacing:4rpx;font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;text-align:center}
.nav-end{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(59,91,255,.1);font-size:30rpx;color:#3b5bff;flex-shrink:0}

/* 数字导游区域 — 大半屏 */
.guide-stage{position:relative;z-index:1;height:42vh;display:flex;align-items:center;justify-content:center;margin:0 8rpx;border-radius:24rpx;overflow:hidden;background:linear-gradient(180deg,#f3f5ff 0%,#e5eaff 50%,#dfe3ff 100%)}
.spot-nav-bar{position:absolute;top:16rpx;left:0;right:0;z-index:3;display:flex;align-items:center;justify-content:center;gap:12rpx;padding:0 20rpx}
.spot-arrow{width:52rpx;height:52rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);backdrop-filter:blur(8rpx);font-size:36rpx;color:#fff;flex-shrink:0}
.spot-label-text{padding:8rpx 16rpx;border-radius:10rpx;background:rgba(0,0,0,.45);backdrop-filter:blur(8rpx);color:#fff;font-size:22rpx;font-weight:700;white-space:nowrap}
.stage-status{position:absolute;bottom:16rpx;right:20rpx;z-index:2;padding:6rpx 14rpx;border-radius:10rpx;background:rgba(0,0,0,.35);backdrop-filter:blur(8rpx)}
.stage-status text{color:#fff;font-size:22rpx}
.stage-status.on{background:rgba(34,197,94,.5)}
.guide-img{width:80%;height:80%;background:transparent}
.guide-img.speaking{animation:guideTalk .3s ease-in-out infinite}
@keyframes guideBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@keyframes guideTalk{0%,100%{transform:scale(1)}25%{transform:scale(1.01) translateY(-2rpx)}75%{transform:scale(1.01) translateY(2rpx)}}
.guide-img-df{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16rpx}
.guide-df-icon{font-size:120rpx}
.guide-df-name{font-size:36rpx;font-weight:600;color:#7b8599;font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif}
.speaking-wave{position:absolute;bottom:80rpx;left:50%;transform:translateX(-50%);display:flex;gap:8rpx;align-items:flex-end;height:60rpx;z-index:2}
.sw-bar{width:6rpx;border-radius:3rpx;background:linear-gradient(180deg,#3b5bff,#e5eaff);animation:swAnim .6s ease-in-out infinite}
@keyframes swAnim{0%,100%{height:12rpx}50%{height:48rpx}}
@keyframes swAnim{0%,100%{height:12rpx}50%{height:48rpx}}

/* 景点切换卡片 */
.spot-switch{position:relative;z-index:1;display:flex;align-items:center;gap:8rpx;padding:8rpx 16rpx}
.ss-arrow{width:44rpx;height:44rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.6);border:1rpx solid rgba(116,125,145,.2);font-size:30rpx;color:#7b8599;flex-shrink:0}
.ss-card{flex:1;display:flex;gap:12rpx;padding:10rpx 14rpx;background:#ffffff;border-radius:14rpx;border:1rpx solid rgba(116,125,145,.15);min-width:0}
.ss-img{width:72rpx;height:72rpx;border-radius:12rpx;flex-shrink:0}
.ss-img-df{width:72rpx;height:72rpx;border-radius:12rpx;display:flex;align-items:center;justify-content:center;background:rgba(116,125,145,.1);font-size:32rpx;flex-shrink:0}
.ss-info{flex:1;min-width:0}
.ss-top{display:flex;align-items:center;gap:8rpx;margin-bottom:4rpx}
.ss-name{font-size:26rpx;font-weight:600;color:#172033;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-cat{font-size:18rpx;color:#3b5bff;background:rgba(59,91,255,.08);padding:2rpx 10rpx;border-radius:6rpx;flex-shrink:0}
.ss-desc{font-size:20rpx;color:#7b8599;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}

/* 对话区 */
.chat-area{position:relative;z-index:1;flex:1;min-height:0;padding:12rpx 20rpx}
.chat-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}
.ce-icon{font-size:64rpx;margin-bottom:12rpx}
.ce-title{font-size:28rpx;font-weight:600;color:#172033;margin-bottom:8rpx}
.ce-sub{font-size:22rpx;color:#7b8599}
.msg-row{margin-bottom:18rpx;display:flex}
.msg-l{justify-content:flex-start}
.msg-r{justify-content:flex-end}
.msg-bubble{max-width:82%;padding:16rpx 22rpx;border-radius:18rpx}
.msg-bubble.user{background:linear-gradient(135deg,#3b5bff,#617bff);border-bottom-right-radius:6rpx}
.msg-bubble.guide{background:#ffffff;border:1rpx solid rgba(116,125,145,.2);border-bottom-left-radius:6rpx}
.msg-bubble.user .msg-text{color:#f6f7fa}
.msg-bubble.guide .msg-text{color:#172033}
.msg-text{font-size:28rpx;line-height:1.8;word-break:break-word;white-space:pre-wrap}
.msg-time{font-size:20rpx;text-align:right;display:block;margin-top:6rpx}
.msg-l .msg-time{color:#7b8599}
.msg-r .msg-time{color:#f2f5fa}
.loading-tip{text-align:center;padding:16rpx;color:#7b8599;font-size:24rpx}

/* 底部输入 */
.bottom-bar{position:relative;z-index:1;flex-shrink:0;border-top:1rpx solid rgba(89,100,123,.08);background:#f2f5fa}
.input-row{display:flex;align-items:center;gap:10rpx;padding:10rpx 16rpx}
.voice-btn{width:68rpx;height:68rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(59,91,255,.15);flex-shrink:0}
.voice-btn .iconfont{font-size:32rpx;color:#7b8599}
.voice-btn.rec{background:#3b5bff}
.voice-btn.rec .iconfont{color:#f6f7fa}
@keyframes recPulse{0%,100%{box-shadow:0 0 0 0 rgba(59,91,255,.4)}50%{box-shadow:0 0 0 12rpx rgba(59,91,255,0)}}
.msg-input{flex:1;height:68rpx;padding:0 20rpx;border:1rpx solid rgba(116,125,145,.3);border-radius:34rpx;background:#ffffff;font-size:26rpx;color:#172033}
.send-btn{height:68rpx;padding:0 26rpx;line-height:68rpx;border-radius:34rpx;background:linear-gradient(135deg,#3b5bff,#617bff);color:#f6f7fa;font-size:26rpx;font-weight:700;flex-shrink:0}
.send-btn.disabled{opacity:.35}
.spot-switch{flex-shrink:0}.ss-desc{line-height:1.4}.ss-card{align-items:center}.ss-img{height:80rpx;width:80rpx}
</style>
