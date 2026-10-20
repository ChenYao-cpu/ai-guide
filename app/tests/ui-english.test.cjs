const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'..'),cjk=/[\u4e00-\u9fff]/
const english=require(path.join(root,'common/ui.en.json'))
const locations=JSON.parse(fs.readFileSync(path.join(root,'..','data','summer_palace_locations.json'),'utf8'))
// 英文界面下的景点名称来自 common/ui.en.json；缺少条目时界面会回退成中文。
// 数据库里除颐和园 16 个景点外还有故宫博物院、长城(八达岭)两个北京景点。
const databaseOnlyStops=['故宫博物院','长城(八达岭)']
test('every scenic stop offered to visitors has a Chinese-free English name',()=>{
 const names=Object.keys(locations.spots).concat(databaseOnlyStops)
 assert.ok(names.length>=18)
 for(const name of names){
  const value=english[name]
  assert.ok(value,'missing English name for '+name)
  assert.doesNotMatch(value,cjk,'English name for '+name+' still contains Chinese characters')
 }
})
