# 智游知境 · 景区数字人服务站

当前 Web 项目只提供两个业务入口：

- 固定服务站：`/station/summer-palace-east`，提供实时数字人咨询、景点介绍、游园须知、固定起点路线规划及设施/出口查询。
- 管理员端：`/login` 登录，`/admin` 进入后台。保留服务站配置、景点档案、知识库、数字人形象、路线资料、历史会话分析和系统管理。

保留服务站生成方案后扫码带到手机的交互：领取页 `/m/receive` 与领取后的行程页 `/m/tour/:sessionId`。独立手机首页、小程序、原桌面游客首页及本机领取预览链接已移除。原商品、直播、订单模块也已移除。当前版本不提供游客 GPS 跟随或到点自动讲解。

## 本地运行

使用项目 `.venv` 和现有数据库配置启动后端：

```powershell
.venv/Scripts/python.exe -m uvicorn server.base.base_server:app --host 127.0.0.1 --port 8001
```

在 `frontend` 目录启动前端：

```powershell
$env:VITE_BASE_SERVER_URL='http://127.0.0.1:8001'
npm run dev -- --host 0.0.0.0 --port 5173
```

前端检查：`npm run build`、`npm run test:unit -- --run`。

详见 [服务站说明](docs/web-service-station.md)。

本次收拢只调整代码、功能入口与发布内容，不删除数据库中的既有业务记录、上传资料或模型资源。

手机扫码时请与电脑连接同一局域网，前端代理转发后端请求。操作系统防火墙需允许现场设备访问 5173 端口；本项目不会自动修改防火墙。
