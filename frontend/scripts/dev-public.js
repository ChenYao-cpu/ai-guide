/**
 * 一键启动公网可访问的游客端
 *
 *    npm run dev:public
 *
 * 自动完成：
 *   1. 启动 Vite 前端开发服务器（端口 5173）
 *   2. 启动 bore 公网隧道（无需安装，自动下载，无警告页）
 *   3. 将公网URL写入文件供前端读取
 *   4. 终端打印可扫码的链接
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const publicUrlFile = path.join(rootDir, 'public', 'tunnel-url.txt')

console.log(`
╔══════════════════════════════════════════════╗
║      🏔️  景区导览 - 游客端公网启动器         ║
╚══════════════════════════════════════════════╝
`)

// 确保URL文件一开始不存在
try { fs.unlinkSync(publicUrlFile) } catch {}

// 1. 启动 Vite
console.log('[1/2] 启动 Vite 开发服务器...')
const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
})

let tunnelUrl = ''
let tunnelStarted = false

function startTunnel(tunnelCmd) {
  if (tunnelStarted) return
  tunnelStarted = true

  const [cmd, ...args] = tunnelCmd
  const proc = spawn(cmd, args, {
    cwd: rootDir,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  })

  let output = ''
  proc.stdout.on('data', (data) => { output += data.toString() })
  proc.stderr.on('data', (data) => { output += data.toString() })

  const checkOutput = setInterval(() => {
    if (tunnelUrl) { clearInterval(checkOutput); return }

    // bore 输出格式: "listening at bore.pub:12345" → https://bore.pub:12345
    // 或直接输出 URL
    const boreMatch = output.match(/bore\.pub[:\d]*/) ||
                     output.match(/https?:\/\/[^\s]*bore[^\s]*/i)
    const urlMatch = output.match(/https?:\/\/[^\s]+/)

    if (boreMatch) {
      const port = boreMatch[0].split(':')[1] || ''
      tunnelUrl = port ? `https://bore.pub:${port}` : `https://${boreMatch[0]}`
    } else if (urlMatch && !urlMatch[0].includes('localhost') && !urlMatch[0].includes('127.0.0.1')) {
      tunnelUrl = urlMatch[0].replace(/[),;]$/, '')
    }

    if (tunnelUrl) {
      const visitorUrl = tunnelUrl + '/visitor/home'
      try {
        fs.mkdirSync(path.dirname(publicUrlFile), { recursive: true })
        fs.writeFileSync(publicUrlFile, visitorUrl)
      } catch {}

      console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   ✅ 公网链接已就绪！                         ║
║                                              ║
║   🌐 游客端地址：                             ║
║   ${visitorUrl}
║                                              ║
║   📱 手机扫码或输入上面的链接即可打开         ║
║                                              ║
║   ⌨️  Ctrl+C 停止所有服务                     ║
║                                              ║
╚══════════════════════════════════════════════╝
`)
    }
  }, 1000)

  // 30秒超时 → 尝试备选隧道
  setTimeout(() => {
    clearInterval(checkOutput)
    if (!tunnelUrl) {
      console.log('   bore 连接失败，尝试备选方案 localtunnel...')
      startFallbackTunnel()
    }
  }, 30000)

  proc.on('close', () => {
    clearInterval(checkOutput)
    if (!tunnelUrl) {
      console.log('  隧道进程退出，尝试备选方案...')
      startFallbackTunnel()
    }
  })
}

function startFallbackTunnel() {
  console.log('\n[2/2] 创建公网隧道 (localtunnel 备选)...')
  const lt = spawn('npx', ['localtunnel', '--port', '5173'], {
    cwd: rootDir,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  })

  let output = ''
  lt.stdout.on('data', (d) => { output += d.toString() })
  lt.stderr.on('data', (d) => { output += d.toString() })

  setTimeout(() => {
    const match = output.match(/https?:\/\/[^\s]+\.loca\.lt/)
    if (match && !tunnelUrl) {
      tunnelUrl = match[0].trim()
      const visitorUrl = tunnelUrl + '/visitor/home'
      try {
        fs.writeFileSync(publicUrlFile, visitorUrl)
      } catch {}

      console.log(`
╔══════════════════════════════════════════════╗
║   ✅ 公网链接已就绪（localtunnel）            ║
║   🌐 ${visitorUrl}
║   ⚠️  首次打开需输入IP验证，之后不再提示     ║
╚══════════════════════════════════════════════╝
`)
    }
  }, 15000)
}

// Vite启动后，尝试bore（优先，无警告页）→ localtunnel（备选）
setTimeout(() => {
  console.log('\n[2/2] 创建公网隧道...')
  // 优先尝试 bore（无警告页面）
  startTunnel(['npx', 'bore', 'local', '5173', '--to', 'bore.pub'])
}, 3000)

// Ctrl+C 清理
process.on('SIGINT', () => {
  console.log('\n🛑 正在停止所有服务...')
  vite.kill()
  try { fs.unlinkSync(publicUrlFile) } catch {}
  process.exit(0)
})
