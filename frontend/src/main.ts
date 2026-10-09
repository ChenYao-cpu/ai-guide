import { createApp } from 'vue'

import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import ElementPlus from 'element-plus'

import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import 'xgplayer/dist/index.min.css'

import '@/style/index.scss'

import App from './App.vue'
import router from './router'

// ── PWA Service Worker 注册 ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope)
        // 请求后台位置同步权限（如果支持）
        if ('periodicSync' in registration) {
          (registration as any).periodicSync.register('location-update', {
            minInterval: 5 * 60 * 1000, // 最短5分钟
          }).catch(() => { /* 浏览器不支持 */ })
        }
      },
      (err) => console.warn('[PWA] SW registration failed:', err),
    )
  })
}

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate) // 持久化储存插件

app.use(pinia)
app.use(router)

app.use(ElementPlus, {
  locale: zhCn
})
app.mount('#app')
