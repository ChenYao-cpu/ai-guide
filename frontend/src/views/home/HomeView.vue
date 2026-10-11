<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useTransition } from '@vueuse/core'
import { getDashboardInfoRequest, type DashboardItem } from '@/api/dashboard'
import {
  getComprehensiveAnalytics, getKnowledgeGaps, generateAnalyticsReport,
  type ComprehensiveData, type KnowledgeGapData, type AnalyticsReport,
} from '@/api/analytics'
import PieChartComponent from '@/components/PieChartComponent.vue'
import HeatmapComponent from '@/components/HeatmapComponent.vue'
import * as echarts from 'echarts'
import {
  Picture, Collection, User, Guide, ChatDotRound, RefreshRight,
  CircleCheck, QuestionFilled, WarningFilled, UserFilled, Reading,
} from '@element-plus/icons-vue'

// ── 基础资源 ──
const systemInfo = ref({} as DashboardItem)
const spotCount = ref(0); const docCount = ref(0); const guideCount = ref(0); const routeCount = ref(0)
const spotCountTrans = useTransition(spotCount, { duration: 1100 })
const docCountTrans = useTransition(docCount, { duration: 1100 })
const guideCountTrans = useTransition(guideCount, { duration: 1100 })
const routeCountTrans = useTransition(routeCount, { duration: 1100 })

// ── 综合看板数据 ──
const loading = ref(false)
const gapsLoading = ref(false)
const reportLoading = ref<string | null>(null)
const comprehensive = ref<ComprehensiveData | null>(null)
const knowledgeGaps = ref<KnowledgeGapData | null>(null)
const currentReport = ref<AnalyticsReport | null>(null)
const trendChartRef = ref<HTMLElement | null>(null)
const spotChartRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null
let spotChart: echarts.ECharts | null = null

// ── 统计卡片 ──
const statCards = computed(() => {
  const stats = comprehensive.value?.service_stats
  const emotion = comprehensive.value?.emotion_stats
  return [
    { title: '总交互数', value: emotion?.total || 0, icon: ChatDotRound, sub: '全局交互次数' },
    { title: '好评率', value: (emotion?.positive_rate || 0) + '%', icon: CircleCheck, sub: (emotion?.positive || 0) + ' 条正面' },
    { title: '今日提问', value: stats?.today_questions || 0, icon: QuestionFilled, sub: '今日游客提问' },
    { title: '负面率', value: (emotion?.negative_rate || 0) + '%', icon: WarningFilled, sub: '负面情绪占比' },
    { title: '本周服务', value: stats?.week_sessions || 0, icon: UserFilled, sub: '本周会话数' },
    { title: '知识覆盖', value: knowledgeGaps.value ? Math.max(0, 100 - knowledgeGaps.value.uncertain_answers_count * 2) + '%' : 'N/A', icon: Reading, sub: '知识响应率' },
  ]
})
const questionTypeData = computed(() => {
  const e = comprehensive.value?.emotion_stats; if (!e) return []
  return [{ name: '满意度相关', value: e.positive || 0 }, { name: '一般问题', value: e.neutral || 0 }, { name: '投诉/不满', value: e.negative || 0 }]
})
const emotionStats = computed(() => comprehensive.value?.emotion_stats)
const hourlyData = computed(() => comprehensive.value?.hourly_distribution || [])

// ── 图表 ──
function initTrendChart() {
  if (!trendChartRef.value || !comprehensive.value?.daily_trend) return
  if (trendChart) trendChart.dispose(); trendChart = echarts.init(trendChartRef.value, 'soft-ui')
  const t = comprehensive.value.daily_trend
  trendChart.setOption({
    tooltip: { trigger: 'axis' }, legend: { data: ['服务人次','提问数','满意度(%)'], bottom: 0 },
    grid: { left: 50, right: 50, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: t.map(d => d.date), axisLabel: { interval: 4, rotate: 30 } },
    yAxis: [{ type: 'value', name: '数量' }, { type: 'value', name: '%', max: 100 }],
    series: [
      { name: '服务人次', type: 'line', data: t.map(d => d.sessions), smooth: true, symbol: 'none', areaStyle: { opacity: .1 } },
      { name: '提问数', type: 'line', data: t.map(d => d.questions), smooth: true, symbol: 'none', areaStyle: { opacity: .1 } },
      { name: '满意度(%)', type: 'line', yAxisIndex: 1, data: t.map(d => d.satisfaction), smooth: true, lineStyle: { type: 'dashed' }, symbol: 'none' },
    ],
  })
}
function initSpotChart() {
  if (!spotChartRef.value || !comprehensive.value?.spot_ranking) return
  if (spotChart) spotChart.dispose(); spotChart = echarts.init(spotChartRef.value, 'soft-ui')
  const spots = comprehensive.value.spot_ranking.slice(0, 10).reverse()
  spotChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 100, right: 40, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: '会话数' }, yAxis: { type: 'category', data: spots.map(s => s.spot_name), axisLabel: { fontSize: 11 } },
    series: [{ type: 'bar', data: spots.map(s => ({ value: s.session_count, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#6366f1'},{offset:1,color:'#818cf8'}]), borderRadius: [0,6,6,0] } })), barMaxWidth: 28, label: { show: true, position: 'right', fontSize: 11 } }],
  })
}

// ── 数据加载 ──
async function loadComprehensive() {
  try { const { data } = await getComprehensiveAnalytics(); if (data.code === 0) { comprehensive.value = data.data; await nextTick(); initTrendChart(); initSpotChart() } } catch { /* */ }
}
async function loadKnowledgeGaps() {
  gapsLoading.value = true
  try { const { data } = await getKnowledgeGaps(); if (data.code === 0) knowledgeGaps.value = data.data } catch { /* */ }
  finally { gapsLoading.value = false }
}
async function generateReport(type: 'daily' | 'weekly') {
  reportLoading.value = type
  try {
    const { data } = await generateAnalyticsReport(type)
    if (data.code === 0) { currentReport.value = data.data; ElMessage.success(`${type==='daily'?'日报':'周报'}生成成功！`) }
    else { ElMessage.error(data.message || '报告生成失败') }
  } catch { ElMessage.error('请求失败') }
  finally { reportLoading.value = null }
}

async function loadAll() {
  const { data } = await getDashboardInfoRequest()
  if (data.code === 0) { systemInfo.value = data.data; spotCount.value = data.data.spotCount||0; docCount.value = data.data.docCount||0; guideCount.value = data.data.guideCount||0; routeCount.value = data.data.routeCount||0 }
  loading.value = true
  await Promise.all([loadComprehensive(), loadKnowledgeGaps()])
  loading.value = false
}
onMounted(loadAll)
</script>

<template>
  <div class="dashboard-page" v-loading="loading">
    <!-- Hero -->
    <section class="dashboard-hero">
      <div>

        <h1>综合看板</h1>
      </div>
      <div class="hero-actions">

        <el-button plain :icon="RefreshRight" @click="loadAll">刷新数据</el-button>
      </div>
    </section>

    <!-- 基础资源 -->
    <section class="metric-section">
      <div class="section-heading"><div><h2>基础资源</h2></div></div>
      <el-row :gutter="16">
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><Picture /></el-icon></div><div class="metric-info"><el-statistic title="景区景点" :value="spotCountTrans"><template #suffix><span class="metric-unit">个</span></template></el-statistic></div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><Collection /></el-icon></div><div class="metric-info"><el-statistic title="知识文档" :value="docCountTrans"><template #suffix><span class="metric-unit">份</span></template></el-statistic></div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><User /></el-icon></div><div class="metric-info"><el-statistic title="数字导游" :value="guideCountTrans"><template #suffix><span class="metric-unit">位</span></template></el-statistic></div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><Guide /></el-icon></div><div class="metric-info"><el-statistic title="游览路线" :value="routeCountTrans"><template #suffix><span class="metric-unit">条</span></template></el-statistic></div></el-card></el-col>
      </el-row>
    </section>

    <!-- 运营数据 -->
    <section class="metric-section">
      <div class="section-heading"><div><h2>运营数据</h2></div></div>
      <el-row :gutter="12">
        <el-col :span="4" v-for="card in statCards" :key="card.title">
          <el-card shadow="never" class="metric-card metric-card-sm">
            <div class="metric-icon"><el-icon><component :is="card.icon" /></el-icon></div>
            <div class="metric-info"><el-statistic :title="card.title" :value="card.value" /></div>
          </el-card>
        </el-col>
      </el-row>
    </section>

    <!-- 图表行1: 服务趋势 + 热门景点 -->
    <section class="chart-section">
      <el-row :gutter="16">
        <el-col :span="14">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><strong>近30天服务趋势</strong></div></div></template>
            <div ref="trendChartRef" style="height:360px" />
          </el-card>
        </el-col>
        <el-col :span="10">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><strong>热门景点TOP10</strong></div></div></template>
            <div ref="spotChartRef" style="height:360px" />
          </el-card>
        </el-col>
      </el-row>
    </section>

    <!-- 图表行2: 问题类型 + 活跃时段 -->
    <section class="chart-section">
      <el-row :gutter="16">
        <el-col :span="10">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><strong>问题类型分布</strong></div></div></template>
            <PieChartComponent v-if="questionTypeData.length" :data="questionTypeData" :colors="['#4f46e5','#818cf8','#6366f1','#10b981','#ec4899','#f59e0b','#d15d1a']" height="340px" />
            <el-empty v-else description="暂无数据" :image-size="80" />
          </el-card>
        </el-col>
        <el-col :span="14">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><strong>游客活跃时段分布（近7天）</strong></div></div></template>
            <HeatmapComponent v-if="hourlyData.length" :data="hourlyData" height="340px" />
            <el-empty v-else description="暂无数据" :image-size="80" />
          </el-card>
        </el-col>
      </el-row>
    </section>

    <!-- 图表行3: 知识盲区 + 情感分布 -->
    <section class="chart-section">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header between"><div><strong>知识盲区</strong></div><el-button size="small" type="primary" :loading="gapsLoading" @click="loadKnowledgeGaps">刷新</el-button></div></template>
            <div v-if="knowledgeGaps">
              <div class="gap-summary"><span class="gap-count">{{ knowledgeGaps.uncertain_answers_count }}</span> 个不确定回答<span class="gap-total"> / {{ knowledgeGaps.total_interactions_analyzed }} 条交互</span></div>
              <div v-if="knowledgeGaps.uncertain_samples?.length" class="gap-samples">
                <div v-for="(s,i) in knowledgeGaps.uncertain_samples.slice(0,5)" :key="i" class="gap-sample-item"><el-tag size="small" type="warning" effect="dark">{{ s.keyword_matched }}</el-tag><span class="gap-text">{{ s.guide_response }}</span></div>
              </div>
              <div v-if="knowledgeGaps.top_entities?.length" class="gap-entities mt-2"><h4>高频实体词</h4><div class="entity-tags"><el-tag v-for="(e,i) in knowledgeGaps.top_entities.slice(0,10)" :key="i" size="small" effect="plain" :type="i<3?'danger':'warning'">{{ e.entity }}({{ e.count }})</el-tag></div></div>
            </div>
            <el-empty v-else description="暂无数据" :image-size="60" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><strong>游客情感分布</strong></div></div></template>
            <div v-if="emotionStats" class="emotion-section">
              <div class="emotion-bars">
                <div class="emotion-bar-item"><span class="emotion-label">正面</span><div class="emotion-track"><div class="emotion-fill positive" :style="{width:emotionStats.positive_rate+'%'}">{{ emotionStats.positive_rate }}%</div></div><span class="emotion-count">{{ emotionStats.positive }}</span></div>
                <div class="emotion-bar-item"><span class="emotion-label">中性</span><div class="emotion-track"><div class="emotion-fill neutral" :style="{width:(100-emotionStats.positive_rate-emotionStats.negative_rate).toFixed(1)+'%'}">{{ (100-emotionStats.positive_rate-emotionStats.negative_rate).toFixed(1) }}%</div></div><span class="emotion-count">{{ emotionStats.neutral }}</span></div>
                <div class="emotion-bar-item"><span class="emotion-label">负面</span><div class="emotion-track"><div class="emotion-fill negative" :style="{width:emotionStats.negative_rate+'%'}">{{ emotionStats.negative_rate }}%</div></div><span class="emotion-count">{{ emotionStats.negative }}</span></div>
              </div>
              <div class="emotion-total">总交互数: {{ emotionStats.total }}</div>
            </div>
            <el-empty v-else description="暂无数据" :image-size="80" />
          </el-card>
        </el-col>
      </el-row>
    </section>

    <!-- AI报告 -->
    <section class="chart-section">
      <el-row :gutter="16">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header between"><div><strong>AI 分析报告</strong></div><div class="report-actions"><el-button size="small" type="primary" :loading="reportLoading==='daily'" @click="generateReport('daily')">生成日报</el-button><el-button size="small" type="success" :loading="reportLoading==='weekly'" @click="generateReport('weekly')">生成周报</el-button></div></div></template>
            <div v-if="currentReport" class="report-display">
              <div class="report-meta"><el-tag type="primary" size="large">{{ currentReport.report?.title || currentReport.report_type }}</el-tag><span class="report-period">{{ currentReport.report?.period || '' }}</span><span class="report-time">生成时间: {{ currentReport.generated_at }}</span></div>
              <div class="report-body" v-if="currentReport.report">
                <div class="report-summary">{{ currentReport.report.executive_summary }}</div>
                <el-divider />
                <div class="key-metrics"><div v-for="(m,i) in currentReport.report.key_metrics" :key="i" class="metric-item"><span class="metric-name">{{ m.name }}</span><span class="metric-value" :style="{color:m.trend==='up'?'#059669':m.trend==='down'?'#e11d48':'#818cf8'}">{{ m.value }} {{ m.trend==='up'?'↑':m.trend==='down'?'↓':'→' }}</span><span class="metric-comment">{{ m.comment }}</span></div></div>
                <el-divider />
                <div class="report-recommendations"><h4>改进建议</h4><div v-for="(rec,i) in currentReport.report.recommendations" :key="i" class="rec-item"><el-tag :type="rec.priority==='高'?'danger':rec.priority==='中'?'warning':'info'" size="small">{{ rec.priority }}</el-tag><span>{{ rec.action }}</span></div></div>
              </div>
            </div>
            <el-empty v-else description="尚未生成报告" :image-size="80" />
          </el-card>
        </el-col>
      </el-row>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-page { padding: 16px; max-width: 1440px; margin: 0 auto; }
.dashboard-hero { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; padding: 20px 24px; border-radius: 14px; background: var(--glass); }
.eyebrow { font-size: 11px; letter-spacing: .15em; color: var(--champagne-text); display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.dashboard-hero h1 { margin: 0; font-size: 22px; font-weight: 850; color: var(--champagne-text); }
.dashboard-hero p { margin: 0; font-size: 13px; color: var(--text-secondary); }
.hero-actions { display: flex; align-items: center; gap: 12px; }
.data-status { font-size: 12px; color: var(--success); display: flex; align-items: center; gap: 5px; i { width: 7px;height: 7px;border-radius: 50%;background: var(--success); } }

.metric-section { margin-bottom: 24px; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 6px;
  span { font-size: 11px; letter-spacing: .12em; color: var(--text-muted); }
  h2 { margin: 0; font-size: 17px; font-weight: 800; color: var(--text); }
  p { margin: 0; font-size: 12px; color: var(--text-muted); }
}
.metric-card { border-radius: 10px; display: flex; align-items: center; gap: 12px; padding: 9px 16px; transition: transform .2s; &:hover { transform: translateY(-2px); } }
.metric-card :deep(.el-statistic__number) { font-size: 28px; font-weight: 900; line-height: 1; }
.metric-card :deep(.el-statistic__head) { font-size: 15px; font-weight: 700; margin-bottom: 2px; color: var(--text-secondary); }
.metric-card-sm { padding: 7px 12px; gap: 10px; }
.metric-card-sm :deep(.el-statistic__number) { font-size: 22px; font-weight: 850; line-height: 1; }
.metric-card-sm :deep(.el-statistic__head) { font-size: 13px; font-weight: 700; margin-bottom: 2px; color: var(--text-secondary); }
.metric-icon { width: 52px;height: 52px;display: flex;align-items: center;justify-content: center;border-radius: 12px;background: var(--glass);font-size: 26px;color: var(--champagne-text);flex-shrink: 0; }
.metric-emoji { font-size: 28px; }
.metric-info { flex: 1; min-width: 0; }
.metric-unit { color: var(--text-muted); font-size: 12px; margin-left: 4px; }
.metric-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.chart-section { margin-bottom: 20px; }
.chart-card { border-radius: 12px; }
.chart-header { display: flex; flex-direction: column; gap: 2px;
  span { font-size: 11px; letter-spacing: .1em; color: var(--text-muted); }
  strong { font-size: 15px; font-weight: 700; color: var(--text); }
  &.between { flex-direction: row; justify-content: space-between; align-items: center; }
}

.gap-summary { margin-bottom: 8px; }
.gap-count { font-size: 18px; font-weight: 700; color: var(--danger); }
.gap-total { font-size: 12px; color: var(--text-muted); }
.gap-sample-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--glass-line); }
.gap-text { font-size: 12px; color: var(--text-secondary); }
.gap-entities h4 { font-size: 13px; margin: 0 0 6px; }
.entity-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.mt-2 { margin-top: 10px; }

.emotion-bars { display: flex; flex-direction: column; gap: 14px; }
.emotion-bar-item { display: flex; align-items: center; gap: 10px; }
.emotion-label { width: 40px; font-size: 12px; color: var(--text-secondary); }
.emotion-track { flex: 1; height: 24px; background: var(--glass); border-radius: 6px; overflow: hidden; }
.emotion-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--text); &.positive { background: var(--success); } &.neutral { background: var(--champagne); } &.negative { background: var(--danger); } }
.emotion-count { width: 35px; font-size: 12px; color: var(--text-muted); text-align: right; }
.emotion-total { margin-top: 10px; font-size: 12px; color: var(--text-muted); text-align: center; }

.report-actions { display: flex; gap: 8px; }
.report-display { display: flex; flex-direction: column; gap: 12px; }
.report-meta { display: flex; align-items: center; gap: 16px; }
.report-period { font-size: 13px; color: var(--text-secondary); }
.report-time { font-size: 12px; color: var(--text-muted); margin-left: auto; }
.report-summary { font-size: 14px; color: var(--text); line-height: 1.7; padding: 12px; background: var(--glass); border-radius: 8px; border-left: 4px solid var(--glass-line); }
.key-metrics { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
.metric-item { padding: 10px; background: var(--glass); border-radius: 8px; }
.metric-name { display: block; font-size: 11px; color: var(--text-muted); }
.metric-value { display: block; font-size: 18px; font-weight: 700; margin: 4px 0; }
.metric-comment { display: block; font-size: 11px; color: var(--text-muted); }
.report-recommendations h4 { margin: 0 0 8px; font-size: 14px; }
.rec-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; color: var(--text); &+& { border-top: 1px dashed var(--glass-line); } }

/* Restrained operations-dashboard theme */
.dashboard-page { padding: 22px 24px 36px; }
.dashboard-hero {
  position: relative;
  overflow: hidden;
  align-items: center;
  margin-bottom: 26px;
  padding: 26px 28px;
  border: 1px solid var(--glass-line);
  border-radius: 12px;
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.eyebrow { color: var(--champagne-text); font-weight: 650; }
.dashboard-hero h1 { color: var(--text); font-size: 23px; font-weight: 740; letter-spacing: -0.02em; }
.dashboard-hero p { color: var(--text-muted); }
.data-status { color: var(--champagne-text); }
.data-status i { background: var(--success); box-shadow: var(--glass-shadow); }
.dashboard-hero :deep(.el-button) { border-color: var(--glass-line); color: var(--text-muted); background: var(--glass); }

.metric-section { margin-bottom: 26px; }
.section-heading span { color: var(--champagne-text); font-weight: 650; }
.section-heading h2 { color: var(--text); font-weight: 740; }
.section-heading p { color: var(--text-muted); }
.metric-card {
  border: 1px solid var(--glass-line);
  border-radius: 9px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
  &:hover { border-color: var(--glass-line); transform: translateY(-2px); box-shadow: var(--glass-shadow); }
}
.metric-icon { border-radius: 9px; color: var(--champagne-text); background: var(--glass); }
.metric-card :deep(.el-statistic__head),
.metric-card-sm :deep(.el-statistic__head) { color: var(--text-secondary); }
.metric-card :deep(.el-statistic__number),
.metric-card-sm :deep(.el-statistic__number) { color: var(--text); }
.metric-emoji { filter: saturate(0.72); }
.chart-card { border-color: var(--glass-line); border-radius: 10px; box-shadow: var(--glass-shadow); }
.chart-header span { color: var(--champagne-text); font-weight: 650; }
.chart-header strong { color: var(--text); }
.report-summary { border-left-color: var(--glass-line); background: var(--glass); }
.metric-item { border: 1px solid var(--glass-line); background: var(--glass); }

/* 2026 showcase skin — executive intelligence canvas */
.dashboard-page { max-width: 1520px; padding: 28px 30px 48px; }
.dashboard-hero {
  min-height: 150px;
  margin-bottom: 30px;
  padding: 32px 36px;
  border: 1px solid var(--glass-line);
  border-radius: 20px;
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.dashboard-hero::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5px;
  background: var(--glass);
}
.dashboard-hero::after {
  content: none;
  position: absolute;
  right: 34px;
  bottom: -12px;
  color: var(--text-muted);
  font-size: 74px;
  font-weight: 900;
  letter-spacing: -.06em;
}
.eyebrow { color: var(--champagne-text); font-weight: 720; }
.dashboard-hero h1 { color: var(--text); font-size: 30px; font-weight: 780; letter-spacing: -.045em; }
.dashboard-hero p { color: var(--text-secondary); font-size: 14px; }
.data-status { color: var(--success); }
.data-status i { background: var(--success); box-shadow: var(--glass-shadow); }
.dashboard-hero :deep(.el-button) { border-color: var(--glass-line); color: var(--text); background: var(--glass); }
.dashboard-hero :deep(.el-button:hover) { border-color: var(--glass-line); color: var(--champagne-text); background: var(--glass); }

.metric-section { margin-bottom: 30px; }
.section-heading { margin-bottom: 16px; }
.section-heading span { color: var(--champagne-text); font-weight: 720; }
.section-heading h2 { color: var(--text); font-size: 19px; font-weight: 760; }
.section-heading p { color: var(--text-muted); }
.metric-card {
  min-height: 126px;
  padding: 18px 20px;
  border: 1px solid var(--glass-line);
  border-radius: 15px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.metric-card:hover { border-color: var(--glass-line); transform: translateY(-3px); box-shadow: var(--glass-shadow); }
.metric-card-sm { min-height: 112px; padding: 16px; }
.metric-icon { border-radius: 12px; color: var(--champagne-text); background: var(--glass); }
.metric-card :deep(.el-statistic__head),.metric-card-sm :deep(.el-statistic__head) { color: var(--text-secondary); }
.metric-card :deep(.el-statistic__number),.metric-card-sm :deep(.el-statistic__number) { color: var(--text); letter-spacing: -.04em; }
.chart-card { border-color: var(--glass-line); border-radius: 16px; box-shadow: var(--glass-shadow); }
.chart-header span { color: var(--champagne-text); font-weight: 720; }
.chart-header strong { color: var(--text); }
.report-summary { border-left-color: var(--glass-line); background: var(--glass); }
.metric-item { border-color: var(--glass-line); border-radius: 10px; background: var(--glass); }

/* Compact cards and responsive rows keep labels readable in narrow panels. */
.dashboard-page { padding: 0; container-type: inline-size; }
.dashboard-hero { min-height: 0; padding: 18px 22px; margin-bottom: 24px; }
.dashboard-hero h1 { font-size: 24px; }
.metric-card, .metric-card-sm { padding: 0; min-height: 0; }
.metric-card :deep(.el-card__body) { display: flex; width: 100%; align-items: center; gap: 14px; padding: 20px; box-sizing: border-box; }
.metric-card-sm :deep(.el-card__body) { gap: 10px; padding: 18px 14px; }
.metric-icon { width: 40px; height: 40px; font-size: 22px; flex: 0 0 40px; }
.metric-card :deep(.el-statistic__head) { white-space: nowrap; }
.metric-section .el-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin: 0 !important; }
.metric-section + .metric-section .el-row { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
.metric-section .el-col { width: auto; max-width: none; padding: 0 !important; }
@container (max-width: 1050px) {
  .metric-section + .metric-section .el-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .metric-icon { display: none; }
}
@container (max-width: 760px) {
  .metric-section .el-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .chart-section .el-row { gap: 16px; }
  .chart-section .el-col { flex: 0 0 100%; max-width: 100%; }
}
@container (max-width: 480px) {
  .metric-section + .metric-section .el-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-hero { padding: 16px; }
  .dashboard-hero h1 { font-size: 20px; }
}
</style>
