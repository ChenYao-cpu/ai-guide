const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const root=path.resolve(__dirname,'..')
const sdk=fs.readFileSync(path.join(root,'static/sdk/xmov-avatar-2.4.1-compatible.js'),'utf8')

test('Android accepts actual decoded hardware frames and still rejects decoding failures',async()=>{
  const start=sdk.indexOf('checkVideoDecodeDetailed=function'),end=sdk.indexOf(',checkWebCodecsDetailed=function',start)
  assert.ok(start>0&&end>start)
  let result={supported:true,frames:3,primaryConfig:{hardwareAcceleration:'prefer-hardware',supported:true}}
  const context={window:{VideoDecoder:function(){}},isAndroidPlatform:()=>true,streamingVideo:{workerURL:'test'},probeVideoDecode:async()=>result,_catch$2:(run,failed)=>Promise.resolve().then(run).catch(failed)}
  vm.runInNewContext('var '+sdk.slice(start,end),context)
  assert.equal((await context.checkVideoDecodeDetailed('prefer-hardware')).supported,true)
  result={supported:false,frames:0,reason:'No decoded frames'}
  const failed=await context.checkVideoDecodeDetailed('prefer-hardware')
  assert.equal(failed.supported,false);assert.equal(failed.severity,'fatal')
  assert.ok(!sdk.includes("let config = isAndroid ? { ...defaultConfig, hardwareAcceleration: 'prefer-software' }"))
})

function loaderHarness(){
  const nodes=[],runtimeWindow={},document={createElement:()=>({remove(){this.removed=true}}),head:{appendChild:node=>nodes.push(node)}}
  const context={setTimeout,clearTimeout,Promise}
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(path.join(root,'common/xingyun-sdk.js'),'utf8').replace('export const','const').replace('export function','function')+'\nglobalThis.load=loadXingyunSdk',context)
  return {nodes,window:runtimeWindow,load:()=>context.load(runtimeWindow,document)}
}

test('legacy packaged loader deduplicates its script load',async()=>{
  const h=loaderHarness(),first=h.load(),second=h.load()
  assert.equal(first,second);assert.equal(h.nodes.length,1)
  assert.equal(h.nodes[0].src,'./static/sdk/xmov-avatar-2.4.1-compatible.js')
  h.window.XmovAvatar=function Avatar(){};h.nodes[0].onload()
  assert.equal(await first,h.window.XmovAvatar);assert.equal(await h.load(),h.window.XmovAvatar)
  assert.equal(h.nodes.length,1)
})

test('SDK load failure can be retried and an empty script is not treated as success',async()=>{
  const h=loaderHarness(),first=h.load();h.nodes[0].onerror()
  await assert.rejects(first,/资源加载失败/);assert.equal(h.nodes[0].removed,true)
  const second=h.load();assert.equal(h.nodes.length,2);h.nodes[1].onload()
  await assert.rejects(second,/资源加载失败/)
  const third=h.load();h.window.XmovAvatar=function Avatar(){};h.nodes[2].onload()
  assert.equal(await third,h.window.XmovAvatar)
})

for(const [file,moduleName] of [['tour-xingyun.vue','runtime'],['chat-voice.vue','voice']]){
  test(file+' initializes the packaged Android-compatible SDK and surfaces failures',async()=>{
    const source=fs.readFileSync(path.join(root,'components',file),'utf8').match(new RegExp('<script module="'+moduleName+'" lang="renderjs">([\\s\\S]*?)<\\/script>'))[1]
    const instances=[],events=[]
    const context={loadXingyunSdk:async()=>{},window:{XmovAvatar:class{
      constructor(options){this.options=options;instances.push(this)}
      async init(options){this.initOptions=options}
      destroy(){}
    }},document:{getElementById:()=>({innerHTML:''})},setTimeout:()=>1,clearTimeout(){},console:{error(){}}}
    vm.createContext(context)
    vm.runInContext(source.replace(/^import .*$/m,'').replace('export default','globalThis.component='),context)
    const owner={callMethod:(method,event)=>events.push(event)}
    await context.component.methods.apply({command:'connect',id:1,gateway:'http://local/session',accessToken:'test',text:moduleName==='voice'?'test speech':'',token:'test'},null,owner)
    assert.equal(instances.length,1);assert.equal(instances[0].options.hardwareAcceleration,'prefer-hardware')
    instances[0].options.onMessage({code:1234,message:'Decoder unavailable'})
    assert.equal(events.at(-1).state,'error');assert.match(events.at(-1).message,/Decoder unavailable/)
    context.component.beforeUnmount()
  })
}

 test('tour preserves cloud canvas framing and character transforms',()=>{
 const source=fs.readFileSync(path.join(root,'components/tour-xingyun.vue'),'utf8');
 assert.ok(!source.includes(':deep([width][height])'));
 assert.ok(!/transform:\s*none!important/.test(source));
 });

test('tour centers its compatible avatar without per-frame logging',()=>{
const source=fs.readFileSync(path.join(root,'components/tour-xingyun.vue'),'utf8');
assert.ok(!source.includes('onRenderChange:'));assert.ok(source.includes('transform:translateX(0)'));
assert.ok(source.includes('await loadXingyunSdk()'));
assert.ok(!source.includes('script.src=value.sdkUrl'));
});
