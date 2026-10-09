<script lang="ts" setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { User, Lock, Guide, ArrowRight } from '@element-plus/icons-vue'
import { ElMessage, ElNotification, type FormInstance, type FormRules } from 'element-plus'
import { loginRequest } from '@/api/user'
import { useTokenStore, type TokenItem } from '@/stores/userToken'
import { AxiosError } from 'axios'
import { request_handler } from '@/api/base'

const router = useRouter()
const route = useRoute()
const isLogining = ref(false)
const serviceStatus = ref('正在检查后端连接')
const rememberAccount = ref(true)
const tokenStore = useTokenStore()
const formRef = ref<FormInstance>()

interface FormType { username: string; password: string }

const loginForm = reactive<FormType>({ username: '', password: '' })
const rules = reactive<FormRules<FormType>>({
  username: [{ required: true, message: '请输入登录名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 18, message: '密码长度必须为 6 至 18 位', trigger: 'blur' },
  ],
})

const onSubmit = async () => {
  isLogining.value = true
  await formRef.value?.validate().catch((err) => {
    ElMessage.error('表单校验失败')
    isLogining.value = false
    throw err
  })

  const logRes = await loginRequest({ username: loginForm.username, password: loginForm.password })
    .then((res) => {
      if (res.status !== 200) {
        ElMessage.error('账号名或密码错误')
        isLogining.value = false
        throw new Error('账号名或密码错误')
      }
      ElNotification({ title: '登录成功', message: `欢迎登录，${loginForm.username}`, type: 'success' })
      return res.data
    })
    .catch((error) => {
      isLogining.value = false
      if (error.response?.status === 401) ElMessage.error('账号名或密码错误')
      else if (error instanceof AxiosError) ElMessage.error('登录失败：' + error.message)
      else ElMessage.error('未知错误')
      throw error
    })

  tokenStore.saveToken(logRes as TokenItem)
  tokenStore.saveUserInfo({ username: loginForm.username, role: 'admin' })
  isLogining.value = false
  router.push((route.query.redirect as string) || '/home')
}

const enterAsVisitor = () => router.push('/visitor/home')
const handleForgotPassword = () => ElMessage.info('请联系系统管理员重置密码')
onMounted(() => {
  request_handler.get('/tour-session/guides', { timeout: 5000 }).then(() => { serviceStatus.value = '后端已连接' }).catch(() => { serviceStatus.value = '后端连接失败，请检查数据库与服务' })
  document.documentElement.classList.add('login-viewport')
  document.body.classList.add('login-viewport')
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('login-viewport')
  document.body.classList.remove('login-viewport')
})
</script>

<template>
  <main class="login-page">
    <div class="ambient-layer" aria-hidden="true">
      <span class="ambient-curtain"></span>
      <span class="ambient-wave wave-a"></span>
      <span class="ambient-wave wave-b"></span>
      <span class="ambient-wave wave-c"></span>
      <span class="ambient-line line-a"></span>
      <span class="ambient-line line-b"></span>
      <span class="ambient-line line-c"></span>
      <div class="orbit-system">
        <span class="orbit-ring orbit-ring-a"></span>
        <span class="orbit-ring orbit-ring-b"></span>
        <span class="orbit-ring orbit-ring-c"></span>
        <i class="orbit-core"></i>
        <b class="orbit-particle particle-a"></b>
        <b class="orbit-particle particle-b"></b>
        <b class="orbit-particle particle-c"></b>
      </div>
      <div class="data-stars">
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
    </div>
    <header class="login-topbar">
      <div class="system-brand">
        <span class="brand-mark">AI</span>
        <div>
          <strong>智游灵境运营中枢</strong>
          <small>Zhiyou Lingjing Console</small>
        </div>
      </div>
      <button class="top-visitor-entry" type="button" @click="enterAsVisitor">
        <el-icon><Guide /></el-icon>
        <span>游客导览入口</span>
        <el-icon><ArrowRight /></el-icon>
      </button>
    </header>

    <section class="login-shell">
      <section class="brand-panel">
        <div class="signal-field" aria-hidden="true">
          <span class="signal-line signal-line-a"></span>
          <span class="signal-line signal-line-b"></span>
          <span class="signal-line signal-line-c"></span>
          <span class="signal-node node-a"></span>
          <span class="signal-node node-b"></span>
          <span class="signal-node node-c"></span>
        </div>
        <div class="scan-ribbon" aria-hidden="true"></div>
        <div class="brand-content">
          <div class="brand-badge"><i></i> 智慧景区后台入口</div>
          <h1>智游灵境运营中枢</h1>
          <p>统一管理景点知识、游客反馈与运营数据，让导览服务可维护、可追踪、可优化。</p>
          <div class="brand-highlights">
            <span>知识库统一维护</span>
            <span>游客反馈闭环处理</span>
            <span>运营数据实时汇总</span>
          </div>
          <div class="brand-summary">
            <div>
              <strong>AI</strong>
              <span>智能导览服务</span>
            </div>
            <div>
              <strong>3类</strong>
              <span>核心资产管理</span>
            </div>
            <div>
              <strong>云端</strong>
              <span>多角色协同</span>
            </div>
          </div>
          <div class="motion-console" aria-hidden="true">
            <div class="console-head">
              <span>运营态势</span>
              <i></i>
            </div>
            <div class="console-visual">
              <span class="flow-card flow-card-a"><b>导览服务</b><em>98%</em></span>
              <span class="flow-card flow-card-b"><b>内容资产</b><em>同步中</em></span>
              <span class="flow-card flow-card-c"><b>游客反馈</b><em>实时</em></span>
              <div class="waveform">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="access-panel">
        <div class="access-halo" aria-hidden="true"></div>
        <div class="access-card">
          <div class="access-heading">
            <span>权限入口</span>
            <h2>登录运营后台</h2>
            <p>使用管理员账号进入智游灵境运营中枢。</p>
          </div>

          <el-form ref="formRef" :model="loginForm" :rules="rules" label-position="top" size="large" @submit.prevent="onSubmit">
            <el-form-item label="账号" prop="username">
              <el-input v-model="loginForm.username" :prefix-icon="User" placeholder="请输入手机号 / 工号 / 邮箱" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="loginForm.password" :prefix-icon="Lock" type="password" placeholder="请输入登录密码" show-password />
            </el-form-item>
            <div class="form-options">
              <el-checkbox v-model="rememberAccount">记住账号</el-checkbox>
              <button type="button" @click="handleForgotPassword">忘记密码？</button>
            </div>
            <el-form-item class="form-action">
              <el-button type="primary" size="large" native-type="submit" :loading="isLogining" class="login-btn">登录</el-button>
            </el-form-item>
          </el-form>

          <div class="access-status"><span>{{ serviceStatus }}</span></div>
        </div>
      </section>
    </section>

    <footer class="login-footer">© 智游灵境运营中枢 · Version 1.0 · 技术支持：运营服务团队</footer>
  </main>
</template>

<style lang="scss" scoped>
:global(html.login-viewport),
:global(body.login-viewport),
:global(html.login-viewport #app) {
  min-width: 0;
}

.login-page {
  position: relative;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  overflow: hidden;
  padding: 22px 32px 18px;
  background:
    radial-gradient(circle at 14% 12%, rgba(56, 189, 248, 0.26), transparent 30rem),
    radial-gradient(circle at 86% 16%, rgba(186, 230, 253, 0.72), transparent 34rem),
    linear-gradient(rgba(14, 165, 233, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.034) 1px, transparent 1px),
    #f4fbff;
  background-size: auto, auto, 32px 32px, 32px 32px, auto;
  animation: pageGridDrift 15s linear infinite;
}

.login-page,
.login-page *,
.login-page *::before,
.login-page *::after {
  box-sizing: border-box;
}

.ambient-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 150%;
    height: 34%;
    filter: blur(18px);
    opacity: 0.7;
    mix-blend-mode: multiply;
    transform: translateZ(0);
  }

  &::before {
    top: 4%;
    left: -34%;
    background: linear-gradient(98deg, transparent 0%, rgba(125, 211, 252, 0.58) 28%, rgba(255, 255, 255, 0.84) 45%, rgba(14, 165, 233, 0.28) 62%, transparent 82%);
    transform: rotate(-10deg);
    animation: broadLightPass 7.2s ease-in-out infinite;
  }

  &::after {
    right: -38%;
    bottom: 0;
    background: linear-gradient(108deg, transparent 0%, rgba(186, 230, 253, 0.62) 30%, rgba(255, 255, 255, 0.72) 52%, rgba(56, 189, 248, 0.22) 68%, transparent 88%);
    transform: rotate(12deg);
    animation: broadLightPass 8.4s -3s ease-in-out infinite reverse;
  }
}

.ambient-curtain {
  position: absolute;
  inset: -24% -14%;
  background:
    linear-gradient(105deg, transparent 6%, rgba(255, 255, 255, 0.78) 28%, rgba(125, 211, 252, 0.28) 42%, transparent 58%),
    linear-gradient(118deg, transparent 24%, rgba(125, 211, 252, 0.34) 48%, rgba(255, 255, 255, 0.54) 57%, transparent 74%);
  transform: translateX(-18%) rotate(-2deg);
  animation: curtainDrift 5.6s ease-in-out infinite alternate;
}

.ambient-wave {
  position: absolute;
  left: -24%;
  width: 148%;
  height: 240px;
  border-radius: 48%;
  filter: blur(12px);
  opacity: 0.52;
  background: linear-gradient(100deg, transparent 5%, rgba(255, 255, 255, 0.72) 28%, rgba(125, 211, 252, 0.32) 48%, rgba(255, 255, 255, 0.4) 66%, transparent 88%);
  transform: rotate(-11deg);
  animation: waveSlide 6.6s ease-in-out infinite;
}

.wave-a {
  top: 18%;
  --wave-rotate: -11deg;
}

.wave-b {
  top: 46%;
  --wave-rotate: 8deg;
  transform: rotate(8deg);
  animation-delay: -2.1s;
}

.wave-c {
  bottom: 4%;
  --wave-rotate: -5deg;
  transform: rotate(-5deg);
  animation-delay: -4.4s;
}

.ambient-line {
  position: absolute;
  width: 42vw;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.28), rgba(255, 255, 255, 0.76), transparent);
  opacity: 0.46;
  transform: rotate(-18deg);
  animation: ambientLineMove 7.8s ease-in-out infinite;
}

.line-a { top: 14%; left: -8%; }
.line-b { top: 44%; right: 2%; animation-delay: -3.4s; }
.line-c { bottom: 16%; left: 38%; animation-delay: -6.2s; }

.login-topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1360px;
  width: 100%;
  margin: 0 auto 20px;
  animation: panelRise 0.66s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.system-brand {
  display: flex;
  align-items: center;
  gap: 12px;

  .brand-mark {
    display: grid;
    position: relative;
    width: 42px;
    height: 42px;
    place-items: center;
    overflow: hidden;
    border-radius: 12px;
    color: #fff;
    background: linear-gradient(135deg, #38bdf8, #0284c7);
    box-shadow: 0 12px 26px rgba(14, 116, 144, 0.2);
    font-size: 13px;
    font-weight: 900;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(110deg, transparent 18%, rgba(255, 255, 255, 0.38) 48%, transparent 72%);
      transform: translateX(-110%);
      animation: markSweep 3.6s ease-in-out infinite;
    }
  }

  strong,
  small {
    display: block;
  }

  strong {
    color: #0f2742;
    font-size: 17px;
    font-weight: 850;
  }

  small {
    margin-top: 3px;
    color: #64748b;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.08em;
  }
}

.top-visitor-entry {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 15px;
  border: 1px solid #c8e3f2;
  border-radius: 12px;
  color: #075985;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 10px 24px rgba(14, 116, 144, 0.08);
  font-size: 13px;
  font-weight: 750;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

  &:hover {
    border-color: rgba(14, 165, 233, 0.42);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 16px 34px rgba(14, 116, 144, 0.14);
    transform: translateY(-1px);
  }
}

.login-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(420px, 0.44fr) minmax(520px, 0.56fr);
  max-width: 1360px;
  width: 100%;
  min-height: calc(100vh - 126px);
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid rgba(200, 227, 242, 0.9);
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.74), rgba(239, 249, 255, 0.5)),
    rgba(255, 255, 255, 0.58);
  box-shadow:
    0 34px 100px rgba(14, 80, 120, 0.18),
    0 10px 34px rgba(14, 165, 233, 0.1);
  backdrop-filter: blur(18px);
  animation: panelRise 0.78s 0.06s cubic-bezier(0.2, 0.8, 0.2, 1) both;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0.48) 36%, rgba(125, 211, 252, 0.24) 48%, transparent 62%),
      radial-gradient(circle at 22% 18%, rgba(255, 255, 255, 0.36), transparent 34%);
    opacity: 0.78;
    transform: translateX(-34%) rotate(-2deg);
    animation: shellLightSweep 5.2s ease-in-out infinite;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    border-radius: inherit;
    background: linear-gradient(112deg, transparent 0%, transparent 27%, rgba(255, 255, 255, 0.58) 43%, rgba(186, 230, 253, 0.26) 50%, transparent 65%, transparent 100%);
    transform: translateX(-120%);
    animation: shellSweep 6.2s ease-in-out infinite;
  }
}

.brand-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 64px 58px;
  color: #0b4166;
  background:
    radial-gradient(circle at 74% 58%, rgba(14, 165, 233, 0.38), transparent 44%),
    radial-gradient(circle at 22% 18%, rgba(255, 255, 255, 0.76), transparent 30%),
    linear-gradient(135deg, #e9f9ff 0%, #bfeeff 48%, #7dd3fc 100%);
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: -28%;
    z-index: 0;
    background:
      linear-gradient(115deg, transparent 10%, rgba(255, 255, 255, 0.64) 34%, transparent 54%),
      radial-gradient(circle at 58% 48%, rgba(255, 255, 255, 0.34), transparent 34%);
    transform: translateX(-16%) rotate(-9deg);
    animation: lightVeil 4.8s ease-in-out infinite alternate;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    right: -170px;
    bottom: -190px;
    width: 540px;
    height: 540px;
    border: 1px solid rgba(255, 255, 255, 0.56);
    border-radius: 50%;
    box-shadow:
      0 0 0 86px rgba(255, 255, 255, 0.16),
      0 0 120px rgba(14, 165, 233, 0.22);
    animation: ringBreathe 6.2s ease-in-out infinite;
  }
}

.signal-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.14;
  pointer-events: none;
}

.signal-line {
  position: absolute;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(2, 132, 199, 0.18), rgba(255, 255, 255, 0.6), transparent);
  transform-origin: left center;
  animation: signalFlow 5.6s ease-in-out infinite;
}

.signal-line-a { top: 24%; left: 8%; width: 58%; transform: rotate(0deg); }
.signal-line-b { top: 58%; left: 2%; width: 64%; transform: rotate(-10deg); animation-delay: -1.8s; }
.signal-line-c { bottom: 20%; left: 24%; width: 54%; transform: rotate(12deg); animation-delay: -3.2s; }

.signal-node {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 2px solid rgba(255, 255, 255, 0.84);
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 0 7px rgba(14, 165, 233, 0.12), 0 0 24px rgba(14, 165, 233, 0.42);
  animation: nodePulse 3.2s ease-in-out infinite;
}

.node-a { top: 23%; left: 32%; }
.node-b { top: 55%; left: 62%; animation-delay: -0.9s; }
.node-c { bottom: 18%; left: 45%; animation-delay: -1.8s; }

.scan-ribbon {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.54) 48%, rgba(125, 211, 252, 0.16) 52%, transparent 100%);
  transform: translateY(-120%);
  animation: verticalScan 4.6s ease-in-out infinite;
  pointer-events: none;
}

.brand-content {
  position: relative;
  z-index: 1;
  max-width: 470px;
  margin: auto 0;
  animation: contentSlide 0.78s 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 18px;
  padding: 8px 12px;
  border: 1px solid rgba(2, 132, 199, 0.18);
  border-radius: 999px;
  color: #0369a1;
  background: rgba(255, 255, 255, 0.64);
  box-shadow: 0 12px 24px rgba(14, 116, 144, 0.08);
  font-size: 11px;
  font-weight: 800;

  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 0 5px rgba(56, 189, 248, 0.17);
    animation: badgePulse 2.4s ease-in-out infinite;
  }
}

.brand-content h1 {
  margin: 0 0 18px;
  color: transparent;
  background:
    linear-gradient(110deg, #0f2742 0%, #0f2742 32%, #0284c7 48%, #0f2742 64%, #0f2742 100%);
  background-size: 220% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: clamp(34px, 3vw, 46px);
  font-weight: 850;
  line-height: 1.16;
  letter-spacing: 0;
  text-wrap: balance;
  animation: titleShine 5.2s ease-in-out infinite;
}

.brand-content p {
  max-width: 430px;
  margin: 0;
  color: #24516d;
  font-size: 15px;
  line-height: 1.8;
}

.brand-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;

  span {
    padding: 9px 12px;
    border: 1px solid rgba(2, 132, 199, 0.16);
    border-radius: 999px;
    color: #075985;
    background: rgba(255, 255, 255, 0.62);
    box-shadow: none;
    font-size: 12px;
    font-weight: 750;
    animation: chipFloat 5.8s ease-in-out infinite;

    &:nth-child(2) { animation-delay: -1.4s; }
    &:nth-child(3) { animation-delay: -2.7s; }
  }
}

.brand-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  max-width: 460px;
  margin-top: 20px;

  div {
    min-width: 0;
    padding: 15px 14px;
    border: 1px solid rgba(255, 255, 255, 0.66);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.48);
    box-shadow: 0 16px 34px rgba(14, 116, 144, 0.08);
    backdrop-filter: blur(14px);
    transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;

    &:hover {
      border-color: rgba(255, 255, 255, 0.86);
      background: rgba(255, 255, 255, 0.62);
      transform: translateY(-2px);
    }
  }

  strong,
  span {
    display: block;
  }

  strong {
    color: #075985;
    font-size: 24px;
    font-weight: 900;
    line-height: 1;
  }

  span {
    margin-top: 8px;
    color: #42657d;
    font-size: 12px;
    font-weight: 700;
  }
}

.motion-console {
  position: relative;
  overflow: hidden;
  max-width: 460px;
  margin-top: 24px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.38);
  box-shadow:
    0 22px 52px rgba(14, 116, 144, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(16px);
  animation: consoleFloat 4.2s ease-in-out infinite;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 0%, rgba(255, 255, 255, 0.62) 42%, rgba(125, 211, 252, 0.28) 52%, transparent 68%);
    transform: translateX(-110%);
    animation: consoleSweep 3.2s ease-in-out infinite;
  }
}

.console-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #075985;
  font-size: 12px;
  font-weight: 850;

  i {
    width: 42px;
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg, #38bdf8, #e0f7ff);
    box-shadow: 0 0 18px rgba(14, 165, 233, 0.32);
    animation: statusBarPulse 1.8s ease-in-out infinite;
  }
}

.console-visual {
  position: relative;
  z-index: 1;
  min-height: 116px;
  margin-top: 14px;
}

.flow-card {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 58%;
  min-width: 190px;
  padding: 10px 12px;
  border: 1px solid rgba(186, 230, 253, 0.82);
  border-radius: 14px;
  color: #0f2742;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 14px 28px rgba(14, 116, 144, 0.12);
  animation: flowCardLoop 4.8s ease-in-out infinite;

  b,
  em {
    font-style: normal;
    font-size: 12px;
  }

  b { font-weight: 850; }
  em { color: #0284c7; font-weight: 850; }
}

.flow-card-a { top: 0; left: 0; }
.flow-card-b { top: 37px; right: 0; animation-delay: -1.6s; }
.flow-card-c { top: 74px; left: 12%; animation-delay: -3.2s; }

.waveform {
  position: absolute;
  right: 0;
  bottom: 4px;
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 46px;

  i {
    display: block;
    width: 6px;
    height: 18px;
    border-radius: 999px;
    background: linear-gradient(180deg, #0ea5e9, #bae6fd);
    opacity: 0.82;
    animation: waveBar 1.1s ease-in-out infinite;

    &:nth-child(2) { animation-delay: -0.18s; }
    &:nth-child(3) { animation-delay: -0.36s; }
    &:nth-child(4) { animation-delay: -0.54s; }
    &:nth-child(5) { animation-delay: -0.72s; }
    &:nth-child(6) { animation-delay: -0.9s; }
    &:nth-child(7) { animation-delay: -1.08s; }
  }
}

.access-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px;
  background:
    radial-gradient(circle at 50% 42%, rgba(186, 230, 253, 0.38), transparent 28rem),
    linear-gradient(rgba(14, 165, 233, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.024) 1px, transparent 1px),
    #f7fcff;
  background-size: auto, 34px 34px, 34px 34px, auto;
  animation: accessGridDrift 16s linear infinite;
}

.access-halo {
  position: absolute;
  inset: 11% 14%;
  border: 1px solid rgba(14, 165, 233, 0.16);
  border-radius: 34px;
  background:
    radial-gradient(circle at 52% 28%, rgba(255, 255, 255, 0.92), transparent 34%),
    linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.14), transparent),
    linear-gradient(180deg, rgba(255, 255, 255, 0.68), transparent);
  filter: blur(0.2px);
  opacity: 0.92;
  box-shadow:
    0 0 0 28px rgba(255, 255, 255, 0.18),
    0 0 90px rgba(14, 165, 233, 0.12);
  animation: haloShift 5.8s ease-in-out infinite;
  pointer-events: none;
}

.access-card {
  position: relative;
  z-index: 1;
  width: min(100%, 460px);
  overflow: hidden;
  padding: 44px 42px;
  border: 1px solid rgba(125, 211, 252, 0.58);
  border-radius: 24px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 253, 255, 0.88)),
    rgba(255, 255, 255, 0.92);
  box-shadow:
    0 34px 84px rgba(15, 39, 66, 0.15),
    0 12px 36px rgba(14, 165, 233, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(22px);
  animation:
    cardEnter 0.82s 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both,
    cardGlow 3.8s 1.1s ease-in-out infinite;
  transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0), rgba(125, 211, 252, 0.32), rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0));
    transform: translateX(-120%);
    animation: cardSweep 4.8s 0.6s ease-in-out infinite;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 14px;
    border: 1px solid rgba(125, 211, 252, 0.34);
    border-radius: 20px;
    box-shadow: 0 0 42px rgba(125, 211, 252, 0.16) inset;
    animation: innerFrameGlow 3.8s ease-in-out infinite;
    pointer-events: none;
  }

  &:hover {
    border-color: rgba(125, 211, 252, 0.72);
    box-shadow:
      0 30px 72px rgba(15, 39, 66, 0.13),
      0 8px 24px rgba(14, 165, 233, 0.08);
    transform: translateY(-8px);
  }
}

.access-heading {
  margin-bottom: 28px;

  span {
    display: block;
    margin-bottom: 8px;
    color: var(--brand-600);
    font-size: 11px;
    font-weight: 800;
  }

  h2 {
    margin: 0 0 8px;
    color: var(--ink-900);
    font-size: 25px;
    font-weight: 800;
  }

  p {
    margin: 0;
    color: var(--ink-500);
    font-size: 13px;
    line-height: 1.65;
  }
}

:deep(.el-form-item__label) {
  color: var(--ink-700);
  font-size: 12px;
  font-weight: 700;
}

.form-action {
  margin-top: 24px;
  margin-bottom: 0;
}

.login-btn {
  width: 100%;
  height: 50px;
  overflow: hidden;
  border-radius: 14px;
  background:
    linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.34) 18%, transparent 36%) 0 0 / 240% 100%,
    linear-gradient(135deg, #22b7f4, #0284c7);
  box-shadow: 0 16px 36px rgba(14, 165, 233, 0.26);
  font-size: 15px;
  animation: buttonSheen 3.4s ease-in-out infinite;
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    box-shadow: 0 22px 42px rgba(14, 165, 233, 0.34);
    transform: translateY(-2px);
  }
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -2px;

  button {
    border: 0;
    color: var(--brand-700);
    cursor: pointer;
    background: transparent;
    font-size: 12px;
    font-weight: 700;
    transition: color 0.16s ease, transform 0.16s ease;

    &:hover {
      color: #0284c7;
      transform: translateX(1px);
    }
  }
}

:deep(.el-input__wrapper) {
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.86);
  transition: box-shadow 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
}

:deep(.el-input__wrapper.is-focus) {
  background: rgba(248, 253, 255, 0.96);
  box-shadow:
    0 0 0 1px rgba(14, 165, 233, 0.7) inset,
    0 12px 28px rgba(14, 165, 233, 0.12);
  transform: translateY(-1px);
}

.access-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--line-soft);
  color: var(--ink-500);
  font-size: 12px;
  font-weight: 650;

  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12);
    animation: statusBlink 2.2s ease-in-out infinite;
  }
}

.login-footer {
  max-width: 1360px;
  width: 100%;
  margin: 14px auto 0;
  color: var(--ink-500);
  font-size: 12px;
  text-align: center;
  animation: panelRise 0.72s 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes pageGridDrift {
  0% { background-position: 0 0, 0 0, 0 0, 0 0, 0 0; }
  100% { background-position: 0 0, 0 0, 32px 32px, 32px 32px, 0 0; }
}

@keyframes accessGridDrift {
  0% { background-position: 0 0, 0 0, 0 0, 0 0; }
  100% { background-position: 0 0, 34px 34px, 34px 34px, 0 0; }
}

@keyframes ambientLineMove {
  0%, 100% { opacity: 0.18; transform: translate3d(-24px, 0, 0) rotate(-18deg); }
  45% { opacity: 0.72; transform: translate3d(44px, 10px, 0) rotate(-18deg); }
}

@keyframes curtainDrift {
  0% { opacity: 0.42; transform: translate3d(-24%, -4%, 0) rotate(-4deg); }
  100% { opacity: 0.96; transform: translate3d(18%, 4%, 0) rotate(3deg); }
}

@keyframes broadLightPass {
  0%, 100% { opacity: 0.28; transform: translate3d(-18%, -4%, 0) rotate(-10deg); }
  50% { opacity: 0.86; transform: translate3d(24%, 8%, 0) rotate(-6deg); }
}

@keyframes waveSlide {
  0%, 100% { opacity: 0.22; transform: translate3d(-18%, 0, 0) rotate(var(--wave-rotate, -11deg)); }
  50% { opacity: 0.74; transform: translate3d(18%, -10px, 0) rotate(var(--wave-rotate, -11deg)); }
}

@keyframes panelRise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes contentSlide {
  from { opacity: 0; transform: translateX(-18px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes cardEnter {
  from { opacity: 0; transform: translate3d(18px, 12px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes markSweep {
  0%, 58% { transform: translateX(-110%); }
  78%, 100% { transform: translateX(110%); }
}

@keyframes shellSweep {
  0%, 56% { transform: translateX(-120%); }
  74%, 100% { transform: translateX(120%); }
}

@keyframes shellLightSweep {
  0%, 100% { opacity: 0.32; transform: translateX(-42%) rotate(-2deg); }
  50% { opacity: 0.92; transform: translateX(34%) rotate(2deg); }
}

@keyframes cardSweep {
  0%, 62% { transform: translateX(-120%); }
  82%, 100% { transform: translateX(120%); }
}

@keyframes lightVeil {
  0% { opacity: 0.38; transform: translate3d(-20%, -3%, 0) rotate(-9deg); }
  100% { opacity: 0.88; transform: translate3d(16%, 4%, 0) rotate(-4deg); }
}

@keyframes cardGlow {
  0%, 100% {
    border-color: rgba(125, 211, 252, 0.5);
    box-shadow:
      0 34px 84px rgba(15, 39, 66, 0.15),
      0 12px 36px rgba(14, 165, 233, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.96);
  }
  50% {
    border-color: rgba(56, 189, 248, 0.86);
    box-shadow:
      0 42px 100px rgba(15, 39, 66, 0.18),
      0 20px 56px rgba(14, 165, 233, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 1);
  }
}

@keyframes consoleFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes consoleSweep {
  0%, 34% { transform: translateX(-110%); opacity: 0; }
  52% { opacity: 1; }
  78%, 100% { transform: translateX(110%); opacity: 0; }
}

@keyframes statusBarPulse {
  0%, 100% { transform: scaleX(0.68); opacity: 0.58; }
  50% { transform: scaleX(1); opacity: 1; }
}

@keyframes flowCardLoop {
  0%, 100% { transform: translate3d(-8px, 0, 0); opacity: 0.72; }
  50% { transform: translate3d(14px, -4px, 0); opacity: 1; }
}

@keyframes waveBar {
  0%, 100% { height: 14px; opacity: 0.5; }
  50% { height: 44px; opacity: 1; }
}

@keyframes buttonSheen {
  0%, 42% { background-position: -160% 0, 0 0; }
  72%, 100% { background-position: 160% 0, 0 0; }
}

@keyframes titleShine {
  0%, 45% { background-position: 0% 50%; }
  75%, 100% { background-position: 120% 50%; }
}

@keyframes innerFrameGlow {
  0%, 100% { opacity: 0.38; box-shadow: 0 0 34px rgba(125, 211, 252, 0.12) inset; }
  50% { opacity: 0.82; box-shadow: 0 0 54px rgba(56, 189, 248, 0.22) inset; }
}

@keyframes signalFlow {
  0%, 100% { opacity: 0.15; clip-path: inset(0 100% 0 0); }
  45%, 70% { opacity: 0.7; clip-path: inset(0 0 0 0); }
}

@keyframes verticalScan {
  0%, 56% { transform: translateY(-120%); opacity: 0; }
  70% { opacity: 0.5; }
  100% { transform: translateY(120%); opacity: 0; }
}

@keyframes nodePulse {
  0%, 100% { opacity: 0.58; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1.08); }
}

@keyframes ringBreathe {
  0%, 100% { transform: scale(1); opacity: 0.88; }
  50% { transform: scale(1.04); opacity: 0.62; }
}

@keyframes chipFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes haloShift {
  0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.62; }
  50% { transform: translate3d(8px, -8px, 0); opacity: 0.86; }
}

@keyframes statusBlink {
  0%, 100% { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12); }
  50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.05); }
}

@keyframes badgePulse {
  0%, 100% { box-shadow: 0 0 0 5px rgba(56, 189, 248, 0.17); }
  50% { box-shadow: 0 0 0 8px rgba(56, 189, 248, 0.07); }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}

@media (max-width: 960px) {
  .login-page { padding: 18px; }
  .login-topbar { flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
  .system-brand { min-width: 0; }
  .login-shell { grid-template-columns: 1fr; min-height: auto; }
  .brand-panel { display: none; }
  .access-panel { min-height: calc(100vh - 120px); padding: 28px; }
  .access-card { width: min(100%, 430px); padding: 34px 28px; }
}

/* Premium research-console theme */
.login-page {
  padding: 24px 36px 18px;
  color: #d7e2e8;
  background:
    radial-gradient(circle at 18% 8%, rgba(20, 184, 166, 0.13), transparent 30rem),
    radial-gradient(circle at 84% 12%, rgba(69, 94, 163, 0.12), transparent 32rem),
    linear-gradient(rgba(151, 177, 190, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(151, 177, 190, 0.035) 1px, transparent 1px),
    #07141d;
  background-size: auto, auto, 42px 42px, 42px 42px, auto;
}

.ambient-layer {
  &::before,
  &::after {
    opacity: 0.42;
    mix-blend-mode: screen;
    filter: blur(34px);
  }

  &::before {
    background: linear-gradient(98deg, transparent, rgba(20, 184, 166, 0.32), rgba(105, 137, 173, 0.17), transparent);
  }

  &::after {
    background: linear-gradient(108deg, transparent, rgba(42, 78, 97, 0.2), rgba(20, 184, 166, 0.22), transparent);
  }
}

.ambient-curtain {
  opacity: 0.36;
  background:
    linear-gradient(105deg, transparent 12%, rgba(20, 184, 166, 0.14) 34%, transparent 58%),
    linear-gradient(118deg, transparent 28%, rgba(73, 106, 126, 0.16) 50%, transparent 72%);
}

.ambient-wave {
  height: 190px;
  opacity: 0.24;
  filter: blur(28px);
  background: linear-gradient(100deg, transparent, rgba(20, 184, 166, 0.2), rgba(79, 104, 158, 0.13), transparent);
}

.ambient-line {
  height: 1px;
  opacity: 0.34;
  background: linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.42), rgba(165, 192, 207, 0.22), transparent);
}

.login-topbar {
  max-width: 1400px;
  margin-bottom: 18px;
}

.system-brand {
  .brand-mark {
    border: 1px solid rgba(94, 234, 212, 0.28);
    border-radius: 9px;
    background: linear-gradient(145deg, #14b8a6, #0f5f66);
    box-shadow: 0 10px 30px rgba(13, 148, 136, 0.24);
  }

  strong { color: #edf5f7; font-weight: 720; letter-spacing: 0.02em; }
  small { color: #7f98a6; letter-spacing: 0.16em; }
}

.top-visitor-entry {
  border-color: rgba(146, 176, 190, 0.22);
  border-radius: 9px;
  color: #c8d9df;
  background: rgba(14, 35, 46, 0.72);
  box-shadow: none;
  backdrop-filter: blur(18px);

  &:hover {
    border-color: rgba(45, 212, 191, 0.46);
    color: #ffffff;
    background: rgba(16, 55, 72, 0.88);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16);
  }
}

.login-shell {
  grid-template-columns: minmax(500px, 1.05fr) minmax(430px, 0.78fr);
  max-width: 1400px;
  min-height: calc(100vh - 132px);
  border: 1px solid rgba(154, 181, 194, 0.2);
  border-radius: 22px;
  background: #0b202b;
  box-shadow: 0 42px 110px rgba(0, 0, 0, 0.38);
  backdrop-filter: none;

  &::before {
    opacity: 0.26;
    background: linear-gradient(108deg, transparent 24%, rgba(45, 212, 191, 0.12) 46%, transparent 64%);
  }

  &::after {
    opacity: 0.22;
    background: linear-gradient(112deg, transparent 24%, rgba(113, 147, 166, 0.12) 46%, transparent 65%);
  }
}

.brand-panel {
  padding: 68px 64px;
  color: #d9e7eb;
  background:
    radial-gradient(circle at 74% 26%, rgba(20, 184, 166, 0.18), transparent 24rem),
    radial-gradient(circle at 16% 82%, rgba(59, 83, 126, 0.16), transparent 22rem),
    linear-gradient(145deg, #0b202b 0%, #0d2d39 54%, #0b2431 100%);

  &::before {
    opacity: 0.34;
    background:
      linear-gradient(115deg, transparent 14%, rgba(45, 212, 191, 0.12) 38%, transparent 56%),
      radial-gradient(circle at 58% 48%, rgba(20, 184, 166, 0.1), transparent 34%);
  }

  &::after {
    border-color: rgba(94, 234, 212, 0.12);
    box-shadow: 0 0 0 86px rgba(94, 234, 212, 0.025), 0 0 120px rgba(13, 148, 136, 0.12);
  }
}

.signal-field { opacity: 0.3; }
.signal-line { background: linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.28), rgba(150, 175, 190, 0.16), transparent); }
.signal-node { border-color: rgba(205, 236, 235, 0.72); background: #14b8a6; box-shadow: 0 0 0 7px rgba(20, 184, 166, 0.08), 0 0 26px rgba(45, 212, 191, 0.32); }
.scan-ribbon { background: linear-gradient(180deg, transparent, rgba(45, 212, 191, 0.08), transparent); }

.brand-badge {
  border-color: rgba(94, 234, 212, 0.2);
  color: #80dace;
  background: rgba(8, 30, 39, 0.5);
  box-shadow: none;

  i { background: #2dd4bf; box-shadow: 0 0 0 5px rgba(45, 212, 191, 0.1); }
}

.brand-content h1 {
  color: #f1f7f8;
  background: linear-gradient(110deg, #f1f7f8 0%, #f1f7f8 36%, #6ee7d8 50%, #f1f7f8 64%, #f1f7f8 100%);
  background-size: 220% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 760;
  letter-spacing: -0.03em;
}

.brand-content p { color: #a9bbc4; line-height: 1.9; }

.brand-highlights span {
  border-color: rgba(132, 173, 187, 0.17);
  color: #b8cbd2;
  background: rgba(7, 25, 35, 0.34);
  box-shadow: none;
  font-weight: 620;
}

.brand-summary div {
  border-color: rgba(139, 173, 186, 0.16);
  border-radius: 10px;
  background: rgba(7, 25, 35, 0.32);
  box-shadow: none;
  backdrop-filter: blur(12px);
}
.brand-summary strong { color: #6ee7d8; font-size: 22px; }
.brand-summary span { color: #8fa7b2; font-weight: 560; }

.motion-console {
  border-color: rgba(132, 173, 187, 0.16);
  border-radius: 14px;
  background: rgba(6, 22, 30, 0.44);
  box-shadow: 0 22px 52px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
.motion-console::before { background: linear-gradient(100deg, transparent, rgba(45, 212, 191, 0.1), transparent); }
.console-head { color: #9bb3bc; }
.console-head i { background: linear-gradient(90deg, #14b8a6, #4b7180); box-shadow: 0 0 18px rgba(20, 184, 166, 0.2); }
.flow-card { border-color: rgba(132, 173, 187, 0.15); color: #d9e7eb; background: rgba(13, 42, 53, 0.72); box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18); }
.flow-card em { color: #5eead4; }
.waveform i { background: linear-gradient(180deg, #2dd4bf, #315565); }

.access-panel {
  padding: 56px 64px;
  background:
    radial-gradient(circle at 76% 18%, rgba(20, 184, 166, 0.075), transparent 22rem),
    linear-gradient(rgba(15, 95, 102, 0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 95, 102, 0.022) 1px, transparent 1px),
    #f3f5f6;
  background-size: auto, 42px 42px, 42px 42px, auto;
}

.access-halo {
  border-color: rgba(15, 95, 102, 0.1);
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent);
  box-shadow: 0 0 0 28px rgba(255, 255, 255, 0.12), 0 0 80px rgba(13, 148, 136, 0.06);
}

.access-card {
  width: min(100%, 430px);
  padding: 42px 40px;
  border-color: #dde4e8;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 70px rgba(7, 25, 35, 0.12), inset 0 1px 0 #fff;
  animation: cardEnter 0.82s 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both;

  &::before { opacity: 0.22; background: linear-gradient(120deg, transparent, rgba(20, 184, 166, 0.12), transparent); }
  &::after { border-color: rgba(13, 148, 136, 0.08); }
}

.access-heading span { color: #0d9488; letter-spacing: 0.14em; }
.access-heading h2 { color: #101c2b; font-weight: 760; letter-spacing: -0.02em; }
.access-heading p { color: #748290; }
.access-card :deep(.el-form-item__label) { color: #344456; }
.access-card :deep(.el-input__wrapper) { border-radius: 9px; background: #f7f9fa; }
.access-card :deep(.el-input__wrapper.is-focus) { background: #fff; box-shadow: 0 0 0 1px #0d9488 inset, 0 10px 24px rgba(13, 148, 136, 0.08) !important; }
.form-options button { color: #0f5f66; }
.login-btn { border-radius: 9px; background: linear-gradient(135deg, #0d9488, #0f5f66); box-shadow: 0 12px 26px rgba(13, 148, 136, 0.2); }
.access-status { border-top-color: #e8edf1; color: #748290; }
.login-footer { max-width: 1400px; color: #607985; }

@media (max-width: 960px) {
  .login-page { padding: 18px; }
  .access-panel { min-height: calc(100vh - 120px); padding: 26px; }
  .access-card { padding: 34px 28px; }
}

/* 2026 showcase skin — editorial AI laboratory */
.login-page {
  padding: 26px 42px 20px;
  color: #eef1ff;
  background:
    radial-gradient(circle at 17% 28%, rgba(59, 91, 255, .34), transparent 25rem),
    radial-gradient(circle at 72% 4%, rgba(119, 91, 255, .16), transparent 30rem),
    radial-gradient(circle at 88% 84%, rgba(67, 211, 255, .12), transparent 24rem),
    #090b12;
}

.login-page::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .22;
  background-image:
    linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: linear-gradient(135deg, #000, transparent 78%);
}

.ambient-layer::before {
  opacity: .7;
  filter: blur(48px);
  background: linear-gradient(100deg, transparent 6%, rgba(62, 93, 255, .6), rgba(86, 214, 255, .18), transparent 72%);
}
.ambient-layer::after {
  opacity: .42;
  filter: blur(62px);
  background: linear-gradient(112deg, transparent 20%, rgba(133, 93, 255, .38), transparent 76%);
}
.ambient-curtain { opacity: .2; filter: saturate(1.25); }
.ambient-wave { opacity: .32; background: linear-gradient(90deg, transparent, rgba(69, 100, 255, .42), rgba(84, 216, 255, .16), transparent); }
.ambient-line { opacity: .28; background: linear-gradient(90deg, transparent, #7890ff, transparent); }

.login-topbar { max-width: 1480px; margin-bottom: 18px; }
.system-brand .brand-mark {
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 12px;
  background: #3b5bff;
  box-shadow: 0 16px 40px rgba(59,91,255,.34);
}
.system-brand strong { color: #fff; font-weight: 720; }
.system-brand small { color: #7f89a5; }
.top-visitor-entry {
  border-color: rgba(255,255,255,.12);
  border-radius: 999px;
  color: #dfe4f7;
  background: rgba(255,255,255,.055);
  backdrop-filter: blur(18px);
}
.top-visitor-entry:hover { border-color: rgba(120,144,255,.7); background: rgba(59,91,255,.2); }

.login-shell {
  grid-template-columns: minmax(560px, 1.18fr) minmax(430px, .72fr);
  max-width: 1480px;
  min-height: calc(100vh - 142px);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 30px;
  background: rgba(12,15,25,.62);
  box-shadow: 0 44px 120px rgba(0,0,0,.42);
  backdrop-filter: blur(28px);
}
.login-shell::before { opacity: .22; background: linear-gradient(110deg, transparent 20%, rgba(77,109,255,.35), transparent 62%); }
.login-shell::after { opacity: .16; background: linear-gradient(108deg, transparent 34%, rgba(79,219,255,.24), transparent 70%); }

.brand-panel {
  padding: 72px 68px;
  color: #f1f3ff;
  background:
    radial-gradient(circle at 76% 32%, rgba(65,96,255,.27), transparent 22rem),
    linear-gradient(145deg, rgba(13,17,31,.88), rgba(16,21,39,.72));
}
.brand-panel::before { opacity: .3; background: linear-gradient(118deg, transparent 12%, rgba(82,111,255,.26) 38%, transparent 58%); }
.brand-panel::after { border-color: rgba(119,140,255,.18); box-shadow: 0 0 0 90px rgba(83,104,255,.025), 0 0 150px rgba(59,91,255,.16); }
.signal-field { opacity: .4; }
.signal-line { background: linear-gradient(90deg, transparent, rgba(111,137,255,.5), rgba(81,216,255,.18), transparent); }
.signal-node { border-color: #d9e0ff; background: #5570ff; box-shadow: 0 0 0 7px rgba(85,112,255,.11), 0 0 32px rgba(85,112,255,.5); }
.scan-ribbon { background: linear-gradient(180deg, transparent, rgba(78,108,255,.13), transparent); }
.brand-badge { border-color: rgba(135,153,255,.28); color: #aebcff; background: rgba(59,91,255,.1); }
.brand-badge i { background: #6f87ff; box-shadow: 0 0 0 5px rgba(111,135,255,.12); }
.brand-content h1 {
  max-width: 620px;
  color: #fff;
  background: none;
  -webkit-text-fill-color: currentColor;
  font-size: clamp(42px, 4vw, 66px);
  font-weight: 760;
  letter-spacing: -.055em;
  line-height: 1.06;
}
.brand-content p { max-width: 580px; color: #aeb6cc; font-size: 16px; line-height: 1.9; }
.brand-highlights span { border-color: transparent; color: #929bb5; background: transparent; padding-left: 0; }
.brand-highlights span::before { content: '—'; margin-right: 8px; color: #617bff; }
.brand-summary { gap: 10px; }
.brand-summary div { border-color: rgba(255,255,255,.08); border-radius: 14px; background: rgba(255,255,255,.045); }
.brand-summary strong { color: #8fa2ff; }
.brand-summary span { color: #8992aa; }
.motion-console { border-color: rgba(255,255,255,.09); border-radius: 18px; background: rgba(3,5,12,.28); box-shadow: none; }
.console-head { color: #8993ad; }
.console-head i { background: linear-gradient(90deg,#5270ff,#54d8ff); }
.flow-card { border-color: rgba(255,255,255,.08); color: #dfe4f5; background: rgba(255,255,255,.045); box-shadow: none; }
.flow-card em { color: #91a3ff; }
.waveform i { background: linear-gradient(180deg,#6b84ff,#50d4ff); }

.access-panel {
  padding: 58px 64px;
  background:
    radial-gradient(circle at 82% 14%, rgba(59,91,255,.08), transparent 20rem),
    #f7f8fc;
}
.access-halo { border: 0; background: none; box-shadow: none; }
.access-card {
  width: min(100%, 440px);
  padding: 44px 42px;
  border: 1px solid rgba(18,26,54,.08);
  border-radius: 22px;
  background: rgba(255,255,255,.92);
  box-shadow: 0 32px 80px rgba(28,36,70,.14);
  backdrop-filter: blur(20px);
}
.access-card::before { opacity: .2; background: linear-gradient(120deg, transparent, rgba(59,91,255,.14), transparent); }
.access-card::after { border-color: rgba(59,91,255,.08); }
.access-heading span { color: #3b5bff; }
.access-heading h2 { color: #121622; font-size: 28px; }
.access-heading p { color: #7d8496; }
.access-card :deep(.el-form-item__label) { color: #3b4254; }
.access-card :deep(.el-input__wrapper) { min-height: 46px; border-radius: 12px; background: #f6f7fb; }
.access-card :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px #3b5bff inset, 0 8px 24px rgba(59,91,255,.1) !important; }
.form-options button { color: #3b5bff; }
.login-btn { height: 50px; border-radius: 12px; background: #151925; box-shadow: 0 14px 30px rgba(12,16,31,.2); }
.login-btn:hover { background: #3b5bff; box-shadow: 0 16px 34px rgba(59,91,255,.28); }
.access-status { color: #858c9e; }
.login-footer { color: #69728a; }

@media (max-width: 960px) {
  .login-page { padding: 16px; }
  .access-panel { padding: 24px; }
  .access-card { padding: 34px 28px; }
}

/* Motion v2 — orbital intelligence field */
.login-page { animation: none; }
.ambient-curtain,
.ambient-wave,
.ambient-line { display: none; }
.ambient-layer::before,
.ambient-layer::after {
  width: 40rem;
  height: 40rem;
  border: 1px solid rgba(120,140,255,.1);
  border-radius: 50%;
  opacity: .54;
  filter: none;
  mix-blend-mode: screen;
  background:
    repeating-conic-gradient(from 0deg, rgba(112,135,255,.18) 0deg 1deg, transparent 1deg 15deg),
    radial-gradient(circle, rgba(59,91,255,.08), transparent 66%);
}
.ambient-layer::before {
  top: -19rem;
  left: -15rem;
  animation: orbitalFieldRotate 44s linear infinite;
}
.ambient-layer::after {
  right: -18rem;
  bottom: -21rem;
  animation: orbitalFieldRotate 58s linear infinite reverse;
}
.orbit-system {
  position: absolute;
  top: 50%;
  left: 34%;
  width: min(48vw, 720px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  opacity: .78;
}
.orbit-ring {
  position: absolute;
  inset: 50%;
  border: 1px solid rgba(125,145,255,.16);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.orbit-ring::before,
.orbit-ring::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8fa2ff;
  box-shadow: 0 0 0 5px rgba(111,135,255,.08), 0 0 20px rgba(111,135,255,.5);
}
.orbit-ring::before { top: 12%; left: 18%; }
.orbit-ring::after { right: 10%; bottom: 23%; width: 4px; height: 4px; background: #55d9ff; }
.orbit-ring-a { width: 92%; height: 52%; animation: orbitRingA 28s linear infinite; }
.orbit-ring-b { width: 68%; height: 68%; animation: orbitRingB 34s linear infinite reverse; }
.orbit-ring-c { width: 42%; height: 86%; animation: orbitRingC 24s linear infinite; }
.orbit-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 94px;
  height: 94px;
  border: 1px solid rgba(144,161,255,.26);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(93,118,255,.34), rgba(59,91,255,.04) 48%, transparent 70%);
  box-shadow: 0 0 90px rgba(59,91,255,.18);
  transform: translate(-50%,-50%);
  animation: orbitCorePulse 5s ease-in-out infinite;
}
.orbit-core::before,
.orbit-core::after {
  content: '';
  position: absolute;
  inset: 20px;
  border: 1px solid rgba(113,216,255,.3);
  border-radius: 50%;
}
.orbit-core::after { inset: 38px; border: 0; background: #8ba0ff; box-shadow: 0 0 24px #617bff; }
.orbit-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 14px #91a3ff;
}
.particle-a { top: 12%; left: 50%; animation: particleDrift 7s ease-in-out infinite; }
.particle-b { right: 8%; top: 48%; animation: particleDrift 9s -2s ease-in-out infinite; }
.particle-c { left: 14%; bottom: 18%; animation: particleDrift 8s -5s ease-in-out infinite; }
.data-stars { position: absolute; inset: 0; }
.data-stars i {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(190,201,255,.85);
  box-shadow: 0 0 10px rgba(120,145,255,.8);
  animation: starBlink 4s ease-in-out infinite;
}
.data-stars i:nth-child(1) { left: 8%; top: 18%; }
.data-stars i:nth-child(2) { left: 21%; top: 72%; animation-delay: -1s; }
.data-stars i:nth-child(3) { left: 45%; top: 12%; animation-delay: -2.6s; }
.data-stars i:nth-child(4) { left: 62%; top: 64%; animation-delay: -.8s; }
.data-stars i:nth-child(5) { left: 78%; top: 22%; animation-delay: -3.1s; }
.data-stars i:nth-child(6) { left: 91%; top: 74%; animation-delay: -1.7s; }
.data-stars i:nth-child(7) { left: 54%; top: 88%; animation-delay: -2.2s; }
.data-stars i:nth-child(8) { left: 31%; top: 38%; animation-delay: -3.7s; }
.data-stars i:nth-child(9) { left: 72%; top: 46%; animation-delay: -.4s; }

.scan-ribbon {
  top: auto;
  right: 10%;
  bottom: 8%;
  left: 10%;
  width: auto;
  height: 1px;
  opacity: .58;
  background: linear-gradient(90deg, transparent, rgba(109,134,255,.55), transparent);
  animation: dataSweep 6s ease-in-out infinite;
}
.signal-line { animation: signalBreath 6s ease-in-out infinite; }
.signal-node { animation: nodeOrbitPulse 4.8s ease-in-out infinite; }

@keyframes orbitalFieldRotate { to { transform: rotate(360deg); } }
@keyframes orbitRingA {
  from { transform: translate(-50%,-50%) rotate(9deg); }
  to { transform: translate(-50%,-50%) rotate(369deg); }
}
@keyframes orbitRingB {
  from { transform: translate(-50%,-50%) rotate(42deg); }
  to { transform: translate(-50%,-50%) rotate(402deg); }
}
@keyframes orbitRingC {
  from { transform: translate(-50%,-50%) rotate(-28deg); }
  to { transform: translate(-50%,-50%) rotate(332deg); }
}
@keyframes orbitCorePulse {
  0%,100% { transform: translate(-50%,-50%) scale(.96); opacity: .65; }
  50% { transform: translate(-50%,-50%) scale(1.08); opacity: 1; }
}
@keyframes particleDrift {
  0%,100% { transform: translate3d(0,0,0); opacity: .25; }
  50% { transform: translate3d(16px,-18px,0); opacity: 1; }
}
@keyframes starBlink { 0%,100% { opacity: .18; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.7); } }
@keyframes dataSweep { 0%,100% { transform: scaleX(.18); opacity: .08; } 50% { transform: scaleX(1); opacity: .6; } }
@keyframes signalBreath { 0%,100% { opacity: .12; } 50% { opacity: .62; } }
@keyframes nodeOrbitPulse { 0%,100% { transform: scale(.8); opacity: .45; } 50% { transform: scale(1.25); opacity: 1; } }

@media (max-width: 960px) {
  .orbit-system { left: 50%; width: 92vw; opacity: .28; }
}

/* Keep the complete stage visible on common 1366×768 laptops. */
@media (min-width: 961px) and (max-height: 820px) {
  .login-page { height: 100dvh; min-height: 620px; padding: 14px 30px 8px; }
  .login-topbar { min-height: 44px; margin-bottom: 8px; }
  .system-brand .brand-mark { width: 40px; height: 40px; }
  .top-visitor-entry { min-height: 38px; padding: 0 17px; }
  .login-shell {
    min-height: 0;
    height: calc(100dvh - 82px);
    max-height: 704px;
    border-radius: 24px;
  }
  .brand-panel { padding: 30px 50px; }
  .brand-content { max-width: 520px; }
  .brand-badge { margin-bottom: 10px; padding: 6px 10px; }
  .brand-content h1 { margin-bottom: 10px; font-size: clamp(38px, 3.6vw, 52px); }
  .brand-content p { font-size: 13px; line-height: 1.65; }
  .brand-highlights { gap: 8px 14px; margin-top: 12px; }
  .brand-highlights span { padding: 4px 0; font-size: 11px; }
  .brand-summary { gap: 8px; margin-top: 10px; }
  .brand-summary div { padding: 10px 12px; border-radius: 11px; }
  .brand-summary strong { font-size: 19px; }
  .brand-summary span { margin-top: 4px; font-size: 10px; }
  .motion-console { margin-top: 10px; padding: 11px 13px; border-radius: 13px; }
  .console-head { font-size: 10px; }
  .console-head i { height: 5px; }
  .console-visual { min-height: 82px; margin-top: 8px; }
  .flow-card { min-width: 170px; padding: 6px 10px; border-radius: 9px; }
  .flow-card b,.flow-card em { font-size: 10px; }
  .flow-card-b { top: 27px; }
  .flow-card-c { top: 54px; }
  .waveform { height: 34px; gap: 4px; }
  .waveform i { width: 5px; }
  .access-panel { padding: 28px 54px; }
  .access-card { width: min(100%, 420px); padding: 30px 36px; border-radius: 18px; }
  .access-heading { margin-bottom: 20px; }
  .access-heading h2 { margin: 6px 0; font-size: 25px; }
  .access-heading p { font-size: 12px; }
  .access-card :deep(.el-form-item) { margin-bottom: 16px; }
  .access-card :deep(.el-input__wrapper) { min-height: 42px; }
  .login-btn { height: 46px; }
  .access-status { margin-top: 14px; padding-top: 14px; }
  .login-footer { min-height: 14px; margin-top: 4px; font-size: 9px; line-height: 12px; }
  .orbit-system { width: min(44vw, 600px); }
}

@media (min-width: 961px) and (max-height: 700px) {
  .login-page { min-height: 560px; }
  .login-shell { height: calc(100dvh - 74px); }
  .brand-panel { padding: 22px 46px; }
  .brand-content h1 { font-size: 38px; }
  .motion-console { margin-top: 7px; }
  .access-card { padding: 24px 34px; }
  .access-heading { margin-bottom: 14px; }
  .access-card :deep(.el-form-item) { margin-bottom: 12px; }
  .form-options { margin-bottom: 14px; }
}
</style>

