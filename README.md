# 景区 AI 数字人导览 —— 运行指南

## 统一源码目录

Android App 源码为本仓库 `app/`（在 HBuilderX 中打开该目录），Web 为 `frontend/`，后端为 `server/`，共享代码为 `shared/`。App 启动说明见 [app/README.md](app/README.md)。手机上已经安装的旧开发包需要从新目录重新运行，才会切换到本仓库源码。

保留游客网页导览、手机网页、管理后台及 Capacitor App。微信小程序已移除。景点和路线由数据库接口提供。

## 环境要求

| 软件 | 版本 | 用途 |
|------|------|------|
| Python | 3.10 | 后端 |
| Node.js | 18+ | 前端 |
| Docker Desktop | 最新版 | 数据库 |
| Anaconda/Miniconda | 最新版 | Python 虚拟环境 |

## 一、启动数据库（Docker）

```powershell
docker compose up -d database
```

验证：
```powershell
docker ps
# 应该看到 streamer-sales-database 状态为 Up
```

**注意**：如果 `docker compose up -d` 启动了两个容器（database + base-server），先停掉 base-server：
```powershell
docker compose stop base
```

## 二、创建 Python 环境

```powershell
conda create -n tourist python=3.10 -y
conda activate tourist

pip install setuptools==69.5.1 psycopg-binary faiss-cpu -i https://pypi.tuna.tsinghua.edu.cn/simple

pip install lmdeploy modelscope opencv-python BCEmbedding langchain langchain-community loguru python-dotenv python-docx openpyxl lagent jionlp griffe class-registry fastapi uvicorn openai edge-tts PyJWT passlib sqlmodel pyyaml httpx -i https://pypi.tuna.tsinghua.edu.cn/simple

pip install langchain-core==0.2.1 langchain==0.2.0 langchain-community==0.2.0 BCEmbedding==0.1.5 -i https://pypi.tuna.tsinghua.edu.cn/simple
```

## 三、配置并启动后端

在项目根目录，新建一个 PowerShell 窗口：

```powershell
conda activate tourist
Copy-Item .env.example .env
# 编辑 .env，填写数据库密码、LLM API Key、JWT 密钥和初始管理员密码
.\start_backend.ps1
```

看到 `Uvicorn running on http://127.0.0.1:8000` 即成功。

> **获取 DeepSeek API Key**：访问 https://platform.deepseek.com 注册，新用户送 500 万 tokens。

## 四、启动前端

另开一个 PowerShell：

```powershell
cd frontend
npm install
npm run dev
```

## 五、访问系统

| 入口 | 地址 |
|------|------|
| 管理后台 | http://localhost:5173 |
| 游客端 | 登录后点击右上角"游客导览入口" |

首次部署账号由 `.env` 中的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 指定，系统不内置通用密码。

## 六、导入景点数据

当前本机数据包是 `resources/local-resources.zip`，包含 16 个颐和园景点、3 条路线、2 个数字人展示配置和 21 份知识文档。后端已初始化数据库和管理员后，在项目根目录另开终端：

```powershell
conda activate tourist
Expand-Archive -LiteralPath resources/local-resources.zip -DestinationPath resources
python scripts/import_resource_pack.py resources/local-resources
```

数字人应用绑定、素材校验及已有数据的处理规则见 [资源包说明](docs/resource-pack.md)。资源包不含平台密钥；向已有数据库导入不会删除旧内容。

## 常见问题

### 1. 发送消息报错 500
检查 DeepSeek API Key 是否有效，网络是否正常。可以浏览器打开 https://platform.deepseek.com 确认。

### 2. 数据库连不上
确认 Docker 在运行，且 `streamer-sales-database` 容器状态为 `Up`：
```powershell
docker ps
```

### 3. 端口冲突
如果 8000 或 5173 端口被占用：
```powershell
# 查占用
netstat -ano | findstr :8000
# 关进程
taskkill /PID <进程ID> /F
```

### 4. npm install 报错
```powershell
npm cache clean --force
npm install
```

### 5. Python 依赖冲突
删除环境重建：
```powershell
conda deactivate
conda env remove -n tourist
# 然后重新执行第二步
```


## 导入颐和园数据（保留其他景区）

后端首次启动完成建表和管理员初始化后，执行：

```powershell
Expand-Archive -LiteralPath resources/local-resources.zip -DestinationPath resources -Force
python scripts/import_resource_pack.py resources/local-resources
```

资源包提供 16 个颐和园景点、3 条路线和对应素材。导入是补充操作，保留已有其他景区与路线，不执行景区清理。

本机数据库修改不会随 Git 上传；其他部署者需要执行上述导入命令。不要提交 `.env` 或私有数据库备份。

## 网页与 App

管理后台入口 `/`，游客网页入口 `/visitor/home`，手机网页入口 `/m/home`。App 继续使用 `frontend/capacitor.config.ts` 和 `cap:*` 构建命令；打包前将其中开发服务器地址改为实际部署地址。当前未生成或验证安装包。

数字人配置导入后默认下架；管理员绑定真实应用或配置素材后再上架。缺少素材、密钥或工作进程时会显示实际未就绪状态。

## 海报生成全身动作（阿里云百炼）

在后端 `.env` 设置 `DASHSCOPE_API_KEY`（北京地域百炼密钥）并重启后端，默认 API 为 `https://dashscope.aliyuncs.com/api/v1`。业务空间专属域名可通过 `MOTION_API_BASE` 设置，密钥和 endpoint 须属于同一地域。密钥仅配置在后端。

管理端导游卡片 → 数字人接入状态 → 海报生成全身动作：编辑动作描述，点击生成（收费），查看真实任务状态，预览生成结果，再点击使用动作视频。当前接口使用 `wan2.2-i2v-plus`、1080P、模型固定5秒无声视频；保留AI生成水印。服务将收到所选角色海报。

任务保存在 `avatar_motion_job` 表中，刷新页面会恢复原任务。网络查询失败只重查原任务，不重新付费提交；提交超时会显示结果不确定并阻止重复提交，请在百炼控制台核对。生成结果转存到本地并检查实际解码和画面变化；这些检查不保证动作自然，必须预览判断人脸、手指、服装和首尾衔接。

应用素材后保存到 `digital_guide_info.base_mp4_path/base_video_metadata`，客户端待命循环播放，讲解时通过 MuseTalk 在该动作视频上合成本轮口型。更换海报或基础素材后，旧生成任务不能覆盖新配置。

## 魔珐星云数字人

桌面和手机网页端已增加星云 SDK 接入。管理员可为每位导游独立绑定星云应用、上架或下架，游客按所选人物连接。详细步骤见 [接入说明](docs/xingyun-integration.md)。缺少应用凭据时不会显示为已连接。
签名验证：python scripts/verify_xingyun.py。
