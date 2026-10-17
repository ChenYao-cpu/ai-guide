# 智游灵境 App

本目录是 uni-app Vue 3 客户端源码，版本 1.2.0。Web 和后端只读参考，以 LZX 提交 [`2052523`](https://github.com/ChenYao-cpu/ai-guide/commit/20525236a556f1b4a6bd70a8eaab65b65f378799) 的接口和操作流程为基准。本分支的产品修改全部位于 `app/`，不需要修改 Web 源码才能编译 App。

## 功能

- 登录页和“我的”可切换中文、English；统一语言状态立即应用于全部 10 个页面及组件，并保存到本机。覆盖导航、表单、校验、弹窗、选择面板、加载状态、日期和已知景点资料；英文布局适配较长文本。
- 邮箱注册：昵称、邮箱、密码、确认密码、6 位验证码，发送倒计时、限流反馈、重复提交拦截，注册后自动登录。自动登录失败时可直接重试登录，不重复创建账号。
- 英文景点搜索和规划意图适配；AI 路线预览使用服务器时长、步行数据，跳转保留景点顺序、时间预算和节奏。

用户昵称、用户输入、历史对话和第三方生成内容保留原文。已有接口支持英文的导览对话会传递语言；测验、总结分析、图片识别等服务如果仅返回中文，App 不伪造英文结果。完整的动态内容多语言支持需要后端另行提供语言能力。

## 安装和运行

1. 安装 HBuilderX 及 uni-app Vue 3 编译插件，在 HBuilderX 中导入本目录。
2. 将 `manifest.example.json` 复制为本地 `manifest.json`，配置自己的应用标识、地图 SDK Key 等。该文件及签名密钥不提交 Git；示例中不含地图密钥。
3. 使用现有 LZX 后端。USB 开发可执行 `adb reverse tcp:18000 tcp:18000`；开发版 App 使用本机 18000 端口。正式构建通过下列参数指定手机可访问的服务器地址。
4. 如需地图、数字人、语音或邮件，服务端须已配置对应服务。App 不保存 SMTP 发信授权码。

PowerShell 编译原生 App 资源：

```powershell
cd app
./scripts/build-app.ps1 -HBuilderX 'D:\HBuilderX\HBuilderX' -ServerOrigin 'https://your-server.example'
```

地址不包含 `/api/v1`，客户端自动添加。也可设置 `VITE_APP_SERVER_ORIGIN`。未指定时保留原项目局域网默认地址，交付到其他网络前应显式指定地址。

输出在 `unpackage/dist/build/app-plus/`，这是编译资源，**不是已签名 APK**。在 HBuilderX 中运行到手机或另行制作、签名安装包。旧 APK 不会随源码提交自动更新。

### 使用既有原生底包制作更新 APK

`scripts/package-apk.py` 支持为已有原生 SDK 配置制作资源更新包，保留原生模块和签名。需要 Python 3.11+、原 APK、本机私密签名配置及与底包一致的地图 Key。先完成上面的原生资源编译，再运行：

```powershell
python scripts/package-apk.py --hbuilder 'D:\HBuilderX\HBuilderX' --base-apk 'D:\private\base.apk' --signing-config 'D:\private\pack.private.json' --source-commit '资源源码的完整40位提交号'
```

脚本核对版本、包名、与原 APK 一致的签名证书、原生模块、地图 Key 和全部编译资源。原生 SDK、权限或版本字符串长度变化时，应使用 HBuilderX 正式打包。签名配置及密钥始终放在本机私密目录，不提交到仓库。

输出在 `unpackage/releases/<版本>/`。生成局域网下载页需要 Python 的 `qrcode` 库；下面的地址替换成电脑实际 Wi-Fi 地址：

```powershell
python scripts/prepare-download.py --directory unpackage/releases/1.2.0 --origin 'http://192.168.43.41:8088'
python scripts/serve-apk.py --directory unpackage/releases/1.2.0 --port 8088
```

下载服务只公开下载页、二维码和已校验 APK，不依赖 Web/后端下载页面，不公开签名配置和构建记录。手机需与电脑网络互通，电脑保持下载进程运行；电脑自身的下载检查不代表手机已经安装成功。

## 邮箱服务依赖

App 调用 LZX 现有的 `/user/email-code`、`/user/register`、`/user/login`、`/user/me`。`/user/auth-options` 是可选能力查询：旧服务返回 404 时仍允许尝试现有验证码接口，以实际响应为准。未配置 SMTP、发送失败或限流时显示原因，不显示虚假的发送成功。

验证码有效期遵循服务端当前规则（LZX 为 10 分钟）。客户端默认重发间隔 60 秒，优先遵循服务端 `Retry-After`。密码至少 8 个字符，UTF-8 最多 72 字节；昵称 1–40 个字符且不含 `@`；验证码保留开头的 0。

## 验证

Node.js 依赖仅用于 App 自动化测试，不依赖 Web 的 `node_modules`：

```powershell
cd app
npm ci
npm test
npm run audit:i18n
```

浏览器检查只编译 App 源码的测试副本，不修改 Web。它在被忽略的目录中启用原生账号表单，全部接口使用模拟响应：

```powershell
./tests/build-browser-preview.ps1 -HBuilderX 'D:\HBuilderX\HBuilderX'
node tests/browser-preview.cjs
```

浏览器脚本默认使用本机 Chrome，可通过 `APP_QA_CHROME` 指定浏览器可执行文件。结果及截图在 `unpackage/browser-qa/results/`。这些检查不发送真实邮件、不创建真实账号，也不代替 Android 真机测试。

本轮汇报和演示步骤见 [XC 交付说明](docs/XC-2026-10-17.md)。
