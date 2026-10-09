<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const props = defineProps<{
  title?: string
  data: Array<{ day: string; hour: string; count: number }>
  height?: string
}>()

function initChart() {
  if (!chartRef.value || !props.data.length) return
  chartInstance = echarts.init(chartRef.value)

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

  // 构建热力图矩阵
  const matrix: number[][] = []
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const row: number[] = []
    for (let hour = 0; hour < 24; hour++) {
      const item = props.data.find(d => d.day === days[dayIdx] && d.hour === `${String(hour).padStart(2, '0')}:00`)
      row.push(item?.count || 0)
    }
    matrix.push(row)
  }

  // 计算最大值用于颜色映射
  const maxVal = Math.max(...matrix.flat(), 1)

  const option: echarts.EChartsOption = {
    title: props.title ? {
      text: props.title,
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600 },
    } : undefined,
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        return `${params.value[1]} ${params.value[0]}<br/>活跃度: ${params.value[2]}次`
      },
    },
    grid: {
      left: 60, right: 30, top: props.title ? 50 : 20, bottom: 60,
    },
    xAxis: {
      type: 'category',
      data: hours,
      splitArea: { show: true },
      axisLabel: {
        fontSize: 10,
        rotate: 45,
        interval: 3, // 每3小时显示一个标签
      },
    },
    yAxis: {
      type: 'category',
      data: days,
      splitArea: { show: true },
      axisLabel: { fontSize: 12 },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: ['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
      },
      textStyle: { fontSize: 11 },
    },
    series: [{
      type: 'heatmap',
      data: (() => {
        const result: [number, number, number][] = []
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          for (let hour = 0; hour < 24; hour++) {
            result.push([hour, dayIdx, matrix[dayIdx][hour]])
          }
        }
        return result.map(([h, d, v]) => [hours[h], days[d], v] as any)
      })(),
      label: {
        show: false,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
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
  <div ref="chartRef" :style="{ width: '100%', height: height || '420px' }" />
</template>
