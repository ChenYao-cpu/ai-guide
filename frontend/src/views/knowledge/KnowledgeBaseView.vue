<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Delete, Document, Refresh, DataAnalysis, Upload, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadProps } from 'element-plus'

import { header_authorization } from '@/api/user'
import {
  uploadDoc,
  getDocList,
  deleteDoc,
  rebuildIndex,
  testAccuracy,
  type KnowledgeDocListData,
  type AccuracyTestResult,
} from '@/api/knowledgeBase'
import { AxiosError } from 'axios'
import type { UploadRequestOptions } from 'element-plus'

// 加载框
const tableLoading = ref(true)

// 查询 - 条件
const queryCondition = ref({
  currentPage: 1,
  pageSize: 10,
  title: '',
})

// 查询 - 结果
const queriedResult = ref<KnowledgeDocListData>({} as KnowledgeDocListData)

// 状态标签映射
const statusLabelMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
}

const statusTagTypeMap: Record<string, string> = {
  pending: 'warning',
  processing: '',
  completed: 'success',
  failed: 'danger',
}

const getStatusLabel = (status: string) => {
  return statusLabelMap[status] || status
}

const getStatusTagType = (status: string): '' | 'success' | 'warning' | 'danger' | 'info' => {
  return (statusTagTypeMap[status] as '' | 'success' | 'warning' | 'danger' | 'info') || 'info'
}

// 查询 - 方法
const fetchDocList = async () => {
  tableLoading.value = true

  try {
    const { data } = await getDocList({
      currentPage: queryCondition.value.currentPage,
      pageSize: queryCondition.value.pageSize,
      title: queryCondition.value.title || undefined,
    })
    tableLoading.value = false

    if (data.code === 0) {
      queriedResult.value = data.data
    } else {
      ElMessage.error('知识库接口错误')
      throw new Error('知识库接口错误')
    }
  } catch (error: unknown) {
    tableLoading.value = false
    if (error instanceof AxiosError) {
      ElMessage.error('知识库接口失败: ' + error.message)
    } else {
      ElMessage.error('未知错误：' + error)
    }
  }
}

onMounted(() => {
  fetchDocList()
})

// 删除文档
const isDeleting = ref(false)
const handleDelete = async (id: number, title: string) => {
  ElMessageBox.confirm('确定要删除文档 "' + title + '" 吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
    showClose: false,
  })
    .then(async () => {
      ElMessage.success('正在删除 ' + title + '，请稍候')
      isDeleting.value = true
      const { data } = await deleteDoc(id)
      if (data.code === 0) {
        ElMessage.success('删除成功')
        fetchDocList()
      } else {
        ElMessage.error('删除失败')
      }
      isDeleting.value = false
    })
    .catch(() => {
      // 取消操作
    })
}

// 文件上传成功回调
const handleUploadSuccess: UploadProps['onSuccess'] = () => {
  ElMessage.success('文档上传成功，正在构建索引...')
  fetchDocList()
}

// 文件上传失败回调
const handleUploadFail: UploadProps['onError'] = (error: Error) => {
  ElMessage.error('上传文件失败: ' + (error.message || '请稍后重试'))
}

// 自定义上传（使用 knowledge-base/upload API）
const customUpload = async (options: UploadRequestOptions) => {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('title', (options.file as File).name)

  try {
    const { data } = await uploadDoc(formData)
    if (data.code === 0) {
      ElMessage.success('文档上传成功！系统正在自动构建索引，请稍候刷新')
      fetchDocList()
    } else {
      ElMessage.error('上传失败: ' + (data.message || '未知错误'))
    }
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      ElMessage.error('上传失败: ' + error.message)
    } else {
      ElMessage.error('上传失败')
    }
  }
}

// 文件上传前校验
const beforeUpload: UploadProps['beforeUpload'] = (rawFile) => {
  const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md']
  const fileName = rawFile.name.toLowerCase()
  const isValid = allowedExtensions.some((ext) => fileName.endsWith(ext))

  if (!isValid) {
    ElMessage.error('只支持 PDF、Word、TXT、Markdown 格式的文档!')
    return false
  }

  if (rawFile.size / 1024 / 1024 > 20) {
    ElMessage.error('文档文件大小不能超过 20MB!')
    return false
  }

  return true
}

// 重建索引
const isRebuilding = ref(false)
const handleRebuildIndex = async () => {
  ElMessageBox.confirm(
    '重建索引将重新处理所有文档，可能需要几分钟时间。确定要继续吗？',
    '确认操作',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      showClose: false,
    },
  )
    .then(async () => {
      isRebuilding.value = true
      ElMessage.success('正在重建索引，请稍候...')
      try {
        const { data } = await rebuildIndex()
        if (data.code === 0) {
          ElMessage.success('索引重建完成')
          fetchDocList()
        } else {
          ElMessage.error('索引重建失败: ' + data.message)
        }
      } catch (error: unknown) {
        if (error instanceof AxiosError) {
          ElMessage.error('索引重建失败: ' + error.message)
        } else {
          ElMessage.error('未知错误：' + error)
        }
      }
      isRebuilding.value = false
    })
    .catch(() => {
      // 取消操作
    })
}

// 知识问答评测：调用后端真实执行 RAG 检索、LLM 生成和关键词覆盖判定
const accuracyDialogVisible = ref(false)
const accuracyLoading = ref(false)
const accuracyResult = ref<AccuracyTestResult | null>(null)
const accuracyError = ref('')

const handleAccuracyTest = async () => {
  accuracyDialogVisible.value = true
  accuracyLoading.value = true
  accuracyResult.value = null
  accuracyError.value = ''

  try {
    const { data } = await testAccuracy()
    if (data.code === 0 && data.data) {
      accuracyResult.value = data.data
    } else {
      accuracyError.value = data.message || '评测执行失败'
      ElMessage.error(accuracyError.value)
    }
  } catch (error: unknown) {
    accuracyError.value = error instanceof AxiosError ? error.message : String(error)
    ElMessage.error('评测执行失败: ' + accuracyError.value)
  } finally {
    accuracyLoading.value = false
  }
}
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <!-- 顶部操作栏 -->
        <div class="card-header">
          <div class="header-left">
            <!-- 文档上传 -->
            <el-upload
              class="upload-area"
              drag
              :multiple="true"
              :show-file-list="false"
              :http-request="customUpload"
              :before-upload="beforeUpload"
              accept=".pdf,.docx,.doc,.txt,.md"
            >
              <el-icon class="el-icon--upload" :size="24">
                <Upload />
              </el-icon>
              <div class="el-upload__text">
                将文档拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 PDF / Word / TXT / Markdown 格式，单个文件不超过 20MB
                </div>
              </template>
            </el-upload>
          </div>
          <div class="header-right">
            <!-- 全部重建索引 -->
            <el-button
              type="warning"
              :icon="Refresh"
              @click="handleRebuildIndex"
              :loading="isRebuilding"
            >
              全部重建索引
            </el-button>
            <!-- 知识问答真实评测 -->
            <el-button
              type="success"
              :icon="DataAnalysis"
              @click="handleAccuracyTest"
            >
              知识问答评测
            </el-button>
          </div>
        </div>
      </template>

      <!-- 文档列表表格 -->
      <el-table :data="queriedResult.doc_list" max-height="1000" v-loading="tableLoading">
        <el-table-column prop="title" label="文档标题" align="center" min-width="200px" />

        <el-table-column prop="file_type" label="文件类型" align="center" width="120px">
          <template #default="scope">
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px">
              <el-icon :size="18" color="var(--champagne-text)">
                <Document />
              </el-icon>
              <span>{{ scope.row.file_type ? scope.row.file_type.toUpperCase() : '-' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="chunk_count" label="分块数量" align="center" width="100px" />

        <el-table-column prop="upload_time" label="上传时间" align="center" width="170px" />

        <el-table-column prop="status" label="状态" align="center" width="110px">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)" size="small">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" v-slot="{ row }" align="center" width="100px">
          <el-button
            type="danger"
            @click="handleDelete(row.doc_id, row.title)"
            :icon="Delete"
            :disabled="isDeleting"
            size="small"
          />
        </el-table-column>
      </el-table>

      <!-- 分页栏 -->
      <template #footer>
        <el-pagination
          v-model:current-page="queriedResult.currentPage"
          v-model:page-size="queriedResult.pageSize"
          :page-sizes="[5, 10, 15, 20]"
          :background="true"
          layout="total, sizes, prev, pager, next, jumper"
          :total="queriedResult.totalSize || 0"
          @size-change="fetchDocList"
          @current-change="fetchDocList"
        />
      </template>
    </el-card>

    <!-- 知识问答评测弹窗 -->
    <el-dialog
      v-model="accuracyDialogVisible"
      title="知识问答评测结果"
      width="800px"
      top="5vh"
      :close-on-press-escape="true"
    >
      <!-- 加载圆圈 -->
      <div v-if="accuracyLoading" style="text-align: center; padding: 60px 0">
        <el-icon :size="48" style="animation: spin 1s linear infinite; color: var(--champagne-text)">
          <Loading />
        </el-icon>
        <p style="margin-top: 16px; color: var(--text-muted)">正在执行 RAG 检索与大模型回答评测，请稍候...</p>
      </div>

      <el-alert v-else-if="accuracyError" :title="accuracyError" type="error" show-icon :closable="false" />

      <template v-else-if="accuracyResult">
        <!-- 测试概览 -->
        <el-descriptions :column="2" border style="margin-bottom: 20px">
          <el-descriptions-item label="测试总数">{{ accuracyResult.total }}</el-descriptions-item>
          <el-descriptions-item label="正确数量">{{ accuracyResult.correct }}</el-descriptions-item>
          <el-descriptions-item :label="accuracyResult.metric_name">
            <el-tag :type="accuracyResult.passed ? 'success' : 'danger'" size="large" effect="dark">
              {{ accuracyResult.accuracy.toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="测试结果">
            <el-tag :type="accuracyResult.passed ? 'success' : 'danger'" size="large" effect="dark">
              {{ accuracyResult.passed ? '通过' : '未通过' }}（阈值 {{ accuracyResult.pass_threshold }}%）
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="模型">{{ accuracyResult.model_name }}</el-descriptions-item>
          <el-descriptions-item label="耗时">{{ (accuracyResult.duration_ms / 1000).toFixed(1) }} 秒</el-descriptions-item>
          <el-descriptions-item label="判定方法" :span="2">{{ accuracyResult.evaluation_method }}</el-descriptions-item>
        </el-descriptions>

        <!-- 详细结果列表 -->
        <div v-if="accuracyResult.details && accuracyResult.details.length > 0">
          <h4 style="margin-bottom: 12px">测试详情</h4>
          <el-table :data="accuracyResult.details" max-height="420" size="small" border>
            <el-table-column type="index" label="#" width="50" align="center" />
            <el-table-column prop="question" label="预设问题" min-width="160" show-overflow-tooltip />
            <el-table-column prop="expected_keywords" label="预设关键词" width="130">
              <template #default="scope">
                <div style="display: flex; flex-wrap: wrap; gap: 2px">
                  <el-tag
                    v-for="(kw, i) in (scope.row.expected_keywords || '').split(',')"
                    :key="i"
                    size="small"
                    type="warning"
                    effect="plain"
                    style="margin: 1px"
                  >
                    {{ kw.trim() }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="expected_answer" label="预期答案" min-width="140" show-overflow-tooltip />
            <el-table-column prop="actual_answer" label="RAG 回答" min-width="140" show-overflow-tooltip>
              <template #default="scope">
                <span :style="{ color: scope.row.error ? 'var(--danger)' : 'var(--text)' }">
                  {{ scope.row.error || scope.row.actual_answer }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="覆盖" width="95" align="center">
              <template #default="scope">
                {{ scope.row.matched_count }}/{{ scope.row.required_count }}
                <div style="font-size: 11px; color: var(--text-muted)">{{ scope.row.keyword_coverage }}%</div>
              </template>
            </el-table-column>
            <el-table-column prop="is_correct" label="结果" width="80" align="center">
              <template #default="scope">
                <el-tag :type="scope.row.is_correct ? 'success' : 'danger'" size="small" effect="dark">
                  {{ scope.row.is_correct ? '通过' : '未通过' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>

      <template #footer>
        <div style="display: flex; justify-content: center; gap: 12px">
          <el-button @click="handleAccuracyTest" type="primary"> 重新测试</el-button>
          <el-button @click="accuracyDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.el-card {
  border-radius: 12px;
}

// 顶部操作栏
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;

  .header-left {
    flex: 0 0 auto;
  }

  .header-right {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

// 上传区域
.upload-area {
  :deep(.el-upload-dragger) {
    width: 360px;
    height: 100px;
  }
}

// 分页框
.el-pagination {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}

// 去掉表格下边框线
:deep(.el-table__inner-wrapper::before) {
  height: 0;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
