// Exercise real component methods with a deterministic clock, without a device.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
let now = 10000, timers = [], events = [], navigations = [];
const motion = {direction:1,at:0,from:0,to:0};
const appStyles=fs.readFileSync(path.join(__dirname,'../app/App.vue'),'utf8');
const sheetStyles=fs.readFileSync(path.join(__dirname,'../app/components/ScenicSheet.vue'),'utf8');
const guidePage=fs.readFileSync(path.join(__dirname,'../app/pages/tour-guide/tour-guide.vue'),'utf8');
assert.match(guidePage,/<view class="scenic-page-stage">/,'background must retain its original size');
assert(!guidePage.includes('sheetProgress'),'sheet progress must not shrink the background');
assert.match(appStyles,/:not\(\.scenic-sheet-overlay\)/,'page stacking rule must exclude the fixed sheet');
assert.match(sheetStyles,/height:50vh;max-height:50vh;/,'sheet must occupy half the viewport');
assert.match(sheetStyles,/\.scenic-sheet-overlay\{position:fixed!important;/,'sheet must stay fixed above page stacking rules');
for (const page of ['tour-guide','ai-chat','mine']) {
  const source=fs.readFileSync(path.join(__dirname,`../app/pages/${page}/${page}.vue`),'utf8');
  assert.equal((source.match(/\bcomponents\s*:/g)||[]).length,1,`${page}: component registration must not be overwritten`);
  assert.match(source,/components\s*:\s*\{[^}]*TabBarNav/);
}
function component(name, props = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../app/components', name+'.vue'), 'utf8')
    .split('<script>')[1].split('</script>')[0].replace(/^import .*$/gm, '').replace('export default', 'result =');
  const sandbox = {Date:{now:()=>now}, Math, tabMotion:motion,
    setTimeout:(fn,delay)=>{const t={fn,at:now+delay};timers.push(t);return t},
    clearTimeout:t=>{timers=timers.filter(x=>x!==t)},
    uni:{reLaunch:o=>navigations.push(o.url)}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  const def=sandbox.result, instance={...def.data(),...props,$emit:(...e)=>events.push(e)};
  for(const [key,method] of Object.entries(def.methods)) instance[key]=method.bind(instance);
  for(const [key,get] of Object.entries(def.computed)) Object.defineProperty(instance,key,{get:()=>get.call(instance)});
  if(def.created)def.created.call(instance);
  return instance;
}
function tick(ms) {now+=ms;const ready=timers.filter(t=>t.at<=now);timers=timers.filter(t=>t.at>now);ready.forEach(t=>t.fn())}
const touch=y=>({touches:[{clientY:y}],preventDefault(){}});
let sheet=component('ScenicSheet');sheet.visible=true;sheet.height=600;
sheet.start(touch(0),true);tick(100);sheet.move(touch(-120));
assert(sheet.drag<0&&sheet.drag>-36,'handle must move upward slightly with resistance');assert.match(sheetStyles,/height:80px;background:#fff/,'white extension must cover upward gap');sheet.end();assert.equal(sheet.drag,0);assert.equal(sheet.visible,true,'upward pull rebounds without closing');assert.match(sheet.panelStyle.transition,/400ms cubic-bezier/);
sheet.start(touch(0));tick(200);sheet.move(touch(90));tick(200);sheet.end();assert.equal(sheet.visible,true);assert.equal(sheet.drag,0);
sheet.start(touch(0));tick(500);sheet.move(touch(210));sheet.end();assert.equal(sheet.visible,false,'over one third closes');
sheet=component('ScenicSheet');sheet.visible=true;sheet.height=600;
sheet.start(touch(0));tick(25);sheet.move(touch(70));sheet.end();assert.equal(sheet.visible,false,'fast flick closes');
sheet=component('ScenicSheet');sheet.visible=true;sheet.scrollTop=50;
sheet.start(touch(0));sheet.move(touch(100));assert.equal(sheet.drag,0,'scrolling body must not drag sheet');
sheet.scrollTop=0;sheet.start(touch(100));sheet.move(touch(20));assert.equal(sheet.dragging,false,'upward body gesture remains scrollable');
timers=[];events=[];
let nav=component('TabBarNav',{current:'tour'});nav.switchTab(2);tick(80);
assert(nav.right>nav.left,'leading edge arrives before trailing edge');assert(nav.flat<1);assert.equal(navigations.length,1);
nav=component('TabBarNav',{current:'mine'});assert(nav.right>nav.left,'incoming page continues same capsule motion');
tick(320);assert.equal(nav.left,2);assert.equal(nav.right,2);assert.equal(nav.flat,1);
nav.switchTab(0);tick(80);assert(nav.left<nav.right,'leftwards leading edge moves first');
tick(320);assert.equal(nav.left,0);assert.equal(nav.right,0);
// Capsule edges must remain inside their start/target positions throughout landing.
for(const [from,to] of [[0,1],[1,0],[0,2],[2,0]]){
  timers=[];const pill=component('TabBarNav',{current:['tour','ai','mine'][from]});
  pill.animatePill(from,to,now);let previousLeft=from,previousRight=from;
  for(let t=0;t<400;t+=16){tick(16);const low=Math.min(from,to),high=Math.max(from,to);
    assert(pill.left>=low&&pill.left<=high&&pill.right>=low&&pill.right<=high,'capsule must not overshoot button');
    if(to>from){assert(pill.left>=previousLeft&&pill.right>=previousRight)}else{assert(pill.left<=previousLeft&&pill.right<=previousRight)}
    previousLeft=pill.left;previousRight=pill.right;
  }
}
timers=[];
const inkSandbox={Date:{now:()=>now},Math,
  setTimeout:(fn,delay)=>{const t={fn,at:now+delay};timers.push(t);return t},
  clearTimeout:t=>{timers=timers.filter(x=>x!==t)}};
vm.createContext(inkSandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/common/planning-underline.js'),'utf8').replace('export const planningUnderlineMixin =','result ='),inkSandbox);
const inkDef=inkSandbox.result,planner={...inkDef.data()};
for(const [key,method] of Object.entries(inkDef.methods))planner[key]=method.bind(planner);
planner.planningInkReady=true;
planner.planningInkAnchors=[{left:40,right:160,top:60,height:2,flat:1},{left:260,right:350,top:60,height:2,flat:1}];
planner.planningInk={...planner.planningInkAnchors[0]};planner.animatePlanningUnderline('personal');
assert.equal(planner.planningInkMotion,1);
for(const [key,get] of Object.entries(inkDef.computed))Object.defineProperty(planner,key,{get:()=>get.call(planner)});
assert.match(planner.planningInkStyle.transition,/left 352ms .* 48ms, right 352ms .* 0ms/,'rightward motion must delay the trailing left edge');
planner.animatePlanningUnderline('route');
assert.equal(planner.planningInkMotion,-1);
assert.match(planner.planningInkStyle.transition,/left 352ms .* 0ms, right 352ms .* 48ms/,'reverse motion must delay the trailing right edge');
assert.equal(planner.planningInk.left,40);assert.equal(planner.planningInk.right,160);
tick(400);assert.equal(planner.planningInkMotion,0);
planner.animatePlanningUnderline('personal');tick(400);
assert.equal(planner.planningInk.left,260);assert.equal(planner.planningInk.right,350);
const compactNav=component('TabBarNav',{current:'ai'});
const compactWidth=100-parseFloat(compactNav.pillStyle.left)-parseFloat(compactNav.pillStyle.right);
assert(compactWidth<21&&compactWidth>20,'bottom capsule resting length should be reduced');
console.log('Passed: sheet gestures, capsule motion, bidirectional underline edge delays, compact capsule widths and 400ms settling.');
