<script lang="ts" setup>
import { Fold, Expand, Monitor, ArrowDown } from '@element-plus/icons-vue'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { isCollapse } from '@/utils/navbar'
import BreadCrumb from '@/components/BreadCrumb.vue'
import { getUserInfoRequest, type UserInfo } from '@/api/user'
import { useTokenStore } from '@/stores/userToken'
import { ElMessage } from 'element-plus'
import { AxiosError } from 'axios'

const router = useRouter()
const tokenStore = useTokenStore()
const userInfoItem = ref({} as UserInfo)

const roleLabel = computed(() => {
  const role = tokenStore.userInfo.role
  return role === 'admin' ? '景区管理员' : role === 'guide' ? '数字导游' : '运营成员'
})

const displayName = computed(() => userInfoItem.value.username || tokenStore.userInfo.username || '运营用户')

const handleLogout = () => {
  tokenStore.logout()
  router.push('/login')
}

onMounted(async () => {
  try {
    const { data } = await getUserInfoRequest()
    if (data.code === 0) {
      userInfoItem.value = data.data
    } else {
      ElMessage.error('获取用户信息失败: ' + data.message)
    }
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      ElMessage.error('获取用户信息失败: ' + error.message)
    } else {
      ElMessage.error('未知错误：' + error)
    }
  }
})
</script>

<template>
  <el-header class="topbar">
    <button class="collapse-trigger" type="button" aria-label="切换侧边栏" @click="isCollapse = !isCollapse">
      <el-icon><Fold v-show="isCollapse" /><Expand v-show="!isCollapse" /></el-icon>
    </button>

    <BreadCrumb class="breadcrumb" />

    <div class="topbar-actions">
      <div class="system-health">
        <el-icon><Monitor /></el-icon>
        <span>运营系统</span>
        <b>在线</b>
      </div>
      <el-dropdown trigger="click" placement="bottom-end">
        <button class="user-trigger" type="button">
          <el-avatar :size="34" :src="userInfoItem.avatar" class="user-avatar">{{ displayName.slice(0, 1) }}</el-avatar>
          <span class="user-meta">
            <strong>{{ displayName }}</strong>
            <small>{{ roleLabel }}</small>
          </span>
          <el-icon class="arrow"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu class="user-dropdown">
            <el-dropdown-item disabled>{{ roleLabel }}</el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-header>
</template>

<style lang="scss" scoped>
.topbar {
  display: flex;
  align-items: center;
  height: 68px;
  padding: 0 26px;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.93);
  box-shadow: 0 5px 18px rgba(19, 42, 56, 0.04);
  backdrop-filter: blur(16px);
}

.collapse-trigger,
.user-trigger {
  border: 0;
  font: inherit;
  cursor: pointer;
}

.collapse-trigger {
  display: inline-grid;
  width: 34px;
  height: 34px;
  margin-right: 16px;
  place-items: center;
  border-radius: 8px;
  color: var(--ink-700);
  background: transparent;
  transition: background-color 0.16s ease, color 0.16s ease;

  &:hover {
    color: var(--brand-700);
    background: var(--brand-50);
  }

  .el-icon {
    font-size: 18px;
  }
}

.breadcrumb :deep(.el-breadcrumb__inner),
.breadcrumb :deep(.el-breadcrumb__inner a) {
  color: var(--ink-500);
  font-size: 13px;
  font-weight: 600;
}

.breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--ink-900);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}

.system-health {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--ink-500);
  font-size: 12px;

  .el-icon {
    color: var(--brand-600);
  }

  b {
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--success);
    background: #edf8f4;
    font-size: 10px;
    font-weight: 700;
  }
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 3px 0 3px 8px;
  color: var(--ink-900);
  background: transparent;
}

.user-avatar {
  border: 2px solid #e2eff2;
  color: var(--brand-700);
  background: var(--brand-100);
  font-size: 12px;
  font-weight: 800;
}

.user-meta {
  display: grid;
  gap: 2px;
  min-width: 72px;
  text-align: left;

  strong {
    max-width: 118px;
    overflow: hidden;
    color: var(--ink-900);
    font-size: 12px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--ink-500);
    font-size: 10px;
  }
}

.arrow {
  color: var(--ink-400);
  font-size: 12px;
}

.topbar {
  height: 64px;
  padding: 0 24px;
  border-bottom-color: #e3e8eb;
  background: rgba(250, 251, 251, 0.94);
  box-shadow: 0 4px 16px rgba(7, 25, 35, 0.035);
}
.collapse-trigger:hover { color: #0f5f66; background: #edf7f5; }
.system-health .el-icon { color: #0d9488; }
.system-health b { color: #0f7a67; background: #e8f5f1; }
.user-avatar { border-color: #d8e4e3; color: #0f5f66; background: #e3f2ef; }

/* Clean exhibition topbar */
.topbar {
  height: 68px;
  padding: 0 28px;
  border-bottom-color: #e7e9ef;
  background: rgba(255,255,255,.9);
  box-shadow: none;
  backdrop-filter: blur(20px);
}
.collapse-trigger:hover { color: #3b5bff; background: #f0f2ff; }
.system-health .el-icon { color: #3b5bff; }
.system-health b { color: #247a5c; background: #ecf8f3; }
.user-avatar { border-color: #dfe3f5; color: #2948c8; background: #edf0ff; }
</style>
