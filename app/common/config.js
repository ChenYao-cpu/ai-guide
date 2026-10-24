// 本地开发地址由 scripts/configure_app.ps1 更新；正式部署改为 HTTPS。
export const LAN_SERVER_ORIGIN = 'http://10.198.63.153:18000'

// 真机使用局域网地址。HBuilderX 重跑时会清理自定义 USB 转发，
// 不能让开发版固定依赖手机自己的 127.0.0.1:18000。
let usbDevelopment = false
// Local browser previews connect to the same backend as USB development.
// #ifdef H5
usbDevelopment = import.meta.env.MODE === 'development' &&
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
// #endif
// Android USB debug base: reach the PC backend through `adb reverse tcp:18000 tcp:18000`.
let appUsbDevelopment = false
// #ifdef APP-PLUS
appUsbDevelopment = import.meta.env.MODE === 'development'
// #endif
export let SERVER_ORIGIN = uni.getStorageSync('station-server-origin') || (usbDevelopment || appUsbDevelopment
  ? 'http://127.0.0.1:18000'
  : LAN_SERVER_ORIGIN)
export let BASE_URL = SERVER_ORIGIN + '/api/v1'

export function isLocalStationOrigin(value) {
  const match = /^http:\/\/(\d{1,3}(?:\.\d{1,3}){3}):18000$/.exec(value)
  if (!match) return false
  const ip = match[1].split('.').map(Number)
  if (ip.some(n => n > 255)) return false
  return ip[0] === 127 || ip[0] === 10 || (ip[0] === 192 && ip[1] === 168) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31)
}
export function setStationServerOrigin(value) {
  if (!isLocalStationOrigin(value)) throw new Error('只允许连接局域网电脑的18000端口')
  if (value !== SERVER_ORIGIN) {
    uni.removeStorageSync('token')
    uni.removeStorageSync('login_provider')
  }
  SERVER_ORIGIN = value
  BASE_URL = value + '/api/v1'
  uni.setStorageSync('station-server-origin', value)
}

export function assetUrl(value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, SERVER_ORIGIN)
  }
  if (value.indexOf('/static/') === 0) return value
  if (value.indexOf('/api/v1/') === 0) return SERVER_ORIGIN + value
  if (value.indexOf('/files/') === 0) return BASE_URL + value
  return BASE_URL + '/files/' + value.replace(/^\/+/, '')
}



// App 与网页预览均使用真实账号密码登录。
export const LOGIN_PROVIDER = 'password'

export function isBeijingCity(value) {
  return String(value || '').replace(/\s+/g, '') === '北京'
}


