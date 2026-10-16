import * as echarts from 'echarts'

// Canvas-rendered charts cannot inherit CSS tokens. Mirror the shared palette.
const foreground = '#64748b'
const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--app-font-family').trim()
  || 'Arial, "SimSun", "宋体", "Songti SC", "STSong", serif'
const axis = {
  axisLine: { lineStyle: { color: 'rgba(99,102,241,0.12)' } },
  axisTick: { lineStyle: { color: 'rgba(99,102,241,0.12)' } },
  axisLabel: { color: foreground, fontFamily, fontSize: 14 },
  splitLine: { lineStyle: { color: 'rgba(99,102,241,0.08)' } },
  splitArea: { areaStyle: { color: ['rgba(99,102,241,0.02)', 'transparent'] } },
  nameTextStyle: { color: foreground, fontFamily, fontSize: 14 },
}
echarts.registerTheme('soft-ui', {
  color: ['#4f46e5', '#818cf8', '#10b981', '#6366f1', '#ec4899', '#f59e0b', '#d15d1a'],
  backgroundColor: 'transparent',
  textStyle: { color: foreground, fontFamily, fontSize: 14 },
  title: { textStyle: { color: '#1f2937', fontFamily, fontSize: 16 }, subtextStyle: { color: foreground, fontFamily, fontSize: 14 } },
  legend: { textStyle: { color: foreground, fontFamily, fontSize: 14 }, inactiveColor: 'rgba(99,102,241,0.12)' },
  tooltip: { backgroundColor: '#ffffff', borderColor: 'transparent', textStyle: { color: '#1f2937', fontFamily, fontSize: 16 }, extraCssText: 'border-radius:16px;box-shadow:0 10px 40px -10px rgba(30,41,59,.15)' },
  categoryAxis: axis,
  valueAxis: axis,
  timeAxis: axis,
  logAxis: axis,
  radar: { axisName: { color: foreground, fontFamily }, axisLine: { lineStyle: { color: 'rgba(99,102,241,0.12)' } }, splitLine: { lineStyle: { color: 'rgba(99,102,241,0.12)' } }, splitArea: { areaStyle: { color: ['rgba(99,102,241,0.02)', 'rgba(99,102,241,0.04)'] } } },
  visualMap: { textStyle: { color: foreground, fontFamily, fontSize: 14 } },
})
