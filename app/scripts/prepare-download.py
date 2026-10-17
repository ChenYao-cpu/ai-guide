"""Create an App-only LAN download page and QR from a verified signed APK."""
import argparse
import hashlib
from html import escape
import json
from pathlib import Path
from urllib.parse import urlparse

import qrcode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--origin', required=True)
    args = parser.parse_args()
    origin = args.origin.rstrip('/')
    parsed = urlparse(origin)
    assert parsed.scheme in ('http', 'https') and parsed.hostname and parsed.path in ('', '/')
    directory = args.directory.resolve()
    record = json.loads((directory / 'verification.json').read_text(encoding='utf8'))
    filename = 'zhiyou-' + record['version'] + '.apk'
    apk = directory / filename
    with apk.open('rb') as handle:
        assert hashlib.file_digest(handle, 'sha256').hexdigest() == record['sha256']
    assert record['signature_verified'] and record['app_resources_verified']
    version = escape(record['version'])
    page = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>智游灵境 App 下载</title>
<style>body{margin:0;padding:24px 16px;background:#f5f3ff;color:#253044;font:16px/1.8 system-ui,sans-serif}main{max-width:460px;margin:12px auto;padding:28px;background:white;border-radius:22px}h1{margin:0;font-size:26px}small{color:#64748b}a{display:block;margin:24px 0;padding:14px;background:#5145db;color:white;text-align:center;text-decoration:none;border-radius:12px;font-weight:600}img{display:block;width:210px;max-width:100%;margin:24px auto}code{font-size:12px;overflow-wrap:anywhere}</style></head><body><main>
<h1>智游灵境 · App ''' + version + '''</h1><small>Android · ''' + f"{record['apk_bytes']/1024/1024:.1f}" + ''' MB · XC 分支</small>
<a href="./''' + filename + '''" download>下载 Android 安装包</a>
<p>全 App 界面中英文切换、邮箱验证码注册，以及路线预览和规划衔接修复。</p>
<p>沿用原包名和签名，可尝试直接覆盖安装。手机与电脑连接同一个 Wi-Fi，下载及使用时保持电脑服务运行。</p>
<p>邮箱真实收信依赖服务器 SMTP 配置；此安装包尚未完成 Android 真机验证。</p>
<img src="./download-qr.png" alt="扫码打开本下载页"><small>源码提交：''' + escape(record['source_commit'][:7]) + '''<br>安装包 SHA-256：</small><code>''' + record['sha256'] + '''</code>
</main></body></html>'''
    (directory / 'index.html').write_text(page, encoding='utf8')
    qrcode.make(origin + '/').save(directory / 'download-qr.png')
    published = dict(record, download_page=origin + '/', download_url=origin + '/' + filename,
                     qr_code=str(directory / 'download-qr.png'), phone_download_verified=False)
    (directory / 'download.json').write_text(json.dumps(published, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'download_page': published['download_page'], 'download_url': published['download_url']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
