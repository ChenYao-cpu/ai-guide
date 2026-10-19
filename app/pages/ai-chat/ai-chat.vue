<template>
  <view class="page aurora-page" :class="tabEnterClass">
    <!-- #ifdef APP-PLUS || H5 -->
    <chat-voice :payload="voicePayload" @state="onDigitalVoiceState" style="position:fixed;left:-2000px;top:0;width:240px;height:320px;pointer-events:none" aria-hidden="true" />
    <!-- #endif -->
    <view class="aurora-background" aria-hidden="true"><view class="aurora-wave aurora-wave-one"></view><view class="aurora-wave aurora-wave-two"></view><view class="aurora-shine"></view></view>

    <!-- 水墨背景 -->
    <view class="ink-bg">
      <view class="ink-mountain ink-mt-1"></view>
      <view class="ink-mountain ink-mt-2"></view>
      <view class="ink-circle ink-c-1"></view>
    </view>

    <!-- 标题 -->
    <view class="nav" :style="{paddingTop:statusH+'px'}">
      <text class="nav-clear" v-if="msgs.length" @tap="clearHistory">{{ t("清空") }}</text>
    </view>

    <!-- 快捷提示 -->
    <view class="quick-hints" v-if="msgs.length === 0">
      <view class="qh-chip" @tap="quickSend(t('我想带孩子玩2小时，喜欢自然风光'))">{{ t("亲子2小时自然游") }}</view>
      <view class="qh-chip" @tap="quickSend(t('推荐颐和园的历史文化景点，半天时间'))">{{ t("颐和园历史文化半天") }}</view>
      <view class="qh-chip" @tap="quickSend(t('帮我规划一个适合拍照的一日游路线'))">{{ t("拍照打卡一日游") }}</view>
      <view class="qh-chip" @tap="quickSend(t('周末带朋友玩半天，喜欢美食和拍照'))">{{ t("周末美食拍照") }}</view>
    </view>

    <!-- 对话区 -->
    <scroll-view scroll-y class="chat-area" :scroll-top="chatScrollTop" :scroll-with-animation="true">
      <view v-if="msgs.length === 0 && !loading" class="chat-empty">

        <text class="ce-title">{{ t("想去哪里？") }}</text>

      </view>
      <view v-for="(m, i) in msgs" :key="i" :id="'m-'+i" class="msg-row" :class="m.role==='ai'?'msg-l':'msg-r'">
        <view class="msg-bubble" :class="m.role">
          <image v-if="m.image" :src="m.image" class="chat-photo" mode="widthFix" @load="scrollChat" @tap="previewChatPhoto(m.image)" />
          <text v-if="m.content" class="msg-text">{{ m.content }}</text>
          <view v-if="m.role==='ai' && m.content" class="msg-speaker" :class="{on:speaking && speakingIndex===i}" @tap="replayTTS(m.content,i)">
            <text>{{ speakingIndex===i ? (ttsLoading ? t('正在生成语音…') : t('停止播报')) : t('语音播报') }}</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="msg-row msg-l">
        <view class="msg-bubble ai typing">
          <text class="msg-text">{{ t("AI思考中...") }}</text>
        </view>
      </view>
      <view id="bottom"></view>
    </scroll-view>

    <!-- 路线预览时间轴 -->
    <view class="route-preview" v-if="lastSpotIds.length > 0 && !loading">
      <view class="rp-head">
        <text class="rp-title">{{ t("路线预览") }}</text>
        <text class="rp-count">{{ recommendSpots.length || lastSpotIds.length }}{{ t("个景点") }}</text>
      </view>
      <view v-if="recommendLoading" class="rp-loading"><text>{{ t("路线加载中...") }}</text></view>
      <view v-else-if="recommendSpots.length" class="rp-timeline">
        <view v-for="(s, i) in recommendSpots" :key="s.spot_id" class="rp-item">
          <view class="rp-rail">
            <view class="rp-dot" :class="{ start: i === 0, end: i === recommendSpots.length - 1 }">{{ i + 1 }}</view>
            <view class="rp-line" v-if="i < recommendSpots.length - 1"></view>
          </view>
          <view class="rp-card">
            <image v-if="s.image_path" :src="fixImg(s.image_path)" class="rp-img" mode="aspectFill"></image>
            <view v-else class="rp-img rp-img-df"></view>
            <view class="rp-info">
              <text class="rp-name">{{ t(s.spot_name) }}</text>
              <text class="rp-cat">{{ t('预计') }} {{ s.visit_duration || 20 }}{{ t('分钟') }}</text>
              <text v-if="i < recommendSpots.length - 1" class="rp-walk">{{ t('↓ 步行约') }} {{ walkText(s, recommendSpots[i + 1]) }}</text>
            </view>
          </view>
        </view>
        <view class="rp-total">
          <text class="rp-total-label">{{ t("预计总时长") }}</text>
          <text class="rp-total-value">{{ totalDuration }}{{ t('分钟') }}</text>
        </view>
      </view>
    </view>

    <!-- 推荐结果 -->
    <view class="result-bar" v-if="lastSpotIds.length > 0 && !loading">
      <text> 已推荐 {{ lastSpotIds.length }} 个景点</text>
      <view class="rb-btn" @tap="applyRecommend">{{ t("使用路线") }}</view>
    </view>

    <view v-if="voiceError && !transcribing" class="voice-status">{{ t(voiceError) }}</view>
    <!-- 语音录音提示 -->
    <view class="recording-hint" v-if="recording">
      <view class="rh-wave">
        <view v-for="i in 5" :key="i" class="rh-bar" :style="{animationDelay:(i*0.12)+'s'}"></view>
      </view>
      <text class="rh-text">{{ t(recordingText) }}</text>
    </view>

    <!-- 底部固定区：输入框 + Tab，flex竖向排列 -->
    <view class="bottom-fixed" :class="{'keyboard-open':keyboardVisible}">
      <view v-if="pendingPhoto || recognitionError" class="photo-draft">
        <view v-if="pendingPhoto" class="draft-thumbnail"><image :src="pendingPhoto" mode="aspectFill" @tap="previewChatPhoto(pendingPhoto)" /><button class="draft-remove" @tap="pendingPhoto=''">×</button></view>
        <text v-if="pendingPhoto" class="draft-note">{{ t("已选择图片，点击发送后识别") }}</text>
        <text v-if="recognitionError" class="photo-error">{{ t(recognitionError) }}</text>
      </view>
      <!-- 输入栏 -->
    <view class="input-bar">
      <button class="photo-add" :disabled="recognizing" :aria-label="t('拍照或相册识景')" @tap="chooseScenicPhoto">＋</button>
      <view class="voice-btn" :class="{ active: voiceMode }" @tap="toggleVoiceMode">
        <text class="iconfont" :class="voiceMode ? 'icon-liaotian' : 'icon-yuyin'"></text>
      </view>
      <input v-if="!voiceMode" v-model="text" class="msg-input" :placeholder="t('描述你的游览需求...')" confirm-type="send" @focus="onInputFocus" @blur="onInputBlur" @keyboardheightchange="onInputKeyboardHeight" @confirm="sendText" :disabled="loading"/>
      <view v-else class="voice-hold-btn" :class="{ pressing: voicePressing }" @touchstart.stop.prevent="startRecord" @touchend.stop.prevent="stopRecord" @touchcancel.stop="cancelRecord" @contextmenu.prevent="">
        <text>{{ transcribing ? t('正在识别…') : voicePressing ? t('正在录音，松开发送') : t('按住说话') }}</text>
      </view>
      <view v-if="!voiceMode" class="send-btn" :class="{ disabled: (!text.trim() && !pendingPhoto) || loading || recognizing }" @tap="sendText">
        <text>{{ t("发送") }}</text>
      </view>
    </view>

    <TabBarNav current="ai" v-show="!keyboardVisible" />
    </view>
  </view>
</template>

<script>
import TabBarNav from '../../components/TabBarNav.vue'
import { BASE_URL, assetUrl, isBeijingCity } from '../../common/config.js'
import ChatVoice from '../../components/chat-voice.vue'



function request(options) {
  return new Promise(function (resolve, reject) {
    var url = options.url
    if (url.indexOf('http') !== 0) url = BASE_URL + url
    uni.request({
      url: url, method: options.method || 'GET',
      data: options.data || {}, header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + uni.getStorageSync('token') },
      timeout: options.timeout || 20000,
      success: function (res) { if (res.statusCode === 200) resolve({ data: res.data }); else reject(new Error(res.data && (res.data.detail || res.data.message) || '服务请求失败（HTTP ' + res.statusCode + '）')) },
      fail: function (err) { reject(err) },
    })
  })
}

export default {
  components:{TabBarNav,ChatVoice},
  data: function () {
    return {
      voicePayload:{},keyboardVisible:false,keyboardHeight:0,recognizing:false,pendingPhoto:'',recognitionError:'',
      text: '', msgs: [], loading: false, chatScrollTop:0, lastSpotIds: [], recommendSpots: [], recommendLoading: false, translatingHistory:false,
      voiceError:'',transcribing:false,voiceMode: false, recording: false, voicePressing: false, speaking: false, speakingIndex:-1,ttsLoading:false,
      recordingText: '正在聆听...', _voiceManager: null, _voiceTimer: null, _ws: null, statusH:20,
    }
  },
  mounted:function(){this.statusH=(uni.getSystemInfoSync().statusBarHeight||20)+6},
  onLoad:function(){
    this._keyboardListener=event=>this.updateKeyboardHeight(event.height)
    if(uni.onKeyboardHeightChange)uni.onKeyboardHeightChange(this._keyboardListener)
  },
  onUnload:function(){
    if(uni.offKeyboardHeightChange&&this._keyboardListener)uni.offKeyboardHeightChange(this._keyboardListener)
    this.cancelRecord()
    this.stopTTS()
  },
  computed: {
    totalDuration: function () {
      var s = this.recommendSpots
      if (!s || !s.length) return 0
      var total = 0
      for (var i = 0; i < s.length; i++) {
        total += (s[i].visit_duration || 20)
        if (i < s.length - 1) total += this.walkMin(this.walkKm(s[i], s[i + 1]))
      }
      return total
    },
  },
  methods: {
    updateKeyboardHeight:function(height){this.keyboardHeight=Math.max(0,Number(height)||0);this.keyboardVisible=this.keyboardHeight>0;this.scrollChat()},
    onInputFocus:function(){this.keyboardVisible=true},
    onInputBlur:function(){if(!this.keyboardHeight)this.keyboardVisible=false},
    onInputKeyboardHeight:function(event){this.updateKeyboardHeight(event.detail.height)},
    chooseScenicPhoto:function(){
      if(this.recognizing)return
      uni.hideKeyboard()
      this.recognitionError=''
      uni.showActionSheet({itemList:['拍照识景','从相册选择'],success:res=>this.openScenicSource(res.tapIndex===0?'camera':'album')})
    },
    openScenicSource:function(source){
      // #ifdef APP-PLUS
      if(plus.os.name==='Android'){
        try{
          const Version=plus.android.importClass('android.os.Build$VERSION')
          const activity=plus.android.runtimeMainActivity()
          const appInfo=activity.getApplicationInfo()
          plus.android.importClass(appInfo)
          const mediaPermission=Number(Version.SDK_INT)>=33&&Number(appInfo.targetSdkVersion)>=33?'android.permission.READ_MEDIA_IMAGES':'android.permission.READ_EXTERNAL_STORAGE'
          const permission=source==='camera'?'android.permission.CAMERA':mediaPermission
          plus.android.requestPermissions([permission],result=>{
            if(result.deniedAlways&&result.deniedAlways.length){this.recognitionError='权限已被关闭，请到手机设置 → 应用设置 → HBuilder（或智游知境）→ 权限管理，允许'+(source==='camera'?'相机':'照片与视频／存储')+'权限';return}
            if(result.deniedPresent&&result.deniedPresent.length){this.recognitionError='需要允许'+(source==='camera'?'相机':'相册读取')+'权限才能选择照片';return}
            this.pickScenicImage(source)
          },e=>{this.recognitionError='申请权限失败，请到手机应用权限设置中开启';console.error('Photo permission failed',e)})
        }catch(e){this.recognitionError='无法检查图片权限，请到手机应用权限设置中开启';console.error('Photo permission check failed',e)}
        return
      }
      // #endif
      this.pickScenicImage(source)
    },
    pickScenicImage:function(source){
      uni.chooseImage({count:1,sizeType:['compressed'],sourceType:[source],
        success:res=>{if(res.tempFilePaths&&res.tempFilePaths[0]){this.pendingPhoto=res.tempFilePaths[0];this.recognitionError='';this.voiceMode=false}},
        fail:e=>{console.error('Choose scenic photo failed',e);if(!/cancel/i.test(e.errMsg||''))this.recognitionError=(source==='camera'?'相机':'相册')+'打开失败：'+(e.errMsg||'请检查手机权限')}})
    },
    previewChatPhoto:function(path){uni.previewImage({urls:[path],current:path})},
    sendPhoto:function(){
      if(this.loading||this.recognizing||!this.pendingPhoto)return
      const path=this.pendingPhoto,caption=this.text.trim()
      this.pendingPhoto='';this.text='';this.recognitionError=''
      this.msgs.push({role:'user',image:path,content:caption,lang:this.tourLanguage||'zh'})
      this.recognizing=true;this.loading=true;this.scrollChat();this.saveHistory()
      const showFailure=message=>{this.msgs.push({role:'ai',content:message,lang:this.tourLanguage||'zh'});this.pendingPhoto=path}
      uni.uploadFile({url:BASE_URL+'/tour-session/recognize-spot',filePath:path,name:'file',timeout:90000,
        formData:{question:caption,language:this.tourLanguage||'zh'},header:{Authorization:'Bearer '+uni.getStorageSync('token')},
        success:r=>{try{const d=JSON.parse(r.data)
          if(r.statusCode===200&&d.success&&d.data){
            const result=d.data
            const reply=result.status==='candidate'
              ? [this.t('可能是：')+result.spot_name,result.city,this.t('识别依据：')+result.evidence,result.description,result.message].filter(Boolean).join('\n')
              : result.message
            var finalReply = (this.tourLanguage==='en') ? this.cleanEnglish(reply) : reply
            this.msgs.push({role:'ai',content:finalReply,recognition_id:result.recognition_id,lang:this.tourLanguage||'zh'})
          }else showFailure(typeof d.detail==='string'?d.detail:d.message||this.t('识景失败，请稍后重试'))
        }catch(e){showFailure(this.t('识景服务返回格式异常'))}},
        fail:()=>showFailure(this.t('照片上传失败，请检查网络连接')),
        complete:()=>{this.recognizing=false;this.loading=false;this.scrollChat();this.saveHistory()}})
    },
    scrollChat:function(){this.$nextTick(()=>{this.chatScrollTop+=100000})},
    saveHistory:function(){try{uni.setStorageSync('ai_chat_msgs',JSON.stringify(this.msgs))}catch(e){}},
    loadHistory:function(){try{var r=uni.getStorageSync('ai_chat_msgs');var list=r?JSON.parse(r):[];var cur=(uni.getStorageSync('zhiyou.app-language')==='en'?'en':'zh');var guess=function(text){var value=String(text||'');var cjk=(value.match(/[\u4e00-\u9fff]/g)||[]).length;var latin=(value.match(/[A-Za-z]/g)||[]).length;if(latin>=5&&latin>=cjk*2)return 'en';if(cjk>0)return 'zh';if(latin>0)return 'en';return cur};list.forEach(function(m){if(m&&typeof m==='object')m.lang=guess(m.content)});this.msgs=list}catch(e){this.msgs=[]}},
    cleanEnglish:function(text){return String(text||'').replace(/[\u4e00-\u9fff]+/g,' ').replace(/[ \t]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n').trim()},
    translateHistoryToLanguage:function(){
      var s=this,target=(uni.getStorageSync('zhiyou.app-language')==='en'?'en':'zh')
      if(s.translatingHistory)return
      var pending=[]
      s.msgs.forEach(function(m,i){
        if(!m||typeof m.content!=='string'||!m.content.trim())return
        if(!m.lang)m.lang=target
        var body=String(m.content||'')
        var mixedForEnglish=(target==='en'&&/[\u4e00-\u9fff]/.test(body))
        var englishForChinese=(target==='zh'&&!/[\u4e00-\u9fff]/.test(body)&&/[A-Za-z]/.test(body))
        if(m.lang===target&&!mixedForEnglish&&!englishForChinese)return
        if(m.translations&&typeof m.translations[target]==='string'&&m.translations[target].trim()){m.content=m.translations[target];m.lang=target;return}
        pending.push({index:i,text:m.content,from:m.lang})
      })
      if(!pending.length){s.saveHistory();return}
      s.translatingHistory=true
      request({url:'/tour-session/translate-texts',method:'POST',timeout:90000,data:{texts:pending.map(function(x){return x.text}),target:target}}).then(function(res){
        var list=res.data&&res.data.data&&res.data.data.translations
        if(!Array.isArray(list))return
        pending.forEach(function(p,k){
          var m=s.msgs[p.index];if(!m)return
          var translated=list[k]
          if(typeof translated==='string'&&translated.trim()){
            var nextText=translated.trim()
            var hasCJK=/[\u4e00-\u9fff]/.test(nextText)
            if(nextText!==String(m.content||'').trim()){
              if(!m.translations)m.translations={}
              m.translations[m.lang||p.from]=m.content
              m.content=nextText
              m.lang=target
            } else if((target==='zh'&&hasCJK)||(target==='en'&&!hasCJK)){
              m.lang=target
            }
          }
        })
        s.saveHistory()
      }).catch(function(){}).finally(function(){s.translatingHistory=false;s.scrollChat()})
    },
    clearHistory:function(){this.msgs=[];this.lastSpotIds=[];this.recommendSpots=[];uni.removeStorageSync('ai_chat_msgs');uni.showToast({title:this.t('已清除'),icon:'none'})},
    fixImg: function (u) { if (!u) return ''; return assetUrl(u) },
    walkKm: function (a, b) {
      if (!a || !b || !a.latitude || !a.longitude || !b.latitude || !b.longitude) return 0
      var R = 6371
      var dLat = (b.latitude - a.latitude) * Math.PI / 180
      var dLng = (b.longitude - a.longitude) * Math.PI / 180
      var la1 = a.latitude * Math.PI / 180
      var la2 = b.latitude * Math.PI / 180
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
      return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
    },
    walkMin: function (km) { return km <= 0 ? 0 : Math.max(1, Math.round(km * 12)) },
    walkText: function (a, b) {
      var km = this.walkKm(a, b)
      if (km <= 0) return '—'
      if (km < 1) return Math.round(km * 1000) + '米 / ' + this.walkMin(km) + '分钟'
      return km.toFixed(2) + '公里 / ' + this.walkMin(km) + '分钟'
    },
    fetchRecommendSpots: function (ids) {
      var self = this
      self.recommendSpots = []
      self.recommendLoading = true
      request({ url: '/tour-session/spots' }).then(function (res) {
        var d = res.data
        var list = (d && d.data && d.data.spot_list) ? d.data.spot_list : (d && d.spot_list ? d.spot_list : [])
        list = list.filter(function(sp){ return isBeijingCity(sp.city) })
        var map = {}
        list.forEach(function (sp) { map[sp.spot_id] = sp })
        self.recommendSpots = ids.map(function (id) { return map[id] }).filter(Boolean)
      }).catch(function () { self.recommendSpots = [] }).finally(function () { self.recommendLoading = false })
    },
    goTab:function(p){uni.reLaunch({url:p})},
    quickSend: function (msg) { this.text = msg; this.sendText() },
    sendText: function () {
      if(this.pendingPhoto){this.sendPhoto();return}
      var self = this
      var msg = (self.text || '').trim()
      if (!msg || self.loading) return
      self.msgs.push({ role: 'user', content: msg, lang: self.tourLanguage || 'zh' })
      self.text = ''; self.loading = true; self.scrollChat()
      request({
        url: '/tour-session/ai-chat-recommend?message=' + encodeURIComponent(msg) + '&language=' + (self.tourLanguage || 'zh'),
        method: 'POST', data: {},
      }).then(function (res) {
        var d = res.data
        if (d && d.success && d.data) {
          var dd = d.data
          self.msgs.push({ role: 'ai', content: dd.ai_response || self.t('已为您推荐景点'), lang: self.tourLanguage || 'zh' })
          if (dd.spot_ids && dd.spot_ids.length) {
            self.lastSpotIds = dd.spot_ids
            uni.setStorageSync('ai_spot_ids', JSON.stringify(dd.spot_ids))
            self.fetchRecommendSpots(dd.spot_ids)
          }
          self.playTTS(dd.ai_response,self.msgs.length-1)
        } else { self.msgs.push({ role: 'ai', content: d && d.message || self.t('没有找到匹配路线，请调整需求。'), lang: self.tourLanguage || 'zh' }) }
      }).catch(function (error) {
        self.msgs.push({ role: 'ai', content: error.message || self.t('无法连接推荐服务，请检查网络。'), lang: self.tourLanguage || 'zh' })
      })
      .finally(function () { self.loading = false; self.scrollChat(); self.saveHistory() })
    },
    applyRecommend: function () {
      uni.setStorageSync('ai_spot_ids', JSON.stringify(this.lastSpotIds))
      uni.showToast({ title: '已选中' + this.lastSpotIds.length + '个景点', icon: 'success' })
      setTimeout(function () { uni.reLaunch({ url: '/pages/tour-guide/tour-guide' }) }, 500)
    },
    toggleVoiceMode: function () { if(this.recording||this.transcribing)return;this.voiceMode = !this.voiceMode;if(this.voiceMode)uni.hideKeyboard() },
    stopTTS:function(){this._ttsRequestId=(this._ttsRequestId||0)+1;this.voicePayload={id:this._ttsRequestId};if(this._ttsAudio){this._ttsAudio.destroy();this._ttsAudio=null}this.speaking=false;this.ttsLoading=false;this.speakingIndex=-1},
    onDigitalVoiceState:function(event){if(event.id!==this._ttsRequestId)return;if(event.state==='playing'){this.speaking=true;this.ttsLoading=false}else{this.stopTTS();if(event.state==='error')uni.showToast({title:event.message||'数字人语音连接失败',icon:'none'})}},
    replayTTS: function (text,index) { if(this.speakingIndex===index){this.stopTTS();return}this.playTTS(text,index) },
    playTTS: function (text,index) {
      if (!text) return
      this.stopTTS()
      var self = this
      var requestId=this._ttsRequestId
      this.speakingIndex=index;this.ttsLoading=true
      var clean = text.replace(/\*\*/g,'').replace(/[\[\]]/g,'').replace(/[（）\(\)]/g,'，').replace(/\n+/g,'，').substring(0,2000)
      // #ifdef APP-PLUS || H5
      request({url:'/xingyun/chat-voice'}).then(function(res){
        if(requestId!==self._ttsRequestId)return
        self.voicePayload={id:requestId,text:clean,sdkUrl:res.data.sdk_url,gateway:BASE_URL+'/xingyun/session/'+res.data.guide_id+'?chat_speech=true&language='+(self.tourLanguage||'zh'),token:uni.getStorageSync('token')}
      }).catch(function(error){if(requestId!==self._ttsRequestId)return;self.stopTTS();uni.showToast({title:error.message||'默认数字人未连接',icon:'none'})})
      return
      // #endif
      request({ url: '/tts/edge?text=' + encodeURIComponent(clean) }).then(function (res) {
        if(requestId!==self._ttsRequestId)return
        if (res.data && res.data.success && res.data.data) {
          var url = res.data.data
          if (url.indexOf('http') !== 0) url = BASE_URL + url
          else url = assetUrl(url)
          var audio = uni.createInnerAudioContext()
          self._ttsAudio=audio
          audio.onPlay(function(){self.ttsLoading=false;self.speaking=true})
          audio.onEnded(function(){self.stopTTS()})
          audio.onError(function(){self.stopTTS();uni.showToast({title:'语音播放失败，请检查网络后重试',icon:'none'})})
          audio.src = url; audio.play()
        }else throw new Error('语音服务未返回音频')
      }).catch(function (error) {if(requestId!==self._ttsRequestId)return;self.stopTTS();uni.showToast({title:error.message||'语音播报失败，请稍后重试',icon:'none'})})
    },

    // Record once per press; register callbacks only once per page instance.
    initRecorder:function(){
      if(this._voiceManager)return this._voiceManager
      var self=this,rm=uni.getRecorderManager()
      self._voiceManager=rm
      rm.onStart(function(){self._recordStartedAt=Date.now();if(!self.voicePressing)rm.stop()})
      rm.onStop(function(res){
        self.voicePressing=false;self.recording=false
        if(self._recordCancelled)return
        var duration=Number(res.duration)||((self._recordStartedAt||self._recordRequestedAt)?Date.now()-(self._recordStartedAt||self._recordRequestedAt):0)
        if(!res.tempFilePath||duration<500){uni.showToast({title:'请按住说话至少半秒',icon:'none'});return}
        self.transcribing=true
        uni.uploadFile({url:BASE_URL+'/tour-session/asr-upload',filePath:res.tempFilePath,name:'file',timeout:120000,
          header:{Authorization:'Bearer '+uni.getStorageSync('token')},
          success:function(r){
            try{var d=JSON.parse(r.data)
              if(r.statusCode===200&&d.success&&d.data){self.text=d.data;self.sendText();return}
              self.voiceError=d.message||d.detail||'语音识别服务返回错误'
            }catch(e){self.voiceError='语音识别返回格式异常'}
          },
          fail:function(){self.voiceError='语音上传失败，请检查网络连接'},
          complete:function(){self.transcribing=false}
        })
      })
      rm.onError(function(e){self.voicePressing=false;self.recording=false;self.voiceError='录音失败，请检查手机麦克风权限';uni.showToast({title:self.voiceError,icon:'none'});console.error('Recorder failed',e)})
      return rm
    },
    startRecord:function(){
      if(this.transcribing){uni.showToast({title:'正在识别上一段语音，请稍候',icon:'none'});return}
      if(this.loading){uni.showToast({title:'正在回答，请稍候再录音',icon:'none'});return}
      if(this.recording)return
      this.stopTTS()
      this.voiceError='';this._recordCancelled=false;this._recordStartedAt=0
      this._recordRequestedAt=Date.now()
      this.voicePressing=true;this.recording=true;this.recordingText='正在聆听...'
      try{this.initRecorder().start({duration:60000,sampleRate:16000,numberOfChannels:1,encodeBitRate:48000,format:'mp3'})}
      catch(e){this.voicePressing=false;this.recording=false;this.voiceError='无法启动录音，请检查麦克风权限'}
    },
    stopRecord:function(){this.voicePressing=false;if(this._voiceManager&&(this._recordStartedAt||this._recordRequestedAt))this._voiceManager.stop()},
    cancelRecord:function(){this._recordCancelled=true;this.voicePressing=false;this.recording=false;if(this._voiceManager&&(this._recordStartedAt||this._recordRequestedAt))this._voiceManager.stop()},
  },
  onHide:function(){this.cancelRecord();this.stopTTS();this.keyboardVisible=false;this.keyboardHeight=0},
  onShow:function(){this.loadHistory();this.translateHistoryToLanguage();this.scrollChat()},
}
</script>

<style scoped>
.photo-draft{display:flex;align-items:center;gap:20rpx;padding:16rpx 24rpx;flex-wrap:wrap;border-top:1rpx solid var(--ng-border)}
.draft-thumbnail{position:relative;width:112rpx;height:112rpx}.draft-thumbnail image{width:100%;height:100%;border-radius:12rpx}
.draft-remove{position:absolute;top:-10rpx;right:-10rpx;display:flex;align-items:center;justify-content:center;width:36rpx;height:36rpx;margin:0;padding:0;border-radius:50%;background:#625a75;color:#fff;font-size:28rpx;line-height:1}.draft-remove::after{border:0}
.draft-note{font-size:23rpx;color:#817994}.chat-photo{display:block;width:320rpx;max-width:100%;border-radius:14rpx;margin-bottom:10rpx}

.photo-entry{position:relative;padding:12rpx 24rpx;z-index:1}
.photo-add{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:64rpx;height:64rpx;margin:0;padding:0;line-height:1;font-family:Arial,sans-serif;font-size:44rpx;font-weight:400;color:#6840c2;background:#f1eaff;border-radius:50%}.photo-add::after{border:0}.photo-add[disabled]{opacity:.45}
.bottom-fixed.keyboard-open{padding-bottom:0}.keyboard-open .input-bar{padding-bottom:10rpx}
.input-bar .msg-input{min-width:0}.input-bar .voice-btn{flex-shrink:0}
.photo-caption,.photo-error{display:block;font-size:23rpx;line-height:1.7;margin-top:10rpx;color:#817994}.photo-error{color:#9f3450}
.recognition-photo{display:block;width:100%;height:240rpx;margin-top:16rpx;border-radius:18rpx}
.recognition-result{margin-top:12rpx;padding:20rpx;background:#fff;border-radius:18rpx}.recognition-result text{display:block;margin-bottom:10rpx;font-size:26rpx;line-height:1.7}.recognition-result .recognition-title{font-size:30rpx;font-weight:600;color:#6840c2}
.voice-status{position:relative;padding:16rpx 24rpx;color:#9f3450;font-size:26rpx;line-height:1.7;background:#fff1f2}
.page.aurora-page { height:100vh; min-height:0; box-sizing:border-box; display:flex; flex-direction:column; background-color:var(--ng-surface); position:relative; overflow:hidden; padding-bottom:0!important; }
.ink-bg { position:absolute; inset:0; pointer-events:none; z-index:0; }
.page-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.ink-mountain { position:absolute; left:0; right:0; background:var(--ng-night); border-radius:50% 70% 0 0; opacity:0.03; }
.ink-mt-1 { bottom:30%; height:180rpx; transform:scaleX(1.3); }
.ink-mt-2 { bottom:35%; height:130rpx; opacity:0.02; transform:scaleX(1.5) translateX(-10%); }
.ink-circle { position:absolute; top:20%; right:-100rpx; width:360rpx; height:360rpx; border-radius:50%; border:1rpx solid rgba(99,102,241,0.25); }

.nav{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;padding:16rpx 24rpx}
.nav-title { font-size:44rpx; font-weight:900; color:var(--ng-text); letter-spacing:8rpx; font-family:var(--app-font-family); }
.nav-clear{position:absolute;right:28rpx;font-size:24rpx;color:var(--ng-secondary);padding:6rpx 14rpx;border-radius:8rpx;background:rgba(99,102,241,0.06)}

.quick-hints { position:relative; z-index:1; display:flex; flex-wrap:wrap; gap:10rpx; padding:8rpx 24rpx 16rpx; }
.qh-chip { padding:12rpx 20rpx; border-radius:22rpx; background:rgba(99,102,241,0.12); border:1rpx solid rgba(99,102,241,0.25); font-size:22rpx; color:var(--ng-secondary); }
.qh-chip:active { background:rgba(99,102,241,0.18); }

.chat-area { position:relative; z-index:1; flex:1; height:0; min-height:0; box-sizing:border-box; padding:16rpx 24rpx; }
.chat-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:300rpx; }
.ce-icon { font-size:72rpx; margin-bottom:18rpx; display:inline-block; animation:bounceBall 2.4s ease-in-out infinite; }
@keyframes bounceBall { 0%,100%{transform:translateY(0)} 4%{transform:translateY(-36rpx)} 8%{transform:translateY(0)} 12%{transform:translateY(-24rpx)} 16%{transform:translateY(0)} 20%{transform:translateY(-14rpx)} 24%{transform:translateY(0)} 28%{transform:translateY(-6rpx)} 32%{transform:translateY(0)} }
.ce-title { font-size:32rpx; font-weight:800; color:var(--ng-text); margin-bottom:10rpx; }
.ce-sub { font-size:24rpx; color:var(--ng-secondary); }

.msg-row { margin-bottom:22rpx; display:flex; }
.msg-l { justify-content:flex-start; }
.msg-r { justify-content:flex-end; }
.msg-bubble { max-width:82%; padding:18rpx 24rpx; border-radius:18rpx; }
.msg-bubble.user { background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.18)); border-bottom-right-radius:6rpx; }
.msg-bubble.ai { background:var(--ng-surface); border:1rpx solid var(--ng-border); border-bottom-left-radius:6rpx; }
.msg-bubble.user .msg-text { color:var(--ng-text); }
.msg-bubble.ai .msg-text { color:var(--ng-text); }
.msg-text { font-size:28rpx; line-height:1.8; word-break:break-word; white-space:pre-wrap; }
.typing .msg-text { color:var(--ng-secondary); font-size:24rpx; }
.msg-speaker{margin-top:16rpx;padding:10rpx 16rpx;text-align:right;font-size:24rpx;color:var(--ng-accent-text,#6840c2);border-top:1rpx solid var(--ng-border)}
.msg-speaker.on{animation:spkPulse .6s ease-in-out infinite}
@keyframes spkPulse{0%,100%{opacity:1}50%{opacity:.4}}

.result-bar { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; padding:14rpx 20rpx; margin:0 20rpx 8rpx; background:rgba(99,102,241,0.15); border:1rpx solid rgba(99,102,241,0.25); border-radius:14rpx; font-size:24rpx; color:var(--ng-text); font-weight:600; }
.rb-btn { padding:8rpx 20rpx; border-radius:20rpx; background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.18)); color:var(--ng-text); font-size:22rpx; font-weight:700; }

.recording-hint { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; padding:16rpx 0 8rpx; gap:10rpx; }
.rh-wave { display:flex; gap:5rpx; align-items:flex-end; height:50rpx; }
.rh-bar { width:5rpx; min-height:10rpx; border-radius:3rpx; background:rgba(99,102,241,0.18); animation:waveAnim 0.6s ease-in-out infinite; }
@keyframes waveAnim { 0%,100% { transform:scaleY(1); } 50% { transform:scaleY(3); } }
.rh-text { font-size:26rpx; color:var(--ng-secondary); font-weight:700; }

.bottom-fixed{position:relative;flex-shrink:0;z-index:998;display:flex;flex-direction:column;background:var(--ng-surface);backdrop-filter: none}.input-bar{display:flex;gap:10rpx;align-items:center;padding:10rpx 16rpx;background:var(--ng-surface);border-top:1rpx solid var(--ng-border);margin:0}
.voice-btn { width:68rpx; height:68rpx; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(99,102,241,0.15); font-size:28rpx; }
.voice-btn.active { background:rgba(99,102,241,0.18); color:var(--ng-text); }
.msg-input { flex:1; height:68rpx; padding:0 18rpx; border:1rpx solid var(--ng-border); border-radius:34rpx; background:var(--ng-surface); font-size:26rpx; color:var(--ng-text); }
.voice-hold-btn { user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; touch-action:none; flex:1; height:68rpx; display:flex; align-items:center; justify-content:center; border:1rpx dashed rgba(99,102,241,0.25); border-radius:34rpx; background:rgba(99,102,241,0.08); font-size:26rpx; color:var(--ng-secondary); font-weight:600; }
.voice-hold-btn.pressing { background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.18)); color:var(--ng-text); border-style:solid; }
.send-btn { height:68rpx; padding:0 26rpx; line-height:68rpx; border-radius:34rpx; background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.18)); color:var(--ng-text); font-size:26rpx; font-weight:700; }
.send-btn.disabled { opacity:0.35; }

.tb-root{background:transparent}
.tb-ink-line{height:1rpx;background:linear-gradient(90deg,transparent,rgba(99,102,241,0.12),transparent);margin:0 32rpx}
.tb-inner{display:flex;align-items:center;justify-content:space-around;padding:4rpx 8rpx}
.tb-item{display:flex;flex-direction:column;align-items:center;gap:4rpx;padding:2rpx 10rpx;position:relative;flex:1}
.tb-icon{font-size:38rpx}.tb-label{font-size:20rpx;font-weight:600;color:var(--ng-secondary)}
.tb-dot{position:absolute;bottom:-4rpx;width:24rpx;height:4rpx;border-radius:2rpx;background:rgba(99,102,241,0.18);opacity:.6}
.tb-item.on .tb-label{color:var(--ng-secondary);font-weight:600}.tb-item.on .tb-icon{transform:scale(1.1)}
.tb-hl-ring{width:68rpx;height:68rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.18);border:2rpx solid rgba(99,102,241,0.25);margin-bottom:-2rpx}
.tb-hl-ring.on{background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.18));border-color:transparent;box-shadow:0 6rpx 18rpx rgba(99,102,241,0.15);animation:tabBounce .4s ease-out}
.tb-hl-ring .tb-icon{font-size:34rpx}.tb-safe{height:env(safe-area-inset-bottom,10rpx);min-height:2rpx}
@keyframes tabBounce{0%{transform:scale(1)}30%{transform:scale(1.15)}60%{transform:scale(.95)}100%{transform:scale(1)}}

/* 路线预览时间轴 */
.route-preview { position:relative; z-index:1; flex-shrink:0; max-height:24vh; overflow-y:auto; box-sizing:border-box; margin:0 20rpx 8rpx; padding:18rpx 20rpx; background:var(--ng-surface); border:1rpx solid var(--ng-border); border-radius:16rpx; }
.rp-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14rpx; }
.rp-title { font-size:28rpx; font-weight:800; color:var(--ng-text); letter-spacing:2rpx; }
.rp-count { font-size:22rpx; color:var(--ng-secondary); }
.rp-loading { padding:24rpx 0; text-align:center; font-size:24rpx; color:var(--ng-secondary); }
.rp-timeline { display:flex; flex-direction:column; }
.rp-item { display:flex; gap:14rpx; }
.rp-rail { display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
.rp-dot { width:44rpx; height:44rpx; border-radius:50%; background:rgba(99,102,241,0.18); border:2rpx solid rgba(99,102,241,0.25); color:var(--ng-text); font-size:22rpx; font-weight:700; display:flex; align-items:center; justify-content:center; }
.rp-dot.start { background:linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.18)); }
.rp-dot.end { background:rgba(99,102,241,0.25); }
.rp-line { flex:1; width:2rpx; min-height:44rpx; background:linear-gradient(to bottom, rgba(99,102,241,0.25), rgba(99,102,241,0.12)); margin:6rpx 0; }
.rp-card { flex:1; display:flex; gap:14rpx; align-items:center; padding:6rpx 0 20rpx; }
.rp-img { width:88rpx; height:88rpx; border-radius:14rpx; flex-shrink:0; background:var(--ng-night); }
.rp-img-df { display:flex; align-items:center; justify-content:center; font-size:40rpx; opacity:.5; }
.rp-info { flex:1; display:flex; flex-direction:column; gap:6rpx; }
.rp-name { font-size:28rpx; font-weight:700; color:var(--ng-text); }
.rp-cat { font-size:22rpx; color:var(--ng-secondary); }
.rp-walk { font-size:20rpx; color:var(--ng-secondary); opacity:.85; }
.rp-total { display:flex; align-items:center; justify-content:space-between; margin-top:10rpx; padding-top:14rpx; border-top:1rpx dashed var(--ng-border); }
.rp-total-label { font-size:24rpx; color:var(--ng-secondary); font-weight:600; }
.rp-total-value { font-size:30rpx; font-weight:800; color:var(--ng-text); }
</style>
