<script lang="ts" setup>
import BrandLogo from '@/components/BrandLogo.vue'
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  User,
  Lock,
  Guide,
  ArrowRight,
  Location,
  ChatDotRound,
  MapLocation
} from '@element-plus/icons-vue'
import { ElMessage, ElNotification, type FormInstance, type FormRules } from 'element-plus'
import { loginRequest } from '@/api/user'
import { useTokenStore, type TokenItem } from '@/stores/userToken'
import { AxiosError } from 'axios'
import { request_handler } from '@/api/base'

const router = useRouter()
const route = useRoute()
type EntryMode = 'visitor' | 'admin'
const entryMode = ref<EntryMode>(route.query.redirect ? 'admin' : 'visitor')
const isLogining = ref(false)
const serviceState = ref<'checking' | 'ready' | 'offline'>('checking')
const rememberAccount = ref(true)
const tokenStore = useTokenStore()
const formRef = ref<FormInstance>()
const rememberedAccountKey = 'zhiyou.remembered-account'
const entryPage = ref<HTMLElement>()
let pointerFrame = 0
let motionPreference: MediaQueryList | undefined
function moveAtmosphere(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || motionPreference?.matches) return
  const bounds =
    event.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : null
  if (!bounds) return
  const x = (event.clientX - bounds.left) / bounds.width - 0.5
  const y = (event.clientY - bounds.top) / bounds.height - 0.5
  cancelAnimationFrame(pointerFrame)
  pointerFrame = requestAnimationFrame(() => {
    entryPage.value?.style.setProperty('--pointer-x', x * 48 + 'px')
    entryPage.value?.style.setProperty('--pointer-y', y * 32 + 'px')
  })
}
function resetAtmosphere() {
  cancelAnimationFrame(pointerFrame)
  entryPage.value?.style.setProperty('--pointer-x', '0px')
  entryPage.value?.style.setProperty('--pointer-y', '0px')
}
interface FormType {
  username: string
  password: string
}
const loginForm = reactive<FormType>({ username: '', password: '' })
const rules = reactive<FormRules<FormType>>({
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 18, message: '密码长度必须为 6 至 18 位', trigger: 'blur' }
  ]
})
async function selectEntry(mode: EntryMode, focus = false) {
  if (isLogining.value) return
  entryMode.value = mode
  if (focus) {
    await nextTick()
    document.getElementById('entry-tab-' + mode)?.focus()
  }
}
const onSubmit = async () => {
  if (isLogining.value || !formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  isLogining.value = true
  try {
    const response = await loginRequest({
      username: loginForm.username,
      password: loginForm.password
    })
    if (response.status !== 200) {
      ElMessage.error('账号或密码错误')
      return
    }
    tokenStore.saveToken(response.data as TokenItem)
    tokenStore.saveUserInfo({ username: loginForm.username, role: 'admin' })
    try {
      if (rememberAccount.value) localStorage.setItem(rememberedAccountKey, loginForm.username)
      else localStorage.removeItem(rememberedAccountKey)
    } catch {
      /* Account recall is optional when browser storage is restricted. */
    }
    ElNotification({ title: '登录成功', message: '已进入后台', type: 'success' })
    router.push((route.query.redirect as string) || '/home')
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 401)
      ElMessage.error('账号或密码错误')
    else ElMessage.error('登录失败，请稍后重试')
  } finally {
    isLogining.value = false
  }
}
const enterAsVisitor = () => router.push('/visitor/home')
const handleForgotPassword = () => ElMessage.info('请联系系统管理员重置密码')
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  try {
    loginForm.username = localStorage.getItem(rememberedAccountKey) || ''
  } catch {
    /* Optional account recall. */
  }
  request_handler
    .get('/tour-session/guides', { timeout: 5000 })
    .then(() => {
      serviceState.value = 'ready'
    })
    .catch(() => {
      serviceState.value = 'offline'
    })
  document.documentElement.classList.add('login-viewport')
  document.body.classList.add('login-viewport')
})
onBeforeUnmount(() => {
  cancelAnimationFrame(pointerFrame)
  document.documentElement.classList.remove('login-viewport')
  document.body.classList.remove('login-viewport')
})
</script>

<template>
  <main
    ref="entryPage"
    class="entry-page"
    @pointermove="moveAtmosphere"
    @pointerleave="resetAtmosphere"
  >
    <div class="entry-atmosphere" aria-hidden="true">
      <i class="entry-glow glow-purple"></i><i class="entry-glow glow-blue"></i
      ><i class="entry-glow glow-mint"></i>
      <div class="entry-contour contour-left"></div>
      <div class="entry-contour contour-right"></div>
      <div class="entry-aurora"></div>
      <svg class="entry-flow-map" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke-linecap="round">
          <path class="flow-track" d="M-60 660C100 650 370 520 315 310S70 110 210 25" />
          <path class="flow-track" d="M1480 170C1190 120 1000 260 1160 485S1460 735 1100 920" />
          <path
            class="flow-stream stream-purple"
            pathLength="1200"
            d="M-60 660C100 650 370 520 315 310S70 110 210 25"
          />
          <path
            class="flow-stream stream-blue"
            pathLength="1200"
            d="M1480 170C1190 120 1000 260 1160 485S1460 735 1100 920"
          />
        </g>
      </svg>
      <div class="entry-motes">
        <i
          v-for="n in 9"
          :key="n"
          :style="{
            left: ((n * 31) % 96) + '%',
            top: ((n * 23) % 88) + '%',
            '--mote-delay': -n * 1.3 + 's',
            '--mote-duration': 7 + (n % 4) + 's'
          }"
        ></i>
      </div>
      <svg class="entry-lake" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="entry-lake-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#c6d8f0" stop-opacity=".18" />
            <stop offset="1" stop-color="#b9dcd8" stop-opacity=".35" />
          </linearGradient>
        </defs>
        <path
          d="M0 210 Q160 135 310 220 T630 235 T960 195 T1260 230 T1440 215 V360 H0Z"
          fill="url(#entry-lake-fill)"
        />
        <g class="lake-ripples" fill="none" stroke="#97b5ca" stroke-width="1.3">
          <path d="M-80 230 Q140 195 350 250 T820 260 T1240 228 T1530 250" />
          <path d="M-120 264 Q150 230 370 282 T830 292 T1260 264 T1560 284" />
          <path d="M-60 304 Q200 280 460 320 T960 328 T1500 304" />
        </g>
      </svg>
      <span class="entry-orbit orbit-one"></span><span class="entry-orbit orbit-two"></span
      ><span class="entry-orbit orbit-three"></span>
    </div>
    <header class="entry-header"><BrandLogo /></header>
    <section class="entry-center" aria-label="选择访问入口">
      <div class="entry-card">
        <div class="entry-tabs" role="tablist" aria-label="访问方式">
          <span
            class="entry-tab-indicator"
            :class="{ admin: entryMode === 'admin' }"
            aria-hidden="true"
          ></span>
          <button
            id="entry-tab-visitor"
            type="button"
            role="tab"
            :aria-selected="entryMode === 'visitor'"
            aria-controls="entry-panel-visitor"
            :tabindex="entryMode === 'visitor' ? 0 : -1"
            :disabled="isLogining"
            @click="selectEntry('visitor')"
            @keydown.right.prevent="selectEntry('admin', true)"
            @keydown.end.prevent="selectEntry('admin', true)"
          >
            <el-icon><Guide /></el-icon><span>游客导览</span>
          </button>
          <button
            id="entry-tab-admin"
            type="button"
            role="tab"
            :aria-selected="entryMode === 'admin'"
            aria-controls="entry-panel-admin"
            :tabindex="entryMode === 'admin' ? 0 : -1"
            :disabled="isLogining"
            @click="selectEntry('admin')"
            @keydown.left.prevent="selectEntry('visitor', true)"
            @keydown.home.prevent="selectEntry('visitor', true)"
          >
            <el-icon><User /></el-icon><span>后台登录</span>
          </button>
        </div>
        <Transition name="entry-switch" mode="out-in">
          <section
            v-if="entryMode === 'visitor'"
            id="entry-panel-visitor"
            key="visitor"
            class="entry-content"
            role="tabpanel"
            aria-labelledby="entry-tab-visitor"
            tabindex="0"
          >
            <div class="entry-heading">
              <h1>游客导览</h1>
              <p>选好路线，跟随数字人出发。</p>
            </div>
            <div class="visitor-scene" aria-hidden="true">
              <svg viewBox="0 0 400 170" fill="none">
                <defs>
                  <linearGradient
                    id="entry-mountain"
                    x1="80"
                    y1="50"
                    x2="300"
                    y2="160"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stop-color="#a5a6f7" />
                    <stop offset="1" stop-color="#a6d8e6" />
                  </linearGradient>
                </defs>
                <ellipse cx="200" cy="147" rx="145" ry="15" fill="#e9edf8" />
                <path
                  d="M50 128L112 54Q118 47 125 54L164 97L204 37Q209 29 217 37L300 128Z"
                  fill="url(#entry-mountain)"
                  opacity=".65"
                />
                <path d="M142 129L216 72Q221 68 225 73L271 129Z" fill="#c9d7f3" />
                <path
                  d="M75 132Q136 110 191 140T323 130"
                  stroke="#7abacc"
                  stroke-width="3"
                  stroke-linecap="round"
                />
                <path
                  class="scene-trail"
                  d="M95 124Q140 137 197 120T312 124"
                  stroke="#7775df"
                  stroke-width="2"
                  stroke-dasharray="4 7"
                  stroke-linecap="round"
                />
                <g class="scene-pin">
                  <circle cx="294" cy="70" r="31" fill="#fff" />
                  <path
                    d="M310 66C310 79 294 94 294 94S278 79 278 66A16 16 0 11310 66Z"
                    fill="#5750e9"
                  />
                  <circle cx="294" cy="66" r="5" fill="#fff" />
                </g>
                <path
                  class="scene-star"
                  d="M104 36L108 47L119 51L108 55L104 66L100 55L89 51L100 47Z"
                  fill="#9c96ed"
                />
              </svg>
            </div>
            <div class="entry-features">
              <span
                ><el-icon><MapLocation /></el-icon>景区地图</span
              ><span
                ><el-icon><Location /></el-icon>路线规划</span
              >
              <span
                ><el-icon><ChatDotRound /></el-icon>数字人导览</span
              >
            </div>
            <el-button type="primary" class="entry-primary" @click="enterAsVisitor"
              >进入游客导览<el-icon><ArrowRight /></el-icon
            ></el-button>
          </section>
          <section
            v-else
            id="entry-panel-admin"
            key="admin"
            class="entry-content"
            role="tabpanel"
            aria-labelledby="entry-tab-admin"
            tabindex="0"
          >
            <div class="entry-heading">
              <h1>后台登录</h1>
              <p>管理景点、路线与数字人。</p>
            </div>
            <el-form
              ref="formRef"
              :model="loginForm"
              :rules="rules"
              label-position="top"
              size="large"
              class="entry-form"
              @submit.prevent="onSubmit"
            >
              <el-form-item label="账号" prop="username"
                ><el-input
                  v-model="loginForm.username"
                  :prefix-icon="User"
                  placeholder="输入账号"
                  autocomplete="username"
                  :disabled="isLogining"
              /></el-form-item>
              <el-form-item label="密码" prop="password"
                ><el-input
                  v-model="loginForm.password"
                  :prefix-icon="Lock"
                  type="password"
                  placeholder="输入密码"
                  autocomplete="current-password"
                  show-password
                  :disabled="isLogining"
              /></el-form-item>
              <div class="entry-options">
                <el-checkbox v-model="rememberAccount">记住账号</el-checkbox
                ><button type="button" @click="handleForgotPassword">忘记密码？</button>
              </div>
              <el-button
                type="primary"
                native-type="submit"
                :loading="isLogining"
                class="entry-primary"
                >登录后台<el-icon v-if="!isLogining"><ArrowRight /></el-icon
              ></el-button>
            </el-form>
          </section>
        </Transition>
        <div class="entry-status" :class="serviceState" role="status">
          <i aria-hidden="true"></i>
          <span>{{
            serviceState === 'ready'
              ? '服务可用'
              : serviceState === 'offline'
                ? '服务暂不可用，请稍后重试'
                : '正在连接服务'
          }}</span>
        </div>
      </div>
    </section>
  </main>
</template>

<style lang="scss" scoped>
:global(html.login-viewport),
:global(body.login-viewport),
:global(html.login-viewport #app) {
  min-width: 0;
}
.entry-page,
.entry-page *,
.entry-page *::before,
.entry-page *::after {
  box-sizing: border-box;
}
.entry-page {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  overflow: hidden;
  padding: 24px 40px;
  color: #243248;
  background: #f5f7fb;
}
.entry-atmosphere {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.entry-glow {
  position: absolute;
  display: block;
  width: min(60vw, 780px);
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(65px);
}
.glow-purple {
  left: -18%;
  top: -35%;
  background: radial-gradient(circle, #ccc9f7 0, #e3e4fc 38%, transparent 70%);
  animation: entry-light-drift 18s ease-in-out infinite alternate;
}
.glow-blue {
  right: -18%;
  top: 10%;
  background: radial-gradient(circle, #c0dcf1 0, #dbe9f5 40%, transparent 70%);
  animation: entry-light-drift 22s -8s ease-in-out infinite alternate-reverse;
}
.glow-mint {
  left: 15%;
  bottom: -65%;
  width: 75vw;
  background: radial-gradient(circle, #c6e3dc 0, #e0ece8 40%, transparent 70%);
  animation: entry-light-drift 26s -12s ease-in-out infinite alternate;
}
.entry-contour {
  position: absolute;
  width: 720px;
  height: 470px;
  opacity: 0.16;
  background: url('/images/tour-landscape-outline.svg') center / contain no-repeat;
  animation: entry-landscape-drift 22s ease-in-out infinite alternate;
}
.contour-left {
  left: -170px;
  bottom: 16px;
}
.contour-right {
  right: -240px;
  top: 100px;
  transform: scaleX(-1);
  animation-direction: alternate-reverse;
}
.entry-lake {
  position: absolute;
  bottom: 0;
  left: -6%;
  width: 112%;
  height: 34vh;
  min-height: 180px;
}
.lake-ripples {
  opacity: 0.28;
  animation: entry-ripple-drift 12s ease-in-out infinite alternate;
}
.entry-orbit {
  position: absolute;
  border: 1px solid rgba(131, 145, 203, 0.14);
  border-radius: 50%;
}
.orbit-one {
  left: -220px;
  top: 18%;
  width: 550px;
  height: 550px;
  animation: entry-orbit-breathe 16s ease-in-out infinite;
}
.orbit-two {
  right: -150px;
  bottom: 12%;
  width: 380px;
  height: 380px;
  animation: entry-orbit-breathe 18s -5s ease-in-out infinite;
}
.orbit-three {
  right: 9%;
  top: 8%;
  width: 14px;
  height: 14px;
  background: #c9c5f7;
  border: none;
  animation: entry-pin-float 5s ease-in-out infinite;
}
.entry-header {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  min-height: 44px;
}
.entry-header :deep(.brand-logo) {
  mix-blend-mode: multiply;
}
.entry-center {
  display: grid;
  place-items: center;
  flex: 1;
  padding: 24px 0;
}
.entry-card {
  width: min(100%, 500px);
  padding: 26px 32px 20px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 22px 70px -28px rgba(82, 99, 135, 0.22),
    0 2px 6px rgba(255, 255, 255, 0.8);
  animation: entry-card-reveal 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.entry-tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 6px;
  border-radius: 18px;
  background: #f1f3f9;
  box-shadow:
    inset 2px 2px 6px rgba(151, 162, 186, 0.12),
    inset -2px -2px 6px #fff;
}
.entry-tab-indicator {
  position: absolute;
  top: 6px;
  left: 6px;
  width: calc(50% - 9px);
  height: calc(100% - 12px);
  background: #fff;
  border: 1px solid #e9e8fc;
  border-radius: 13px;
  box-shadow: 0 4px 10px rgba(96, 93, 174, 0.1);
  transition: transform 0.34s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.entry-tab-indicator.admin {
  transform: translateX(calc(100% + 6px));
}
.entry-tabs button {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 9px;
  min-height: 46px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: #6b7790;
  font-size: 17px;
  cursor: pointer;
  transition: color 0.25s;
}
.entry-tabs button[aria-selected='true'] {
  color: #5147df;
  font-weight: 600;
}
.entry-tabs button:disabled {
  cursor: wait;
}
.entry-page button:focus-visible,
.entry-content:focus-visible {
  outline: 2px solid #8178ed;
  outline-offset: 4px;
}
.entry-content {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  padding-top: 24px;
  outline: none;
}
.entry-heading h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
  line-height: 1.35;
}
.entry-heading p {
  margin: 10px 0 0;
  color: #728096;
  font-size: 15px;
  line-height: 1.5;
}
.visitor-scene {
  display: grid;
  place-items: center;
  flex: 1;
  min-height: 170px;
  margin: 8px 0;
}
.visitor-scene svg {
  width: 100%;
  max-width: 360px;
  height: 158px;
  overflow: visible;
}
.scene-pin {
  animation: entry-pin-float 4.8s ease-in-out infinite;
}
.scene-star {
  transform-origin: 104px 51px;
  animation: entry-star-breathe 5s ease-in-out infinite;
}
.scene-trail {
  animation: entry-trail-flow 9s linear infinite;
}
.entry-features {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 0 24px;
  color: #69788c;
}
.entry-features span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  white-space: nowrap;
}
.entry-features .el-icon {
  color: #7a73df;
  font-size: 17px;
}
.entry-primary.el-button {
  width: 100%;
  height: 52px;
  flex: none;
  border-radius: 15px;
  font-size: 17px;
  letter-spacing: 1px;
  transition:
    transform 0.25s,
    box-shadow 0.25s;
}
.entry-primary :deep(.el-icon) {
  margin-left: 12px;
  transition: transform 0.25s;
}
.entry-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -8px rgba(79, 70, 229, 0.4);
}
.entry-primary:hover :deep(.el-icon) {
  transform: translateX(3px);
}
.entry-primary:active {
  transform: translateY(0);
}
.entry-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 18px;
}
.entry-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.entry-form :deep(.el-form-item__label) {
  font-size: 15px;
  height: auto;
  line-height: 22px;
  padding: 0;
  margin-bottom: 8px;
}
.entry-form :deep(.el-input__wrapper) {
  min-height: 48px;
  border-radius: 12px;
}
.entry-form :deep(.el-input__inner) {
  font-size: 16px;
}
.entry-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -1px 0 16px;
}
.entry-options :deep(.el-checkbox) {
  height: 32px;
}
.entry-options :deep(.el-checkbox__label) {
  font-size: 14px;
}
.entry-options button {
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #6962d7;
  font-size: 14px;
  cursor: pointer;
}
.entry-form .entry-primary {
  margin-top: auto;
}
.entry-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid #edf0f6;
  color: #7c889b;
  font-size: 13px;
}
.entry-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a4aab7;
}
.entry-status.ready i {
  background: #6cac9c;
}
.entry-status.offline {
  color: #a96d54;
}
.entry-status.offline i {
  background: #dba37a;
}
.entry-status.checking i {
  animation: entry-star-breathe 1.4s ease-in-out infinite;
}
.entry-switch-enter-active,
.entry-switch-leave-active {
  transition:
    opacity 0.18s,
    transform 0.18s;
}
.entry-switch-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.entry-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@keyframes entry-light-drift {
  from {
    transform: translate3d(-10%, -8%, 0) scale(0.88);
  }
  to {
    transform: translate3d(24%, 18%, 0) scale(1.2);
  }
}
@keyframes entry-landscape-drift {
  from {
    translate: 0 0;
  }
  to {
    translate: 34px -22px;
  }
}
@keyframes entry-ripple-drift {
  from {
    transform: translateX(-45px);
  }
  to {
    transform: translateX(45px);
  }
}
@keyframes entry-orbit-breathe {
  0%,
  100% {
    transform: scale(0.98);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.04);
    opacity: 1;
  }
}
@keyframes entry-pin-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}
@keyframes entry-star-breathe {
  0%,
  100% {
    opacity: 0.6;
    scale: 0.94;
  }
  50% {
    opacity: 1;
    scale: 1.08;
  }
}
@keyframes entry-trail-flow {
  to {
    stroke-dashoffset: -66;
  }
}
@keyframes entry-card-reveal {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Decorative motion stays behind the stable, readable access panel. */
.entry-atmosphere {
  inset: -32px;
  transform: translate(var(--pointer-x, 0px), var(--pointer-y, 0px));
  transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.glow-purple {
  animation-duration: 8s;
  background: radial-gradient(circle, #b8aef4 0, #dcd7fc 38%, transparent 70%);
}
.glow-blue {
  animation-duration: 11s;
  animation-delay: -4s;
  background: radial-gradient(circle, #a5d3ee 0, #d2e7f6 40%, transparent 70%);
}
.glow-mint {
  animation-duration: 13s;
  animation-delay: -6s;
}
.entry-contour {
  animation-duration: 10s;
}
.lake-ripples {
  opacity: 0.4;
  animation-duration: 5s;
}
.entry-aurora {
  position: absolute;
  inset: -30%;
  opacity: 0.44;
  background: conic-gradient(
    from 40deg at 50% 50%,
    transparent 0 15%,
    rgba(169, 155, 243, 0.28) 24%,
    transparent 38% 60%,
    rgba(136, 211, 225, 0.24) 75%,
    transparent 88%
  );
  filter: blur(48px);
  animation: entry-aurora-turn 28s linear infinite;
}
.entry-flow-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.65;
}
.flow-track {
  stroke: #a4abc9;
  stroke-width: 1;
  opacity: 0.18;
}
.flow-stream {
  stroke-width: 2.5;
  stroke-dasharray: 75 1125;
  animation: entry-route-travel 7s linear infinite;
}
.stream-purple {
  stroke: #9b8ce8;
  filter: drop-shadow(0 0 5px #b8a7f1);
}
.stream-blue {
  stroke: #69b9d5;
  animation-delay: -3.5s;
  animation-duration: 9s;
  filter: drop-shadow(0 0 5px #9ed9e9);
}
.entry-motes {
  position: absolute;
  inset: 0;
}
.entry-motes i {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #a69ae7;
  box-shadow: 0 0 10px rgba(153, 133, 230, 0.4);
  animation: entry-mote-rise var(--mote-duration) var(--mote-delay) ease-in-out infinite;
}
.entry-motes i:nth-child(even) {
  width: 3px;
  height: 3px;
  background: #83bbc6;
}
.orbit-one {
  animation: entry-aurora-turn 20s linear infinite;
}
.orbit-two {
  animation: entry-aurora-turn 15s linear infinite reverse;
}
.orbit-one::after,
.orbit-two::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #aea3ee;
  box-shadow:
    0 0 0 7px rgba(174, 163, 238, 0.1),
    0 0 20px rgba(156, 142, 228, 0.3);
}
.orbit-two::after {
  background: #94c4d2;
}
.scene-pin {
  animation-duration: 3s;
}
.scene-trail {
  animation-duration: 3s;
}
.entry-primary.el-button {
  position: relative;
  overflow: hidden;
}
.entry-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(255, 255, 255, 0.2) 49%,
    transparent 68%
  );
  transform: translateX(-130%);
  animation: entry-button-light 5s 1s ease-in-out infinite;
}
@keyframes entry-aurora-turn {
  to {
    transform: rotate(360deg);
  }
}
@keyframes entry-route-travel {
  from {
    stroke-dashoffset: 75;
  }
  to {
    stroke-dashoffset: -1125;
  }
}
@keyframes entry-mote-rise {
  0%,
  100% {
    transform: translate(0, 22px) scale(0.6);
    opacity: 0;
  }
  25% {
    opacity: 0.6;
  }
  75% {
    opacity: 0.35;
  }
  95% {
    transform: translate(22px, -48px) scale(1.2);
    opacity: 0;
  }
}
@keyframes entry-button-light {
  0%,
  55% {
    transform: translateX(-130%);
  }
  85%,
  100% {
    transform: translateX(130%);
  }
}
@media (max-width: 600px) {
  .entry-aurora {
    opacity: 0.28;
  }
  .entry-motes i:nth-child(n + 6) {
    display: none;
  }
  .entry-flow-map {
    opacity: 0.4;
  }
  .entry-page {
    padding: 20px 16px;
  }
  .entry-center {
    padding: 24px 0;
  }
  .entry-card {
    padding: 20px 22px 16px;
    border-radius: 24px;
  }
  .entry-content {
    padding-top: 24px;
    min-height: 400px;
  }
  .entry-heading h1 {
    font-size: 25px;
  }
  .entry-glow {
    width: 120vw;
  }
  .glow-purple {
    left: -65%;
    top: -15%;
  }
  .glow-blue {
    right: -65%;
    top: 15%;
  }
  .glow-mint {
    bottom: -25%;
  }
  .entry-contour {
    width: 520px;
    height: 340px;
    opacity: 0.1;
  }
  .contour-left {
    left: -200px;
    bottom: 0;
  }
  .contour-right {
    right: -330px;
    top: 80px;
  }
  .entry-features {
    gap: 6px;
  }
  .entry-features span {
    font-size: 13px;
    gap: 4px;
  }
}
@media (max-width: 360px) {
  .entry-card {
    padding: 18px 18px 16px;
  }
  .entry-tabs button {
    font-size: 16px;
    gap: 6px;
  }
  .entry-features {
    flex-wrap: wrap;
    justify-content: center;
    column-gap: 14px;
    row-gap: 10px;
    padding-bottom: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .entry-atmosphere {
    transform: none !important;
  }
  .flow-stream,
  .entry-motes,
  .entry-primary::after {
    display: none;
  }
  .entry-page *,
  .entry-page *::before,
  .entry-page *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
