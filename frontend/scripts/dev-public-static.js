/**
 * 一键公网启动器 — 比赛演示专用
 *
 *    npm run dev:public:static
 *
 * 特点：
 *   - 使用 vite preview（有API代理 + 无HMR黑屏）
 *   - 优先 bore（无验证页）→ 备选 localtunnel
 *   - 自动写入 tunnel-url.txt 供 PWA 弹窗读取
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const publicUrlFile = path.join(distDir, 'tunnel-url.txt')

console.log(`
╔══════════════════════════════════════════════╗
║   🏔️  景区导览 - 比赛演示启动器              ║
╚══════════════════════════════════════════════╝
`)

if (!fs.existsSync(distDir)) {
  console.log('❌ dist 目录不存在，请先运行: npm run build-only')
  process.exit(1)
}

// 清除旧文件
try { fs.unlinkSync(publicUrlFile) } catch {}

// 1. 启动 vite preview（有API代理，无HMR）
console.log('[1/2] 启动 vite preview (含API代理)...')
const server = spawn('npx', ['vite', 'preview', '--host', '0.0.0.0', '--port', '5173'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
})

let tunnelUrl = ''
let tunnelDone = false

// 备用：直接用 localtunnel
function startLocaltunnel() {
  if (tunnelDone) return
  console.log('  尝试 localtunnel...')
  const lt = spawn('npx', ['localtunnel', '--port', '5173'], {
    cwd: rootDir, stdio: ['inherit', 'pipe', 'pipe'], shell: true,
  })
  let out = ''
  lt.stdout.on('data', d => out += d.toString())
  lt.stderr.on('data', d => out += d.toString())
  const ival = setInterval(() => {
    if (tunnelUrl) { clearInterval(ival); return }
    const m = out.match(/https?:\/\/[^\s]+\.loca\.lt/)
    if (m) {
      tunnelUrl = m[0].trim()
      onTunnelReady(tunnelUrl, '(首次需IP验证)')
      clearInterval(ival)
    }
  }, 1000)
  setTimeout(() => { clearInterval(ival); if (!tunnelUrl) console.log('localtunnel 超时') }, 25000)
}

function onTunnelReady(url, note = '') {
  if (tunnelDone) return
  tunnelDone = true
  const visitorUrl = url + '/visitor/home'
  try { fs.mkdirSync(path.dirname(publicUrlFile), { recursive: true }) } catch {}
  try { fs.writeFileSync(publicUrlFile, visitorUrl) } catch {}

  console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   ✅ 公网就绪！${note.padEnd(32)}║
║                                              ║
║   🌐 ${visitorUrl}
║                                              ║
║   📱 手机浏览器打开上面的链接即可             ║
║   📋 电脑打开 localhost:5173 可看到二维码    ║
║                                              ║
║   ⌨️  Ctrl+C 停止                             ║
║                                              ║
╚══════════════════════════════════════════════╝
`)
}

// 2. 尝试 bore（无验证页，最优）
setTimeout(() => {
  console.log('\n[2/2] 创建公网隧道（优先 bore）...')
  const bore = spawn('npx', ['bore', 'local', '5173', '--to', 'bore.pub'], {
    cwd: rootDir, stdio: ['inherit', 'pipe', 'pipe'], shell: true,
  })
  let out = ''
  bore.stdout.on('data', d => out += d.toString())
  bore.stderr.on('data', d => out += d.toString())
  const ival = setInterval(() => {
    if (tunnelUrl) { clearInterval(ival); return }
    // bore.pub 输出: "listening at bore.pub:XXXXX"
    const m = out.match(/bore\.pub[:\d]+/)
    if (m) {
      const part = m[0]
      const port = part.includes(':') ? part.split(':')[1] : ''
      tunnelUrl = port ? `http://bore.pub:${port}` : `http://${part}`
      onTunnelReady(tunnelUrl, '(免验证，直接打开)')
      clearInterval(ival)
    }
  }, 1000)
  // 15秒没反应就换 localtunnel
  setTimeout(() => {
    clearInterval(ival)
    if (!tunnelUrl) {
      console.log('  bore 连接失败，换 localtunnel...')
      startLocaltunnel()
    }
  }, 15000)
}, 3000)

process.on('SIGINT', () => {
  console.log('\n🛑 停止中...')
  server.kill()
  try { fs.unlinkSync(publicUrlFile) } catch {}
  process.exit(0)
})
