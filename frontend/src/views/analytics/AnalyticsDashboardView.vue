<template>
  <div class="dashboard-container" v-loading="loading">
    <!-- ========== 顶部统计卡片 ========== -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="4" v-for="card in statCards" :key="card.title">
        <div class="stat-card" :style="{ backgroundColor: card.bgColor }">
          <div class="stat-card-body">
            <span class="stat-icon">{{ card.icon }}</span>
            <div>
              <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
              <div class="stat-title">{{ card.title }}</div>
            </div>
          </div>
          <div class="stat-sub" v-if="card.sub">{{ card.sub }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- ========== 图表第一行: 服务趋势 + 热门景点 ========== -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="14">
        <el-card shadow="never" class="chart-card">
          <template #header><span class="card-title">📈 近30天服务趋势</span></template>
          <div ref="trendChartRef" style="height: 360px" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" class="chart-card">
          <template #header><span class="card-title">🏔️ 热门景点TOP10</span></template>
          <div ref="spotChartRef" style="height: 360px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ========== 图表第二行: 问题类型 + 活跃热力图 ========== -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="10">
        <el-card shadow="never" class="chart-card">
          <template #header><span class="card-title">💬 问题类型分布</span></template>
          <PieChartComponent
            v-if="questionTypeData.length"
            :data="questionTypeData"
            :colors="['#409eff','#67c23a','#e6a23c','#f56c6c','#b37feb','#36cfc9','#ff85c0']"
            height="340px"
          />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="never" class="chart-card">
          <template #header><span class="card-title">🔥 游客活跃时段分布（近7天）</span></template>
          <HeatmapComponent
            v-if="hourlyData.length"
            :data="hourlyData"
            height="340px"
          />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ========== 图表第三行: 知识盲区 + 情感分布 ========== -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header-row">
              <span class="card-title">🔍 知识盲区分析</span>
              <el-button size="small" type="primary" :loading="gapsLoading" @click="loadKnowledgeGaps">刷新</el-button>
            </div>
          </template>
          <div v-if="knowledgeGaps">
            <div class="gap-summary">
              <span class="gap-count">发现 {{ knowledgeGaps.uncertain_answers_count }} 个不确定回答</span>
              <span class="gap-total">（共分析 {{ knowledgeGaps.total_interactions_analyzed }} 条交互）</span>
            </div>
            <div v-if="knowledgeGaps.uncertain_samples?.length" class="gap-samples">
              <div v-for="(sample, i) in knowledgeGaps.uncertain_samples.slice(0, 5)" :key="i" class="gap-sample-item">
                <el-tag size="small" type="warning" effect="dark">{{ sample.keyword_matched }}</el-tag>
                <span class="gap-text">{{ sample.guide_response }}</span>
              </div>
            </div>
            <div v-if="knowledgeGaps.top_entities?.length" class="gap-entities">
              <h4>高频实体词</h4>
              <div class="entity-tags">
                <el-tag v-for="(e, i) in knowledgeGaps.top_entities.slice(0, 10)" :key="i" size="small" effect="plain" :type="i < 3 ? 'danger' : 'warning'">
                  {{ e.entity }} ({{ e.count }})
                </el-tag>
              </div>
            </div>
          </div>
          <el-empty v-else description="点击刷新加载数据" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header><span class="card-title">😊 游客情感分布</span></template>
          <div v-if="emotionStats" class="emotion-section">
            <div class="emotion-bars">
              <div class="emotion-bar-item">
                <span class="emotion-label">正面</span>
                <div class="emotion-track"><div class="emotion-fill positive" :style="{ width: emotionStats.positive_rate + '%' }">{{ emotionStats.positive_rate }}%</div></div>
                <span class="emotion-count">{{ emotionStats.positive }}</span>
              </div>
              <div class="emotion-bar-item">
                <span class="emotion-label">中性</span>
                <div class="emotion-track"><div class="emotion-fill neutral" :style="{ width: (100 - emotionStats.positive_rate - emotionStats.negative_rate) + '%' }">{{ (100 - emotionStats.positive_rate - emotionStats.negative_rate).toFixed(1) }}%</div></div>
                <span class="emotion-count">{{ emotionStats.neutral }}</span>
              </div>
              <div class="emotion-bar-item">
                <span class="emotion-label">负面</span>
                <div class="emotion-track"><div class="emotion-fill negative" :style="{ width: emotionStats.negative_rate + '%' }">{{ emotionStats.negative_rate }}%</div></div>
                <span class="emotion-count">{{ emotionStats.negative }}</span>
              </div>
            </div>
            <div class="emotion-total">总交互数: {{ emotionStats.total }}</div>
          </div>
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ========== AI 报告生成区 ========== -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="24">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header-row">
              <span class="card-title">📊 AI 分析报告</span>
              <div class="report-actions">
                <el-button size="small" type="primary" :loading="reportLoading === 'daily'" @click="generateReport('daily')">
                  生成日报
                </el-button>
                <el-button size="small" type="success" :loading="reportLoading === 'weekly'" @click="generateReport('weekly')">
                  生成周报
                </el-button>
              </div>
            </div>
          </template>
          <div v-if="currentReport" class="report-display">
            <div class="report-meta">
              <el-tag type="primary" size="large">{{ currentReport.report?.title || currentReport.report_type }}</el-tag>
              <span class="report-period">{{ currentReport.report?.period || '' }}</span>
              <span class="report-time">生成时间: {{ currentReport.generated_at }}</span>
            </div>
            <div class="report-body" v-if="currentReport.report">
              <div class="report-summary">{{ currentReport.report.executive_summary }}</div>
              <el-divider />
              <div class="key-metrics">
                <div v-for="(m, i) in currentReport.report.key_metrics" :key="i" class="metric-item">
                  <span class="metric-name">{{ m.name }}</span>
                  <span class="metric-value" :style="{ color: m.trend === 'up' ? '#67c23a' : m.trend === 'down' ? '#f56c6c' : '#409eff' }">
                    {{ m.value }} {{ m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→' }}
                  </span>
                  <span class="metric-comment">{{ m.comment }}</span>
                </div>
              </div>
              <el-divider />
              <div class="report-recommendations">
                <h4>改进建议</h4>
                <div v-for="(rec, i) in currentReport.report.recommendations" :key="i" class="rec-item">
                  <el-tag :type="rec.priority === '高' ? 'danger' : rec.priority === '中' ? 'warning' : 'info'" size="small">
                    {{ rec.priority }}
                  </el-tag>
                  <span>{{ rec.action }}</span>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-else description="点击上方按钮生成AI分析报告" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { AxiosError } from 'axios'
import {
  getComprehensiveAnalytics, getKnowledgeGaps, generateAnalyticsReport,
  type ComprehensiveData, type KnowledgeGapData, type AnalyticsReport,
} from '@/api/analytics'
import PieChartComponent from '@/components/PieChartComponent.vue'
import HeatmapComponent from '@/components/HeatmapComponent.vue'

// ====== 加载状态 ======
const loading = ref(false)
const gapsLoading = ref(false)
const reportLoading = ref<string | null>(null)

// ====== 数据 ======
const comprehensive = ref<ComprehensiveData | null>(null)
const knowledgeGaps = ref<KnowledgeGapData | null>(null)
const currentReport = ref<AnalyticsReport | null>(null)

// 图表refs
const trendChartRef = ref<HTMLElement | null>(null)
const spotChartRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null
let spotChart: echarts.ECharts | null = null

// ====== 统计卡片 ======
const statCards = computed(() => {
  const stats = comprehensive.value?.service_stats
  const emotion = comprehensive.value?.emotion_stats
  return [
    { title: '总交互数', value: emotion?.total || 0, icon: '💬', color: '#409eff', bgColor: '#ecf5ff', sub: '全局交互次数' },
    { title: '好评率', value: (emotion?.positive_rate || 0) + '%', icon: '😊', color: '#67c23a', bgColor: '#f0f9eb', sub: '正面情绪占比' },
    { title: '今日提问', value: stats?.today_questions || 0, icon: '❓', color: '#e6a23c', bgColor: '#fdf6ec', sub: '今日游客提问' },
    { title: '负面率', value: (emotion?.negative_rate || 0) + '%', icon: '⚠️', color: '#f56c6c', bgColor: '#fef0f0', sub: '负面情绪占比' },
    { title: '本周服务', value: stats?.week_sessions || 0, icon: '👥', color: '#b37feb', bgColor: '#f5f0ff', sub: '本周会话数' },
    { title: '知识覆盖', value: knowledgeGaps.value ? Math.max(0, 100 - knowledgeGaps.value.uncertain_answers_count * 2) + '%' : 'N/A', icon: '📚', color: '#36cfc9', bgColor: '#f0fdfa', sub: '知识响应率' },
  ]
})

// 问题类型分布（基于情感统计模拟）
const questionTypeData = computed(() => {
  const emotion = comprehensive.value?.emotion_stats
  if (!emotion) return []
  return [
    { name: '满意度相关', value: emotion.positive || 0 },
    { name: '一般问题', value: emotion.neutral || 0 },
    { name: '投诉/不满', value: emotion.negative || 0 },
  ]
})

const emotionStats = computed(() => comprehensive.value?.emotion_stats)
const hourlyData = computed(() => comprehensive.value?.hourly_distribution || [])

// ====== 初始化趋势图 ======
function initTrendChart() {
  if (!trendChartRef.value || !comprehensive.value?.daily_trend) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(trendChartRef.value)

  const trend = comprehensive.value.daily_trend
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['服务人次', '提问数', '满意度(%)'], bottom: 0 },
    grid: { left: 50, right: 50, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: trend.map(t => t.date), axisLabel: { interval: 4, rotate: 30 } },
    yAxis: [
      { type: 'value', name: '数量' },
      { type: 'value', name: '%', max: 100 },
    ],
    series: [
      { name: '服务人次', type: 'line', data: trend.map(t => t.sessions), smooth: true, symbol: 'none', areaStyle: { opacity: 0.1 } },
      { name: '提问数', type: 'line', data: trend.map(t => t.questions), smooth: true, symbol: 'none', areaStyle: { opacity: 0.1 } },
      { name: '满意度(%)', type: 'line', yAxisIndex: 1, data: trend.map(t => t.satisfaction), smooth: true, lineStyle: { type: 'dashed' }, symbol: 'none' },
    ],
  }
  trendChart.setOption(option)
}

// 热门景点柱状图
function initSpotChart() {
  if (!spotChartRef.value || !comprehensive.value?.spot_ranking) return
  if (spotChart) spotChart.dispose()
  spotChart = echarts.init(spotChartRef.value)

  const spots = comprehensive.value.spot_ranking.slice(0, 10).reverse()
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 100, right: 40, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: '会话数' },
    yAxis: { type: 'category', data: spots.map(s => s.spot_name), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar',
      data: spots.map((s, i) => ({
        value: s.session_count,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#409eff' }, { offset: 1, color: '#67c23a' },
          ]),
          borderRadius: [0, 6, 6, 0],
        },
      })),
      barMaxWidth: 28,
      label: { show: true, position: 'right', fontSize: 11 },
    }],
  }
  spotChart.setOption(option)
}

// ====== 数据加载 ======
async function loadComprehensive() {
  try {
    const { data } = await getComprehensiveAnalytics()
    if (data.code === 0) {
      comprehensive.value = data.data
      await nextTick()
      initTrendChart()
      initSpotChart()
    }
  } catch (e: any) { console.error('Failed to load comprehensive data', e) }
}

async function loadKnowledgeGaps() {
  gapsLoading.value = true
  try {
    const { data } = await getKnowledgeGaps()
    if (data.code === 0) knowledgeGaps.value = data.data
  } catch (e: any) { ElMessage.error('加载知识盲区失败') }
  finally { gapsLoading.value = false }
}

async function generateReport(type: 'daily' | 'weekly') {
  reportLoading.value = type
  try {
    const { data } = await generateAnalyticsReport(type)
    if (data.code === 0) {
      currentReport.value = data.data
      ElMessage.success(`${type === 'daily' ? '日报' : '周报'}生成成功！`)
    } else {
      ElMessage.error(data.message || '报告生成失败')
    }
  } catch (e: any) { ElMessage.error('请求失败') }
  finally { reportLoading.value = null }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([loadComprehensive(), loadKnowledgeGaps()])
  loading.value = false
})
</script>

<style lang="scss" scoped>
.dashboard-container { padding: 16px; }

// 统计卡片
.stat-row { margin-bottom: 16px; }
.stat-card { border-radius: 12px; padding: 16px 20px; transition: transform .2s; cursor: default;
  &:hover { transform: translateY(-2px); }
}
.stat-card-body { display: flex; align-items: center; gap: 12px; }
.stat-icon { font-size: 28px; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-title { font-size: 12px; color: #909399; }
.stat-sub { margin-top: 4px; font-size: 11px; color: #c0c4cc; }

// 图表卡片
.chart-row { margin-bottom: 16px; }
.chart-card { border-radius: 12px; }
.card-title { font-size: 15px; font-weight: 600; }
.card-header-row { display: flex; justify-content: space-between; align-items: center; }

// 知识盲区
.gap-summary { margin-bottom: 12px; }
.gap-count { font-size: 18px; font-weight: 700; color: #f56c6c; }
.gap-total { font-size: 12px; color: #909399; }
.gap-sample-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px dashed #e5e7eb; }
.gap-text { font-size: 12px; color: #606266; line-height: 1.5; }
.gap-entities { margin-top: 12px; }
.gap-entities h4 { font-size: 13px; margin: 0 0 6px; }
.entity-tags { display: flex; flex-wrap: wrap; gap: 6px; }

// 情感分布
.emotion-bars { display: flex; flex-direction: column; gap: 14px; }
.emotion-bar-item { display: flex; align-items: center; gap: 10px; }
.emotion-label { width: 40px; font-size: 12px; color: #606266; }
.emotion-track { flex: 1; height: 24px; background: #f0f2f5; border-radius: 6px; overflow: hidden; }
.emotion-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #fff; transition: width .6s ease; }
.emotion-fill.positive { background: #67c23a; }
.emotion-fill.neutral { background: #e6a23c; }
.emotion-fill.negative { background: #f56c6c; }
.emotion-count { width: 35px; font-size: 12px; color: #909399; text-align: right; }
.emotion-total { margin-top: 10px; font-size: 12px; color: #909399; text-align: center; }

// 报告区
.report-actions { display: flex; gap: 8px; }
.report-display { display: flex; flex-direction: column; gap: 12px; }
.report-meta { display: flex; align-items: center; gap: 16px; }
.report-period { font-size: 13px; color: #606266; }
.report-time { font-size: 12px; color: #c0c4cc; margin-left: auto; }
.report-summary { font-size: 14px; color: #303133; line-height: 1.7; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #409eff; }
.key-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.metric-item { padding: 10px; background: #f9fafb; border-radius: 8px; }
.metric-name { display: block; font-size: 11px; color: #909399; }
.metric-value { display: block; font-size: 18px; font-weight: 700; margin: 4px 0; }
.metric-comment { display: block; font-size: 11px; color: #c0c4cc; }
.report-recommendations h4 { margin: 0 0 8px; font-size: 14px; }
.rec-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; color: #303133; }
.rec-item + .rec-item { border-top: 1px dashed #e5e7eb; }
</style>
