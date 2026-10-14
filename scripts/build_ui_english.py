"""Build an offline English UI catalog from public application copy.

Only copy/labels are sent for translation. No account or provider secrets are
included. Stable IDs, placeholders, brand names and facts must be preserved.
Existing translations are reused; source transcripts/evidence are not changed.
"""
import json,os,re,time
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
import requests
from dotenv import load_dotenv
from openai import OpenAI

ROOT=Path(__file__).resolve().parents[1]
load_dotenv(ROOT/'.env',override=True)
DEST=ROOT/'frontend/src/i18n/en.json'
source_catalog=ROOT/'work_dirs/ui-source-catalog.json'
entries=set(json.loads(source_catalog.read_text(encoding='utf-8'))) if source_catalog.exists() else set()
for endpoint,key,fields in [('/tour-session/spots','spot_list',('spot_name','description','city','location','best_season','tags')),('/tour-session/routes','route_list',('name','description','theme'))]:
    response=requests.get('http://127.0.0.1:8000'+endpoint,timeout=15)
    if response.ok:
        body=response.json()
        data=body.get('data',body)
        for item in data.get(key,[]):
            for field in fields:
                value=item.get(field)
                if isinstance(value,str) and re.search(r'[\u3400-\u9fff]',value):
                    entries.update(value.split(';') if field=='tags' else [value])
existing=json.loads(DEST.read_text(encoding='utf-8'))
todo=sorted(entries-set(existing))
client=OpenAI(api_key=os.environ['LLM_API_KEY'],base_url=os.environ['LLM_API_BASE'],timeout=60,max_retries=1)
policy='''Translate Chinese interface copy for a polished scenic AI guide/admin web application into concise natural English. Return a JSON object mapping the supplied numeric IDs to translations, including every ID exactly once. Preserve all {p0}/{p1}/other placeholders, numbers, units, URLs, HTML, technical identifiers, punctuation distinctions, and factual qualifications. Do not add facts or promises. Translate sentence fragments as fragments. Use: 智游灵境=Zhiyou Lingjing, 颐和园=Summer Palace, 仁寿殿=Hall of Benevolence and Longevity, 长廊=Long Corridor, 佛香阁=Tower of Buddhist Incense, 昆明湖=Kunming Lake, 十七孔桥=Seventeen-Arch Bridge, 苏州街=Suzhou Street, 石舫=Marble Boat, 铜牛=Bronze Ox, 排云殿=Hall of Dispelling Clouds, 德和园=Garden of Virtue and Harmony, 乐寿堂=Hall of Joy and Longevity, 谐趣园=Garden of Harmonious Interests, 玉澜堂=Hall of Jade Ripples, 文昌院=Wenchang Gallery, 南湖岛=South Lake Island, 万寿山=Longevity Hill, 文轩=Wenxuan. Prefer short button labels. UI only; no discussion or reasoning in the result.'''
def batch(values):
    payload={str(i):value for i,value in enumerate(values)}
    for attempt in range(3):
        answer=client.chat.completions.create(model=os.getenv('LLM_MODEL_NAME','deepseek-chat'),messages=[{'role':'system','content':policy},{'role':'user','content':json.dumps(payload,ensure_ascii=False)}],response_format={'type':'json_object'},temperature=0.1,max_tokens=8192)
        result=json.loads(answer.choices[0].message.content)
        if set(result)!=set(payload):continue
        converted={}
        for index,value in payload.items():
            target=result[index]
            if not isinstance(target,str) or not target.strip():break
            if sorted(re.findall(r'\{\w+\}',value))!=sorted(re.findall(r'\{\w+\}',target)):break
            converted[value]=target
        if len(converted)==len(payload):return converted
    raise RuntimeError('Incomplete translation batch')
chunks=[todo[i:i+40] for i in range(0,len(todo),40)]
with ThreadPoolExecutor(max_workers=4) as pool:
    futures=[pool.submit(batch,chunk) for chunk in chunks]
    for i,future in enumerate(as_completed(futures),1):
        existing.update(future.result())
        DEST.write_text(json.dumps(dict(sorted(existing.items())),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'Translated {i}/{len(chunks)} batches; catalog={len(existing)}',flush=True)
print('English catalog ready:',len(existing))
existing.update(json.loads((ROOT/'frontend/src/i18n/overrides.en.json').read_text(encoding='utf-8')))
DEST.write_text(json.dumps(dict(sorted(existing.items())),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
