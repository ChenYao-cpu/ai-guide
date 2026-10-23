"""Use a real isolated SQLite transaction store; never touch the user's database."""
import copy
import json
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool

from server.base.routers import service_stations as api, xingyun
from server.base.models.station_models import ServiceStation, StationVisit, StationPlan, StationClaim
from server.base.models.tour_models import ScenicSpotInfo, DigitalGuideInfo, TourSessionInfo
from server.base.models.xingyun import XingyunGuideBinding
from server.base.modules.station_service import plan_walk, station_anchor, extract_request
from server.base.modules.walking_network import NETWORK
from test_preference_planner import SPOTS


class StationServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        self.patch = patch.object(api, 'DB_ENGINE', self.engine); self.patch.start()
        with Session(self.engine) as db:
            db.add(ServiceStation(station_id='test-east', name='入口接待站', name_en='Entry service station', location='东宫门示范', location_en='East gate demo'))
            db.add(DigitalGuideInfo(guide_id=1, name='测试接待员', is_enabled=True, render_mode='3d', voice_style='male_wenhou'))
            for s in SPOTS: db.add(ScenicSpotInfo(**s))
            db.commit()
        app = FastAPI(); app.include_router(api.router); app.include_router(xingyun.router)
        app.dependency_overrides[api.require_guide_admin] = lambda: 1
        self.client = TestClient(app)
        self.visit = self.client.post('/service-stations/public/test-east/visits', json={}).json()
        self.headers = {'X-Station-Token': self.visit['access_token']}
        self.prefix = '/service-stations/visits/' + self.visit['visit_id']

    def tearDown(self):
        self.client.close(); self.patch.stop(); self.engine.dispose()

    def plans(self, **values):
        response = self.client.post(self.prefix + '/plans', json={'budget': 120, **values}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['plans']

    def share(self, plan):
        response = self.client.post(self.prefix + '/share', json={'plan_id':plan['plan_id']}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['token']

    def test_route_chat_edits_saved_plan_and_rejects_foreign_plan(self):
        plan = self.plans(budget=240, spot_ids=[SPOTS[0]['spot_id'], SPOTS[1]['spot_id']])[0]
        remove = plan['route']['stops'][0]
        response = self.client.post(self.prefix+'/chat', json={'question':'去掉'+remove['spot_name'], 'plan_id':plan['plan_id']}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        updated = response.json()['plans'][0]
        self.assertEqual(len(updated['route']['stops']), 1)
        self.assertNotIn(remove['spot_id'], [s['spot_id'] for s in updated['route']['stops']])
        other = self.client.post('/service-stations/public/test-east/visits',json={}).json()
        forbidden = self.client.post('/service-stations/visits/'+other['visit_id']+'/chat',json={'question':'时间短一点', 'plan_id':plan['plan_id']},headers={'X-Station-Token':other['access_token']})
        self.assertEqual(forbidden.status_code,404)
        last = updated['route']['stops'][0]
        rejected = self.client.post(self.prefix+'/chat',json={'question':'去掉'+last['spot_name'],'plan_id':updated['plan_id']},headers=self.headers)
        self.assertEqual(rejected.status_code,422)

    def test_context_parser_preserves_stops_when_changing_exit_and_ignores_questions(self):
        from server.base.modules.station_service import revise_plan_request
        plan = self.plans(budget=240)[0]
        changed = revise_plan_request('最后改为北宫门',plan,SPOTS)
        self.assertEqual(changed['end_area'],'north')
        self.assertEqual(changed['spot_ids'],[s['spot_id'] for s in plan['route']['stops']])
        self.assertIsNone(revise_plan_request('这条路线有哪些景点值得看？',plan,SPOTS))
        self.assertIsNone(revise_plan_request('北宫门有什么历史？',plan,SPOTS))
        removed = revise_plan_request('不想去'+plan['route']['stops'][0]['spot_name'],plan,SPOTS)
        self.assertNotIn(plan['route']['stops'][0]['spot_id'],removed['spot_ids'])
        shorter = revise_plan_request('这条路线太长了，短一点',plan,SPOTS)
        self.assertLess(shorter['budget'],plan['route']['total_minutes'])

    def test_pickup_status_is_private_and_confirms_receipt(self):
        plan = self.plans()[0]; token = self.share(plan)
        endpoint = self.prefix+'/share-status'
        self.assertEqual(self.client.post(endpoint,json={'token':token},headers=self.headers).json(),{'status':'waiting'})
        self.assertEqual(self.client.post(endpoint,json={'token':token}).status_code,403)
        other = self.client.post('/service-stations/public/test-east/visits',json={}).json()
        self.assertEqual(self.client.post('/service-stations/visits/'+other['visit_id']+'/share-status',json={'token':token},headers={'X-Station-Token':other['access_token']}).status_code,404)
        response = self.client.post('/service-stations/claim/receive',json={'token':token,'receipt':'a'*48})
        self.assertEqual(response.status_code,200,response.text)
        status = self.client.post(endpoint,json={'token':token},headers=self.headers)
        self.assertEqual(status.json(),{'status':'received'})
        self.assertEqual(status.headers['cache-control'],'no-store')

    def test_plans_include_station_origin_exit_and_never_exceed_budget(self):
        for pace in ('standard', 'relaxed'):
            plans = self.plans(budget=90, pace=pace, interest='nature', end_area='north')
            self.assertGreaterEqual(len(plans), 1)
            for plan in plans:
                route = plan['route']
                self.assertTrue(route['complete'])
                self.assertLessEqual(route['total_minutes'], 90)
                self.assertEqual(route['entry_anchor']['node_id'], NETWORK['gates']['east']['node_id'])
                self.assertEqual(route['exit_anchor']['node_id'], NETWORK['gates']['north']['node_id'])
                self.assertEqual(route['walking_meters'], sum(x['meters'] for x in [route['entry_leg'],*route['legs'],route['exit_leg']]))
                self.assertEqual(route['total_minutes'], route['walking_minutes']+route['visit_minutes']+route['exit_minutes']+route['rest_minutes'])
            for option in plans[1:]:
                if option['kind']=='easy':
                    self.assertLess(option['route']['walking_meters'], plans[0]['route']['walking_meters'])
                    self.assertLessEqual(option['route']['total_minutes'], plans[0]['route']['total_minutes'])
                if option['kind']=='rich': self.assertGreater(len(option['route']['stops']),len(plans[0]['route']['stops']))
        with Session(self.engine) as db: self.assertEqual(db.exec(select(TourSessionInfo)).all(), [])

    def test_custom_selection_is_preserved_and_over_budget_has_no_partial_commit(self):
        selected = [SPOTS[4]['spot_id'], SPOTS[0]['spot_id'], SPOTS[10]['spot_id']]
        plan = self.plans(spot_ids=selected,budget=300,end_area='return')[0]
        route = plan['route']
        self.assertEqual({s['spot_id'] for s in route['stops']}, set(selected))
        self.assertEqual(route['entry_anchor'], route['exit_anchor'])
        with Session(self.engine) as db: count = len(db.exec(select(StationPlan)).all())
        response = self.client.post(self.prefix+'/plans',json={'spot_ids':selected,'budget':20},headers=self.headers)
        self.assertEqual(response.status_code,422)
        with Session(self.engine) as db: self.assertEqual(len(db.exec(select(StationPlan)).all()), count)

    def test_another_visit_cannot_read_or_share_a_plan(self):
        plan = self.plans()[0]
        self.assertEqual(self.client.post(self.prefix+'/plans',json={},headers={'X-Station-Token':'wrong'}).status_code,403)
        other = self.client.post('/service-stations/public/test-east/visits',json={}).json()
        response = self.client.post('/service-stations/visits/'+other['visit_id']+'/share', json={'plan_id':plan['plan_id']},headers={'X-Station-Token':other['access_token']})
        self.assertEqual(response.status_code,404)

    def test_phone_pickup_survives_terminal_reset_and_is_idempotent_for_its_receipt(self):
        plan = self.plans(end_area='return')[0]; token = self.share(plan)
        self.assertEqual(self.client.post(self.prefix+'/end',headers=self.headers).status_code,200)
        with Session(self.engine) as db:
            visit = db.get(StationVisit,self.visit['visit_id'])
            self.assertEqual(visit.messages,[]); self.assertEqual(visit.access_hash,'')
            self.assertEqual(db.exec(select(StationPlan)).all(),[])
        body = {'token':token,'receipt':'a'*48}
        self.assertEqual(self.client.post('/service-stations/claim/preview',json=body).status_code,200)
        received = self.client.post('/service-stations/claim/receive',json=body)
        self.assertEqual(received.status_code,200,received.text)
        sid = received.json()['session_id']
        self.assertEqual(self.client.post('/service-stations/claim/receive',json=body).json()['session_id'],sid)
        self.assertEqual(self.client.post('/service-stations/claim/receive',json={'token':token,'receipt':'b'*48}).status_code,409)
        with Session(self.engine) as db:
            tours = db.exec(select(TourSessionInfo)).all(); self.assertEqual(len(tours),1)
            prefs = json.loads(tours[0].visitor_preferences)
            self.assertEqual(prefs['spot_ids'],[s['spot_id'] for s in plan['route']['stops']])
            self.assertEqual(prefs['station_plan']['route'],plan['route'])
            self.assertNotIn('messages',prefs)
            self.assertEqual(tours[0].status.live_status,1)

    def test_expired_codes_and_changed_network_or_catalog_are_rejected(self):
        plan=self.plans()[0]; token=self.share(plan)
        with Session(self.engine) as db:
            claim=db.get(StationClaim,api.digest(token));claim.expires_at=api.utcnow()-timedelta(seconds=1);db.add(claim);db.commit()
        self.assertEqual(self.client.post('/service-stations/claim/receive',json={'token':token,'receipt':'a'*48}).status_code,410)
        with patch.object(api,'network_version',return_value='changed'):
            self.assertEqual(self.client.post(self.prefix+'/share',json={'plan_id':plan['plan_id']},headers=self.headers).status_code,409)
        with Session(self.engine) as db:
            spot=db.get(ScenicSpotInfo,SPOTS[0]['spot_id']);spot.visit_duration+=1;db.add(spot);db.commit()
        self.assertEqual(self.client.post(self.prefix+'/share',json={'plan_id':plan['plan_id']},headers=self.headers).status_code,409)

    def test_chat_prefills_requirements_but_does_not_create_or_advance_a_tour(self):
        response=self.client.post(self.prefix+'/chat',json={'question':'两小时，带着老人，想看湖，最后从东门离园'},headers=self.headers)
        self.assertEqual(response.status_code,200,response.text)
        result=response.json();self.assertEqual(result['actions'],['plan'])
        self.assertEqual(result['preferences']['budget'],120)
        self.assertEqual(result['preferences']['pace'],'standard');self.assertEqual(result['preferences']['interest'],'all')
        self.assertNotIn('节奏',result['answer'])
        self.assertEqual(result['preferences']['end_area'],'east')
        with Session(self.engine) as db:
            self.assertEqual(db.exec(select(TourSessionInfo)).all(),[])
            self.assertEqual(len(db.get(StationVisit,self.visit['visit_id']).messages),2)
        self.client.post(self.prefix+'/end',headers=self.headers)
        self.assertEqual(self.client.post(self.prefix+'/chat',json={'question':'你好'},headers=self.headers).status_code,403)

    def test_gate_directions_use_station_node_and_unverified_facilities_are_not_routed(self):
        response=self.client.post('/service-stations/public/test-east/directions',json={'key':'gate:north'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertGreater(len(response.json()['geometry']),2)
        self.assertEqual(response.json()['origin']['node_id'],NETWORK['gates']['east']['node_id'])
        self.assertEqual(self.client.post('/service-stations/public/test-east/directions',json={'key':'unknown-toilet'}).status_code,404)
        attraction=self.client.post('/service-stations/public/test-east/directions',json={'key':'spot:长廊'})
        self.assertEqual(attraction.status_code,200,attraction.text)
        self.assertEqual(attraction.json()['destination']['node_id'],NETWORK['anchors']['长廊']['node_id'])

    def test_attraction_wayfinding_has_a_direct_action_not_a_full_tour(self):
        response=self.client.post(self.prefix+'/chat',json={'question':'从这里到长廊怎么走？'},headers=self.headers)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['destination_key'],'spot:长廊')
        self.assertEqual(response.json()['actions'],['facilities'])

    def test_admin_configuration_is_versioned_and_formal_station_needs_location_verification(self):
        row=self.client.get('/service-stations/admin').json()['stations'][0]
        row['demo']=False
        self.assertEqual(self.client.put('/service-stations/admin/test-east',json=row).status_code,422)
        row['location_checked']=True
        response=self.client.put('/service-stations/admin/test-east',json=row)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['revision'],2)
        self.assertEqual(self.client.put('/service-stations/admin/test-east',json=row).status_code,409)
        row=response.json(); row['enabled']=False
        self.assertEqual(self.client.put('/service-stations/admin/test-east',json=row).status_code,200)
        self.assertEqual(self.client.get('/service-stations/public/test-east').status_code,404)

    def test_expired_consultations_are_scrubbed_and_cannot_continue(self):
        with Session(self.engine) as db:
            visit=db.get(StationVisit,self.visit['visit_id']);visit.expires_at=api.utcnow()-timedelta(seconds=1);visit.messages=[{'role':'user','content':'private'}];db.add(visit);db.commit()
        self.assertEqual(self.client.post(self.prefix+'/plans',json={},headers=self.headers).status_code,410)
        self.client.post('/service-stations/public/test-east/heartbeat')
        with Session(self.engine) as db:
            visit=db.get(StationVisit,self.visit['visit_id']);self.assertEqual(visit.messages,[]);self.assertEqual(visit.access_hash,'')

    def test_english_extraction_and_non_gate_service_station(self):
        parsed=extract_request('2 hours, senior visitors, lake views, north gate')
        self.assertEqual(parsed['budget'],120);self.assertEqual(parsed['end_area'],'north')
        self.assertNotIn('pace',parsed);self.assertNotIn('interest',parsed)
        self.assertEqual(extract_request('three hours')['budget'],180)
        self.assertEqual(extract_request('一个半小时')['budget'],90)
        with Session(self.engine) as db:
            station=db.get(ServiceStation,'test-east');station.anchor_key='spot:长廊'
            plan=plan_walk(station,SPOTS,api.PlanInput(end_area='return').model_dump())[0]
            self.assertEqual(plan['route']['entry_anchor']['node_id'],NETWORK['anchors']['长廊']['node_id'])
            self.assertEqual(plan['route']['entry_anchor'],plan['route']['exit_anchor'])

    def test_admin_endpoints_require_authentication(self):
        self.client.app.dependency_overrides.clear()
        self.assertEqual(self.client.get('/service-stations/admin').status_code,401)

    def test_cloud_avatar_uses_station_credentials_without_creating_a_tour(self):
        with Session(self.engine) as db:
            guide=db.get(DigitalGuideInfo,1);guide.render_mode='xingyun';db.add(guide)
            db.add(XingyunGuideBinding(guide_id=1,app_id='test-app',secret_encrypted='encrypted'))
            db.commit()
        self.visit=self.client.post('/service-stations/public/test-east/visits',json={}).json()
        self.headers={'X-Station-Token':self.visit['access_token']}
        self.prefix='/service-stations/visits/'+self.visit['visit_id']
        response=MagicMock();response.is_success=True;response.status_code=200
        response.json.return_value={'data':{'resource_pack':{'test':True},'session_id':'test-remote','request_id':'test-request'}}
        client=MagicMock();client.__aenter__=AsyncMock(return_value=client);client.__aexit__=AsyncMock(return_value=False);client.request=AsyncMock(return_value=response)
        url='/xingyun/session/1?station_visit_id='+self.visit['visit_id']
        with patch.object(xingyun,'DB_ENGINE',self.engine),patch.object(xingyun,'decrypt_secret',return_value='test-secret'),patch.object(xingyun.httpx,'AsyncClient',return_value=client):
            self.assertEqual(self.client.post(url,json={},headers={'X-Station-Token':'wrong'}).status_code,403)
            opened=self.client.post(url,json={},headers=self.headers)
            self.assertEqual(opened.status_code,200,opened.text)
            denied=self.client.request('DELETE',url,json={'session_id':'test-remote'},headers={'X-Station-Token':'wrong'})
            self.assertEqual(denied.status_code,403)
            self.client.post(self.prefix+'/end',headers=self.headers)
            closed=self.client.request('DELETE',url,json={'session_id':'test-remote'},headers=self.headers)
            self.assertEqual(closed.status_code,200,closed.text)
        with Session(self.engine) as db: self.assertEqual(db.exec(select(TourSessionInfo)).all(),[])


    def test_explicit_new_spot_overrides_previous_context_in_both_languages(self):
        previous = next(s for s in SPOTS if s['spot_name'] == '十七孔桥')
        corridor = next(s for s in SPOTS if s['spot_name'] == '长廊')
        with patch('server.base.routers.tour_chat._llm_is_configured', return_value=False):
            for question, language in [('长廊有什么值得看？', 'zh'), ('Tell me about the Long Corridor', 'en')]:
                response = self.client.post(self.prefix+'/chat', json={'question': question, 'language': language, 'spot_id':previous['spot_id']}, headers=self.headers)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()['spot_id'], corridor['spot_id'])
                self.assertEqual(response.json()['visuals']['spot_name'], '长廊')
            follow = self.client.post(self.prefix+'/chat', json={'question':'它有什么历史？', 'spot_id':corridor['spot_id']},headers=self.headers)
            self.assertEqual(follow.json()['spot_id'],corridor['spot_id'])

    def test_negated_edits_never_modify_a_saved_route_but_positive_clause_still_works(self):
        from server.base.modules.station_service import revise_plan_request
        plan = self.plans(budget=240)[0]
        with patch('server.base.routers.tour_chat._llm_is_configured', return_value=False):
            for question in ['不要把终点改为北宫门', "Don't change the exit to the north gate", '别把这条路线缩短', '不要改为北宫门，也不要少走', '不改为北宫门', '不希望短一点']:
                self.assertIsNone(revise_plan_request(question,plan,SPOTS))
                response=self.client.post(self.prefix+'/chat',json={'question':question,'plan_id':plan['plan_id']},headers=self.headers)
                self.assertEqual(response.status_code,200,response.text)
                self.assertNotIn('plans',response.json())
                self.assertEqual(response.json()['preferences']['end_area'],'east')
        revised=revise_plan_request('不要改为北宫门，但是最后改为新建宫门',plan,SPOTS)
        self.assertEqual(revised['end_area'],'south')
        stop=plan['route']['stops'][0]
        self.assertNotIn(stop['spot_id'],revise_plan_request('不想去'+stop['spot_name'],plan,SPOTS)['spot_ids'])
        self.assertIsNone(revise_plan_request('不要移除'+stop['spot_name'],plan,SPOTS))

    def test_english_fallback_survives_changed_chinese_copy(self):
        from server.base.modules.station_service import english_local_answer, SPOT_ENGLISH
        for name, data in SPOT_ENGLISH.items():
            with self.subTest(name=name):
                answer=english_local_answer({'spot_name':name,'description':'已修改的中文简介'}, '未收录的中文回答')
                self.assertIn(data['description'],answer)
                self.assertNotIn('temporarily unavailable',answer)
                self.assertNotIn('已修改',answer)

    def test_connectivity_failure_and_budget_failure_have_distinct_messages(self):
        unavailable=self.client.post(self.prefix+'/plans',json={'budget':480,'end_area':'north','avoid_steps':True},headers=self.headers)
        self.assertEqual(unavailable.status_code,422)
        self.assertIn('当前路网',unavailable.json()['detail'])
        self.assertNotIn('增加时间',unavailable.json()['detail'])
        too_short=self.client.post(self.prefix+'/plans',json={'budget':20,'end_area':'north'},headers=self.headers)
        self.assertEqual(too_short.status_code,422)
        self.assertIn('时间不足',too_short.json()['detail'])
        self.plans(budget=480,end_area='north',avoid_steps=False)

    def test_share_language_is_independent_of_route_validity_and_saved_plan(self):
        plan=self.plans()[0]
        response=self.client.post(self.prefix+'/share',json={'plan_id':plan['plan_id'],'language':'en'},headers=self.headers)
        self.assertEqual(response.status_code,200,response.text)
        preview=self.client.post('/service-stations/claim/preview',json={'token':response.json()['token'],'receipt':'z'*48}).json()
        self.assertEqual(preview['snapshot']['preferences']['language'],'en')
        self.assertEqual(preview['snapshot']['route'],plan['route'])
        with Session(self.engine) as db:
            self.assertEqual(db.get(StationPlan,plan['plan_id']).snapshot['preferences']['language'],'zh')


if __name__=='__main__': unittest.main()
