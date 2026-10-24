<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import { loginRequest } from '@/api/user'
import { useTokenStore, type TokenItem } from '@/stores/userToken'
import { locale } from '@/i18n'

const router = useRouter()
const route = useRoute()
const tokenStore = useTokenStore()
const account = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const showPassword = ref(false)
const S = (zh: string, en: string) => (locale.value === 'en' ? en : zh)

const redirect = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') ? value : '/m/home'
})
const hasRouteWaiting = computed(() => redirect.value.includes('/m/receive'))

function backToIntro() {
  if (busy.value) return
  try {
    localStorage.removeItem('zhiyou.onboarding.v1.completed')
  } catch {
    /* The introduction can still be opened without storage. */
  }
  void router.replace({ name: 'MobileOnboarding', query: { redirect: redirect.value } })
}

async function submit() {
  if (busy.value) return
  const username = account.value.trim()
  if (!username) {
    error.value = S('请输入账号', 'Please enter your account')
    return
  }
  if (password.value.length < 6) {
    error.value = S('请输入正确的密码', 'Please enter your password')
    return
  }
  busy.value = true
  error.value = ''
  try {
    const response = await loginRequest({ username, password: password.value })
    if (response.status !== 200 || !response.data?.access_token) {
      error.value = S('账号或密码错误', 'Incorrect account or password')
      return
    }
    tokenStore.saveToken(response.data as TokenItem)
    tokenStore.saveUserInfo({ username, role: 'visitor' })
    await router.replace(redirect.value)
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    error.value =
      status === 401
        ? S('账号或密码错误', 'Incorrect account or password')
        : S('登录失败，请稍后重试', 'Sign-in failed. Please try again.')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  if (tokenStore.token.access_token) void router.replace(redirect.value)
})
</script>

<template>
  <main class="m-auth">
    <header class="auth-top">
      <BrandLogo />
    </header>

    <section class="auth-card">
      <div class="auth-badge" aria-hidden="true">
        <span class="badge-pin"></span>
      </div>
      <p class="eyebrow">{{ S('智游知境', 'Zhiyou Zhijing') }}</p>
      <h1>{{ S('登录你的账号', 'Sign in to your account') }}</h1>
      <p class="auth-copy">
        {{
          hasRouteWaiting
            ? S('登录后会自动打开你在服务站刚选的路线', 'Your selected route opens right after sign-in')
            : S('登录后开始你的数字人导览', 'Sign in to start your digital guided tour')
        }}
      </p>

      <form class="auth-form" novalidate @submit.prevent="submit">
        <label class="field">
          <span>{{ S('账号', 'Account') }}</span>
          <input
            v-model="account"
            type="text"
            autocomplete="username"
            inputmode="text"
            :placeholder="S('昵称或邮箱', 'Nickname or email')"
            :disabled="busy"
          />
        </label>

        <label class="field">
          <span>{{ S('密码', 'Password') }}</span>
          <div class="password-field">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              :placeholder="S('输入密码', 'Enter password')"
              :disabled="busy"
            />
            <button
              type="button"
              class="reveal"
              :aria-label="showPassword ? S('隐藏密码', 'Hide password') : S('显示密码', 'Show password')"
              :disabled="busy"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? S('隐藏', 'Hide') : S('显示', 'Show') }}
            </button>
          </div>
        </label>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <button type="submit" class="submit" :disabled="busy">
          {{ busy ? S('正在登录…', 'Signing in…') : S('登录并获取路线', 'Sign in and open route') }}
          <span v-if="!busy" aria-hidden="true">→</span>
        </button>
      </form>

      <p v-if="hasRouteWaiting" class="route-note">
        <span aria-hidden="true">✓</span>
        {{ S('你的路线已准备好，登录后不会丢失', 'Your route is ready and will not be lost after sign-in') }}
      </p>
    </section>

    <footer class="auth-foot">
      <button type="button" class="back" :disabled="busy" @click="backToIntro">
        {{ S('返回介绍页', 'Back to introduction') }}
      </button>
      <p>{{ S('账号与 App 端一致', 'Use the same account as the app') }}</p>
    </footer>
  </main>
</template>

<style scoped>
.m-auth {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: max(18px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  color: #2a1c55;
  background:
    radial-gradient(660px 460px at 100% -10%, rgba(205, 187, 255, 0.6), transparent 70%),
    radial-gradient(520px 420px at -20% 108%, rgba(214, 232, 255, 0.75), transparent 70%),
    #fbf9ff;
}
.auth-top {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}
.auth-card {
  width: 100%;
  max-width: 440px;
  margin: auto;
  padding: 26px 22px 22px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 24px 60px -30px rgba(62, 45, 121, 0.32),
    0 2px 6px rgba(255, 255, 255, 0.8);
  box-sizing: border-box;
}
.auth-badge {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #f0e9ff, #d9c8ff);
  box-shadow: 0 8px 18px -10px rgba(85, 61, 160, 0.45);
}
.badge-pin {
  width: 18px;
  height: 18px;
  border-radius: 50% 50% 50% 0;
  background: #6d4bd8;
  transform: rotate(-45deg);
  position: relative;
}
.badge-pin::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: #f4efff;
}
.eyebrow {
  margin: 18px 0 0;
  color: #7a6fac;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.auth-card h1 {
  margin: 8px 0 0;
  font-size: clamp(27px, 7.6vw, 33px);
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.auth-copy {
  margin: 10px 0 0;
  color: #756d8e;
  font-size: 14px;
  line-height: 1.7;
}
.auth-form {
  margin-top: 22px;
  display: grid;
  gap: 15px;
}
.field {
  display: grid;
  gap: 8px;
  color: #5f5778;
  font-size: 13px;
}
.field > span {
  padding-left: 2px;
}
.field input {
  width: 100%;
  min-height: 50px;
  box-sizing: border-box;
  border: 1px solid #e4dcf4;
  border-radius: 14px;
  background: #fbfaff;
  color: #2d2450;
  font: inherit;
  font-size: 16px;
  padding: 0 15px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.field input:focus {
  border-color: #9a7fee;
  box-shadow: 0 0 0 3px rgba(154, 127, 238, 0.16);
}
.field input::placeholder {
  color: #b3aac8;
}
.password-field {
  position: relative;
}
.password-field input {
  padding-right: 64px;
}
.reveal {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: #7464b2;
  font: inherit;
  font-size: 13px;
  padding: 8px;
  cursor: pointer;
}
.auth-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff2f1;
  color: #b3434f;
  font-size: 13px;
  line-height: 1.5;
}
.submit {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 17px;
  background: linear-gradient(115deg, #e7dcff 0%, #d5c3ff 52%, #bfa5ff 100%);
  color: #43248f;
  font: inherit;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.submit:disabled {
  opacity: 0.55;
  cursor: default;
}
.route-note {
  margin: 16px 0 0;
  padding: 11px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border-radius: 12px;
  background: #f5f1ff;
  color: #6a5b91;
  font-size: 12px;
  line-height: 1.6;
}
.route-note span {
  color: #5b9b7e;
  font-weight: 700;
}
.auth-foot {
  width: 100%;
  max-width: 440px;
  margin: 18px auto 0;
  text-align: center;
}
.back {
  border: 0;
  background: transparent;
  color: #746b91;
  font: inherit;
  font-size: 13px;
  padding: 8px;
  cursor: pointer;
}
.auth-foot p {
  margin: 4px 0 0;
  color: #a49bb8;
  font-size: 11px;
}
@media (max-height: 700px) {
  .auth-card { margin-top: 14px; margin-bottom: 14px; }
  .auth-badge { width: 46px; height: 46px; border-radius: 15px; }
  .auth-form { margin-top: 16px; gap: 12px; }
  .field input { min-height: 46px; }
  .submit { min-height: 48px; }
}
</style>