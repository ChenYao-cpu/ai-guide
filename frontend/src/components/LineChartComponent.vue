<script setup lang="ts">import { t, locale } from '@/i18n'

import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref(null)

const props = defineProps({
  sessionTrend: {
    type: Array
  },
  satisfactionTrend: {
    type: Array
  },
  newSessionTrend: {
    type: Array
  },
  activeUserTrend: {
    type: Array
  }
})

let chart: echarts.ECharts | undefined
const initChart = () => {
  chart?.dispose()
  chart = echarts.init(chartRef.value, 'soft-ui', { locale: locale.value === 'en' ? 'EN' : 'ZH' })

  const option = {
    title: {
      text: t("本周运营趋势")
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6366f1'
        }
      }
    },
    legend: {
      data: [t("服务人次"), t("满意度(%)"), t("新开会话"), t("活跃游客")]
    },
    toolbox: {
      feature: {
        saveAsImage: {}
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: [t("周一"), t("周二"), t("周三"), t("周四"), t("周五"), t("周六"), t("周日")]
      }
    ],
    yAxis: [
      {
        type: 'value'
      }
    ],
    series: [
      {
        name: t("服务人次"),
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: props.sessionTrend
      },
      {
        name: t("满意度(%)"),
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: props.satisfactionTrend
      },
      {
        name: t("新开会话"),
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: props.newSessionTrend
      },
      {
        name: t("活跃游客"),
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: props.activeUserTrend
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
