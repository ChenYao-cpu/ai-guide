<template>
  <view class="page aurora-page">
    <view class="aurora-background" aria-hidden="true"><view class="aurora-wave aurora-wave-one"></view><view class="aurora-wave aurora-wave-two"></view><view class="aurora-shine"></view></view>
    
    <!-- 水墨背景 -->
    <view class="ink-bg">
      <view class="ink-mountain ink-mt-1"></view>
      <view class="ink-mountain ink-mt-2"></view>
      <view class="ink-circle ink-c-1"></view>
    </view>

    <!-- 标题 -->
    <view class="nav" :style="{paddingTop: statusH+'px'}">
      <text class="nav-title">AI 小导游</text>
      <text class="nav-clear" v-if="msgs.length" @tap="clearHistory">清空</text>
    </view>

    <!-- 快捷提示 -->
    <view class="quick-hints" v-if="msgs.length === 0">
      <view class="qh-chip" @tap="quickSend('我想带孩子玩2小时，喜欢自然风光')">亲子2小时自然游</view>
      <view class="qh-chip" @tap="quickSend('推荐颐和园的历史文化景点，半天时间')">颐和园历史文化半天</view>
      <view class="qh-chip" @tap="quickSend('帮我规划一个适合拍照的一日游路线')">拍照打卡一日游</view>
      <view class="qh-chip" @tap="quickSend('周末带朋友玩半天，喜欢美食和拍照')">周末美食拍照</view>
    </view>

    <!-- 对话区 -->
    <scroll-view scroll-y class="chat-area" :scroll-into-view="lastId">
      <view v-if="msgs.length === 0 && !loading" class="chat-empty">
        <text class="ce-icon">✨</text>
        <text class="ce-title">告诉我你的需求</text>
        <text class="ce-sub">语音或文字说出需求，智能推荐最佳景点</text>
      </view>
      <view v-for="(m, i) in msgs" :key="i" :id="'m-'+i" class="msg-row" :class="m.role==='ai'?'msg-l':'msg-r'">
        <view class="msg-bubble" :class="m.role">
          <text class="msg-text">{{ m.content }}</text>
          <view v-if="m.role==='ai'&&i===msgs.length-1" class="msg-speaker" :class="{on:speaking}" @tap="replayTTS(m.content)">
            <text>{{ speaking ? '🔊' : '🔈' }}</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="msg-row msg-l">
        <view class="msg-bubble ai typing">
          <text class="msg-text">AI思考中...</text>
        </view>
      </view>
      <view id="bottom"></view>
    </scroll-view>

    <!-- 推荐结果 -->
    <view class="result-bar" v-if="lastSpotIds.length > 0 && !loading">
      <text>✅ 已推荐 {{ lastSpotIds.length }} 个景点</text>
      <view class="rb-btn" @tap="applyRecommend">应用并返回</view>
    </view>

    <!-- 语音录音提示 -->
    <view class="recording-hint" v-if="recording">
      <view class="rh-wave">
        <view v-for="i in 5" :key="i" class="rh-bar" :style="{animationDelay: (i*0.12)+'s'}"></view>
      </view>
      <text class="rh-text">{{ recordingText }}</text>
    </view>

    <!-- 底部固定区：输入框 + Tab，flex竖向排列 -->
    <view class="bottom-fixed">
      <!-- 输入栏 -->
    <view class="input-bar">
      <view class="voice-btn" :class="{ active: voiceMode }" @tap="toggleVoiceMode">
        <text class="iconfont" :class="voiceMode ? 'icon-liaotian' : 'icon-yuyin'"></text>
      </view>
      <input v-if="!voiceMode" v-model="text" class="msg-input" placeholder="描述你的游览需求..." confirm-type="send" @confirm="sendText" :disabled="loading"/>
      <view v-else class="voice-hold-btn" :class="{ pressing: voicePressing }" @touchstart="startRecord" @touchend="stopRecord">
        <text>{{ voicePressing ? '正在听...' : '按住说话' }}</text>
      </view>
      <view v-if="!voiceMode" class="send-btn" :class="{ disabled: !text.trim() || loading }" @tap="sendText">
        <text>发送</text>
      </view>
    </view>

    <view class="tb-root"><view class="tb-ink-line"></view><view class="tb-inner"><view class="tb-item highlight" @tap="goTab('/pages/tour-guide/tour-guide')"><view class="tb-hl-ring"><text class="tb-icon iconfont icon-daolan"></text></view><text class="tb-label">智能导览</text></view><view class="tb-item highlight on"><view class="tb-hl-ring on"><text class="tb-icon iconfont icon-aishuziren"></text></view><text class="tb-label">AI小导游</text><view class="tb-dot"></view></view><view class="tb-item highlight" @tap="goTab('/pages/mine/mine')"><view class="tb-hl-ring"><text class="tb-icon iconfont icon-wode1"></text></view><text class="tb-label">我的</text></view></view><view class="tb-safe"></view></view>
    </view>
  </view>
</template>

<script>
import { BASE_URL, assetUrl } from '../../common/config.js'



function request(options) {
  return new Promise(function (resolve, reject) {
    var url = options.url
    if (url.indexOf('http') !== 0) url = BASE_URL + url
    uni.request({
      url: url, method: options.method || 'GET',
      data: options.data || {}, header: { 'Content-Type': 'application/json' },
      timeout: 20000,
      success: function (res) { if (res.statusCode === 200) resolve({ data: res.data }); else reject(new Error('HTTP ' + res.statusCode)) },
      fail: function (err) { reject(err) },
    })
  })
}

export default {
  data: function () {
    return {
      text: '', msgs: [], loading: false, lastId: 'bottom', lastSpotIds: [],
      voiceMode: false, recording: false, voicePressing: false, speaking: false,
      recordingText: '正在聆听...', _voiceManager: null, _voiceTimer: null, _ws: null, statusH:20,
    }
  },
  mounted:function(){this.statusH=(uni.getSystemInfoSync().statusBarHeight||20)+6},
  methods: {
    saveHistory:function(){try{uni.setStorageSync('ai_chat_msgs',JSON.stringify(this.msgs))}catch(e){}},
    loadHistory:function(){try{var r=uni.getStorageSync('ai_chat_msgs');if(r)this.msgs=JSON.parse(r)}catch(e){this.msgs=[]}},
    clearHistory:function(){this.msgs=[];uni.removeStorageSync('ai_chat_msgs');uni.showToast({title:'已清除',icon:'none'})},
    goTab:function(p){uni.reLaunch({url:p})},
    quickSend: function (msg) { this.text = msg; this.sendText() },
    sendText: function () {
      var self = this
      var msg = (self.text || '').trim()
      if (!msg || self.loading) return
      self.msgs.push({ role: 'user', content: msg })
      self.text = ''; self.loading = true; self.lastId = 'bottom'
      request({
        url: '/tour-session/ai-chat-recommend?message=' + encodeURIComponent(msg),
        method: 'POST', data: {},
      }).then(function (res) {
        var d = res.data
        if (d && d.success && d.data) {
          var dd = d.data
          self.msgs.push({ role: 'ai', content: dd.ai_response || '已为您推荐景点' })
          if (dd.spot_ids && dd.spot_ids.length) {
            self.lastSpotIds = dd.spot_ids
            uni.setStorageSync('ai_spot_ids', JSON.stringify(dd.spot_ids))
          }
          self.playTTS(dd.ai_response)
        } else { self.msgs.push({ role: 'ai', content: '抱歉，推荐失败' }) }
      }).catch(function () {
        self.msgs.push({ role: 'ai', content: '抱歉，AI 推荐服务暂时不可用，请确认后端已启动后重试。' })
      })
      .finally(function () { self.loading = false; self.lastId = 'bottom'; self.saveHistory() })
    },
    applyRecommend: function () {
      uni.setStorageSync('ai_spot_ids', JSON.stringify(this.lastSpotIds))
      uni.showToast({ title: '已选中' + this.lastSpotIds.length + '个景点', icon: 'success' })
      setTimeout(function () { uni.reLaunch({ url: '/pages/tour-guide/tour-guide' }) }, 500)
    },
    toggleVoiceMode: function () { this.voiceMode = !this.voiceMode },
    replayTTS: function (text) { this.playTTS(text) },
    playTTS: function (text) {
      if (!text) return
      var self = this
      var clean = text.replace(/\*\*/g,'').replace(/[\[\]]/g,'').replace(/[（）\(\)]/g,'，').replace(/\n+/g,'，').substring(0,120)
      request({ url: '/tts/edge?text=' + encodeURIComponent(clean) }).then(function (res) {
        if (res.data && res.data.success && res.data.data) {
          var url = res.data.data
          if (url.indexOf('http') !== 0) url = BASE_URL + url
          else url = assetUrl(url)
          var audio = uni.createInnerAudioContext()
          audio.src = url; audio.autoplay = true
          audio.onPlay(function(){self.speaking=true})
          audio.onEnded(function(){self.speaking=false;audio.destroy()})
          audio.onError(function(){self.speaking=false;audio.destroy()})
        }
      }).catch(function () {})
    },

    // ===== 语音输入（录音→后端Google ASR→自动发送）=====
    startRecord: function () {
      var self = this; self.voicePressing = true; self.recording = true; self.recordingText = '正在聆听...'
      var rm = uni.getRecorderManager(); self._voiceManager = rm
      rm.onStop(function (res) {
        self.voicePressing = false; self.recording = false; self.voiceMode = false
        if (res.tempFilePath && res.duration > 500) {
          uni.uploadFile({
            url: BASE_URL + '/asr/google', filePath: res.tempFilePath, name: 'file',
            success: function (r) {
              try { var d = JSON.parse(r.data); if (d&&d.success&&d.data) { self.text = d.data; self.sendText(); return } } catch(e) {}
              uni.showToast({ title: '语音识别失败，请重试', icon: 'none' })
            },
            fail: function () { uni.showToast({ title: '语音识别失败，请重试', icon: 'none' }) }
          })
        } else {
          uni.showToast({ title: '语音识别失败，请重试', icon: 'none' })
        }
      })
      rm.onError(function () { self.voicePressing = false; self.recording = false; self.voiceMode = false; uni.showToast({ title: '语音识别失败，请重试', icon: 'none' }) })
      rm.start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' })
    },
    stopRecord: function () { if (this._voiceManager) { this._voiceManager.stop() } else { this.recording = false; this.voiceMode = false; uni.showToast({ title: '语音识别失败，请重试', icon: 'none' }) } },
    cancelRecord: function () { this.voicePressing = false; this.recording = false; if (this._voiceManager) { this._voiceManager.stop() } },
  },
  onShow:function(){this.loadHistory()},
}
</script>

<style scoped>
.page { min-height: 100vh; display: flex; flex-direction: column; background-color: #f6f7fa; position: relative; overflow: hidden; padding-bottom: 200rpx; }
.ink-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.ink-mountain { position: absolute; left: 0; right: 0; background: #172033; border-radius: 50% 70% 0 0; opacity: 0.03; }
.ink-mt-1 { bottom: 30%; height: 180rpx; transform: scaleX(1.3); }
.ink-mt-2 { bottom: 35%; height: 130rpx; opacity: 0.02; transform: scaleX(1.5) translateX(-10%); }
.ink-circle { position: absolute; top: 20%; right: -100rpx; width: 360rpx; height: 360rpx; border-radius: 50%; border: 1rpx solid rgba(139,69,19,0.05); }

.nav{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;padding:16rpx 24rpx}
.nav-title { font-size: 44rpx; font-weight: 900; color: #172033; letter-spacing: 8rpx; font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; }
.nav-clear{position:absolute;right:28rpx;font-size:24rpx;color:#7b8599;padding:6rpx 14rpx;border-radius:8rpx;background:rgba(89,100,123,.06)}

.quick-hints { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 10rpx; padding: 8rpx 24rpx 16rpx; }
.qh-chip { padding: 12rpx 20rpx; border-radius: 22rpx; background: rgba(59,91,255,0.12); border: 1rpx solid rgba(59,91,255,0.2); font-size: 22rpx; color: #7b8599; }
.qh-chip:active { background: rgba(59,91,255,0.2); }

.chat-area { position: relative; z-index: 1; flex: 1; padding: 16rpx 24rpx; }
.chat-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300rpx; }
.ce-icon { font-size: 72rpx; margin-bottom: 18rpx; display: inline-block; animation: bounceBall 2.4s ease-in-out infinite; }
@keyframes bounceBall { 0%,100%{transform:translateY(0)} 4%{transform:translateY(-36rpx)} 8%{transform:translateY(0)} 12%{transform:translateY(-24rpx)} 16%{transform:translateY(0)} 20%{transform:translateY(-14rpx)} 24%{transform:translateY(0)} 28%{transform:translateY(-6rpx)} 32%{transform:translateY(0)} }
.ce-title { font-size: 32rpx; font-weight: 800; color: #172033; margin-bottom: 10rpx; }
.ce-sub { font-size: 24rpx; color: #7b8599; }

.msg-row { margin-bottom: 22rpx; display: flex; }
.msg-l { justify-content: flex-start; }
.msg-r { justify-content: flex-end; }
.msg-bubble { max-width: 82%; padding: 18rpx 24rpx; border-radius: 18rpx; }
.msg-bubble.user { background: linear-gradient(135deg, #3b5bff, #617bff); border-bottom-right-radius: 6rpx; }
.msg-bubble.ai { background: #ffffff; border: 1rpx solid rgba(116,125,145,0.2); border-bottom-left-radius: 6rpx; }
.msg-bubble.user .msg-text { color: #f6f7fa; }
.msg-bubble.ai .msg-text { color: #172033; }
.msg-text { font-size: 28rpx; line-height: 1.8; word-break: break-word; white-space: pre-wrap; }
.typing .msg-text { color: #7b8599; font-size: 24rpx; }
.msg-speaker{margin-top:8rpx;text-align:right;font-size:24rpx}
.msg-speaker.on{animation:spkPulse .6s ease-in-out infinite}
@keyframes spkPulse{0%,100%{opacity:1}50%{opacity:.4}}

.result-bar { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; padding: 14rpx 20rpx; margin: 0 20rpx 8rpx; background: rgba(59,91,255,0.15); border: 1rpx solid rgba(59,91,255,0.15); border-radius: 14rpx; font-size: 24rpx; color: #172033; font-weight: 600; }
.rb-btn { padding: 8rpx 20rpx; border-radius: 20rpx; background: linear-gradient(135deg, #3b5bff, #617bff); color: #f6f7fa; font-size: 22rpx; font-weight: 700; }

.recording-hint { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 16rpx 0 8rpx; gap: 10rpx; }
.rh-wave { display: flex; gap: 5rpx; align-items: flex-end; height: 50rpx; }
.rh-bar { width: 5rpx; min-height: 10rpx; border-radius: 3rpx; background: #3b5bff; animation: waveAnim 0.6s ease-in-out infinite; }
@keyframes waveAnim { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(3); } }
.rh-text { font-size: 26rpx; color: #3b5bff; font-weight: 700; }

.bottom-fixed{position:fixed;bottom:0;left:0;right:0;z-index:998;display:flex;flex-direction:column;background:#f2f5fa;backdrop-filter:blur(12rpx)}.input-bar{display:flex;gap:10rpx;align-items:center;padding:10rpx 16rpx;background:#ffffff;border-top:1rpx solid rgba(89,100,123,0.08);margin:0}
.voice-btn { width: 68rpx; height: 68rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(59,91,255,0.15); font-size: 28rpx; }
.voice-btn.active { background: #3b5bff; color: #f6f7fa; }
.msg-input { flex: 1; height: 68rpx; padding: 0 18rpx; border: 1rpx solid rgba(116,125,145,0.25); border-radius: 34rpx; background: #f6f7fa; font-size: 26rpx; color: #172033; }
.voice-hold-btn { flex: 1; height: 68rpx; display: flex; align-items: center; justify-content: center; border: 1rpx dashed rgba(59,91,255,0.3); border-radius: 34rpx; background: rgba(59,91,255,0.08); font-size: 26rpx; color: #3b5bff; font-weight: 600; }
.voice-hold-btn.pressing { background: linear-gradient(135deg, #3b5bff, #617bff); color: #f6f7fa; border-style: solid; }
.send-btn { height: 68rpx; padding: 0 26rpx; line-height: 68rpx; border-radius: 34rpx; background: linear-gradient(135deg, #3b5bff, #617bff); color: #f6f7fa; font-size: 26rpx; font-weight: 700; }
.send-btn.disabled { opacity: 0.35; }

.tb-root{background:transparent}
.tb-ink-line{height:1rpx;background:linear-gradient(90deg,transparent,rgba(89,100,123,.2),transparent);margin:0 32rpx}
.tb-inner{display:flex;align-items:center;justify-content:space-around;padding:4rpx 8rpx}
.tb-item{display:flex;flex-direction:column;align-items:center;gap:4rpx;padding:2rpx 10rpx;position:relative;flex:1}
.tb-icon{font-size:38rpx}.tb-label{font-size:20rpx;font-weight:600;color:#7b8599}
.tb-dot{position:absolute;bottom:-4rpx;width:24rpx;height:4rpx;border-radius:2rpx;background:#3b5bff;opacity:.6}
.tb-item.on .tb-label{color:#3b5bff;font-weight:600}.tb-item.on .tb-icon{transform:scale(1.1)}
.tb-hl-ring{width:68rpx;height:68rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(59,91,255,.2);border:2rpx solid rgba(59,91,255,.15);margin-bottom:-2rpx}
.tb-hl-ring.on{background:linear-gradient(135deg,#3b5bff,#617bff);border-color:transparent;box-shadow:0 6rpx 18rpx rgba(59,91,255,.25);animation:tabBounce .4s ease-out}
.tb-hl-ring .tb-icon{font-size:34rpx}.tb-safe{height:env(safe-area-inset-bottom,10rpx);min-height:2rpx}
@keyframes tabBounce{0%{transform:scale(1)}30%{transform:scale(1.15)}60%{transform:scale(.95)}100%{transform:scale(1)}}
</style>
