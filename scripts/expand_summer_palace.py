"""Idempotently add ten POIs without replacing existing spots, guides or routes."""
import json
import hashlib
from seed_summer_palace_demo import ROOT, DB_ENGINE, ScenicSpotInfo, KnowledgeDocument, Session, select

def main():
    locations=json.loads((ROOT/'data/summer_palace_locations.json').read_text(encoding='utf-8'))['spots']
    profiles=json.loads((ROOT/'data/summer_palace_profiles.json').read_text(encoding='utf-8'))['profiles']
    additions=[
        ('乐寿堂','historical',22,'东部生活区的院落建筑，可对照仁寿殿理解理政与生活空间的区别。'),
        ('玉澜堂','historical',15,'位于东部生活区，以院落与殿堂布局呈现帝后生活空间。'),
        ('排云殿','historical',22,'万寿山前山中轴上的重要殿堂，与佛香阁形成层层抬升的建筑序列。'),
        ('谐趣园','natural',30,'万寿山东麓的园中园，池塘、廊桥与亭阁形成江南园林小景。'),
        ('石舫','cultural',15,'又名清晏舫，位于昆明湖北岸，船形建筑与湖岸景观相结合。'),
        ('玉带桥','cultural',15,'昆明湖西堤上的高拱石桥，桥形与水面倒影适合侧向观察和摄影。'),
        ('南湖岛','natural',25,'由十七孔桥连接东堤；讲解点设在涵虚堂，可隔湖远望万寿山。'),
        ('铜牛','cultural',12,'昆明湖东堤的铜铸动物地标，适合观察造型并了解皇家园林中的水文化。'),
        ('德和园','historical',25,'东部宫廷区的戏曲建筑空间，可了解传统舞台与宫廷戏曲。'),
        ('文昌阁','historical',15,'昆明湖东岸的城关式建筑，适合从湖岸观察阁楼形制。'),
    ]
    doc=ROOT/'static/tour_files/knowledge_base/summer_palace_expanded.md'
    doc.parent.mkdir(parents=True,exist_ok=True)
    lines=['# 颐和园新增景点讲解资料','来源：https://gygl.beijing.gov.cn/mlgy/mlgy_lsmy/201911/t20191129_732237.html','坐标来源及观察点详见 data/summer_palace_locations.json。游览时长为策展建议。','']
    for name,_,_,description in additions:
        lines.extend([f'## {name}',description,'；'.join(profiles[name]['reasons'].values()),'开放、票务与通行情况以园内公告为准。',''])
    doc.write_text('\n'.join(lines),encoding='utf-8')
    with Session(DB_ENGINE) as session:
        owner=session.exec(select(ScenicSpotInfo).where(ScenicSpotInfo.spot_name=='仁寿殿',ScenicSpotInfo.delete==False)).one()
        existing={s.spot_name:s for s in session.exec(select(ScenicSpotInfo)).all()}
        created=[]
        for name,category,minutes,description in additions:
            if name in existing:
                if existing[name].delete: raise RuntimeError(f'{name}已被删除，请先处理冲突，未提交新增数据')
                continue
            profile=profiles[name]
            spot=ScenicSpotInfo(spot_name=name,category=category,city='北京',user_id=owner.user_id,
                latitude=locations[name]['latitude'],longitude=locations[name]['longitude'],location=locations[name]['location'],
                tags=';'.join(profile['reasons'].values()),visit_duration=minutes,trigger_radius=55,
                description=description,history_detail=description,photo_tips=profile['reasons'].get('photography','观察建筑与周边环境的关系。'),
                service_facilities='休息点、卫生间与开放情况请以园内标识为准。',
                tour_tips='有台阶或高差，登高请量力而行。' if profile['stairs'] else '按园内步道游览，临水区域注意安全。',
                instruction='tour_files/knowledge_base/summer_palace_expanded.md',best_season='四季可观察，春秋步行较舒适')
            session.add(spot); created.append(name)
        relative='tour_files/knowledge_base/summer_palace_expanded.md'
        knowledge=session.exec(select(KnowledgeDocument).where(KnowledgeDocument.file_path==relative)).first()
        if knowledge is None:
            knowledge=KnowledgeDocument(title='颐和园新增十处景点观察与讲解',file_path=relative,user_id=owner.user_id)
        knowledge.file_type='md'
        knowledge.content_hash=hashlib.sha256(doc.read_bytes()).hexdigest()
        knowledge.chunk_count=10
        knowledge.status='completed'
        session.add(knowledge)
        session.commit()
        print('Added:',created)

if __name__=='__main__': main()
