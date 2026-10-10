<script lang="ts" setup>
import BrandLogo from '@/components/BrandLogo.vue'
import { computed } from 'vue'
import {
  User,
  House,
  Picture,
  Collection,
  Guide,
  DataAnalysis,
  VideoCamera,
} from '@element-plus/icons-vue'

import { useRoute } from 'vue-router'
import { isCollapse } from '@/utils/navbar'
import { useTokenStore } from '@/stores/userToken'

const route = useRoute()
const tokenStore = useTokenStore()
const isAdmin = computed(() => tokenStore.userInfo.role === 'admin')
</script>

<template>
  <div class="aside-shell" :class="{ collapsed: isCollapse }">
    <div class="brand-block">
      <BrandLogo compact :icon-only="isCollapse" />
    </div>

    <el-menu
      :router="true"
      :default-active="route.fullPath"
      :collapse="isCollapse"
      :collapse-transition="false"
      class="enterprise-menu"
    >
      <el-menu-item index="/home">
        <el-icon><House /></el-icon><span>综合看板</span>
      </el-menu-item>

      <div v-show="!isCollapse" class="menu-caption secondary">管理模块</div>
      <el-sub-menu index="/scenic-spot">
        <template #title>
          <el-icon><Picture /></el-icon><span>知识库管理</span>
        </template>
        <el-menu-item index="/scenic-spot/list"><span>景点档案</span></el-menu-item>
        <el-menu-item index="/knowledge/list"><span>景区知识</span></el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="/personalization">
        <template #title>
          <el-icon><Guide /></el-icon><span>个性化导览管理</span>
        </template>
        <el-menu-item index="/tour-route/list"><span>默认路线管理</span></el-menu-item>
        <el-menu-item index="/digital-guide/list"><span>数字人形象管理</span></el-menu-item>
      </el-sub-menu>

      <div v-show="!isCollapse" class="menu-caption secondary">洞察中心</div>
      <el-sub-menu index="/analytics">
        <template #title>
          <el-icon><DataAnalysis /></el-icon><span>感受度分析</span>
        </template>
        <el-menu-item index="/tour-session/overview"><span>游览AI分析</span></el-menu-item>
        <el-menu-item index="/analytics/feedback"><span>游客反馈分析</span></el-menu-item>
      </el-sub-menu>
    </el-menu>


  </div>
</template>

<style lang="scss" scoped>
.aside-shell {
  min-height: 100vh;
  padding: 18px 12px 16px;
  color: var(--champagne-text);
  background: var(--glass);
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 54px;
  padding: 0 10px 18px;
  border-bottom: 1px solid var(--glass-line);
}

.brand-mark {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border: 1px solid var(--glass-line);
  border-radius: 9px;
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.brand-copy {
  min-width: 0;

  strong,
  span {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  strong {
    color: var(--text);
    font-size: 14px;
    font-weight: 750;
    letter-spacing: 0.025em;
  }

  span {
    margin-top: 4px;
    color: var(--champagne-text);
    font-size: 9px;
    letter-spacing: 0.15em;
  }
}

.menu-caption {
  padding: 22px 12px 8px;
  color: var(--champagne-text);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.menu-caption.secondary {
  padding-top: 20px;
}

.enterprise-menu {
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--text-secondary);
  --el-menu-hover-bg-color: var(--glass);
  --el-menu-active-color: var(--champagne-text);
  border-right: none;
  background: transparent;
}

.enterprise-menu :deep(.el-menu-item),
.enterprise-menu :deep(.el-sub-menu__title) {
  height: 44px;
  margin: 3px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.enterprise-menu :deep(.el-menu-item .el-icon),
.enterprise-menu :deep(.el-sub-menu__title .el-icon) {
  color: var(--champagne-text);
  font-size: 17px;
}

.enterprise-menu :deep(.el-menu-item.is-active) {
  color: var(--champagne-text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}

.enterprise-menu :deep(.el-menu-item.is-active .el-icon) {
  color: var(--champagne-text);
}

.enterprise-menu :deep(.el-menu--inline) {
  background: var(--glass);
}

.enterprise-menu :deep(.el-menu--collapse) {
  width: 48px;
}

.aside-footer {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 26px 8px 0;
  padding: 12px 10px;
  border: 1px solid var(--glass-line);
  border-radius: 8px;
  color: var(--champagne-text);
  background: var(--glass);
  font-size: 11px;

  .el-icon {
    color: var(--success);
  }

  i {
    width: 6px;
    height: 6px;
    margin-left: auto;
    border-radius: 50%;
    background: var(--glass);
    box-shadow: var(--glass-shadow);
  }
}

.collapsed {
  padding-left: 12px;
  padding-right: 12px;

  .brand-block {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }
}

/* Dark research-navigation skin */
.aside-shell {
  color: var(--text-muted);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.brand-block { border-bottom-color: var(--glass-line); }
.brand-mark {
  border-color: var(--glass-line);
  border-radius: 8px;
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.brand-copy strong { color: var(--text); font-weight: 700; }
.brand-copy span { color: var(--text-muted); }
.menu-caption { color: var(--text-secondary); }
.enterprise-menu {
  --el-menu-text-color: var(--text-secondary);
  --el-menu-hover-bg-color: var(--glass);
  --el-menu-active-color: var(--champagne-text);
}
.enterprise-menu :deep(.el-menu-item .el-icon),
.enterprise-menu :deep(.el-sub-menu__title .el-icon) { color: var(--text-muted); }
.enterprise-menu :deep(.el-menu-item.is-active) {
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.enterprise-menu :deep(.el-menu-item.is-active .el-icon) { color: var(--champagne-text); }
.enterprise-menu :deep(.el-menu--inline) { background: var(--glass); }
.aside-footer {
  border-color: var(--glass-line);
  color: var(--text-muted);
  background: var(--glass);
}

/* Obsidian/cobalt exhibition navigation */
.aside-shell {
  color: var(--text);
  background: var(--glass);
  box-shadow: var(--glass-shadow);
}
.brand-block { border-bottom-color: var(--glass-line); }
.brand-mark { border: 0; border-radius: 10px; background: var(--glass); box-shadow: var(--glass-shadow); }
.brand-copy strong { color: var(--text); font-weight: 720; }
.brand-copy span { color: var(--text-secondary); }
.menu-caption { color: var(--text-secondary); letter-spacing: .12em; }
.enterprise-menu {
  --el-menu-text-color: var(--text-secondary);
  --el-menu-hover-bg-color: var(--glass);
  --el-menu-active-color: var(--champagne-text);
}
.enterprise-menu :deep(.el-menu-item .el-icon),.enterprise-menu :deep(.el-sub-menu__title .el-icon) { color: var(--text-secondary); }
.enterprise-menu :deep(.el-menu-item.is-active) { color: var(--text); background: var(--glass); box-shadow: var(--glass-shadow); }
.enterprise-menu :deep(.el-menu-item.is-active .el-icon) { color: var(--text); }
.enterprise-menu :deep(.el-menu--inline) { background: var(--glass); }
.aside-footer { border-color: var(--glass-line); color: var(--text-muted); background: rgba(99,102,241,0.035); }
</style>
