<template>
  <div class="qr-float">
    <!-- 悬浮按钮 -->
    <button class="qr-fab" @click="show = !show" :title="show ? '关闭' : '扫码体验手机版'">
      {{ show ? '✕' : '扫码' }}
    </button>

    <!-- 弹出面板 -->
    <Transition name="slide-up">
      <div v-if="show" class="qr-panel">
        <h3> 手机扫码</h3>

        <p v-if="!autoDetected">填写局域网地址</p>
        <el-input v-model="editUrl" size="small" placeholder="http://x.x.x.x:5173/m/home" style="margin-bottom:8px;" />
        <div class="qr-img-wrap">
          <img :src="qrUrl" alt="扫码打开" />
        </div>
        <div class="qr-url" @click="copyUrl">{{ mobileUrl }}</div>

      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { serverIP, serverPort } from 'virtual:server-info'

const show = ref(false)
const editUrl = ref('')
const autoDetected = ref(true)

onMounted(() => {
  const origin = window.location.origin
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    editUrl.value = `http://${serverIP}:${serverPort}/m/home`
  } else {
    editUrl.value = origin + '/m/home'
  }
})

const mobileUrl = computed(() => editUrl.value)

const qrUrl = computed(() => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mobileUrl.value)}&margin=8&bgcolor=ffffff&color=0284c7`
})

function copyUrl() {
  navigator.clipboard.writeText(mobileUrl.value).then(() => {
    ElMessage.success('链接已复制！')
  })
}
</script>

<style scoped>
.qr-float {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
}

.qr-fab {
  width: 52px;
  height: 52px;
  border: 0;
  border-radius: 50%;
  background: var(--glass);
  color: var(--text);
  font-size: 22px;
  cursor: pointer;
  box-shadow: var(--glass-shadow);
  transition: transform 0.2s;
  display: grid;
  place-items: center;
}
.qr-fab:active { transform: scale(0.92); }

.qr-panel {
  position: absolute;
  bottom: 64px;
  right: 0;
  width: 280px;
  padding: 20px 18px 16px;
  background: var(--glass);
  border-radius: 20px;
  box-shadow: var(--glass-shadow);
  text-align: center;
}
.qr-panel h3 { margin: 0; font-size: 16px; color: var(--text); }
.qr-panel > p { margin: 4px 0 10px; font-size: 12px; color: var(--text-muted); }

.qr-img-wrap {
  padding: 10px;
  background: var(--glass);
  border: 2px solid var(--glass-line);
  border-radius: 14px;
  display: inline-block;
}
.qr-img-wrap img { display: block; width: 180px; height: 180px; }

.qr-url {
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--glass);
  border-radius: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  word-break: break-all;
  line-height: 1.4;
}
.qr-hint { display: block; margin-top: 4px; font-size: 10px; color: var(--text-muted); }

.slide-up-enter-active { transition: all 0.25s ease-out; }
.slide-up-leave-active { transition: all 0.15s ease-in; }
.slide-up-enter-from { opacity: 0; transform: translateY(16px); }
.slide-up-leave-to { opacity: 0; transform: translateY(8px); }
</style>
