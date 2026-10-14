const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('miniprogram/components/tour-xingyun.vue','utf8').split('<script module="runtime" lang="renderjs">')[1].split('</script>')[0].replace('export default','globalThis.component=');
let instances=0,destroyed=0,stopped=0,spoken=[],events=[],options;
class SDK{constructor(o){options=o;instances++}async init(){options.onInitEvent(4000)}speak(t){spoken.push(t)}interactiveidle(){stopped++}destroy(){destroyed++}}
const ctx={window:{XmovAvatar:SDK},setTimeout:()=>1,clearTimeout:()=>{}};
vm.runInNewContext(source,ctx);
const apply=ctx.component.methods.apply,owner={callMethod:(method,e)=>events.push(e)};
(async()=>{
 const config={gateway:'http://test/api/v1/xingyun/session/2?tour_id=9',accessToken:'test-only',sdkUrl:'sdk.js'};
 await apply({...config,command:'connect'},null,owner);
 assert.equal(instances,1);assert.equal(events.at(-1).state,'connected');assert.equal(options.headers['X-Tour-Access'],'test-only');
 await apply({...config,command:'speak',text:'佛香阁讲解'},null,owner);
 await apply({...config,command:'speak',text:'长廊讲解'},null,owner);
 assert.equal(instances,1);assert.deepEqual(spoken,['佛香阁讲解','长廊讲解']);
 await apply({command:'stop'},null,owner);assert.equal(stopped,3);assert.equal(destroyed,0);
 await apply({command:'close'},null,owner);assert.equal(destroyed,1);
 console.log('PASS: tour automatically connects, reuses the session, speaks, interrupts and releases');
})().catch(e=>{console.error(e);process.exitCode=1});
