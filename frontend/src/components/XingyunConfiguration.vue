<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { request_handler } from '@/api/base'
import { header_authorization } from '@/api/user'
const props = defineProps<{ guideId: number }>()
const emit = defineEmits<{ saved: [] }>()
const visible = ref(false)
const busy = ref(false)
const loaded = ref(false)
const error = ref('')
const form = reactive({ app_id: '', app_secret: '', voice_label: '', use_xingyun: true, secret_configured: false })
const headers = () => ({ Authorization: header_authorization.value })
function errorText(e: any) { return e.response?.data?.detail || e.message || '操作失败' }
async function refresh() {
  try {
    const { data } = await request_handler.get('/xingyun/admin/' + props.guideId, { headers: headers() })
    Object.assign(form, data, { app_secret: '' })
    loaded.value = true; error.value = ''
  } catch(e) { error.value = errorText(e) }
}
async function open() { await refresh(); if (!error.value) visible.value = true }
async function save() {
  if (!form.app_id.trim() || (!form.secret_configured && !form.app_secret.trim())) { ElMessage.warning('请填写这个人物对应的 App ID 和 App Secret'); return }
  busy.value = true
  try {
    await request_handler.put('/xingyun/admin/' + props.guideId, {
      app_id: form.app_id.trim(), app_secret: form.app_secret.trim(), voice_label: form.voice_label.trim(), use_xingyun: form.use_xingyun,
    }, { headers: headers() })
    form.app_secret = ''; visible.value = false
    ElMessage.success('应用绑定已保存'); emit('saved'); await refresh()
  } catch(e) { ElMessage.error(errorText(e)) }
  finally { busy.value = false }
}
async function remove() {
  try { await ElMessageBox.confirm('移除绑定会清除本项目保存的应用凭据，并下架该导游。是否继续？', '移除应用绑定') }
  catch { return }
  busy.value = true
  try { await request_handler.delete('/xingyun/admin/' + props.guideId, { headers: headers() }); ElMessage.success('已移除绑定并下架'); visible.value = false; emit('saved'); await refresh() }
  catch(e) { ElMessage.error(errorText(e)) }
  finally { busy.value = false }
}
onMounted(refresh)
</script>
<template>
  <section class="xingyun-config">
    <strong>数字人应用配置</strong>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="loaded">{{ form.use_xingyun && form.secret_configured ? '已绑定应用 · 云端连接待验证' : form.secret_configured ? '已保存数字人应用 · 当前使用本地数字人' : '尚未绑定应用' }}</p>
    <p v-else>正在读取应用绑定…</p>
    <el-button plain @click="open">{{ form.secret_configured ? '管理应用' : '绑定应用' }}</el-button>
    <el-dialog v-model="visible" title="绑定该导游的数字人应用" width="min(580px, 94vw)" @closed="form.app_secret=''">
      <p>在数字人平台选好人物、背景和音色，保存后点击「接入SDK」，将对应应用凭据填在这里。</p>
      <el-form label-width="110px">
        <el-form-item label="App ID" required><el-input v-model="form.app_id" autocomplete="off" maxlength="200" /></el-form-item>
        <el-form-item label="App Secret" :required="!form.secret_configured"><el-input v-model="form.app_secret" type="password" show-password autocomplete="new-password" maxlength="500" :placeholder="form.secret_configured ? '已保存，留空沿用；修改 App ID 时需重新填写' : '输入该应用的密钥'" /></el-form-item>
        <el-form-item label="音色名称"><el-input v-model="form.voice_label" maxlength="80" placeholder="填写应用中选定的音色名称，供游客识别" /></el-form-item>
        <el-form-item label="启用实时数字人"><el-switch v-model="form.use_xingyun" /></el-form-item>
      </el-form>
      <p>人物、背景、音色在数字人平台配置；此处只绑定应用。密钥由后端加密保存，不回显。</p>
      <template #footer>
        <el-button v-if="form.secret_configured" type="danger" plain :disabled="busy" @click="remove">移除绑定</el-button>
        <el-button @click="visible=false" :disabled="busy">取消</el-button>
        <el-button type="primary" :loading="busy" @click="save">保存绑定</el-button>
      </template>
    </el-dialog>
  </section>
</template>
<style scoped>
.xingyun-config{padding:16px;margin:18px 0;background:#f0f5ff;border:1px solid #dae5fc;border-radius:12px}.xingyun-config strong{font-size:14px}.xingyun-config p{font-size:12px;line-height:1.8;color:#59657a}
</style>
