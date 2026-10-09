<template>
  <div
    ref="containerRef"
    class="live2d-container"
    :style="{ width: width + 'px', height: height + 'px' }"
  />
</template>

<script setup lang="ts">
/**
 * Live2DGuide — 景区导游数字人（纯 Motion 驱动版）
 *
 * 核心原则：所有身体动画由模型 .motion3.json 文件驱动
 * 程序化只做：唇形同步、眨眼、呼吸、头部追随鼠标
 * 绝不手动写 PartOpacity 或手臂/身体参数 —— 避免与 motion 冲突产生"4只手"
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    audioElement?: HTMLAudioElement | null
    modelPath?: string
    width?: number; height?: number
    emotion?: string; speaking?: boolean; autoIdle?: boolean
  }>(),
  {
    width: 420, height: 600,
    modelPath: '/live2d/haru_official/Haru.model3.json',
    emotion: 'neutral', speaking: false, autoIdle: true,
  },
)

const EMOTION_MAP: Record<string, string[]> = {
  happy: ['f01', 'Smile'], sad: ['f04', 'Sad'],
  surprised: ['f06', 'Surprised'], angry: ['f05', 'Angry'],
  shy: ['f03', 'Blushing'], neutral: ['f00', 'Normal'],
}

// motion 组：只用 model3.json 里已有的组
const SPEAKING_GROUPS = [
  'Gesture_Wave', 'Gesture_Point', 'Gesture_Explain',
  'Gesture_Welcome', 'Gesture_React', 'Gesture_Emote', 'TapBody',
]
const IDLE_GROUPS = ['Idle']
const INTERACT_GROUPS = ['TapBody', 'Gesture_React', 'Gesture_Emote']

// ═════════════ 核心 ══
const containerRef = ref<HTMLDivElement | null>(null)
let app: any = null; let model: any = null; let cm: any = null
let audioCtx: AudioContext | null = null; let analyser: AnalyserNode | null = null
let mediaSource: MediaElementAudioSourceNode | null = null
let modelReady = false; let curEmotion = 'neutral'
let animTime = 0; let mouthT = 0; let mouthC = 0
let mTx = 0, mTy = 0, mCx = 0, mCy = 0

// Motion 调度 — 基于"播完即换"策略，不跟 priority 系统打架
let mode: 'idle' | 'speaking' | 'interaction' = 'idle'
let lastGroup = ''; let lastIdx = -1
let motionPlaying = false

function pickGroup(pool: string[]): string {
  const c = pool.length > 1 ? pool.filter(g => g !== lastGroup) : pool
  return c[Math.floor(Math.random() * c.length)] || pool[0]
}

function playMotion(group: string): boolean {
  if (!model || !modelReady) return false
  const defs = model.internalModel?.motionManager?.definitions
  if (!defs || !defs[group]) return false
  const arr = defs[group]
  if (!arr || arr.length === 0) return false
  let idx = 0
  if (arr.length > 1) {
    do { idx = Math.floor(Math.random() * arr.length) }
    while (idx === lastIdx && arr.length > 1)
  }
  try {
    model.motion(group, idx, 2)  // NORMAL priority，不抢
    lastGroup = group; lastIdx = idx
    motionPlaying = true
    console.log('[Live2D] ▶', group, '[', idx, ']')
    return true
  } catch (e: any) {
    console.warn('[Live2D] motion 播放失败:', e.message)
    return false
  }
}

function scheduleMotion() {
  const pool = mode === 'speaking' ? SPEAKING_GROUPS
    : mode === 'interaction' ? INTERACT_GROUPS : IDLE_GROUPS
  playMotion(pickGroup(pool))
}

function enterSpeaking() { if (mode !== 'speaking') { mode = 'speaking'; scheduleMotion() } }
function enterIdle() { if (mode !== 'idle') { mode = 'idle'; scheduleMotion() } }

// ═════════════ 工具 ══
function sp(id: string, v: number) { try { cm.setParameterValueById(id, v) } catch {/*skip*/} }

function speechAmp(): number {
  if (!analyser) return 0
  const d = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(d)
  let ss = 0; for (let i = 0; i < d.length; i++) { const n = (d[i] - 128) / 128; ss += n * n }
  const r = Math.sqrt(ss / d.length)
  return r < 0.01 ? 0 : Math.min(1, Math.pow(r * 3.5, 0.7))
}

async function initAudio(el: HTMLAudioElement) {
  try {
    // 避免重复连接同一个 audio 元素
    if (mediaSource && mediaSource.mediaElement === el) {
      console.log('[Live2D] 音频已连接，跳过')
      return
    }
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    analyser?.disconnect()
    try { mediaSource?.disconnect() } catch {/* already disconnected */}
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.55
    analyser.minDecibels = -70; analyser.maxDecibels = -10
    mediaSource = audioCtx.createMediaElementSource(el)
    mediaSource.connect(analyser); analyser.connect(audioCtx.destination)
    console.log('[Live2D] ✅ 音频连接成功, AudioContext.state=', audioCtx.state)
  } catch (e: any) {
    console.warn('[Live2D] ❌ 音频连接失败:', e.message)
    // 如果是因为 audio 已有关联 source，重置后再试
    if (e.message?.includes('already') || e.message?.includes('AudioContext')) {
      audioCtx?.close().catch(() => {})
      audioCtx = null; analyser = null; mediaSource = null
    }
  }
}

function onMM(e: MouseEvent) {
  if (!containerRef.value) return
  const r = containerRef.value.getBoundingClientRect()
  mTx = ((e.clientX - r.left) / r.width) * 2 - 1
  mTy = ((e.clientY - r.top) / r.height) * 2 - 1
}
function onML() { mTx = 0; mTy = 0 }

// ═════════════ 加载 ══
async function loadModel() {
  const P = (window as any).PIXI; const LM = P?.live2d?.Live2DModel
  if (!containerRef.value || !LM) return
  if (!app) {
    app = new P.Application({
      width: props.width, height: props.height,
      backgroundAlpha: 0, antialias: true,
      resolution: window.devicePixelRatio || 1, autoDensity: true,
    })
    containerRef.value.appendChild(app.view as HTMLCanvasElement)
  }
  try {
    model = await LM.from(props.modelPath, { autoUpdate: false, autoHitTest: true, autoFocus: false })
    model.anchor.set(0.5, 0.5)
    model.scale.set(0.14)
    model.position.set(props.width / 2, props.height / 2)
    app.stage.addChild(model)

    const canvas = app.view as HTMLCanvasElement
    canvas.style.pointerEvents = 'auto'
    canvas.addEventListener('mousemove', onMM)
    canvas.addEventListener('mouseleave', onML)
    canvas.addEventListener('click', () => {
      const prev = mode; mode = 'interaction'
      playMotion(pickGroup(INTERACT_GROUPS))
      setTimeout(() => { if (mode === 'interaction') { mode = prev; scheduleMotion() } }, 2000)
    })

    cm = model.internalModel?.coreModel
    if (cm) {
      try { cm.setParameterValueById('ParamBreath', 0.5) } catch (e: any) { console.warn('[Live2D] 参数写入异常:', e.message) }
    }

    const defs = model.internalModel?.motionManager?.definitions
    if (defs) {
      const gs = Object.keys(defs)
      const t = gs.reduce((s: number, g: string) => s + (defs[g]?.length || 0), 0)
      console.log('[Live2D] Motion 组:', gs.map(g => `${g}(${defs[g]?.length})`).join(', '), `共${t}`)
    }

    modelReady = true
    if (props.audioElement) await initAudio(props.audioElement)
    if (props.autoIdle) { mode = 'idle'; scheduleMotion() }
    if (props.emotion && props.emotion !== 'neutral') setEmotion(props.emotion)
    console.log('[Live2D] ✅ 就绪（纯 motion 驱动，不碰手臂参数）')
  } catch (err) { console.error('[Live2D] 加载失败:', err) }
}

// ═════════════ 主循环 ══
function loop() {
  if (!model || !cm) return
  const dt = Math.min(app.ticker.deltaMS / 1000, 0.1)
  animTime += dt

  // ── 0. 模型更新（motion 播放 + 物理模拟）──
  model.update(dt)

  // ── 1. Motion 调度：检测当前 motion 播完就立刻换下一个 ──
  if (motionPlaying && mode !== 'interaction') {
    try {
      const mm = model.internalModel?.motionManager
      if (mm && mm.isFinished()) {
        motionPlaying = false
        scheduleMotion()
      }
    } catch { /* fallback: timer */ }
  }

  // ── 2. 头部（讲解时微转向右方对话框，模拟"指引观看"）──
  {
    const sf = Math.min(dt * 3.5, 1)
    mCx += (mTx - mCx) * sf; mCy += (mTy - mCy) * sf
    // 讲解时：头微微右转 + 身体微侧，像在引导游客看对话框
    const guideBias = mode === 'speaking' ? 0.35 : 0  // 35% 偏向右侧
    const lookTargetX = mCx * (1 - guideBias) + guideBias * 0.5  // 混合鼠标 + 右侧偏向
    sp('ParamAngleY', lookTargetX * 15)
    sp('ParamAngleX', mCy * -6)
    sp('ParamBodyAngleY', lookTargetX * 6)
    sp('ParamEyeBallX', lookTargetX * 0.25 + Math.sin(animTime * 0.37 + 0.5) * 0.08)
    sp('ParamEyeBallY', mCy * -0.15 + Math.sin(animTime * 0.41 + 1.2) * 0.06)
  }

  // ── 3. 唇形同步 ──
  {
    const amp = speechAmp(); const sf = Math.min(dt * 14, 1)
    mouthT = amp; mouthC += (mouthT - mouthC) * sf
    sp('ParamMouthOpenY', mouthC * 1.4)
    if (mouthC > 0.02) {
      sp('ParamMouthForm', mouthC * 0.4 + Math.sin(animTime * 14 + Math.sin(animTime * 9) * 2) * mouthC * 0.35 + 0.05)
    } else { sp('ParamMouthForm', 0) }
  }

  // ── 4. 眨眼 ──
  {
    const bp = (animTime * 0.35) % 5; let eo: number
    if (bp < 0.08) eo = Math.max(0, 1 - bp / 0.08)
    else if (bp < 0.18) eo = Math.min(1, (bp - 0.08) / 0.10)
    else eo = 1
    sp('ParamEyeLOpen', eo); sp('ParamEyeROpen', eo)
  }

  // ── 5. 呼吸 ──
  sp('ParamBreath', Math.sin(animTime * 1.3) * 0.25 + 0.5)

  // 注意：绝不写 ParamAngleX/Y/Z、ParamBodyAngleX/Y/Z、ParamArm*、PartOpacity
  // 这些全部交给 motion 文件控制，程序化写入会造成 4 只手
}

// ═════════════ 表情 / API ══
function setEmotion(e: string) {
  if (!model || !modelReady || e === curEmotion) return
  for (const n of EMOTION_MAP[e] || EMOTION_MAP['neutral']) {
    try { model.expression(n); curEmotion = e; return } catch { continue }
  }
}
function setExpression(id: string) { if (model && modelReady) try { model.expression(id) } catch {/*skip*/} }
function playMotionGroup(g: string, _priority = 2): boolean { return playMotion(g) }
function setSpeaking(v: boolean) { if (v) enterSpeaking(); else { mouthT = 0; mouthC = 0; enterIdle() } }
function resetToIdle() { setSpeaking(false); setEmotion('neutral'); mode = 'idle'; scheduleMotion() }
function triggerGesture() {
  const prev = mode; mode = 'interaction'
  playMotion(pickGroup(INTERACT_GROUPS))
  setTimeout(() => { if (mode === 'interaction') { mode = prev; scheduleMotion() } }, 2000)
}
defineExpose({ setExpression, playMotion: playMotionGroup, setSpeaking, resetToIdle, triggerGesture })

// ═════════════ Watchers ══
watch(() => props.audioElement, async el => { if (el && modelReady) await initAudio(el) })
watch(() => props.speaking, v => setSpeaking(v))
watch(() => props.emotion, e => { if (e) setEmotion(e) })
watch(() => props.modelPath, async p => {
  if (p && modelReady) {
    if (model) { app?.stage?.removeChild(model); model.destroy?.(); model = null }
    cm = null; modelReady = false; curEmotion = 'neutral'
    await nextTick(); await loadModel()
  }
})
onMounted(async () => { await nextTick(); await loadModel(); if (app) app.ticker.add(loop); window.addEventListener('resize', onResize) })
onBeforeUnmount(() => {
  analyser?.disconnect(); mediaSource?.disconnect()
  if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {})
  window.removeEventListener('resize', onResize)
  if (app) { app.ticker?.remove(loop); app.destroy?.(true, { children: true }) }
  app = null; model = null; cm = null
})
function onResize() {
  if (!app || !containerRef.value) return
  const w = containerRef.value.clientWidth, h = containerRef.value.clientHeight
  if (w > 0 && h > 0) { app.renderer.resize(w, h); if (model) model.position.set(w / 2, h / 2) }
}
</script>

<style scoped>
.live2d-container {
  overflow: hidden; border-radius: 12px;
  background: radial-gradient(ellipse at 50% 30%, #fafeff 0%, #dceef4 100%);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.live2d-container :deep(canvas) { display: block; }
</style>
