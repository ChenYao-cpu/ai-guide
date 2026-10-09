<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const props = defineProps<{
  title?: string
  data: Array<{ name: string; value: number }>
  colors?: string[]
  height?: string
}>()

const defaultColors = ['#67c23a', '#409eff', '#e6a23c', '#f56c6c', '#909399', '#b37feb', '#36cfc9', '#ff85c0']

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)

  const option: echarts.EChartsOption = {
    title: props.title ? {
      text: props.title,
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600 },
    } : undefined,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: props.title ? 40 : 10,
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['55%', '55%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        data: props.data.map((item, idx) => ({
          name: item.name,
          value: item.value,
          itemStyle: {
            color: props.colors?.[idx] || defaultColors[idx % defaultColors.length],
          },
        })),
      },
    ],
  }

  chartInstance.setOption(option)
}

watch(() => props.data, () => {
  if (chartInstance) {
    chartInstance.dispose()
    initChart()
  }
}, { deep: true })

onMounted(() => { initChart() })
</script>

<template>
  <div ref="chartRef" :style="{ width: '100%', height: height || '380px' }" />
</template>
