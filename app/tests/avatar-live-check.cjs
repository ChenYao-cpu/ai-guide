// Explicit real cloud smoke check. Creates/ends only its own diagnostic tour.
// It measures this Chrome instance; it does not claim Android-device results.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict')
const {chromium}=require('playwright-core')
const root=path.resolve(__dirname,'..'),out=path.join(root,'unpackage/main-84e5268-1.3.4/avatar-live-results'),base=process.env.APP_QA_API||'http://127.0.0.1:18000/api/v1'
fs.mkdirSync(out,{recursive:true})
const report={realCloud:true,phoneVerified:false,events:[],fps:[]};let sid,guideId,capability,remote,server,browser,page
async function api(endpoint,method='GET',data,headers={}){
 const response=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(45000)})
 assert.ok(response.ok,'API HTTP '+response.status);return response.json()
}
async function run(){try{
 const guides=(await api('/tour-session/guides')).data.guide_list,guide=guides.find(g=>g.render_mode==='xingyun'&&g.is_enabled!==false);assert.ok(guide,'No enabled cloud avatar')
 guideId=guide.guide_id
 const tour=(await api('/tour-session/visitor-create?'+new URLSearchParams({name:'App avatar live diagnostic',guide_id:guideId,spot_ids:'[12]'}),'POST')).data
 sid=tour.session_id;capability=tour.avatar_access_token
 const css=fs.readFileSync(path.join(root,'components/tour-xingyun.vue'),'utf8').match(/<style scoped>([\s\S]*?)<\/style>/)[1].replace(/:deep\(([^)]+)\)/g,'$1').replace(/24rpx/g,'12px')
 server=http.createServer(async(req,res)=>{try{
  if(req.url==='/sdk.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(root,'static/sdk/xmov-avatar-2.4.1-compatible.js')));return}
  if(req.url==='/session'){
   const body=[];for await(const chunk of req)body.push(chunk)
   const data=await api('/xingyun/session/'+guideId+'?tour_id='+sid,req.method,JSON.parse(Buffer.concat(body).toString()),{'X-Tour-Access':capability})
   if(req.method==='POST')remote=data.data
   if(req.method==='DELETE'&&data.error_code===0)report.cloudSessionClosed=true
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return
  }
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'body{margin:0;background:#f8fafc}.guide-stage{position:relative;width:382px;height:215px;margin:30px auto;background:#fff;overflow:hidden}</style><div class="guide-stage"><div class="xingyun-stage"><div id="tour-xingyun-avatar"></div></div></div><script src="/sdk.js"></script>')
 }catch(error){res.writeHead(502).end(JSON.stringify({error:'diagnostic proxy failed'}));report.proxyError=error.message}})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 browser=await chromium.launch({executablePath:process.env.APP_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']})
 page=await browser.newPage({viewport:{width:390,height:844}})
 await page.exposeFunction('avatarMetric',value=>{if(value.type==='fps')report.fps.push(value.stats);else report.events.push(value)})
 await page.goto('http://127.0.0.1:'+server.address().port)
 await page.evaluate(async()=>{
  let last=0;window.avatarReady=false;window.liveAvatar=new window.XmovAvatar({containerId:'#tour-xingyun-avatar',appId:'server-proxy',appSecret:'server-proxy',gatewayServer:location.origin+'/session',hardwareAcceleration:'prefer-hardware',enableLogger:false,enableDebugger:false,proxyWidget:{subtitle_on(){},subtitle_off(){}},onInitEvent(code){if(code===4000)window.avatarReady=true;window.avatarMetric({type:'init',code})},onStateChange(state){if(state==='idle'||state==='interactive_idle')window.avatarReady=true;window.avatarMetric({type:'state',state})},onVoiceStateChange(state){window.avatarMetric({type:'voice',state})},onMessage(error){window.avatarMetric({type:'message',code:error.code})},onFPSUpdate(stats){if(Date.now()-last>=1000){last=Date.now();window.avatarMetric({type:'fps',stats})}}})
  window.initDone=window.liveAvatar.init({onDownloadProgress:progress=>window.avatarMetric({type:'progress',progress:Math.round(progress)}),onClose:()=>window.avatarMetric({type:'closed'})}).catch(error=>window.avatarMetric({type:'initError',message:String(error.message).slice(0,120)}))
 })
 await page.waitForFunction(()=>window.avatarReady,null,{timeout:90000})
 await page.evaluate(()=>window.liveAvatar.speak('欢迎来到颐和园，这里可以欣赏昆明湖和万寿山。',true,true))
 await new Promise(resolve=>setTimeout(resolve,14000))
 report.canvas=await page.evaluate(()=>{const c=document.querySelector('canvas'),g=c&&c.getContext('webgl2');return c?{width:c.width,height:c.height,cssWidth:c.getBoundingClientRect().width,cssHeight:c.getBoundingClientRect().height,renderer:g&&g.getParameter(g.RENDERER)}:null})
 report.actualVideoFrames=report.fps.some(value=>value.totalFrames>0&&value.current>0)
 report.voiceStarted=report.events.some(value=>value.type==='voice'&&String(value.state).includes('start'))
 assert.ok(report.actualVideoFrames,'Cloud avatar produced no video frames')
 await page.screenshot({path:path.join(out,'live-half-body.png')});report.passed=true
 }catch(error){report.passed=false;report.error=error.message;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{})}
 finally{
  if(page)await page.evaluate(async()=>{if(window.liveAvatar)await window.liveAvatar.destroy()}).catch(()=>{})
  if(remote?.session_id&&!report.cloudSessionClosed){try{const closed=await api('/xingyun/session/'+guideId+'?tour_id='+sid,'DELETE',{session_id:remote.session_id,request_id:remote.request_id,stop_reason:'diagnostic finished'},{'X-Tour-Access':capability});report.cloudSessionClosed=closed.error_code===0}catch(error){report.closeError=error.message}}
  if(sid){try{report.testTourClosed=(await api('/tour-session/end/'+sid,'PUT',{}, {'X-Tour-Access':capability})).success}catch(error){report.endError=error.message}}
  await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,realCloud:true,phoneVerified:false,actualVideoFrames:report.actualVideoFrames,voiceStarted:report.voiceStarted,fps:report.fps.slice(-3),error:report.error,cloudSessionClosed:report.cloudSessionClosed,testTourClosed:report.testTourClosed}));if(!report.passed)process.exitCode=1
 }
}
run()
