// 景区导览 PWA Service Worker
// 提供离线缓存

const CACHE_NAME = 'tour-guide-station-v3'
const CACHE_URLS = [
  '/station/summer-palace-east',
  '/offline.html',
  '/manifest.json',
]

// 安装：预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CACHE_URLS)
      await Promise.allSettled(["/scenic/enhanced/long-corridor.jpg", "/scenic/enhanced/kunming-lake.jpg", "/scenic/enhanced/seventeen-arch-bridge.jpg", "/scenic/enhanced/south-lake-island.jpg", "/scenic/enhanced/bronze-ox.jpg", "/scenic/enhanced/marble-boat.jpg", "/scenic/enhanced/renshou-hall.jpg", "/scenic/enhanced/dehe-garden.jpg", "/scenic/enhanced/yulan-hall.jpg", "/scenic/enhanced/leshou-hall.jpg", "/scenic/enhanced/paiyun-hall.jpg", "/scenic/enhanced/buddhist-incense-tower.jpg", "/scenic/enhanced/harmonious-interests-garden.jpg", "/scenic/enhanced/suzhou-street.jpg", "/scenic/enhanced/jade-belt-bridge.jpg", "/scenic/enhanced/wenchang-pavilion.jpg"].map(url => cache.add(url)))
    })
  )
  // 立即激活，不等待旧SW
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('tour-guide-station-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
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
  const allowed = /^\/(assets|images|brand|models|scenic|vendor)\//.test(url.pathname) ||
    event.request.mode === 'navigate' && /^\/(station(?:\/|$))/.test(url.pathname)
  if (!allowed) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response
        const cloned = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
        return response
      })
      .catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('/offline.html') : Response.error()))
  )
})
