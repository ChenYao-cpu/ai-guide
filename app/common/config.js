// 本地开发地址由 scripts/configure_app.ps1 更新；正式部署改为 HTTPS。
export const LAN_SERVER_ORIGIN = 'http://10.205.242.153:18000'

// 模拟器直连本机；真机使用编译时检测到的局域网地址。
const runtimePlatform = typeof wx !== 'undefined'
  ? (wx.getDeviceInfo ? wx.getDeviceInfo().platform : wx.getSystemInfoSync().platform)
  : ''
// 真机使用局域网地址。HBuilderX 重跑时会清理自定义 USB 转发，
// 不能让开发版固定依赖手机自己的 127.0.0.1:18000。
let usbDevelopment = false
// Local browser previews connect to the same backend as USB development.
// #ifdef H5
usbDevelopment = import.meta.env.MODE === 'development' &&
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
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
// Release builds and real devices still require WeChat authorization.
export const DEVELOPMENT_LOGIN = import.meta.env.MODE === 'development' && runtimePlatform === 'devtools'
let appLogin = false
// #ifdef APP-PLUS
appLogin = true
// #endif
// Browser previews of the App use the same real password-login API.
// #ifdef H5
appLogin = true
// #endif
export const APP_LOGIN = appLogin
export const LOGIN_PROVIDER = APP_LOGIN ? 'password' : DEVELOPMENT_LOGIN ? 'development' : 'weixin'






export function isBeijingCity(value) {
  return String(value || '').replace(/\s+/g, '') === '北京'
}
