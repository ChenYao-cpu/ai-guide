const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const text=fs.readFileSync('miniprogram/pages/auth/auth.vue','utf8').split('<script>')[1].split('</script>')[0].replace(/^import .*$/m,'').replace('export default','globalThis.component=');
function setup(values,respond){const store=new Map(Object.entries(values));const calls=[];const uni={getStorageSync:k=>store.get(k),setStorageSync:(k,v)=>store.set(k,v),removeStorageSync:k=>store.delete(k),reLaunch:o=>calls.push(o.url),request:respond,login:o=>o.success({code:'test-code'})};const ctx={setTimeout,clearTimeout,console,uni,BASE_URL:'http://test',DEVELOPMENT_LOGIN:false,LOGIN_PROVIDER:'weixin'};vm.runInNewContext(text,ctx);const page=ctx.component.data();Object.assign(page,ctx.component.methods);return {page,store,calls,ctx,load:()=>ctx.component.onLoad.call(page)}}
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
