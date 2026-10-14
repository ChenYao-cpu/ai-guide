# 微信小程序讯飞数字人

仅微信小程序导览页增加讯飞入口，现有网页和 App 的数字人配置继续沿用。

## 配置

在后端 `.env` 配置 `XFYUN_AVATAR_APP_ID`、`XFYUN_AVATAR_API_KEY`、`XFYUN_AVATAR_API_SECRET`、`XFYUN_AVATAR_AVATAR_ID`、`XFYUN_AVATAR_VCN`。必须使用已开通「AI虚拟人技术」的应用及其可用形象和音色。重启后端自动创建 `xfyunsession` 表。

该版本小程序使用一组独立的讯飞形象与音色配置，不与网页星云形象自动对应。密钥不得写入小程序代码或版本库。未填写时连接接口返回“待配置”。

微信账号需具有原生 `live-player` 使用权限，配置后端 HTTPS 请求域名及讯飞返回的实际拉流域名。模拟器无法代替真机播放验证。

## 使用与链路

进入导览页，点击“连接讯飞数字人”。后端验证导览权限、向讯飞申请 RTMP 会话并保存真实会话记录；小程序使用 `live-player` 拉流。只有收到播放器 2004 回调才显示视频流播放中。

连接后发送问题，继续使用现有景区问答接口，真实回答发送到讯飞文本驱动接口。每 20 秒发送一次心跳；离开页面或进入后台会停止心跳并请求关闭云端会话。关闭请求失败时提示错误，讯飞服务会在心跳超时后释放会话。返回前台需手动重新连接。

接口：`GET /miniprogram/xfyun/config`、`POST /miniprogram/xfyun/sessions/{tour_id}`、`POST /miniprogram/xfyun/sessions/{id}/command`。command 支持 speak、ping、stop；所有会话操作检查导览凭证或所属用户。客户端不能提交上游地址、形象 ID 或应用密钥。

## 验证范围

真实形象、声音、口型与真机播放需要有效讯飞凭据和微信权限后联调。代码通过编译或隔离测试不代表云端接入验证成功。

官方协议：https://www.xfyun.cn/doc/tts/virtual_human/API.html
