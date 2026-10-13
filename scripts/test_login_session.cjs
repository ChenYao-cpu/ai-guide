const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const text=fs.readFileSync('miniprogram/pages/auth/auth.vue','utf8').split('<script>')[1].split('</script>')[0].replace(/^import .*$/gm,'').replace('export default','globalThis.component=');
function setup(values,respond){const store=new Map(Object.entries(values));const calls=[];const uni={getStorageSync:k=>store.get(k),setStorageSync:(k,v)=>store.set(k,v),removeStorageSync:k=>store.delete(k),reLaunch:o=>calls.push(o.url),request:respond,login:o=>o.success({code:'test-code'})};const ctx={BrandLogo:{},setTimeout,clearTimeout,console,uni,BASE_URL:'http://test',DEVELOPMENT_LOGIN:false,LOGIN_PROVIDER:'weixin',APP_LOGIN:false};vm.runInNewContext(text,ctx);const page=ctx.component.data();Object.assign(page,ctx.component.methods);return {page,store,calls,ctx,load:()=>ctx.component.onLoad.call(page)}}
let t=setup({token:'cached',login_provider:'weixin'},o=>o.success({statusCode:200,data:{success:true,data:{user_id:1,username:'游客',avatar:'/files/avatar.png'}}}));t.load();assert.equal(t.calls[0],'/pages/tour-guide/tour-guide');assert.equal(t.page.showProfileDialog,false);
t=setup({token:'expired',login_provider:'weixin'},o=>o.url.endsWith('/me')?o.success({statusCode:401}):o.success({statusCode:200,data:{success:true,data:{access_token:'renewed',user_id:1,username:'游客',avatar:'/files/avatar.png',profile_completed:true}}}));t.load();assert.equal(t.store.get('token'),'renewed');assert.equal(t.page.showProfileDialog,false);assert.equal(t.calls.length,1);
t=setup({token:'cached',login_provider:'weixin'},o=>o.fail({errMsg:'request:fail timeout'}));t.load();assert.equal(t.store.get('token'),'cached');assert.equal(t.calls.length,0);assert.equal(t.page.logining,false);
t=setup({token:'cached',login_provider:'weixin',login_auto_disabled:true},()=>assert.fail('logout must not auto-login'));t.load();assert.equal(t.calls.length,0);
t=setup({},o=>o.success({statusCode:200,data:{success:true,data:{access_token:'new',user_id:2,profile_completed:false}}}));t.page.beginLogin();assert.equal(t.page.showProfileDialog,true);assert.equal(t.calls.length,0);
console.log('PASS: cached login, expired-token silent renewal, offline token preservation, explicit logout, first-time profile');

// A stalled Weixin SDK must release the button, report timeout, and ignore a late code.
t=setup({},()=>assert.fail('A late code must not reach the backend'));
let deadline,wxCallbacks;
t.ctx.setTimeout=fn=>{deadline=fn;return 1};t.ctx.clearTimeout=()=>{};
t.ctx.uni.login=options=>{wxCallbacks=options};
t.page.beginLogin();assert.equal(t.page.logining,true);deadline();
assert.equal(t.page.logining,false);assert.ok(t.page.error.includes('超时'));
wxCallbacks.success({code:'late-code'});assert.equal(t.store.has('token'),false);
// Failed navigation must remain visible instead of silently leaving the login page.
t=setup({},()=>{});t.ctx.console={error:()=>{}};
t.ctx.uni.reLaunch=options=>options.fail({errMsg:'route unavailable'});
t.page.finishLogin({user_id:1,username:'游客'});
assert.ok(t.page.error.includes('进入导览页面失败'));
console.log('PASS: Weixin callback timeout, late callback rejection, navigation failure feedback');

// App registration must complete backend registration, password login and /me.
const requests=[];
t=setup({},o=>{
  requests.push(o);
  if(o.url.endsWith('/register'))o.success({statusCode:200,data:{success:true}});
  else if(o.url.endsWith('/login'))o.success({statusCode:200,data:{access_token:'app-token'}});
  else o.success({statusCode:200,data:{success:true,data:{user_id:3,username:'visitor@example.com',avatar:''}}});
});
t.ctx.APP_LOGIN=true;t.ctx.LOGIN_PROVIDER='password';
t.ctx.uni.login=()=>assert.fail('App must not invoke Weixin login');
t.page.registering=true;t.page.nickname='cc123';t.page.account=' Visitor@Example.com ';t.page.password='password123';t.page.confirmPassword='different';
t.page.beginLogin();assert.equal(requests.length,0);assert.ok(t.page.error.includes('不一致'));
t.page.confirmPassword='password123';t.page.emailCode='123456';t.page.beginLogin();
assert.deepEqual(requests.map(o=>o.url),['http://test/user/register','http://test/user/login','http://test/user/me']);
assert.equal(requests[0].data.email,'visitor@example.com');
assert.equal(requests[0].data.nickname,'cc123');
assert.ok(requests[1].data.startsWith('username=cc123&'));
assert.equal(t.store.get('token'),'app-token');assert.equal(t.store.get('login_provider'),'password');
assert.equal(t.calls.length,1);assert.equal(t.page.password,'');assert.equal(t.page.showProfileDialog,false);
t=setup({token:'old',login_provider:'password'},o=>o.success({statusCode:401}));
t.ctx.APP_LOGIN=true;t.ctx.LOGIN_PROVIDER='password';t.ctx.uni.login=()=>assert.fail('Expired App session must not invoke Weixin');
t.load();assert.equal(t.store.has('token'),false);assert.ok(t.page.error.includes('过期'));
console.log('PASS: App registration, password login, profile retrieval and expired session');
