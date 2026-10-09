"""一次性迁移原有页面配色和本地 API 地址，保留业务逻辑。"""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / 'miniprogram'
palette = {
    '#F8F1E5': '#f6f7fa', '#FFFBF5': '#ffffff', '#3C2415': '#10131c',
    '#5C3D2E': '#3f4657', '#8B7355': '#747d91', '#A0896E': '#a1a8b8',
    '#B52B25': '#3b5bff', '#CD3B30': '#617bff', '#EFC56A': '#e5eaff',
    '#9BC7B7': '#dce0e9', '#fdf6ee': '#f3f5ff', '#f8e8d5': '#e5eaff',
    '#f0dcc8': '#dfe3ff', '#e8e0d5': '#f3f5ff',
}
for file in list((root / 'pages').rglob('*.vue')) + list((root / 'components').glob('*.vue')):
    source = file.read_text(encoding='utf-8')
    if 'common/config.js' not in source and ('127.0.0.1' in source or "replace('localhost'" in source):
        prefix = '../../common/config.js' if file.parent.parent.name == 'pages' else '../common/config.js'
        if file.parent.name == 'mine':
            prefix = '../../common/config.js'
        source = source.replace('<script>', "<script>\nimport { BASE_URL, assetUrl } from '" + prefix + "'", 1)
    source = re.sub(r"var BASE_URL\s*=\s*'http://127\.0\.0\.1:8000/api/v1'", '', source)
    source = source.replace("'http://127.0.0.1:8000/api/v1/user/wx-login'", "BASE_URL + '/user/wx-login'")
    source = re.sub(r"(\w+)\.replace\('localhost','127\.0\.0\.1'\)", r'assetUrl(\1)', source)
    source = re.sub(r'<image[^>]*class="(?:page-bg|auth-bg-img)"[^>]*></image>', '', source)
    for old, new in palette.items():
        source = re.sub(re.escape(old) + r'(?![0-9a-fA-F])', new, source, flags=re.I)
    source = re.sub(r"font-family\s*:\s*[^;}]*?(?:楷体|KaiTi|STKaiti|cursive)[^;}]*", "font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif", source)
    source = source.replace('rgba(181,43,37,', 'rgba(59,91,255,').replace('rgba(155,199,183,', 'rgba(116,125,145,').replace('rgba(239,197,106,', 'rgba(59,91,255,')
    file.write_text(source, encoding='utf-8')
for folder in ('api', 'common'):
    file = root / folder / ('index.js' if folder == 'api' else 'api.js')
    source = file.read_text(encoding='utf-8')
    source = source.replace("var BASE_URL = 'http://127.0.0.1:8000/api/v1'", "import { BASE_URL } from '../common/config.js'" if folder == 'api' else "import { BASE_URL } from './config.js'")
    file.write_text(source, encoding='utf-8')
file = root / 'pages.json'
source = file.read_text(encoding='utf-8').replace('#F8F1E5', '#f6f7fa')
file.write_text(source, encoding='utf-8')
