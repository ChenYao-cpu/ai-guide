/**
 * 小程序 API 层
 * 使用 module.exports 而非 ES export（兼容小程序webpack）
 */
import { BASE_URL } from './config.js'

function request(options) {
  return new Promise(function(resolve, reject) {
    var url = options.url
    if (url.indexOf('http') !== 0) {
      url = BASE_URL + url
    }
    var token = uni.getStorageSync('token') || ''
    var header = { 'Content-Type': 'application/json' }
    if (token) { header['Authorization'] = 'Bearer ' + token }
    uni.request({
      url: url,
      method: options.method || 'GET',
      data: options.data || options.params,
      header: header,
      success: function(res) {
        if (res.statusCode === 200) {
          resolve({ data: res.data })
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token')
          uni.reLaunch({ url: '/pages/auth/auth' })
          reject(new Error('Unauthorized'))
        } else {
          reject(new Error('HTTP ' + res.statusCode))
        }
      },
      fail: function(err) { reject(err) }
    })
  })
}

module.exports = {
  getSpotList: function() {
    return request({ url: '/tour-session/spots' })
  },
  getGuideList: function() {
    return request({ url: '/tour-session/guides' })
  },
  getRouteList: function() {
    return request({ url: '/tour-session/routes' })
  },
  createSession: function(name, guideId, preferences, spotIds) {
    return request({
      url: '/tour-session/visitor-create',
      method: 'POST',
      params: {
        name: name,
        guide_id: guideId,
        visitor_preferences: preferences,
        spot_ids: JSON.stringify(spotIds)
      }
    })
  },
  getLiveInfo: function(sessionId) {
    return request({ url: '/tour-session/live-info/' + sessionId })
  },
  sendMessage: function(sessionId, message) {
    return request({
      url: '/tour-session/chat',
      method: 'PUT',
      data: { sessionId: sessionId, message: message }
    })
  },
  endSession: function(sessionId) {
    return request({ url: '/tour-session/end/' + sessionId, method: 'PUT' })
  },
  aiChatRecommend: function(message) {
    return request({ url: '/tour-session/ai-chat-recommend', method: 'POST', params: { message: message } })
  },
  request: request
}
