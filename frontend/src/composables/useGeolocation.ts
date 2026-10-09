/**
 * GPS位置追踪 composable
 * 用于景区导览的LBS（Location-Based Service）功能：
 *   - 实时追踪游客GPS位置
 *   - 检测接近景点时自动触发讲解切换
 *   - 支持后台位置追踪（PWA）
 */

import { ref, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { request_handler, type ResultPackage } from '@/api/base'
import { header_authorization } from '@/api/user'

// ===== 类型定义 =====

interface SpotCoord {
  spot_id: number
  spot_name: string
  category: string
  latitude: number
  longitude: number
  trigger_radius: number
  description: string
}

interface NearbySpot {
  spot_id: number
  spot_name: string
  distance: number
  trigger_radius: number
  within_range: boolean
}

interface NearbyResult {
  visitor_position: { latitude: number; longitude: number }
  nearby_spots: NearbySpot[]
  closest_spot: NearbySpot | null
  auto_switched: boolean
}

// ===== Composable =====

export function useGeolocation() {
  const latitude = ref(0)
  const longitude = ref(0)
  const accuracy = ref(0)
  const isTracking = ref(false)
  const error = ref<string | null>(null)
  const nearbySpots = ref<NearbySpot[]>([])
  const closestSpot = ref<NearbySpot | null>(null)
  const autoSwitchEnabled = ref(true)

  let watchId: number | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let sessionId: number = 0

  /** 检查浏览器是否支持GPS */
  const isSupported = (): boolean => {
    return 'geolocation' in navigator
  }

  /** 开始追踪位置 */
  const startTracking = (sid: number = 0, pollInterval: number = 10000) => {
    if (!isSupported()) {
      error.value = '您的设备不支持GPS定位'
      ElMessage.warning('设备不支持GPS，将使用手动模式')
      return
    }

    sessionId = sid
    isTracking.value = true
    error.value = null

    // 高精度GPS追踪
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        latitude.value = position.coords.latitude
        longitude.value = position.coords.longitude
        accuracy.value = position.coords.accuracy
        error.value = null

        // 首次获取到位置时立即检测
        if (!pollTimer) {
          checkNearby()
        }
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            error.value = 'GPS权限被拒绝，请在设置中允许位置访问'
            break
          case err.POSITION_UNAVAILABLE:
            error.value = '位置信息不可用'
            break
          case err.TIMEOUT:
            error.value = '获取位置超时'
            break
          default:
            error.value = '获取位置失败'
        }
        console.warn('[GPS]', error.value)
      },
      {
        enableHighAccuracy: true,  // 高精度模式（GPS优先）
        timeout: 15000,            // 15秒超时
        maximumAge: 5000,          // 缓存5秒
      },
    )

    // 定时轮询后端（检测景点接近）
    pollTimer = setInterval(() => {
      if (latitude.value && longitude.value) {
        checkNearby()
      }
    }, pollInterval)

    console.log('[GPS] 开始位置追踪, sessionId:', sessionId)
  }

  /** 停止追踪 */
  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    isTracking.value = false
    nearbySpots.value = []
    closestSpot.value = null
    console.log('[GPS] 停止位置追踪')
  }

  /** 检测附近景点 */
  const checkNearby = async () => {
    if (!latitude.value || !longitude.value) return

    try {
      const { data } = await request_handler<ResultPackage<NearbyResult>>({
        method: 'POST',
        url: '/tour-session/check-nearby',
        params: {
          latitude: latitude.value,
          longitude: longitude.value,
          session_id: autoSwitchEnabled.value ? sessionId : 0,
        },
        headers: { Authorization: header_authorization.value },
      })

      if (data.code === 0 && data.data) {
        nearbySpots.value = data.data.nearby_spots || []
        const prevClosest = closestSpot.value
        closestSpot.value = data.data.closest_spot

        // 自动切换通知
        if (data.data.auto_switched) {
          ElMessage.success(`已自动切换到景点「${data.data.closest_spot?.spot_name}」`)
        } else if (closestSpot.value && closestSpot.value.within_range &&
                   prevClosest?.spot_id !== closestSpot.value.spot_id) {
          ElMessage.info(`已进入「${closestSpot.value.spot_name}」范围（${closestSpot.value.distance}米）`)
        }
      }
    } catch (e) {
      console.warn('[GPS] 检测附近景点失败:', e)
    }
  }

  /** 获取所有景点的GPS坐标（用于离线距离计算） */
  const fetchSpotCoords = async (): Promise<SpotCoord[]> => {
    try {
      const { data } = await request_handler<ResultPackage<{ spot_list: SpotCoord[] }>>({
        method: 'GET',
        url: '/tour-session/spots-with-coords',
      })
      if (data.code === 0) return data.data?.spot_list || []
      return []
    } catch {
      return []
    }
  }

  /** 计算两点距离（米） */
  const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000
    const phi1 = (lat1 * Math.PI) / 180
    const phi2 = (lat2 * Math.PI) / 180
    const dphi = ((lat2 - lat1) * Math.PI) / 180
    const dlambda = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // 组件卸载时自动停止追踪
  onUnmounted(() => {
    stopTracking()
  })

  return {
    // 状态
    latitude,
    longitude,
    accuracy,
    isTracking,
    error,
    nearbySpots,
    closestSpot,
    autoSwitchEnabled,
    // 方法
    isSupported,
    startTracking,
    stopTracking,
    checkNearby,
    fetchSpotCoords,
    calcDistance,
  }
}
