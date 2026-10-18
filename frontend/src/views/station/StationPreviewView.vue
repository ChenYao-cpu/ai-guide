<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { locale } from '@/i18n'
const route = useRoute(),
  size = ref('1920x1080')
const dimensions = computed(() => size.value.split('x').map(Number))
const url = computed(() => '/station/' + encodeURIComponent(String(route.params.stationId)))
</script>
<template>
  <main class="station-screen-preview">
    <header>
      <strong>{{ locale === 'en' ? 'Terminal screen preview' : '终端屏幕预览' }}</strong
      ><select v-model="size" :aria-label="locale === 'en' ? 'Screen resolution' : '屏幕分辨率'">
        <option value="1920x1080">1920 × 1080</option>
        <option value="1280x800">1280 × 800</option>
        <option value="1080x1920">1080 × 1920</option></select
      ><a :href="url" target="_blank">{{ locale === 'en' ? 'Open terminal' : '打开服务站' }} ↗</a
      ><span>{{
        locale === 'en'
          ? 'Actual screen dimensions. Scroll to inspect when the preview is wider than your window.'
          : '按实际屏幕尺寸预览；窗口较小时可滚动查看。'
      }}</span>
    </header>
    <iframe
      :src="url"
      :width="dimensions[0]"
      :height="dimensions[1]"
      :title="locale === 'en' ? 'Published service station' : '已发布的数字人服务站'"
    />
  </main>
</template>
<style scoped>
.station-screen-preview {
  padding: 18px;
  background: #dfe5de;
  min-height: 100dvh;
  width: max-content;
  font:
    16px Arial,
    'Microsoft YaHei',
    sans-serif;
  color: #53614f;
}
.station-screen-preview header {
  display: flex;
  gap: 25px;
  align-items: center;
  margin-bottom: 16px;
  min-height: 48px;
}
.station-screen-preview select {
  font: inherit;
  padding: 8px;
  border: 1px solid #bfcbbb;
  border-radius: 8px;
  background: white;
}
.station-screen-preview a {
  color: #7a67aa;
}
.station-screen-preview header span {
  color: #89967f;
  font-size: 14px;
}
.station-screen-preview iframe {
  border: 1px solid #cbd6c7;
  border-radius: 12px;
  display: block;
  background: #f2f5ef;
}
</style>
