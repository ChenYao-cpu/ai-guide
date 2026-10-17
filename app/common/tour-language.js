// App-owned snapshot of the LZX baseline: no runtime dependency on Web source.
import webEnglish from './web-en.json'
import additionalEnglish from './en.json'

export const LANGUAGE_STORAGE_KEY = 'zhiyou.app-language'
const appEnglish = {
  'AI 数字人景区导览': 'AI scenic guides',
  '山水之间 · 智游相伴': 'Your guide to every journey',
  '让每一程，都有故事': 'A story in every journey',
  '登录后开启导览，跟随数字人探索园中山水。': 'Sign in and explore the park with your digital guide.',
  '昵称（用于登录）': 'Nickname for signing in',
  '昵称或邮箱': 'Nickname or email',
  '邮箱地址': 'Email address',
  '密码至少8位': 'At least 8 characters',
  '再次输入密码（至少8位）': 'Re-enter password (at least 8 characters)',
  '邮箱验证码': 'Email verification code',
  '发送验证码': 'Send code',
  '正在发送…': 'Sending…',
  '{seconds}秒后重发': 'Resend in {seconds}s',
  '正在检查注册服务…': 'Checking registration service…',
  '重新检查注册服务': 'Check registration service again',
  '填写邮箱获取验证码，是否开通以发送结果为准。': 'Enter your email to request a code. The sending result will confirm availability.',
  '无法连接注册服务，请稍后重试。': 'Cannot connect to registration. Try again later.',
  '邮箱注册需要管理员配置验证码发信服务；未开通时请使用已有账号登录。': 'Email registration needs to be configured by the administrator. Sign in with an existing account for now.',
  '验证码已发送，有效期10分钟；未收到请检查垃圾邮件。': 'Code sent. It expires in 10 minutes. Check your spam folder if needed.',
  '请输入有效的邮箱地址': 'Enter a valid email address',
  '请等待60秒后再发送验证码': 'Wait 60 seconds before requesting another code',
  '验证码发送失败': 'Could not send the code',
  '验证码请求过于频繁，请稍后再试': 'Too many code requests. Try again later',
  '验证码邮件服务未配置，请联系管理员': 'Verification email is not configured. Contact the administrator',
  '验证码发送失败，请稍后重试或联系管理员': 'Could not send the code. Try again later or contact the administrator',
  '昵称需为1至40个字符，不能包含 @': 'Use 1–40 characters for your nickname, without @',
  '密码至少8位，UTF-8编码不超过72字节': 'Use at least 8 characters and no more than 72 UTF-8 bytes',
  '两次输入的密码不一致': 'Passwords do not match',
  '请输入6位邮箱验证码': 'Enter the 6-digit email verification code',
  '验证码已失效，请重新获取': 'This code is no longer valid. Request a new code',
  '验证码错误': 'Incorrect verification code',
  '该邮箱已注册，请登录': 'This email is already registered. Sign in instead',
  '该昵称已被使用，请换一个': 'This nickname is already in use. Choose another',
  '注册并登录': 'Register and sign in',
  '正在处理…': 'Working…',
  '已有账号，去登录': 'Already registered? Sign in',
  '没有账号？邮箱注册': 'New here? Register with email',
  '注册成功，请使用昵称和密码登录。': 'Account created. Sign in with your nickname and password.',
  '注册失败，请稍后重试': 'Registration failed. Try again later',
  '请输入账号和密码': 'Enter your account and password',
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
  '全身': 'Full body',
  '半身': 'Half body',
  '已连接': 'Connected',
  '连接失败': 'Connection failed',
  '重新连接数字人': 'Reconnect guide',
  '打开数字人导览': 'Open digital guide',
  '正在连接数字人…': 'Connecting to the guide…',
  '数字人连接正在恢复…': 'Reconnecting to the guide…',
  '数字人加载超时，请检查网络后重试': 'The guide took too long to load. Check your connection and retry.',
  '数字人资源加载失败，请重试': 'Could not load the guide. Please retry.',
  '数字人连接失败，请重试': 'Unable to connect to the guide. Please retry.',
  '星云连接已断开，请重试': 'The guide disconnected. Please retry.',
  '星云资源加载失败': 'Could not download the guide resources.',
  '星云服务连接失败': 'Unable to connect to the guide service.',
  '星云数字人正在讲解': 'The guide is speaking',
  '数字人尚未连接，回答已显示；请重新连接': 'The answer is ready. Reconnect the guide to hear it.',
  '所选星云数字人未启用或未绑定': 'This guide is unavailable. Please choose another guide.',
  '语音导览': 'Audio guide',
  '导游信息加载中，请稍后再试': 'The guide is still loading. Please try again shortly.',
  '请按住说话至少半秒': 'Hold to speak for at least half a second.',
  '录音失败，请检查麦克风权限': 'Recording failed. Check microphone permission.',
  '无法启动录音，请检查麦克风权限': 'Unable to record. Check microphone permission.',
  '语音识别服务返回错误': 'Speech recognition failed. Please retry.',
  '语音识别返回格式异常': 'The speech service returned an invalid response.',
  '语音上传失败，请检查网络连接': 'Could not upload the recording. Check your connection.',
  '语音识别连接超时，请稍后重试': 'Speech recognition timed out. Please retry.',
  '语音播放失败': 'Unable to play the audio.',
  '操作暂时无法完成，请重试': 'Unable to complete this action. Please retry.',
  '录音结束后可切换语言': 'Finish recording before changing the language.',
  '已切换英文，下一次回答将使用英文': 'English selected. Your next answer will be in English.',
  '已切换中文，下一次回答将使用中文': 'Chinese selected. Your next answer will be in Chinese.',
  '请介绍「{name}」': 'Please introduce {name}.',
  '最佳拍摄：{text}': 'Photography tips: {text}',
  '到达「{name}」': 'Arrived at {name}',
  'historical': 'History',
  'cultural': 'Culture',
  'natural': 'Nature',
  'comprehensive': 'General',
  'modern': 'Modern',
  ...additionalEnglish,
}

const messages = { ...webEnglish, ...appEnglish }
const chineseCatalogLabels = {historical:'历史',cultural:'文化',natural:'自然',comprehensive:'综合',modern:'现代'}
const patterns = Object.entries(messages).filter(([key]) => /\{\w+\}/.test(key))
  .sort(([a],[b]) => b.replace(/\{\w+\}/g,'').length - a.replace(/\{\w+\}/g,'').length)
  .map(([key, value]) => {
  const names = []
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const source = escaped.replace(/\\\{(\w+)\\\}/g, (_, name) => { names.push(name); return '(.*?)' })
  return { regex: new RegExp('^' + source + '$'), value, names }
})

export function translateTour(value, language, params = {}) {
  const key = value == null ? '' : String(value)
  let text = language === 'en' ? (messages[key] || messages[key.trim()] || key) : (chineseCatalogLabels[key] || key)
  if (language === 'en' && text === key) {
    const progress = key.match(/^正在加载(?:星云形象|数字人)\s*(\d+)%$/)
    if (progress) text = 'Loading the guide ' + progress[1] + '%'
    const http = key.match(/^服务请求失败（HTTP (\d+)）$/)
    if (http) text = 'Service request failed (HTTP ' + http[1] + ')'
    if (text === key) {
      for (const pattern of patterns) {
        const match = pattern.regex.exec(key)
        if (!match) continue
        text = pattern.value.replace(/\{(\w+)\}/g, (token, name) => {
          const value = match[pattern.names.indexOf(name) + 1]
          return value == null ? token : (messages[value] || value)
        })
        break
      }
    }
    // Public catalog descriptions often combine existing translated sentences.
    if (text === key && /[；。]/.test(key)) {
      const parts = key.match(/[^；。]+[；。]?/g) || []
      const translated = parts.map(piece => messages[piece] || messages[piece.replace(/[；。]$/, '')] || piece)
      if (parts.some((piece, index) => piece !== translated[index])) text = translated.join(' ')
    }
    if (text === key && key.endsWith('路线')) {
      const parts = key.slice(0,-2).split(' · ')
      if(parts.every(piece => messages[piece])) text = parts.map(piece => messages[piece]).join(' · ') + ' route'
    }
    if (text === key && key.includes(' · ')) {
      text = key.split(' · ').map(piece => translateTour(piece, language)).join(' · ')
    }
    if (text === key && key.includes(' → ')) {
      text = key.split(' → ').map(piece => translateTour(piece, language)).join(' → ')
    }
    if (text === key && key.includes('、')) {
      const parts = key.split('、')
      if (parts.every(piece => messages[piece])) text = parts.map(piece => messages[piece]).join(', ')
    }
  }
  const result = text.replace(/\{(\w+)\}/g, (token, name) => {
    if (params[name] == null) return token
    const value = String(params[name])
    return language === 'en' ? (messages[value] || value) : value
  })
  return language === 'en' ? result.replace(/\b1 places\b/g,'1 place').replace(/\b1 minutes\b/g,'1 minute') : result
}
