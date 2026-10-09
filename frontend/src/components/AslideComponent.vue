<script lang="ts" setup>
import { computed } from 'vue'
import {
  User,
  House,
  Picture,
  Collection,
  Guide,
  DataAnalysis,
  VideoCamera,
  Monitor,
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
      <div class="brand-mark">AI</div>
      <div v-show="!isCollapse" class="brand-copy">
        <strong>智游灵境</strong>
        <span>SCENIC INTELLIGENCE</span>
      </div>
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

    <div v-show="!isCollapse" class="aside-footer">
      <el-icon><Monitor /></el-icon>
      <span>系统服务正常</span>
      <i></i>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.aside-shell {
  min-height: 100vh;
  padding: 18px 12px 16px;
  color: #0b4166;
  background:
    radial-gradient(circle at 0 0, rgba(255, 255, 255, 0.72), transparent 12rem),
    linear-gradient(180deg, #e5f7ff 0%, #b9eaff 100%);
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 54px;
  padding: 0 10px 18px;
  border-bottom: 1px solid rgba(2, 132, 199, 0.12);
}

.brand-mark {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 9px;
  color: #ffffff;
  background: linear-gradient(135deg, #38bdf8, #0284c7);
  box-shadow: 0 7px 18px rgba(14, 116, 144, 0.22);
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
    color: #083f63;
    font-size: 14px;
    font-weight: 750;
    letter-spacing: 0.025em;
  }

  span {
    margin-top: 4px;
    color: #42708c;
    font-size: 9px;
    letter-spacing: 0.15em;
  }
}

.menu-caption {
  padding: 22px 12px 8px;
  color: #4d7c96;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.menu-caption.secondary {
  padding-top: 20px;
}

.enterprise-menu {
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #24516d;
  --el-menu-hover-bg-color: rgba(255, 255, 255, 0.5);
  --el-menu-active-color: #075985;
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
  color: #4182a6;
  font-size: 17px;
}

.enterprise-menu :deep(.el-menu-item.is-active) {
  color: #075985;
  background: rgba(255, 255, 255, 0.64);
  box-shadow: inset 3px 0 0 #0ea5e9, 0 10px 20px rgba(14, 116, 144, 0.08);
}

.enterprise-menu :deep(.el-menu-item.is-active .el-icon) {
  color: #0284c7;
}

.enterprise-menu :deep(.el-menu--inline) {
  background: rgba(255, 255, 255, 0.28);
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
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 8px;
  color: #24516d;
  background: rgba(255, 255, 255, 0.42);
  font-size: 11px;

  .el-icon {
    color: #16a34a;
  }

  i {
    width: 6px;
    height: 6px;
    margin-left: auto;
    border-radius: 50%;
    background: #5bc79e;
    box-shadow: 0 0 0 4px rgba(91, 199, 158, 0.12);
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
  color: #d7e4e8;
  background:
    radial-gradient(circle at 8% 0%, rgba(20, 184, 166, 0.12), transparent 14rem),
    linear-gradient(180deg, #091c26 0%, #0b2431 56%, #0a202b 100%);
  box-shadow: inset -1px 0 0 rgba(155, 184, 195, 0.12);
}
.brand-block { border-bottom-color: rgba(142, 173, 185, 0.13); }
.brand-mark {
  border-color: rgba(94, 234, 212, 0.22);
  border-radius: 8px;
  background: linear-gradient(145deg, #14b8a6, #0f5f66);
  box-shadow: 0 8px 22px rgba(13, 148, 136, 0.2);
}
.brand-copy strong { color: #eef6f7; font-weight: 700; }
.brand-copy span { color: #6f8c99; }
.menu-caption { color: #607e8b; }
.enterprise-menu {
  --el-menu-text-color: #9fb3bc;
  --el-menu-hover-bg-color: rgba(45, 212, 191, 0.07);
  --el-menu-active-color: #e7faf7;
}
.enterprise-menu :deep(.el-menu-item .el-icon),
.enterprise-menu :deep(.el-sub-menu__title .el-icon) { color: #7297a3; }
.enterprise-menu :deep(.el-menu-item.is-active) {
  color: #e7faf7;
  background: rgba(20, 184, 166, 0.14);
  box-shadow: inset 2px 0 0 #2dd4bf;
}
.enterprise-menu :deep(.el-menu-item.is-active .el-icon) { color: #5eead4; }
.enterprise-menu :deep(.el-menu--inline) { background: rgba(3, 15, 21, 0.2); }
.aside-footer {
  border-color: rgba(142, 173, 185, 0.14);
  color: #8ea6b0;
  background: rgba(5, 20, 27, 0.28);
}

/* Obsidian/cobalt exhibition navigation */
.aside-shell {
  color: #e5e8f3;
  background:
    radial-gradient(circle at 18% 0%, rgba(70,96,255,.2), transparent 17rem),
    #10131c;
  box-shadow: inset -1px 0 0 rgba(255,255,255,.07);
}
.brand-block { border-bottom-color: rgba(255,255,255,.08); }
.brand-mark { border: 0; border-radius: 10px; background: #3b5bff; box-shadow: 0 12px 30px rgba(59,91,255,.28); }
.brand-copy strong { color: #fff; font-weight: 720; }
.brand-copy span { color: #6f778d; }
.menu-caption { color: #616a80; letter-spacing: .12em; }
.enterprise-menu {
  --el-menu-text-color: #9aa2b7;
  --el-menu-hover-bg-color: rgba(255,255,255,.055);
  --el-menu-active-color: #fff;
}
.enterprise-menu :deep(.el-menu-item .el-icon),.enterprise-menu :deep(.el-sub-menu__title .el-icon) { color: #707991; }
.enterprise-menu :deep(.el-menu-item.is-active) { color: #fff; background: #3b5bff; box-shadow: 0 12px 28px rgba(59,91,255,.22); }
.enterprise-menu :deep(.el-menu-item.is-active .el-icon) { color: #fff; }
.enterprise-menu :deep(.el-menu--inline) { background: rgba(0,0,0,.12); }
.aside-footer { border-color: rgba(255,255,255,.08); color: #7c8499; background: rgba(255,255,255,.035); }
</style>
