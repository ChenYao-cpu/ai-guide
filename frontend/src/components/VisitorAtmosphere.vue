<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'

const root = ref<HTMLElement>()
const paused = ref(false)
let media: gsap.MatchMedia | undefined
let context: gsap.Context | undefined
let drift: gsap.core.Timeline | undefined

function syncVisibility() {
  paused.value = document.hidden
  drift?.paused(document.hidden)
}

onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  context = gsap.context(() => {
    media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      drift = gsap
        .timeline({ repeat: -1, yoyo: true, defaults: { duration: 12, ease: 'sine.inOut' } })
        .to('.terrain-left', { x: 18, y: -12 }, 0)
        .to('.terrain-right', { x: -16, y: 14 }, 0)
        .to('.terrain-water', { x: 24 }, 0)
      syncVisibility()
      return () => {
        drift = undefined
      }
    })
  }, root.value)
  document.addEventListener('visibilitychange', syncVisibility)
  syncVisibility()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncVisibility)
  media?.revert()
  context?.revert()
})
</script>

<template>
  <div ref="root" class="visitor-atmosphere" :class="{ paused }" aria-hidden="true">
    <svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" fill="none">
      <g class="terrain-left" stroke="#b4add8" stroke-width="1">
        <path d="M-190 425Q-80 290 60 362T295 239T390 240" />
        <path d="M-190 451Q-73 309 76 388T309 261T406 262" />
        <path d="M-185 478Q-58 332 90 414T324 288T420 286" />
        <path d="M-180 506Q-41 356 111 441T339 314T432 311" />
      </g>
      <g class="terrain-right" stroke="#a8c7cb" stroke-width="1">
        <path d="M1535 416Q1440 359 1352 453T1159 474T1086 542" />
        <path d="M1555 451Q1460 386 1373 478T1183 500T1101 568" />
        <path d="M1575 486Q1480 412 1394 503T1207 526T1116 594" />
        <path d="M1595 521Q1500 438 1415 528T1231 552T1131 620" />
      </g>
      <g class="terrain-water" stroke="#acbfd0" stroke-width="1">
        <path d="M-110 845Q165 791 426 847T950 835T1510 852" />
        <path d="M-110 874Q165 820 426 876T950 864T1510 881" />
        <path d="M-110 903Q165 849 426 905T950 893T1510 910" />
      </g>
      <path
        class="terrain-light"
        pathLength="1200"
        stroke="#a79ccf"
        stroke-width="2"
        stroke-linecap="round"
        d="M-190 451Q-73 309 76 388T309 261T406 262"
      />
    </svg>
  </div>
</template>

<style scoped>
.visitor-atmosphere {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  background: radial-gradient(ellipse at 0% 0%, #e5e0f4 0, transparent 48%),
    radial-gradient(ellipse at 100% 54%, #e3eff1 0, transparent 46%),
    linear-gradient(135deg, #f3f2f9, #f2f6f8 55%, #eff6f4);
}
svg {
  width: 100%;
  height: 100%;
  opacity: 0.45;
}
.terrain-light {
  stroke-dasharray: 65 1135;
  animation: terrain-light-travel 16s linear infinite;
}
.paused .terrain-light {
  animation-play-state: paused;
}
@keyframes terrain-light-travel {
  to {
    stroke-dashoffset: -1200;
  }
}
@media (max-width: 600px) {
  svg {
    opacity: 0.2;
  }
}
@media (prefers-reduced-motion: reduce) {
  .terrain-light {
    display: none;
  }
}
</style>
