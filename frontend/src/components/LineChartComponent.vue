<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const initChart = () => {
  const chart = echarts.init(chartRef.value)

  const option = {
    title: {
      text: '本周运营趋势'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985'
        }
      }
    },
    legend: {
      data: ['服务人次', '满意度(%)', '新开会话', '活跃游客']
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
        data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      }
    ],
    yAxis: [
      {
        type: 'value'
      }
    ],
    series: [
      {
        name: '服务人次',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: props.sessionTrend
      },
      {
        name: '满意度(%)',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: props.satisfactionTrend
      },
      {
        name: '新开会话',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: props.newSessionTrend
      },
      {
        name: '活跃游客',
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
</script>

<template>
  <div ref="chartRef" style="width: auto; height: 400px"></div>
</template>

<style scoped>
/* 可以根据需要调整图表容器的样式 */
</style>
