<template>
  <view class="dock" :style="dockStyle">
    <view class="dock-inner">
      <view class="dock-pill" :style="pillStyle"></view>
      <view v-for="(tab, i) in tabs" :key="tab.key" class="dock-item" :class="{ on: current === i }" @tap="pick(i)">
        <text class="dock-icon iconfont" :class="tab.icon" :style="iconStyle(i)"></text>
        <view class="dock-label-wrap">
          <text class="dock-label" :style="labelStyle(i)">{{ t(tab.label) }}</text>
          <text class="dock-label dock-label-bold" :style="boldStyle(i)" aria-hidden="true">{{ t(tab.label) }}</text>
        </view>
      </view>
    </view>
    <view class="dock-safe"></view>
  </view>
</template>
<script>
const MUTED = [75, 85, 99]
const INK = [31, 41, 55]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
export default {
  name: 'TabDock',
  props: {
    current: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
    aiHidden: { type: Boolean, default: false },
  },
  emits: ['select'],
  data() {
    return {
      trail: 0,
      loop: null,
      tabs: [
        { key: 'tour', icon: 'icon-daolan', label: '智能导览' },
        { key: 'ai', icon: 'icon-aishuziren', label: 'AI小导游' },
        { key: 'mine', icon: 'icon-wode1', label: '我的' },
      ],
    }
  },
  watch: {
    progress: {
      immediate: true,
      handler() { this.startTrail() },
    },
  },
  beforeUnmount() { this.stopTrail() },
  computed: {
    p() { return clamp(this.progress, -0.15, 2.15) },
    // 滑动页面时 Tab 栏保持不动：只在切换发生时瞬切（AI 页没有 Tab），不跟着页面上下收放。
    hideAmount() { return this.aiHidden || this.hidden ? 1 : 0 },
    dockStyle() {
      const h = clamp(this.hideAmount, 0, 1)
      return {
        transform: 'translate3d(0,' + (h * 108) + '%,0) scale(' + (1 - 0.06 * h) + ')',
        opacity: String(1 - 0.66 * h),
        pointerEvents: h > 0.5 ? 'none' : 'auto',
      }
    },
    pillStyle() {
      const p = clamp(this.progress, 0, 2)
      const lo = Math.min(this.trail, p)
      const hi = Math.max(this.trail, p)
      const stretch = clamp(hi - lo, 0, 1)
      const squash = 1 - Math.min(0.34, stretch * 0.5)
      const bulge = Math.min(6, stretch * 14)
      return {
        left: (lo * 33.3333 + 2 - bulge / 2) + '%',
        width: ((hi - lo) * 33.3333 + 29.3333 + bulge) + '%',
        transform: 'scaleY(' + squash.toFixed(3) + ')',
      }
    },
  },
  methods: {
    pick(i) { if (i !== this.current) this.$emit('select', i) },
    focus(i) { return clamp(1 - Math.abs(clamp(this.progress, 0, 2) - i), 0, 1) },
    smooth(from, to, v) {
      const x = clamp((v - from) / (to - from), 0, 1)
      return x * x * (3 - 2 * x)
    },
    color(i) {
      const focus = this.focus(i)
      const rgb = MUTED.map((c, k) => Math.round(c + (INK[k] - c) * focus))
      return 'rgb(' + rgb.join(',') + ')'
    },
    labelStyle(i) { return { color: this.color(i) } },
    boldStyle(i) { return { opacity: this.focus(i).toFixed(3) } },
    iconStyle(i) {
      const focus = this.focus(i)
      return { color: this.color(i), transform: 'translateY(' + (-1.6 * focus).toFixed(2) + 'px) scale(' + (1 + 0.07 * focus).toFixed(3) + ')' }
    },
    startTrail() {
      if (this.loop) return
      const step = () => {
        const target = clamp(this.progress, -0.05, 2.05)
        const gap = target - this.trail
        if (Math.abs(gap) < 0.0015) { this.trail = target; this.loop = null; return }
        this.trail += gap * 0.32
        this.loop = setTimeout(step, 16)
      }
      this.loop = setTimeout(step, 0)
    },
    stopTrail() { if (this.loop) { clearTimeout(this.loop); this.loop = null } },
  },
}
</script>
<style scoped>
.dock{position:fixed;bottom:0;left:0;right:0;z-index:999;background:var(--ng-surface);border-top:1rpx solid var(--ng-border);will-change:transform,opacity;transform-origin:50% 100%}
.dock-inner{position:relative;display:flex;align-items:stretch;padding:6px;min-height:64px;box-sizing:border-box}
.dock-pill{position:absolute;top:7px;bottom:7px;border-radius:30px;background:var(--ng-raised);pointer-events:none;will-change:left,width,transform;transform-origin:50% 50%}
.dock-item{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50px;gap:3px;padding:0;background:transparent}
.dock-icon{font-size:26px;line-height:1.15;will-change:transform,color}
.dock-label-wrap{position:relative;width:100%;height:18px;display:flex;align-items:center;justify-content:center}
.dock-label{display:block;font-size:13px;line-height:1.3;white-space:nowrap;letter-spacing:0;text-align:center}
.dock-label-bold{position:absolute;left:0;right:0;top:0;display:block;text-align:center;font-weight:700;color:var(--ng-text)}
.dock-safe{height:env(safe-area-inset-bottom);min-height:0}
</style>
