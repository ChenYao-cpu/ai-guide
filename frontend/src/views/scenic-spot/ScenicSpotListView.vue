<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Delete, Edit, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import InfoDialogComponents from '@/components/InfoDialogComponents.vue'

import {
  getSpotList,
  deleteSpot,
  type ScenicSpotListData,
} from '@/api/scenicSpot'
import { AxiosError } from 'axios'

const router = useRouter()

// 信息弹窗显示标识
const ShowItemInfo = ref()

// 加载框
const tableLoading = ref(true)

// 查询 - 条件
const queryCondition = ref({
  currentPage: 1,
  pageSize: 10,
  spotName: '',
  category: '',
})

// 查询 - 结果
const queriedResult = ref<ScenicSpotListData>({} as ScenicSpotListData)

// 分类选项
const categoryOptions = [
  { label: '全部', value: '' },
  { label: '自然景观', value: 'natural' },
  { label: '历史古迹', value: 'historical' },
  { label: '文化体验', value: 'cultural' },
  { label: '现代建筑', value: 'modern' },
  { label: '综合景区', value: 'comprehensive' },
]

const categoryLabelMap: Record<string, string> = {
  'natural': '自然景观',
  'historical': '历史古迹',
  'cultural': '文化体验',
  'modern': '现代建筑',
  'comprehensive': '综合景区',
}

const categoryTagTypeMap: Record<string, string> = {
  'natural': 'success',
  'historical': 'warning',
  'cultural': 'info',
  'modern': '',
  'comprehensive': 'danger',
}

// 查询 - 方法
const fetchSpotList = async () => {
  tableLoading.value = true

  try {
    const { data } = await getSpotList(
      queryCondition.value.currentPage,
      queryCondition.value.pageSize,
      queryCondition.value.spotName || undefined,
      queryCondition.value.category || undefined,
    )
    tableLoading.value = false

    if (data.code === 0) {
      queriedResult.value = data.data
    } else {
      ElMessage.error('景点接口错误')
      throw new Error('景点接口错误')
    }
  } catch (error: unknown) {
    tableLoading.value = false
    if (error instanceof AxiosError) {
      ElMessage.error('景点接口失败: ' + error.message)
    } else {
      ElMessage.error('未知错误：' + error)
    }
  }
}

onMounted(() => {
  fetchSpotList()
})

const getCategoryLabel = (category: string) => {
  return categoryLabelMap[category] || category
}

const getCategoryTagType = (category: string): '' | 'success' | 'warning' | 'info' | 'danger' => {
  return (categoryTagTypeMap[category] as '' | 'success' | 'warning' | 'info' | 'danger') || ''
}

const isDeleting = ref(false)
const handleDelete = async (id: number, spotName: string) => {
  ElMessageBox.confirm('确定要删除景点 "' + spotName + '" 吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
    showClose: false,
  })
    .then(async () => {
      ElMessage.success('正在删除 ' + spotName + '，请稍候')
      isDeleting.value = true
      const { data } = await deleteSpot(id)
      if (data.code === 0) {
        ElMessage.success('删除成功')
        fetchSpotList()
      } else {
        ElMessage.error('删除失败')
      }
      isDeleting.value = false
    })
    .catch(() => {
      // 取消操作
    })
}
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <!-- 头部 -->
        <div class="card-header">
          <div>
            <el-form :inline="true">
              <el-form-item label="搜索">
                <el-input
                  style="width: 240px"
                  v-model="queryCondition.spotName"
                  placeholder="景点名称"
                  clearable
                />
              </el-form-item>
              <el-form-item label="分类">
                <el-select
                  v-model="queryCondition.category"
                  placeholder="景点分类"
                  clearable
                  style="width: 160px"
                >
                  <el-option
                    v-for="item in categoryOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="fetchSpotList">
                  <el-icon style="margin-right: 5px">
                    <Search />
                  </el-icon>
                  查询
                </el-button>
              </el-form-item>
            </el-form>
          </div>
          <div>
            <!-- 添加景点 -->
            <el-button type="primary" @click="router.push({ name: 'ScenicSpotCreate' })">
              <el-icon style="margin-right: 5px">
                <Plus />
              </el-icon>
              添加景点
            </el-button>
          </div>
        </div>
      </template>

      <!-- 中部表格信息 -->
      <el-table :data="queriedResult.spot_list" max-height="1000" v-loading="tableLoading">
        <el-table-column prop="spot_id" label="景点ID" align="center" width="80px" />

        <el-table-column prop="image_path" label="图片" align="center" width="100px">
          <template #default="scope">
            <div style="display: flex; align-items: center; justify-content: center">
              <el-image
                :src="scope.row.image_path"
                :preview-src-list="[scope.row.image_path]"
                style="width: 60px; height: 60px"
                fit="cover"
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="spot_name" label="景点名称" align="center" min-width="140px" />

        <el-table-column prop="category" label="分类" align="center" width="110px">
          <template #default="scope">
            <el-tag :type="getCategoryTagType(scope.row.category)" size="small">
              {{ getCategoryLabel(scope.row.category) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="tags" label="标签" align="center" min-width="160px">
          <template #default="scope">
            <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center">
              <el-tag
                v-for="(tag, index) in (scope.row.tags ? scope.row.tags.split(';').filter(Boolean) : [])"
                :key="index"
                size="small"
                type="info"
              >
                {{ tag }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="location" label="所在位置" align="center" min-width="140px" />
        <el-table-column prop="best_season" label="最佳季节" align="center" width="110px" />
        <el-table-column prop="upload_date" label="上传时间" align="center" width="160px" />

        <el-table-column label="操作" v-slot="{ row }" align="center" width="230px">
          <div class="control-item">
            <el-button
              :type="row.instruction ? 'success' : 'warning'"
              :disabled="!row.instruction"
              size="small"
              @click="
                ShowItemInfo.showItemInfoDialog(
                  row.spot_name,
                  'Instruction',
                  row.instruction,
                  row.spot_id,
                )
              "
            >
              游览说明
            </el-button>

            <!-- 编辑按钮 -->
            <el-button
              type="primary"
              :icon="Edit"
              size="small"
              @click="router.push({ name: 'ScenicSpotEdit', params: { spotId: row.spot_id } })"
            />

            <!-- 删除按钮 -->
            <el-button
              type="danger"
              @click="handleDelete(row.spot_id, row.spot_name)"
              :icon="Delete"
              :disabled="isDeleting"
              size="small"
            />
          </div>
        </el-table-column>
      </el-table>

      <!-- 信息弹窗 -->
      <InfoDialogComponents ref="ShowItemInfo" />

      <!-- 分页栏 -->
      <template #footer>
        <el-pagination
          v-model:current-page="queryCondition.currentPage"
          v-model:page-size="queryCondition.pageSize"
          :page-sizes="[5, 10, 15, 20]"
          :background="true"
          layout="total, sizes, prev, pager, next, jumper"
          :total="queriedResult.totalSize || 0"
          @size-change="fetchSpotList"
          @current-change="fetchSpotList"
        />
      </template>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.el-card {
  border-radius: 12px;
}

.box-card {
  width: auto;
}

// 查询栏
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .el-form-item {
    margin-bottom: 0px;
  }
}

// 分页框
.el-pagination {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}

// 操作栏
.control-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

// 去掉表格下边框线
:deep(.el-table__inner-wrapper::before) {
  height: 0;
}
</style>
