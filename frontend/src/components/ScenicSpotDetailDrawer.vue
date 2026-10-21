<script setup lang="ts">
import { computed } from 'vue'
import { Camera, Check, Clock, Close, Compass, Guide, Location, Minus, OfficeBuilding, Plus, ArrowDown } from '@element-plus/icons-vue'
import { t } from '@/i18n'
import ScenicSpotCover from './ScenicSpotCover.vue'

type Spot = {
  spot_id: number
  spot_name: string
  image_path?: string
  city?: string
  description?: string
  visit_duration?: number
  trigger_radius?: number
  location?: string
  history_detail?: string
  best_season?: string
  photo_tips?: string
  tour_tips?: string
  service_facilities?: string
}

const props = defineProps<{
  modelValue: boolean
  spot: Spot | null
  categoryLabel: string
  selected: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  toggle: [spotId: number]
}>()
const guides = computed(() => [
  { key: 'best_season', title: '最佳季节', icon: Compass, text: props.spot?.best_season },
  { key: 'photo_tips', title: '推荐取景', icon: Camera, text: props.spot?.photo_tips },
  { key: 'tour_tips', title: '游览提示', icon: Compass, text: props.spot?.tour_tips },
  { key: 'service_facilities', title: '周边服务', icon: Guide, text: props.spot?.service_facilities },
].filter(item => item.text))
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="t(spot?.spot_name || '景点详情')"
    size="min(660px, 100vw)"
    :with-header="false"
    destroy-on-close
    class="scenic-detail-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="spot" :key="spot.spot_id" class="scenic-detail">
      <button class="detail-close" type="button" :aria-label="t('关闭景点详情')" @click="emit('update:modelValue', false)">
        <el-icon><Close /></el-icon>
      </button>

      <div class="detail-scroll">
        <header class="detail-hero">
          <ScenicSpotCover :spot="spot" class="detail-photo" />
          <div class="detail-hero-shade" />
          <div class="detail-heading">
            <span class="detail-category">{{ t(categoryLabel) }}</span>
            <h2>{{ t(spot.spot_name) }}</h2>
          </div>
        </header>

        <div class="detail-content">
          <section class="detail-facts" :aria-label="t('游览信息')">
            <div class="detail-fact">
              <span class="detail-fact-icon"><el-icon><Clock /></el-icon></span>
              <div><span>{{ t('建议游览') }}</span><strong>{{ spot.visit_duration || 20 }} <span>{{ t('分钟') }}</span></strong></div>
            </div>
            <div class="detail-fact">
              <span class="detail-fact-icon"><el-icon><Location /></el-icon></span>
              <div><span>{{ t('自动播报') }}</span><strong>{{ Math.round(spot.trigger_radius || 50) }} <span>{{ t('米内') }}</span></strong></div>
            </div>
          </section>

          <section class="detail-overview">
            <h3>{{ t('景点概览') }}</h3>
            <p>{{ t(spot.description || '暂无景点简介。') }}</p>
            <div class="detail-location">
              <el-icon><Location /></el-icon>
              <div><span>{{ t('景点位置') }}</span><p>{{ t(spot.location || '颐和园景区内') }}</p></div>
            </div>
          </section>

          <section v-if="spot.history_detail" class="detail-history">
            <h3><span class="detail-section-icon"><el-icon><OfficeBuilding /></el-icon></span>{{ t('历史与文化') }}</h3>
            <p>{{ t(spot.history_detail) }}</p>
          </section>

          <section v-if="guides.length" class="detail-guides">
            <h3>{{ t('游览攻略') }}</h3>
            <details v-for="item in guides" :key="item.key" class="detail-guide">
              <summary>
                <span class="detail-section-icon"><el-icon><component :is="item.icon" /></el-icon></span>
                <span>{{ t(item.title) }}</span>
                <el-icon class="detail-guide-arrow"><ArrowDown /></el-icon>
              </summary>
              <p>{{ t(item.text || '') }}</p>
            </details>
          </section>
        </div>
      </div>

      <footer class="detail-footer">
        <div class="detail-footer-status" :class="{ selected }">
          <span class="detail-footer-icon"><el-icon><Check v-if="selected" /><Location v-else /></el-icon></span>
          <div><strong>{{ t(spot.spot_name) }}</strong><span>{{ t(selected ? '已在行程中' : '规划下一站') }}</span></div>
        </div>
        <button class="detail-route-button" :class="{ selected }" type="button" :aria-pressed="selected" @click="emit('toggle', spot.spot_id)">
          <el-icon><Minus v-if="selected" /><Plus v-else /></el-icon>
          {{ t(selected ? '移出路线' : '加入路线') }}
        </button>
      </footer>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
:global(.scenic-detail-drawer) {
  border-radius: 28px 0 0 28px;
  overflow: hidden;
  box-shadow: -24px 0 90px #242a4326;
}
:global(.scenic-detail-drawer .el-drawer__body) { padding: 0; overflow: hidden; background: #fff; }
.scenic-detail { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; color: #283146; }
.detail-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #d5cfe2 transparent; }
.detail-scroll::-webkit-scrollbar { width: 6px; }
.detail-scroll::-webkit-scrollbar-thumb { background: #d5cfe2; border-radius: 10px; }
.detail-close { position: absolute; z-index: 3; top: 18px; right: 20px; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 1px solid #ffffffc9; border-radius: 14px; color: #343c50; background: #fffffff0; box-shadow: 0 4px 18px #1a24351a; font-size: 21px; cursor: pointer; transition: background .2s, transform .2s; }
.detail-close:hover { background: #fff; transform: rotate(8deg); }
.detail-hero { position: relative; min-height: 244px; display: flex; align-items: flex-end; overflow: hidden; background: #e4e9ea; }
.detail-photo { position: absolute; inset: 0; height: 100%; aspect-ratio: auto; }
.detail-photo :deep(img) { transform: none !important; }
.detail-hero-shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg,#12243203 15%,#10202d24 45%,#101c31c9 100%); }
.detail-heading { position: relative; z-index: 1; padding: 64px 32px 27px; max-width: 100%; }
.detail-category { display: inline-flex; padding: 4px 12px; border-radius: 8px; border: 1px solid #ffffff4d; color: #fff; background: #ffffff21; font-size: 15px; line-height: 1.6; backdrop-filter: blur(8px); }
.detail-heading h2 { margin: 11px 0 0; color: #fff; font-size: 34px; line-height: 1.25; font-weight: 600; letter-spacing: .015em; overflow-wrap: anywhere; text-shadow: 0 2px 12px #0003; }
.detail-content { padding: 24px 30px 32px; }
.detail-facts { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; padding: 18px; border: 1px solid #ece8f4; border-radius: 16px; background: linear-gradient(120deg,#f7f4fc,#f3f8f7); }
.detail-fact { display: flex; align-items: center; gap: 12px; min-width: 0; }
.detail-fact-icon { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; border: 1px solid #e9e1f1; border-radius: 12px; background: #ffffffcf; color: #8767b7; font-size: 22px; }
.detail-fact>div { display: grid; gap: 5px; min-width: 0; }
.detail-fact>div>span { font-size: 15px; color: #7c758b; }
.detail-fact strong { font: 600 23px/1.2 Arial,sans-serif; color: #3f3654; }
.detail-fact strong span { font-size: 16px; font-weight: 400; line-height: 1.5; color: #6d647d; }
.detail-content section+section { margin-top: 26px; }
.detail-content h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 13px; font-size: 21px; line-height: 1.5; font-weight: 600; color: #302b42; }
.detail-content p { margin: 0; font-size: 18px; line-height: 1.9; color: #626779; white-space: pre-line; overflow-wrap: anywhere; }
.detail-location { display: flex; align-items: flex-start; gap: 12px; margin-top: 19px; padding: 15px 16px; border-radius: 12px; background: #f5f7f9; }
.detail-location>.el-icon { flex-shrink: 0; margin-top: 4px; color: #83709f; font-size: 20px; }
.detail-location>div { min-width: 0; }
.detail-location span { display: block; margin-bottom: 3px; font-size: 15px; color: #878295; }
.detail-location p { font-size: 17px; line-height: 1.65; color: #535b70; }
.detail-history { padding-top: 24px; border-top: 1px solid #eeedf3; }
.detail-section-icon { display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 10px; background: #f0eaf8; color: #896bb5; font-size: 19px; }
.detail-history>p { padding-left: 16px; border-left: 2px solid #e5dcee; }
.detail-guides { padding-top: 24px; border-top: 1px solid #eeedf3; }
.detail-guide { border: 1px solid #ebe8f1; border-radius: 13px; overflow: hidden; background: #fff; }
.detail-guide+.detail-guide { margin-top: 10px; }
.detail-guide summary { display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 13px 16px; font-size: 18px; font-weight: 500; color: #4b425c; cursor: pointer; list-style: none; transition: background .2s; }
.detail-guide summary::-webkit-details-marker { display: none; }
.detail-guide summary:hover,.detail-guide[open] summary { background: #faf8fd; }
.detail-guide .detail-section-icon { background: #f4f0f9; }
.detail-guide-arrow { margin-left: auto; color: #a195b1; font-size: 16px; transition: transform .2s; }
.detail-guide[open] .detail-guide-arrow { transform: rotate(180deg); }
.detail-guide>p { padding: 0 18px 20px; background: #faf8fd; font-size: 17px; line-height: 1.85; }
.detail-footer { z-index: 2; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 18px; padding: 18px 26px calc(18px + env(safe-area-inset-bottom)); border-top: 1px solid #ece9f2; background: #fffffffa; box-shadow: 0 -8px 28px #40345e06; }
.detail-footer-status { display: flex; align-items: center; gap: 10px; min-width: 0; }
.detail-footer-icon { display: grid; place-items: center; flex-shrink: 0; height: 38px; width: 38px; border-radius: 12px; color: #9274b6; background: #f1ecf8; font-size: 20px; }
.detail-footer-status.selected .detail-footer-icon { color: #558b7b; background: #eaf4ef; }
.detail-footer-status>div { display: grid; gap: 4px; min-width: 0; }
.detail-footer-status strong { font-size: 18px; line-height: 1.4; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-footer-status>div>span { font-size: 15px; color: #93899e; }
.detail-route-button { display: inline-flex; justify-content: center; align-items: center; flex-shrink: 0; gap: 10px; min-width: 166px; min-height: 50px; padding: 12px 22px; border: 1px solid #7b5fb0; border-radius: 13px; color: #fff; background: linear-gradient(110deg,#9475c5,#7757ad); box-shadow: 0 6px 18px #8b6bb529; font: inherit; font-size: 18px; cursor: pointer; transition: transform .2s,box-shadow .2s; }
.detail-route-button:hover { transform: translateY(-2px); box-shadow: 0 8px 22px #8b6bb540; }
.detail-route-button.selected { border-color: #e2d9ed; color: #7c629f; background: #f4eff9; box-shadow: none; }
.detail-close:focus-visible,.detail-route-button:focus-visible,.detail-guide summary:focus-visible { outline: 3px solid #aa91ce; outline-offset: -3px; }
@media(max-width:520px) {
  :global(.scenic-detail-drawer) { border-radius: 0; }
  .detail-hero { min-height: 216px; }
  .detail-heading { padding: 62px 22px 23px; }
  .detail-heading h2 { font-size: 30px; }
  .detail-content { padding: 20px 20px 28px; }
  .detail-facts { padding: 15px 12px; gap: 10px; }
  .detail-fact { gap: 9px; }
  .detail-fact-icon { width: 33px; height: 38px; font-size: 20px; }
  .detail-fact strong { font-size: 21px; }
  .detail-footer { padding: 15px 18px calc(15px + env(safe-area-inset-bottom)); gap: 12px; }
  .detail-footer-icon { display: none; }
  .detail-route-button { min-width: 145px; padding: 12px 16px; }
}
@media(prefers-reduced-motion:reduce) {
  .detail-close,.detail-route-button,.detail-guide-arrow,.detail-guide summary { transition: none; }
  .detail-close:hover,.detail-route-button:hover { transform: none; }
}
</style>
