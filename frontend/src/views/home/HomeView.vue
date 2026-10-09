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
  Picture, Collection, User, Guide, ChatDotRound, TrendCharts, DataAnalysis, DataLine, RefreshRight,
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
  if (trendChart) trendChart.dispose(); trendChart = echarts.init(trendChartRef.value)
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
  if (spotChart) spotChart.dispose(); spotChart = echarts.init(spotChartRef.value)
  const spots = comprehensive.value.spot_ranking.slice(0, 10).reverse()
  spotChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 100, right: 40, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: '会话数' }, yAxis: { type: 'category', data: spots.map(s => s.spot_name), axisLabel: { fontSize: 11 } },
    series: [{ type: 'bar', data: spots.map(s => ({ value: s.session_count, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#2948c8'},{offset:1,color:'#6f87ff'}]), borderRadius: [0,6,6,0] } })), barMaxWidth: 28, label: { show: true, position: 'right', fontSize: 11 } }],
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
        <div class="eyebrow"><el-icon><DataLine /></el-icon> OPERATIONS CENTER</div>
        <h1>景区导览运营驾驶舱</h1>
      </div>
      <div class="hero-actions">
        <span class="data-status"><i></i> 数据服务已连接</span>
        <el-button plain :icon="RefreshRight" @click="loadAll">刷新数据</el-button>
      </div>
    </section>

    <!-- 基础资源 -->
    <section class="metric-section">
      <div class="section-heading"><div><span>ASSET OVERVIEW</span><h2>基础资源</h2></div><p>支撑智能导览服务的核心内容资产</p></div>
      <el-row :gutter="16">
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><Picture /></el-icon></div><div class="metric-info"><el-statistic title="景区景点" :value="spotCountTrans"><template #suffix><span class="metric-unit">个</span></template></el-statistic></div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><Collection /></el-icon></div><div class="metric-info"><el-statistic title="知识文档" :value="docCountTrans"><template #suffix><span class="metric-unit">份</span></template></el-statistic></div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><User /></el-icon></div><div class="metric-info"><el-statistic title="数字导游" :value="guideCountTrans"><template #suffix><span class="metric-unit">位</span></template></el-statistic></div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never" class="metric-card"><div class="metric-icon"><el-icon><Guide /></el-icon></div><div class="metric-info"><el-statistic title="游览路线" :value="routeCountTrans"><template #suffix><span class="metric-unit">条</span></template></el-statistic></div></el-card></el-col>
      </el-row>
    </section>

    <!-- 运营数据 -->
    <section class="metric-section">
      <div class="section-heading"><div><span>OPERATION METRICS</span><h2>运营数据</h2></div><p>全局交互统计与游客情绪概览</p></div>
      <el-row :gutter="12">
        <el-col :span="4" v-for="card in statCards" :key="card.title">
          <el-card shadow="never" class="metric-card metric-card-sm">
            <div class="metric-icon"><el-icon><component :is="card.icon" /></el-icon></div>
            <div class="metric-info"><el-statistic :title="card.title" :value="card.value" /><div class="metric-sub">{{ card.sub }}</div></div>
          </el-card>
        </el-col>
      </el-row>
    </section>

    <!-- 图表行1: 服务趋势 + 热门景点 -->
    <section class="chart-section">
      <el-row :gutter="16">
        <el-col :span="14">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><span>DATA TREND</span><strong>近30天服务趋势</strong></div></div></template>
            <div ref="trendChartRef" style="height:360px" />
          </el-card>
        </el-col>
        <el-col :span="10">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><span>HOT SPOTS</span><strong>热门景点TOP10</strong></div></div></template>
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
            <template #header><div class="chart-header"><div><span>QUESTION TYPES</span><strong>问题类型分布</strong></div></div></template>
            <PieChartComponent v-if="questionTypeData.length" :data="questionTypeData" :colors="['#3b5bff','#7186ff','#202636','#7f8bb8','#aab2cd','#2948c8','#8790a4']" height="340px" />
            <el-empty v-else description="暂无数据" :image-size="80" />
          </el-card>
        </el-col>
        <el-col :span="14">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><span>HOURLY HEATMAP</span><strong>游客活跃时段分布（近7天）</strong></div></div></template>
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
            <template #header><div class="chart-header between"><div><span>KNOWLEDGE GAPS</span><strong>知识盲区</strong></div><el-button size="small" type="primary" :loading="gapsLoading" @click="loadKnowledgeGaps">刷新</el-button></div></template>
            <div v-if="knowledgeGaps">
              <div class="gap-summary"><span class="gap-count">{{ knowledgeGaps.uncertain_answers_count }}</span> 个不确定回答<span class="gap-total"> / {{ knowledgeGaps.total_interactions_analyzed }} 条交互</span></div>
              <div v-if="knowledgeGaps.uncertain_samples?.length" class="gap-samples">
                <div v-for="(s,i) in knowledgeGaps.uncertain_samples.slice(0,5)" :key="i" class="gap-sample-item"><el-tag size="small" type="warning" effect="dark">{{ s.keyword_matched }}</el-tag><span class="gap-text">{{ s.guide_response }}</span></div>
              </div>
              <div v-if="knowledgeGaps.top_entities?.length" class="gap-entities mt-2"><h4>高频实体词</h4><div class="entity-tags"><el-tag v-for="(e,i) in knowledgeGaps.top_entities.slice(0,10)" :key="i" size="small" effect="plain" :type="i<3?'danger':'warning'">{{ e.entity }}({{ e.count }})</el-tag></div></div>
            </div>
            <el-empty v-else description="点击刷新加载" :image-size="60" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never" class="chart-card">
            <template #header><div class="chart-header"><div><span>EMOTION</span><strong>游客情感分布</strong></div></div></template>
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
            <template #header><div class="chart-header between"><div><span>AI REPORT</span><strong>AI 分析报告</strong></div><div class="report-actions"><el-button size="small" type="primary" :loading="reportLoading==='daily'" @click="generateReport('daily')">生成日报</el-button><el-button size="small" type="success" :loading="reportLoading==='weekly'" @click="generateReport('weekly')">生成周报</el-button></div></div></template>
            <div v-if="currentReport" class="report-display">
              <div class="report-meta"><el-tag type="primary" size="large">{{ currentReport.report?.title || currentReport.report_type }}</el-tag><span class="report-period">{{ currentReport.report?.period || '' }}</span><span class="report-time">生成时间: {{ currentReport.generated_at }}</span></div>
              <div class="report-body" v-if="currentReport.report">
                <div class="report-summary">{{ currentReport.report.executive_summary }}</div>
                <el-divider />
                <div class="key-metrics"><div v-for="(m,i) in currentReport.report.key_metrics" :key="i" class="metric-item"><span class="metric-name">{{ m.name }}</span><span class="metric-value" :style="{color:m.trend==='up'?'#67c23a':m.trend==='down'?'#f56c6c':'#409eff'}">{{ m.value }} {{ m.trend==='up'?'↑':m.trend==='down'?'↓':'→' }}</span><span class="metric-comment">{{ m.comment }}</span></div></div>
                <el-divider />
                <div class="report-recommendations"><h4>改进建议</h4><div v-for="(rec,i) in currentReport.report.recommendations" :key="i" class="rec-item"><el-tag :type="rec.priority==='高'?'danger':rec.priority==='中'?'warning':'info'" size="small">{{ rec.priority }}</el-tag><span>{{ rec.action }}</span></div></div>
              </div>
            </div>
            <el-empty v-else description="点击上方按钮生成AI分析报告" :image-size="80" />
          </el-card>
        </el-col>
      </el-row>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-page { padding: 16px; max-width: 1440px; margin: 0 auto; }
.dashboard-hero { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; padding: 20px 24px; border-radius: 14px; background: linear-gradient(135deg,#e0f7ff,#bae6fd); }
.eyebrow { font-size: 11px; letter-spacing: .15em; color: #0369a1; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.dashboard-hero h1 { margin: 0; font-size: 22px; font-weight: 850; color: #0c4a6e; }
.dashboard-hero p { margin: 0; font-size: 13px; color: #475569; }
.hero-actions { display: flex; align-items: center; gap: 12px; }
.data-status { font-size: 12px; color: #16a34a; display: flex; align-items: center; gap: 5px; i { width: 7px;height: 7px;border-radius: 50%;background: #16a34a; } }

.metric-section { margin-bottom: 24px; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 6px;
  span { font-size: 11px; letter-spacing: .12em; color: #94a3b8; }
  h2 { margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; }
  p { margin: 0; font-size: 12px; color: #94a3b8; }
}
.metric-card { border-radius: 10px; display: flex; align-items: center; gap: 12px; padding: 9px 16px; transition: transform .2s; &:hover { transform: translateY(-2px); } }
.metric-card :deep(.el-statistic__number) { font-size: 28px; font-weight: 900; line-height: 1; }
.metric-card :deep(.el-statistic__head) { font-size: 15px; font-weight: 700; margin-bottom: 2px; color: #374151; }
.metric-card-sm { padding: 7px 12px; gap: 10px; }
.metric-card-sm :deep(.el-statistic__number) { font-size: 22px; font-weight: 850; line-height: 1; }
.metric-card-sm :deep(.el-statistic__head) { font-size: 13px; font-weight: 700; margin-bottom: 2px; color: #374151; }
.metric-icon { width: 52px;height: 52px;display: flex;align-items: center;justify-content: center;border-radius: 12px;background: rgba(255,255,255,.7);font-size: 26px;color: #0284c7;flex-shrink: 0; }
.metric-emoji { font-size: 28px; }
.metric-info { flex: 1; min-width: 0; }
.metric-unit { color: #94a3b8; font-size: 12px; margin-left: 4px; }
.metric-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

.chart-section { margin-bottom: 20px; }
.chart-card { border-radius: 12px; }
.chart-header { display: flex; flex-direction: column; gap: 2px;
  span { font-size: 11px; letter-spacing: .1em; color: #94a3b8; }
  strong { font-size: 15px; font-weight: 700; color: #1e293b; }
  &.between { flex-direction: row; justify-content: space-between; align-items: center; }
}

.gap-summary { margin-bottom: 8px; }
.gap-count { font-size: 18px; font-weight: 700; color: #f56c6c; }
.gap-total { font-size: 12px; color: #909399; }
.gap-sample-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #e5e7eb; }
.gap-text { font-size: 12px; color: #606266; }
.gap-entities h4 { font-size: 13px; margin: 0 0 6px; }
.entity-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.mt-2 { margin-top: 10px; }

.emotion-bars { display: flex; flex-direction: column; gap: 14px; }
.emotion-bar-item { display: flex; align-items: center; gap: 10px; }
.emotion-label { width: 40px; font-size: 12px; color: #606266; }
.emotion-track { flex: 1; height: 24px; background: #f0f2f5; border-radius: 6px; overflow: hidden; }
.emotion-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #fff; &.positive { background: #67c23a; } &.neutral { background: #e6a23c; } &.negative { background: #f56c6c; } }
.emotion-count { width: 35px; font-size: 12px; color: #909399; text-align: right; }
.emotion-total { margin-top: 10px; font-size: 12px; color: #909399; text-align: center; }

.report-actions { display: flex; gap: 8px; }
.report-display { display: flex; flex-direction: column; gap: 12px; }
.report-meta { display: flex; align-items: center; gap: 16px; }
.report-period { font-size: 13px; color: #606266; }
.report-time { font-size: 12px; color: #c0c4cc; margin-left: auto; }
.report-summary { font-size: 14px; color: #303133; line-height: 1.7; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #409eff; }
.key-metrics { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
.metric-item { padding: 10px; background: #f9fafb; border-radius: 8px; }
.metric-name { display: block; font-size: 11px; color: #909399; }
.metric-value { display: block; font-size: 18px; font-weight: 700; margin: 4px 0; }
.metric-comment { display: block; font-size: 11px; color: #c0c4cc; }
.report-recommendations h4 { margin: 0 0 8px; font-size: 14px; }
.rec-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; color: #303133; &+& { border-top: 1px dashed #e5e7eb; } }

/* Restrained operations-dashboard theme */
.dashboard-page { padding: 22px 24px 36px; }
.dashboard-hero {
  position: relative;
  overflow: hidden;
  align-items: center;
  margin-bottom: 26px;
  padding: 26px 28px;
  border: 1px solid rgba(125, 159, 171, 0.18);
  border-radius: 12px;
  color: #dce8ec;
  background:
    radial-gradient(circle at 86% 0%, rgba(45, 212, 191, 0.12), transparent 20rem),
    linear-gradient(135deg, #0b2431, #103748);
  box-shadow: 0 14px 34px rgba(7, 25, 35, 0.12);
}
.eyebrow { color: #78d7cb; font-weight: 650; }
.dashboard-hero h1 { color: #f2f7f8; font-size: 23px; font-weight: 740; letter-spacing: -0.02em; }
.dashboard-hero p { color: #9fb3bc; }
.data-status { color: #8de0c4; }
.data-status i { background: #34d399; box-shadow: 0 0 0 5px rgba(52, 211, 153, 0.1); }
.dashboard-hero :deep(.el-button) { border-color: rgba(164, 192, 202, 0.24); color: #d9e7eb; background: rgba(5, 22, 30, 0.28); }

.metric-section { margin-bottom: 26px; }
.section-heading span { color: #0d9488; font-weight: 650; }
.section-heading h2 { color: #172634; font-weight: 740; }
.section-heading p { color: #8997a5; }
.metric-card {
  border: 1px solid #e1e7ea;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(7, 25, 35, 0.045);
  &:hover { border-color: #b7cfcc; transform: translateY(-2px); box-shadow: 0 12px 28px rgba(7, 25, 35, 0.075); }
}
.metric-icon { border-radius: 9px; color: #0d9488; background: #edf7f5; }
.metric-card :deep(.el-statistic__head),
.metric-card-sm :deep(.el-statistic__head) { color: #566576; }
.metric-card :deep(.el-statistic__number),
.metric-card-sm :deep(.el-statistic__number) { color: #172634; }
.metric-emoji { filter: saturate(0.72); }
.chart-card { border-color: #e1e7ea; border-radius: 10px; box-shadow: 0 8px 24px rgba(7, 25, 35, 0.045); }
.chart-header span { color: #0d9488; font-weight: 650; }
.chart-header strong { color: #243442; }
.report-summary { border-left-color: #0d9488; background: #f1f8f7; }
.metric-item { border: 1px solid #e8edef; background: #f8fafb; }

/* 2026 showcase skin — executive intelligence canvas */
.dashboard-page { max-width: 1520px; padding: 28px 30px 48px; }
.dashboard-hero {
  min-height: 150px;
  margin-bottom: 30px;
  padding: 32px 36px;
  border: 1px solid #e4e7ef;
  border-radius: 20px;
  color: #121620;
  background:
    linear-gradient(90deg, rgba(255,255,255,.98), rgba(255,255,255,.86)),
    radial-gradient(circle at 86% 0%, rgba(59,91,255,.2), transparent 24rem);
  box-shadow: 0 18px 48px rgba(18,25,46,.065);
}
.dashboard-hero::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5px;
  background: #3b5bff;
}
.dashboard-hero::after {
  content: 'SCENIC / AI';
  position: absolute;
  right: 34px;
  bottom: -12px;
  color: rgba(22,27,44,.035);
  font-size: 74px;
  font-weight: 900;
  letter-spacing: -.06em;
}
.eyebrow { color: #3b5bff; font-weight: 720; }
.dashboard-hero h1 { color: #11141d; font-size: 30px; font-weight: 780; letter-spacing: -.045em; }
.dashboard-hero p { color: #71798c; font-size: 14px; }
.data-status { color: #248361; }
.data-status i { background: #2dbb83; box-shadow: 0 0 0 5px rgba(45,187,131,.1); }
.dashboard-hero :deep(.el-button) { border-color: #dfe2eb; color: #30384c; background: rgba(255,255,255,.82); }
.dashboard-hero :deep(.el-button:hover) { border-color: #3b5bff; color: #2948c8; background: #fff; }

.metric-section { margin-bottom: 30px; }
.section-heading { margin-bottom: 16px; }
.section-heading span { color: #3b5bff; font-weight: 720; }
.section-heading h2 { color: #151924; font-size: 19px; font-weight: 760; }
.section-heading p { color: #949bad; }
.metric-card {
  min-height: 126px;
  padding: 18px 20px;
  border: 1px solid #e5e7ee;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(18,25,46,.05);
}
.metric-card:hover { border-color: #cbd2f9; transform: translateY(-3px); box-shadow: 0 18px 42px rgba(28,38,78,.09); }
.metric-card-sm { min-height: 112px; padding: 16px; }
.metric-icon { border-radius: 12px; color: #3b5bff; background: #eef1ff; }
.metric-card :deep(.el-statistic__head),.metric-card-sm :deep(.el-statistic__head) { color: #5c6476; }
.metric-card :deep(.el-statistic__number),.metric-card-sm :deep(.el-statistic__number) { color: #121620; letter-spacing: -.04em; }
.chart-card { border-color: #e5e7ee; border-radius: 16px; box-shadow: 0 12px 36px rgba(18,25,46,.05); }
.chart-header span { color: #3b5bff; font-weight: 720; }
.chart-header strong { color: #202532; }
.report-summary { border-left-color: #3b5bff; background: #f4f6ff; }
.metric-item { border-color: #e8eaf1; border-radius: 10px; background: #f8f9fb; }
</style>
