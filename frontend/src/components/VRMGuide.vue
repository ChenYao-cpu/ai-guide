<template>
  <div ref="containerRef" class="vrm-container" :style="{ width: width + 'px', height: height + 'px' }" />
</template>

<script setup lang="ts">
/**
 * VRMGuide — 稳定版
 *
 * ✅ 自然站立（修正 T-pose）
 * ✅ 弹簧骨骼（头发/衣物物理，vrm.update 自动驱动）
 * ✅ 口型同步（自动探测表情名）
 * ✅ 自动眨眼
 * ✅ 面部表情（happy/sad/angry/surprised/relaxed）
 * ✅ 头部跟随鼠标
 * ✅ VRMA 动画文件加载（如有 .vrma 文件）
 *
 * 关于 VRMA 动画文件：
 *   走路、舞蹈、拨发等复杂动作需要用 .vrma 文件。
 *   代码只能做"自然站立 + 简单手势"，做不到预录动画的质量。
 *   获取 .vrma 的途径见文件末尾的说明。
 */

import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip, VRMAnimation } from '@pixiv/three-vrm-animation'

// ═══════════ Props ═══════════
const props = withDefaults(defineProps<{
  audioElement?: HTMLAudioElement | null; modelPath?: string
  width?: number; height?: number; framePadding?: number; emotion?: string; speaking?: boolean
}>(), {
  width: 420, height: 600, framePadding: 1.12, modelPath: '/models/西装女.vrm',
  emotion: 'neutral', speaking: false,
})

const containerRef = ref<HTMLDivElement | null>(null)

// ═══════════ Three.js ═══════════
let renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera
let lastTime = 0, animTime = 0
let vrm: VRM | null = null
let mixer: THREE.AnimationMixer | null = null
let vrmaAction: THREE.AnimationAction | null = null

// Audio
let audioCtx: AudioContext | null = null, analyser: AnalyserNode | null = null
let mediaSource: MediaElementAudioSourceNode | null = null
let mouthT = 0, mouthC = 0

// Mouse
let mTx = 0, mTy = 0

// Bones — 全部骨骼（包括腿，VRMA 播完后需要恢复）
let headB: THREE.Object3D | null = null, neckB: THREE.Object3D | null = null, spineB: THREE.Object3D | null = null
let lUA: THREE.Object3D | null = null, rUA: THREE.Object3D | null = null
let lLA: THREE.Object3D | null = null, rLA: THREE.Object3D | null = null
let lH: THREE.Object3D | null = null, rH: THREE.Object3D | null = null
let hipsB: THREE.Object3D | null = null
let lULeg: THREE.Object3D | null = null, rULeg: THREE.Object3D | null = null
let lLLeg: THREE.Object3D | null = null, rLLeg: THREE.Object3D | null = null
let lFoot: THREE.Object3D | null = null, rFoot: THREE.Object3D | null = null

// 表情
let supportedE: string[] = []
let mouthEName = '', blinkEName = ''
let curExpr = 'neutral', exprW = 0
const EXPR_MAP: Record<string,string> = { happy:'happy', sad:'sad', angry:'angry', surprised:'surprised', relaxed:'relaxed', neutral:'neutral' }

// ═══════════ 姿态：idle 基准 Euler 值 ═══════════
// 符号约定：左臂 Z+→放下  右臂 Z-→放下
const IDLE = {
  lUA: [ 0.06, 0.00,  1.38], lLA: [0.00, 0.00, -0.15], lH: [0.00, 0.00, 0.00],
  rUA: [ 0.06, 0.00, -1.38], rLA: [0.00, 0.00,  0.15], rH: [0.00, 0.00, 0.00],
  spine:[ 0.00, 0.00,  0.00], head:[0.00, 0.00,  0.00], neck:[0.00, 0.00, 0.00],
  hips:[ 0.00, 0.00,  0.00],
  lULeg:[0.00, 0.00,  0.00], lLLeg:[0.00, 0.00,  0.00], lFoot:[0.00, 0.00, 0.00],
  rULeg:[0.00, 0.00,  0.00], rLLeg:[0.00, 0.00,  0.00], rFoot:[0.00, 0.00, 0.00],
}

// ═══════════ VRMA 动画池 ═══════════
const IDLE_POOL = ['/animations/VRMA_01.vrma', '/animations/VRMA_02.vrma', '/animations/VRMA_06.vrma', '/animations/VRMA_03.vrma']
const TALK_POOL = ['/animations/VRMA_01.vrma', '/animations/VRMA_02.vrma', '/animations/VRMA_03.vrma', '/animations/VRMA_04.vrma', '/animations/VRMA_05.vrma', '/animations/VRMA_06.vrma']
let currentPool = IDLE_POOL
let vrmaCycling = false
let vrmaLoading = false
let vrmaCooldown = 0          // 动画结束→idle 过渡(秒)
let speaking = false

// 手势增量（VRMA 未激活时的 fallback，保留简单手势能力）
let curDelta: Record<string,[number,number,number]> = {}
let tgtDelta: Record<string,[number,number,number]> = {}
let gestureTimer = 0

let lastVRMAUrl = ''

/** 根据每个 VRM 的真实包围盒自动构图，避免不同身高模型出现头部被裁切。 */
function frameFullBody() {
  if (!vrm || !camera) return
  vrm.scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(vrm.scene)
  if (box.isEmpty()) return

  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const fitHeight = size.y / (2 * Math.tan(verticalFov / 2))
  const fitWidth = size.x / (2 * Math.tan(verticalFov / 2) * camera.aspect)
  const distance = Math.max(fitHeight, fitWidth) * props.framePadding
  const targetY = center.y + size.y * 0.015

  camera.position.set(center.x, targetY, box.max.z + distance)
  camera.near = Math.max(0.01, distance / 100)
  camera.far = Math.max(20, distance * 100)
  camera.lookAt(center.x, targetY, center.z)
  camera.updateProjectionMatrix()
}

/** 读取当前骨骼相对于 idle 的偏移量（淡出过渡用） */
function captureBoneOffsets(out: Record<string,[number,number,number]>) {
  const bones: Record<string, THREE.Object3D | null> = {
    lUA, lLA, lH, rUA, rLA, rH, spine: spineB, head: headB, neck: neckB,
    hips: hipsB, lULeg, lLLeg, lFoot, rULeg, rLLeg, rFoot,
  }
  for (const [k, bone] of Object.entries(bones)) {
    if (!bone) continue
    const idle = (IDLE as any)[k] as number[] | undefined
    if (!idle) continue
    out[k] = [
      bone.rotation.x - idle[0],
      bone.rotation.y - idle[1],
      bone.rotation.z - idle[2],
    ]
  }
}

/** 从当前池随机选一个 VRMA 播放（不与上一次重复） */
function pickNextVRMA() {
  if (!vrm || !mixer || vrmaLoading) return
  const pool = currentPool
  if (pool.length === 0) return
  const candidates = pool.length > 1 ? pool.filter(u => u !== lastVRMAUrl) : pool
  const url = candidates[Math.floor(Math.random() * candidates.length)]
  lastVRMAUrl = url
  vrmaCycling = true
  loadVRMA(url, false)
}

// ═══════════ 眨眼 ═══════════
let blinkNext = 0, blinkSt = 0, blinkTmr = 0
function blinkUpdate(dt: number): number {
  blinkNext -= dt
  if (blinkNext <= 0 && blinkSt === 0) { blinkSt = 1; blinkTmr = 0; blinkNext = 2 + Math.random() * 5 }
  blinkTmr += dt
  if (blinkSt === 1) { if (blinkTmr >= .06) { blinkSt = 2; blinkTmr = 0 } return Math.min(1, blinkTmr / .06) }
  if (blinkSt === 2) { if (blinkTmr >= .04) { blinkSt = 3; blinkTmr = 0 } return 1 }
  if (blinkSt === 3) { if (blinkTmr >= .08) { blinkSt = 0; blinkTmr = 0 } return 1 - Math.min(1, blinkTmr / .08) }
  return 0
}

// ═══════════ 口型 ═══════════
function speechAmp(): number {
  if (!analyser) return 0
  const d = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(d)
  let ss = 0; for (let i = 0; i < d.length; i++) { const n = (d[i] - 128) / 128; ss += n * n }
  const r = Math.sqrt(ss / d.length)
  return r < .008 ? 0 : Math.min(1, Math.pow(r * 3.5, .7))
}

// ═══════════ 鼠标 ═══════════
function onMM(e: MouseEvent) {
  const el = containerRef.value; if (!el) return
  const r = el.getBoundingClientRect()
  if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
    mTx = ((e.clientX - r.left) / r.width) * 2 - 1
    mTy = ((e.clientY - r.top) / r.height) * 2 - 1
  }
}
function onML() { mTx = 0; mTy = 0 }

// ═══════════ 模型加载 ═══════════
async function loadModel() {
  if (!containerRef.value) return
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(props.width, props.height); renderer.setClearColor(new THREE.Color(0x000000), 0)
  containerRef.value.appendChild(renderer.domElement)
  window.addEventListener('mousemove', onMM); window.addEventListener('mouseleave', onML)

  scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const l1 = new THREE.DirectionalLight(0xffffff, .7); l1.position.set(1, 2, 3); scene.add(l1)
  const l2 = new THREE.DirectionalLight(0xffffff, .35); l2.position.set(-1, 1, -1); scene.add(l2)
  const l3 = new THREE.DirectionalLight(0xffffff, .15); l3.position.set(0, -.5, 1); scene.add(l3)
  camera = new THREE.PerspectiveCamera(25, props.width / props.height, .1, 20)
  camera.position.set(0, 1.0, 4.8); camera.lookAt(0, .75, 0)
  lastTime = performance.now() / 1000

  try {
    const loader = new GLTFLoader(); loader.register((p: any) => new VRMLoaderPlugin(p))
    const gltf = await loader.loadAsync(props.modelPath)
    vrm = gltf.userData.vrm as VRM
    if (!vrm) { console.error('[VRM] ❌ 非VRM'); return }
    scene.add(vrm.scene)
    vrm.scene.traverse((o: any) => { o.frustumCulled = false })
    VRMUtils.rotateVRM0(vrm)
    mixer = new THREE.AnimationMixer(vrm.scene)

    const h = vrm.humanoid
    headB = h.getNormalizedBoneNode('head')!
    neckB = h.getNormalizedBoneNode('neck')!
    spineB = h.getNormalizedBoneNode('spine')!
    lUA = h.getNormalizedBoneNode('leftUpperArm')!
    lLA = h.getNormalizedBoneNode('leftLowerArm')!
    lH = h.getNormalizedBoneNode('leftHand')!
    rUA = h.getNormalizedBoneNode('rightUpperArm')!
    rLA = h.getNormalizedBoneNode('rightLowerArm')!
    rH = h.getNormalizedBoneNode('rightHand')!
    hipsB = h.getNormalizedBoneNode('hips')!
    lULeg = h.getNormalizedBoneNode('leftUpperLeg')!
    lLLeg = h.getNormalizedBoneNode('leftLowerLeg')!
    lFoot = h.getNormalizedBoneNode('leftFoot')!
    rULeg = h.getNormalizedBoneNode('rightUpperLeg')!
    rLLeg = h.getNormalizedBoneNode('rightLowerLeg')!
    rFoot = h.getNormalizedBoneNode('rightFoot')!

    // 探测表情
    if (vrm.expressionManager) {
      try {
        const m = (vrm.expressionManager as any).expressionMap
        if (m) supportedE = Object.keys(m)
        console.log('[VRM] 表情:', supportedE.join(', '))
      } catch { /* ok */ }
      for (const c of ['aa', 'a', 'A', 'ah']) { if (supportedE.includes(c)) { mouthEName = c; break } }
      for (const c of ['blink', 'blinkLeft']) { if (supportedE.includes(c)) { blinkEName = c; break } }
      console.log('[VRM] 口型:', mouthEName || '❌', ' 眨眼:', blinkEName || '❌')
    }

    // ★ 关闭 lookAt（模型缺 lookUp/Down/Left/Right 表情，开着会斜视）
    if (vrm.lookAt) { try { (vrm.lookAt as any).autoUpdate = false } catch { /* ok */ } }

    // 初始化增量
    for (const k of Object.keys(IDLE)) { curDelta[k] = [0, 0, 0]; tgtDelta[k] = [0, 0, 0] }

    // 立即写入 idle 姿态
    writeBones(0, 0, 0)
    vrm.humanoid.update()
    frameFullBody()

    console.log('[VRM] ✅ 就绪  弹簧骨骼:', vrm.springBoneManager ? '✅' : '❌')
    // 方便控制台测试
    ;(window as any).__vrm = { loadVRMA, stopVRMA }
    if (props.audioElement) await initAudio(props.audioElement)
    // ★ 启动 VRMA 循环：从待机池随机选动画，播完自动切下一个
    vrmaCycling = true
    pickNextVRMA()
  } catch (e: any) { console.error('[VRM] ❌', e.message || e) }
}

/** 写入所有骨骼 = IDLE基准 + 手势增量(curDelta) + 额外偏移 */
function writeBones(hx: number, hy: number, hz: number) {
  const set = (b: THREE.Object3D | null, idle: number[], add: number[]) => {
    if (!b) return
    b.rotation.set(idle[0] + add[0], idle[1] + add[1], idle[2] + add[2])
  }
  // 上半身
  set(lUA, IDLE.lUA, curDelta['lUA'] || [0, 0, 0])
  set(lLA, IDLE.lLA, curDelta['lLA'] || [0, 0, 0])
  set(lH, IDLE.lH, curDelta['lH'] || [0, 0, 0])
  set(rUA, IDLE.rUA, curDelta['rUA'] || [0, 0, 0])
  set(rLA, IDLE.rLA, curDelta['rLA'] || [0, 0, 0])
  set(rH, IDLE.rH, curDelta['rH'] || [0, 0, 0])
  set(spineB, IDLE.spine, curDelta['spine'] || [0, 0, 0])
  set(hipsB, IDLE.hips, curDelta['hips'] || [0, 0, 0])
  // 腿（重要：VRMA 播完后恢复到 idle，否则腿会卡在动画末帧）
  set(lULeg, IDLE.lULeg, curDelta['lULeg'] || [0, 0, 0])
  set(lLLeg, IDLE.lLLeg, curDelta['lLLeg'] || [0, 0, 0])
  set(lFoot, IDLE.lFoot, curDelta['lFoot'] || [0, 0, 0])
  set(rULeg, IDLE.rULeg, curDelta['rULeg'] || [0, 0, 0])
  set(rLLeg, IDLE.rLLeg, curDelta['rLLeg'] || [0, 0, 0])
  set(rFoot, IDLE.rFoot, curDelta['rFoot'] || [0, 0, 0])
  // head/neck 额外叠加鼠标偏移和呼吸
  const hd = curDelta['head'] || [0, 0, 0]
  const nk = curDelta['neck'] || [0, 0, 0]
  set(headB, IDLE.head, [hd[0] + hx, hd[1] + hy, hd[2]])
  set(neckB, IDLE.neck, [nk[0], nk[1] + hy * 0.6, nk[2]])
}

async function initAudio(el: HTMLAudioElement) {
  try {
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    analyser?.disconnect(); try { mediaSource?.disconnect() } catch { /* ok */ }
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = .55
    mediaSource = audioCtx.createMediaElementSource(el)
    mediaSource.connect(analyser); analyser.connect(audioCtx.destination)
  } catch (e: any) { console.warn('[VRM] 音频:', e.message) }
}

// ═══════════ VRMA ═══════════
async function loadVRMA(url: string, loop = true) {
  if (!vrm || !mixer) { console.warn('[VRMA] vrm/mixer 未就绪'); return null }
  if (vrmaLoading) return null  // 防止并发加载
  vrmaLoading = true
  try {
    if (vrmaAction) { vrmaAction.stop(); vrmaAction = null }
    console.log('[VRMA] 加载中...', url)
    const loader = new GLTFLoader()
    loader.register((p: any) => new VRMAnimationLoaderPlugin(p))
    const gltf = await loader.loadAsync(url)
    // 兼容 vrmAnimations(复数/数组) 和 vrmAnimation(单数)
    let anim: VRMAnimation | null = gltf.userData.vrmAnimation as VRMAnimation
    if (!anim) {
      const arr = (gltf.userData as any).vrmAnimations as VRMAnimation[] | undefined
      if (arr && arr.length > 0) anim = arr[0]
    }
    if (!anim) { console.error('[VRMA] ❌ 无动画数据'); return null }
    const clip = createVRMAnimationClip(anim, vrm as any)
    vrmaAction = mixer.clipAction(clip)
    if (loop) {
      vrmaAction.setLoop(THREE.LoopRepeat, Infinity)
    } else {
      vrmaAction.setLoop(THREE.LoopOnce, 1)
      vrmaAction.clampWhenFinished = true
    }
    vrmaAction.play()
    console.log('[VRMA] ✅', url.split('/').pop(), loop ? '循环' : '单次', '时长:', clip.duration.toFixed(1) + 's')
    vrmaLoading = false
    return vrmaAction
  } catch (e: any) { console.error('[VRMA] ❌', e.message || e); vrmaLoading = false; return null }
}
function stopVRMA() {
  if (vrmaAction) {
    vrmaAction.stop()
    vrmaAction = null
    // 捕捉当前姿态并启动淡出过渡，避免骨骼卡住
    captureBoneOffsets(curDelta as any)
    for (const k of Object.keys(IDLE)) tgtDelta[k] = [0, 0, 0]
    vrmaCooldown = 0.5
  }
}

// ═══════════ 渲染循环 ═══════════
function loop() {
  requestAnimationFrame(loop)
  if (!vrm) return

  const now = performance.now() / 1000
  const dt = Math.min(now - lastTime, .1)
  lastTime = now; animTime += dt

  // ★ VRM 更新：驱动弹簧骨骼（头发/衣物）+ 归一化→原始骨骼同步
  if (mixer) mixer.update(dt)
  // VRMA 播完后 → 平滑过渡到 idle → 冷却后切下一个
  if (vrmaAction && !vrmaAction.isRunning()) {
    vrmaAction = null
    captureBoneOffsets(curDelta as any)
    for (const k of Object.keys(IDLE)) tgtDelta[k] = [0, 0, 0]
    vrmaCooldown = 0.8
  }
  // 淡出冷却期：从当前姿态平滑衰减到 idle
  if (vrmaCooldown > 0) {
    vrmaCooldown -= dt
    const f = 1 - Math.exp(-6.0 * dt)
    for (const k of Object.keys(IDLE)) {
      const cur = curDelta[k]
      cur[0] += (0 - cur[0]) * f
      cur[1] += (0 - cur[1]) * f
      cur[2] += (0 - cur[2]) * f
    }
    if (vrmaCooldown <= 0 && vrmaCycling && !vrmaAction && !vrmaLoading) {
      pickNextVRMA()
    }
  }
  vrm.update(dt)

  // 口型
  {
    const amp = speechAmp(); mouthT = amp
    mouthC += (mouthT - mouthC) * Math.min(dt * 14, 1)
    if (mouthEName) { try { vrm.expressionManager?.setValue(mouthEName, mouthC * .7) } catch { /* ok */ } }
  }

  // 眨眼
  {
    const bw = blinkUpdate(dt)
    if (blinkEName) { try { vrm.expressionManager?.setValue(blinkEName, bw) } catch { /* ok */ } }
  }

  // 表情
  {
    const target = supportedE.find(e => e.toLowerCase() === (EXPR_MAP[props.emotion] || 'neutral').toLowerCase()) || 'neutral'
    if (target !== curExpr) {
      if (curExpr !== 'neutral' && exprW > 0 && supportedE.includes(curExpr)) {
        try { vrm.expressionManager?.setValue(curExpr, 0) } catch { /* ok */ }
      }
      curExpr = target; exprW = 0
    }
    if (exprW < 1 && target !== 'neutral') exprW = Math.min(1, exprW + dt * 3)
    if (target !== 'neutral' && supportedE.includes(target)) {
      try { vrm.expressionManager?.setValue(target, exprW) } catch { /* ok */ }
    }
  }

  // 非冷却期且无 VRMA 时，保持 curDelta 归零
  if (!vrmaAction && vrmaCooldown <= 0) {
    for (const k of Object.keys(IDLE)) {
      const cur = curDelta[k]; cur[0] = 0; cur[1] = 0; cur[2] = 0
    }
  }

  const breath = Math.sin(animTime * .85) * .004
  const shift = Math.sin(animTime * .5) * .012
  const headY = mTx * .35
  const headX = mTy * -.18

  if (!vrmaAction) {
    writeBones(headX + breath, headY, shift)
    if (hipsB) hipsB.rotation.z += shift
    if (spineB) spineB.rotation.z += shift * .3
  }

  renderer.render(scene, camera)
}

// ═══════════ 对外接口 ═══════════
let resumeIdleTimer: ReturnType<typeof setTimeout> | null = null

function setSpeaking(v: boolean) {
  speaking = v
  if (v) {
    // 开始说话 → 切到讲解池，立即触发新动画
    if (resumeIdleTimer) { clearTimeout(resumeIdleTimer); resumeIdleTimer = null }
    currentPool = TALK_POOL
    if (vrmaAction) stopVRMA()
    pickNextVRMA()
  } else {
    mouthT = 0; mouthC = 0
    // 说完 2 秒后切回待机池
    if (resumeIdleTimer) clearTimeout(resumeIdleTimer)
    resumeIdleTimer = setTimeout(() => {
      if (!speaking) {
        currentPool = IDLE_POOL
        if (vrmaAction) stopVRMA()
        pickNextVRMA()
      }
    }, 2000)
  }
}
defineExpose({ setSpeaking, loadVRMA, stopVRMA })

// ═══════════ 生命周期 ═══════════
watch(() => props.audioElement, async el => { if (el && vrm) await initAudio(el) })
watch(() => props.speaking, v => setSpeaking(v))

onMounted(async () => {
  await nextTick(); await loadModel(); loop()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  analyser?.disconnect(); try { mediaSource?.disconnect() } catch { /* ok */ }
  if (audioCtx) audioCtx.close().catch(() => { })
  if (vrmaAction) vrmaAction.stop()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onMM)
  window.removeEventListener('mouseleave', onML)
  if (vrm) { scene?.remove(vrm.scene); vrm = null }
  renderer?.dispose()
})

function onResize() {
  if (!renderer || !containerRef.value) return
  const w = containerRef.value.clientWidth, h = containerRef.value.clientHeight
  if (w > 0 && h > 0) {
    renderer.setSize(w, h)
    camera.aspect = w / h
    frameFullBody()
  }
}
</script>

<style scoped>.vrm-container{overflow:hidden;border-radius:12px;cursor:pointer}</style>
