"""One-time source migration away from the legacy VRM editor."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'frontend/src/views/digital-guide/DigitalGuideView.vue'
source = path.read_text(encoding='utf-8')
source = source.replace(', defineAsyncComponent', '')
source = source.replace("import AvatarConfiguration from '@/components/AvatarConfiguration.vue'", "import AvatarConfiguration from '@/components/AvatarConfiguration.vue'\nimport { request_handler } from '@/api/base'")
start = source.index('// ======================== VRM 模型选项')
end = source.index('// ======================== 语音风格选项', start)
source = source[:start] + '''// ======================== 后端提供的卡通模型清单 ========================
const availableVRMModels = ref<{ label: string; path: string }[]>([])
async function scanVRMModels() {
  try {
    const response = await request_handler.get('/avatar/cartoon-models')
    availableVRMModels.value = response.data.data || []
  } catch { availableVRMModels.value = []; ElMessage.error('卡通模型清单读取失败') }
}

''' + source[end:]
source = source.replace("|| (expectedGender === 'male' ? '/models/西装男导游1.vrm' : '/models/西装女.vrm')", "|| ''")
source = source.replace("form.live2d_model_path = '/models/西装女.vrm'", "form.live2d_model_path = availableVRMModels.value[0]?.path || ''")
start = source.index('            <el-button\n              v-if="form.live2d_model_path"')
end = source.index('            </el-button>', start) + len('            </el-button>')
source = source[:start] + source[end:]
start = source.index('    <!-- VRM 模型预览弹窗 -->')
end = source.index('    </el-dialog>', start) + len('    </el-dialog>')
source = source[:start] + source[end:]
source = source.replace('选择 VRM 模型', '选择 Live2D 卡通模型')
source = source.replace('将 .vrm 模型文件放入 public/models/ 目录，即可在此选择。\n            模型列表会根据所选声线自动筛选，避免男性模型使用女声或女性模型使用男声。', '模型清单由后端读取本地文件。真人形象请在导游卡片中上传基础视频。')
source = source.replace("{{ modelGender(item.live2d_model_path) === 'male' ? '男性模型' : '女性模型' }}", "{{ item.live2d_model_path.endsWith('.vrm') ? '旧模型 · 待迁移' : 'Live2D 配置' }}")
path.write_text(source, encoding='utf-8')

for page in (path.parents[4] / 'miniprogram/pages').rglob('*.vue'):
    contents = page.read_text(encoding='utf-8')
    updated = contents.replace('rgba(248,241,229,0.92)', '#f6f7fa').replace('rgba(248, 241, 229, 0.92)', '#f6f7fa')
    if updated != contents:
        page.write_text(updated, encoding='utf-8')
