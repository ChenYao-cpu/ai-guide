<script setup lang="ts">
import { ref, computed } from 'vue'

// 搜索关键词
const searchQuery = ref('')

// 全部订单数据
const allOrderList = [
  {
    id: 1,
    date: '2024-05-03',
    name: '电动牙刷',
    amount: 1,
    address: '广东省广州市********',
    status: '备货中'
  },
  {
    id: 2,
    date: '2024-05-02',
    name: '平板电脑',
    amount: 1,
    address: '北京市朝阳区********',
    status: '备货中'
  },
  {
    id: 3,
    date: '2024-05-01',
    name: '唇膏',
    amount: 1,
    address: '浙江省杭州市********',
    status: '已发货'
  },
  {
    id: 4,
    date: '2024-05-02',
    name: '洗发露',
    amount: 2,
    address: '上海市黄浦区********',
    status: '已完成'
  }
]

// 根据搜索关键词过滤后的数据
const tableData = computed(() => {
  if (!searchQuery.value.trim()) {
    return allOrderList
  }
  return allOrderList.filter(item =>
    item.name.includes(searchQuery.value.trim())
  )
})

// 查询按钮点击
const handleSearch = () => {
  // computed 会自动响应 searchQuery 的变化，这里不需要额外操作
  // 如果后续接入后端 API，在这里调用即可
}
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <el-form :inline="true">
              <el-form-item label="搜索">
                <el-input
                  v-model="searchQuery"
                  style="width: 240px"
                  placeholder="商品名称"
                  clearable
                  @keyup.enter="handleSearch"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="handleSearch"> 查询 </el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>

      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="id" label="ID" width="50" />
        <el-table-column prop="name" label="商品名称" />
        <el-table-column prop="amount" label="数量" />
        <el-table-column prop="date" label="下单时间" />
        <el-table-column prop="address" label="地址" />
        <el-table-column label="订单状态" v-slot="{ row }" align="center" width="250px">
          <el-tag :type="row.status === '已完成' ? 'success' : 'warning'">{{ row.status }}</el-tag>
        </el-table-column>
      </el-table>
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .el-form-item {
    margin-bottom: 0px;
  }
}
</style>