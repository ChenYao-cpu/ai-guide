const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
function helper(){const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../common/chat-language.js'),'utf8').replace(/export /g,''),c);return c.localizeChatMessages}
test('current and history questions and answers translate once and restore exact originals',async()=>{
 const localize=helper(),cache=new Map(),a={role:'user',content:'介绍仁寿殿'},b={role:'ai',content:'仁寿殿是理政中心。',segments:[{t:'旧文本'}],cursor:true},history={...b};let calls=0
 const options={lists:[[a,b],[a,history]],field:'content',cache,isCurrent:()=>true,target:'en',translate:async texts=>{calls++;assert.deepEqual(Array.from(texts).map(JSON.parse),['介绍仁寿殿','仁寿殿是理政中心。']);return ['Introduce the Hall of Benevolence and Longevity.','The hall was a center of government.']}}
 await localize(options);assert.equal(calls,1);assert.equal(b.content,history.content);assert.equal(b.segments,undefined);assert.equal(b.cursor,false)
 await localize({...options,target:'zh',translate:()=>assert.fail('must restore cache')});assert.equal(a.content,'介绍仁寿殿');assert.equal(b.content,'仁寿殿是理政中心。')
 const refreshed={role:'ai',message:'仁寿殿是理政中心。'};await localize({...options,lists:[[refreshed]],field:'message',translate:()=>assert.fail('reuse cached tour reply')});assert.equal(refreshed.message,'The hall was a center of government.')
})
test('superseded language and account requests cannot alter chat or cache',async()=>{
 const localize=helper(),cache=new Map(),m={content:'原文'};let current=true,resolve
 const pending=localize({lists:[[m]],field:'content',target:'en',cache,isCurrent:()=>current,translate:()=>new Promise(r=>resolve=r)})
 current=false;resolve(['Translated.']);await pending;assert.equal(m.content,'原文');assert.equal(cache.size,0)
})
test('translation failures preserve original content and allow retry',async()=>{
 const localize=helper(),m={message:'原文'},options={lists:[[m]],field:'message',target:'en',cache:new Map(),isCurrent:()=>true}
 await assert.rejects(localize({...options,translate:async()=>['还是中文']}));assert.equal(m.message,'原文')
 await localize({...options,translate:async()=>['Original text.']});assert.equal(m.message,'Original text.')
})
test('long replies retain every character despite the endpoint input limit',async()=>{
 const localize=helper(),original='长篇讲解😀'.repeat(1000),m={content:original},parts=[]
 await localize({lists:[[m]],field:'content',target:'en',cache:new Map(),isCurrent:()=>true,translate:async texts=>Array.from(texts,text=>{assert.ok(text.length<4000);parts.push(JSON.parse(text));return 'Translated section.'})})
 assert.equal(parts.join(''),original);assert.ok(parts.length>4);assert.equal(m.translations.zh,original);assert.equal(m.content.split('\n').length,parts.length)
})
