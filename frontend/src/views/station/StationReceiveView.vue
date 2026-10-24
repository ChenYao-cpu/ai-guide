<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import RouteOverview from '@/components/RouteOverview.vue'
import { request_handler } from '@/api/base'
import {
  previewStationClaim,
  receiveStationClaim,
  stationError,
  type StationPlan
} from '@/api/serviceStation'
import { locale, setLocale, t } from '@/i18n'
const router = useRouter(),
  snapshot = ref<StationPlan | null>(null),
  loading = ref(true),
  receiving = ref(false),
  error = ref(''),
  sessionId = ref<number | null>(null)
const S = (zh: string, en: string) => (locale.value === 'en' ? en : zh)
const pickupCode = ref('')
const serverOrigin = ref('')
const release = ref<{available:boolean;url?:string;version?:string;message?:string}>({available:false})
const appNotice = ref('')
const inWeChat = /MicroMessenger/i.test(navigator.userAgent)
let token = '',
  receipt = ''
onMounted(() => {
  void loadPreview()
  request_handler.get('/service-stations/app-release').then(r=>{release.value=r.data}).catch(()=>{appNotice.value='暂时无法查询安装包，请确认电脑服务已启动'})
})
function openApp() {
  if(inWeChat){appNotice.value='请点微信右上角“…”选择“在浏览器打开”，再点击“在 App 中领取”。安装 App 后重新扫描本页二维码即可接收路线。';return}
  location.href='zhiyouguide://claim?claim='+encodeURIComponent(token)+'&server='+encodeURIComponent(serverOrigin.value)
  appNotice.value='若没有打开 App，请先下载安装；安装后再次扫码即可接收路线。'
}
async function copyCode() {
  try { await navigator.clipboard.writeText(pickupCode.value); appNotice.value='领取码已复制' }
  catch { appNotice.value='请长按下方领取码复制，或截图保存' }
}
function enterCodeInApp() {
  if(inWeChat){appNotice.value='请在系统浏览器打开本页，再打开 App 输入领取码。';return}
  location.href='zhiyouguide://claim?manual=1&server='+encodeURIComponent(serverOrigin.value)
}
async function loadPreview() {
  loading.value = true
  error.value = ''
  token = new URLSearchParams(location.hash.slice(1)).get('claim') || ''
  const params = new URLSearchParams(location.hash.slice(1))
  pickupCode.value = params.get('code') || ''
  const expected = new URL(location.origin); expected.port='18000'
  serverOrigin.value = expected.origin
  if (!token) {
    error.value = S(
      '请扫描服务站生成的游览方案领取码。',
      'Please scan an itinerary pickup code at a service station.'
    )
    loading.value = false
    return
  }
  try {
    const key = 'station-receipt-' + token
    try {
      receipt = sessionStorage.getItem(key) || ''
    } catch {}
    if (!receipt) {
      receipt = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
      try {
        sessionStorage.setItem(key, receipt)
      } catch {}
    }
    const data = await previewStationClaim(token, receipt)
    snapshot.value = data.snapshot
    sessionId.value = data.session_id
    setLocale(data.snapshot.preferences.language)
  } catch (e) {
    error.value = stationError(e)
  } finally {
    loading.value = false
  }
}
async function receive() {
  if (receiving.value) return
  receiving.value = true
  error.value = ''
  try {
    const data = await receiveStationClaim(token, receipt)
    sessionId.value = data.session_id
    try {
      if (data.avatar_access_token)
        sessionStorage.setItem('xingyun-tour-' + data.session_id, data.avatar_access_token)
      sessionStorage.setItem(
        'zhiyou-active-tour',
        JSON.stringify({ id: data.session_id, spot: '', at: Date.now() })
      )
    } catch {
      /* Route pickup remains valid even if browser storage is full. */
    }
    // Remove the pickup token from history once the independently owned tour opens.
    await router.replace('/m/tour/' + data.session_id)
  } catch (e) {
    error.value = stationError(e)
  } finally {
    receiving.value = false
  }
}
</script>
<template>
  <main class="station-receive">
    <header>
      <BrandLogo /><span>{{ S('我的游览方案', 'My walking plan') }}</span>
    </header>
    <section v-if="loading" role="status">
      <h1>{{ S('正在领取您的旅程', 'Preparing your itinerary') }}</h1>
    </section>
    <section v-else-if="snapshot">
      <div class="receive-intro">
      <span class="receive-eyebrow">{{
        S('服务站已为您安排好', 'PLANNED AT YOUR SERVICE STATION')
      }}</span>
      <h1>{{ S('把风景，带着走', 'Your visit, ready to go') }}</h1>
      <p>
        {{ locale === 'en' ? snapshot.station.name_en : snapshot.station.name }} →
        {{
          snapshot.preferences.end_area === 'return'
            ? S('返回本站', 'Return to the station')
            : t(snapshot.route.exit_leg?.to_name)
        }}
      </p>
      </div>
      <div class="receive-stats">
        <strong>{{ snapshot.route.stops.length }} {{ S('站', 'stops') }}</strong
        ><strong>{{ ((snapshot.route.walking_meters || 0) / 1000).toFixed(2) }} km</strong
        ><strong>{{ snapshot.route.total_minutes }} {{ S('分钟', 'min') }}</strong>
      </div>
      <RouteOverview :overview="snapshot.route" :compact="true" :show-statistics="false" />
      <p class="receive-note">
        {{
          S(
            '这是大屏上确认的方案，已包含本站出发与终点步行。开放与排队以现场为准。',
            'This is the plan confirmed at the screen, including walking from the station to your destination. Check access and queues on site.'
          )
        }}
      </p>
      <p v-if="error" role="alert">{{ t(error) }}</p>
      <div class="app-pickup">
        <button @click="openApp">在 App 中领取路线 ↗</button>
        <a v-if="release.available && release.url" class="apk-download" :href="release.url" download>下载 Android App {{ release.version }}</a>
        <p v-else class="receive-note">{{ release.message || '安装包正在准备，请先保存领取码' }}</p>
        <p v-if="pickupCode" class="pickup-label">安装后再次扫码，或在 App 输入领取码（15分钟内有效）</p>
        <button v-if="pickupCode" class="pickup-code" @click="copyCode">{{ pickupCode }}</button>
        <button v-if="pickupCode" class="code-entry" @click="enterCodeInApp">在 App 中输入领取码</button>
        <p class="receive-note">连接电脑：{{ serverOrigin }}。手机和电脑需在同一个 Wi-Fi，电脑服务需保持运行。</p>
        <p v-if="appNotice" role="status">{{ appNotice }}</p>
      </div>
      <button class="web-pickup" :disabled="receiving" @click="receive">
        {{
          receiving
            ? S('正在打开…', 'Opening…')
            : sessionId
              ? S('继续我的游览', 'Continue my visit')
              : S('暂不安装，在网页继续', 'Continue in browser')
        }}
        ↗
      </button>
      <p class="receive-note">
        {{
          S(
            '领取后，大屏结束接待也不会清除您的手机行程。',
            'Your phone itinerary remains available when the public screen resets.'
          )
        }}
      </p>
    </section>
    <section v-else role="alert">
      <h1>{{ S('暂时无法领取', 'Unable to receive this plan') }}</h1>
      <p>{{ t(error) }}</p>
      <button :disabled="loading" @click="loadPreview">
        {{ S('重新连接领取页', 'Retry pickup') }}
      </button>
      <a href="/m/home">{{ S('打开手机端，自行规划', 'Open mobile planning') }} ↗</a>
    </section>
  </main>
</template>
<style scoped>
.station-receive {
  box-sizing: border-box;
  min-height: 100dvh;
  background: #f8fafc;
  color: #1f2937;
  padding: max(22px, env(safe-area-inset-top)) max(22px, env(safe-area-inset-right)) max(22px, env(safe-area-inset-bottom)) max(22px, env(safe-area-inset-left));
  font-family: var(--app-font-family);
  font-size: 17px;
  line-height: 1.8;
}
.station-receive header {
  max-width: 850px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  font-size: 15px;
  color: #4b5563;
}
.station-receive > section {
  box-sizing: border-box;
  max-width: 850px;
  margin: 24px auto;
  background: #ffffff;
  padding: 30px;
  border-radius: 24px;
}
.station-receive h1 {
  font-size: 31px;
  line-height: 1.4;
  margin: 10px 0 15px;
}
.receive-intro { text-align: center; }
.receive-intro p { margin: 12px auto 0; max-width: 34em; text-wrap: balance; }
.receive-eyebrow { display: block; }
.station-receive p {
  color: #4b5563;
}
.receive-eyebrow {
  font-size: 12px;
  color: #4f46e5;
  letter-spacing: 0.1em;
}
.receive-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 18px 0;
  margin: 20px 0;
  text-align: center;
  border-top: 1px solid #eef0f5;
  border-bottom: 1px solid #eef0f5;
  color: #4f46e5;
  font-size: 20px;
}
.station-receive > section > button {
  width: 100%;
  border: 0;
  background: linear-gradient(115deg, #e7dcff 0%, #d5c3ff 50%, #bfa5ff 100%);
  color: #43248f;
  border-radius: 20px;
  padding: 15px;
  font: inherit;
  margin-top: 12px;
  cursor: pointer;
}
.station-receive button:disabled {
  opacity: 0.5;
}
.receive-note {
  font-size: 14px;
}
.station-receive > section > .receive-note { margin: 20px 0 0; line-height: 1.75; }
.station-receive > section > button + .receive-note { text-align: center; color: #64748b; }
.station-receive :deep(.route-overview-panel) { margin: 0; padding: 0; min-width: 0; }
.station-receive :deep(.route-overview-map) { width: 100%; }
.app-pickup { margin-top: 24px; padding-top: 18px; border-top: 1px solid #eef0f5; text-align: center; }
.app-pickup button, .apk-download { box-sizing: border-box; display: flex; width: 100%; min-height: 48px; align-items: center; justify-content: center; padding: 12px; border: 0; border-radius: 13px; background: #4f46e5; color: #fff; font: inherit; text-decoration: none; }
.apk-download { margin-top: 12px; background: #eef2ff; color: #4338ca; }
.app-pickup .pickup-code { background: #f8fafc; color: #1f2937; font: 600 20px monospace; letter-spacing: .12em; user-select: all; -webkit-user-select: all; }
.app-pickup .code-entry { margin-top: 8px; background: transparent; color: #4338ca; font-size: 14px; }
.pickup-label { margin: 18px 0 8px; font-size: 14px; }
.station-receive > section > .web-pickup { background: #f1f5f9; color: #475569; }
.station-receive :deep(.route-map-note),
.station-receive :deep(.route-estimate-note) { font-size: 13px; }
.station-receive :deep(.route-leg-details summary),
.station-receive :deep(.selected-road-leg summary) { min-height: 44px; box-sizing: border-box; display: list-item; align-content: center; }
/* Keep the two fold triggers on the same left edge as the highlighted leg card content. */
.station-receive :deep(.route-leg-details summary) { padding-left: 14px; }
/* Lift the highlighted leg card off the page so its edge reads as a layer above the background. */
.station-receive :deep(.selected-road-leg) {
  box-shadow: 0 2px 4px rgba(76, 63, 138, 0.10), 0 12px 26px -8px rgba(76, 63, 138, 0.32);
}
.station-receive a {
  color: #4f46e5;
}
.station-receive [role='alert'] {
  color: #bd866b;
}
.station-receive :deep(.route-overview-map) {
  height: 280px;
}
@media (max-width: 550px) {
  .station-receive {
    padding: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
  }
  .station-receive header { gap: 6px; flex-direction: column; justify-content: center; text-align: center; }
  .station-receive > section {
    padding: 20px 16px;
    margin: 18px auto;
    overflow-wrap: anywhere;
  }
  .receive-stats { font-size: clamp(15px, 4.5vw, 18px); margin: 18px 0; padding: 14px 0; }
  .station-receive button, .station-receive a { min-height: 44px; }
  .station-receive a { display: inline-flex; align-items: center; }
  .station-receive :deep(.route-overview-map) { height: 220px; }
  .station-receive h1 {
    font-size: 27px;
  }
  .station-receive header > span {
    font-size: 13px;
  }
}
</style>
