export const CLAIM_ROUTE = '/pages/claim/claim'
const KEY = 'station-pending-claim'
export function pendingClaim() { return uni.getStorageSync(KEY) || null }
export function clearPendingClaim() { uni.removeStorageSync(KEY) }
export function parseClaim(value) {
  const raw = String(value || '').trim()
  if (/^[A-HJ-NP-Z2-9]{12}$/i.test(raw)) return { token: raw.toUpperCase(), origin: '' }
  if (!/^(zhiyouguide:\/\/claim|https?:\/\/[^/]+\/m\/receive)[?#]/.test(raw)) return null
  const params = {}
  raw.replace(/[#?&]([^=&#]+)=([^&#]*)/g, (_, key, val) => { params[key] = decodeURIComponent(val) })
  if (params.manual === '1' && params.server) return { token: '', origin: params.server }
  const token = params.claim || params.code || ''
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token) && !/^[A-HJ-NP-Z2-9]{12}$/i.test(token)) return null
  return { token, origin: params.server || '' }
}
export function saveClaim(value) {
  const result = parseClaim(value)
  if (!result) throw new Error('请扫描路线领取码或输入12位领取码')
  uni.setStorageSync(KEY, result)
  return result
}
