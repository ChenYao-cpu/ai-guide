"""Package the images referenced by the live public spot and route APIs."""
import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]


def main():
    records = []
    files = {}
    for kind, endpoint, name_key, image_key in (
        ('spot', 'spots', 'spot_name', 'image_path'),
        ('route', 'routes', 'name', 'cover_image'),
    ):
        with urlopen('http://127.0.0.1:18000/api/v1/tour-session/' + endpoint, timeout=15) as response:
            payload = json.load(response)
        if not payload.get('success'):
            raise ValueError('Public API failed: ' + endpoint)
        for item in payload['data']['spot_list' if kind == 'spot' else 'route_list']:
            record = dict(kind=kind, name=item[name_key], path=None)
            value = item.get(image_key)
            if value:
                path = unquote(urlsplit(value).path)
                prefix = '/api/v1/files/'
                if not path.startswith(prefix):
                    raise ValueError('Unsupported image path: ' + path)
                relative = 'static/' + path[len(prefix):]
                source = (ROOT / relative).resolve()
                if not source.is_relative_to((ROOT / 'static').resolve()) or not source.is_file():
                    raise ValueError('Missing or unsafe image: ' + relative)
                data = source.read_bytes()
                record.update(path=relative, sha256=hashlib.sha256(data).hexdigest())
                files[relative] = data
            records.append(record)
    manifest = dict(images=len(files), records=records)
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2).encode('utf-8')
    archive = ROOT / 'resources/scenic-images.zip'
    # Refuse to overwrite an existing distribution silently.
    with ZipFile(archive, 'x', ZIP_DEFLATED) as output:
        for relative, data in sorted(files.items()):
            output.writestr(relative, data)
        output.writestr('scenic-images-manifest.json', encoded)
    with ZipFile(archive) as output:
        assert output.testzip() is None
        for record in records:
            if record['path']:
                assert hashlib.sha256(output.read(record['path'])).hexdigest() == record['sha256']
    (ROOT / 'resources/scenic-images-manifest.json').write_bytes(encoded)
    (ROOT / 'resources/scenic-images.sha256').write_text(
        hashlib.sha256(archive.read_bytes()).hexdigest() + '  scenic-images.zip\n', encoding='utf-8')
    print(json.dumps(dict(images=len(files), missing=[r['name'] for r in records if not r['path']],
                         archive=str(archive)), ensure_ascii=True))


if __name__ == '__main__':
    main()
