const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');let definition;
const metadata=JSON.parse(fs.readFileSync('static/digital_guide/3d/models/4caf77d8201ed7f6/idle.morph.json'));
const types={Animator:'animator',Transform:'transform',Mesh:'mesh'};
const mesh={morphWeights:{set(){}}},gltf={getInternalNodeByName:()=>({_children:[{getComponent:()=>mesh}]})};
const scale={setValue(){}},position={setValue(){}};const animator={play(){},pauseToFrame(){}};
const scene={event:{add(){},remove(){}},getElementById:()=>({getComponent:t=>t==='animator'?animator:t==='transform'?{scale,position}:gltf})};
vm.runInNewContext(fs.readFileSync('miniprogram/wxcomponents/tour-avatar-3d/index.js','utf8'),{Component:d=>definition=d,wx:{getXrFrameSystem:()=>types,request:r=>r.success({statusCode:200,data:metadata})},Date,setTimeout,clearTimeout});
for(const order of [['attached','scene','asset'],['scene','attached','asset'],['attached','asset','scene']]){
 const events=[],c={data:{...definition.data,sceneUrl:'http://127.0.0.1:8000/api/v1/files/digital_guide/3d/models/4caf77d8201ed7f6/idle.glb',animation:'idle'},triggerEvent:(name)=>events.push(name),setData(value,done){Object.assign(this.data,value);done?.()}};for(const [key,fn] of Object.entries(definition.methods))c[key]=fn.bind(c);
 for(const step of order){if(step==='attached')definition.lifetimes.attached.call(c);if(step==='scene')c.sceneReady({detail:{value:scene}});if(step==='asset'){assert.equal(c.data.showScene,true,'assets must load before scene ready');c.assetsLoaded();c.gltfLoaded()}}
 assert.equal(events.filter(e=>e==='ready').length,1,'preview must become ready once');assert.ok(!events.includes('error'));definition.lifetimes.detached.call(c);
}
console.log('PASS: all three XR lifecycle orders load without waiting cycles');
