// Pin the Android-compatible SDK shipped in the App instead of remote @latest.
// A successful frame decode remains required; unsupported devices still fail.
export const XINGYUN_SDK_ASSET = './static/sdk/xmov-avatar-2.4.1-compatible.js'

// SDK handles these notifications/recovery events itself. Tearing down the
// session here would interrupt otherwise recoverable animation and speech.
export function isRecoverableXingyunEvent(event) {
  return [20005,20006,30005,50002,50003,60001,60002,60004,60007,60008].includes(Number(event && event.code))
}

export function loadXingyunSdk(runtimeWindow = window, runtimeDocument = document) {
  if (runtimeWindow.__zhiyouAvatarSdkReady) return Promise.resolve(runtimeWindow.XmovAvatar)
  if (runtimeWindow.__zhiyouAvatarSdkLoading) return runtimeWindow.__zhiyouAvatarSdkLoading
  const pending = new Promise((resolve, reject) => {
    const script = runtimeDocument.createElement('script')
    let timer
    const fail = () => {
      clearTimeout(timer)
      script.onload = script.onerror = null
      script.remove()
      reject(new Error('数字人资源加载失败，请重新连接'))
    }
    script.src = XINGYUN_SDK_ASSET
    script.onload = () => {
      if (typeof runtimeWindow.XmovAvatar !== 'function') { fail(); return }
      clearTimeout(timer)
      script.onload = script.onerror = null
      runtimeWindow.__zhiyouAvatarSdkReady = true
      resolve(runtimeWindow.XmovAvatar)
    }
    script.onerror = fail
    timer = setTimeout(fail, 15000)
    runtimeDocument.head.appendChild(script)
  })
  runtimeWindow.__zhiyouAvatarSdkLoading = pending.catch(error => {
    runtimeWindow.__zhiyouAvatarSdkLoading = null
    throw error
  })
  return runtimeWindow.__zhiyouAvatarSdkLoading
}
