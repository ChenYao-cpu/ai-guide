# 本机颐和园资源包

适用于下载本仓库后缺少景点图片、路线封面、数字人封面与头像的情况。

1. 下载仓库中的 [resources/local-resources.zip](../resources/local-resources.zip)，解压到项目的 `resources` 目录，得到 `resources/local-resources/resources.json`。
2. 按项目 README 安装后端依赖、配置自己的 `.env`，启动 PostgreSQL 和后端一次，初始化数据表和管理员。
3. 在项目根目录执行：

   ```powershell
   python scripts/import_resource_pack.py resources/local-resources
   ```

4. 重启后端并刷新网页。小程序也需配置为连接同一个后端，才能读取导入的图片。
5. 管理员在数字人管理页面填写自己的 App ID 和 App Secret，绑定应用后再上架。

2026-10-15 本机快照包含 16 个颐和园景点、3 条路线、2 个未删除的数字人配置（小颐、文轩）、21 份知识文档、10 条路线景点关联及其引用素材。附带小颐的本地原生 3D 模型与依赖文件；Live2D 文件沿用源码中的 `frontend/public/live2d`。

不包含账号、密码、用户 ID、应用绑定、平台密钥、游客记录、数据库备份或语音/大模型权重。所有数字人导入后默认下架；星云角色需绑定接收方自己的应用。知识文档标记为待处理，实际知识索引需重新构建。

导入时会校验所有资源文件的 SHA-256。已有同名记录会保留，关联关系会映射到当前数据库的新 ID；已有且内容不同的文件会拒绝覆盖。重复导入不会重复创建同名记录。

要完整复现这份快照，请使用空数据库。向已有数据库导入属于补充操作，不会清除旧景点、旧路线，也不会覆盖已有同名记录。

导出自己的公开资源包：

```powershell
python scripts/export_resource_pack.py work_dirs/local-resources --zip resources/local-resources.zip
```

导出目录和压缩包必须尚不存在。工具使用明确的公开字段清单，只读取未删除资料和有效路线关联，导出时将本机素材地址转成可迁移路径，并检查已知密钥值、素材完整性及压缩包 CRC。

原 `resources/summer-palace` 的 48 景点资源目录已被这份本机压缩包替换；旧版仍可从提交 `d4f23ac` 的 Git 历史恢复。本次删除的是当前分支文件，不改写 Git 历史。
