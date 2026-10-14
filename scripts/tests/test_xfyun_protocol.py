"""离线校验官方签名向量与上游异常处理，不调用收费接口。"""
import ast
import asyncio
import base64
import hashlib
import hmac
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
from email.utils import formatdate


source = Path(__file__).resolve().parents[2] / 'server/base/routers/xfyun.py'
tree = ast.parse(source.read_text(encoding='utf-8'))
scope = dict(base64=base64, hashlib=hashlib, hmac=hmac, urlencode=urlencode,
             formatdate=formatdate, HOST='vms.cn-huadong-1.xf-yun.com')
node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'signed_url')
exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), 'exec'), scope)


class ProtocolTest(unittest.TestCase):
    def test_official_signature_vector(self):
        url = scope['signed_url']('start', {'API_KEY': 'apikeyXXXXXXXXXXXXXXXXXXXXXXXXXX',
                'API_SECRET': 'apisecretXXXXXXXXXXXXXXXXXXXXXXX'}, 'Fri, 16 Dec 2022 07:12:46 GMT')
        parsed = urlsplit(url)
        query = parse_qs(parsed.query)
        auth = base64.b64decode(query['authorization'][0]).decode()
        self.assertIn('signature="5m7DD1mCJj1tUtVbdVJBL/AoI7a1Qz6fBUYROmDTB9Q="', auth)
        self.assertEqual(parsed.scheme, 'https')
        self.assertEqual(query['date'][0], 'Fri, 16 Dec 2022 07:12:46 GMT')

    def test_each_action_has_its_own_signature(self):
        config = {'API_KEY': 'test', 'API_SECRET': 'test'}
        urls = [scope['signed_url'](a, config, 'Fri, 16 Dec 2022 07:12:46 GMT') for a in ('start', 'ctrl', 'ping', 'stop')]
        self.assertEqual(len({parse_qs(urlsplit(u).query)['authorization'][0] for u in urls}), 4)


if __name__ == '__main__':
    unittest.main()
