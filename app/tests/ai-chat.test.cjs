const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const root=path.resolve(__dirname,'..'),tick=()=>new Promise(r=>setImmediate(r)),plain=x=>JSON.parse(JSON.stringify(x))
function harness(){
 const calls=[],uploads=[],feedback=[],navigations=[],storage=new Map([['user_id',17],['token','mock-17']]),handlers={}
 const uni={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),request:o=>{calls.push(o);return{abort(){}}},uploadFile:o=>{uploads.push(o);return{abort(){}}},showToast:o=>feedback.push(o),reLaunch:o=>navigations.push(o),getRecorderManager:()=>({onStart:fn=>handlers.start=fn,onStop:fn=>handlers.stop=fn,onError:fn=>handlers.error=fn,stop(){},start(){}})}
 const translateTour=(s,language,params={})=>String(s??'').replace(/\{(\w+)\}/g,(m,k)=>params[k]??m)
 const c={uni,console,Promise,Date,Set,Number,Math,JSON,Array,Object,String,setTimeout,clearTimeout,BASE_URL:'http://local/api/v1',ChatVoice:{},NocturneSelect:{},TabBarNav:{},translateTour,LANGUAGE_STORAGE_KEY:'zhiyou.app-language',assetUrl:x=>x,uiToast:o=>feedback.push(o)}
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'common/planning-language.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,''),c)
 const source=fs.readFileSync(path.join(root,'pages/ai-chat/ai-chat.vue'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
 vm.runInContext(source.replace(/^import .*$/gm,'').replace('export default','globalThis.component='),c)
 const o=c.component,s={tourLanguage:'en',$t:(value,params)=>translateTour(value,'en',params),t:(value,params)=>translateTour(value,'en',params),$nextTick:fn=>fn()};Object.assign(s,o.data.call(s));for(const [k,f] of Object.entries(o.methods))s[k]=f.bind(s)
 for(const [k,f] of Object.entries(o.computed||{}))Object.defineProperty(s,k,{get:()=>f.call(s),configurable:true})
 s.playTTS=()=>{};o.onShow?.call(s)
 return{s,o,uni,calls,uploads,feedback,navigations,storage,handlers,reply(call,data){call.success({statusCode:200,data:{success:true,data}})}}
}
const spots=[{spot_id:7,spot_name:'万寿山',city:'北京'},{spot_id:8,spot_name:'昆明湖',city:'北京'}],guide={guide_id:2,is_enabled:true}
test('ordinary scenic questions use chat with language and retain the same conversation',async()=>{
 const h=harness(),s=h.s;assert.equal(s.chatMode,'guide');s.qaSpots=spots;s.qaGuides=[guide];s.qaSpotId=7;s.text='What is its history?'
 const run=s.sendText();await tick();assert.match(h.calls[0].url,/visitor-create/);h.reply(h.calls.shift(),{session_id:70});await tick()
 let ask=h.calls.shift();assert.match(ask.url,/\/tour-session\/chat$/);assert.equal(ask.data.language,'en');assert.equal(ask.data.currentSpotId,7);h.reply(ask,{message:'History answer'});await run
 s.text='Tell me more.';const follow=s.sendText();await tick();ask=h.calls.shift();assert.equal(ask.data.sessionId,70);h.reply(ask,{message:'More history'});await follow;assert.equal(s.msgs.at(-1).content,'More history')
})
test('route preview uses server totals and consecutive walking data',async()=>{
 const h=harness(),s=h.s;s.chatMode='route';s.text='A two hour nature tour';const run=s.sendText();await tick();assert.match(h.calls[0].url,/ai-chat-recommend/)
 h.reply(h.calls.shift(),{spot_ids:[7,8],estimated_time_minutes:91,total_duration:999,score_details:[{spot_id:7},{spot_id:8,walk_from_previous_meters:345,walk_from_previous_minutes:6}],ai_response:'Route'});await run
 assert.equal(s.totalDuration,91);assert.match(s.walkText(spots[0],spots[1]),/345.*6/);assert.doesNotMatch(s.walkText(spots[1],spots[0]),/345/)
})
test('clear ignores late text and catalog responses, including route cache and delayed apply',async()=>{
 const h=harness(),s=h.s;s.chatMode='route';s.text='Plan a trip';const run=s.sendText();const old=h.calls.shift();s.clearHistory();h.reply(old,{spot_ids:[7],estimated_time_minutes:90,ai_response:'Old'});await run
 assert.equal(s.msgs.length,0);assert.equal(s.lastSpotIds.length,0);assert.equal(h.storage.has('ai_spot_ids'),false)
 s.lastSpotIds=[7];s.applyRecommend();s.clearHistory();await new Promise(r=>setTimeout(r,550));assert.equal(h.navigations.length,0)
})
test('clear ignores a late photo and never sends its follow-up question',async()=>{
 const h=harness(),s=h.s;s.pendingPhoto='/photo.jpg';s.text='Where is this?';const run=s.sendPhoto();const upload=h.uploads.shift();s.clearHistory();upload.success({statusCode:200,data:JSON.stringify({success:true,data:{status:'candidate',spot_id:7,spot_name:'万寿山'}})});upload.complete?.();await run;assert.equal(s.msgs.length,0);assert.equal(s.pendingPhoto,'');assert.equal(h.calls.length,0)
})
test('clear ignores late speech recognition and does not auto-send old questions',async()=>{
 const h=harness(),s=h.s;s.initRecorder();h.handlers.stop({tempFilePath:'/speech.mp3',duration:1000});const upload=h.uploads.shift();s.clearHistory();upload.success({statusCode:200,data:JSON.stringify({success:true,data:'old question'})});upload.complete();await tick();assert.equal(h.calls.length,0);assert.equal(s.text,'');assert.equal(s.transcribing,false)
})
test('account-scoped state restores mode, context and route preview without mixing users',()=>{
 const h=harness(),s=h.s;s.chatMode='route';s.qaSpotId=7;s.qaSession={session_id:70,guide_id:2};s.msgs=[{role:'user',content:'Private A'}];s.recommendedPlan={spot_ids:[7,8],estimated_time_minutes:91};s.saveHistory()
 h.storage.set('user_id',18);h.storage.set('token','mock-18');s.loadHistory();assert.equal(s.msgs.length,0);assert.equal(s.qaSession,null);assert.equal(s.lastSpotIds.length,0)
 s.msgs=[{role:'user',content:'Private B'}];s.saveHistory();h.storage.set('user_id',17);h.storage.set('token','mock-17');s.loadHistory();assert.equal(s.msgs[0].content,'Private A');assert.equal(s.chatMode,'route');assert.equal(s.qaSession.session_id,70);assert.deepEqual(plain(s.lastSpotIds),[7,8]);assert.equal(s.totalDuration,91)
})
test('input accepts 2000 characters and rejects an overlong programmatic send',async()=>{
 const h=harness(),s=h.s;assert.match(fs.readFileSync(path.join(root,'pages/ai-chat/ai-chat.vue'),'utf8'),/:maxlength="2000"/)
 s.text='a'.repeat(2001);await s.sendText();assert.equal(h.calls.length,0);assert.equal(s.msgs.length,0);assert.equal(h.feedback.length,1)
 s.chatMode='route';s.text='a'.repeat(2000);const run=s.sendText();assert.equal(h.calls.length,1);h.reply(h.calls.shift(),{spot_ids:[],ai_response:'OK'});await run;assert.equal(s.msgs[0].content.length,2000)
})
test('switching accounts during a question ignores its reply and does not overwrite the other history',async()=>{
 const h=harness(),s=h.s;s.chatMode='route';s.text='Account A question';const run=s.sendText(),old=h.calls.shift();h.storage.set('user_id',18);h.storage.set('token','mock-18');s.loadHistory();s.msgs=[{role:'user',content:'Account B'}];s.saveHistory();h.reply(old,{spot_ids:[7],estimated_time_minutes:91,ai_response:'Old A reply'});await run;assert.equal(s.msgs.length,1);assert.equal(s.msgs[0].content,'Account B');assert.equal(s.lastSpotIds.length,0)
})
test('a photo picker returning after clear cannot restore the discarded draft',()=>{
 const h=harness(),s=h.s;let picker;h.uni.chooseImage=options=>{picker=options};s.pickScenicImage('album');s.clearHistory();picker.success({tempFilePaths:['/old-photo.jpg']});assert.equal(s.pendingPhoto,'')
})
