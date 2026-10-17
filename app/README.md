# 智游灵境 App

此目录是 Android App 的 uni-app 源码，在 HBuilderX 中打开本目录。
与同一仓库下的 `frontend/`（Web）、`server/`（后端）、`shared/`（共享坐标转换）配套使用。

开发运行：
1. 在仓库根目录启动原 Windows PostgreSQL 数据库和 `start_backend.ps1`，后端端口为 18000。不要同时启动占用相同端口的 Docker 空数据库。
2. 在 HBuilderX 中导入本目录，运行到 Android 手机。真机使用 `common/config.js` 中的局域网地址，手机需能访问该电脑地址；电脑网络变化后运行 `scripts/configure_app.ps1` 更新并重新编译。HBuilderX 重跑会清理自定义 USB 转发，因此真机不固定使用 `127.0.0.1:18000`。
3. 正式构建前将 `common/config.js` 的 `LAN_SERVER_ORIGIN` 设置为真实部署地址；局域网调试可运行仓库的 `scripts/configure_app.ps1` 更新。

App 通过真实后端登录和获取景点；数字人、语音及邮箱注册依赖后端对应配置。`unpackage/` 是本目录生成的构建产物，不提交。
