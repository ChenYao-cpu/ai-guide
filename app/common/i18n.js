import { ref } from 'vue'
import { LANGUAGE_STORAGE_KEY, translateTour } from './tour-language.js'

function savedLanguage() {
  try { return uni.getStorageSync(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh' }
  catch (_) { return 'zh' }
}

// One reactive language for every mounted page and component.
export const appLanguage = ref(savedLanguage())
export function setAppLanguage(value) {
  const next = value === 'en' ? 'en' : 'zh'
  appLanguage.value = next
  try { uni.setStorageSync(LANGUAGE_STORAGE_KEY, next) } catch (_) { /* Storage can be unavailable. */ }
  return next
}
export function t(value, params) { return translateTour(value, appLanguage.value, params) }
export function uiToast(options) { return uni.showToast({ ...options, title: t(options.title) }) }
export function uiLoading(options) { return uni.showLoading({ ...options, title: t(options.title) }) }
export function uiModal(options) {
  return uni.showModal({ ...options, title: t(options.title), content: t(options.content),
    confirmText: t(options.confirmText || '确定'), cancelText: t(options.cancelText || '取消') })
}
export function uiActionSheet(options) {
  return uni.showActionSheet({ ...options, itemList: options.itemList.map(item => t(item)) })
}
export function formatAppDate(value, options) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  try { return date.toLocaleString(appLanguage.value === 'en' ? 'en-US' : 'zh-CN', options) }
  catch (_) { return String(value) }
}
export function installAppI18n(app) {
  app.mixin({
    computed: { appLanguage() { return appLanguage.value } },
    watch: {
      appLanguage(value) { if ('tourLanguage' in this.$data) this.tourLanguage = value },
    },
    methods: { $t: t, $date: formatAppDate },
    onShow() {
      const current = setAppLanguage(savedLanguage())
      if ('tourLanguage' in this.$data) this.tourLanguage = current
    },
  })
}
