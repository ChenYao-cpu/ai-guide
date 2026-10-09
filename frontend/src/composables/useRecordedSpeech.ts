import { onUnmounted, ref } from 'vue'
import { request_handler } from '@/api/base'

export function useRecordedSpeech(onText: (text: string) => void, onError: (message: string) => void) {
  const recording = ref(false)
  const recognizing = ref(false)
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let wanted = false
  let starting = false
  let disposed = false
  const release = () => { stream?.getTracks().forEach(track => track.stop()); stream = null; clearTimeout(timer) }
  async function start() {
    if (starting || recording.value || recognizing.value) return
    wanted = true
    starting = true
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('当前环境无法录音，请使用 localhost 或 HTTPS 打开页面')
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!wanted || disposed) { release(); return }
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
      const current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder = current
      const chunks: Blob[] = []
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      current.onerror = () => { wanted = false; release(); recording.value = false; onError('录音失败，请检查麦克风后重试') }
      current.onstop = async () => {
        recording.value = false
        release()
        if (disposed) return
        recognizing.value = true
        try {
          const form = new FormData()
          form.append('file', new Blob(chunks, { type: current.mimeType }), 'recording.audio')
          const response = await request_handler.post('/tour-session/asr-upload', form, { timeout: 90000 })
          if (!response.data?.success) throw new Error(response.data?.message || '语音识别失败')
          if (!disposed) onText(response.data.data)
        } catch (error: any) {
          if (!disposed) onError(error.response?.data?.message || error.message || '无法连接语音识别服务')
        } finally { recognizing.value = false }
      }
      current.start()
      recording.value = true
      timer = setTimeout(stop, 60000)
    } catch (error: any) {
      release()
      if (!disposed) onError(error.name === 'NotAllowedError' ? '麦克风权限被拒绝，请在浏览器地址栏允许录音' : error.message || '无法打开麦克风')
    } finally { starting = false }
  }
  function stop() { wanted = false; if (recorder?.state === 'recording') recorder.stop() }
  onUnmounted(() => { disposed = true; stop(); release() })
  return { recording, recognizing, start, stop }
}
