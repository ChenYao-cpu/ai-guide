"""Package compiled App resources with the existing native runtime and signing key.

Private paths are command-line inputs; credentials are never printed or committed.
This packages an update without changing native SDKs, modules or permissions.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED


def manifest_attributes(data, version=None, version_code=None):
    binary = bytearray(data)
    strings, locations, attributes = [], [], {}
    position = 8
    while position < len(binary):
        kind, header, size = struct.unpack_from('<HHI', binary, position)
        if size < header or not size:
            raise ValueError('Invalid Android binary XML chunk')
        if kind == 1:
            count, _, flags, start, _ = struct.unpack_from('<IIIII', binary, position + 8)
            offsets = struct.unpack_from('<' + 'I' * count, binary, position + header)
            for offset in offsets:
                cursor = position + start + offset
                if flags & 0x100:
                    length = binary[cursor]
                    cursor += 2 if length & 0x80 else 1
                    length = binary[cursor]
                    cursor += 1
                    if length & 0x80:
                        length = ((length & 0x7f) << 8) | binary[cursor]
                        cursor += 1
                    encoding, byte_count = 'utf-8', length
                else:
                    length = struct.unpack_from('<H', binary, cursor)[0]
                    cursor += 2
                    if length & 0x8000:
                        length = ((length & 0x7fff) << 16) | struct.unpack_from('<H', binary, cursor)[0]
                        cursor += 2
                    encoding, byte_count = 'utf-16-le', length * 2
                strings.append(binary[cursor:cursor + byte_count].decode(encoding))
                locations.append((cursor, byte_count, encoding))
        if kind == 0x102 and strings[struct.unpack_from('<I', binary, position + 20)[0]] == 'manifest':
            first, each, count = struct.unpack_from('<HHH', binary, position + 24)
            for index in range(count):
                offset = position + 16 + first + index * each
                _, name, raw = struct.unpack_from('<III', binary, offset)
                data_type = binary[offset + 15]
                value = struct.unpack_from('<I', binary, offset + 16)[0]
                attribute = strings[name]
                attributes[attribute] = strings[raw] if raw != 0xffffffff else strings[value] if data_type == 3 else value
                if version_code is not None and attribute == 'versionCode':
                    if raw != 0xffffffff or data_type != 0x10:
                        raise ValueError('Unsupported native version code representation')
                    struct.pack_into('<I', binary, offset + 16, version_code)
                if version is not None and attribute == 'versionName':
                    cursor, length, encoding = locations[raw if raw != 0xffffffff else value]
                    replacement = version.encode(encoding)
                    if len(replacement) != length:
                        raise ValueError('Use HBuilderX native packaging when version name length changes')
                    binary[cursor:cursor + length] = replacement
            break
        position += size
    return bytes(binary), attributes


def sha256(file):
    with file.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def rename_native_label(data, old_name, new_name):
    """Replace an equal-width string-pool value without changing resource IDs."""
    if old_name == new_name:
        return data
    replacements = 0
    for encoding in ('utf-8', 'utf-16-le'):
        old, new = old_name.encode(encoding), new_name.encode(encoding)
        if len(old) != len(new):
            raise ValueError('Use native resource compilation when the label byte length changes')
        replacements += data.count(old)
        data = data.replace(old, new)
    if not replacements:
        raise ValueError('Original app label not found in native resources')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hbuilder', type=Path, required=True)
    parser.add_argument('--base-apk', type=Path, required=True)
    parser.add_argument('--signing-config', type=Path, required=True)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--previous-name', default='智游灵境')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.source_commit):
        raise ValueError('Pass the full source commit SHA')
    app = Path(__file__).resolve().parents[1]
    manifest = json.loads((app / 'manifest.json').read_text(encoding='utf-8-sig'))
    version, version_code = manifest['versionName'], int(manifest['versionCode'])
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Invalid release version')
    resources = app / 'unpackage/dist/build/app-plus'
    compiled = json.loads((resources / 'manifest.json').read_text(encoding='utf-8-sig'))
    assert compiled['id'] == manifest['appid'] == '__UNI__80C86A1'
    assert compiled['version'] == {'name': version, 'code': str(version_code)}
    assert {'Maps', 'Geolocation', 'Recorder'} <= set(compiled['permissions'])
    service = (resources / 'app-service.js').read_text(encoding='utf8')
    for marker in ['/user/email-code', '/user/register', 'zhiyou.app-language', 'pages/tour-guide/tour-guide']:
        assert marker in service, 'Missing release feature: ' + marker
    assert not (resources / 'static/client/index.html').exists()
    output_dir = app / 'unpackage/releases' / version
    output_dir.mkdir(parents=True, exist_ok=True)
    unsigned = output_dir / 'unsigned.apk'
    aligned = output_dir / 'aligned.apk'
    output = output_dir / ('zhiyou-' + version + '.apk')
    prefix = 'assets/apps/' + manifest['appid'] + '/www/'
    with ZipFile(args.base_apk) as source, ZipFile(unsigned, 'w', compression=ZIP_DEFLATED) as archive:
        _, original_attributes = manifest_attributes(source.read('AndroidManifest.xml'))
        assert original_attributes['package'] == 'com.zhiyou.guide'
        assert version_code > int(original_attributes['versionCode'])
        for item in source.infolist():
            if item.filename.startswith(prefix) or re.fullmatch(r'META-INF/(?:MANIFEST\.MF|[^/]+\.(?:RSA|DSA|EC|SF))', item.filename, re.I):
                continue
            content = source.read(item)
            if item.filename == 'AndroidManifest.xml':
                content, _ = manifest_attributes(content, version, version_code)
            if item.filename == 'resources.arsc':
                content = rename_native_label(content, args.previous_name, manifest['name'])
            archive.writestr(item, content)
        for file in sorted(resources.rglob('*')):
            if file.is_file():
                archive.write(file, prefix + file.relative_to(resources).as_posix())
    plugins = args.hbuilder / 'plugins'
    subprocess.run([str(plugins / 'app-safe-pack/zipalign/zipalign.exe'), '-p', '-f', '4', str(unsigned), str(aligned)], check=True, capture_output=True)
    signing = json.loads(args.signing_config.read_text(encoding='utf-8-sig'))['android']
    environment = os.environ.copy()
    environment['ZHIYOU_APK_STORE_PASS'] = signing['storepassword']
    environment['ZHIYOU_APK_KEY_PASS'] = signing['certpassword']
    java = str(plugins / 'amazon-corretto/bin/java.exe')
    signer = str(plugins / 'app-safe-pack/apksigner.jar')
    subprocess.run([java, '-jar', signer, 'sign', '--ks', signing['certfile'], '--ks-key-alias', signing['certalias'], '--ks-pass', 'env:ZHIYOU_APK_STORE_PASS', '--key-pass', 'env:ZHIYOU_APK_KEY_PASS', '--out', str(output), str(aligned)], env=environment, check=True, capture_output=True)
    def certificate(file):
        verified = subprocess.run([java, '-jar', signer, 'verify', '--verbose', '--print-certs', str(file)], check=True, capture_output=True, text=True).stdout
        assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in verified
        return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', verified).group(1)
    certificate_hash = certificate(output)
    assert certificate_hash == certificate(args.base_apk), 'Signing identity differs from the original APK'
    with ZipFile(output) as archive, ZipFile(args.base_apk) as original:
        assert archive.testzip() is None
        binary = archive.read('AndroidManifest.xml')
        _, attributes = manifest_attributes(binary)
        assert attributes['package'] == original_attributes['package']
        assert attributes['versionName'] == version and attributes['versionCode'] == version_code
        resources_table = archive.read('resources.arsc')
        assert resources_table == rename_native_label(original.read('resources.arsc'), args.previous_name, manifest['name'])
        key = manifest['app-plus']['distribute']['sdkConfigs']['maps']['amap']['appkey_android']
        assert key and (key.encode() in binary or key.encode('utf-16-le') in binary), 'Map key must match the native runtime'
        for file in resources.rglob('*'):
            if file.is_file():
                assert archive.read(prefix + file.relative_to(resources).as_posix()) == file.read_bytes()
        for filename in archive.namelist():
            if filename.endswith('.dex') or filename.startswith('lib/'):
                assert archive.read(filename) == original.read(filename)
        properties = archive.read('assets/data/dcloud_properties.xml')
        for module in [b'JsMapPluginImpl', b'GeolocationFeatureImpl', b'AudioFeatureImpl', b'UploadFeature']:
            assert module in properties
    record = dict(version=version, version_code=version_code, source_commit=args.source_commit, native_app_name=manifest['name'],
                  package=attributes['package'], appid=manifest['appid'], apk=str(output),
                  apk_bytes=output.stat().st_size, sha256=sha256(output),
                  signing_certificate_sha256=certificate_hash, signature_verified=True,
                  native_libraries_unchanged=True, app_resources_verified=True,
                  maps_and_key_verified=True, phone_verified=False, real_email_verified=False)
    (output_dir / 'verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps(record, ensure_ascii=False))


if __name__ == '__main__':
    main()
