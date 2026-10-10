<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const props = defineProps<{
  title?: string
  indicators: Array<{ name: string; max: number }>
  data: Array<{ name: string; value: number[] }>
  height?: string
}>()

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value, 'soft-ui')

  const option: echarts.EChartsOption = {
    title: props.title ? {
      text: props.title,
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600 },
    } : undefined,
    tooltip: {
      trigger: 'item',
    },
    legend: {
      bottom: 5,
      data: props.data.map(d => d.name),
    },
    radar: {
      center: ['50%', '52%'],
      radius: '65%',
      indicator: props.indicators,
      axisName: {
        color: '#64748b',
        fontSize: 12,
      },
    },
    series: [{
      type: 'radar',
      data: props.data.map((d, idx) => ({
        name: d.name,
        value: d.value,
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2 },
        itemStyle: { borderWidth: 2 },
      })),
    }],
  }

  chartInstance.setOption(option)
}

watch(() => props.data, () => {
  if (chartInstance) { chartInstance.dispose(); initChart() }
}, { deep: true })

onMounted(() => { initChart() })
</script>

<template>
  <div ref="chartRef" :style="{ width: '100%', height: height || '380px' }" />
</template>
