<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { t, locale } from '@/i18n'
import { getContentPreview } from '@/api/tourExperience'
import { getSpotList } from '@/api/scenicSpot'
import TourVisualContext from './TourVisualContext.vue'
import RouteOverview from './RouteOverview.vue'
import { formatTourMessage, isKnowledgeSourceUrl } from '@/utils/tourPresentation'
const props = defineProps<{
  spotId?: number
  spotIds?: number[]
  guideId?: number
  draft?: Record<string, unknown>
  guideDraft?: Record<string, unknown>
}>()
const emit = defineEmits<{ close: [] }>()
const selectedSpot = ref(props.spotId || props.spotIds?.[0] || 0),
  selectedGuide = ref(props.guideId || 0)
const spots = ref<any[]>([]),
  result = ref<any>(null),
  busy = ref(false),
  error = ref(''),
  question = ref(locale.value === 'en' ? 'Please introduce this attraction.' : '请介绍这个景点')
let controller: AbortController | undefined,
  version = 0,
  disposed = false
async function refresh() {
  if (!selectedSpot.value && !props.draft?.spot_name) return
  const own = ++version
  controller?.abort()
  controller = new AbortController()
  busy.value = true
  error.value = ''
  try {
    const response = await getContentPreview(
      {
        spot_id: selectedSpot.value,
        spot_ids: props.spotIds || [],
        guide_id: selectedGuide.value,
        draft: selectedSpot.value === (props.spotId || 0) ? props.draft || {} : {},
        guide_draft: selectedGuide.value === (props.guideId || 0) ? props.guideDraft || {} : {},
        question: question.value,
        language: locale.value
      },
      controller.signal
    )
    if (disposed || own !== version) return
    if (!response.data.success) throw new Error(response.data.message)
    result.value = response.data.data
  } catch (e: any) {
    if (!disposed && own === version && e.code !== 'ERR_CANCELED')
      error.value = t(e.response?.data?.detail || '游客预览暂时无法加载')
  } finally {
    if (own === version) busy.value = false
  }
}
watch([selectedSpot, selectedGuide], refresh)
onMounted(async () => {
  try {
    const response = await getSpotList(1, 200)
    if (disposed) return
    spots.value = response.data.data.spot_list || []
    if (!selectedSpot.value && !props.draft?.spot_name)
      selectedSpot.value = spots.value[0]?.spot_id || 0
    else void refresh()
  } catch {
    error.value = t('景点列表加载失败')
  }
})
onBeforeUnmount(() => {
  disposed = true
  version++
  controller?.abort()
})
</script>
<template>
  <el-drawer
    :model-value="true"
    :title="$t('游客效果与关联预览')"
    size="min(900px,96vw)"
    @close="emit('close')"
    class="visitor-content-preview"
  >
    <p class="preview-note">
      {{ $t('只读预览，不创建游客会话、不保存草稿。示例回答使用本地知识；线上模型措辞可能不同。') }}
    </p>
    <div class="preview-controls">
      <label
        >{{ $t('景点')
        }}<select v-model.number="selectedSpot">
          <option v-if="!spotId && draft?.spot_name" :value="0">{{ $t('当前草稿') }}</option>
          <option v-for="spot in spots" :key="spot.spot_id" :value="spot.spot_id">
            {{ $t(spot.spot_name) }}
          </option>
        </select></label
      ><label
        >{{ $t('数字人')
        }}<select v-model.number="selectedGuide">
          <option :value="0">{{ $t('查看可用数字人') }}</option>
          <option
            v-for="guide in result?.guides || []"
            :key="guide.guide_id"
            :value="guide.guide_id"
          >
            {{ $t(guide.name) }} · {{ $t(guide.enabled ? '已启用' : '未启用') }}
          </option>
        </select></label
      >
    </div>
    <p v-if="error" class="preview-error" role="alert">
      {{ error }} <button type="button" @click="refresh">{{ $t('重试') }}</button>
    </p>
    <p v-if="busy" role="status">{{ $t('正在加载预览…') }}</p>
    <template v-if="result">
      <section class="preview-spot">
        <header>
          <h2>{{ $t(result.spot.spot_name) }}</h2>
          <span v-if="result.draft">{{ $t('含未保存草稿') }}</span>
        </header>
        <p>{{ $t(result.spot.description) }}</p>
        <details v-if="result.spot.history_detail">
          <summary>{{ $t('历史详情') }}</summary>
          <p>{{ $t(result.spot.history_detail) }}</p>
        </details>
      </section>
      <section v-if="result.guide" class="preview-guide">
        <strong>{{ $t(result.guide.name) }}</strong
        ><span>{{ $t(result.guide.character) }}</span
        ><em>{{ $t(result.guide.enabled ? '已启用' : '未启用') }}</em
        ><span>{{ $t('音色配置') }} · {{ result.guide.voice_style }}</span>
      </section>
      <section class="preview-answer">
        <h3>{{ $t('游客讲解示例') }}</h3>
        <form @submit.prevent="refresh">
          <input v-model="question" :aria-label="$t('预览问题')" maxlength="2000" /><button
            :disabled="busy || !question.trim()"
          >
            {{ $t('刷新预览') }}
          </button>
        </form>
        <div class="preview-answer-copy" v-html="formatTourMessage(result.answer, true)"></div>
        <TourVisualContext :context="result.visuals" expanded />
      </section>
      <section v-if="result.route.stops?.length">
        <h3>{{ $t('当前路线顺序') }}</h3>
        <RouteOverview :overview="result.route" compact />
      </section>
      <section class="preview-relations">
        <h3>{{ $t('已保存的关联路线') }}</h3>
        <p v-if="!result.routes.length">{{ $t('尚未加入已保存路线') }}</p>
        <span v-for="route in result.routes" :key="route.route_id">{{ $t(route.name) }}</span>
      </section>
      <section class="preview-knowledge">
        <h3>{{ $t('当前公开索引命中片段') }}</h3>
        <p>{{ $t('未发布草稿不会进入游客知识索引。保存景点与审核知识文档是独立操作。') }}</p>
        <p v-if="!result.evidence.length">
          {{ $t('当前问题未命中已发布片段，请检查知识文档的景点与主题标记。') }}
        </p>
        <details v-for="piece in result.evidence" :key="piece.id">
          <summary>{{ $t(piece.document) }} · {{ $t(piece.spot) }}</summary>
          <p>{{ piece.excerpt }}</p>
          <small>{{ $t('版本') }} {{ piece.version }}</small>
        </details>
        <template v-for="source in result.sources" :key="source.url"
          ><a
            v-if="isKnowledgeSourceUrl(source.url)"
            :href="source.url"
            target="_blank"
            rel="noopener noreferrer"
            >{{ $t(source.title) }}</a
          ></template
        >
      </section>
    </template>
  </el-drawer>
</template>
<style scoped>
.preview-note {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0 0 18px;
}
.preview-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.preview-controls label {
  display: grid;
  gap: 8px;
  font-size: 14px;
}
select,
input {
  min-width: 0;
  max-width: 100%;
  padding: 10px 12px;
  border: 1px solid #e0dfed;
  border-radius: 11px;
  font: inherit;
  background: #f7f8fc;
  color: var(--text);
}
section {
  margin-top: 20px;
  padding: 18px;
  border: 1px solid #e9e7f2;
  border-radius: 18px;
}
h2 {
  font-size: 22px;
  margin: 0;
}
h3 {
  font-size: 17px;
  margin: 0 0 12px;
}
p {
  font-size: 15px;
  line-height: 1.8;
}
header {
  display: flex;
  gap: 14px;
  align-items: center;
}
header span,
.preview-guide em {
  font-size: 13px;
  color: #8b6b37;
  font-style: normal;
}
.preview-guide {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
}
.preview-guide span {
  color: var(--text-secondary);
}
form {
  display: flex;
  gap: 10px;
}
form input {
  flex: 1;
}
button {
  border: 0;
  border-radius: 10px;
  padding: 9px 14px;
  font: inherit;
  background: #6751ba;
  color: white;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
}
.preview-answer-copy {
  margin-top: 16px;
  line-height: 1.9;
  font-size: 16px;
  white-space: normal;
}
.preview-relations span,
.preview-knowledge > a {
  display: inline-block;
  margin: 5px 12px 5px 0;
  color: #6854ba;
  font-size: 14px;
}
.preview-error {
  color: #b42342;
}
.preview-knowledge summary {
  cursor: pointer;
  font-size: 14px;
  line-height: 1.7;
}
.preview-knowledge details {
  padding: 10px 0;
  border-top: 1px solid #eeedf5;
}
.preview-knowledge small {
  font-size: 13px;
  color: var(--text-secondary);
}
@media (max-width: 600px) {
  .preview-controls {
    grid-template-columns: 1fr;
  }
  form {
    flex-wrap: wrap;
  }
  .preview-guide {
    flex-wrap: wrap;
  }
}
</style>
