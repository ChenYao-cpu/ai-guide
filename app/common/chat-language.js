// Translate display copies only. Never send translated messages back as tour input.
export async function localizeChatMessages({ lists, field, target, cache, translate, isCurrent }) {
  const groups = new Map()
  for (const message of new Set(lists.flat())) {
    const text = message && message[field]
    if (typeof text !== 'string' || !text.trim()) continue
    const source = message.translations || {}
    const hasChinese = /[\u3400-\u9fff]/.test(text)
    const language = hasChinese ? 'zh' : (message.lang || 'en')
    const original = source[language] || text
    const key = original
    const saved = cache.get(key) || { ...source, [language]: original }
    if (!saved[target] && (target === 'en' ? !/[\u3400-\u9fff]/.test(text) : language === 'zh')) continue
    if (!groups.has(key)) groups.set(key, { key, text: original, saved, messages: [] })
    groups.get(key).messages.push(message)
  }
  const apply = group => {
    for (const message of group.messages) {
      message.translations = { ...group.saved }
      message[field] = group.saved[target]
      message.lang = target
      if (field === 'content' && message.segments) { message.segments = undefined; message.cursor = false }
    }
  }
  const pending = []
  for (const group of groups.values()) {
    if (!isCurrent()) return
    if (group.saved[target]) apply(group)
    else pending.push(group)
  }
  // The existing endpoint limits each quoted input to 4000 characters.
  // Split long replies before quoting so their ending cannot be truncated.
  const jobs = []
  for (const group of pending) {
    const chars = Array.from(group.text)
    group.parts = []
    for (let start = 0; start < chars.length; start += 1200) jobs.push({ group, index: group.parts.push('') - 1, text: chars.slice(start, start + 1200).join('') })
  }
  for (let offset = 0; offset < jobs.length; offset += 4) {
    if (!isCurrent()) return
    const batch = jobs.slice(offset, offset + 4)
    // Quoting questions makes them translation data rather than new instructions.
    const values = await translate(batch.map(job => JSON.stringify(job.text)))
    if (!isCurrent()) return
    if (!Array.isArray(values) || values.length !== batch.length || values.some(value => typeof value !== 'string' || !value.trim() || (target === 'en' && /[\u3400-\u9fff]/.test(value)))) throw new Error('Invalid translation response')
    batch.forEach((job, index) => { job.group.parts[job.index] = values[index].trim() })
  }
  if (!isCurrent()) return
  for (const group of pending) {
    group.saved[target] = group.parts.join('\n')
    for (const text of Object.values(group.saved)) cache.set(text, group.saved)
    apply(group)
  }
}
