import App from './App'
import { createSSRApp } from 'vue'
import { installAppI18n } from './common/i18n.js'

export function createApp() {
  const app = createSSRApp(App)
  installAppI18n(app)
  return { app }
}
