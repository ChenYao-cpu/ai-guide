<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const initChart = () => {
  const chart = echarts.init(chartRef.value, 'soft-ui')

  const option = {
    title: {
      text: '景区资源配置'
    },
    tooltip: {},
    xAxis: {
      data: ['景点数量', '知识文档', '数字导游', '游览路线']
    },
    yAxis: {},
    series: [
      {
        name: '数量',
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
</script>

<template>
  <div ref="chartRef" style="width: auto; height: 400px"></div>
</template>

<style scoped>
/* 可以根据需要调整图表容器的样式 */
</style>
