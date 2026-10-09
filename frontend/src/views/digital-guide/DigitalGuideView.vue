<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus/es'
import { Plus, Delete, Edit } from '@element-plus/icons-vue'
import AvatarConfiguration from '@/components/AvatarConfiguration.vue'
import XingyunConfiguration from '@/components/XingyunConfiguration.vue'
import XingyunCreate from '@/components/XingyunCreate.vue'
import { header_authorization } from '@/api/user'
import { request_handler } from '@/api/base'

import {
  getGuideList,
  getGuideDetail,
  createGuide,
  editGuide,
  deleteGuide,
  type DigitalGuide,
} from '@/api/digitalHuman'
import FileUpload from '@/components/FileUpload.vue'
import { AxiosError } from 'axios'
// Live2DGuide 使用动态 import 避免阻塞页面加载

// ======================== 列表数据 ========================

const guideList = ref<DigitalGuide[]>([])
const loading = ref(false)

const fetchGuides = async () => {
  loading.value = true
  try {
    const { data } = await getGuideList(1, 100)
    if (data.code === 0) {
      guideList.value = data.data.guide_list
    } else {
      ElMessage.error('获取数字导游列表失败：' + data.message)
    }
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      ElMessage.error('获取数字导游列表失败：' + error.message)
    } else {
      ElMessage.error('未知错误')
    }
  } finally {
    loading.value = false
  }
}

// ======================== 卡片展示 ========================

const characterLabels = (character: string) =>
  character.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean).slice(0, 4)

const voiceStyleLabel = (style: string) =>
  voiceStyleOptions.find((option) => option.value === style)?.label || '自然人声'

const guideSpecialty = (item: DigitalGuide) => {
  if (item.name.includes('小颐')) return '园林文化 · 故事讲解'
  const labels = characterLabels(item.character)
  return labels.slice(0, 2).join(' · ') || '智能景区导览'
}

// ======================== 对话框控制 ========================

const dialogVisible = ref(false)
const dialogTitle = ref('新增数字导游')
const isEditMode = ref(false)
const saving = ref(false)

const form = reactive({
  is_enabled: false,
  guide_id: 0,
  name: '',
  avatar: '',
  poster_image: '',
  character: '',
  voice_style: 'female_wenrou',
  voice_speed: 1.0,
  outfit_images: [] as string[],
  base_mp4_path: '',
  tts_reference_audio: '',
  tts_reference_sentence: '',
  live2d_model_path: '',
})

// ======================== 角色标签输入 ========================

const characterTags = ref<string[]>([])
const characterInput = ref('')
const characterInputVisible = ref(false)

const addCharacterTag = () => {
  const val = characterInput.value.trim()
  if (val && !characterTags.value.includes(val)) {
    characterTags.value.push(val)
  }
  characterInput.value = ''
  characterInputVisible.value = false
  syncCharacter()
}

const removeCharacterTag = (tag: string) => {
  characterTags.value = characterTags.value.filter((t) => t !== tag)
  syncCharacter()
}

const syncCharacter = () => {
  form.character = characterTags.value.join('，')
}

// ======================== 后端提供的卡通模型清单 ========================
const availableVRMModels = ref<{ label: string; path: string }[]>([])
async function scanVRMModels() {
  try {
    const response = await request_handler.get('/avatar/cartoon-models')
    availableVRMModels.value = response.data.data || []
  } catch { availableVRMModels.value = []; ElMessage.error('卡通模型清单读取失败') }
}

// ======================== 语音风格选项 ========================

const voiceStyleOptions = [
  { label: '温柔女声', value: 'female_wenrou' },
  { label: '活泼女声', value: 'female_huopo' },
  { label: '温厚男声', value: 'male_wenhou' },
  { label: '洪亮男声', value: 'male_hongliang' },
]

const voiceGender = (style: string) => style.startsWith('male_') ? 'male' : 'female'
const modelGender = (path: string) => {
  if (path.includes('女') || path.toLowerCase().includes('female')) return 'female'
  if (path.includes('男') || path.toLowerCase().includes('male')) return 'male'
  return 'unknown'
}
const compatibleVRMModels = computed(() => {
  const gender = voiceGender(form.voice_style)
  return availableVRMModels.value.filter((model) => {
    const modelType = modelGender(model.path)
    return modelType === 'unknown' || modelType === gender
  })
})
const syncVoiceAndModel = () => {
  const currentGender = modelGender(form.live2d_model_path)
  const expectedGender = voiceGender(form.voice_style)
  if (!form.live2d_model_path || (currentGender !== 'unknown' && currentGender !== expectedGender)) {
    form.live2d_model_path = compatibleVRMModels.value[0]?.path
      || ''
  }
}

// ======================== 打开对话框 ========================

const resetForm = () => {
  form.is_enabled = false
  form.guide_id = 0
  form.name = ''
  form.avatar = ''
  form.poster_image = ''
  form.character = ''
  form.voice_style = 'female_wenrou'
  form.voice_speed = 1.0
  form.outfit_images = []
  form.base_mp4_path = ''
  form.tts_reference_audio = ''
  form.tts_reference_sentence = ''
  form.live2d_model_path = ''
  characterTags.value = []
  characterInput.value = ''
  characterInputVisible.value = false
}

const openCreateDialog = () => {
  dialogTitle.value = '新增数字导游'
  isEditMode.value = false
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = async (guideId: number) => {
  dialogTitle.value = '编辑数字导游'
  isEditMode.value = true
  try {
    const { data } = await getGuideDetail(guideId)
    if (data.code === 0) {
      const item = data.data
      form.guide_id = item.guide_id
      form.is_enabled = item.is_enabled
      form.name = item.name
      form.avatar = item.avatar
      form.poster_image = item.poster_image
      form.character = item.character
      form.voice_style = item.voice_style
      form.voice_speed = item.voice_speed
      try { form.outfit_images = JSON.parse(item.outfit_images || '[]') } catch { form.outfit_images = [] }
      form.base_mp4_path = item.base_mp4_path
      form.tts_reference_audio = item.tts_reference_audio
      form.tts_reference_sentence = item.tts_reference_sentence
      form.live2d_model_path = item.live2d_model_path || ''
      characterTags.value = item.character ? item.character.split(/[,，]/).filter(Boolean) : []
      dialogVisible.value = true
    } else {
      ElMessage.error('获取导游详情失败：' + data.message)
    }
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      ElMessage.error('获取导游详情失败：' + error.message)
    } else {
      ElMessage.error('未知错误')
    }
  }
}

// ======================== 保存 ========================

const handleSave = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请输入导游名称')
    return
  }
  syncCharacter()
  if (!form.character.trim()) {
    ElMessage.warning('请输入角色设定')
    return
  }
  if (!form.poster_image || !form.avatar) { ElMessage.warning('请上传全身形象和头像'); return }
  saving.value = true
  try {
    const payload: Partial<DigitalGuide> = {
      is_enabled: form.is_enabled,
      name: form.name,
      character: form.character,
      avatar: form.avatar,
      voice_style: form.voice_style,
      voice_speed: form.voice_speed,
      outfit_images: JSON.stringify(form.outfit_images),
      poster_image: form.poster_image,
      base_mp4_path: form.base_mp4_path,
      tts_reference_audio: form.tts_reference_audio,
      tts_reference_sentence: form.tts_reference_sentence,
      live2d_model_path: form.live2d_model_path,
    }

    const res = isEditMode.value && form.guide_id > 0
      ? await editGuide(form.guide_id, payload)
      : await createGuide(payload)
    if (res.data.code === 0) {
      ElMessage.success(isEditMode.value ? '编辑成功' : '新增成功')
      dialogVisible.value = false
      await fetchGuides()
    } else {
      ElMessage.error('保存失败：' + res.data.message)
    }
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      ElMessage.error('保存失败：' + error.message)
    } else {
      ElMessage.error('未知错误')
    }
  } finally {
    saving.value = false
  }
}

const handleDelete = (guideId: number, name: string) => {
  ElMessageBox.confirm(`确定删除数字导游“${name}”吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      const { data } = await deleteGuide(guideId)
      if (data.code === 0) {
        ElMessage.success('删除成功')
        await fetchGuides()
      } else {
        ElMessage.error('删除失败：' + data.message)
      }
    } catch (error: unknown) {
      ElMessage.error(error instanceof AxiosError ? `删除失败：${error.message}` : '删除失败')
    }
  }).catch(() => undefined)
}

async function togglePublication(item: DigitalGuide) {
  try {
    const { data } = await request_handler.put('/digital-guide/publication/' + item.guide_id, { is_enabled: !item.is_enabled }, { headers: { Authorization: header_authorization.value } })
    if (!data.success) throw new Error(data.message)
    ElMessage.success(data.message); await fetchGuides()
  } catch(e: any) { ElMessage.error(e.response?.data?.detail || e.message || '上下架失败') }
}

// ======================== 生命周期 ========================

onMounted(() => {
  fetchGuides()

})
</script>

<template>
  <div class="digital-guide-container">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <div class="page-intro">
        <h2>数字导游管理</h2>
      </div>
      <XingyunCreate @saved="fetchGuides" />
    </div>

    <!-- 导游卡片网格 -->
    <div v-loading="loading" class="card-grid">
      <el-empty v-if="!loading && guideList.length === 0" description="暂无数字导游" />
      <el-card v-for="item in guideList" :key="item.guide_id" class="guide-card" shadow="never">
        <div class="card-content">
          <div class="card-status-row">
            <span class="guide-code">AI GUIDE · {{ String(item.guide_id).padStart(2, '0') }}</span>
            <div class="status-badges">
            <span class="online-badge">{{ item.is_enabled ? '已上架' : '已下架' }}</span>
            <span class="voice-badge">{{ item.render_mode === 'xingyun' ? '应用音色' : voiceStyleLabel(item.voice_style) }}</span>
            </div>
          </div>
          <el-image v-if="item.poster_image" :src="item.poster_image" fit="contain" style="width:100%;height:260px" :preview-src-list="[item.poster_image]" preview-teleported />
          <div class="identity-row">
            <div>
              <h3>{{ item.name }}</h3>
              <p>{{ guideSpecialty(item) }}</p>
            </div>
            <span class="model-gender">{{ item.render_mode === 'xingyun' ? '实时数字人' : item.base_mp4_path ? '已上传基础视频' : '形象图片 · 动态待开发' }}</span>
          </div>

          <div class="character-tags">
            <span v-for="tag in characterLabels(item.character)" :key="tag">{{ tag }}</span>
          </div>

          <p class="guide-character">{{ item.character || '尚未配置角色设定' }}</p>

          <div class="guide-meta">
            <div class="meta-item">
              <span>讲解声音</span>
              <strong>{{ item.render_mode === 'xingyun' ? '以应用配置为准' : voiceStyleLabel(item.voice_style) }}</strong>
            </div>
            <div class="meta-item">
              <span>语速设置</span>
              <strong>{{ item.render_mode === 'xingyun' ? '以应用配置为准' : Number(item.voice_speed || 1).toFixed(1) + '×' }}</strong>
            </div>
            <div class="meta-item">
              <span>数字人模型</span>
              <strong>{{ item.poster_image ? '已上传形象' : '待上传' }}</strong>
            </div>
          </div>

          <XingyunConfiguration :guide-id="item.guide_id" @saved="fetchGuides" />
          <AvatarConfiguration v-if="item.render_mode !== 'xingyun'" :guide-id="item.guide_id" />
          <div class="card-actions">
            <el-button :type="item.is_enabled ? 'warning' : 'success'" plain @click="togglePublication(item)">{{ item.is_enabled ? '下架' : '上架' }}</el-button>
            <el-button type="primary" plain @click="openEditDialog(item.guide_id)">
              <el-icon><Edit /></el-icon>
              编辑配置
            </el-button>
            <el-button v-if="item.name !== '小颐'" type="danger" plain @click="handleDelete(item.guide_id, item.name)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px" destroy-on-close>
      <el-form :model="form" label-width="130px" label-position="right">
        <el-form-item label="导游名称" required>
          <el-input v-model="form.name" placeholder="请输入导游名称" maxlength="30" show-word-limit />
        </el-form-item>
        <el-form-item label="游客可选择"><el-switch v-model="form.is_enabled" /><span class="form-hint">新增人物可先保持下架，绑定应用后再上架。</span></el-form-item>

        <!-- 角色设定（标签输入） -->
        <el-form-item label="角色设定" required>
          <div class="tag-input-container">
            <el-tag
              v-for="tag in characterTags"
              :key="tag"
              closable
              :disable-transitions="false"
              size="default"
              class="character-tag"
              @close="removeCharacterTag(tag)"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-if="characterInputVisible"
              ref="characterInputRef"
              v-model="characterInput"
              class="tag-input"
              size="small"
              placeholder="输入角色标签"
              @keyup.enter="addCharacterTag"
              @blur="addCharacterTag"
            />
            <el-button
              v-else
              class="add-tag-btn"
              size="small"
              @click="characterInputVisible = true"
            >
              + 添加标签
            </el-button>
          </div>
          <span class="form-hint">输入角色特征标签，如：热情、专业、幽默，按回车确认</span>
        </el-form-item>

        <!-- 语音风格 & 语速 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="语音风格">
              <el-select v-model="form.voice_style" placeholder="选择语音风格" style="width: 100%" @change="syncVoiceAndModel">
                <el-option
                  v-for="opt in voiceStyleOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="语速">
              <div class="slider-wrap">
                <el-slider
                  v-model="form.voice_speed"
                  :min="0.8"
                  :max="1.5"
                  :step="0.1"
                  :marks="{ 0.8: '0.8x', 1.0: '1.0x', 1.2: '1.2x', 1.5: '1.5x' }"
                />
                <el-input-number
                  v-model="form.voice_speed"
                  :min="0.8"
                  :max="1.5"
                  :step="0.1"
                  :precision="1"
                  controls-position="right"
                  class="speed-input"
                />
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="全身数字人形象" required><FileUpload v-model="form.poster_image" file-type="image" /></el-form-item>
        <el-form-item label="头像" required><FileUpload v-model="form.avatar" file-type="image" /></el-form-item>
        <el-form-item label="数字人基础视频">
          <FileUpload v-model="form.base_mp4_path" file-type="video" />
          <span class="form-hint">上传正面人物 MP4 视频，供真人口型推理使用。</span>
        </el-form-item>

      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
          <el-button @click="dialogVisible = false" :disabled="saving">取消</el-button>
        </div>
      </template>
    </el-dialog>


  </div>
</template>

<style lang="scss" scoped>
.digital-guide-container {
  min-height: calc(100vh - 86px);
  padding: 28px 34px 42px;
  background:
    radial-gradient(circle at 92% 2%, rgba(28, 187, 184, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #f4f7fa 100%);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e4eaf1;
}

.page-intro {
  max-width: 760px;

  h2 {
    margin: 0;
    color: #10243e;
    font-size: 25px;
    font-weight: 750;
    letter-spacing: -0.02em;
  }

}

.create-button {
  min-width: 154px;
  height: 44px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #173f72 0%, #246b8f 100%);
  box-shadow: 0 10px 22px rgba(28, 76, 118, 0.2);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 430px));
  align-items: stretch;
  gap: 24px;
}

.guide-card {
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(211, 221, 231, 0.92);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 35px rgba(32, 53, 78, 0.08);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;

  &:hover {
    transform: translateY(-5px);
    border-color: rgba(61, 117, 157, 0.38);
    box-shadow: 0 20px 42px rgba(28, 57, 87, 0.13);
  }

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
  }
}

.card-poster {
  position: relative;
  height: 236px;
  overflow: hidden;
  background: #dfe8ee;
}

.poster-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: 50% 27%;
  transition: transform 0.45s ease;
}

.guide-card:hover .poster-img {
  transform: scale(1.025);
}

.poster-topline {
  position: absolute;
  z-index: 2;
  top: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  span {
    display: inline-flex;
    align-items: center;
    min-height: 27px;
    padding: 0 9px;
    border: 1px solid rgba(255, 255, 255, 0.42);
    border-radius: 999px;
    background: rgba(14, 31, 50, 0.58);
    color: #fff;
    font-size: 11px;
    font-weight: 650;
    backdrop-filter: blur(10px);
  }

  .online-badge i {
    width: 7px;
    height: 7px;
    margin-right: 6px;
    border-radius: 50%;
    background: #70e2c1;
    box-shadow: 0 0 0 3px rgba(112, 226, 193, 0.18);
  }
}

.poster-gradient {
  position: absolute;
  z-index: 1;
  inset: auto 0 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 42px 18px 16px;
  background: linear-gradient(180deg, transparent 0%, rgba(9, 25, 42, 0.82) 100%);
  color: #fff;

  span {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.16em;
    opacity: 0.72;
  }

  strong {
    font-size: 14px;
    letter-spacing: 0.08em;
  }
}

.poster-placeholder {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% 25%, rgba(116, 196, 202, 0.45), transparent 26%),
    linear-gradient(145deg, #183c5d 0%, #326f7b 100%);
  color: #fff;

  .placeholder-orbit {
    position: absolute;
    width: 164px;
    height: 164px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 50%;
    box-shadow: 0 0 0 28px rgba(255, 255, 255, 0.035);
  }

  .placeholder-avatar {
    position: relative;
    display: grid;
    width: 70px;
    height: 70px;
    place-items: center;
    margin-bottom: 12px;
    border: 1px solid rgba(255, 255, 255, 0.46);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.13);
    font-size: 29px;
    font-weight: 700;
    backdrop-filter: blur(8px);
  }

  strong,
  small {
    position: relative;
  }

  small {
    margin-top: 5px;
    font-size: 9px;
    letter-spacing: 0.15em;
    opacity: 0.62;
  }
}

.card-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 22px;
}

.card-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e7edf2;
}

.guide-code {
  color: #7b8998;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .14em;
}

.status-badges {
  display: flex;
  align-items: center;
  gap: 7px;

  > span {
    display: inline-flex;
    align-items: center;
    min-height: 25px;
    padding: 0 9px;
    border: 1px solid #dbe6ec;
    border-radius: 999px;
    background: #f6fafb;
    color: #496878;
    font-size: 10px;
    font-weight: 700;
  }

  .online-badge i {
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: 50%;
    background: #2ca982;
    box-shadow: 0 0 0 3px rgba(44, 169, 130, .12);
  }
}

.model-gender {
  flex: none;
  padding: 5px 9px;
  border-radius: 6px;
  background: #eef4f7;
  color: #587184;
  font-size: 10px;
  font-weight: 700;
}

.identity-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;

  h3 {
    margin: 0;
    color: #14283f;
    font-size: 20px;
    font-weight: 750;
  }

  p {
    margin: 5px 0 0;
    color: #5f758a;
    font-size: 12px;
    font-weight: 550;
  }
}

.guide-id {
  flex: none;
  padding: 4px 8px;
  border-radius: 6px;
  background: #eef3f7;
  color: #78889a;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
}

.character-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
  margin-top: 16px;

  span {
    padding: 4px 8px;
    border: 1px solid #d9e7ec;
    border-radius: 6px;
    background: #f4f9fa;
    color: #356776;
    font-size: 11px;
    line-height: 1;
  }
}

.guide-character {
  min-height: 42px;
  margin: 12px 0 16px;
  color: #778597;
  font-size: 12px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.guide-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  margin-bottom: 18px;
  border: 1px solid #e5ebf0;
  border-radius: 10px;
  background: #e5ebf0;
}

.meta-item {
  min-width: 0;
  padding: 10px 8px;
  background: #f9fbfc;
  text-align: center;

  span,
  strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    margin-bottom: 4px;
    color: #93a0ae;
    font-size: 10px;
  }

  strong {
    color: #33495f;
    font-size: 11px;
    font-weight: 650;
  }
}

.card-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-top: auto;

  .el-button {
    height: 36px;
    margin: 0;
    border-radius: 8px;
  }
}

@media (max-width: 900px) {
  .digital-guide-container {
    padding: 22px 18px 36px;
  }

  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  }
}

// ---- 标签输入 ----

.tag-input-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.character-tag {
  margin: 0;
}

.tag-input {
  width: 120px;
}

.add-tag-btn {
  margin: 0;
}

// ---- 语速滑块 ----

.slider-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 104px;
  align-items: flex-start;
  gap: 14px;
  width: 100%;
  padding: 0 2px 20px 0;

  :deep(.el-slider) {
    --el-slider-runway-bg-color: #e6edf4;
    min-width: 0;
  }

  :deep(.el-slider__marks-text) {
    white-space: nowrap;
    font-size: 11px;
  }
}

.speed-input {
  width: 104px;
}

// ---- 表单提示 ----

.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.2;
}

// ---- 对话框 ----

::v-deep(.el-dialog) {
  border-radius: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
