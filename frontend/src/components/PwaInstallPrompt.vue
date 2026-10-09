<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Download, CircleClose } from '@element-plus/icons-vue'

const showDialog = ref(false)
const isInstalled = ref(false)
const platform = ref<'ios' | 'android' | 'desktop'>('desktop')
const deferredPrompt = ref<any>(null)
const installUrl = ref('')
const isLocalhost = ref(false)
const isTunnelDetected = ref(false)
const networkUrls = ref<string[]>([])

// 获取局域网IP（Vite开发服务器会打印这个地址）
function getNetworkUrl(): string {
  // 尝试从页面加载资源推断实际服务器地址
  const scripts = document.querySelectorAll('script[type="module"]')
  for (const s of scripts) {
    const src = (s as HTMLScriptElement).src
    if (src && !src.includes('localhost') && !src.includes('127.0.0.1')) {
      const u = new URL(src)
      return `${u.protocol}//${u.host}`
    }
  }
  // 回退：显示当前origin
  return window.location.origin
}

onMounted(async () => {
  // 检测是否已在standalone模式
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isInstalled.value = true
    return
  }

  // 检测平台
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) {
    platform.value = 'ios'
  } else if (/Android/.test(ua)) {
    platform.value = 'android'
  } else {
    platform.value = 'desktop'
  }

  // 构建URL
  const origin = window.location.origin
  isLocalhost.value = origin.includes('localhost') || origin.includes('127.0.0.1')

  // 优先尝试获取 tunnel 公网地址（dev:public 模式自动生成）
  // 轮询最多15次（每2秒一次，共30秒），因为隧道可能在页面加载后才就绪
  let tunnelDetected = false
  if (isLocalhost.value) {
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const resp = await fetch('/tunnel-url.txt?' + attempt)
        if (resp.ok) {
          const url = (await resp.text()).trim()
          if (url && url.startsWith('http')) {
            installUrl.value = url
            tunnelDetected = true
            isTunnelDetected.value = true
            console.log('[PWA] 自动检测到公网隧道:', url)
            break
          }
        }
      } catch { /* 还未就绪 */ }
      // 等待2秒后重试
      if (!tunnelDetected && attempt < 14) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  if (!tunnelDetected) {
    if (isLocalhost.value) {
      const netUrl = getNetworkUrl()
      installUrl.value = netUrl !== origin ? netUrl + '/visitor/home' : origin + '/visitor/home'
    } else {
      installUrl.value = origin + '/visitor/home'
    }
  }

  networkUrls.value = [installUrl.value]

  // 监听PWA安装事件（Chrome/Edge）
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    setTimeout(() => { showDialog.value = true }, 1500)
  })

  // 不再自动弹窗（用右下角悬浮 📱 按钮代替）
})

// 关闭弹窗
function dismiss() {
  showDialog.value = false
  localStorage.setItem('pwa_prompt_dismissed', '1')
}

// Android: 触发Chrome PWA安装
async function installPwa() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const result = await deferredPrompt.value.userChoice
    if (result.outcome === 'accepted') {
      isInstalled.value = true
      showDialog.value = false
    }
    deferredPrompt.value = null
  } else {
    // 没有PWA安装事件时，显示手动引导
    showManualGuide()
  }
}

// 手动引导
function showManualGuide() {
  // 切换到手动引导模式 — 已在模板中处理
}

// 二维码URL（使用免费QR API）
const qrCodeUrl = computed(() => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(installUrl.value)}&margin=10&bgcolor=ffffff&color=0284c7`
})

// 监听URL手动修改 → 刷新二维码
function onUrlChange() {
  // installUrl 已通过 v-model 自动更新，qrCodeUrl 是 computed 会自动刷新
}

// 复制链接
function copyLink() {
  navigator.clipboard.writeText(installUrl.value).then(() => {
    const btn = document.querySelector('.copy-link-btn')
    if (btn) btn.textContent = '已复制!'
    setTimeout(() => { if (btn) btn.textContent = '复制' }, 1500)
  })
}
</script>

<template>
  <el-dialog
    v-model="showDialog"
    :title="isInstalled ? '已安装成功' : '安装智游灵境'"
    width="420px"
    :close-on-click-modal="false"
    :show-close="false"
    class="install-dialog"
  >
    <div class="install-body">
      <!-- 标题图标 -->
      <div class="install-hero">
        <div class="app-icon">🏔️</div>
        <h3>智游灵境</h3>
        <p>添加到手机桌面，享受APP级体验</p>
      </div>

      <!-- 已安装 -->
      <div v-if="isInstalled" class="installed-msg">
        <span class="check-icon">✅</span>
        <strong>APP已就绪</strong>
        <p>在手机桌面找到「智游灵境」图标即可开始使用</p>
        <el-button type="primary" @click="showDialog = false">开始导览</el-button>
      </div>

      <!-- iOS 引导 -->
      <div v-else-if="platform === 'ios'" class="guide-steps">
        <div class="step">
          <span class="step-num">1</span>
          <div>点击底部 <strong>Safari分享按钮</strong> <span class="icon-demo">⎋</span></div>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <div>向下滑动，点击 <strong>「添加到主屏幕」</strong></div>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <div>点击右上角「添加」→ 桌面出现APP图标</div>
        </div>
        <el-alert type="info" :closable="false" show-icon style="margin-top: 12px;">
          <template #title>
            使用 <strong>Safari浏览器</strong> 打开才能安装，微信/QQ内置浏览器不支持
          </template>
        </el-alert>
      </div>

      <!-- Android 引导 -->
      <div v-else-if="platform === 'android'" class="guide-steps">
        <template v-if="deferredPrompt">
          <p style="text-align:center;margin-bottom:16px;">点击下方按钮一键安装</p>
          <el-button type="primary" size="large" class="install-btn" @click="installPwa">
            <el-icon><Download /></el-icon> 安装APP到桌面
          </el-button>
        </template>
        <template v-else>
          <div class="step">
            <span class="step-num">1</span>
            <div>点击浏览器右上角 <strong>⋮ 菜单</strong></div>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <div>选择 <strong>「添加到主屏幕」</strong> 或 <strong>「安装应用」</strong></div>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <div>确认安装 → 桌面出现APP图标</div>
          </div>
          <el-alert type="warning" :closable="false" show-icon style="margin-top:12px;">
            <template #title>
              使用 <strong>Chrome浏览器</strong> 打开体验最佳，微信内打开不支持安装
            </template>
          </el-alert>
        </template>
      </div>

      <!-- 桌面端引导 -->
      <div v-else class="guide-steps">
        <div class="step">
          <span class="step-num">1</span>
          <div>点击浏览器地址栏右侧的 <strong>安装图标 ⊕</strong></div>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <div>点击「安装」→ 桌面出现独立的APP窗口</div>
        </div>
        <p style="text-align:center;margin-top:10px;">或直接用手机扫码体验 ↓</p>
      </div>

      <!-- 本地开发：引导使用 tunnel -->
      <el-alert
        v-if="isLocalhost && !isTunnelDetected"
        type="warning"
        :closable="false"
        show-icon
        style="margin-top: 4px;"
      >
        <template #title>
          <strong>📱 要让手机扫码打开，请使用公网模式：</strong><br/>
          在终端 <strong>Ctrl+C</strong> 停掉当前服务，然后运行：<br/>
          <code style="background:#fef3c7;padding:4px 10px;border-radius:4px;font-size:14px;display:inline-block;margin:4px 0;">
            npm run dev:public
          </code><br/>
          <span style="font-size:11px;color:#92400e;">
            这个命令会自动创建公网隧道，生成一个全世界都能访问的链接
          </span>
        </template>
      </el-alert>

      <!-- tunnel已连接 (bore - 无警告页) -->
      <el-alert
        v-if="isTunnelDetected && !installUrl.includes('loca.lt')"
        type="success"
        :closable="false"
        show-icon
        style="margin-top: 4px;"
      >
        <template #title>
          ✅ <strong>公网已连接！</strong>下方二维码手机扫码直接打开
        </template>
      </el-alert>

      <!-- tunnel已连接 (localtunnel - 需要首次验证) -->
      <el-alert
        v-if="isTunnelDetected && installUrl.includes('loca.lt')"
        type="warning"
        :closable="false"
        show-icon
        style="margin-top: 4px;"
      >
        <template #title>
          ✅ <strong>公网已连接！</strong><br/>
          ⚠️ 首次打开会提示输入IP验证（localtunnel安全机制），输入页面显示的IP即可，<strong>7天内不再提示</strong>
        </template>
      </el-alert>

      <!-- 二维码区 -->
      <div class="qr-section">
        <div class="qr-divider"><span>手机扫码立即体验</span></div>

        <!-- URL手动编辑 -->
        <div class="url-edit-row">
          <el-input
            v-model="installUrl"
            size="small"
            placeholder="输入可访问的地址"
            @change="onUrlChange"
          >
            <template #prepend>🔗</template>
          </el-input>
        </div>

        <div class="qr-box">
          <img v-if="installUrl && !installUrl.includes('null')" :src="qrCodeUrl" alt="扫码打开智游灵境" class="qr-img" />
          <div v-else class="qr-placeholder">
            <span>⚠️</span><p>URL无效<br/>请检查服务是否启动</p>
          </div>
        </div>
        <div class="qr-url-row">
          <code>{{ installUrl || '(请先启动服务)' }}</code>
          <el-button size="small" plain class="copy-link-btn" @click="copyLink">复制</el-button>
        </div>

        <!-- 排查提示 -->
        <el-collapse v-if="!isTunnelDetected" style="width:100%;margin-top:4px;">
          <el-collapse-item title="💡 一键公网访问（用于比赛演示）" name="trouble">
            <div class="troubleshoot">
              <p>在终端运行：<br/>
              <code style="font-size:13px;background:#f1f5f9;padding:4px 10px;border-radius:4px;display:inline-block;margin:4px 0;">npm run dev:public</code></p>
              <p style="color:#909399;font-size:11px;">自动生成公网链接，游客扫码即用，无需任何网络配置</p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <template #footer>
      <el-button @click="dismiss" :icon="CircleClose">暂不需要</el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.install-dialog {
  :deep(.el-dialog__header) {
    text-align: center;
    padding-bottom: 0;
    margin-right: 0;
  }
  :deep(.el-dialog__body) { padding: 16px 24px 8px; }
}

.install-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.install-hero {
  text-align: center;
  .app-icon { font-size: 48px; margin-bottom: 8px; }
  h3 { margin: 0; font-size: 18px; font-weight: 800; color: #083f63; }
  p { margin: 4px 0 0; font-size: 12px; color: #909399; }
}

.installed-msg {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  .check-icon { font-size: 36px; }
  strong { font-size: 16px; color: #16a34a; }
  p { font-size: 12px; color: #606266; margin: 0; }
}

.guide-steps {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e5e7eb;

  .step-num {
    display: grid;
    width: 26px; height: 26px;
    flex-shrink: 0;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, #38bdf8, #0284c7);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
  }

  div {
    font-size: 13px;
    color: #374151;
    line-height: 1.5;
  }
}

.icon-demo {
  display: inline-block;
  padding: 2px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
  margin-left: 4px;
}

.install-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 700;
  border-radius: 12px;
}

.qr-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  span {
    flex-shrink: 0;
    font-size: 11px;
    color: #909399;
    font-weight: 600;
  }
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e5e7eb;
  }
}

.qr-box {
  padding: 12px;
  background: #fff;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,.06);
}

.qr-img {
  display: block;
  width: 200px;
  height: 200px;
}

.qr-placeholder {
  width: 200px; height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #909399;
  span { font-size: 36px; margin-bottom: 8px; }
  p { font-size: 12px; margin: 0; line-height: 1.4; }
}

.url-edit-row {
  width: 100%;
  margin-bottom: 8px;
  :deep(.el-input__inner) { font-size: 12px; }
}

.troubleshoot {
  font-size: 12px;
  color: #606266;
  line-height: 1.8;
  p { margin: 4px 0; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
}

.qr-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 6px 10px;
    background: #f1f5f9;
    border-radius: 6px;
    font-size: 11px;
    color: #64748b;
  }

  .copy-link-btn {
    flex-shrink: 0;
  }
}

/* 手机端弹窗全屏 */
@media (max-width: 480px) {
  :deep(.el-dialog) {
    width: 94% !important;
    max-width: 400px;
    margin-top: 5vh !important;
    border-radius: 16px !important;
  }
  :deep(.el-dialog__body) { padding: 12px 14px 4px; }
  .install-hero .app-icon { font-size: 38px; }
  .install-hero h3 { font-size: 16px; }
  .qr-img { width: 160px; height: 160px; }
}
</style>
