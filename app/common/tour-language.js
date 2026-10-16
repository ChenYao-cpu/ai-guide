// Reuse the Web application's translations; keep user messages unchanged.
import webEnglish from '../../frontend/src/i18n/en.json'

export const LANGUAGE_STORAGE_KEY = 'zhiyou.app-language'
const appEnglish = {
  '预计剩余约 {minutes} 分钟': 'About {minutes} min remaining',
  '路线游览完毕': 'Route completed',
  '选择问题或直接提问': 'Choose a question or ask your own',
  '输入你想了解的问题...': 'Ask in English or Chinese…',
  'AI导游思考中...': 'Your guide is preparing an answer…',
  '正在识别…': 'Recognizing…',
  '正在回答…': 'Answering…',
  '松开发送': 'Release to send',
  '按住说话': 'Hold to speak',
  '讲解中': 'Speaking',
  '连接中…': 'Connecting…',
  '待命中': 'Ready',
  '形象未配置': 'Avatar not configured',
  '景点知识': 'About this stop',
  '确定要结束本次导览吗？': 'End this tour?',
  '路线示意图': 'Route illustration',
  '数字导游': 'Digital guide',
  '景区导览中': 'Scenic tour',
  '回复失败': 'Could not get an answer',
  '回答等待超时，请重试': 'The answer timed out. Please try again.',
  '无法连接服务器，请检查网络': 'Cannot connect. Please check your network.',
  '结束导览后将返回首页，确定结束吗？': 'End the tour and return home?',
  // 「我的」页及底部导航（App 专属文案，网页端不存在对应键）
  '界面语言': 'Interface language',
  '我的': 'Mine',
  '游览记录': 'Tour history',
  '偏好设置': 'Preferences',
  '关于我们': 'About us',
  'AI小导游': 'AI Guide',
  '个人资料加载失败': 'Could not load profile',
  '个人资料加载失败，请检查网络': 'Could not load profile. Please check your network.',
  '确定要退出登录吗？': 'Log out of your account?',
  '景区数字人导览与路线规划。': 'Digital-human scenic guiding and route planning.',
}

export function translateTour(value, language, params = {}) {
  const key = value == null ? '' : String(value)
  const text = language === 'en' ? (appEnglish[key] || webEnglish[key] || key) : key
  return text.replace(/\{(\w+)\}/g, (token, name) => params[name] == null ? token : String(params[name]))
}
