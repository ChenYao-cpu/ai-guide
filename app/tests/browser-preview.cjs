// Browser QA of the App source compiled as H5, with native account login enabled
// in an ignored staging directory. Every backend response below is simulated.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict')
const {chromium}=require('playwright-core')
const root=path.resolve(__dirname,'..'),dist=path.join(root,'unpackage/browser-qa/dist'),out=path.join(root,'unpackage/browser-qa/results')
fs.mkdirSync(out,{recursive:true})
const ok=data=>({success:true,code:0,data})
const spot={spot_id:7,spot_name:'万寿山',city:'北京',location:'颐和园',description:'历史文化',category:'historical',visit_duration:20,latitude:0,longitude:0,image_path:''}
const guide={guide_id:1,name:'数字导游',character:'历史文化',render_mode:'xingyun',is_enabled:true}
const requests=[],checks=[],errors=[]
let registrationAttempts=0
const server=http.createServer((req,res)=>{
  let file=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname))
  if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);res.end();return}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(dist,'index.html')
  const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream'
  res.writeHead(200,{'Content-Type':type});fs.createReadStream(file).pipe(res)
})
async function run(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await chromium.launch({executablePath:process.env.APP_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'en-US'})
  await context.route('**/api/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),endpoint=url.pathname.replace('/api/v1','')
    requests.push({method:request.method(),endpoint,query:url.search})
    let status=200,body
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});return}
    if(endpoint==='/user/auth-options'){status=404;body={detail:'Not Found'}}
    else if(endpoint==='/user/email-code')body={success:true,retry_after:60}
    else if(endpoint==='/user/register'){
      registrationAttempts++
      const data=request.postDataJSON()
      if(data.code!=='012345'){status=400;body={detail:'验证码错误'}}else body={success:true}
    }
    else if(endpoint==='/user/login')body={access_token:'browser-qa-fake-token',token_type:'bearer'}
    else if(endpoint==='/user/me')body=ok({user_id:7,username:'QA Traveler',avatar:''})
    else if(endpoint==='/tour-session/spots')body=ok({spot_list:[spot]})
    else if(endpoint==='/tour-session/guides')body=ok({guide_list:[guide]})
    else if(endpoint==='/tour-session/routes')body=ok({route_list:[{route_id:1,name:'历史文化路线',city:'北京',theme:'history',spot_ids:[7],estimated_time_minutes:60,description:'历史文化'}]})
    else if(endpoint.includes('avatar'))body=ok({preferredMode:'xingyun',threeD:{ready:false},realistic:{ready:false,message:'暂无预览'},cartoon:{ready:false,message:'暂无预览'}})
    else if(endpoint==='/tour-session/ai-chat-recommend')body=ok({spot_ids:[7],spot_names:['万寿山'],spot_count:1,estimated_time_minutes:60,visit_time_minutes:20,walking_time_minutes:30,rest_time_minutes:10,requested_time_minutes:120,preferences:['family','nature'],pace:'standard',ai_response:'中文模型说明',score_details:[]})
    else if(endpoint==='/tour-session/visitor-create')body=ok({session_id:72})
    else if(endpoint==='/tour-session/chat'){
      const payload=request.postDataJSON()
      requests.at(-1).chat={sessionId:payload.sessionId,currentSpotId:payload.currentSpotId,language:payload.language,message:payload.message,text_only:payload.text_only}
      body=ok({language:'en',message:payload.message.includes('How long')?'Allow about 20 minutes for this place.':'Longevity Hill is part of the Summer Palace.'})
    }
    else if(endpoint==='/xingyun/chat-voice'){status=503;body={detail:'Audio unavailable in browser QA'}}
    else if(endpoint==='/spot-favorites')body=ok({spot_list:[]})
    else if(endpoint==='/spot-favorites/counts')body=ok({})
    else if(endpoint==='/tour-session/my-history')body=ok({session_list:[]})
    else body=ok({})
    await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(body)})
  })
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  const text=(value)=>page.getByText(value,{exact:true})
  const visible=async value=>{await text(value).first().waitFor({state:'visible',timeout:12000})}
  const screenshot=async name=>{await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal page overflow: '+name)}
  const checkOverlay=async()=>{
    assert.ok(await page.locator('.select-overlay').evaluate(element=>{
      const panel=element.querySelector('.select-panel'),rect=panel.getBoundingClientRect()
      const cancel=element.querySelector('.select-cancel'),button=cancel.getBoundingClientRect()
      const target=document.elementFromPoint(button.x+button.width/2,button.y+button.height/2)
      return getComputedStyle(element).position==='fixed'&&rect.bottom<=innerHeight+1&&rect.top>=-1&&cancel.contains(target)
    }),'selection panel must stay above the tab bar inside the viewport')
  }
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'})
    await visible('智游知境');await screenshot('00-sign-in-zh')
    await text('English').click()
    await visible('New here? Register with email')
    await screenshot('01-sign-in-en')
    await text('New here? Register with email').click()
    const fields=page.locator('.nickname-input input')
    await fields.nth(0).fill('QA Traveler');await fields.nth(1).fill('qa@example.invalid')
    await fields.nth(2).fill('test-password-123');await fields.nth(3).fill('test-password-123')
    await text('Send code').click()
    await visible('Code sent. It expires in 10 minutes. Check your spam folder if needed.')
    assert.equal(requests.filter(r=>r.endpoint==='/user/email-code'&&r.method==='POST').length,1)
    await fields.nth(4).fill('111111');await text('Register and sign in').click();await visible('Incorrect verification code')
    await screenshot('02-registration-en')
    await fields.nth(4).fill('012345');await text('Register and sign in').click()
    await visible('Choose places');checks.push('email code, validation, failed-code retry, registration and automatic login (mock APIs)')
    assert.equal(registrationAttempts,2)
    await page.locator('.search-input input').fill('longevity')
    await visible('Longevity Hill');await screenshot('03-planning-search-en')
    await page.locator('.tt-item').nth(1).click();await visible('Digital guides')
    await page.locator('.planner-control').nth(0).click();await visible('Time available')
    await checkOverlay()
    await screenshot('04-time-options-en')
    await page.locator('.select-option').nth(1).click()
    await page.locator('.planner-control').nth(1).click();await visible('Relaxed pace · Fewer steps')
    await text('Cancel').click();checks.push('English catalog search and in-App time/pace selection')
    await page.locator('.tb-item').nth(2).click();await visible('Interface language')
    await screenshot('05-profile-en')
    await text('中文').click();await visible('界面语言')
    await page.locator('.tb-item').nth(0).click();await visible('景点选择')
    await page.locator('.tb-item').nth(2).click();await text('English').click()
    await page.reload({waitUntil:'networkidle'});await visible('Interface language');checks.push('Chinese/English switching persists through navigation and reload')
    await page.locator('.tb-item').nth(1).click();await visible('Which place would you like to learn about?')
    await page.locator('.msg-input input').fill('Tell me about Longevity Hill.')
    const sendPosition=await page.locator('.send-btn').boundingBox()
    await text('Send').click()
    assert.equal((await page.locator('.send-btn').boundingBox()).y,sendPosition.y,'Send must not move away during the first tap')
    await visible('Longevity Hill is part of the Summer Palace.')
    await page.locator('.msg-input input').fill('How long should I stay?');await text('Send').click()
    await visible('Allow about 20 minutes for this place.')
    await page.waitForFunction(()=>document.querySelector('.msg-input input')?.value==='')
    const dialogues=requests.filter(item=>item.endpoint==='/tour-session/chat')
    assert.equal(dialogues.length,2);assert.equal(requests.filter(item=>item.endpoint==='/tour-session/visitor-create').length,1)
    for(const item of dialogues){assert.equal(item.chat.language,'en');assert.equal(item.chat.currentSpotId,7);assert.equal(item.chat.text_only,true)}
    await screenshot('08-english-questions');checks.push('English questions and follow-up replies use the dialogue API and preserve scenic context')
    await page.locator('.question-place').click();await visible('Choose a place to ask about');await checkOverlay();await text('Cancel').click()
    await text('Clear').click();await text('Plan a route').click();await visible('Where would you like to go?')
    await text('2-hour family nature tour').click()
    await visible('Suggested route: Longevity Hill. Estimated time: 60 min.')
    assert.equal((await page.locator('.rp-total-value').innerText()).trim(),'60 min','preview must use the server duration')
    const planning=requests.find(r=>r.endpoint==='/tour-session/ai-chat-recommend'&&r.method==='POST')
    assert.match(decodeURIComponent(planning.query),/2小时.*亲子孩子.*自然风光/)
    await screenshot('06-ai-planning-en');checks.push('English planning request adapts to LZX; result keeps server route IDs and time')
    await page.locator('.photo-add').click();await visible('Take a photo');await visible('Choose from photos')
    await checkOverlay()
    await screenshot('07-photo-options-en');await text('Cancel').click()
    await text('Use this route').click();await visible('Digital guides')
    await visible('1 place · Total 60 min');checks.push('AI route handoff retains server plan in the personal planner')
    await page.locator('.tb-item').nth(1).click();await visible('Suggested route: Longevity Hill. Estimated time: 60 min.')
    await page.reload({waitUntil:'networkidle'});await visible('Suggested route: Longevity Hill. Estimated time: 60 min.')
    await page.locator('.rp-total-value').waitFor({state:'visible'});assert.equal((await page.locator('.rp-total-value').innerText()).trim(),'60 min')
    checks.push('Chat mode, conversation and server route preview survive a page reload')
    assert.deepEqual(errors,[],'uncaught browser errors')
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,simulatedBackend:true,viewport:'390×844',checks,requests,errors},null,2))
    console.log('App browser preview passed '+checks.length+' end-to-end checks with mock APIs. Screenshots: '+out)
  }catch(error){
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{})
    fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,errors,requests,body:await page.locator('body').innerText()},null,2))
    throw error
  }finally{await browser.close();server.close()}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1})
