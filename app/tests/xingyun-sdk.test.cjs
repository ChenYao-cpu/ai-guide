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
  vm.runInContext(fs.readFileSync(path.join(root,'common/xingyun-sdk.js'),'utf8').replace(/export /g,'')+'\nglobalThis.load=loadXingyunSdk;globalThis.recover=isRecoverableXingyunEvent',context)
  return {nodes,window:runtimeWindow,load:()=>context.load(runtimeWindow,document),recover:context.recover}
}

test('tour and voice share one packaged SDK load instead of using the remote latest',async()=>{
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
  test(file+' initializes the pinned SDK with hardware decoding and surfaces failures',async()=>{
    const source=fs.readFileSync(path.join(root,'components',file),'utf8').match(new RegExp('<script module="'+moduleName+'" lang="renderjs">([\\s\\S]*?)<\\/script>'))[1]
    const instances=[],events=[]
    const context={loadXingyunSdk:async()=>{},isRecoverableXingyunEvent:loaderHarness().recover,window:{XmovAvatar:class{
      constructor(options){this.options=options;instances.push(this)}
      async init(options){this.initOptions=options}
      destroy(){}
    }},document:{getElementById:()=>({innerHTML:''})},setTimeout:()=>1,clearTimeout(){},console:{error(){}}}
    vm.createContext(context)
    vm.runInContext(source.replace(/^import .*$/m,'').replace('export default','globalThis.component='),context)
    const owner={callMethod:(method,event)=>events.push(event)}
    await context.component.methods.apply({command:'connect',id:1,gateway:'http://local/session',accessToken:'test',text:moduleName==='voice'?'test speech':'',token:'test'},null,owner)
    assert.equal(instances.length,1);assert.equal(instances[0].options.hardwareAcceleration,'prefer-hardware')
    assert.equal(instances[0].options.enableLogger,false);assert.equal(instances[0].options.enableDebugger,false)
    assert.equal(instances[0].options.onFrameDataUpdate,undefined)
    if(moduleName==='voice')assert.equal(instances[0].options.audioOnlyMode,true)
    instances[0].options.onMessage({code:60004,message:'WebGL recovered'})
    assert.ok(!events.some(event=>event.state==='error'))
    instances[0].options.onMessage({code:1234,message:'Decoder unavailable'})
    assert.equal(events.at(-1).state,'error');assert.match(events.at(-1).message,/Decoder unavailable/)
    context.component.beforeUnmount()
  })
}

function renderer(file,delayDestroy=false){
 const name=file==='tour-xingyun.vue'?'runtime':'voice',instances=[],events=[];let finishDestroy,now=20000
 const delayed=new Promise(resolve=>finishDestroy=resolve)
 const context={Date:{now:()=>now},Promise,loadXingyunSdk:async()=>{},isRecoverableXingyunEvent:loaderHarness().recover,document:{getElementById:()=>({innerHTML:''})},window:{XmovAvatar:class{
  constructor(options){this.options=options;this.spoken=[];instances.push(this)}
  async init(){} speak(text){this.spoken.push(text)} interactiveidle(){}
  destroy(){return delayDestroy&&this===instances[0]?delayed:Promise.resolve()}
 }},console:{error(){}},setTimeout:()=>1,clearTimeout(){}}
 vm.createContext(context)
 const source=fs.readFileSync(path.join(root,'components',file),'utf8').match(new RegExp('<script module="'+name+'" lang="renderjs">([\\s\\S]*?)<\\/script>'))[1]
 vm.runInContext(source.replace(/^import .*$/gm,'').replace('export default','globalThis.component='),context)
 const owner={callMethod:(method,event)=>events.push(event)}
 return {instances,events,finishDestroy,advance:ms=>now+=ms,apply:value=>context.component.methods.apply(value,null,owner),close:()=>context.component.beforeUnmount()}
}
test('queued opening speech is sent once and per-frame metrics cross the bridge at most every five seconds',async()=>{
 const h=renderer('tour-xingyun.vue');await h.apply({command:'connect',gateway:'local/one',text:'Opening speech'})
 const instance=h.instances[0];instance.options.onStateChange('idle');instance.options.onInitEvent(4000)
 assert.deepEqual(instance.spoken,['Opening speech'])
 for(let i=0;i<240;i++)instance.options.onFPSUpdate({current:24,totalFrames:i})
 assert.equal(h.events.filter(e=>e.state==='performance').length,1)
 h.advance(5000);instance.options.onFPSUpdate({current:24,totalFrames:241});assert.equal(h.events.filter(e=>e.state==='performance').length,2)
 h.close()
})
for(const file of ['tour-xingyun.vue','chat-voice.vue'])test(file+' waits for teardown and discards superseded connects',async()=>{
 const h=renderer(file,true);await h.apply({command:'connect',gateway:'local/one',text:'One'})
 const second=h.apply({command:'connect',gateway:'local/two',text:'Two'}),third=h.apply({command:'connect',gateway:'local/three',text:'Three'})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(h.instances.length,1)
 h.finishDestroy();await Promise.all([second,third]);assert.equal(h.instances.length,2);assert.equal(h.instances[1].options.gatewayServer,'local/three');h.close()
})
test('parent hands opening text to the renderer without resending it on connection',async()=>{
 const source=fs.readFileSync(path.join(root,'pages/tour/tour.vue'),'utf8')
 const globals={BASE_URL:'http://local/api/v1',uni:{getStorageSync:()=> 'test-capability'},Date,request:async()=>({data:{configured:true,sdkUrl:'remote-latest'}}),console,Promise}
 const method=name=>vm.runInNewContext('({'+source.match(new RegExp(name+':(?:async )?function\\([^)]*\\)\\{[\\s\\S]*?\\n    \\},'))[0]+'})',globals)[name]
 const s={tourVisible:true,guideId:2,sid:7,tourLanguage:'zh',_xingyunPending:'Opening speech'}
 await method('connectXingyun').call(s);await new Promise(resolve=>setImmediate(resolve))
 assert.equal(s.xingyunPayload.text,'Opening speech');assert.equal(s._xingyunPending,'')
 const payload=s.xingyunPayload;method('onXingyunState').call(s,{state:'connected',gateway:s._xingyunGateway})
 assert.equal(s.xingyunPayload,payload)
})
