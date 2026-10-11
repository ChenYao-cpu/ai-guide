"""Build a traceable POI catalog and offline footway distances from an OSM snapshot.

Input: work_dirs/palace-expanded-osm.json (OSM map API, 2026-10-10).
Only park footways are used; no ferry routes or straight lines across the lake.
"""
import heapq
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
elements = json.loads((ROOT / 'work_dirs/palace-expanded-osm.json').read_text(encoding='utf-8'))['elements']
nodes = {e['id']: e for e in elements if e['type'] == 'node'}
ways = {e['id']: e for e in elements if e['type'] == 'way'}

def distance(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [a['latitude'], a['longitude'], b['latitude'], b['longitude']])
    return 6371000 * 2 * math.asin(min(1, math.sqrt(math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))

def point(node):
    return {'latitude': node['lat'], 'longitude': node['lon']}

def center(way_id):
    ids = ways[way_id]['nodes']
    if ids[0] == ids[-1]: ids = ids[:-1]
    return {'latitude': sum(nodes[i]['lat'] for i in ids)/len(ids), 'longitude': sum(nodes[i]['lon'] for i in ids)/len(ids)}

# Scores are editorial affinities, not learned visitor ratings. Reasons are the
# concrete observations supporting each affinity (0 absent, 1-5 strength).
rows = [
 ('仁寿殿',[5,1,2,2],False,{'history':'宫廷理政空间与殿前陈设'}),
 ('长廊',[4,3,4,5],False,{'history':'传统建筑彩画与人物故事','nature':'临湖廊道与湖山借景','photography':'连续廊柱的透视构图','family':'一起寻找彩画中的人物故事'}),
 ('佛香阁',[5,3,5,1],True,{'history':'万寿山中轴与佛教建筑','nature':'登高观察湖山格局','photography':'高处俯瞰昆明湖'}),
 ('昆明湖',[2,5,5,4],False,{'nature':'知春亭岸边观察湖面与水岸','photography':'湖面倒影与万寿山远景','family':'岸边观察桥、岛与水鸟，注意临水安全'}),
 ('十七孔桥',[3,4,5,3],False,{'history':'传统石桥券洞与石栏','nature':'桥上观看湖面与南湖岛','photography':'连续桥洞、桥身曲线与倒影','family':'观察桥洞和石狮的不同形态'}),
 ('苏州街',[4,3,4,2],True,{'history':'皇家园林中的江南街市意象','nature':'后湖水岸与街巷','photography':'水、桥与沿岸建筑组合'}),
 ('乐寿堂',[5,2,3,3],False,{'history':'帝后生活区的院落与陈设','photography':'院落、庭树与建筑层次','family':'比较生活院落和理政院落'}),
 ('玉澜堂',[5,1,2,2],False,{'history':'帝后生活区的历史与院落布局'}),
 ('排云殿',[5,2,4,2],True,{'history':'前山礼仪建筑与中轴空间','photography':'建筑中轴与层层抬升的殿阁'}),
 ('谐趣园',[3,5,4,5],False,{'history':'江南园林意象的再创造','nature':'池塘、廊桥与园中园景观','photography':'池水、廊桥和亭阁的小景构图','family':'辨认池、桥、亭的空间关系'}),
 ('石舫',[4,3,5,3],False,{'history':'清晏舫的船形园林建筑','nature':'昆明湖北岸观景','photography':'船形建筑与湖岸倒影','family':'对比石舫与真正的船'}),
 ('玉带桥',[3,4,5,1],True,{'history':'西堤桥梁的拱券形制','nature':'西堤水岸与桥景','photography':'高拱桥与水面倒影'}),
 ('南湖岛',[2,5,4,4],False,{'nature':'湖中岛岸的开阔湖山视线','photography':'隔湖远望万寿山','family':'观察岛与桥如何连接'}),
 ('铜牛',[4,3,4,5],False,{'history':'皇家园林中的铜铸动物与水文化','nature':'东堤湖岸观景','photography':'铜牛与湖山远景同框','family':'观察铜牛造型，认识传统水文化'}),
 ('德和园',[5,1,3,4],False,{'history':'宫廷戏曲与大戏楼建筑','photography':'戏楼建筑的立面层次','family':'认识戏楼与传统舞台'}),
 ('文昌阁',[4,2,4,2],False,{'history':'东岸城关式建筑形制','photography':'阁楼与湖岸构图'}),
]
keys = ['history','nature','photography','family']
locations = json.loads((ROOT/'data/summer_palace_locations.json').read_text(encoding='utf-8'))
new_refs = [('乐寿堂','way',43977893),('玉澜堂','way',579104635),('排云殿','way',43977820),('谐趣园','way',341357972),('石舫','way',727042890),('玉带桥','way',43976657),('南湖岛','way',627822201),('铜牛','node',269708600),('德和园','node',5515645721),('文昌阁','way',579104637)]
labels = ['东部生活区，乐寿堂院落','仁寿殿西侧，玉澜堂院落','万寿山前山中轴，排云殿','万寿山东麓，谐趣园','昆明湖北岸，清晏舫（石舫）','昆明湖西堤，玉带桥桥面','南湖岛北侧，涵虚堂观景点','昆明湖东堤，铜牛','仁寿殿北侧，德和园','昆明湖东岸，文昌阁']
for (name,kind,ref),label in zip(new_refs,labels):
    locations['spots'][name] = {**(center(ref) if kind=='way' else point(nodes[ref])), 'location':label, 'source_url':f'https://www.openstreetmap.org/{kind}/{ref}', 'anchor':'建筑轮廓中心或已命名地标；南湖岛使用涵虚堂观景点'}
(ROOT/'data/summer_palace_locations.json').write_text(json.dumps(locations,ensure_ascii=False,indent=2),encoding='utf-8')
official = 'https://gygl.beijing.gov.cn/mlgy/mlgy_lsmy/201911/t20191129_732237.html'
catalog = {'basis':'景点特色人工标注；不使用游客画像或虚构热度。','source_urls':[official], 'profiles':{}}
for name,scores,stairs,reasons in rows:
    catalog['profiles'][name] = {'affinities':dict(zip(keys,scores)), 'stairs':stairs, 'reasons':reasons}
(ROOT/'data/summer_palace_profiles.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')

boundary = [nodes[i] for i in ways[29228773]['nodes']]
def inside(node):
    x,y=node['lon'],node['lat']; hit=False
    for a,b in zip(boundary,boundary[1:]):
        if (a['lat']>y)!=(b['lat']>y) and x < (b['lon']-a['lon'])*(y-a['lat'])/(b['lat']-a['lat'])+a['lon']: hit=not hit
    return hit

graph={}
for way in ways.values():
    tags=way.get('tags',{})
    if tags.get('highway') not in {'footway','path','pedestrian','steps','service','track'}: continue
    if tags.get('access') in {'no','private'} or tags.get('foot') in {'no','private'}: continue
    for a,b in zip(way['nodes'],way['nodes'][1:]):
        if a not in nodes or b not in nodes or not inside(nodes[a]) or not inside(nodes[b]): continue
        meters=distance(point(nodes[a]),point(nodes[b]))
        graph.setdefault(a,[]).append((b,meters)); graph.setdefault(b,[]).append((a,meters))
# Largest connected walkable component; snapping distance remains visible in artifact.
components=[]; unseen=set(graph)
while unseen:
    stack=[unseen.pop()]; component=set(stack)
    while stack:
        for b,_ in graph[stack.pop()]:
            if b in unseen: unseen.remove(b); component.add(b); stack.append(b)
    components.append(component)
main=max(components,key=len)
anchors={}
for name,loc in locations['spots'].items():
    closest=min(main,key=lambda n:distance(loc,point(nodes[n])))
    anchors[name]={'node_id':closest,'snap_meters':round(distance(loc,point(nodes[closest]))),**point(nodes[closest])}
    if anchors[name]['snap_meters']>150: raise RuntimeError(f'{name}: walking anchor too far {anchors[name]}')

matrix={}
for name,anchor in anchors.items():
    start=anchor['node_id']; costs={start:0}; heap=[(0,start)]
    while heap:
        cost,a=heapq.heappop(heap)
        if cost!=costs[a]:continue
        for b,meters in graph[a]:
            new=cost+meters
            if new<costs.get(b,float('inf')): costs[b]=new;heapq.heappush(heap,(new,b))
    matrix[name]={other:round(costs[loc['node_id']]+anchor['snap_meters']+loc['snap_meters']) if other!=name else 0 for other,loc in anchors.items()}
artifact={'source':'OpenStreetMap contributors, ODbL','source_url':'https://api.openstreetmap.org/api/0.6/map?bbox=116.245,39.979,116.281,40.004','snapshot_date':'2026-10-10','basis':'园内步行路网最短距离，加景点到道路的接入距离；不含船渡，非实时导航。台阶通过景点标注避让，非无障碍路线保证。','node_count':len(main),'anchors':anchors,'distances_meters':matrix}
(ROOT/'data/summer_palace_walk_distances.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2),encoding='utf-8')
print('Catalog:',len(rows),'walking nodes:',len(main),'snaps:',{k:v['snap_meters'] for k,v in anchors.items()})
