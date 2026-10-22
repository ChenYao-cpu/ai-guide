import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync('public/sw.js', 'utf8')
function worker() {
  const handlers: Record<string, (e: any) => void> = {}
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    put: vi.fn()
  }
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi
      .fn()
      .mockResolvedValue(['other-app-cache', 'tour-guide-station-v2', 'tour-guide-station-v3']),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn()
  }
  const self = {
    location: { origin: 'https://station.test' },
    addEventListener: (key: string, fn: any) => {
      handlers[key] = fn
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() }
  }
  runInNewContext(source, {
    self,
    caches,
    URL,
    Response,
    fetch: vi.fn().mockResolvedValue(new Response('photo'))
  })
  return { handlers, caches, cache }
}
describe('public station asset cache', () => {
  it('never intercepts consultation, claim or admin requests', () => {
    const { handlers } = worker()
    for (const path of [
      '/service-stations/claim/preview',
      '/service-stations/admin',
      '/xingyun/session/1',
      '/api/v1/files/private'
    ]) {
      const respondWith = vi.fn()
      handlers.fetch({
        request: { method: 'GET', url: 'https://station.test' + path, mode: 'cors' },
        respondWith
      })
      expect(respondWith).not.toHaveBeenCalled()
    }
  })
  it('precaches all 16 scenic photographs without making them mandatory for install', async () => {
    const { handlers, cache } = worker()
    let pending: Promise<unknown> = Promise.resolve()
    cache.add.mockRejectedValueOnce(new Error('temporarily unavailable'))
    handlers.install({
      waitUntil: (p: Promise<unknown>) => {
        pending = p
      }
    })
    await pending
    expect(cache.add).toHaveBeenCalledTimes(16)
  })
  it('cleans only its own older caches', async () => {
    const { handlers, caches } = worker()
    let pending: Promise<unknown> = Promise.resolve()
    handlers.activate({
      waitUntil: (p: Promise<unknown>) => {
        pending = p
      }
    })
    await pending
    expect(caches.delete).toHaveBeenCalledTimes(1)
    expect(caches.delete).toHaveBeenCalledWith('tour-guide-station-v2')
  })
})
