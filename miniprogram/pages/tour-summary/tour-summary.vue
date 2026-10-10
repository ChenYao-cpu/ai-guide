<template>
  <view class="page">
    <view class="ink-bg"><view class="ink-mt ink-mt-1"></view><view class="ink-mt ink-mt-2"></view></view>

    <view class="nav" :style="{paddingTop:statusH+'px'}">
      <view class="nav-back" @tap="goHome"><text>‹</text></view>
      <text class="nav-title">游览回顾</text>
      <view class="nav-share" @tap="shareTour"><text class="iconfont icon-fenxiang"></text></view>
    </view>

    <scroll-view scroll-y class="main" v-if="!loading && sessionData">
      <!-- 游记封面 -->
      <view class="hero" :style="heroImg ? 'background-image:url('+heroImg+')' : ''">
        <view class="hero-shade"></view>
        <view class="hero-content">
          <text class="hero-title">{{ sessionData.name || '我的景区导览' }}</text>
          <view class="hero-meta">
            <view class="hm-item">
              <text class="iconfont icon-daolan hm-icon"></text>
              <text class="hm-text">{{ guideName }}</text>
            </view>
            <view class="hm-item">
              <text class="iconfont icon-shijian hm-icon"></text>
              <text class="hm-text">{{ tourDate }}</text>
            </view>
          </view>
          <view class="hero-badge" v-if="totalDuration > 0">
            <text class="hb-num">{{ totalDuration }}</text>
            <text class="hb-unit">分钟游览</text>
          </view>
        </view>
      </view>

      <!-- 数据统计 -->
      <view class="stats-row">
        <view class="stat-card">
          <text class="stat-num">{{ spotTimeline.length }}</text>
          <text class="stat-label">景点游览</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{ questionCount }}</text>
          <text class="stat-label">提问互动</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{ messageCount }}</text>
          <text class="stat-label">对话总数</text>
        </view>
      </view>

      <!-- 游览时间轴 -->
      <view class="section">
        <view class="section-head"><view class="sh-dot"></view><text>游览路线</text></view>
        <view class="timeline">
          <view v-for="(s, i) in spotTimeline" :key="i" class="tl-item" :class="{last: i === spotTimeline.length - 1}">
            <view class="tl-marker">
              <view class="tl-dot" :class="{visited: i <= currentSpotIdx}">
                <text v-if="i <= currentSpotIdx" class="tl-check">✓</text>
                <text v-else class="tl-num">{{ i + 1 }}</text>
              </view>
              <view class="tl-line" v-if="i < spotTimeline.length - 1"></view>
            </view>
            <view class="tl-body">
              <view class="tl-card">
                <image v-if="s.image_path" :src="fixImg(s.image_path)" class="tl-img" mode="aspectFill"></image>
                <view v-else class="tl-img-df"></view>
                <view class="tl-info">
                  <text class="tl-name">{{ s.spot_name }}</text>
                  <text class="tl-cat" v-if="s.category">{{ s.category }} · 约{{ s.visit_duration || 20 }}分钟</text>
                  <text class="tl-desc" v-if="s.description">{{ s.description.substring(0, 50) }}...</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 知识亮点 -->
      <view class="section" v-if="highlights.length > 0">
        <view class="section-head"><view class="sh-dot"></view><text>导览知识亮点</text></view>
        <view class="highlight-list">
          <view v-for="(h, i) in highlights" :key="i" class="hl-card">
            <view class="hl-q" v-if="h.question">
              <text class="hl-q-icon">Q</text>
              <text class="hl-q-text">{{ h.question }}</text>
            </view>
            <view class="hl-a">
              <text class="hl-a-icon">A</text>
              <text class="hl-a-text">{{ h.answer }}</text>
            </view>
            <view class="hl-sentiment" v-if="h.sentiment">

              <text class="hl-mood">{{ h.sentiment }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- AI总结 -->
      <view class="section" v-if="aiSummary">
        <view class="section-head"><view class="sh-dot"></view><text>AI 导览总结</text></view>
        <view class="ai-summary-card">

          <text class="as-text">{{ aiSummary }}</text>
        </view>
      </view>

      <!-- 偏好回顾 -->
      <view class="section" v-if="preferences.length > 0">
        <view class="section-head"><view class="sh-dot"></view><text>本次偏好</text></view>
        <view class="pref-tags">
          <view v-for="p in preferences" :key="p" class="pref-tag">
            <text>{{ p }}</text>
          </view>
        </view>
      </view>

      <!-- 知识问答打卡 -->
      <view class="section" v-if="quizQuestions.length > 0">
        <view class="section-head"><view class="sh-dot"></view><text>知识问答打卡</text></view>
        <view class="quiz-wrap">
          <view v-for="(q, qi) in quizQuestions" :key="qi" class="quiz-card">
            <view class="quiz-q-row">
              <text class="quiz-q-num">{{ qi + 1 }}</text>
              <text class="quiz-q-text">{{ q.question }}</text>
            </view>
            <view class="quiz-options">
              <view v-for="(opt, oi) in q.options" :key="oi" class="quiz-opt"
                :class="{
                  selected: quizAnswers[qi] === oi,
                  correct: quizChecked && oi === q.answer,
                  wrong: quizChecked && quizAnswers[qi] === oi && oi !== q.answer
                }"
                @tap="selectQuiz(qi, oi)">
                <text class="quiz-opt-letter">{{ String.fromCharCode(65 + oi) }}</text>
                <text class="quiz-opt-text">{{ opt }}</text>
              </view>
            </view>
            <view class="quiz-explain" v-if="quizChecked">
              <text class="qe-text">{{ q.explanation }}</text>
            </view>
          </view>
          <view class="quiz-result" v-if="quizChecked">



            <text class="qr-text">答对 {{ quizScore }}/{{ quizQuestions.length }} 题</text>
            <text class="qr-badge" v-if="quizScore === quizQuestions.length">景区达人</text>
            <text class="qr-badge" v-else-if="quizScore > 0">继续努力</text>
          </view>
          <view class="quiz-submit" v-if="!quizChecked && quizQuestions.length > 0" @tap="checkQuiz">
            <text>提交答案</text>
          </view>
        </view>
      </view>

      <view style="height:140rpx"></view>
    </scroll-view>

    <!-- 加载 -->
    <view class="loading-wrap" v-if="loading">
      <view class="loading-pulse"><view class="lp-ring"></view><view class="lp-ring2"></view></view>
      <text class="loading-text">生成游览回顾…</text>
    </view>

    <!-- 底部操作栏 -->
    <view class="action-bar" v-if="!loading && sessionData">
      <view class="ab-btn secondary" @tap="goHome">返回首页</view>
      <view class="ab-btn primary" @tap="shareTour">分享游记</view>
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
        else reject(new Error('HTTP ' + res.statusCode))
      },
      fail: reject
    })
  })
}

var PREF_LABELS = {
  history: '历史文化', nature: '自然风光', photography: '摄影打卡',
  family: '亲子体验', comprehensive: '综合游览'
}

export default {
  data: function() {
    return {
      statusH: 20, loading: true, sid: 0,
      sessionData: null, conversation: [], spots: [],
      currentSpotIdx: 0, aiSummary: '', preferences: [],
      quizQuestions: [], quizAnswers: {}, quizChecked: false, quizScore: 0,
    }
  },
  computed: {
    guideName: function() {
      var g = this.sessionData && this.sessionData.guide_info
      return g ? g.name : 'AI导游'
    },
    heroImg: function() {
      var s = this.spots && this.spots[0]
      return s && s.image_path ? this.fixImg(s.image_path) : ''
    },
    tourDate: function() {
      var st = this.sessionData && this.sessionData.status
      if (!st || !st.start_time) return ''
      try {
        var d = new Date(st.start_time)
        return (d.getMonth()+1) + '月' + d.getDate() + '日'
      } catch(e) { return '' }
    },
    totalDuration: function() {
      var st = this.sessionData && this.sessionData.status
      if (!st || !st.start_time) return 0
      var start = new Date(st.start_time).getTime()
      var end = st.end_time ? new Date(st.end_time).getTime() : Date.now()
      return Math.round((end - start) / 60000)
    },
    spotTimeline: function() {
      return this.spots
    },
    questionCount: function() {
      return this.conversation.filter(function(m) { return m.role === 'user' }).length
    },
    messageCount: function() {
      return this.conversation.length
    },
    highlights: function() {
      var guideMsgs = this.conversation.filter(function(m) { return m.role === 'guide' && m.message && m.message.length > 40 })
      var paired = []
      for (var i = 0; i < guideMsgs.length && paired.length < 5; i++) {
        var msg = guideMsgs[i]
        var qIdx = -1
        for (var j = this.conversation.indexOf(msg) - 1; j >= 0; j--) {
          if (this.conversation[j].role === 'user') { qIdx = j; break }
        }
        paired.push({
          question: qIdx >= 0 ? this.conversation[qIdx].message : '',
          answer: msg.message.length > 120 ? msg.message.substring(0, 120) + '...' : msg.message,
          sentiment: msg.emotion_label || '',
        })
      }
      return paired
    },
  },
  methods: {
    fixImg: function(u) { if (!u) return ''; return assetUrl(u) },
    goHome: function() {
      uni.reLaunch({ url: '/pages/tour-guide/tour-guide' })
    },
    shareTour: function() {
      var spots = this.spots.map(function(s) { return s.spot_name }).join('、')
      var text = '我刚用AI数字人导览了' + (this.sessionData.name || '景区') + '，游览了' + this.spots.length + '个景点：' + spots + '，总共' + this.totalDuration + '分钟！'
      uni.setClipboardData({
        data: text,
        success: function() { uni.showToast({ title: '游记已复制，去分享吧', icon: 'none' }) },
      })
    },
    loadData: function() {
      var self = this
      self.loading = true
      request({ url: '/tour-session/live-info/' + self.sid }).then(function(res) {
        var d = res.data && res.data.data
        if (!d) { self.loading = false; return }
        self.sessionData = d
        self.conversation = d.conversation || []
        var prefs = {}
        try { prefs = JSON.parse(d.visitor_preferences || '{}') } catch(e) {}
        var spotIds = prefs.spot_ids || []
        var prefList = prefs.preferences || []
        self.preferences = prefList.map(function(p) { return PREF_LABELS[p] || p })
        var st = d.status || {}
        self.currentSpotIdx = st.current_spot_index || 0
        if (spotIds.length) {
          request({ url: '/tour-session/spots' }).then(function(sr) {
            var allSpots = sr.data && sr.data.data && sr.data.data.spot_list ? sr.data.data.spot_list : []
            self.spots = spotIds.map(function(id) { return allSpots.find(function(s) { return s.spot_id === id }) }).filter(Boolean)
            self.loading = false
            self.tryAISummary()
          }).catch(function() { self.loading = false })
        } else {
          self.loading = false
        }
      }).catch(function() {
        self.loading = false
        uni.showToast({ title: '加载失败', icon: 'none' })
      })
    },
    tryAISummary: function() {
      var self = this
      if (self.conversation.length < 2) return
      request({ url: '/tour-session/analyze/' + self.sid, method: 'POST', timeout: 30000 }).then(function(res) {
        var d = res.data && res.data.data
        if (d && d.summary) self.aiSummary = d.summary
      }).catch(function() {})
      request({ url: '/tour-session/quiz/' + self.sid, method: 'POST', timeout: 30000 }).then(function(res) {
        var d = res.data && res.data.data
        if (d && d.questions && d.questions.length) self.quizQuestions = d.questions
      }).catch(function() {})
    },
    selectQuiz: function(qi, oi) {
      if (this.quizChecked) return
      var ans = JSON.parse(JSON.stringify(this.quizAnswers))
      ans[qi] = oi
      this.quizAnswers = ans
    },
    checkQuiz: function() {
      var score = 0
      for (var i = 0; i < this.quizQuestions.length; i++) {
        if (this.quizAnswers[i] === this.quizQuestions[i].answer) score++
      }
      this.quizScore = score
      this.quizChecked = true
    },
  },
  onLoad: function(opts) {
    var s = uni.getSystemInfoSync()
    this.statusH = (s.statusBarHeight || 20) + 6
    this.sid = Number(opts.sessionId || 0)
    if (!this.sid) { uni.showToast({ title: '参数无效', icon: 'none' }); return }
    this.loadData()
  },
}
</script>

<style scoped>
.page{height:100vh;display:flex;flex-direction:column;background:var(--ng-surface);position:relative;overflow:hidden}
.ink-bg{position:absolute;inset:0;pointer-events:none;z-index:0}
.ink-mt{position:absolute;left:0;right:0;background:var(--ng-night);border-radius:55% 75% 0 0}
.ink-mt-1{bottom:18%;height:200rpx;opacity:.04;transform:scaleX(1.3)}
.ink-mt-2{bottom:22%;height:140rpx;opacity:.025;transform:scaleX(1.5) translateX(-8%)}

.nav{position:relative;z-index:1;display:flex;align-items:center;padding:4rpx 20rpx;gap:12rpx}
.nav-back{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.15);font-size:40rpx;color:var(--ng-secondary);flex-shrink:0}
.nav-title{flex:1;font-size:36rpx;font-weight:600;color:var(--ng-text);text-align:center}
.nav-share{width:56rpx;height:56rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.15);flex-shrink:0}
.nav-share .iconfont{font-size:32rpx;color:var(--ng-secondary)}

.main{position:relative;z-index:1;flex:1;min-height:0}

/* 游记封面 */
.hero{position:relative;height:360rpx;background-size:cover;background-position:center;margin:8rpx 16rpx;border-radius:20rpx;overflow:hidden;display:flex;align-items:flex-end}
.hero-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.6) 100%)}
.hero-content{position:relative;z-index:1;padding:24rpx}
.hero-title{font-size:40rpx;font-weight:700;color:#fff;display:block;text-shadow:0 2rpx 8rpx rgba(0,0,0,.4)}
.hero-meta{display:flex;gap:24rpx;margin-top:12rpx}
.hm-item{display:flex;align-items:center;gap:6rpx}
.hm-icon{font-size:26rpx;color:#1f2937}
.hm-text{font-size:24rpx;color:#1f2937}
.hero-badge{display:inline-flex;align-items:baseline;gap:4rpx;margin-top:16rpx;padding:8rpx 20rpx;border-radius:20rpx;background:rgba(99,102,241,0.25);backdrop-filter: none}
.hb-num{font-size:36rpx;font-weight:700;color:#fff}
.hb-unit{font-size:22rpx;color:#4b5563}

/* 统计 */
.stats-row{display:flex;gap:12rpx;padding:8rpx 16rpx}
.stat-card{flex:1;display:flex;flex-direction:column;align-items:center;padding:16rpx 0;background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:14rpx}
.stat-num{font-size:44rpx;font-weight:700;color:var(--ng-text)}
.stat-label{font-size:22rpx;color:var(--ng-secondary);margin-top:4rpx}

/* 通用 section */
.section{padding:16rpx 16rpx 0}
.section-head{display:flex;align-items:center;gap:10rpx;margin-bottom:12rpx}
.sh-dot{width:8rpx;height:8rpx;border-radius:50%;background:rgba(99,102,241,0.25)}
.section-head text{font-size:30rpx;font-weight:600;color:var(--ng-text)}

/* 时间轴 */
.timeline{padding-left:4rpx}
.tl-item{display:flex;gap:16rpx;padding-bottom:8rpx}
.tl-marker{display:flex;flex-direction:column;align-items:center;flex-shrink:0}
.tl-dot{width:36rpx;height:36rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ng-surface);border:2rpx solid var(--ng-border);z-index:1}
.tl-dot.visited{border-color:rgba(99,102,241,0.25);background:rgba(99,102,241,0.15)}
.tl-check{font-size:20rpx;color:var(--ng-secondary);font-weight:700}
.tl-num{font-size:20rpx;color:var(--ng-secondary)}
.tl-line{width:2rpx;flex:1;background:var(--ng-border);margin-top:4rpx;min-height:40rpx}
.tl-body{flex:1;padding-bottom:16rpx}
.tl-card{display:flex;gap:12rpx;padding:12rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:14rpx}
.tl-img{width:88rpx;height:88rpx;border-radius:10rpx;flex-shrink:0}
.tl-img-df{width:88rpx;height:88rpx;border-radius:10rpx;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.08);font-size:40rpx;flex-shrink:0}
.tl-info{flex:1;min-width:0}
.tl-name{font-size:28rpx;font-weight:600;color:var(--ng-text);display:block}
.tl-cat{font-size:20rpx;color:var(--ng-secondary);display:block;margin-top:4rpx}
.tl-desc{font-size:22rpx;color:var(--ng-secondary);display:block;margin-top:6rpx;line-height:1.5}

/* 知识亮点 */
.highlight-list{display:flex;flex-direction:column;gap:12rpx}
.hl-card{padding:16rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:14rpx}
.hl-q{display:flex;align-items:flex-start;gap:10rpx;margin-bottom:10rpx}
.hl-q-icon{width:32rpx;height:32rpx;border-radius:8rpx;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:20rpx;color:var(--ng-text);flex-shrink:0}
.hl-q-text{font-size:24rpx;color:var(--ng-text);line-height:1.5;flex:1}
.hl-a{display:flex;align-items:flex-start;gap:10rpx}
.hl-a-icon{width:32rpx;height:32rpx;border-radius:8rpx;background:rgba(59,91,255,.12);display:flex;align-items:center;justify-content:center;font-size:20rpx;color:var(--ng-secondary);flex-shrink:0}
.hl-a-text{font-size:24rpx;color:var(--ng-secondary);line-height:1.7;flex:1}
.hl-sentiment{display:flex;align-items:center;gap:6rpx;margin-top:8rpx}
.hl-emoji{font-size:24rpx}
.hl-mood{font-size:20rpx;color:var(--ng-secondary)}

/* AI总结 */
.ai-summary-card{display:flex;gap:12rpx;padding:16rpx;background:rgba(99,102,241,0.06);border:1rpx solid rgba(99,102,241,0.2);border-radius:14rpx}
.as-icon{font-size:32rpx;flex-shrink:0}
.as-text{font-size:26rpx;color:var(--ng-text);line-height:1.7;flex:1}

/* 偏好 */
.pref-tags{display:flex;flex-wrap:wrap;gap:12rpx}
.pref-tag{padding:8rpx 20rpx;border-radius:20rpx;background:rgba(99,102,241,0.1);font-size:24rpx;color:var(--ng-text)}

/* 知识问答 */
.quiz-wrap{display:flex;flex-direction:column;gap:16rpx}
.quiz-card{padding:16rpx;background:var(--ng-surface);border:1rpx solid var(--ng-border);border-radius:14rpx}
.quiz-q-row{display:flex;align-items:flex-start;gap:10rpx;margin-bottom:12rpx}
.quiz-q-num{width:32rpx;height:32rpx;border-radius:8rpx;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:20rpx;color:var(--ng-text);flex-shrink:0;font-weight:700}
.quiz-q-text{font-size:26rpx;color:var(--ng-text);line-height:1.5;flex:1}
.quiz-options{display:flex;flex-direction:column;gap:8rpx}
.quiz-opt{display:flex;align-items:center;gap:10rpx;padding:12rpx 14rpx;border-radius:10rpx;border:1rpx solid var(--ng-border);background:var(--ng-surface)}
.quiz-opt.selected{border-color:rgba(99,102,241,0.25);background:rgba(99,102,241,0.06)}
.quiz-opt.correct{border-color:rgba(76,175,80,.5);background:rgba(76,175,80,.08)}
.quiz-opt.wrong{border-color:rgba(244,67,54,.4);background:rgba(244,67,54,.06)}
.quiz-opt-letter{width:28rpx;height:28rpx;border-radius:50%;background:rgba(99,102,241,0.08);display:flex;align-items:center;justify-content:center;font-size:18rpx;color:var(--ng-secondary);flex-shrink:0}
.quiz-opt.correct .quiz-opt-letter{background:rgba(76,175,80,.2);color:#4CAF50}
.quiz-opt.wrong .quiz-opt-letter{background:rgba(244,67,54,.2);color:#F44336}
.quiz-opt-text{font-size:24rpx;color:var(--ng-text);flex:1}
.quiz-explain{margin-top:10rpx;padding:10rpx 12rpx;border-radius:8rpx;background:rgba(59,91,255,.06)}
.qe-text{font-size:22rpx;color:var(--ng-secondary);line-height:1.5}
.quiz-result{display:flex;align-items:center;justify-content:center;gap:12rpx;padding:20rpx;flex-direction:column}
.qr-emoji{font-size:48rpx}
.qr-text{font-size:28rpx;color:var(--ng-text);font-weight:600}
.qr-badge{padding:6rpx 24rpx;border-radius:20rpx;background:rgba(99,102,241,0.15);font-size:24rpx;color:var(--ng-text);font-weight:600}
.quiz-submit{height:80rpx;line-height:80rpx;text-align:center;border-radius:40rpx;background:linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.15));color:var(--ng-text);font-size:28rpx;font-weight:600;margin-top:8rpx}

/* 加载 */
.loading-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center}
.loading-pulse{position:relative;width:80rpx;height:80rpx;margin-bottom:20rpx}
.lp-ring{position:absolute;inset:0;border-radius:50%;border:4rpx solid rgba(99,102,241,0.15);border-top-color:rgba(99,102,241,0.25);animation:spin 1s linear infinite}
.lp-ring2{position:absolute;inset:12rpx;border-radius:50%;border:3rpx solid rgba(59,91,255,.1);border-top-color:rgba(59,91,255,.4);animation:spin 1.5s linear infinite reverse}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-text{font-size:26rpx;color:var(--ng-secondary)}

/* 底部操作 */
.action-bar{position:relative;z-index:1;flex-shrink:0;display:flex;gap:16rpx;padding:16rpx 20rpx;border-top:1rpx solid var(--ng-border);background:var(--ng-surface)}
.ab-btn{flex:1;height:80rpx;line-height:80rpx;text-align:center;border-radius:40rpx;font-size:28rpx;font-weight:600}
.ab-btn.secondary{background:var(--ng-surface);border:1rpx solid var(--ng-border);color:var(--ng-text)}
.ab-btn.primary{background:linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.15));color:var(--ng-text)}
</style>
