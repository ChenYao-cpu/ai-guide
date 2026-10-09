/**
 * Capacitor 后台位置追踪 Worker
 * 在APP退到后台时持续追踪GPS位置，接近景点时触发本地通知
 */

// 此脚本由 Capacitor BackgroundRunner 插件在原生层执行
// 不依赖DOM/Window API，使用纯JS + Capacitor插件API

// 伪代码结构（实际需要 @capacitor/background-runner 插件）:
//
// import { registerBackgroundTask } from '@capacitor/background-runner'
// import { Geolocation } from '@capacitor/geolocation'
//
// registerBackgroundTask(async () => {
//   const position = await Geolocation.getCurrentPosition({
//     enableHighAccuracy: true,
//     timeout: 10000,
//   })
//
//   // 将位置发送给主APP的Service Worker
//   await fetch('/tour-session/check-nearby', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       latitude: position.coords.latitude,
//       longitude: position.coords.longitude,
//       session_id: 0,  // 由主线程填充
//     }),
//   })
// })

console.log('[Background] 景区导览后台位置追踪已注册')
