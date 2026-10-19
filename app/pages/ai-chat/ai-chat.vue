<template>
  <view class="page aurora-page" :class="{'app-english':tourLanguage==='en'}">
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
      <text class="nav-clear" v-if="msgs.length" @tap="clearHistory">{{ $t("清空") }}</text>
    </view>

    <view class="chat-tools">
      <view class="chat-modes" role="tablist">
        <button class="chat-mode" :class="{selected:chatMode==='guide'}" :aria-pressed="chatMode==='guide'" :disabled="loading" @tap="setChatMode('guide')">{{ $t('景点问答') }}</button>
        <button class="chat-mode" :class="{selected:chatMode==='route'}" :aria-pressed="chatMode==='route'" :disabled="loading" @tap="setChatMode('route')">{{ $t('路线规划') }}</button>
      </view>
      <button v-if="chatMode==='guide'" class="question-place" :disabled="loading||qaCatalogLoading" @tap="chooseQuestionSpot">
        <text>{{ qaSpot ? $t(qaSpot.spot_name) : $t('选择问答景点') }}</text><text aria-hidden="true">⌄</text>
      </button>
    </view>

    <!-- 快捷提示 -->
    <view class="quick-hints" v-if="msgs.length === 0 && chatMode==='route'">
      <view class="qh-chip" @tap="quickSend('我想带孩子玩2小时，喜欢自然风光')">{{ $t("亲子2小时自然游") }}</view>
      <view class="qh-chip" @tap="quickSend('推荐颐和园的历史文化景点，半天时间')">{{ $t("颐和园历史文化半天") }}</view>
      <view class="qh-chip" @tap="quickSend('帮我规划一个适合拍照的一日游路线')">{{ $t("拍照打卡一日游") }}</view>
      <view class="qh-chip" @tap="quickSend('周末带朋友玩半天，喜欢美食和拍照')">{{ $t("周末美食拍照") }}</view>
    </view>
    <view class="quick-hints" v-if="msgs.length===0 && chatMode==='guide'">
      <view class="qh-chip" @tap="quickSend('介绍这个景点')">{{ $t('介绍这个景点') }}</view>
      <view class="qh-chip" @tap="quickSend('这里有什么历史故事？')">{{ $t('这里有什么历史故事？') }}</view>
      <view class="qh-chip" @tap="quickSend('这里有什么拍照建议？')">{{ $t('这里有什么拍照建议？') }}</view>
    </view>

    <!-- 对话区 -->
    <scroll-view scroll-y class="chat-area" :scroll-top="chatScrollTop" :scroll-with-animation="true">
      <view v-if="msgs.length === 0 && !loading" class="chat-empty">

        <text class="ce-title">{{ $t(chatMode==='guide'?'想了解哪个景点？':'想去哪里？') }}</text>

      </view>
      <view v-for="(m, i) in msgs" :key="i" :id="'m-'+i" class="msg-row" :class="m.role==='ai'?'msg-l':'msg-r'">
        <view class="msg-bubble" :class="m.role">
          <image v-if="m.image" :src="m.image" class="chat-photo" mode="widthFix" @load="scrollChat" @tap="previewChatPhoto(m.image)" />
          <text v-if="m.content" class="msg-text">{{ m.content }}</text>
          <button v-if="m.recognitionEvidence" class="photo-evidence-toggle" @tap="m.showEvidence=!m.showEvidence">{{ $t(m.showEvidence?'收起识别依据':'查看识别依据（原文）') }}</button>
          <text v-if="m.showEvidence&&m.recognitionEvidence" class="photo-evidence">{{ m.recognitionEvidence }}</text>
          <view v-if="m.role==='ai' && m.content" class="msg-speaker" :class="{on:speaking && speakingIndex===i}" @tap="replayTTS(m.content,i)">
            <text>{{ $t(speakingIndex===i ? (ttsLoading ? $t("正在生成语音…") : $t("停止播报")) : $t("语音播报")) }}</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="msg-row msg-l">
        <view class="msg-bubble ai typing">
          <text class="msg-text">{{ $t("AI思考中...") }}</text>
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

    <!-- 底部固定区：输入框 + Tab，flex竖向排列 -->
    <view class="bottom-fixed" :class="{'keyboard-open':keyboardVisible}">
      <view v-if="pendingPhoto || recognitionError" class="photo-draft">
        <view v-if="pendingPhoto" class="draft-thumbnail"><image :src="pendingPhoto" mode="aspectFill" @tap="previewChatPhoto(pendingPhoto)" /><button class="draft-remove" @tap="pendingPhoto=''">×</button></view>
        <text v-if="pendingPhoto" class="draft-note">{{ $t("已选择图片，点击发送后识别") }}</text>
        <text v-if="recognitionError" class="photo-error">{{ $t(recognitionError) }}</text>
      </view>
      <!-- 输入栏 -->
    <view class="input-bar">
      <button class="photo-add" :disabled="recognizing" :aria-label="$t(&quot;拍照或相册识景&quot;)" @tap="chooseScenicPhoto">＋</button>
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

    <TabBarNav v-show="!keyboardVisible" current="ai" />
    </view>
    <NocturneSelect v-if="showPhotoChoices" :title="$t('拍照或相册识景')" :options="['拍照识景','从相册选择']" @change="selectScenicSource" @close="showPhotoChoices=false" />
    <NocturneSelect v-if="showQASpots" :title="$t('选择问答景点')" :options="qaOptions" :selected-index="qaSpots.findIndex(spot=>spot.spot_id===qaSpotId)" @change="selectQuestionSpot" @close="showQASpots=false" />
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
      chatMode:'guide',qaSpots:[],qaGuides:[],qaSpotId:null,qaSession:null,qaCatalogLoading:false,showQASpots:false,requestEpoch:0,historyOwner:null,applyingRoute:false,
      voicePayload:{},keyboardVisible:false,keyboardHeight:0,recognizing:false,pendingPhoto:'',recognitionError:'',showPhotoChoices:false,
      text: '', msgs: [], loading: false, chatScrollTop:0, lastSpotIds: [], recommendSpots: [], recommendLoading: false,recommendedPlan:null,
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
    this.requestEpoch++
    if(uni.offKeyboardHeightChange&&this._keyboardListener)uni.offKeyboardHeightChange(this._keyboardListener)
    this.cancelRecord()
    this.stopTTS()
  },
  computed: {
    qaSpot:function(){return this.qaSpots.find(spot=>spot.spot_id===this.qaSpotId)||null},
    qaOptions:function(){return this.qaSpots.map(spot=>[this.$t(spot.city),this.$t(spot.spot_name)].filter(Boolean).join(' · '))},
    totalDuration: function () {
      if(!this.recommendedPlan)return null
      const minutes=this.recommendedPlan.estimated_time_minutes ?? this.recommendedPlan.total_duration
      return minutes!=null&&Number.isFinite(Number(minutes))&&Number(minutes)>=0?Number(minutes):null
    },
  },
  methods: {
    storageOwner:function(){const id=uni.getStorageSync('user_id');return id?'id:'+id:uni.getStorageSync('username')?'name:'+uni.getStorageSync('username'):'guest'},
    historyKey:function(){return 'ai_chat_state:'+encodeURIComponent(this.storageOwner())},
    isCurrentRequest:function(epoch,owner){return this.requestEpoch===epoch&&this.storageOwner()===owner},
    setChatMode:function(mode){if(this.loading)return;this.chatMode=mode==='route'?'route':'guide';this.saveHistory()},
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
    chooseQuestionSpot:async function(){
      if(this.loading||this.qaCatalogLoading)return
      try{await this.loadQACatalog();if(!this.qaSpots.length)throw new Error('暂无可用景点');this.showQASpots=true}
      catch(error){uiToast({title:error.message||'景点加载失败，请稍后重试',icon:'none'})}
    },
    selectQuestionSpot:function(event){this.qaSpotId=this.qaSpots[Number(event.detail.value)]?.spot_id||null;this.showQASpots=false;this.saveHistory()},
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
      this.showPhotoChoices=true
    },
    selectScenicSource:function(event){this.showPhotoChoices=false;this.openScenicSource(event.detail.value===0?'camera':'album')},
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
      this.msgs.push({role:'user',image:path,content:caption})
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
            const question=caption||translateTour('这个景点在哪里？有哪些拍照建议？',language)
            const answer=await this.sendGuideQuestion(question,language,epoch,owner,result.spot_id)
            if(answer)reply+='\n\n'+answer
          }catch(error){
            if(!this.isCurrentRequest(epoch,owner))return
            reply+='\n\n'+translateTour('已得到候选景点，但问答服务暂不可用。请稍后重试提问。',language)
            this.text=caption
          }
        }
        if(!this.isCurrentRequest(epoch,owner))return
        this.msgs.push({role:'ai',content:reply,recognition_id:result.recognition_id,recognitionEvidence:result.evidence||''})
      }catch(error){
        if(!this.isCurrentRequest(epoch,owner))return
        const translated=translateTour(error.message||'照片上传失败，请检查网络连接',language)
        this.msgs.push({role:'ai',content:language==='en'&&/[\u3400-\u9fff]/.test(translated)?translateTour('照片识别失败，请稍后重试或联系管理员。',language):translated})
        this.pendingPhoto=path;this.text=caption
      }finally{
        if(this.isCurrentRequest(epoch,owner)){this.recognizing=false;this.loading=false;this.scrollChat();this.saveHistory()}
      }
    },
    scrollChat:function(){this.$nextTick(()=>{this.chatScrollTop+=100000})},
    saveHistory:function(){
      try{uni.setStorageSync(this.historyKey(),JSON.stringify({messages:this.msgs.slice(-200),mode:this.chatMode,session:this.qaSession,spotId:this.qaSpotId,plan:this.recommendedPlan}))}catch(e){}
    },
    loadHistory:function(){
      this.requestEpoch++;this.historyOwner=this.storageOwner();this.loading=false;this.recognizing=false;this.qaCatalogLoading=false
      this.msgs=[];this.qaSession=null;this.qaSpotId=null;this.recommendedPlan=null;this.lastSpotIds=[];this.recommendSpots=[]
      uni.removeStorageSync('ai_chat_msgs') // Old shared history has no reliable account owner.
      try{
        const raw=uni.getStorageSync(this.historyKey()),state=raw?JSON.parse(raw):{}
        this.msgs=Array.isArray(state.messages)?state.messages.filter(item=>item&&['ai','user'].includes(item.role)&&typeof item.content==='string').slice(-200):[]
        this.chatMode=state.mode==='route'?'route':'guide'
        if(Number.isInteger(state.session?.session_id)&&state.session.session_id>0)this.qaSession=state.session
        this.qaSpotId=Number.isInteger(state.spotId)?state.spotId:null
        if(state.plan&&Array.isArray(state.plan.spot_ids)){this.recommendedPlan=state.plan;this.lastSpotIds=state.plan.spot_ids;this.fetchRecommendSpots(this.lastSpotIds)}
      }catch(e){this.msgs=[]}
    },
    clearRoutePreview:function(){this.lastSpotIds=[];this.recommendSpots=[];this.recommendedPlan=null;this.recommendLoading=false;uni.removeStorageSync('ai_spot_ids');uni.removeStorageSync('ai_route_plan')},
    clearHistory:function(){
      this.requestEpoch++;this.stopTTS();this.cancelRecord();this.loading=false;this.recognizing=false;this.transcribing=false;this.qaCatalogLoading=false
      this.msgs=[];this.qaSession=null;this.text='';this.voiceError='';this.showPhotoChoices=false;this.showQASpots=false;this.pendingPhoto='';this.recognitionError='';this.applyingRoute=false;this.clearRoutePreview();this.saveHistory()
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
      self.msgs.push({ role: 'user', content: msg })
      self.text = ''; self.loading = true; self.scrollChat()
      self.saveHistory()
      var requestLanguage = questionLanguage(msg,self.tourLanguage)
      try{
      if(self.chatMode==='guide'){
        const reply=await self.sendGuideQuestion(msg,requestLanguage,epoch,owner)
        if(reply&&self.isCurrentRequest(epoch,owner)){self.msgs.push({role:'ai',content:reply});self.playTTS(reply,self.msgs.length-1)}
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
          self.msgs.push({ role: 'ai', content: reply })
          if (dd.spot_ids && dd.spot_ids.length) {
            self.recommendedPlan=dd
            self.lastSpotIds = dd.spot_ids
            self.fetchRecommendSpots(dd.spot_ids)
          }
          self.playTTS(reply,self.msgs.length-1)
        } else { self.msgs.push({ role: 'ai', content: self.$t(d && d.message || '没有找到匹配路线，请调整需求。') }) }
      }catch(error){
        if(self.isCurrentRequest(epoch,owner))self.msgs.push({role:'ai',content:self.$t(error.message||error.errMsg||'无法连接推荐服务，请检查网络。')})
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
  onShow:function(){if(this.historyOwner!==this.storageOwner())this.loadHistory();this.scrollChat()},
}
</script>

<style scoped>
.photo-evidence-toggle{margin:12rpx 0 0;padding:8rpx 0;background:transparent;color:#625a75;font-size:22rpx;line-height:1.5;text-align:left}.photo-evidence-toggle::after{border:0}.photo-evidence{display:block;margin-top:8rpx;font-size:23rpx;line-height:1.7;color:#625a75}
.chat-tools{position:relative;z-index:1;padding:0 24rpx 12rpx;display:flex;gap:12rpx;flex-wrap:wrap;align-items:center;flex-shrink:0}
.chat-modes{display:flex;gap:4px;padding:4px;background:#eeeafa;border-radius:12px}.chat-mode{margin:0;padding:8px 12px;border-radius:9px;background:transparent;font-size:14px;line-height:1.5;color:#625a75}.chat-mode::after,.question-place::after{border:0}.chat-mode.selected{background:white;color:#5145cd;font-weight:700;box-shadow:0 2px 6px #30285e10}.question-place{display:flex;align-items:center;gap:10px;max-width:100%;margin:0;padding:9px 12px;border-radius:12px;background:white;border:1px solid #e8e2f5;color:#5145cd;font-size:14px;line-height:1.5}.question-place text:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
