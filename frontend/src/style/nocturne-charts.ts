import * as echarts from 'echarts'

// Canvas-rendered charts cannot inherit CSS tokens. Mirror the shared palette.
const foreground = 'rgba(255,255,255,.60)'
const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--app-font-family').trim()
  || '"SimSun", "宋体", "Songti SC", "STSong", serif'
const axis = {
  axisLine: { lineStyle: { color: 'rgba(255,255,255,.15)' } },
  axisTick: { lineStyle: { color: 'rgba(255,255,255,.15)' } },
  axisLabel: { color: foreground, fontFamily },
  splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } },
  splitArea: { areaStyle: { color: ['rgba(255,255,255,.02)', 'transparent'] } },
  nameTextStyle: { color: foreground, fontFamily },
}
echarts.registerTheme('nocturne', {
  color: ['#e4b863', '#7c9cc4', '#b8c9dd', '#33517a', '#a98950', '#526d90', '#d8c6a3'],
  backgroundColor: 'transparent',
  textStyle: { color: foreground, fontFamily },
  title: { textStyle: { color: 'rgba(255,255,255,.85)', fontFamily }, subtextStyle: { color: foreground, fontFamily } },
  legend: { textStyle: { color: foreground, fontFamily }, inactiveColor: 'rgba(255,255,255,.20)' },
  tooltip: { backgroundColor: 'rgba(11,19,34,.92)', borderColor: 'rgba(255,255,255,.15)', textStyle: { color: 'rgba(255,255,255,.85)', fontFamily }, extraCssText: 'backdrop-filter:blur(40px);border-radius:16px;box-shadow:0 16px 40px rgba(3,7,18,.5)' },
  categoryAxis: axis,
  valueAxis: axis,
  timeAxis: axis,
  logAxis: axis,
  radar: { axisName: { color: foreground, fontFamily }, axisLine: { lineStyle: { color: 'rgba(255,255,255,.15)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } }, splitArea: { areaStyle: { color: ['rgba(255,255,255,.02)', 'rgba(255,255,255,.04)'] } } },
  visualMap: { textStyle: { color: foreground, fontFamily } },
})
