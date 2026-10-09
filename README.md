# 景区导览AI数字人 —— 运行指南

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

后端正运行的情况下，另开终端：

```powershell
conda activate tourist
python scripts/import_scenic_spots.py
```

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


## 微信登录与个性化数字人

小程序默认使用正式微信登录（`DEVELOPMENT_LOGIN=false`）。后端 `.env` 中的 `WX_APPID` 必须与小程序 `manifest.json` 一致，`WX_SECRET` 仅配置在后端。上线时将 `ALLOW_DEV_LOGIN=false`，并在微信后台配置 HTTPS request/uploadFile 合法域名及头像昵称相关隐私声明。

用户主动选择微信头像、填写昵称后，调用微信登录换取 code，由后端向微信校验身份，创建数据库用户并签发 JWT，再上传头像并保存昵称。不能通过前端传入 openid 登录。

智能导览的“个性化 → 数字人形象”使用数据库导游列表，并从 `/avatar/capabilities/{guide_id}` 获取真实渲染能力和卡通预览。可预览数据库中配置的基础视频；选中的 guide_id 传入创建导览会话接口。缺少素材或渲染环境时显示实际原因。

首次登录资料保存后，小程序下次启动会调用 `/user/me` 验证已有登录态。JWT 失效时通过微信静默登录换取新令牌，已保存的资料直接复用。网络错误不会清除登录态；用户主动退出后停止自动登录。登录分支回归检查：`node scripts/test_login_session.cjs`（隔离测试，不代表微信真机联调）。


当前四个角色使用已有海报生成的静态基础素材（`static/digital_guide/sources/*-portrait.mp4`），MuseTalk 根据本轮讲解音频生成口型。此方案不包含自然全身动作；要实现动作需上传真人动作视频。素材路径已保存于数据库，原配置备份在 `work_dirs/guide-source-before-20261006.json`。启动后端外，还需运行 `powershell -ExecutionPolicy Bypass -File scripts/start_avatar_worker.ps1`；未启动时能力接口会返回真实未就绪原因。


## 海报生成全身动作（阿里云百炼）

在后端 `.env` 设置 `DASHSCOPE_API_KEY`（北京地域百炼密钥）并重启后端，默认 API 为 `https://dashscope.aliyuncs.com/api/v1`。业务空间专属域名可通过 `MOTION_API_BASE` 设置，密钥和 endpoint 须属于同一地域。密钥不要填入小程序或发到聊天。

管理端导游卡片 → 数字人接入状态 → 海报生成全身动作：编辑动作描述，点击生成（收费），查看真实任务状态，预览生成结果，再点击使用动作视频。当前接口使用 `wan2.2-i2v-plus`、1080P、模型固定5秒无声视频；保留AI生成水印。服务将收到所选角色海报。

任务保存在 `avatar_motion_job` 表中，刷新页面会恢复原任务。网络查询失败只重查原任务，不重新付费提交；提交超时会显示结果不确定并阻止重复提交，请在百炼控制台核对。生成结果转存到本地并检查实际解码和画面变化；这些检查不保证动作自然，必须预览判断人脸、手指、服装和首尾衔接。

应用素材后保存到 `digital_guide_info.base_mp4_path/base_video_metadata`，小程序待命循环播放，讲解时通过 MuseTalk 在该动作视频上合成本轮口型。更换海报或基础素材后，旧生成任务不能覆盖新配置。

## 魔珐星云数字人

桌面和手机网页端已增加星云 SDK 接入。管理员可为每位导游独立绑定星云应用、上架或下架，游客按所选人物连接。小程序半身导览还需配置 XINGYUN_WEB_ORIGIN 和微信业务域名。详细步骤见 [接入说明](docs/xingyun-integration.md)。缺少应用凭据时不会显示为已连接。
签名验证：python scripts/verify_xingyun.py。
