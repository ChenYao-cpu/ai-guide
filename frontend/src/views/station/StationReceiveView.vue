<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import RouteOverview from '@/components/RouteOverview.vue'
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
let token = '',
  receipt = ''
onMounted(async () => {
  token = new URLSearchParams(location.hash.slice(1)).get('claim') || ''
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
})
async function receive() {
  if (receiving.value) return
  receiving.value = true
  error.value = ''
  try {
    const data = await receiveStationClaim(token, receipt)
    sessionId.value = data.session_id
    if (data.avatar_access_token)
      sessionStorage.setItem('xingyun-tour-' + data.session_id, data.avatar_access_token)
    sessionStorage.setItem(
      'zhiyou-active-tour',
      JSON.stringify({ id: data.session_id, spot: '', at: Date.now() })
    )
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
      <div class="receive-stats">
        <strong>{{ snapshot.route.stops.length }} {{ S('站', 'stops') }}</strong
        ><strong>{{ ((snapshot.route.walking_meters || 0) / 1000).toFixed(2) }} km</strong
        ><strong>{{ snapshot.route.total_minutes }} {{ S('分钟', 'min') }}</strong>
      </div>
      <RouteOverview :overview="snapshot.route" :compact="true" />
      <p class="receive-note">
        {{
          S(
            '这是大屏上确认的方案，已包含本站出发与终点步行。开放、票务和排队以现场为准。',
            'This is the plan confirmed at the screen, including walking from the station to your destination. Check access, tickets and queues on site.'
          )
        }}
      </p>
      <p v-if="error" role="alert">{{ t(error) }}</p>
      <button :disabled="receiving" @click="receive">
        {{
          receiving
            ? S('正在打开…', 'Opening…')
            : sessionId
              ? S('继续我的游览', 'Continue my visit')
              : S('领取并开始手机导览', 'Receive and start my mobile tour')
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
      <a href="/m/home">{{ S('打开手机端，自行规划', 'Open mobile planning') }} ↗</a>
    </section>
  </main>
</template>
<style scoped>
.station-receive {
  min-height: 100dvh;
  background: #eef3ee;
  color: #314638;
  padding: 22px;
  font-family: Arial, 'Microsoft YaHei', sans-serif;
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
  color: #85917a;
}
.station-receive section {
  max-width: 850px;
  margin: 24px auto;
  background: #fffefa;
  padding: 30px;
  border-radius: 24px;
}
.station-receive h1 {
  font-size: 31px;
  line-height: 1.4;
  margin: 10px 0 15px;
}
.station-receive p {
  color: #83917a;
}
.receive-eyebrow {
  font-size: 12px;
  color: #9b8bb4;
  letter-spacing: 0.1em;
}
.receive-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 25px;
  padding: 18px 0;
  color: #8270ac;
  font-size: 20px;
}
.station-receive button {
  width: 100%;
  border: 0;
  background: #6553ae;
  color: white;
  border-radius: 13px;
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
.station-receive a {
  color: #6e5ca9;
}
.station-receive [role='alert'] {
  color: #bd866b;
}
.station-receive :deep(.route-overview-map) {
  height: 280px;
}
@media (max-width: 550px) {
  .station-receive {
    padding: 14px;
  }
  .station-receive section {
    padding: 20px;
  }
  .station-receive h1 {
    font-size: 27px;
  }
  .station-receive header > span {
    font-size: 13px;
  }
}
</style>
