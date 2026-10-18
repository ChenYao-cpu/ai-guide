// 景区导览 PWA Service Worker
// 提供离线缓存和后台位置追踪能力

const CACHE_NAME = 'tour-guide-station-v2'
const CACHE_URLS = [
  '/station/summer-palace-east',
  '/offline.html',
  '/manifest.json',
]

// 安装：预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
  )
  // 立即激活，不等待旧SW
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 请求拦截：网络优先，失败时回退缓存
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  // Cache public presentation assets only. Tokens, chats, claims and admin API
  // responses must never enter a shared-terminal browser cache.
  if (url.origin !== self.location.origin) return
  const allowed = /^\/(assets|images|brand|models)\//.test(url.pathname) ||
    event.request.mode === 'navigate' && /^\/(station(?:\/|$)|m\/(?:home|receive)$)/.test(url.pathname)
  if (!allowed) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response
        const cloned = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
        return response
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/offline.html')))
  )
})

// 后台位置推送（如果支持 Periodic Background Sync）
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-update') {
    event.waitUntil(updateLocationInBackground())
  }
})

async function updateLocationInBackground() {
  // 后台位置更新 — 由主线程触发
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'bg-location-request' })
  }
}
