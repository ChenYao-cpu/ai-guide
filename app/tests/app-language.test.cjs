const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { root, dependency, translator } = require('./test-tools.cjs')
const { JSDOM } = dependency('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'https://app.invalid' })
for (const name of ['window','document','Element','HTMLElement','SVGElement','Node','Event']) global[name] = dom.window[name]
const Vue = dependency('vue'), { parse } = dependency('@vue/compiler-sfc'), { compile } = dependency('@vue/compiler-dom')
const translateTour = translator(), storage = new Map(), feedback = [], pending = [], navigations = []
const uni = {
  getStorageSync:key => storage.get(key), setStorageSync:(key,value) => storage.set(key,value),
  showToast:options => feedback.push(options), showModal:options => feedback.push(options),
  showActionSheet:options => feedback.push(options), showLoading:options => feedback.push(options),
  getSystemInfoSync:() => ({statusBarHeight:20}), setNavigationBarTitle:options => feedback.push(options),
  hideKeyboard:()=>{},
  removeStorageSync:key=>storage.delete(key),request:options=>pending.push(options),navigateTo:options=>navigations.push(options),
  reLaunch:options=>navigations.push(options),
}
const context = { ref:Vue.ref, uni, translateTour, LANGUAGE_STORAGE_KEY:'zhiyou.app-language' }
vm.createContext(context)
vm.runInContext(fs.readFileSync(path.join(root,'common/i18n.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,''), context)
const localization = vm.runInContext('({appLanguage,setAppLanguage,t,installAppI18n,uiToast,uiModal,uiActionSheet,uiLoading,formatAppDate})', context)
const planningSource = fs.readFileSync(path.join(root,'common/planning-language.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')
vm.runInContext(planningSource,context)
const { planningMessage, recommendationText,questionLanguage,findQuestionSpot } = vm.runInContext('({planningMessage,recommendationText,questionLanguage,findQuestionSpot})',context)

const components = {}
function definition(relative) {
  const source = fs.readFileSync(path.join(root,relative),'utf8').replace(/<script\b[^>]*\blang="renderjs"[^>]*>[\s\S]*?<\/script>/g,'')
  const { descriptor } = parse(source)
  const deps = { ...localization, translateTour, planningMessage, recommendationText, questionLanguage,findQuestionSpot,uni,
    LANGUAGE_STORAGE_KEY:'zhiyou.app-language',BASE_URL:'https://backend.invalid/api/v1',
    APP_LOGIN:true,DEVELOPMENT_LOGIN:false,LOGIN_PROVIDER:'password',assetUrl:value=>value,
    wgs84ToGcj02:(a,b)=>[a,b],gcj02ToWgs84:(a,b)=>[a,b],prioritizeSummerPalace:items=>items,
    BrandLogo:components.BrandLogo,NocturneConfirm:components.NocturneConfirm,NocturneSelect:components.NocturneSelect,
    TourXingyun:{render:()=>null},TourXfyun:{render:()=>null},ChatVoice:{render:()=>null},
  }
  const script = descriptor.script.content.replace(/^import .*$/gm,'').replace('export default','const page =')
  const page = new Function(...Object.keys(deps),script+'\nreturn page')(...Object.values(deps))
  page.render = new Function('Vue',compile(descriptor.template.content,{
    mode:'function',isCustomElement:tag=>/^(view|text|scroll-view|map|picker|swiper|swiper-item|web-view|live-player|page-meta|tour-avatar-3d)$/.test(tag),
  }).code)(Vue)
  return page
}
components.BrandLogo = definition('components/BrandLogo.vue')
components.NocturneConfirm = definition('components/NocturneConfirm.vue')
components.NocturneSelect = definition('components/NocturneSelect.vue')
const mounted = []
function mount(relative, extra = {}) {
  const page = definition(relative), host = document.createElement('div')
  document.body.append(host)
  // Lifecycle/network/device access is tested separately; mount the real UI,
  // data, computed values and methods with uni-app native tags represented in DOM.
  const app = Vue.createApp({data:()=>({...page.data?.(),...extra}),computed:page.computed,
    methods:page.methods,components:page.components,render:page.render})
  localization.installAppI18n(app)
  app.config.warnHandler = message => { if (!message.includes('was accessed during render but is not defined')) throw new Error(message) }
  const state = app.mount(host)
  mounted.push({app,host})
  return { state, host }
}
function cleanup() { for(const {app,host} of mounted.splice(0)){app.unmount();host.remove()} }
const spot = {spot_id:7,spot_name:'万寿山',city:'北京',category:'historical',description:'历史文化',visit_duration:20,latitude:39.99,longitude:116.27}

test('one language switch updates all 10 mounted App pages, tabs, dialogs and placeholders',async()=>{
  localization.setAppLanguage('zh')
  const cases = [
    ['pages/auth/auth.vue',{registering:true,emailConfigured:true,authChecking:false},'Register and sign in'],
    ['pages/tour-guide/tour-guide.vue',{loading:false,spots:[spot]},'Choose places'],
    ['pages/ai-chat/ai-chat.vue',{},'Which place would you like to learn about?'],
    ['pages/mine/mine.vue',{showPrefs:true,showLogout:true},'Interface language'],
    ['pages/mine/history.vue',{list:[]},'No tours yet.'],
    ['pages/favorites/favorites.vue',{loading:false,list:[],detailSpot:spot},'My favorites'],
    ['pages/rank/rank.vue',{title:'景点图鉴',loading:false,spots:[spot],detailSpot:spot},'Place gallery'],
    ['pages/tour/tour.vue',{spotCards:[spot],guideName:'导游',showEndConfirm:true},'End this tour?'],
    ['pages/tour-summary/tour-summary.vue',{loading:false,sessionData:{name:'My tour',guide_info:{name:'导游'},status:{start_time:'2026-10-17T10:00:00Z',end_time:'2026-10-17T10:20:00Z'}},spots:[spot],preferences:['历史文化']},'Tour review'],
    ['pages/xingyun/xingyun.vue',{},'Back to tour'],
  ]
  try {
    const pages = cases.map(([file,data])=>mount(file,data))
    assert.match(pages[0].host.textContent,/注册并登录/)
    pages[0].state.setTourLanguage('en');await Vue.nextTick()
    assert.equal(storage.get('zhiyou.app-language'),'en')
    for(let i=0;i<cases.length;i++){
      assert.ok(pages[i].host.textContent.includes(cases[i][2]),cases[i][0]+': '+pages[i].host.textContent)
      const visible = pages[i].host.textContent.replaceAll('中文','')
      assert.doesNotMatch(visible,/[\u3400-\u9fff]/,cases[i][0]+': untranslated visible text')
      for(const input of pages[i].host.querySelectorAll('[placeholder]')) assert.doesNotMatch(input.getAttribute('placeholder'),/[\u3400-\u9fff]/,cases[i][0]+': placeholder')
    }
    assert.ok(pages[1].host.textContent.includes('Longevity Hill'))
    assert.equal(pages[7].state.tourLanguage,'en')
    assert.equal(pages[3].state.tourLanguage,'en')
    const field=pages[1].host.querySelector('input')
    assert.equal(field.getAttribute('placeholder'),'Search places or cities')
    pages[3].state.setTourLanguage('zh');await Vue.nextTick()
    assert.match(pages[0].host.textContent,/注册并登录/)
    assert.match(pages[1].host.textContent,/景点选择/)
  } finally {cleanup()}
})

test('profile names and conversation content are preserved while the surrounding interface changes',async()=>{
  localization.setAppLanguage('en')
  try {
    const mine=mount('pages/mine/mine.vue',{username:'历史文化'})
    const chat=mount('pages/ai-chat/ai-chat.vue',{msgs:[{role:'user',content:'历史文化'},{role:'ai',content:'An original answer'}]})
    const history=mount('pages/mine/history.vue',{selected:{name:'我的旅行'},messages:[{role:'user',message:'历史文化',send_time:'2026-10-17T10:00:00Z'}]})
    assert.match(mine.host.textContent,/历史文化/)
    assert.match(chat.host.textContent,/历史文化/)
    assert.match(history.host.textContent,/历史文化/)
    assert.match(history.host.textContent,/Conversation/)
  } finally {cleanup()}
})

test('native dialogs, action sheets and asynchronous notifications use current language without losing callbacks',()=>{
  feedback.length=0;const success=()=>{}
  localization.setAppLanguage('en')
  localization.uiModal({title:'退出登录',content:'确定要退出登录吗？',success})
  localization.uiActionSheet({itemList:['拍照识景','从相册选择'],success})
  localization.uiToast({title:'已选中3个景点',icon:'success',success})
  localization.uiLoading({title:'加载中...'})
  assert.equal(feedback[0].content,'Log out of your account?')
  assert.equal(feedback[0].confirmText,'OK');assert.equal(feedback[0].cancelText,'Cancel')
  assert.equal(feedback[1].itemList.join('|'),'Take a photo|Choose from photos')
  assert.equal(feedback[2].title,'Selected 3 places')
  assert.equal(feedback[3].title,'Loading…')
  for(const result of feedback.slice(0,3))assert.equal(result.success,success)
  localization.setAppLanguage('zh');localization.uiToast({title:'已取消收藏'})
  assert.equal(feedback.at(-1).title,'已取消收藏')
})

test('English scenic search and map callouts use translated public catalog fields',async()=>{
  localization.setAppLanguage('en')
  try {
    const {state}=mount('pages/tour-guide/tour-guide.vue',{spots:[spot],loading:false,keyword:'longevity'})
    assert.equal(state.filteredSpots.length,1)
    assert.equal(state.mapMarkers[0].title,'Longevity Hill')
    state.keyword='BEIJING';await Vue.nextTick();assert.equal(state.filteredSpots.length,1)
    state.keyword='万寿山';await Vue.nextTick();assert.equal(state.filteredSpots.length,1)
    assert.equal(spot.spot_name,'万寿山');assert.equal(spot.category,'historical')
  } finally {cleanup()}
})

test('in-App selection panels translate every option, preserve values and cancel without changes',async()=>{
  localization.setAppLanguage('en')
  try {
    const planner=mount('pages/tour-guide/tour-guide.vue',{tab:'personal',loading:false,optionPicker:'budget',budgetIndex:2,pickedPrefs:['history']})
    assert.match(planner.host.textContent,/Time available/)
    assert.equal(planner.host.querySelectorAll('.select-option').length,6)
    assert.equal(planner.host.querySelector('.select-option.selected').textContent,'120 min✓')
    assert.doesNotMatch(planner.host.querySelector('.select-panel').textContent,/[\u3400-\u9fff]/)
    planner.host.querySelector('.select-option').dispatchEvent(new Event('tap',{bubbles:true}))
    await Vue.nextTick();assert.equal(planner.state.budgetIndex,0);assert.equal(planner.state.optionPicker,'')
    planner.state.optionPicker='pace';await Vue.nextTick()
    assert.match(planner.host.querySelector('.select-panel').textContent,/Relaxed pace · Fewer steps/)
    planner.host.querySelector('.select-cancel').dispatchEvent(new Event('tap',{bubbles:true}))
    await Vue.nextTick();assert.equal(planner.state.paceIndex,0);assert.equal(planner.state.optionPicker,'')
    assert.equal(planner.state.pickedPrefs[0],'history')
    const chat=mount('pages/ai-chat/ai-chat.vue')
    let selected='';chat.state.openScenicSource=source=>{selected=source}
    chat.state.chooseScenicPhoto();await Vue.nextTick()
    assert.match(chat.host.querySelector('.select-panel').textContent,/Take a photoChoose from photosCancel/)
    chat.host.querySelectorAll('.select-option')[1].dispatchEvent(new Event('tap',{bubbles:true}))
    await Vue.nextTick();assert.equal(selected,'album');assert.equal(chat.state.showPhotoChoices,false)
  } finally {cleanup()}
})

test('English planning requests retain time, city, preferences and negation with the LZX keyword planner',()=>{
  const message=planningMessage('A relaxed 2-hour family nature tour in Beijing, no photography')
  assert.match(message,/2小时/);assert.match(message,/亲子孩子/);assert.match(message,/自然风光/)
  assert.match(message,/北京/);assert.match(message,/不想拍照/);assert.match(message,/轻松/)
  assert.match(planningMessage('Half-day history at the Summer Palace'),/半天.*历史文化.*北京颐和园/)
  assert.equal(planningMessage('历史文化，带孩子玩90分钟'),'历史文化，带孩子玩90分钟')
  const result={spot_ids:[7,8],spot_names:['万寿山','昆明湖'],estimated_time_minutes:90,ai_response:'中文模型说明'}
  const before=JSON.stringify(result)
  const text=recommendationText(result,'en')
  assert.match(text,/Longevity Hill → Kunming Lake/);assert.match(text,/90 min/);assert.doesNotMatch(text,/[\u3400-\u9fff]/)
  assert.equal(JSON.stringify(result),before)
  assert.equal(recommendationText(result,'zh'),'中文模型说明')
})

test('AI route preview uses server duration and walking legs without local straight-line estimates',()=>{
  localization.setAppLanguage('en')
  try {
    const {state}=mount('pages/ai-chat/ai-chat.vue',{recommendSpots:[spot,{...spot,spot_id:8}],recommendedPlan:{estimated_time_minutes:90,score_details:[{spot_id:7},{spot_id:8,walk_from_previous_meters:345,walk_from_previous_minutes:6}]}})
    assert.equal(state.totalDuration,90)
    assert.equal(state.walkText({spot_id:7},{spot_id:8}),'345 m / 6 min')
    assert.equal(state.walkText({spot_id:8},{spot_id:7}),'Walking data unavailable')
    state.recommendedPlan=null;assert.equal(state.totalDuration,null)
  }finally{cleanup()}
})

test('AI handoff preserves server stop order, custom time budget and pace when creating a tour',async()=>{
  localization.setAppLanguage('en');pending.length=0;navigations.length=0
  const plan={spot_ids:[8,7],spot_count:2,preferences:['nature'],requested_time_minutes:150,estimated_time_minutes:90,pace:'relaxed',start_area:'east',avoid_steps:true}
  storage.set('ai_spot_ids',JSON.stringify(plan.spot_ids));storage.set('ai_route_plan',JSON.stringify(plan))
  try{
    const {state}=mount('pages/tour-guide/tour-guide.vue',{spots:[spot,{...spot,spot_id:8}],loading:false})
    state.restoreAISelection()
    assert.equal(state.tab,'personal');assert.equal(state.budgetOptions[state.budgetIndex],150);assert.equal(state.paceIndex,1)
    assert.deepEqual(Array.from(state.personalPlan.spot_ids),[8,7]);assert.deepEqual(Array.from(state.pickedPrefs),['nature'])
    assert.equal(storage.has('ai_route_plan'),false)
    state.pickedGuide={guide_id:1};state.startTour();state.startTour()
    assert.equal(pending.length,1,'duplicate start must not create another session')
    const request=pending.shift(),url=new URL(request.url)
    assert.equal(url.pathname,'/api/v1/tour-session/visitor-create')
    assert.deepEqual(JSON.parse(url.searchParams.get('spot_ids')),[8,7])
    const options=JSON.parse(url.searchParams.get('planning'))
    assert.equal(options.time_budget_minutes,150);assert.equal(options.pace,'relaxed');assert.equal(options.start_area,'east');assert.equal(options.avoid_steps,true)
    request.success({statusCode:200,data:{success:true,data:{session_id:71}}})
    await new Promise(resolve=>setImmediate(resolve))
    pending.shift().success({statusCode:200,data:{success:true}})
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(navigations[0].url,'/pages/tour/tour?sessionId=71');assert.equal(state.startingTour,false)
  }finally{cleanup()}
})

test('curated routes retain their configured order, and stale AI selections are rejected',()=>{
  localization.setAppLanguage('en');pending.length=0
  try{
    const {state}=mount('pages/tour-guide/tour-guide.vue',{tab:'personal',spots:[spot,{...spot,spot_id:8}],routes:[{route_id:3,spot_ids:[8,7]}],pickedRouteId:3,pickedIds:{7:true,8:true},pickedGuide:{guide_id:1}})
    state.startTour()
    const url=new URL(pending.shift().url)
    assert.deepEqual(JSON.parse(url.searchParams.get('spot_ids')),[8,7]);assert.equal(url.searchParams.get('route_id'),'3');assert.equal(url.searchParams.has('planning'),false)
    storage.set('ai_route_plan',JSON.stringify({spot_ids:[999],preferences:['history']}))
    const previous=JSON.stringify(state.pickedIds);state.restoreAISelection()
    assert.equal(JSON.stringify(state.pickedIds),previous)
    assert.equal(feedback.at(-1).title,'Some recommended places are unavailable. Please plan again.')
  }finally{pending.length=0;cleanup()}
})

test('translation resolves dynamic errors, progress, distances and public catalog chains',()=>{
  assert.equal(translateTour('正在加载数字人 73%','en'),'Loading the guide 73%')
  assert.equal(translateTour('服务请求失败（HTTP 503）','en'),'Service request failed (HTTP 503)')
  assert.equal(translateTour('约 230 米（直线距离）','en'),'About 230 m (straight line)')
  assert.equal(translateTour('万寿山 → 昆明湖','en'),'Longevity Hill → Kunming Lake')
  assert.equal(translateTour('用户自己写的内容','en'),'用户自己写的内容')
})

test('guide questions use the existing English dialogue API and reuse the question session',async()=>{
  localization.setAppLanguage('en');pending.length=0;storage.set('user_id',17)
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue',{chatMode:'guide',qaSpots:[spot],qaGuides:[{guide_id:1}],qaSpotId:7,text:'Tell me about Longevity Hill.'})
    state.playTTS=()=>{};state.sendText()
    await new Promise(resolve=>setImmediate(resolve))
    const create=pending.shift();assert.match(create.url,/visitor-create/)
    create.success({statusCode:200,data:{success:true,data:{session_id:72}}})
    await new Promise(resolve=>setImmediate(resolve))
    const chat=pending.shift();assert.match(chat.url,/\/tour-session\/chat$/);assert.equal(chat.method,'PUT')
    assert.equal(chat.data.language,'en');assert.equal(chat.data.currentSpotId,7);assert.equal(chat.data.text_only,true)
    assert.equal(chat.data.message,'Tell me about Longevity Hill.')
    chat.success({statusCode:200,data:{success:true,data:{message:'Longevity Hill is part of the Summer Palace.',language:'en'}}})
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(state.msgs.at(-1).content,'Longevity Hill is part of the Summer Palace.')
    state.text='Tell me more about its history.';state.sendText()
    await new Promise(resolve=>setImmediate(resolve))
    const followup=pending.shift();assert.match(followup.url,/\/chat$/);assert.equal(followup.data.sessionId,72)
    followup.success({statusCode:200,data:{success:true,data:{message:'Here is the history.',language:'en'}}})
    await new Promise(resolve=>setImmediate(resolve));assert.equal(state.loading,false)
  }finally{pending.length=0;storage.clear();cleanup()}
})

test('clearing chat ignores a late recommendation and its route cache',async()=>{
  localization.setAppLanguage('en');pending.length=0
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue',{chatMode:'route',text:'Plan a 2-hour nature tour'})
    state.playTTS=()=>{};state.sendText();const old=pending.shift();state.clearHistory()
    old.success({statusCode:200,data:{success:true,data:{spot_ids:[7],spot_names:['万寿山'],estimated_time_minutes:60}}})
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(state.msgs.length,0);assert.equal(state.lastSpotIds.length,0);assert.equal(storage.has('ai_route_plan'),false)
  }finally{pending.length=0;storage.clear();cleanup()}
})

test('a new recommendation without stops removes the previous actionable route',async()=>{
  localization.setAppLanguage('en');pending.length=0
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue',{chatMode:'route',text:'Try another route',lastSpotIds:[7],recommendedPlan:{spot_ids:[7]},recommendSpots:[spot]})
    state.playTTS=()=>{};state.sendText()
    pending.shift().success({statusCode:200,data:{success:true,data:{spot_ids:[],spot_names:[],ai_response:'No matching route'}}})
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(state.lastSpotIds.length,0);assert.equal(state.recommendedPlan,null)
  }finally{pending.length=0;storage.clear();cleanup()}
})

test('local AI conversations are isolated by account and the composer accepts long questions',()=>{
  localization.setAppLanguage('en');storage.clear()
  try{
    storage.set('user_id',17)
    const {state,host}=mount('pages/ai-chat/ai-chat.vue',{msgs:[{role:'user',content:'Private account A question'}]})
    state.saveHistory();storage.set('user_id',18);state.loadHistory()
    assert.equal(state.msgs.length,0)
    storage.set('user_id',17);state.loadHistory();assert.equal(state.msgs[0].content,'Private account A question')
    assert.equal(host.querySelector('.msg-input').getAttribute('maxlength'),'2000')
  }finally{storage.clear();cleanup()}
})

test('English question intent and named places work even when the interface is Chinese',()=>{
  assert.equal(questionLanguage('Tell me about Kunming Lake.','zh'),'en')
  assert.equal(questionLanguage('介绍昆明湖','zh'),'zh')
  assert.equal(questionLanguage('介绍昆明湖','en'),'en')
  const lake={...spot,spot_id:8,spot_name:'昆明湖'}
  assert.equal(findQuestionSpot('Tell me about KUNMING LAKE.',[spot,lake],7).spot_id,8)
  assert.equal(findQuestionSpot('Tell me more.',[spot,lake],7).spot_id,7)
  assert.equal(findQuestionSpot('Tell me more.',[spot,lake],null),null)
})

test('questions without a selected or named place ask for context and preserve the draft',async()=>{
  localization.setAppLanguage('en');pending.length=0
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue',{qaSpots:[spot],qaGuides:[{guide_id:1}],text:'Tell me more.'})
    await state.sendText()
    assert.equal(pending.length,0);assert.equal(state.msgs.length,0);assert.equal(state.text,'Tell me more.')
    assert.equal(state.showQASpots,true);assert.equal(state.loading,false)
  }finally{storage.clear();cleanup()}
})

test('ASR responses arriving after clear do not send another question',async()=>{
  localization.setAppLanguage('en');pending.length=0
  const handlers={};let upload
  uni.getRecorderManager=()=>({onStart:fn=>handlers.start=fn,onStop:fn=>handlers.stop=fn,onError:fn=>handlers.error=fn,stop:()=>{}})
  uni.uploadFile=options=>{upload=options}
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue');state.initRecorder()
    handlers.stop({tempFilePath:'/recording.mp3',duration:1000})
    assert.equal(state.transcribing,true);state.clearHistory()
    upload.success({statusCode:200,data:JSON.stringify({success:true,data:'Tell me about Kunming Lake.'})});upload.complete()
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(pending.length,0);assert.equal(state.msgs.length,0);assert.equal(state.transcribing,false)
  }finally{delete uni.uploadFile;delete uni.getRecorderManager;pending.length=0;storage.clear();cleanup()}
})

test('an expired guide conversation creates one replacement session before retrying',async()=>{
  localization.setAppLanguage('en');pending.length=0
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue',{qaSpots:[spot],qaGuides:[{guide_id:1}],qaSpotId:7,qaSession:{session_id:71,guide_id:1},text:'Tell me about Longevity Hill.'})
    state.playTTS=()=>{};state.sendText();await new Promise(resolve=>setImmediate(resolve))
    pending.shift().success({statusCode:200,data:{success:false,message:'本次导览已结束，请返回重新规划'}})
    await new Promise(resolve=>setImmediate(resolve));const create=pending.shift();assert.match(create.url,/visitor-create/)
    create.success({statusCode:200,data:{success:true,data:{session_id:72}}})
    await new Promise(resolve=>setImmediate(resolve));const retry=pending.shift();assert.equal(retry.data.sessionId,72)
    retry.success({statusCode:200,data:{success:true,data:{message:'Here is your English answer.'}}})
    await new Promise(resolve=>setImmediate(resolve));assert.equal(state.msgs.at(-1).content,'Here is your English answer.');assert.equal(pending.length,0)
  }finally{pending.length=0;storage.clear();cleanup()}
})

test('clearing a route cancels its delayed navigation',async()=>{
  localization.setAppLanguage('en');navigations.length=0
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue',{chatMode:'route',lastSpotIds:[7]})
    state.applyRecommend();state.clearHistory()
    await new Promise(resolve=>setTimeout(resolve,550))
    assert.equal(navigations.length,0)
  }finally{storage.clear();cleanup()}
})

test('composer layout follows measured keyboard height and does not jump on focus or blur',()=>{
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue')
    state.onInputFocus();assert.equal(state.keyboardVisible,false)
    state.updateKeyboardHeight(280);assert.equal(state.keyboardVisible,true)
    state.onInputBlur();assert.equal(state.keyboardVisible,true)
    state.updateKeyboardHeight(0);assert.equal(state.keyboardVisible,false)
  }finally{cleanup()}
})

test('expired authentication returns to login instead of keeping an unusable chat token',async()=>{
  localization.setAppLanguage('en');pending.length=0;navigations.length=0;storage.set('token','expired')
  try{
    const {state}=mount('pages/ai-chat/ai-chat.vue',{chatMode:'route',text:'Plan a route'})
    state.sendText();pending.shift().success({statusCode:401,data:{detail:'Token expired'}})
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(storage.has('token'),false);assert.equal(navigations[0].url,'/pages/auth/auth')
  }finally{pending.length=0;storage.clear();cleanup()}
})
