<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { request_handler, type ResultPackage } from '@/api/base'
import { header_authorization } from '@/api/user'

interface SystemStatus {
  database: { status: string; error?: string }
  llm: { status: string; api_base: string; model: string; key_configured: boolean }
  tts: { status: string }
  asr: { status: string }
  rag: { status: string }
  digital_human: { status: string }
  python_version: string
}

const loading = ref(false)
const status = ref<SystemStatus | null>(null)
const loadError = ref('')

const loadStatus = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await request_handler<ResultPackage<SystemStatus>>({
      method: 'GET',
      url: '/system/status',
      headers: { Authorization: header_authorization.value },
    })
    if ((res.data as any).code === undefined) {
      // 直接返回的 dict
      status.value = res.data as any
    } else {
      const pkg = res.data as ResultPackage<SystemStatus>
      if (pkg.code === 0) status.value = pkg.data
      else loadError.value = pkg.message
    }
  } catch (e: any) {
    loadError.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const statusTag = (s: string) => s === 'connected' || s === 'available' ? 'success' : 'danger'
const statusLabel = (s: string) => {
  if (s === 'connected' || s === 'available') return '正常'
  if (s === 'unavailable') return '未启用'
  return '异常'
}

const services = computed(() => {
  if (!status.value) return []
  return [
    { name: '数据库 PostgreSQL', status: status.value.database.status, detail: status.value.database.error ? `异常: ${status.value.database.error}` : '连接正常', statusKey: 'connected' },
    { name: 'LLM 大模型', status: status.value.llm.status, detail: `${status.value.llm.model} @ ${status.value.llm.api_base}`, extra: status.value.llm.key_configured ? ' Key已配置' : ' Key未配置' },
    { name: 'TTS 语音合成', status: status.value.tts.status, detail: 'Edge-TTS / GPT-SoVITS', statusKey: 'available' },
    { name: 'ASR 语音识别', status: status.value.asr.status, detail: 'FunASR Paraformer', statusKey: 'available' },
    { name: 'RAG 知识检索', status: status.value.rag.status, detail: '向量数据库 + 景区知识库', statusKey: 'available' },
    { name: '数字人驱动', status: status.value.digital_human.status, detail: 'MuseTalk 口型同步', statusKey: 'available' },
  ]
})

import { computed } from 'vue'

onMounted(() => { loadStatus() })
</script>

<template>
  <div class="overview-container" v-loading="loading">
    <div class="page-header">
      <h2> 系统概览</h2>
      <el-button :icon="'Refresh'" @click="loadStatus" :loading="loading">刷新状态</el-button>
    </div>

    <el-alert v-if="loadError" :title="'加载失败: ' + loadError" type="error" show-icon closable style="margin-bottom:16px" />

    <!-- 服务状态卡片 -->
    <el-row :gutter="16" class="service-row">
      <el-col :span="8" v-for="svc in services" :key="svc.name" style="margin-bottom:16px">
        <el-card shadow="hover" class="service-card">
          <div class="svc-header">

            <span class="svc-name">{{ svc.name }}</span>
            <el-tag :type="svc.status === (svc.statusKey || 'connected') ? 'success' : 'danger'" size="small" effect="dark">
              {{ svc.status === (svc.statusKey || 'connected') ? '● 正常' : '✕ 异常' }}
            </el-tag>
          </div>
          <div class="svc-detail">{{ svc.detail }}</div>
          <div v-if="svc.extra" class="svc-extra" :class="{ warn: svc.extra.includes('未配置') }">{{ svc.extra }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 环境信息 -->
    <el-card shadow="never" class="env-card" v-if="status">
      <template #header><span class="card-title">运行环境</span></template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="Python 版本">{{ status.python_version }}</el-descriptions-item>
        <el-descriptions-item label="LLM 模型">{{ status.llm.model }}</el-descriptions-item>
        <el-descriptions-item label="API 网关">{{ status.llm.api_base }}</el-descriptions-item>
        <el-descriptions-item label="数据库状态">
          <el-tag :type="statusTag(status.database.status)" size="small">{{ statusLabel(status.database.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="TTS 服务">
          <el-tag :type="statusTag(status.tts.status)" size="small">{{ statusLabel(status.tts.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="ASR 服务">
          <el-tag :type="statusTag(status.asr.status)" size="small">{{ statusLabel(status.asr.status) }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.overview-container { padding: 16px; max-width: 1200px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 22px; }

.service-row { margin-bottom: 8px; }
.service-card { border-radius: 12px; height: 100%; }
.svc-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.svc-icon { font-size: 28px; }
.svc-name { font-size: 15px; font-weight: 600; flex: 1; }
.svc-detail { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.svc-extra { font-size: 12px; color: var(--success); &.warn { color: var(--champagne); } }

.env-card { border-radius: 12px; margin-top: 8px; }
.card-title { font-size: 15px; font-weight: 600; }
</style>
