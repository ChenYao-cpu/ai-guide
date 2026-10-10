<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { request_handler } from '@/api/base'
import { header_authorization } from '@/api/user'
import FileUpload from '@/components/FileUpload.vue'
const emit = defineEmits<{ saved: [] }>()
const visible = ref(false)
const busy = ref(false)
const form = reactive({ name: '', character: '', app_id: '', app_secret: '', voice_label: '', poster_image: '', avatar: '' })
function open() {
  Object.assign(form, { name: '', character: '', app_id: '', app_secret: '', voice_label: '', poster_image: '', avatar: '' })
  visible.value = true
}
async function save() {
  if (!form.name.trim() || !form.app_id.trim() || !form.app_secret.trim()) {
    ElMessage.warning('请填写导游名称、App ID 和 App Secret'); return
  }
  if (!form.poster_image || !form.avatar) { ElMessage.warning('请上传展示封面和头像'); return }
  busy.value = true
  try {
    await request_handler.post('/xingyun/guides', form, { headers: { Authorization: header_authorization.value } })
    form.app_secret = ''; visible.value = false
    ElMessage.success('已创建并绑定应用，请连接验证后上架')
    emit('saved')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.detail || '创建失败，请检查后端连接')
  } finally { busy.value = false }
}
</script>
<template>
  <el-button type="primary" @click="open">新增数字人</el-button>
  <el-dialog v-model="visible" title="新增数字人" width="min(600px, 94vw)" :close-on-click-modal="false" :before-close="(done: () => void) => { if (!busy) done() }" @closed="form.app_secret=''">
    <p>请上传星云的数字人。</p>
    <p>在数字人平台保存人物、背景和音色，再点击「接入 SDK」复制应用凭据。每个人物分别添加一次。</p>
    <el-form label-width="110px" :disabled="busy">
      <el-form-item label="导游名称" required><el-input v-model="form.name" maxlength="30" /></el-form-item>
      <el-form-item label="App ID" required><el-input v-model="form.app_id" maxlength="200" autocomplete="off" /></el-form-item>
      <el-form-item label="App Secret" required><el-input v-model="form.app_secret" maxlength="500" type="password" show-password autocomplete="new-password" /></el-form-item>
      <el-form-item label="角色设定"><el-input v-model="form.character" type="textarea" maxlength="1000" placeholder="填写这个导游的讲解风格和特点" /></el-form-item>
      <el-form-item label="音色名称"><el-input v-model="form.voice_label" maxlength="80" placeholder="应用中所选音色的名称，可留空" /></el-form-item>
      <el-form-item label="展示封面" required><FileUpload v-model="form.poster_image" file-type="image" /></el-form-item>
      <el-form-item label="头像" required><FileUpload v-model="form.avatar" file-type="image" /></el-form-item>
    </el-form>
    <p>封面和头像用于网页、小程序的人物选择与预览展示，可使用对应人物截图。无需上传人物视频。实时导览的背景和音色使用数字人应用配置；网页和小程序导览页均完整显示全身。保存后默认下架，密钥由后端加密保存。</p>
    <template #footer>
      <el-button :disabled="busy" @click="visible=false">取消</el-button>
      <el-button type="primary" :loading="busy" @click="save">创建并绑定</el-button>
    </template>
  </el-dialog>
</template>
