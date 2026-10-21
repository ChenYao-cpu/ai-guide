<script setup lang="ts">
import { Close, Guide } from '@element-plus/icons-vue'
import { t } from '@/i18n'
import type { RouteOverviewData } from '@/api/tourExperience'
import RouteOverview from './RouteOverview.vue'

defineProps<{ modelValue: boolean; overview: RouteOverviewData | null; busy: boolean; error: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; retry: [] }>()
</script>

<template>
  <el-drawer :model-value="modelValue" :title="t('路线与用时')" :show-close="false" size="min(680px,100vw)" destroy-on-close class="selected-itinerary-drawer" @update:model-value="emit('update:modelValue',$event)">
    <template #header><div class="selected-itinerary-heading"><el-icon><Guide /></el-icon><div><h2>{{ t('路线与用时') }}</h2><p>{{ t('调整顺序后，距离与用时会自动更新。') }}</p></div></div><button type="button" class="selected-itinerary-close" :aria-label="t('关闭路线详情')" @click="emit('update:modelValue',false)"><el-icon><Close /></el-icon></button></template>
    <p v-if="busy" class="selected-itinerary-status" role="status">{{ t('正在计算路线详情…') }}</p>
    <div v-else-if="error" class="selected-itinerary-status" role="alert"><p>{{ t('路线详情暂时无法加载') }}</p><button type="button" @click="emit('retry')">{{ t('重试') }}</button></div>
    <RouteOverview v-else-if="overview" :overview="overview" />
    <p v-else class="selected-itinerary-status">{{ t('尚未选择景点') }}</p>
    <template #footer><button type="button" class="selected-itinerary-done" @click="emit('update:modelValue',false)">{{ t('返回行程') }}</button></template>
  </el-drawer>
</template>

<style scoped>
:global(.selected-itinerary-drawer){border-radius:24px 0 0 24px;overflow:hidden;background:#fff;box-shadow:-18px 0 70px #34274a26}
:global(.selected-itinerary-drawer .el-drawer__header){margin:0;padding:24px;border-bottom:1px solid #ece6f2;color:#514366}
:global(.selected-itinerary-drawer .el-drawer__body){padding:24px;overscroll-behavior:contain;scrollbar-width:thin}
:global(.selected-itinerary-drawer .el-drawer__footer){padding:16px 24px calc(16px + env(safe-area-inset-bottom));border-top:1px solid #ece6f2}
.selected-itinerary-heading{display:flex;align-items:center;gap:12px;min-width:0}.selected-itinerary-heading>.el-icon{display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;border-radius:13px;color:#8565b4;background:#f3edf9;font-size:24px}.selected-itinerary-heading h2{font-size:24px;line-height:1.4;font-weight:600;margin:0}.selected-itinerary-heading p{font-size:15px;line-height:1.6;color:#8c8098;margin:6px 0 0}
.selected-itinerary-status{font-size:18px;line-height:1.7;color:#78658e}.selected-itinerary-status button,.selected-itinerary-done{border:1px solid #ded0ee;border-radius:12px;background:#f6f0fc;color:#77529f;padding:11px 20px;font:inherit;font-size:17px;cursor:pointer}.selected-itinerary-done{background:#8664b5;color:#fff;border-color:#8664b5;min-width:140px}.selected-itinerary-done:focus-visible{outline:3px solid #b19bcb;outline-offset:3px}
.selected-itinerary-close{display:grid;place-items:center;flex-shrink:0;align-self:flex-start;margin-left:12px;width:38px;height:38px;border:1px solid #e9e0f2;border-radius:11px;background:#f8f4fc;color:#7d6a93;font-size:21px;cursor:pointer}.selected-itinerary-close:focus-visible{outline:2px solid #b19bcb;outline-offset:2px}
:deep(.route-statistics){padding:18px;border:1px solid #e7deef;background:linear-gradient(110deg,#f6f0fa,#f0f7f4);border-radius:15px;gap:18px}:deep(.route-statistics>span){font-size:16px}:deep(.route-statistics strong){font-size:24px}:deep(.route-leg-details summary){font-size:17px;padding:13px 0}:deep(.route-leg-details li>div){flex-wrap:wrap;font-size:18px}:deep(.route-leg-details li>div>span),:deep(.route-leg-details li p){font-size:16px}:deep(.route-estimate-note){font-size:16px}
@media(max-width:520px){:global(.selected-itinerary-drawer){border-radius:0}:global(.selected-itinerary-drawer .el-drawer__header),:global(.selected-itinerary-drawer .el-drawer__body){padding:20px}.selected-itinerary-heading h2{font-size:22px}:deep(.route-statistics){gap:14px}:deep(.route-statistics strong){font-size:22px}}
</style>
