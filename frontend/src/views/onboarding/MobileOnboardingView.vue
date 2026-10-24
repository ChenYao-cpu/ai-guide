<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import { locale } from '@/i18n'
import { useTokenStore } from '@/stores/userToken'

const ONBOARDING_KEY = 'zhiyou.onboarding.v1.completed'
const router = useRouter()
const route = useRoute()
const tokenStore = useTokenStore()
const index = ref(0)
const leaving = ref(false)
const S = (zh: string, en: string) => (locale.value === 'en' ? en : zh)

const slides = computed(() =>
  locale.value === 'en'
    ? [
        { image: '/onboarding/intro-1.png', title: 'Your places.\nYour own journey.', copy: 'Pick a route and set off with a digital guide.' },
        { image: '/onboarding/intro-2.png', title: 'Every view\nhas a story.', copy: 'The landscapes and landmarks along the way are introduced as you walk.' },
        { image: '/onboarding/intro-3.png', title: 'Stay curious.\nJust ask.', copy: 'Your route from the service station is waiting after sign-in.' }
      ]
    : [
        { image: '/onboarding/intro-1.png', title: '想去哪里\n就从这里出发', copy: '选一条路线，跟着数字人导览出发。' },
        { image: '/onboarding/intro-2.png', title: '山水有故事\n一路讲给你听', copy: '沿途的风景与典故，边走边听。' },
        { image: '/onboarding/intro-3.png', title: '旅途有疑问\n随时问小导游', copy: '登录后，直接打开你在服务站刚选好的路线。' }
      ]
)

const redirect = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' ? value : ''
})

function nextTarget() {
  const back = redirect.value || '/m/home'
  if (tokenStore.token.access_token) return back
  return { name: 'MobileAuth', query: { redirect: back } }
}

function finish() {
  if (leaving.value) return
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true')
  } catch {
    /* The introduction can still continue when storage is unavailable. */
  }
  leaving.value = true
  void router.replace(nextTarget() as never)
}

function next() {
  if (index.value < slides.value.length - 1) {
    index.value += 1
    return
  }
  finish()
}

function selectSlide(target: number) {
  if (target >= 0 && target < slides.value.length) index.value = target
}

onMounted(() => {
  try {
    if (localStorage.getItem(ONBOARDING_KEY) === 'true') void router.replace(nextTarget() as never)
  } catch {
    /* Show the introduction when storage cannot be read. */
  }
})
</script>

<template>
  <main class="m-onboarding">
    <header class="onboarding-top">
      <BrandLogo />
      <button type="button" class="skip" :disabled="leaving" @click="finish">
        {{ S('跳过', 'Skip') }}
      </button>
    </header>

    <section class="intro-stage" :aria-label="S('游览介绍', 'Introduction')">
      <Transition name="slide" mode="out-in">
        <article :key="index" class="intro-card">
          <div class="intro-halo" aria-hidden="true"></div>
          <img class="intro-image" :src="slides[index].image" :alt="slides[index].title.replace('\n', ' ')" />
          <h1>{{ slides[index].title }}</h1>
          <p>{{ slides[index].copy }}</p>
        </article>
      </Transition>
    </section>

    <footer class="onboarding-bottom">
      <div class="dots" role="group" :aria-label="S('介绍页切换', 'Introduction pages')">
        <button
          v-for="(slide, dot) in slides"
          :key="dot"
          type="button"
          class="dot"
          :class="{ active: dot === index }"
          :aria-label="S('第 ' + (dot + 1) + ' 页', 'Page ' + (dot + 1))"
          :aria-current="dot === index ? 'step' : undefined"
          @click="selectSlide(dot)"
        ></button>
      </div>
      <button type="button" class="primary" :disabled="leaving" @click="next">
        {{ index === slides.length - 1 ? S('开始体验', 'Start exploring') : S('下一步', 'Next') }}
        <span aria-hidden="true">→</span>
      </button>
      <p class="login-hint">{{ S('首次使用会先登录，再自动打开刚选的路线', 'Sign in once, then your selected route opens automatically') }}</p>
    </footer>
  </main>
</template>

<style scoped>
.m-onboarding {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: max(18px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
  color: #2a1c55;
  background:
    radial-gradient(640px 420px at 88% -8%, rgba(205, 187, 255, 0.6), transparent 70%),
    radial-gradient(520px 360px at -10% 100%, rgba(231, 220, 255, 0.8), transparent 70%),
    #fbf9ff;
  overflow: hidden;
}
.onboarding-top {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.skip {
  border: 0;
  background: transparent;
  color: #746b91;
  font: inherit;
  font-size: 15px;
  padding: 10px 4px;
  cursor: pointer;
}
.intro-stage {
  flex: 1;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 0;
  padding: 8px 0;
}
.intro-card {
  width: min(100%, 440px);
  text-align: center;
  position: relative;
}
.intro-halo {
  position: absolute;
  inset: 2% 8% auto;
  height: 74%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(205, 196, 255, 0.5), transparent 68%);
  filter: blur(18px);
  pointer-events: none;
}
.intro-image {
  position: relative;
  display: block;
  width: min(76vw, 330px);
  aspect-ratio: 1;
  margin: 0 auto 8px;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.intro-card h1 {
  position: relative;
  margin: 0;
  white-space: pre-line;
  font-size: clamp(29px, 8.2vw, 38px);
  line-height: 1.45;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #2b1b5c;
}
.intro-card p {
  position: relative;
  margin: 14px auto 0;
  max-width: 24em;
  color: #746b91;
  font-size: 15px;
  line-height: 1.75;
}
.onboarding-bottom {
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.dots {
  display: flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
}
.dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #d7cef0;
  cursor: pointer;
  transition: width 0.28s ease, background 0.28s ease;
}
.dot.active {
  width: 22px;
  background: #6d4bd8;
}
.primary {
  width: 100%;
  min-height: 54px;
  margin-top: 18px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(115deg, #e7dcff 0%, #d5c3ff 52%, #bfa5ff 100%);
  color: #43248f;
  font: inherit;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.primary:disabled, .skip:disabled { opacity: 0.5; cursor: default; }
.login-hint {
  margin: 12px 0 0;
  color: #8b83a5;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
.slide-enter-active, .slide-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.slide-enter-from { opacity: 0; transform: translateX(16px); }
.slide-leave-to { opacity: 0; transform: translateX(-16px); }
@media (max-height: 700px) {
  .intro-image { width: min(52vw, 230px); }
  .intro-card h1 { font-size: clamp(25px, 7.2vw, 32px); }
  .intro-card p { margin-top: 8px; font-size: 14px; }
  .primary { min-height: 48px; margin-top: 12px; }
}
</style>