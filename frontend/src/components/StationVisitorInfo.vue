<script setup lang="ts">
import { computed, ref } from 'vue'
import QRCode from 'qrcode'
import {
  Clock,
  Ticket,
  Bell,
  Notebook,
  Warning,
  Document,
  Reading,
  Ship,
  Sunny,
  Iphone
} from '@element-plus/icons-vue'
import { locale } from '@/i18n'
import { summerPalaceVisitorInfo as info, summerPalaceSeasonAt } from '@/data/parkVisitorInfo'
import type { StationInfo } from '@/api/serviceStation'

const props = defineProps<{ now: number; announcements: StationInfo['announcements'] }>()
const S = (zh: string, en: string) => (locale.value === 'en' ? en : zh)
const active = ref('hours')
const seasonOverride = ref<'peak' | 'quiet' | null>(null)
const season = computed(() => seasonOverride.value || summerPalaceSeasonAt(props.now))
const details = computed(() => info.seasons[season.value])
const tabs = computed(() => [
  { key: 'hours', name: S('开放时间', 'Opening hours'), icon: Clock },
  { key: 'tickets', name: S('票务信息', 'Tickets'), icon: Ticket },
  { key: 'tips', name: S('游园提醒', 'Visitor tips'), icon: Notebook },
  { key: 'notices', name: S('景区公告', 'Park notices'), icon: Bell }
])
const tips = computed(() => [
  {
    icon: Document,
    title: S('入园准备', 'Before entry'),
    text: S(
      '核对购票日期和时段，并按官方购票要求携带入园证件。',
      'Check the date and time slot on your booking and bring the documents required by the official ticket service.'
    )
  },
  {
    icon: Reading,
    title: S('古建与彩画', 'Buildings and paintings'),
    text: S(
      '观赏时请勿触摸彩画或攀爬古建，拍照时留出通道。',
      'Observe without touching paintings or climbing historic structures. Keep paths clear when taking photos.'
    )
  },
  {
    icon: Ship,
    title: S('乘坐游船', 'Boat trips'),
    text: S(
      '先查看码头公告，按要求穿着救生衣。大风、降雨等天气可能影响运营。',
      'Check pier notices and wear a life jacket as instructed. Wind, rain and other weather can affect services.'
    )
  },
  {
    icon: Sunny,
    title: S('步行与休息', 'Walking and breaks'),
    text: S(
      '根据体力安排游程，适当补水和休息；湖岸、桥面及台阶处留意脚下。',
      'Plan a walk that suits your energy, with water and rest breaks. Take care beside the lake, on bridges and on steps.'
    )
  }
])
const showOfficial = ref(false),
  qr = ref(''),
  qrBusy = ref(false)
async function toggleOfficial() {
  showOfficial.value = !showOfficial.value
  if (!showOfficial.value || qr.value || qrBusy.value) return
  qrBusy.value = true
  try {
    qr.value = await QRCode.toDataURL(info.source, {
      width: 240,
      margin: 2,
      color: { dark: '#1f2937', light: '#ffffff' }
    })
  } catch {
    qr.value = ''
  } finally {
    qrBusy.value = false
  }
}
</script>

<template>
  <div class="station-visitor-info">
    <div class="station-section-title">
      <h1>{{ S('游园须知', 'Visitor essentials') }}</h1>
    </div>
    <nav class="visitor-info-tabs" :aria-label="S('须知分类', 'Visitor information categories')">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :aria-pressed="active === tab.key"
        @click="active = tab.key"
      >
        <component :is="tab.icon" aria-hidden="true" />{{ tab.name }}
      </button>
    </nav>
    <section
      class="visitor-info-content"
      :aria-label="tabs.find((tab) => tab.key === active)?.name"
    >
      <template v-if="active === 'hours' || active === 'tickets'">
        <div class="visitor-info-seasons" :aria-label="S('查看季节', 'View season')">
          <button :aria-pressed="season === 'peak'" @click="seasonOverride = 'peak'">
            {{ S('旺季 · 4月—10月', 'Apr–Oct') }}
          </button>
          <button :aria-pressed="season === 'quiet'" @click="seasonOverride = 'quiet'">
            {{ S('淡季 · 11月—次年3月', 'Nov–Mar') }}
          </button>
        </div>
        <template v-if="active === 'hours'">
          <div class="visitor-info-hours">
            <article>
              <h2>{{ S('公园', 'Park') }}</h2>
              <strong>{{ details.park }}</strong>
              <p>
                {{ S('停止入园', 'Last entry') }} <b>{{ details.parkLastEntry }}</b>
              </p>
            </article>
            <article>
              <h2>{{ S('园中园', 'Ticketed gardens') }}</h2>
              <strong>{{ details.gardens }}</strong>
              <p>
                {{ S('停止进入', 'Last entry') }} <b>{{ details.gardensLastEntry }}</b>
              </p>
            </article>
          </div>
          <div class="visitor-info-reminder">
            <Warning aria-hidden="true" />
            <p>
              {{
                S(
                  '佛香阁、德和园、苏州街及颐和园博物馆周一闭园，重点节假日除外。临时开放安排请看当日公告。',
                  'The Tower of Buddhist Incense, Garden of Virtue and Harmony, Suzhou Street and Summer Palace Museum close on Mondays, except major holidays. Check daily notices for changes.'
                )
              }}
            </p>
          </div>
        </template>
        <template v-else>
          <div class="visitor-info-prices">
            <article>
              <h2>{{ S('门票', 'Park admission') }}</h2>
              <strong>¥{{ details.admission }}</strong
              ><span>{{ S('每张', 'per ticket') }}</span>
            </article>
            <article>
              <h2>{{ S('联票', 'Combined ticket') }}</h2>
              <strong>¥{{ details.combined }}</strong
              ><span>{{ S('含门票与园中园门票', 'Park admission and ticketed gardens') }}</span>
            </article>
          </div>
          <h2 class="visitor-info-subtitle">
            {{ S('园中园单独购票', 'Individual garden tickets') }}
          </h2>
          <ul class="visitor-info-garden-prices">
            <li v-for="garden in info.gardens" :key="garden.name">
              <span>{{ locale === 'en' ? garden.nameEn : garden.name }}</span
              ><strong>¥{{ garden.price }}</strong>
            </li>
          </ul>
          <p class="visitor-info-note">
            {{
              S(
                '以上为官网公布的全价票参考，优惠资格、预约场次与实际票价以官方购票页面为准。',
                'Published full-price reference. Check the official ticket service for concessions, time slots and current prices.'
              )
            }}
          </p>
        </template>
      </template>
      <div v-else-if="active === 'tips'" class="visitor-info-tips">
        <article v-for="tip in tips" :key="tip.title">
          <component :is="tip.icon" aria-hidden="true" />
          <div>
            <h2>{{ tip.title }}</h2>
            <p>{{ tip.text }}</p>
          </div>
        </article>
      </div>
      <div v-else class="visitor-info-notices">
        <template v-if="announcements.length"
          ><article v-for="(notice, index) in announcements" :key="index">
            <Bell aria-hidden="true" />
            <p>{{ locale === 'en' ? notice.text_en || notice.text : notice.text }}</p>
          </article></template
        >
        <div v-else class="visitor-info-empty">
          <Bell aria-hidden="true" />
          <h2>{{ S('本站暂无已发布公告', 'No notices published at this station') }}</h2>
          <p>
            {{
              S(
                '临时开放与通行安排，请查看门区公告或咨询现场工作人员。',
                'Check entrance notices or ask on-site staff about temporary access changes.'
              )
            }}
          </p>
        </div>
      </div>
    </section>
    <footer class="visitor-info-footer">
      <p>
        {{ S('来源：颐和园官网 · 核对日期 ', 'Source: Summer Palace website · Checked ')
        }}{{ info.checkedOn }}
      </p>
      <button
        class="station-secondary"
        :aria-expanded="showOfficial"
        aria-controls="visitor-info-official"
        @click="toggleOfficial"
      >
        <Iphone aria-hidden="true" />{{
          S('手机查看官方信息', 'View official information on your phone')
        }}
      </button>
    </footer>
    <section
      v-if="showOfficial"
      id="visitor-info-official"
      class="visitor-info-official"
      :aria-label="S('官方信息二维码', 'Official information QR code')"
    >
      <img
        v-if="qr"
        :src="qr"
        :alt="
          S(
            '扫码查看颐和园官网开放与票务信息',
            'Scan to view official Summer Palace opening hours and tickets'
          )
        "
      />
      <p v-else role="status">
        {{
          qrBusy
            ? S('正在生成二维码…', 'Preparing QR code…')
            : S(
                '二维码生成失败，可点击右侧链接查看。',
                'Could not prepare the code. Use the link instead.'
              )
        }}
      </p>
      <div>
        <h2>{{ S('扫码查看官方信息', 'Scan for official information') }}</h2>
        <p>
          {{
            S(
              '查看最新开放安排、票务及参观须知。',
              'Check current opening arrangements, tickets and visitor information.'
            )
          }}
        </p>
        <a :href="info.source" target="_blank" rel="noopener noreferrer"
          >{{ S('颐和园官网', 'Summer Palace official website') }} ↗</a
        >
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.station-visitor-info {
  padding: 28px 32px 30px;
}
.station-visitor-info h1 {
  margin: 0;
  font-size: 29px;
  font-weight: 600;
  line-height: 1.35;
}
.station-section-title {
  margin-bottom: 26px;
}
.station-visitor-info p {
  margin: 0;
}
.station-visitor-info svg {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.station-visitor-info button {
  font: inherit;
  cursor: pointer;
  border: 0;
  background: transparent;
  color: inherit;
  touch-action: manipulation;
}
.station-visitor-info button:focus-visible,
.station-visitor-info a:focus-visible {
  outline: 3px solid #a5b4fc;
  outline-offset: 4px;
}
.station-visitor-info button {
  transition:
    background 0.2s,
    border-color 0.2s;
}
.visitor-info-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e2e8f0;
}
.visitor-info-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 52px;
  padding: 12px 18px;
  border-radius: 14px;
  color: #4b5563;
  font-size: 20px;
}
.visitor-info-tabs button[aria-pressed='true'] {
  color: #4f46e5;
  background: #eef2ff;
}
.visitor-info-content {
  min-height: 355px;
  padding: 24px 0;
}
.visitor-info-seasons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 24px;
}
.visitor-info-seasons button {
  min-height: 46px;
  padding: 8px 17px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 18px;
  color: #64748b;
}
.visitor-info-seasons button[aria-pressed='true'] {
  color: #4f46e5;
  border-color: #c7d2fe;
  background: #fafaff;
}
.visitor-info-hours,
.visitor-info-prices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.visitor-info-hours article,
.visitor-info-prices article {
  padding: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 22px;
}
.station-visitor-info h2 {
  font-size: 23px;
  font-weight: 600;
  margin: 0 0 15px;
}
.visitor-info-hours strong {
  display: block;
  color: #4f46e5;
  font-size: clamp(25px, 2.2vw, 38px);
  line-height: 1.5;
  white-space: nowrap;
}
.visitor-info-hours p {
  color: #64748b;
  margin-top: 12px;
  font-size: 20px;
}
.visitor-info-hours b {
  color: #1f2937;
  font-weight: 500;
  margin-left: 10px;
}
.visitor-info-reminder {
  display: flex;
  align-items: start;
  gap: 12px;
  margin-top: 24px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 16px;
  color: #4b5563;
  font-size: 19px;
  line-height: 1.8;
}
.visitor-info-reminder svg {
  color: #6366f1;
  margin-top: 5px;
}
.visitor-info-prices strong {
  color: #4f46e5;
  font-size: 42px;
  line-height: 1.5;
}
.visitor-info-prices span {
  display: block;
  font-size: 18px;
  color: #64748b;
  margin-top: 6px;
}
.station-visitor-info .visitor-info-subtitle {
  margin: 26px 0 12px;
  font-size: 21px;
}
.visitor-info-garden-prices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.visitor-info-garden-prices li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 15px 4px;
  border-bottom: 1px solid #eef2f7;
  font-size: 20px;
}
.visitor-info-garden-prices strong {
  color: #4f46e5;
  flex-shrink: 0;
}
.visitor-info-note {
  font-size: 18px;
  color: #64748b;
  margin-top: 22px;
  line-height: 1.8;
}
.visitor-info-tips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.visitor-info-tips article {
  display: flex;
  align-items: start;
  gap: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
}
.visitor-info-tips article > svg {
  color: #6366f1;
  margin-top: 5px;
}
.visitor-info-tips p {
  color: #4b5563;
  line-height: 1.8;
  font-size: 19px;
}
.visitor-info-notices article {
  display: flex;
  align-items: start;
  gap: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  margin-bottom: 16px;
}
.visitor-info-notices article > svg {
  color: #6366f1;
  margin-top: 4px;
}
.visitor-info-notices p {
  font-size: 21px;
  line-height: 1.8;
  color: #4b5563;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.visitor-info-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  min-height: 280px;
  gap: 18px;
  padding: 24px;
}
.visitor-info-empty > svg {
  width: 46px;
  height: 46px;
  color: #a5b4fc;
}
.visitor-info-empty h2 {
  margin: 0;
}
.visitor-info-empty p {
  color: #64748b;
  font-size: 19px;
}
.visitor-info-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-top: 1px solid #e2e8f0;
  padding-top: 22px;
}
.visitor-info-footer p {
  font-size: 17px;
  color: #64748b;
}
.visitor-info-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 54px;
  padding: 13px 22px;
  border-radius: 14px;
  background: #f1f5f9;
  color: #4b5563;
  font-size: 19px;
}
.visitor-info-footer button:hover {
  background: #eef2ff;
  color: #4f46e5;
}
.visitor-info-official a {
  color: #4f46e5;
}
.visitor-info-official {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 20px;
}
.visitor-info-official img {
  width: 180px;
  height: 180px;
  object-fit: contain;
}
.visitor-info-official p {
  font-size: 19px;
  color: #4b5563;
  line-height: 1.8;
  margin: 10px 0;
}
.visitor-info-official a {
  font-size: 19px;
}
@media (min-width: 1700px) {
  .station-visitor-info {
    padding: 34px 42px;
  }
  .station-visitor-info h1 {
    font-size: 35px;
  }
}
@media (max-width: 1150px) {
  .station-visitor-info {
    padding: 24px;
  }
  .visitor-info-tips {
    grid-template-columns: 1fr;
  }
  .visitor-info-hours article,
  .visitor-info-prices article {
    padding: 20px;
  }
  .visitor-info-hours strong {
    font-size: 25px;
  }
}
@media (max-width: 600px) {
  .station-visitor-info {
    padding: 20px;
  }
  .visitor-info-tabs {
    gap: 5px;
  }
  .visitor-info-tabs button {
    padding: 10px 12px;
    font-size: 18px;
  }
  .visitor-info-hours,
  .visitor-info-prices,
  .visitor-info-garden-prices {
    grid-template-columns: 1fr;
  }
  .visitor-info-official {
    flex-direction: column;
    text-align: center;
  }
  .visitor-info-footer button {
    width: 100%;
  }
}
</style>
