// Run the real uni-app page methods against an isolated uni.request/timer stub.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const source=fs.readFileSync(path.join(__dirname,'../pages/auth/auth.vue'),'utf8')
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'').replace('export default','page =')
const language=fs.readFileSync(path.join(__dirname,'../common/tour-language.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')
const words=JSON.parse(fs.readFileSync(path.join(__dirname,'../common/web-en.json'),'utf8'))
const additionalEnglish=JSON.parse(fs.readFileSync(path.join(__dirname,'../common/en.json'),'utf8'))

function page(){
  let now=1000000
  const pending=[],timers=new Map(),storage=new Map(),navigations=[]
  const uni={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key),
    request:options=>pending.push(options),setNavigationBarColor:()=>{},reLaunch:value=>navigations.push(value)}
  const context={page:null,uni,BrandLogo:{},BASE_URL:'https://backend.invalid/api/v1',DEVELOPMENT_LOGIN:false,LOGIN_PROVIDER:'password',APP_LOGIN:true,
    setAppLanguage:value=>uni.setStorageSync('zhiyou.app-language',value),webEnglish:words,additionalEnglish,Date:class extends Date{static now(){return now}},setInterval:callback=>{const id=Symbol();timers.set(id,callback);return id},
    clearInterval:id=>timers.delete(id),setTimeout:()=>{},clearTimeout:()=>{},console}
  vm.createContext(context)
  vm.runInContext(language+'\n'+script,context)
  const definition=context.page
  const state=definition.data()
  for(const [name,method] of Object.entries(definition.methods))state[name]=method.bind(state)
  state.authChecking=false;state.emailConfigured=true
  return {state,pending,timers,storage,navigations,definition,
    respond(status,data,header={}){assert.ok(pending.length,'expected a pending request');const request=pending.shift();request.success?.({statusCode:status,data,header});request.complete?.()},
    fail(){const request=pending.shift();request.fail?.({errMsg:'network timeout'});request.complete?.()},
    tick(seconds){now+=seconds*1000;for(const callback of timers.values())callback()}}
}
function fill(state){Object.assign(state,{registering:true,account:' Traveler@Example.com ',nickname:'旅行者',password:'password-12345',confirmPassword:'password-12345',emailCode:'012345'})}

test('registers via existing API, preserves leading zero, logs in and fetches profile',()=>{
  const p=page();fill(p.state);p.state.registerWithEmail()
  const request=p.pending[0]
  assert.equal(request.url,'https://backend.invalid/api/v1/user/register')
  assert.equal(request.data.email,'traveler@example.com');assert.equal(request.data.code,'012345')
  p.respond(200,{success:true})
  assert.equal(p.state.registering,false);assert.equal(p.state.confirmPassword,'');assert.equal(p.state.emailCode,'')
  assert.equal(p.pending[0].url,'https://backend.invalid/api/v1/user/login')
  p.respond(200,{access_token:'test-token'})
  assert.equal(p.state.password,'');assert.equal(p.storage.get('token'),'test-token')
  assert.equal(p.pending[0].url,'https://backend.invalid/api/v1/user/me')
  p.respond(200,{success:true,data:{user_id:8,username:'旅行者'}})
  assert.equal(p.navigations.length,1)
})
test('sending freezes duplicate requests and counts elapsed seconds',()=>{
  const p=page();fill(p.state);p.state.sendEmailCode();p.state.sendEmailCode();p.state.beginLogin();p.state.toggleRegistration()
  assert.equal(p.pending.length,1);assert.equal(p.state.registering,true)
  p.respond(200,{success:true,retry_after:60})
  assert.equal(p.state.codeRemaining,60);assert.equal(p.state.emailCode,'')
  p.tick(45);assert.equal(p.state.codeRemaining,15)
  p.tick(15);assert.equal(p.state.codeRemaining,0);assert.equal(p.timers.size,0)
})
test('honors server Retry-After without sending again',()=>{
  const p=page();fill(p.state);p.state.sendEmailCode();p.respond(429,{detail:'请等待60秒后再发送验证码'},{'Retry-After':'32'})
  assert.equal(p.state.codeRemaining,32);p.state.sendEmailCode();assert.equal(p.pending.length,0)
})
test('older backend rate limits still produce a cooldown',()=>{
  const p=page();fill(p.state);p.state.sendEmailCode();p.respond(429,{detail:'验证码请求过于频繁，请稍后再试'})
  assert.equal(p.state.codeRemaining,600)
})
test('known missing SMTP blocks sending and exposes real server detail',()=>{
  const p=page();p.state.checkAuthOptions();p.respond(200,{email_registration:{configured:false,message:'邮件未开通'}})
  p.state.sendEmailCode();assert.equal(p.pending.length,0);assert.equal(p.state.registrationMessage,'邮件未开通')
})
test('LZX backend without auth-options can still use existing registration endpoints',()=>{
  const p=page();p.state.checkAuthOptions();p.respond(404,{detail:'Not Found'})
  assert.equal(p.state.emailConfigured,null);fill(p.state);p.state.sendEmailCode()
  assert.equal(p.pending[0].url,'https://backend.invalid/api/v1/user/email-code')
})
test('real mail service failure is visible and never pretends a code was sent',()=>{
  const p=page();fill(p.state);p.state.sendEmailCode();p.respond(503,{detail:'验证码邮件服务未配置，请联系管理员'})
  assert.equal(p.state.emailConfigured,false);assert.equal(p.state.codeRemaining,0);assert.equal(p.state.codeNotice,'')
})
test('registration validates email, nickname, confirmation, code and UTF-8 password limit',()=>{
  for(const [key,value] of [['account','not-email'],['nickname','bad@name'],['nickname','x'.repeat(41)],['password','short'],['password','旅'.repeat(25)],['confirmPassword','different'],['emailCode','１２３４５６'],['emailCode','12345']]){
    const p=page();fill(p.state);p.state[key]=value;p.state.registerWithEmail()
    assert.equal(p.pending.length,0,key);assert.ok(p.state.error,key)
  }
})
test('valid long passwords follow existing backend policy',()=>{
  const p=page();fill(p.state);p.state.password=p.state.confirmPassword='x'.repeat(40);p.state.registerWithEmail()
  assert.equal(p.pending.length,1)
})

test('Unicode passwords and nicknames follow backend character and byte limits',()=>{
  const short=page();fill(short.state);short.state.password='😀'.repeat(4);short.state.confirmPassword=short.state.password
  short.state.registerWithEmail();assert.equal(short.pending.length,0);assert.ok(short.state.error)
  const valid=page();fill(valid.state);valid.state.nickname='😀'.repeat(21);valid.state.password='😀'.repeat(8);valid.state.confirmPassword=valid.state.password
  valid.state.registerWithEmail();assert.equal(valid.pending.length,1)
  const invalid=page();fill(invalid.state);invalid.state.password='password\ud800';invalid.state.confirmPassword=invalid.state.password
  assert.doesNotThrow(()=>invalid.state.registerWithEmail());assert.equal(invalid.pending.length,0)
})
test('failed registration keeps the user in the registration form',()=>{
  const p=page();fill(p.state);p.state.registerWithEmail();p.respond(400,{detail:'验证码错误'})
  assert.equal(p.state.registering,true);assert.equal(p.state.error,'验证码错误');assert.equal(p.state.logining,false)
})
test('automatic login failure after registration can be retried without registering twice',()=>{
  const p=page();fill(p.state);p.state.registerWithEmail();p.respond(200,{success:true});p.fail()
  assert.equal(p.state.registering,false);assert.match(p.state.codeNotice,/注册成功/)
  p.state.beginLogin();assert.match(p.pending[0].url,/\/user\/login$/)
})
test('unloading clears timers and ignores late code responses',()=>{
  const p=page();fill(p.state);p.state.sendEmailCode();p.respond(200,{success:true,retry_after:60})
  p.definition.onUnload.call(p.state);assert.equal(p.timers.size,0)
  const late=page();fill(late.state);late.state.sendEmailCode();late.definition.onUnload.call(late.state);late.respond(200,{success:true})
  assert.equal(late.timers.size,0);assert.equal(late.state.codeNotice,'')
})
test('App does not fall into WeChat login when a saved provider has no token',()=>{
  const p=page();p.storage.set('login_provider','password');p.definition.onLoad.call(p.state)
  assert.equal(p.pending.length,1);assert.match(p.pending[0].url,/auth-options$/)
})
test('switching modes keeps login and registration accounts separate',()=>{
  const p=page();p.state.account='my-nickname';p.state.toggleRegistration();assert.equal(p.state.account,'')
  p.state.account='user@example.com';p.state.toggleRegistration();assert.equal(p.state.account,'my-nickname')
  p.state.toggleRegistration();assert.equal(p.state.account,'user@example.com')
})
test('changing the registration email invalidates displayed old code',()=>{
  const p=page();fill(p.state);p.definition.watch.account.call(p.state,'new@example.com','old@example.com')
  assert.equal(p.state.emailCode,'')
})
test('App registration notices and countdown support English without Web edits',()=>{
  const p=page();p.state.setTourLanguage('en')
  assert.equal(p.state.t('发送验证码'),'Send code');assert.equal(p.state.t('{seconds}秒后重发',{seconds:22}),'Resend in 22s')
  assert.equal(p.storage.get('zhiyou.app-language'),'en')
})
