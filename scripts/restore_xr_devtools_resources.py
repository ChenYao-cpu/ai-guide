"""Restore the installed IDE's XR WASM files at its simulator-requested path.

These are development output only; production uses WeChat's built-in engine.
"""
import argparse
import json
import struct
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--asar', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
with Path(args.asar).open('rb') as stream:
    _, header_size, _, json_size = struct.unpack('<IIII', stream.read(16))
    header = json.loads(stream.read(json_size))
    entries = header['files']['js']['files']['vendor']['files']
    output = Path(args.output) / '__dev__'
    output.mkdir(parents=True, exist_ok=True)
    for name in ('ENGINE_WASM.wasm', 'draco_decoder.wasm'):
        entry = entries[name]
        stream.seek(8 + header_size + int(entry['offset']))
        resource = stream.read(entry['size'])
        if not resource.startswith(b'\x00asm'):
            raise ValueError(f'{name}: invalid WASM resource')
        (output / name).write_bytes(resource)
        print(f'Restored XR simulator resource: {name} ({len(resource)} bytes)')
