# 多数字人星云接入与管理

## 管理员怎么操作

1. 每个人物在星云平台创建一个应用，选好人物、背景、音色并保存，点击「接入SDK」取得该应用的 App ID 和 App Secret。
2. 登录本项目管理后台，进入「数字导游管理」，点击「新增数字导游」，填写姓名、介绍，上传对应人物的全身预览图和头像。先保持下架并保存。
3. 在新导游卡片点击「绑定星云应用」，填写对应 App ID、App Secret，以及可选的音色名称；开启「使用星云驱动」并保存绑定。
4. 点击「上架」。游客网页、手机网页和小程序的数字人选择列表都读取同一数据库，显示已上架的人物。
5. 第二、第三个人物重复以上步骤。每个导游绑定自己的应用；网页和小程序可共用这个绑定。
6. 管理员可以编辑导游资料、修改应用绑定、下架或删除导游。修改 App ID 时必须同时填写新密钥；仅编辑音色名称时，密钥留空表示沿用。
7. 移除绑定会清除本项目的应用凭据并下架人物；不会删除星云平台上的应用。

人物、背景、实际音色在星云平台配置。本项目保存的音色名称是供游客识别的标签，不会更改星云平台音色。

## 游客怎么使用

游客从数字人卡片选择导游，再选择景点与偏好开始导览。导览会话保存所选 guide_id，并获得只允许这次导览连接该人物的短期凭证。网页数字人区域点击「连接星云数字人」，连接就绪后，真实问答接口的回复交给该应用播报。

- 网页默认保留全身画面。星云应用本身应设置为全身完整入镜。
- 小程序在原生导览页点击「打开所选数字人的半身导览」，通过 WebView 打开同一导览会话，人物画面放大裁切为半身；背景、音色沿用同一应用。
- 小程序 WebView 是完整页面，包含数字人、景点和问答，不是嵌在原生页面中的一块 canvas。
- 下架或删除后，新游客不能选中该人物，也不能新建其星云连接。已建立的云端连接可由原客户端断开，不会强行替换成其他人物。

## 小程序部署配置

在项目根目录 .env 设置 XINGYUN_WEB_ORIGIN=https://你的网页导览域名，重启后端。网页站点必须提供 /m/tour/:sessionId 页面，并将 /xingyun、/tour-session 等 API 代理到后端；Vite 开发/预览配置已包含星云代理。

在微信公众平台配置相应的 WebView 业务域名、请求域名，并根据账号权限和域名校验要求完成配置。未配置 HTTPS 网页地址时，后端明确返回待配置提示。不要用 localhost 或局域网 HTTP 地址作为正式业务域名。

小程序传递的是本次导览的短期凭证，通过 URL fragment 传到网页后存入 sessionStorage 并清除地址栏 fragment；不传递管理员 JWT 或星云 App Secret。

## 数据与权限

- digital_guide_info.is_enabled：上架状态。
- xingyunguidebinding：每位导游独立的 App ID、加密的 App Secret、音色显示名称。
- xingyunsession：真实云端资源分配结果、所选导游/导览、关闭状态和创建时凭据快照。快照用于应用换密钥或下架后释放原会话。
- 密钥使用 Fernet 加密，密钥材料由 TOKEN_JWT_SECURITY_KEY 派生。需保留该配置；更换后应重新保存星云绑定。
- 管理接口仅允许 ADMIN_USERNAME 对应的有效管理员账号，并检查导游归属。普通游客不能新增、编辑、上下架或读取应用凭据。
- 游客列表、配置查询和会话详情不返回 App Secret 或密文；管理员读取配置也只得到是否保存密钥的标记。
- 旧的全局 XINGYUN_APP_ID/XINGYUN_APP_SECRET 不再用于运行时选择人物，避免所有人物连接同一应用。
- “已绑定”表示配置已保存；是否连接/播报以真实 SDK 回调为准。

## 验证

- npm run build（在 frontend 目录）：前端类型检查与生产构建。
- python scripts/verify_xingyun.py：Python/JavaScript POST、DELETE 签名一致性。
- python scripts/verify_xingyun_management.py：隔离 SQL 数据库中的管理权限、CRUD、上下架、密钥加密和隐藏、游客选择、不同人物凭据路由及旧会话释放。测试中模拟云端响应，不连接收费服务，不向生产库写入测试人物。
- ./scripts/build_miniprogram.ps1：通过已安装的 HBuilderX 编译微信小程序。

后端启动时自动建表和迁移现有表。真实 PostgreSQL 必须已启动。没有自己的有效星云应用凭据和可用域名时，不能验证实际形象、口型、云端播报和小程序真机 WebView。

## 官方参考

- GitHub：https://github.com/publicize0828/XmovLiteAvatarJSDemo
- Gitee：https://gitee.com/xmovmaster/XmovLiteAvatarJSDemo
- 官方接入文档：https://xingyun3d.com/developers/52-187
- SDK API：https://www.xingyun3d.com/developers/52-183