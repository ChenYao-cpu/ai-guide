<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { request_handler } from '@/api/base'
import { avatarHeaders } from '@/api/xingyunTour'
const props = defineProps<{ guideId?: number; tourId?: number; framing?: 'full' | 'half' }>()

type Avatar = {
  init(options: Record<string, unknown>): Promise<void>
  speak(text: string, start: boolean, end: boolean): void
  interactiveidle(): void
  destroy(): void
}
type Constructor = new (options: Record<string, unknown>) => Avatar
const emit = defineEmits<{ playing: [value: boolean]; connected: [value: boolean] }>()
const containerId = 'xingyun-' + Math.random().toString(36).slice(2)
const configured = ref(false)
const provider = ref('')
const loading = ref(false)
const ready = ref(false)
const message = ref('正在查询数字人配置')
let avatar: Avatar | undefined
let active = true
let generation = 0
let configPromise: Promise<void> = Promise.resolve()
watch(() => [props.guideId, props.tourId], () => {
  release(); configured.value = false; provider.value = ''
  const current = generation
  configPromise = (async () => {
    if (!props.guideId) return
    try {
      const { data } = await request_handler.get('/xingyun/config/' + props.guideId)
      if (!active || current !== generation) return
      configured.value = data.configured
      provider.value = data.provider
      message.value = data.configured ? '尚未连接实时数字人，请点击连接' : '该数字人未上架或未完成应用绑定'
      if (configured.value && props.tourId) {
        void nextTick().then(() => {
          if (active && current === generation) void connect()
        })
      }
    } catch { if (active && current === generation) { provider.value = 'xingyun'; message.value = '数字人配置查询失败，请检查后端服务' } }
  })()
}, { immediate: true })

async function loadSdk() {
  const win = window as Window & { XmovAvatar?: Constructor }
  if (win.XmovAvatar) return win.XmovAvatar
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://media.xingyun3d.com/xingyun3d/general/litesdk/xmovAvatar@latest.js'
    const timer = setTimeout(() => { script.remove(); reject(new Error('SDK 下载超时')) }, 30000)
    script.onload = () => { clearTimeout(timer); resolve() }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('SDK 下载失败')) }
    document.head.appendChild(script)
  })
  if (!win.XmovAvatar) throw new Error('SDK 未正确加载')
  return win.XmovAvatar
}
function release() {
  generation++
  ready.value = false
  emit('connected', false)
  emit('playing', false)
  try { avatar?.destroy() } catch { /* 已断开的实例 */ }
  avatar = undefined
}
async function connect() {
  await configPromise
  if (!configured.value || loading.value) return
  release()
  const current = generation
  loading.value = true
  message.value = '正在加载数字人'
  try {
    const SDK = await loadSdk()
    if (!active || current !== generation) return
    await nextTick()
    // SDK 的本地签名会被代理忽略；真实应用凭据保留在后端。
    const instance = new SDK({
      containerId: '#' + containerId,
      appId: 'server-proxy', appSecret: 'server-proxy',
      gatewayServer: new URL('/xingyun/session/' + props.guideId + '?tour_id=' + (props.tourId || 0), location.origin).href,
      headers: avatarHeaders(props.tourId || 0),
      proxyWidget: {
        subtitle_on: () => {},
        subtitle_off: () => {},
      },
      onInitEvent: (code: number) => { if (current === generation && code === 4000) { ready.value = true; emit('connected', true); message.value = '数字人已连接' } },
      onMessage: (error: { code?: number; message?: string }) => {
        if (current === generation && error.code && error.code !== 4000) {
          message.value = '数字人服务异常：' + (error.message || String(error.code))
          ready.value = false
          emit('connected', false)
          emit('playing', false)
        }
      },
      onVoiceStateChange: (status: string) => {
        if (current !== generation) return
        if (status.includes('start')) { emit('playing', true); message.value = '数字人正在讲解' }
        if (status.includes('end')) { emit('playing', false); message.value = '数字人讲解结束' }
      },
      onStateChange: (state: string) => {
        if (current !== generation) return
        if (state === 'idle' || state === 'interactive_idle') {
          ready.value = true
          emit('connected', true)
          message.value = '数字人已连接'
        }
      },
    })
    avatar = instance
    let initTimer: ReturnType<typeof setTimeout> | undefined
    try { await Promise.race([instance.init({
      onDownloadProgress: (progress: number) => {
        if (current === generation) message.value = '正在加载数字人资源：' + Math.round(progress) + '%'
      },
      onClose: () => {
        if (current !== generation) return
        ready.value = false
        emit('connected', false); emit('playing', false)
        message.value = '数字人连接已关闭，可重新连接'
      },
    }), new Promise<never>((_, reject) => { initTimer = setTimeout(() => reject(new Error('数字人初始化超时，请重新连接')), 90000) })])
    } finally { if (initTimer) clearTimeout(initTimer) }
  } catch (error) {
    if (current === generation) { release(); message.value = error instanceof Error ? error.message : '数字人连接失败' }
  } finally { if (active) loading.value = false }
}
function stop() {
  try { if (ready.value) avatar?.interactiveidle() } catch { release(); message.value = '数字人连接异常，请重新连接' }
  emit('playing', false)
}
function speak(text?: string): boolean {
  if (!ready.value || !avatar || !text?.trim()) return false
  try {
    avatar.interactiveidle()
    avatar.speak(text, true, true)
    return true
  } catch { release(); message.value = '数字人播报失败，本轮使用原导览语音'; return false }
}
onBeforeUnmount(() => { active = false; release() })
defineExpose({ speak, stop, isReady: () => ready.value })
</script>
<template>
  <section v-show="provider === 'xingyun'" class="xingyun-guide" :class="{ activated: ready || loading, half: framing === 'half' }">
    <div v-show="ready || loading" class="xingyun-frame"><div :id="containerId" class="xingyun-canvas" /></div>
    <div class="xingyun-controls">
      <button v-if="configured && !ready" :disabled="loading" @click="connect">{{ loading ? '连接中…' : '连接数字人' }}</button>
      <button v-if="ready" @click="release(); message='数字人连接已关闭'">断开连接</button>
      <p role="status">{{ message }}</p>
    </div>
  </section>
</template>
<style scoped>
.xingyun-guide{width:100%;height:100%;min-height:0;display:flex;flex-direction:column;justify-content:center;flex:1}.xingyun-guide.activated{flex:1;min-height:180px}.xingyun-frame{flex:1;min-height:120px;width:100%;position:relative;overflow:hidden}.xingyun-canvas{position:absolute;inset:0;width:100%;height:100%}.half .xingyun-canvas{transform:scale(1.75);transform-origin:50% 0}.xingyun-controls{flex-shrink:0;text-align:center;padding:8px;font-size:12px;color:#59657a}.xingyun-controls button{padding:8px 14px;border:1px solid #dce0e9;border-radius:8px;color:#3b5bff;background:white;cursor:pointer}.xingyun-controls p{margin:6px 0}
</style>
