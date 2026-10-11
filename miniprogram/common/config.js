// 本地开发地址由 scripts/configure_miniprogram.ps1 更新；正式部署改为 HTTPS。
export const LAN_SERVER_ORIGIN = 'http://172.27.36.186:8000'

// 模拟器直连本机；真机使用编译时检测到的局域网地址。
const runtimePlatform = typeof wx !== 'undefined'
  ? (wx.getDeviceInfo ? wx.getDeviceInfo().platform : wx.getSystemInfoSync().platform)
  : ''
export const SERVER_ORIGIN = runtimePlatform === 'devtools'
  ? 'http://127.0.0.1:8000'
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
export const LOGIN_PROVIDER = DEVELOPMENT_LOGIN ? 'development' : 'weixin'



