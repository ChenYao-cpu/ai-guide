# 景点与推荐路线图片包

`scenic-images.zip` 按当前真实公开接口引用打包，包含 16 张景点图、3 张推荐路线封面，共 19 张图片。18 个景点中的「故宫博物院」「长城(八达岭)」没有配置图片，未补造或用其他图片替代。对应关系及 SHA-256 见 `scenic-images-manifest.json`。

拉取仓库后，在项目根目录执行：

```powershell
Expand-Archive -LiteralPath resources/scenic-images.zip -DestinationPath . -Force
```

解压后会恢复 `static/tour_files/spot_images/enhanced/` 和 `static/tour_files/route_covers/` 下的原始路径。刷新连接此后端的网页即可读取这些文件。

这是图片包，不会导入或覆盖数据库。接收方仍需先按主 README 初始化数据库、导入景点和路线资料，且数据库中的图片引用须与本清单路径对应。若接收方保留的是旧版数据库或旧资源包的图片引用，仅解压图片不保证页面自动切换到这些照片。

发布到 `cy` 时一并提交 `scenic-images.zip`、`scenic-images-manifest.json`、`scenic-images.sha256` 和本说明，以及根目录 `.gitignore` 的压缩包白名单修改；不要提交 `.env`。包中没有平台凭据、账号密码或游客数据。
