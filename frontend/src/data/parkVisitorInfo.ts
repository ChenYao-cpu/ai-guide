/** Published reference information, not a live opening or ticket availability feed.
 * Source checked 2026-10-18: https://summerpalace.net.cn/visit.html
 * This deployment's attraction catalogue and walking graph cover the Summer Palace.
 */
export const summerPalaceVisitorInfo = {
  source: 'https://summerpalace.net.cn/visit.html',
  checkedOn: '2026-10-18',
  seasons: {
    peak: {
      park: '06:00 — 20:00',
      parkLastEntry: '19:00',
      gardens: '08:00 — 18:00',
      gardensLastEntry: '17:30',
      admission: 30,
      combined: 60
    },
    quiet: {
      park: '06:30 — 19:00',
      parkLastEntry: '18:00',
      gardens: '08:30 — 17:00',
      gardensLastEntry: '16:30',
      admission: 20,
      combined: 50
    }
  },
  gardens: [
    { name: '德和园', nameEn: 'Garden of Virtue and Harmony', price: 5 },
    { name: '佛香阁', nameEn: 'Tower of Buddhist Incense', price: 10 },
    { name: '苏州街', nameEn: 'Suzhou Street', price: 10 },
    { name: '颐和园博物馆', nameEn: 'Summer Palace Museum', price: 20 }
  ]
} as const

export function summerPalaceSeasonAt(time: number): 'peak' | 'quiet' {
  const month = Number(
    new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: 'Asia/Shanghai' }).format(time)
  )
  return month >= 4 && month <= 10 ? 'peak' : 'quiet'
}
