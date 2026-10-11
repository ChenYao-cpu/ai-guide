# 本地小程序预览

源码位于 `miniprogram`，原生微信小程序运行目录为
`miniprogram/unpackage/dist/dev/mp-weixin`。

在仓库根目录运行：

```powershell
.\scripts\build_miniprogram.ps1 -HBuilderPath 'E:\HBuilderX'
```

在微信开发者工具中打开上述运行目录，点击编译。当前本地预览使用开发工具测试号；重新编译会保留测试号，源码的正式 AppID 不变。

后端地址为 `http://127.0.0.1:8000`，Web 地址为 `http://localhost:5173`。模拟器使用现有后端开发测试登录，需要后端启动时设置 `ALLOW_DEV_LOGIN=true`。项目原有 `work_dirs/start-main-runtime.ps1 -DevelopmentLogin` 可启动本机开发服务。

构建脚本明确使用 `--mode development`；只有开发模式的 `devtools` 模拟器会使用开发测试登录。正式构建使用 `--mode production`，真机始终走微信授权登录，需要配置正式的微信 AppID、AppSecret 和合法域名。

9 个原生页面、底部导航、导览抽屉和确认弹窗共用 Nocturne Glass 主题。AI 小导游的语音播放通过带登录校验的 `/api/v1/tts/edge` 使用项目已有的 Edge TTS，无需平台密钥，需要联网。语音识别和星云数字人仍取决于对应后端服务及平台配置；本地预览不会伪造这些服务的结果。
