<template>
  <view class="page aurora-page no-tabbar" :class="{'app-english':tourLanguage==='en'}">
    <!-- #ifdef APP-PLUS -->
    <view class="app-status-bar-shield" aria-hidden="true"></view>
    <!-- #endif -->
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
      <view class="nav-back" @tap="goBack" :aria-label="$t('返回')"><text>‹</text></view>
      <text class="nav-clear" v-if="msgs.length" @tap="clearHistory">{{ $t("清空") }}</text>
      <view class="nav-history" @tap="openHistory" :aria-label="$t('问答历史')">
        <view class="hist-clock"><view class="hc-hour"></view><view class="hc-minute"></view></view>
      </view>
    </view>

    <!-- 快捷提示 -->
    <view class="quick-hints" v-if="msgs.length === 0 && chatMode==='route'">
      <view class="qh-chip" @tap="quickSend('我想带孩子玩2小时，喜欢自然风光')">{{ $t("亲子2小时自然游") }}</view>
      <view class="qh-chip" @tap="quickSend('推荐颐和园的历史文化景点，半天时间')">{{ $t("颐和园历史文化半天") }}</view>
      <view class="qh-chip" @tap="quickSend('帮我规划一个适合拍照的一日游路线')">{{ $t("拍照打卡一日游") }}</view>
      <view class="qh-chip" @tap="quickSend('周末带朋友玩半天，喜欢美食和拍照')">{{ $t("周末美食拍照") }}</view>
    </view>
    <view class="quick-hints" v-if="msgs.length===0 && chatMode==='guide'">
      <view class="qh-spot" @tap="pickSpot">
        <text class="qh-spot-label">{{ $t('选择景点') }}：{{ guideSpotName ? $t(guideSpotName) : $t('未选择') }}</text>
        <text class="qh-spot-action">›</text>
      </view>
      <view class="qh-chip" @tap="askGuide('intro')">{{ guideSpotName ? $t('介绍「{spot}」',{spot:$t(guideSpotName)}) : $t('介绍这个景点') }}</view>
      <view class="qh-chip" @tap="askGuide('story')">{{ guideSpotName ? $t('「{spot}」有什么历史故事？',{spot:$t(guideSpotName)}) : $t('这里有什么历史故事？') }}</view>
      <view class="qh-chip" @tap="askGuide('photo')">{{ guideSpotName ? $t('「{spot}」有什么拍照建议？',{spot:$t(guideSpotName)}) : $t('这里有什么拍照建议？') }}</view>
    </view>

    <!-- 对话区 -->
    <scroll-view scroll-y class="chat-area" :scroll-top="chatScrollTop" :scroll-with-animation="scrollAnim" @scroll="onChatScroll">
      <view v-if="msgs.length === 0 && !loading" class="chat-empty">

        <text class="ce-title">{{ $t(chatMode==='guide'?'想了解哪个景点？':'想去哪里？') }}</text>

      </view>
      <view v-for="(m, i) in msgs" :key="i" :id="'m-'+i" class="msg-row" :class="m.role==='ai'?'msg-l':'msg-r'">
        <view class="msg-bubble" :class="m.role">
          <image v-if="m.image" :src="m.image" class="chat-photo" mode="widthFix" @load="scrollChat" @tap="previewChatPhoto(m.image)" />
          <block v-if="m.segments">
            <text v-for="(seg, si) in m.segments" :key="si" class="msg-text msg-seg">{{ seg.t }}</text>
            <text v-if="m.cursor" class="msg-caret">▍</text>
          </block>
          <text v-else-if="m.content" class="msg-text">{{ m.content }}</text>
          <button v-if="m.recognitionEvidence" class="photo-evidence-toggle" @tap="toggleEvidence(m)">{{ $t(m.showEvidence?'收起识别依据':'查看识别依据（原文）') }}</button>
          <text v-if="m.showEvidence&&m.recognitionEvidence" class="photo-evidence">{{ m.recognitionEvidence }}</text>
          <view v-if="m.role==='ai' && m.content && !m.cursor" class="msg-speaker" :class="{on:speaking && speakingIndex===i}" @tap="replayTTS(m.content,i)">
            <text>{{ $t(speakingIndex===i ? (ttsLoading ? $t("正在生成语音…") : $t("停止播报")) : $t("语音播报")) }}</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="msg-row msg-l">
        <view class="msg-bubble ai typing">
          <view class="typing-dots" :aria-label="$t('AI思考中...')"><view class="td"></view><view class="td"></view><view class="td"></view></view>
        </view>
      </view>
      <view id="bottom"></view>
    </scroll-view>

    <!-- 路线预览时间轴 -->
    <view class="route-preview" v-if="chatMode==='route' && lastSpotIds.length > 0 && !loading">
      <view class="rp-head">
        <text class="rp-title"> {{ $t("路线预览") }}</text>
        <text class="rp-count">{{ $t('{count}个景点',{count:recommendSpots.length || lastSpotIds.length}) }}</text>
      </view>
      <view v-if="recommendLoading" class="rp-loading"><text>{{ $t("路线加载中...") }}</text></view>
      <view v-else-if="recommendSpots.length" class="rp-timeline">
        <view v-for="(s, i) in recommendSpots" :key="s.spot_id" class="rp-item">
          <view class="rp-rail">
            <view class="rp-dot" :class="{ start: i === 0, end: i === recommendSpots.length - 1 }">{{ $t(i + 1) }}</view>
            <view class="rp-line" v-if="i < recommendSpots.length - 1"></view>
          </view>
          <view class="rp-card">
            <image v-if="s.image_path" :src="fixImg(s.image_path)" class="rp-img" mode="aspectFill"></image>
            <view v-else class="rp-img rp-img-df"></view>
            <view class="rp-info">
              <text class="rp-name">{{ $t(s.spot_name) }}</text>
              <text class="rp-cat">{{ $t(s.category || $t("景点")) }} {{ $t("· 预计") }} {{ $t(s.visit_duration || 20) }}{{ $t("分钟") }}</text>
              <text v-if="i < recommendSpots.length - 1" class="rp-walk">{{ $t('步行至下一站：') }}{{ walkText(s, recommendSpots[i + 1]) }}</text>
            </view>
          </view>
        </view>
        <view class="rp-total">
          <text class="rp-total-label">{{ $t("预计总时长") }}</text>
          <text class="rp-total-value">{{ totalDuration==null ? $t('时长待配置') : $t('{minutes}分钟',{minutes:totalDuration}) }}</text>
        </view>
      </view>
    </view>

    <!-- 推荐结果 -->
    <view class="result-bar" v-if="chatMode==='route' && lastSpotIds.length > 0 && !loading">
      <text>{{ $t('已推荐{count}个景点',{count:lastSpotIds.length}) }}</text>
      <view class="rb-btn" @tap="applyRecommend">{{ $t("使用路线") }}</view>
    </view>

    <view v-if="voiceError && !transcribing" class="voice-status">{{ $t(voiceError) }}</view>
    <!-- 语音录音提示 -->
    <view class="recording-hint" v-if="recording">
      <view class="rh-wave">
        <view v-for="i in 5" :key="i" class="rh-bar" :style="{animationDelay:(i*0.12)+'s'}"></view>
      </view>
      <text class="rh-text">{{ $t(recordingText) }}</text>
    </view>

    <view v-if="showPhotoChoices" class="photo-popover-mask" :class="{closing:photoClosing}" @tap="closePhotoChoices"></view>
    <!-- 底部固定区：输入框 + Tab，flex竖向排列 -->
    <view class="bottom-fixed" :class="{'keyboard-open':keyboardVisible, 'photo-open':showPhotoChoices}">
      <view v-if="pendingPhoto || recognitionError" class="photo-draft">
        <view v-if="pendingPhoto" class="draft-thumbnail"><image :src="pendingPhoto" mode="aspectFill" @tap="previewChatPhoto(pendingPhoto)" /><button class="draft-remove" @tap="pendingPhoto=''">×</button></view>
        <text v-if="pendingPhoto" class="draft-note">{{ $t("已选择图片，点击发送后识别") }}</text>
        <text v-if="recognitionError" class="photo-error">{{ $t(recognitionError) }}</text>
      </view>
      <!-- 输入栏 -->
    <view class="input-bar">
      <view class="photo-entry-wrap">
        <button class="photo-add" :disabled="recognizing" :aria-label="$t(&quot;拍照或相册识景&quot;)" :aria-expanded="showPhotoChoices" @tap="chooseScenicPhoto">＋</button>
        <view v-if="showPhotoChoices" class="photo-popover" :class="{closing:photoClosing}" role="menu">
          <button class="photo-choice" @tap.stop="selectScenicSource(0)">{{ $t('拍照识景') }}</button>
          <button class="photo-choice" @tap.stop="selectScenicSource(1)">{{ $t('从相册选择') }}</button>
        </view>
      </view>
      <view class="voice-btn" :class="{ active: voiceMode }" @tap="toggleVoiceMode">
        <text class="iconfont" :class="voiceMode ? 'icon-liaotian' : 'icon-yuyin'"></text>
      </view>
      <input v-if="!voiceMode" v-model="text" class="msg-input" :placeholder="$t(chatMode==='guide'?'用中文或英文提问...':'描述你的游览需求...')" :maxlength="2000" confirm-type="send" @focus="onInputFocus" @blur="onInputBlur" @keyboardheightchange="onInputKeyboardHeight" @confirm="sendText" :disabled="loading"/>
      <view v-else class="voice-hold-btn" :class="{ pressing: voicePressing }" @touchstart.stop.prevent="startRecord" @touchend.stop.prevent="stopRecord" @touchcancel.stop="cancelRecord" @contextmenu.prevent="">
        <text>{{ $t(transcribing ? $t("正在识别…") : voicePressing ? $t("正在录音，松开发送") : $t("按住说话")) }}</text>
      </view>
      <view v-if="!voiceMode" class="send-btn" :class="{ disabled: (!text.trim() && !pendingPhoto) || loading || recognizing }" @tap="sendText">
        <text>{{ $t("发送") }}</text>
      </view>
    </view>

    </view>
    <TabBarNav v-show="!keyboardVisible" current="ai" :leaving="tabLeaving" :hide-on-enter="true" />
    <NocturneSelect v-if="showQASpots" ref="spotPicker" :title="$t('选择问答景点')" :options="qaOptions" :selected-index="qaSpots.findIndex(spot=>spot.spot_id===qaSpotId)" :anchor="spotAnchor" @change="selectQuestionSpot" @close="closeSpotPicker" />

    <!-- 问答历史记录 -->
    <view v-if="showHistory" class="history-mask" @tap="closeHistory">
      <view class="history-panel" @tap.stop>
        <view class="hp-head">
          <text class="hp-title">{{ $t('问答历史') }}</text>
          <view class="hp-actions">
            <text class="hp-clear" @tap.stop="clearHistoryFromPanel">{{ $t('清除历史记录') }}</text>
            <view class="hp-close" @tap="closeHistory" :aria-label="$t('关闭')"><text>×</text></view>
          </view>
        </view>
        <view class="hp-body">
          <view v-if="!historyPairs.length" class="hp-empty">{{ $t('还没有问答记录') }}</view>
          <view v-for="(pair, i) in historyPairs" :key="i" class="hp-item">
            <view class="hp-q"><text class="hp-tag">Q</text><text class="hp-qtext">{{ pair.q }}</text></view>
            <view v-if="pair.a" class="hp-a"><text class="hp-tag a">A</text><text class="hp-atext">{{ pair.a }}</text></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import TabBarNav from '../../components/TabBarNav.vue'
import { BASE_URL, assetUrl, isBeijingCity } from '../../common/config.js'
import ChatVoice from '../../components/chat-voice.vue'
import NocturneSelect from '../../components/NocturneSelect.vue'
import { planningMessage, recommendationText, questionLanguage, findQuestionSpot, photoIdentificationText } from '../../common/planning-language.js'
import { translateTour, LANGUAGE_STORAGE_KEY } from '../../common/tour-language.js'



function uiToast(options){uni.showToast({...options,title:translateTour(options.title,uni.getStorageSync(LANGUAGE_STORAGE_KEY)==='en'?'en':'zh')})}

function request(options) {
  return new Promise(function (resolve, reject) {
    var url = options.url
    if (url.indexOf('http') !== 0) url = BASE_URL + url
    const token=uni.getStorageSync('token')
    const header={'Content-Type':'application/json'}
    if(token)header.Authorization='Bearer '+token
    uni.request({
      url: url, method: options.method || 'GET',
      data: options.data || {}, header,
      timeout: options.timeout || 20000,
      success: function (res) {
        if(res.statusCode===401){if(uni.getStorageSync('token')===token){uni.removeStorageSync('token');uni.reLaunch({url:'/pages/auth/auth'})}reject(new Error('登录已过期，请重新输入账号密码'));return}
        if(res.statusCode===200)resolve({data:res.data})
        else reject(new Error(res.data&&(res.data.detail||res.data.message)||'服务请求失败（HTTP '+res.statusCode+'）'))
      },
      fail: function (err) { reject(err) },
    })
  })
}

export default {
  components:{ChatVoice,NocturneSelect,TabBarNav},
  data: function () {
    return {
      chatMode:'guide',qaSpots:[],qaGuides:[],qaSpotId:null,spotAnchor:null,qaSession:null,qaCatalogLoading:false,showQASpots:false,requestEpoch:0,historyOwner:null,applyingRoute:false,
      voicePayload:{},keyboardVisible:false,keyboardHeight:0,recognizing:false,pendingPhoto:'',recognitionError:'',showPhotoChoices:false,photoClosing:false,scrollAnim:false,
      showHistory:false, text: '', msgs: [], historyMsgs: [], loading: false, chatScrollTop:0, followBottom:true, chatViewH:0, tabLeaving:false, lastSpotIds: [], recommendSpots: [], recommendLoading: false,recommendedPlan:null,
      voiceError:'',transcribing:false,voiceMode: false, recording: false, voicePressing: false, speaking: false, speakingIndex:-1,ttsLoading:false,
      recordingText: '正在聆听...', _voiceManager: null, _voiceTimer: null, _ws: null, statusH:20,
    }
  },
  mounted:function(){this.statusH=(uni.getSystemInfoSync().statusBarHeight||20)+6;this.$nextTick(()=>{uni.createSelectorQuery().in(this).select('.chat-area').boundingClientRect(rect=>{if(rect&&rect.height)this.chatViewH=rect.height}).exec()});setTimeout(()=>{this.tabLeaving=true},160)},
  watch:{
    pendingPhoto:function(){this.scrollChat()},
    recognitionError:function(){this.scrollChat()},
    loading:function(){this.scrollChat()},
  },
  onLoad:function(){
    this._keyboardListener=event=>this.updateKeyboardHeight(event.height)
    if(uni.onKeyboardHeightChange)uni.onKeyboardHeightChange(this._keyboardListener)
  },
  onUnload:function(){
    this.requestEpoch++
    if(uni.offKeyboardHeightChange&&this._keyboardListener)uni.offKeyboardHeightChange(this._keyboardListener)
    this.cancelRecord()
    this.stopTTS()
    this.stopReveal()
  },
  computed: {
    historyPairs:function(){
      var self=this,out=[],cur=null
      this.historyMsgs.forEach(function(m){
        var text=m.content||''
        if(m.image&&!text)text=self.$t('照片')
        if(!text)return
        if(m.role==='user'){cur={q:text,a:''};out.push(cur)}
        else if(m.role==='ai'){if(cur&&!cur.a){cur.a=text}else{out.push({q:'',a:text})}}
      })
      return out.slice().reverse()
    },
    qaOptions:function(){return this.qaSpots.map(spot=>[this.$t(spot.city),this.$t(spot.spot_name)].filter(Boolean).join(' · '))},
    guideSpotName:function(){const spot=this.qaSpots.find(item=>item.spot_id===this.qaSpotId);return spot?spot.spot_name:''},
    totalDuration: function () {
      if(!this.recommendedPlan)return null
      const minutes=this.recommendedPlan.estimated_time_minutes ?? this.recommendedPlan.total_duration
      return minutes!=null&&Number.isFinite(Number(minutes))&&Number(minutes)>=0?Number(minutes):null
    },
  },
  methods: {
    goBack:function(){
      const stack=(typeof getCurrentPages==='function')?getCurrentPages():[]
      if(stack&&stack.length>1){uni.navigateBack({delta:1});return}
      uni.reLaunch({url:'/pages/tour-guide/tour-guide'})
    },
    openHistory:function(){this.showHistory=true},
    closeHistory:function(){this.showHistory=false},
    clearHistoryFromPanel:function(){this.clearHistory();this.showHistory=false},
    pushMsg:function(msg){this.msgs.push(msg);this.historyMsgs.push(msg);this.saveHistory()},
    splitReveal:function(text){
      const out=[];let buf=''
      const flush=()=>{if(buf){out.push(buf);buf=''}}
      const chars=Array.from(String(text||''))
      const cjk=/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/
      let cjkCount=0
      for(let i=0;i<chars.length;i++){
        const c=chars[i]
        if(c==='\n'){buf+=c;flush();cjkCount=0;continue}
        if(cjk.test(c)){buf+=c;cjkCount++;if(cjkCount>=3){flush();cjkCount=0}continue}
        cjkCount=0
        if(c===' '){buf+=c;flush();continue}
        buf+=c
        if(/[.,!?;:，。！？；：、）)]/.test(c))flush()
      }
      flush()
      return out
    },
    stopReveal:function(){this._revealEpoch=(this._revealEpoch||0)+1;clearTimeout(this._revealTimer);this._revealTimer=null},
    pushAIReply:function(content,extra){
      if(!content)return null
      const index=this.msgs.length
      const reply={role:'ai',content:content,segments:[],cursor:true}
      if(extra)Object.assign(reply,extra)
      this.msgs.push(reply)
      this.historyMsgs.push({role:'ai',content:content,image:extra&&extra.image||undefined})
      this.saveHistory()
      this.startReveal(reply,index,!(extra&&extra.silent))
      return reply
    },
    startReveal:function(msg,index,speak){
      this.stopReveal()
      const chunks=this.splitReveal(msg.content)
      const epoch=this._revealEpoch
      let i=0
      const step=()=>{
        if(epoch!==this._revealEpoch)return
        if(i>=chunks.length){
          msg.cursor=false;this._revealTimer=null
          if(speak&&msg.content)this.playTTS(msg.content,index)
          this.jumpBottom()
          return
        }
        msg.segments.push({t:chunks[i]})
        i++
        this._revealTimer=setTimeout(step,55)
        this.jumpBottomThrottled()
      }
      step()
    },
    jumpBottomThrottled:function(){
      if(!this.followBottom)return
      const now=Date.now()
      if(now-(this._softScrollAt||0)<140)return
      this._softScrollAt=now
      this.scrollAnim=false
      this.chatScrollTop+=100000
    },
    jumpBottom:function(){
      this.followBottom=true
      this.scrollAnim=true
      this.chatScrollTop+=100000
      clearTimeout(this._jumpTimer)
      this._jumpTimer=setTimeout(()=>{this.scrollAnim=false},320)
    },
    onChatScroll:function(event){
      const d=(event&&event.detail)||{}
      if(typeof d.scrollHeight!=='number')return
      const viewH=this.chatViewH||uni.getSystemInfoSync().windowHeight*0.6
      const gap=d.scrollHeight-d.scrollTop-viewH
      if(gap>160){this.followBottom=false}
      else if(gap<80){this.followBottom=true}
    },
    storageOwner:function(){const id=uni.getStorageSync('user_id');return id?'id:'+id:uni.getStorageSync('username')?'name:'+uni.getStorageSync('username'):'guest'},
    historyKey:function(){return 'ai_chat_state:'+encodeURIComponent(this.storageOwner())},
    isCurrentRequest:function(epoch,owner){return this.requestEpoch===epoch&&this.storageOwner()===owner},
    loadQACatalog:async function(){
      if(this.qaSpots.length&&this.qaGuides.length)return
      this.qaCatalogLoading=true
      const epoch=this.requestEpoch,owner=this.storageOwner()
      try{
        const [spots,guides]=await Promise.all([request({url:'/tour-session/spots'}),request({url:'/tour-session/guides'})])
        if(!this.isCurrentRequest(epoch,owner))return
        this.qaSpots=spots.data?.data?.spot_list||[]
        this.qaGuides=guides.data?.data?.guide_list||[]
      }finally{if(this.isCurrentRequest(epoch,owner))this.qaCatalogLoading=false}
    },
    selectQuestionSpot:function(event){
      this.qaSpotId=this.qaSpots[Number(event.detail.value)]?.spot_id||null
      this.saveHistory()
      const kind=this._pendingGuideKind
      if(kind){
        this._pendingGuideKind=''
        this.sendGuideKind(kind)
        if(this.$refs.spotPicker)this.$refs.spotPicker.requestClose()
        else this.showQASpots=false
      }
    },
    pickSpot:function(){
      this.loadQACatalog()
      const self=this
      const open=function(){self.showQASpots=true}
      try{
        uni.createSelectorQuery().in(this).select('.qh-spot').boundingClientRect(function(r){
          if(r)self.spotAnchor={x:r.left+r.width/2,y:r.top+r.height/2}
          open()
        }).exec()
      }catch(e){open()}
    },
    closeSpotPicker:function(){this.showQASpots=false;this._pendingGuideKind=''},
    askGuide:function(kind){
      this._pendingGuideKind=kind
      if(this.qaSpotId&&this.guideSpotName){this.sendGuideKind(kind);return}
      this.pickSpot()
    },
    sendGuideKind:function(kind){
      const name=this.guideSpotName
      if(!name)return
      const spot=this.$t(name)
      const msg=kind==='story'?this.$t('「{spot}」有什么历史故事？',{spot}):kind==='photo'?this.$t('「{spot}」有什么拍照建议？',{spot}):this.$t('介绍「{spot}」',{spot})
      this.text=msg
      this.sendText()
    },
    sendGuideQuestion:async function(message,language,epoch,owner,contextSpotId){
      await this.loadQACatalog()
      if(!this.isCurrentRequest(epoch,owner))return null
      const spot=contextSpotId!=null?this.qaSpots.find(item=>item.spot_id===contextSpotId):findQuestionSpot(message,this.qaSpots,this.qaSpotId)
      if(!spot){
        if(contextSpotId!=null)throw new Error('识别到的景点已不可用，请重新选择')
        this.msgs.pop();this.text=message;this.showQASpots=!!this.qaSpots.length
        uiToast({title:this.qaSpots.length?'请先选择问答景点':'暂无可用景点',icon:'none'});return null
      }
      this.qaSpotId=spot.spot_id
      const guide=this.qaGuides.find(item=>item.guide_id>0&&item.is_enabled!==false)
      if(!guide)throw new Error('暂无可用数字导游，请稍后重试')
      const create=async()=>{
        const res=await request({url:'/tour-session/visitor-create?name='+encodeURIComponent(this.$t('景点问答'))+'&guide_id='+guide.guide_id+'&spot_ids='+encodeURIComponent(JSON.stringify([spot.spot_id])),method:'POST'})
        if(!res.data?.success||!res.data?.data?.session_id)throw new Error(res.data?.message||'问答会话创建失败')
        if(!this.isCurrentRequest(epoch,owner))return null
        this.qaSession={session_id:res.data.data.session_id,guide_id:guide.guide_id};this.saveHistory();return this.qaSession
      }
      let session=this.qaSession
      if(!session||session.guide_id!==guide.guide_id)session=await create()
      if(!session||!this.isCurrentRequest(epoch,owner))return null
      const ask=()=>request({url:'/tour-session/chat',method:'PUT',timeout:120000,data:{sessionId:session.session_id,message,currentSpotId:spot.spot_id,nextSpotId:null,language,text_only:true}})
      let result=await ask()
      if(!this.isCurrentRequest(epoch,owner))return null
      if(!result.data?.success&&/会话不存在|导览已结束/.test(result.data?.message||'')){
        session=await create();if(!session)return null;result=await ask()
      }
      if(!this.isCurrentRequest(epoch,owner))return null
      if(!result.data?.success||!result.data?.data?.message)throw new Error(result.data?.message||'问答服务暂不可用，请稍后重试')
      return result.data.data.message
    },
    updateKeyboardHeight:function(height){this.keyboardHeight=Math.max(0,Number(height)||0);this.keyboardVisible=this.keyboardHeight>0;this.scrollChat()},
    onInputFocus:function(){this.keyboardVisible=this.keyboardHeight>0;this.scrollChat()},
    onInputBlur:function(){if(!this.keyboardHeight)this.keyboardVisible=false},
    onInputKeyboardHeight:function(event){this.updateKeyboardHeight(event.detail.height)},
    chooseScenicPhoto:function(){
      if(this.recognizing)return
      uni.hideKeyboard()
      this.recognitionError=''
      if(this.showPhotoChoices){this.closePhotoChoices();return}
      this.photoClosing=false
      this.showPhotoChoices=true
    },
    closePhotoChoices:function(){
      if(!this.showPhotoChoices||this.photoClosing)return
      this.photoClosing=true
      clearTimeout(this._photoCloseTimer)
      this._photoCloseTimer=setTimeout(()=>{this.showPhotoChoices=false;this.photoClosing=false},190)
    },
    selectScenicSource:function(index){
      const source=Number(index)===0?'camera':'album'
      this.closePhotoChoices()
      setTimeout(()=>{this.openScenicSource(source)},200)
    },
    openScenicSource:function(source){
      const epoch=this.requestEpoch,owner=this.storageOwner()
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
            this.pickScenicImage(source,epoch,owner)
          },e=>{this.recognitionError='申请权限失败，请到手机应用权限设置中开启';console.error('Photo permission failed',e)})
        }catch(e){this.recognitionError='无法检查图片权限，请到手机应用权限设置中开启';console.error('Photo permission check failed',e)}
        return
      }
      // #endif
      this.pickScenicImage(source,epoch,owner)
    },
    pickScenicImage:function(source,epoch=this.requestEpoch,owner=this.storageOwner()){
      uni.chooseImage({count:1,sizeType:['compressed'],sourceType:[source],
        success:res=>{if(this.isCurrentRequest(epoch,owner)&&res.tempFilePaths&&res.tempFilePaths[0]){this.pendingPhoto=res.tempFilePaths[0];this.recognitionError='';this.voiceMode=false}},
        fail:e=>{if(!this.isCurrentRequest(epoch,owner))return;console.error('Choose scenic photo failed',e);if(!/cancel/i.test(e.errMsg||''))this.recognitionError=(source==='camera'?'相机':'相册')+'打开失败：'+(e.errMsg||'请检查手机权限')}})
    },
    previewChatPhoto:function(path){uni.previewImage({urls:[path],current:path})},
    sendPhoto:async function(){
      if(this.loading||this.recognizing||!this.pendingPhoto)return
      const path=this.pendingPhoto,caption=this.text.trim()
      if(Array.from(caption).length>1000){uiToast({title:'照片附言请控制在1000字以内',icon:'none'});return}
      const language=questionLanguage(caption,this.tourLanguage)
      this.pendingPhoto='';this.text='';this.recognitionError=''
      this.qaSpotId=null;this.chatMode='guide'
      this.pushMsg({role:'user',image:path,content:caption})
      const epoch=++this.requestEpoch,owner=this.storageOwner()
      this.recognizing=true;this.loading=true;this.scrollChat();this.saveHistory()
      try{
        const r=await new Promise((resolve,reject)=>uni.uploadFile({url:BASE_URL+'/tour-session/recognize-spot',filePath:path,name:'file',timeout:90000,
          formData:{question:caption,language},header:{Authorization:'Bearer '+uni.getStorageSync('token')},success:resolve,fail:()=>reject(new Error('照片上传失败，请检查网络连接'))}))
        if(!this.isCurrentRequest(epoch,owner))return
        let d;try{d=JSON.parse(r.data)}catch(error){throw new Error('识景服务返回格式异常')}
        if(r.statusCode===401){uni.removeStorageSync('token');uni.reLaunch({url:'/pages/auth/auth'});return}
        if(r.statusCode!==200||!d.success||!d.data)throw new Error(typeof d.detail==='string'?d.detail:d.message||'识景失败，请稍后重试')
        const result=d.data,prefix=photoIdentificationText(result,language)
        let reply=prefix
        if(result.status==='candidate'&&Number.isInteger(result.spot_id)&&result.spot_id>0){
          try{
            const question=translateTour('介绍「{spot}」的历史、典故和看点。',language,{spot:result.spot_name||''})
            const answer=await this.sendGuideQuestion(question,language,epoch,owner,result.spot_id)
            if(answer)reply+='\n\n'+answer
          }catch(error){
            if(!this.isCurrentRequest(epoch,owner))return
            reply+='\n\n'+translateTour('已得到候选景点，但问答服务暂不可用。请稍后重试提问。',language)
            this.text=caption
          }
        }
        if(!this.isCurrentRequest(epoch,owner))return
        this.loading=false;this.pushAIReply(reply,{recognition_id:result.recognition_id,recognitionEvidence:result.evidence||'',silent:true})
      }catch(error){
        if(!this.isCurrentRequest(epoch,owner))return
        const translated=translateTour(error.message||'照片上传失败，请检查网络连接',language)
        this.pushMsg({role:'ai',content:language==='en'&&/[\u3400-\u9fff]/.test(translated)?translateTour('照片识别失败，请稍后重试或联系管理员。',language):translated})
        this.pendingPhoto=path;this.text=caption
      }finally{
        if(this.isCurrentRequest(epoch,owner)){this.recognizing=false;this.loading=false;this.scrollChat();this.saveHistory()}
      }
    },
    toggleEvidence:function(m){m.showEvidence=!m.showEvidence;this.scrollChat()},
    scrollChat:function(){
      const self=this
      self.scrollAnim=false
      self.$nextTick(()=>{self.chatScrollTop+=100000})
      clearTimeout(self._scrollAnimTimer)
      self._scrollAnimTimer=setTimeout(()=>{self.scrollAnim=true},260)
    },
    saveHistory:function(){
      try{uni.setStorageSync(this.historyKey(),JSON.stringify({messages:this.historyMsgs.slice(-200),mode:this.chatMode,session:this.qaSession,spotId:this.qaSpotId,plan:this.recommendedPlan}))}catch(e){}
    },
    loadHistory:function(){
      this.requestEpoch++;this.historyOwner=this.storageOwner();this.loading=false;this.recognizing=false;this.qaCatalogLoading=false
      this.msgs=[];this.qaSession=null;this.qaSpotId=null;this.recommendedPlan=null;this.lastSpotIds=[];this.recommendSpots=[]
      uni.removeStorageSync('ai_chat_msgs') // Old shared history has no reliable account owner.
      try{
        const raw=uni.getStorageSync(this.historyKey()),state=raw?JSON.parse(raw):{}
        this.historyMsgs=Array.isArray(state.messages)?state.messages.filter(item=>item&&['ai','user'].includes(item.role)&&typeof item.content==='string').slice(-200):[]
      this.msgs=[]
        this.chatMode='guide'
        if(Number.isInteger(state.session?.session_id)&&state.session.session_id>0)this.qaSession=state.session
        this.qaSpotId=Number.isInteger(state.spotId)?state.spotId:null
        if(state.plan&&Array.isArray(state.plan.spot_ids)){this.recommendedPlan=state.plan;this.lastSpotIds=state.plan.spot_ids;this.fetchRecommendSpots(this.lastSpotIds)}
      }catch(e){this.historyMsgs=[];this.msgs=[]}
    },
    clearRoutePreview:function(){this.lastSpotIds=[];this.recommendSpots=[];this.recommendedPlan=null;this.recommendLoading=false;uni.removeStorageSync('ai_spot_ids');uni.removeStorageSync('ai_route_plan')},
    clearHistory:function(){
      this.requestEpoch++;this.stopTTS();this.cancelRecord();this.loading=false;this.recognizing=false;this.transcribing=false;this.qaCatalogLoading=false
      this.msgs=[];this.historyMsgs=[];this.qaSession=null;this.text='';this.voiceError='';this.showPhotoChoices=false;this.showQASpots=false;this.pendingPhoto='';this.recognitionError='';this.applyingRoute=false;this.clearRoutePreview();this.saveHistory()
      uni.removeStorageSync('ai_chat_msgs');uiToast({title:'已清除',icon:'none'})
    },
    fixImg: function (u) { if (!u) return ''; return assetUrl(u) },
    walkText: function (a, b) {
      const details=this.recommendedPlan&&this.recommendedPlan.score_details||[]
      const index=details.findIndex(item=>item.spot_id===b.spot_id)
      const leg=index>0&&details[index-1].spot_id===a.spot_id?details[index]:null
      if(!leg||leg.walk_from_previous_meters==null||leg.walk_from_previous_minutes==null)return this.$t('暂无步行数据')
      const meters=Number(leg.walk_from_previous_meters),minutes=Number(leg.walk_from_previous_minutes)
      if(!Number.isFinite(meters)||!Number.isFinite(minutes))return this.$t('暂无步行数据')
      return meters<1000?this.$t('{meters}米 / {minutes}分钟',{meters:Math.round(meters),minutes}):this.$t('{km}公里 / {minutes}分钟',{km:(meters/1000).toFixed(2),minutes})
    },
    fetchRecommendSpots: function (ids) {
      var self = this
      const epoch=this.requestEpoch,owner=this.storageOwner()
      self.recommendSpots = []
      self.recommendLoading = true
      request({ url: '/tour-session/spots' }).then(function (res) {
        if(!self.isCurrentRequest(epoch,owner))return
        var d = res.data
        var list = (d && d.data && d.data.spot_list) ? d.data.spot_list : (d && d.spot_list ? d.spot_list : [])
        list = list.filter(function(sp){ return isBeijingCity(sp.city) })
        var map = {}
        list.forEach(function (sp) { map[sp.spot_id] = sp })
        self.recommendSpots = ids.map(function (id) { return map[id] }).filter(Boolean)
      }).catch(function () { if(self.isCurrentRequest(epoch,owner))self.recommendSpots=[] }).finally(function () { if(self.isCurrentRequest(epoch,owner))self.recommendLoading=false })
    },
    goTab:function(p){uni.reLaunch({url:p})},
    quickSend: function (msg) { this.text = this.$t(msg); this.sendText() },
    sendText: async function () {
      if(this.pendingPhoto){this.sendPhoto();return}
      var self = this
      var msg = (self.text || '').trim()
      if (!msg || self.loading) return
      if(Array.from(msg).length>2000){uiToast({title:'请输入2000字以内的问题',icon:'none'});return}
      const epoch=++this.requestEpoch,owner=this.storageOwner()
      self.pushMsg({ role: 'user', content: msg })
      self.text = ''; self.loading = true; self.scrollChat()
      self.saveHistory()
      var requestLanguage = questionLanguage(msg,self.tourLanguage)
      try{
      if(self.chatMode==='guide'){
        const reply=await self.sendGuideQuestion(msg,requestLanguage,epoch,owner)
        if(reply&&self.isCurrentRequest(epoch,owner)){self.loading=false;self.pushAIReply(reply)}
        return
      }
      self.clearRoutePreview()
      const res=await request({
        url: '/tour-session/ai-chat-recommend?message=' + encodeURIComponent(planningMessage(msg)) + '&language=' + requestLanguage,
        method: 'POST', data: {},
      })
        if(!self.isCurrentRequest(epoch,owner))return
        var d = res.data
        if (d && d.success && d.data) {
          var dd = d.data
          var reply = recommendationText(dd,requestLanguage)
          self.loading=false
          self.pushAIReply(reply)
          if (dd.spot_ids && dd.spot_ids.length) {
            self.recommendedPlan=dd
            self.lastSpotIds = dd.spot_ids
            self.fetchRecommendSpots(dd.spot_ids)
          }
        } else { self.pushMsg({ role: 'ai', content: self.$t(d && d.message || '没有找到匹配路线，请调整需求。') }) }
      }catch(error){
        if(self.isCurrentRequest(epoch,owner))self.pushMsg({role:'ai',content:self.$t(error.message||error.errMsg||'无法连接推荐服务，请检查网络。')})
      }finally{if(self.isCurrentRequest(epoch,owner)){self.loading=false;self.scrollChat();self.saveHistory()}}
    },
    applyRecommend: function () {
      if(!this.lastSpotIds.length||this.loading||this.applyingRoute)return
      this.applyingRoute=true
      const epoch=this.requestEpoch,owner=this.storageOwner(),self=this
      uni.setStorageSync('ai_spot_ids', JSON.stringify(this.lastSpotIds))
      if(this.recommendedPlan)uni.setStorageSync('ai_route_plan',JSON.stringify(this.recommendedPlan))
      uni.setStorageSync('ai_route_owner',this.storageOwner())
      uiToast({ title: '已选中' + this.lastSpotIds.length + '个景点', icon: 'success' })
      setTimeout(function () { if(self.isCurrentRequest(epoch,owner))uni.reLaunch({ url: '/pages/tour-guide/tour-guide' }) }, 500)
    },
    toggleVoiceMode: function () { if(this.recording||this.transcribing)return;this.voiceMode = !this.voiceMode;if(this.voiceMode)uni.hideKeyboard() },
    stopTTS:function(){this._ttsRequestId=(this._ttsRequestId||0)+1;this.voicePayload={id:this._ttsRequestId};if(this._ttsAudio){this._ttsAudio.destroy();this._ttsAudio=null}this.speaking=false;this.ttsLoading=false;this.speakingIndex=-1},
    onDigitalVoiceState:function(event){if(event.id!==this._ttsRequestId)return;if(event.state==='playing'){this.speaking=true;this.ttsLoading=false}else{this.stopTTS();if(event.state==='error')uiToast({title:event.message||'数字人语音连接失败',icon:'none'})}},
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
        self.voicePayload={id:requestId,text:clean,sdkUrl:res.data.sdk_url,gateway:BASE_URL+'/xingyun/session/'+res.data.guide_id+'?chat_speech=true',token:uni.getStorageSync('token')}
      }).catch(function(error){if(requestId!==self._ttsRequestId)return;self.stopTTS();uiToast({title:error.message||'默认数字人未连接',icon:'none'})})
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
          audio.onError(function(){self.stopTTS();uiToast({title:'语音播放失败，请检查网络后重试',icon:'none'})})
          audio.src = url; audio.play()
        }else throw new Error('语音服务未返回音频')
      }).catch(function (error) {if(requestId!==self._ttsRequestId)return;self.stopTTS();uiToast({title:error.message||'语音播报失败，请稍后重试',icon:'none'})})
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
        self._recordStartedAt=0;self._recordRequestedAt=0
        if(!res.tempFilePath||duration<500){uiToast({title:'请按住说话至少半秒',icon:'none'});return}
        self.transcribing=true
        const epoch=self.requestEpoch,owner=self.storageOwner()
        uni.uploadFile({url:BASE_URL+'/tour-session/asr-upload',filePath:res.tempFilePath,name:'file',timeout:120000,
          header:{Authorization:'Bearer '+uni.getStorageSync('token')},
          success:function(r){
            if(!self.isCurrentRequest(epoch,owner))return
            try{var d=JSON.parse(r.data)
              if(r.statusCode===200&&d.success&&d.data){self.transcribing=false;self.text=d.data;self.sendText();return}
              self.voiceError=d.message||d.detail||'语音识别服务返回错误'
            }catch(e){self.voiceError='语音识别返回格式异常'}
          },
          fail:function(){if(self.isCurrentRequest(epoch,owner))self.voiceError='语音上传失败，请检查网络连接'},
          complete:function(){if(self.isCurrentRequest(epoch,owner))self.transcribing=false}
        })
      })
      rm.onError(function(e){self.voicePressing=false;self.recording=false;self.voiceError='录音失败，请检查手机麦克风权限';uiToast({title:self.voiceError,icon:'none'});console.error('Recorder failed',e)})
      return rm
    },
    startRecord:function(){
      if(this.transcribing){uiToast({title:'正在识别上一段语音，请稍候',icon:'none'});return}
      if(this.loading){uiToast({title:'正在回答，请稍候再录音',icon:'none'});return}
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
  onBackPress:function(){if(this.showQASpots){this.showQASpots=false;return true}if(this.showPhotoChoices){this.showPhotoChoices=false;return true}},
  onHide:function(){this.cancelRecord();this.stopTTS();this.keyboardVisible=false;this.keyboardHeight=0;this.showPhotoChoices=false;this.showQASpots=false},
  onShow:function(){if(this.historyOwner!==this.storageOwner())this.loadHistory();if(this.chatMode==='guide'&&this.qaSpotId&&!this.qaSpots.length)this.loadQACatalog();this.scrollChat()},
}
</script>

<style scoped>
.photo-evidence-toggle{margin:12rpx 0 0;padding:8rpx 0;background:transparent;color:#625a75;font-size:22rpx;line-height:1.5;text-align:left}.photo-evidence-toggle::after{border:0}.photo-evidence{display:block;margin-top:8rpx;font-size:23rpx;line-height:1.7;color:#625a75}
.photo-draft{display:flex;align-items:center;gap:20rpx;padding:16rpx 24rpx;flex-wrap:wrap;border-top:1rpx solid var(--ng-border)}
.draft-thumbnail{position:relative;width:112rpx;height:112rpx}.draft-thumbnail image{width:100%;height:100%;border-radius:12rpx}
.draft-remove{position:absolute;top:-10rpx;right:-10rpx;display:flex;align-items:center;justify-content:center;width:36rpx;height:36rpx;margin:0;padding:0;border-radius:50%;background:#625a75;color:#fff;font-size:28rpx;line-height:1}.draft-remove::after{border:0}
.draft-note{font-size:23rpx;color:#817994}.chat-photo{display:block;width:320rpx;max-width:100%;border-radius:14rpx;margin-bottom:10rpx}

.photo-entry{position:relative;padding:12rpx 24rpx;z-index:1}
.photo-entry-wrap{position:relative;flex-shrink:0;display:flex;align-items:center}
.photo-popover{position:absolute;left:0;bottom:calc(100% + 14rpx);width:296rpx;padding:8rpx;background:var(--ng-surface,#fff);border-radius:26rpx;box-shadow:0 20rpx 54rpx rgba(48,40,94,.2),0 2rpx 8rpx rgba(48,40,94,.08);z-index:1200;transform-origin:left bottom;animation:photoPopIn 340ms cubic-bezier(.18,1.35,.3,1) both;overflow:hidden}
.photo-choice{display:flex;align-items:center;width:100%;margin:0;padding:24rpx 26rpx;background:transparent;border-radius:18rpx;font-size:29rpx;line-height:1.4;color:#3f3a55;text-align:left;box-shadow:none}
.photo-choice::after{border:0}
.photo-choice:active{background:#f3effb}
.photo-choice + .photo-choice{border-top:1rpx solid var(--ng-border,#eee)}
.photo-popover-mask{position:fixed;inset:0;z-index:1200;background:rgba(20,24,40,.06);animation:photoMaskIn 180ms ease both}
.photo-popover-mask.closing{animation:photoMaskOut 190ms ease both}
@keyframes photoMaskOut{from{opacity:1}to{opacity:0}}
.photo-popover.closing{animation:photoPopOut 190ms cubic-bezier(.4,0,.75,.45) both;pointer-events:none}
@keyframes photoPopOut{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(20rpx) scale(.7)}}
@keyframes photoPopIn{0%{opacity:0;transform:translateY(26rpx) scale(.82)}55%{opacity:1;transform:translateY(-6rpx) scale(1.04)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes photoMaskIn{from{opacity:0}to{opacity:1}}
.photo-add{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:84rpx;height:84rpx;margin:0;padding:0;line-height:1;font-family:Arial,sans-serif;font-size:52rpx;font-weight:400;color:#6840c2;background:#f1eaff;border-radius:50%}.photo-add::after{border:0}.photo-add[disabled]{opacity:.45}
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

.nav{position:relative;z-index:1;display:flex;align-items:center;justify-content:flex-end;padding:12rpx 24rpx;min-height:88rpx;box-sizing:border-box}
.nav-actions{display:flex;align-items:center;gap:16rpx;margin-left:auto}
.nav-title { font-size:44rpx; font-weight:900; color:var(--ng-text); letter-spacing:8rpx; font-family:var(--app-font-family); }
.nav-back{display:flex;align-items:center;justify-content:center;width:108rpx;height:108rpx;margin:-22rpx 10rpx -22rpx -8rpx;border-radius:24rpx;background:transparent;border:0;box-shadow:none;color:var(--ng-text);font-size:60rpx;line-height:1;margin-right:auto}
.nav-back:active{opacity:.5}
.nav-back text{transform:translateY(-4rpx)}
.nav-back text{transform:translateY(-3rpx)}
.nav-clear{position:static;font-size:24rpx;color:var(--ng-secondary);padding:6rpx 14rpx;border-radius:8rpx;background:rgba(99,102,241,0.06)}
.nav-history{position:relative;flex-shrink:0;width:68rpx;height:68rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.82);border:1rpx solid var(--ng-border);box-shadow:0 4rpx 14rpx rgba(99,102,241,0.14)}
.hist-clock{position:relative;width:34rpx;height:34rpx;border:3rpx solid var(--ng-secondary);border-radius:50%;box-sizing:border-box}
.hc-hour{position:absolute;left:50%;top:50%;width:2.5rpx;height:9rpx;background:var(--ng-secondary);border-radius:2rpx;transform:translate(-50%,-100%)}
.hc-minute{position:absolute;left:50%;top:50%;width:9rpx;height:2.5rpx;background:var(--ng-secondary);border-radius:2rpx;transform-origin:0 50%;transform:translateY(-50%) rotate(32deg)}
.history-mask{position:fixed!important;inset:0!important;z-index:9500!important;background:rgba(24,20,40,0.38);display:flex;align-items:center;justify-content:center;padding:0 24rpx}
.history-panel{width:86vw;max-width:660rpx;max-height:74vh;background:var(--ng-surface);border-radius:34rpx;box-shadow:0 30rpx 80rpx rgba(40,30,70,0.28);display:block;overflow:hidden;transform-origin:top right;animation:historyPop .42s cubic-bezier(.18,1.3,.3,1)}
@keyframes historyPop{0%{transform:translate(40rpx,-60rpx) scale(0.18);opacity:0}55%{transform:translate(0,0) scale(1.04);opacity:1}100%{transform:translate(0,0) scale(1)}}
.hp-head{display:flex;align-items:center;justify-content:space-between;padding:26rpx 28rpx 16rpx}
.hp-actions{display:flex;align-items:center;gap:14rpx}
.hp-clear{font-size:24rpx;color:var(--ng-secondary);padding:8rpx 18rpx;border-radius:12rpx;background:rgba(99,102,241,0.08)}
.hp-title{font-size:30rpx;font-weight:700;color:var(--ng-text)}
.hp-close{width:60rpx;height:60rpx;border-radius:16rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.08);font-size:34rpx;line-height:1;color:var(--ng-secondary)}
.hp-body{max-height:calc(74vh - 110rpx);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:auto;touch-action:pan-y;padding:0 24rpx 24rpx;box-sizing:border-box}
.hp-empty{padding:60rpx 0;text-align:center;color:var(--ng-secondary);font-size:26rpx}
.hp-item{margin-top:18rpx;padding:18rpx;border-radius:20rpx;background:rgba(99,102,241,0.05);border:1rpx solid rgba(99,102,241,0.12)}
.hp-q{display:flex;gap:12rpx;align-items:flex-start}
.hp-a{display:flex;gap:12rpx;align-items:flex-start;margin-top:12rpx;padding-top:12rpx;border-top:1rpx dashed var(--ng-border)}
.hp-tag{flex-shrink:0;width:34rpx;height:34rpx;border-radius:10rpx;background:rgba(99,102,241,0.18);color:var(--ng-text);font-size:20rpx;font-weight:700;display:flex;align-items:center;justify-content:center}
.hp-tag.a{background:rgba(59,91,255,0.12);color:var(--ng-secondary)}
.hp-qtext,.hp-atext{font-size:24rpx;line-height:1.6;color:var(--ng-text);word-break:break-word}
.hp-atext{color:var(--ng-secondary)}

.quick-hints { position:relative; z-index:1; display:flex; flex-wrap:wrap; gap:10rpx; padding:2rpx 24rpx 14rpx; }
.qh-spot{display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;padding:12rpx 20rpx;margin-bottom:6rpx;border-radius:18rpx;background:rgba(255,255,255,.66);border:1rpx dashed rgba(108,76,228,.32)}
.qh-spot-label{font-size:23rpx;color:#5b527a}
.qh-spot-action{font-size:22rpx;color:#7c4dea}
.qh-chip { padding:12rpx 20rpx; border-radius:22rpx; background:rgba(99,102,241,0.12); border:1rpx solid rgba(99,102,241,0.25); font-size:22rpx; color:var(--ng-secondary); }
.qh-chip:active { background:rgba(99,102,241,0.18); }

.chat-area { position:relative; z-index:1; flex:1; height:0; min-height:0; box-sizing:border-box; padding:16rpx 24rpx; }
.chat-empty { display:flex; flex-direction:column; align-items:center; justify-content:flex-start; min-height:0; padding-top:34rpx; }
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
.typing-dots{display:flex;align-items:center;gap:9rpx;height:34rpx;padding:2rpx 0}
.typing-dots .td{width:13rpx;height:13rpx;border-radius:50%;background:var(--ng-secondary,#8b84a3);opacity:.3;animation:tdBreath 1.15s ease-in-out infinite}
.typing-dots .td:nth-child(2){animation-delay:.16s}
.typing-dots .td:nth-child(3){animation-delay:.32s}
@keyframes tdBreath{0%,100%{opacity:.22;transform:scale(.85)}45%{opacity:1;transform:scale(1.15)}}
.msg-seg{animation:segIn 320ms cubic-bezier(.25,.8,.35,1) both}
@keyframes segIn{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:blur(0)}}
.msg-caret{display:inline-block;width:3rpx;height:26rpx;margin-left:6rpx;border-radius:2rpx;background:var(--ng-accent-text,#6840c2);vertical-align:-4rpx;animation:caretBlink .92s steps(1,end) infinite}
@keyframes caretBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
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

.bottom-fixed{position:relative;flex-shrink:0;z-index:998;display:flex;flex-direction:column;background:var(--ng-surface);backdrop-filter: none}
.bottom-fixed.photo-open{z-index:1300}.input-bar{display:flex;gap:12rpx;align-items:center;padding:16rpx 18rpx 18rpx;background:var(--ng-surface);border-top:1rpx solid var(--ng-border);margin:0}
.voice-btn { width:84rpx; height:84rpx; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(99,102,241,0.15); font-size:32rpx; }
.voice-btn.active { background:rgba(99,102,241,0.18); color:var(--ng-text); }
.msg-input { flex:1; height:88rpx; padding:0 24rpx; border:1rpx solid var(--ng-border); border-radius:44rpx; background:var(--ng-surface); font-size:28rpx; color:var(--ng-text); }
.voice-hold-btn { user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; touch-action:none; flex:1; height:88rpx; display:flex; align-items:center; justify-content:center; border:1rpx dashed rgba(99,102,241,0.25); border-radius:44rpx; background:rgba(99,102,241,0.08); font-size:28rpx; color:var(--ng-secondary); font-weight:600; }
.voice-hold-btn.pressing { background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.18)); color:var(--ng-text); border-style:solid; }
.send-btn { height:88rpx; padding:0 32rpx; line-height:88rpx; border-radius:44rpx; background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.18)); color:var(--ng-text); font-size:28rpx; font-weight:700; }
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
