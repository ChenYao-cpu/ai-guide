<script setup lang="ts">import { t, locale } from '@/i18n'

import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref(null)

const props = defineProps({
  spotCount: {
    type: Number,
    default: 0
  },
  docCount: {
    type: Number,
    default: 0
  },
  guideCount: {
    type: Number,
    default: 0
  },
  routeCount: {
    type: Number,
    default: 0
  }
})

let chart: echarts.ECharts | undefined
const initChart = () => {
  chart?.dispose()
  chart = echarts.init(chartRef.value, 'soft-ui', { locale: locale.value === 'en' ? 'EN' : 'ZH' })

  const option = {
    title: {
      text: t("景区资源配置")
    },
    tooltip: {},
    xAxis: {
      data: [t("景点数量"), t("知识文档"), t("数字导游"), t("游览路线")]
    },
    yAxis: {},
    series: [
      {
        name: t("数量"),
        type: 'bar',
        data: [props.spotCount, props.docCount, props.guideCount, props.routeCount]
      }
    ]
  }

  chart.setOption(option)
}

onMounted(() => {
  initChart()
})
watch(locale, () => initChart())
</script>

<template>
  <div ref="chartRef" style="width: auto; height: 400px"></div>
</template>

<style scoped>
/* 可以根据需要调整图表容器的样式 */
</style>
