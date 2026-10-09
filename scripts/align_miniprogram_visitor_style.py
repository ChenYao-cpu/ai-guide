"""Align mini-program interiors with the visitor web UI; leave authorization animation separate."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / 'miniprogram/pages'
for file in root.rglob('*.vue'):
    if file.parent.name == 'auth':
        continue
    source = file.read_text(encoding='utf-8-sig')
    def update_style(match):
        style = match.group(0)
        style = re.sub(r'rgba\(248,\s*241,\s*229,\s*[.\d]+\)', '#f2f5fa', style)
        style = re.sub(r'rgba\(139,\s*115,\s*85,', 'rgba(89,100,123,', style)
        style = re.sub(r'rgba\(60,\s*36,\s*21,', 'rgba(23,32,51,', style)
        style = style.replace('#10131c', '#172033').replace('#747d91', '#7b8599')
        style = style.replace('#C4A882', '#8791a6').replace('#E8D5C0', '#edf4f8')
        style = style.replace('font-weight:900', 'font-weight:600').replace('font-weight:800', 'font-weight:600')
        style = style.replace('letter-spacing:8rpx', 'letter-spacing:0')
        style = style.replace('font-size:44rpx;font-weight:600', 'font-size:34rpx;font-weight:600')
        return style
    source = re.sub(r'<style\b[^>]*>[\s\S]*?</style>', update_style, source)
    file.write_text(source, encoding='utf-8')
