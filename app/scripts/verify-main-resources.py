"""Read-only verification of deployed public App resources against main's resource pack."""
from pathlib import Path
from zipfile import ZipFile
import argparse,json,hashlib,urllib.request
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--base',default='http://127.0.0.1:18000/api/v1');parser.add_argument('--output');args=parser.parse_args()
root=Path(__file__).resolve().parents[2];z=ZipFile(root/'resources/local-resources.zip');data=json.loads(z.read('local-resources/resources.json'))
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def api(endpoint):return json.load(opener.open(args.base+endpoint,timeout=30))['data']
spots=api('/tour-session/spots')['spot_list'];routes=api('/tour-session/routes')['route_list'];by_id={row['spot_id']:row['spot_name'] for row in spots};main_names={row['spot_id']:row['spot_name'] for row in data['tables']['scenic_spot_info']}
for row in data['tables']['scenic_spot_info']:
 live=next(s for s in spots if s['spot_name']==row['spot_name'])
 for field,value in row.items():
  if field in live and field not in ['spot_id','user_id','delete','upload_date','image_path']:assert live[field]==value,(row['spot_name'],field)
covers=[]
for row in data['tables']['tour_route']:
 live=next(r for r in routes if r['name']==row['name']);assert live['cover_generated']==row['cover_generated']
 expected=[main_names[link['spot_id']] for link in sorted(data['tables']['tour_route_spot'],key=lambda x:x['spot_order']) if link['route_id']==row['route_id']]
 assert [by_id[sid] for sid in live['spot_ids']]==expected
 url=live['cover_image'];url=url if url.startswith('http') else args.base.split('/api/v1')[0]+url
 image=opener.open(url,timeout=30).read();source=z.read('local-resources/static/'+row['cover_image']);assert image==source
 bundled=root/'app/static/route-covers'/Path(row['cover_image']).name;assert bundled.read_bytes()==source
 covers.append({'name':row['name'],'sha256':hashlib.sha256(image).hexdigest(),'http_and_bundled_match_main':True,'stops':expected,'minutes':live['estimated_time_minutes']})
line_endings=[]
for relative,digest in data['files'].items():
 live=(root/relative).read_bytes();source=z.read('local-resources/'+relative)
 if live!=source:assert live.replace(b'\r\n',b'\n')==source.replace(b'\r\n',b'\n'),relative;line_endings.append(relative)
report={'passed':True,'source_main':'41480aa887d1034d380ebdddcb8c6d5898e5ec5e','scenic_records_verified':len(data['tables']['scenic_spot_info']),'resource_files_verified':len(data['files']),'route_covers':covers,'only_line_endings_differ':line_endings,'preserved_runtime_configuration':['working scenic photographs omitted by public snapshot','digital human credentials and enabled state','account and visitor records','processed knowledge index']}
if args.output:Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':True,'scenic_records':report['scenic_records_verified'],'resource_files':report['resource_files_verified'],'route_covers':len(covers),'line_ending_only_files':len(line_endings)}))
