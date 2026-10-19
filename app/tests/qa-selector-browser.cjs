// Compiled App, simulated API responses; no real AI or Android-device claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict')
const {chromium}=require('playwright-core')
const root=path.resolve(__dirname,'..'),version=process.env.APP_QA_VERSION||'1.3.4',stage=path.join(root,'unpackage/main-84e5268-'+version),dist=path.join(stage,'browser'),out=path.join(stage,'qa-selector-results')
fs.mkdirSync(out,{recursive:true})
const names=['仁寿殿','长廊','佛香阁','昆明湖','十七孔桥','万寿山','玉带桥','石舫','排云殿','乐寿堂','德和园','谐趣园']
const spots=names.map((spot_name,i)=>({spot_id:i+1,spot_name,city:'北京',visit_duration:20,category:'historical'}))
const requests=[],errors=[],ok=data=>({success:true,data})
const server=http.createServer((req,res)=>{
 let file=path.resolve(dist,'.'+new URL(req.url,'http://local').pathname)
 if(file!==dist&&!file.startsWith(dist+path.sep)){res.writeHead(403).end();return}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(dist,'index.html')
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)
})
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser,page;const checks=[]
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  await context.route('**/api/v1/**',async route=>{
   const req=route.request(),endpoint=new URL(req.url()).pathname.replace('/api/v1','');requests.push({endpoint,body:req.postData()});let data
   if(endpoint==='/user/login')data={access_token:'mock-token',token_type:'bearer'}
   else if(endpoint==='/user/me')data=ok({user_id:17,username:'App QA'})
   else if(endpoint==='/tour-session/spots')data=ok({spot_list:spots})
   else if(endpoint==='/tour-session/guides')data=ok({guide_list:[{guide_id:2,name:'测试导游',is_enabled:true,render_mode:'audio'}]})
   else if(endpoint==='/tour-session/routes')data=ok({route_list:[]})
   else if(endpoint==='/tour-session/visitor-create')data=ok({session_id:71})
   else if(endpoint==='/tour-session/chat')data=ok({message:'问答测试回复'})
   else if(endpoint==='/xingyun/chat-voice'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Voice disabled in UI check'})});return}
   else data=ok({})
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)})
  })
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:'+server.address().port)
  const fields=page.locator('.nickname-input input');await fields.nth(0).fill('app-qa');await fields.nth(1).fill('mock-password');await page.locator('.primary').click()
  await page.locator('.spot-card').first().waitFor();await page.locator('.tb-item').nth(1).click();await page.locator('.question-place').waitFor()
  assert.equal(await page.locator('.chat-mode').count(),0)
  for(const [width,height] of [[390,844],[320,640],[844,390]]){
   await page.setViewportSize({width,height});await page.locator('.question-place').click();await page.locator('.select-overlay-upper').waitFor()
   const panel=await page.locator('.select-panel').boundingBox()
   assert.ok(panel.width<=342&&panel.width<=width-20,JSON.stringify(panel))
   assert.ok(panel.y>=0&&panel.y<height*.3&&panel.y+panel.height<=height-4,JSON.stringify({panel,styles:await page.evaluate(()=>['.select-overlay','.select-panel'].map(selector=>{const element=document.querySelector(selector),s=getComputedStyle(element);return{selector,classes:element.className,align:s.alignItems,self:s.alignSelf,justify:s.justifyContent,padding:s.padding,margin:s.margin,position:s.position,height:s.height,top:s.top,bottom:s.bottom,transform:s.transform}}))}))
   const labels=await page.locator('.select-option').allTextContents();assert.equal(labels.length,spots.length)
   assert.ok(labels.every(label=>!label.includes('北京')&&!label.includes('Beijing')))
   await page.screenshot({path:path.join(out,`picker-${width}x${height}.png`)})
   await page.locator('.select-option').last().scrollIntoViewIfNeeded();await page.locator('.select-option').last().click()
   await page.locator('.select-overlay').waitFor({state:'detached'});assert.match(await page.locator('.question-place').innerText(),/谐趣园/)
   checks.push({width,height,upperCompactPanel:true,scrollToLastOption:true,noCityPrefix:true})
  }
  await page.setViewportSize({width:390,height:844})
  await page.locator('.question-place').click();await page.locator('.select-cancel').click();assert.match(await page.locator('.question-place').innerText(),/谐趣园/)
  await page.locator('.question-place').click();await page.mouse.click(4,4);await page.locator('.select-overlay').waitFor({state:'detached'})
  await page.locator('.photo-add').click();assert.equal(await page.locator('.select-overlay-upper').count(),0)
  const photoPanel=await page.locator('.select-panel').boundingBox();assert.ok(photoPanel.y>844/2);await page.locator('.select-cancel').click()
  const input=page.locator('.msg-input input');await input.fill('介绍这个景点');await page.locator('.send-btn:not(.disabled)').click();await page.getByText('问答测试回复',{exact:true}).waitFor()
  assert.equal(JSON.parse(requests.find(item=>item.endpoint==='/tour-session/chat').body).currentSpotId,12)
  assert.equal(requests.filter(item=>item.endpoint==='/tour-session/ai-chat-recommend').length,0)
  await page.reload({waitUntil:'networkidle'});assert.match(await page.locator('.question-place').innerText(),/谐趣园/);assert.equal(await page.locator('.chat-mode').count(),0)
  await page.screenshot({path:path.join(out,'simplified-chat.png')});assert.deepEqual(errors,[])
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,mockedBackend:true,phoneVerified:false,checks,cancelPreservesSelection:true,backdropCloses:true,photoPickerStillBottom:true,selectedIdSent:12,selectionRestoredOnReload:true,errors},null,2))
  console.log('Compiled App compact upper picker and simplified chat checks passed')
 }catch(error){if(page){await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,body:await page.locator('body').innerText(),errors,requests},null,2))}throw error}
 finally{await browser?.close();server.close()}
}
run().catch(error=>{console.error(error);process.exitCode=1})
