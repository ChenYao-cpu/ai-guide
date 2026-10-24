// 位置缓存、定位请求与「最近的景点」计算。定位坐标统一为 GCJ02（与地图一致），
// 景点坐标是 WGS84，比较距离前先转换。
import { gcj02ToWgs84 } from '../../shared/coordinates.js'

const KEY = 'user-location:v1'
let cached = null

export function getCachedLocation() {
  if (cached) return cached
  try {
    const raw = uni.getStorageSync(KEY)
    if (raw && Number(raw.latitude)) cached = raw
  } catch (_) {}
  return cached
}

export function locateUser() {
  return new Promise(resolve => {
    if (typeof uni === 'undefined' || !uni.getLocation) { resolve(getCachedLocation()); return }
    uni.getLocation({ type: 'gcj02', isHighAccuracy: true,
      success: res => {
        cached = { latitude: res.latitude, longitude: res.longitude, accuracy: res.accuracy || 0, updatedAt: Date.now() }
        try { uni.setStorageSync(KEY, cached) } catch (_) {}
        try { uni.$emit('user-location:update', cached) } catch (_) {}
        resolve(cached)
      },
      fail: () => resolve(getCachedLocation()),
    })
  })
}

export function distanceMeters(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLng = (b.longitude - a.longitude) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// 在给定景点里找离用户最近的一个（返回 0-based 下标、景点和直线距离）。
export function nearestSpot(spots, location) {
  if (!location || !Number(location.latitude) || !Number(location.longitude)) return null
  const wgs = gcj02ToWgs84(Number(location.latitude), Number(location.longitude))
  const point = { latitude: wgs[0], longitude: wgs[1] }
  let best = null
  ;(spots || []).forEach((spot, index) => {
    const lat = Number(spot.latitude), lng = Number(spot.longitude)
    if (!lat || !lng) return
    const distance = distanceMeters(point, { latitude: lat, longitude: lng })
    if (!best || distance < best.distance) best = { index, spot, distance }
  })
  return best
}
