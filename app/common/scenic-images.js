import covers from '../static/scenic-lzx/catalog.json'

// Apply only display assets, across all App request entrances. Do not change
// uploaded user photos, guide avatars, factual content, IDs or route geometry.
export function applyLzxScenicImages(data) {
  if (!data || typeof data !== 'object') return data
  if (!Array.isArray(data) && typeof data.spot_name === 'string') {
    const city = String(data.city || '').trim()
    const cover = (!city || ['北京', '北京市', 'Beijing'].includes(city)) && covers[data.spot_name]
    if (cover) data.image_path = cover.path
  }
  if (!Array.isArray(data) && data.route_id && Array.isArray(data.spot_names)) {
    const city = String(data.city || '').trim()
    const cover = (!city || ['北京', '北京市', 'Beijing'].includes(city)) && data.spot_names.map(name => covers[name]).find(Boolean)
    if (cover) { data.cover_image = cover.path; data.cover_generated = false }
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object') applyLzxScenicImages(value)
  }
  return data
}

export const lzxScenicInterceptor = { success(response) { applyLzxScenicImages(response.data) } }
