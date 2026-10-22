<template>
  <view class="tabs-shell" :class="{ 'dock-down': aiHidden }">
    <view class="pager-viewport" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
      <view class="pager-track" :style="trackStyle">
        <view class="panel-slot"><TourGuide ref="tour" /></view>
        <view class="panel-slot"><AiChat ref="ai" /></view>
        <view class="panel-slot"><Mine ref="mine" /></view>
      </view>
    </view>
    <TabDock :current="current" :progress="progress" :hidden="dockHidden" :ai-hidden="aiHidden" @select="selectTab" />
  </view>
</template>
<script>
import TourGuide from '../tour-guide/tour-guide.vue'
import AiChat from '../ai-chat/ai-chat.vue'
import Mine from '../mine/mine.vue'
import TabDock from '../../components/TabDock.vue'

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export default {
  components: { TourGuide, AiChat, Mine, TabDock },
  data() {
    return {
      current: 0,
      progress: 0,
      width: 375,
      panelReady: false,
      keyboardOpen: false,
      itineraryOpen: false,
      aiHidden: false,
      anim: null,
      dragging: false,
      startedAt: 0,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastAt: 0,
      velocity: 0,
      skipDrag: false,
    }
  },
  computed: {
    dockHidden() { return this.keyboardOpen || this.itineraryOpen },
    trackStyle() { return { transform: 'translate3d(' + (-this.progress * 100 / 3) + '%,0,0)' } },
  },
  onLoad(query) {
    const key = (query && query.tab) || 'tour'
    const index = ['tour', 'ai', 'mine'].indexOf(key)
    this.current = index < 0 ? 0 : index
    this.progress = this.current
    this.aiHidden = this.current === 1
    const info = uni.getSystemInfoSync()
    this.width = info.windowWidth || 375
    this._onKeyboard = event => { this.keyboardOpen = !!((event && event.height) > 0) }
    if (uni.onKeyboardHeightChange) uni.onKeyboardHeightChange(this._onKeyboard)
    this._onDockSync = payload => { if (payload && payload.source === 'tour') this.itineraryOpen = !!payload.hide }
    uni.$on('dock:sync', this._onDockSync)
    this._onTabsSelect = payload => {
      const tab = typeof payload === 'string' ? payload : (payload && payload.tab) || 'tour'
      const index = ['tour', 'ai', 'mine'].indexOf(tab)
      if (index >= 0) this.selectTab(index)
    }
    uni.$on('tabs:select', this._onTabsSelect)
  },
  mounted() {
    this.$nextTick(() => {
      for (let i = 0; i < 3; i++) this.callHook(i, 'onLoad', {})
      for (let i = 0; i < 3; i++) this.callHook(i, 'onReady')
      this.panelReady = true
      this.callHook(this.current, 'onShow')
    })
  },
  onShow() { if (this.panelReady) this.callHook(this.current, 'onShow') },
  onHide() { if (this.panelReady) this.callHook(this.current, 'onHide') },
  onUnload() {
    if (this.anim) { clearTimeout(this.anim); this.anim = null }
    for (let i = 0; i < 3; i++) this.callHook(i, 'onUnload')
    if (uni.offKeyboardHeightChange && this._onKeyboard) uni.offKeyboardHeightChange(this._onKeyboard)
    if (this._onDockSync) uni.$off('dock:sync', this._onDockSync)
    if (this._onTabsSelect) uni.$off('tabs:select', this._onTabsSelect)
  },
  onBackPress() { return this.callHook(this.current, 'onBackPress') },
  methods: {
    panel(index) { return [this.$refs.tour, this.$refs.ai, this.$refs.mine][index] || null },
    // 三个页面作为子组件渲染时，页面生命周期不会自动触发，这里手动转发给当前可见的页面。
    // Vue 3 会把同名自定义选项合并成数组，所以这里把函数/数组/对象三种形态都摊平。
    hookFns(raw, output) {
      if (!raw) return output
      if (typeof raw === 'function') { output.push(raw); return output }
      if (Array.isArray(raw)) { raw.forEach(item => this.hookFns(item, output)); return output }
      if (typeof raw === 'object') { Object.values(raw).forEach(item => this.hookFns(item, output)) }
      return output
    },
    callHook(index, hook, arg) {
      const vm = this.panel(index)
      if (!vm || !vm.$options) return undefined
      const fns = this.hookFns(vm.$options[hook], [])
      let result
      for (const fn of fns) {
        try {
          const value = fn.call(vm, arg)
          if (value !== undefined) result = value
        } catch (error) { console.error('[tabs] ' + hook + ' failed', error) }
      }
      return result
    },
    point(event) {
      const list = (event.touches && event.touches.length ? event.touches : null) || (event.changedTouches && event.changedTouches.length ? event.changedTouches : null)
      const touch = list ? list[0] : null
      if (!touch) return null
      const x = touch.clientX != null ? touch.clientX : touch.pageX
      const y = touch.clientY != null ? touch.clientY : touch.pageY
      if (x == null || y == null) return null
      return { x: Number(x), y: Number(y) }
    },
    onTouchStart(event) {
      this.cancelAnim()
      try { this.skipDrag = !!(event && event.target && event.target.closest && event.target.closest('.uni-swiper')) } catch (e) { this.skipDrag = false }
      this.startedAt = Date.now()
      this.lastAt = this.startedAt
      this.velocity = 0
      this.dragging = false
      this._hasPoint = false
      const point = this.point(event)
      if (point) {
        this._hasPoint = true
        this.startX = this.lastX = point.x
        this.startY = point.y
      }
    },
    onTouchMove(event) {
      if (this.skipDrag) return
      const point = this.point(event)
      if (!point) return
      const dx = point.x - this.startX
      const dy = point.y - this.startY
      if (!this.dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.15) return
        this.dragging = true
      }
      const now = Date.now()
      const elapsed = Math.max(1, now - this.lastAt)
      this.velocity = (point.x - this.lastX) / elapsed
      this.lastX = point.x
      this.lastAt = now
      // 手指向左（dx<0）进入下一页，所以进度是减去位移
      let next = this.current - dx / (this.width || 375)
      if (next < 0) next = next * 0.34
      if (next > 2) next = 2 + (next - 2) * 0.34
      this.progress = next
    },
    // 松手吸附：能拿到移动过程时按进度计算；拿不到 move 事件时（部分 App 壳会拦截页面水平手势）
    // 退回用起止位移 + 速度判断，保证左右滑仍然可用。
    onTouchEnd(event) {
      this.skipDrag = false
      const wasDragging = this.dragging
      this.dragging = false
      const point = this.point(event)
      const dx = point ? point.x - this.startX : 0
      const dy = point ? point.y - this.startY : 0
      const from = this.progress
      let target
      if (wasDragging) {
        if (Math.abs(this.velocity) > 0.42) target = this.velocity < 0 ? Math.ceil(from - 0.001) : Math.floor(from + 0.001)
        else target = Math.round(from)
      } else if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        target = this.current + (dx < 0 ? 1 : -1)
      } else {
        return
      }
      target = clamp(target, 0, 2)
      if (target === this.current && Math.abs(from - this.current) < 0.02) return
      this.settle(target, from)
    },
    settle(target, from) {
      const distance = Math.abs(target - from)
      const duration = clamp(240 + distance * 220, 240, 460)
      this.animateProgress(from, target, duration, 1.06)
      if (target !== this.current) {
        const previous = this.current
        this.callHook(previous, 'onHide')
        this.callHook(target, 'onShow')
        this.current = target
      }
      // Tab 栏只在切换发生时瞬切（AI 页没有 Tab），滑动过程中不再跟着页面上下移动。
      this.aiHidden = target === 1
    },
    selectTab(index) {
      if (index === this.current || this.dragging) return
      const from = this.current
      this.animateProgress(from, index, 420, 1.16)
      this.callHook(from, 'onHide')
      this.callHook(index, 'onShow')
      this.current = index
      this.aiHidden = index === 1
    },
    cancelAnim() {
      if (this.anim) { clearTimeout(this.anim); this.anim = null }
    },
    // 点标签或松手吸附：指示器和内容共用一个进度量，过冲量带来轻微回弹
    animateProgress(from, to, duration, overshoot) {
      this.cancelAnim()
      const started = Date.now()
      const c1 = overshoot || 1
      const ease = x => { const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }
      const step = () => {
        const t = Math.min(1, (Date.now() - started) / duration)
        let value = from + (to - from) * ease(t)
        if (value < 0) value = value * 0.34
        if (value > 2) value = 2 + (value - 2) * 0.34
        this.progress = value
        if (t < 1) { this.anim = setTimeout(step, 16); return }
        this.progress = to
        this.anim = null
      }
      this.anim = setTimeout(step, 0)
    },
  },
}
</script>
<style scoped>
.tabs-shell{width:100%;height:100vh;overflow:hidden;background:linear-gradient(135deg,#e5dcff 0%,#f8f9ff 52%,#dff4fb 100%)}
.pager-viewport{width:100%;height:100vh;overflow:hidden;touch-action:pan-y}
.pager-track{display:flex;width:300%;height:100%;will-change:transform}
.panel-slot{width:33.3333%;height:100%;overflow:hidden;flex-shrink:0;contain:layout}
</style>
<style>
/* 三个标签页共用 tabs-shell 上的一层渐变，避免各自的 fixed 光晕在分页轨道里错位 */
.panel-slot .aurora-background{display:none}
</style>
