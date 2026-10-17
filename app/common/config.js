// Build with -ServerOrigin or set VITE_APP_SERVER_ORIGIN for the target server.
export const LAN_SERVER_ORIGIN = (import.meta.env.VITE_APP_SERVER_ORIGIN || 'http://192.168.43.41:18000').replace(/\/+$/, '')

// 模拟器直连本机；真机使用编译时检测到的局域网地址。
const runtimePlatform = typeof wx !== 'undefined'
  ? (wx.getDeviceInfo ? wx.getDeviceInfo().platform : wx.getSystemInfoSync().platform)
  : ''
// Android USB development uses `adb reverse tcp:18000 tcp:18000`.
let usbDevelopment = false
// #ifdef APP-PLUS
usbDevelopment = import.meta.env.MODE === 'development'
// #endif
export const SERVER_ORIGIN = runtimePlatform === 'devtools' || usbDevelopment
  ? 'http://127.0.0.1:18000'
  : LAN_SERVER_ORIGIN
export const BASE_URL = SERVER_ORIGIN + '/api/v1'

export function assetUrl(value) {
  if (!value) return ''
  if (value.indexOf('/digital_guide/3d/')>=0) {
    value=value.replace(/\.gltf(?=\?|$)/, '.glb')
    if (/\.glb(?:\?|$)/.test(value)) value+=(value.includes('?')?'&':'?')+'avatarMotion=bent-elbow-intro-v7'
  }
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, SERVER_ORIGIN)
  }
  if (value.indexOf('/static/') === 0) return value
  if (value.indexOf('/api/v1/') === 0) return SERVER_ORIGIN + value
  if (value.indexOf('/files/') === 0) return BASE_URL + value
  return BASE_URL + '/files/' + value.replace(/^\/+/, '')
}



// 开发测试号使用真实后端账号；正式微信登录时设为 false。
// Only the local development simulator uses the existing backend test account.
// Native App uses account/email login; the mini program uses WeChat authorization.
export const DEVELOPMENT_LOGIN = import.meta.env.MODE === 'development' && runtimePlatform === 'devtools'
let appLogin = false
// #ifdef APP-PLUS
appLogin = true
// #endif
export const APP_LOGIN = appLogin
export const LOGIN_PROVIDER = APP_LOGIN ? 'password' : DEVELOPMENT_LOGIN ? 'development' : 'weixin'
