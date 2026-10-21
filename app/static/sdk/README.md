# App 数字人 SDK

基于官方 `@xmov/avatar` 2.4.1（官方在线 `xmovAvatar@latest.js` 本次下载内容相同）。

- 上游文件 SHA-256：`a550c7c0555fd488e329471f144cc2a303557029c553c0cbabf5ecc33eff0c1c`
- 本文件 SHA-256：`6a82d4311c8f3d7403b914a8daa8db16ae85f567ba3a2754c30cfc01c8b182fd`

仅修改两处 Android 解码策略：不再强制声明支持软件解码；解码器遵循调用方的 `hardwareAcceleration` 设置。实际视频帧解码失败仍作为失败返回，保留安全上下文、WebGL、音频等环境检查。

资源随 App 打包；导览和聊天语音共享同一次加载，网络下载或资源加载失败后允许重试。服务凭据仍只由现有后端处理。

验证：`node --test app/tests/xingyun-sdk.test.cjs`。测试使用模拟解码结果，不等同于真机验证。
