// Decode-only gate: retain the exact main framing requested by the user.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const sdk=fs.readFileSync(path.join(root,'static/sdk/xmov-avatar-2.4.1-compatible.js'))
assert.equal(hash(sdk),'6a82d4311c8f3d7403b914a8daa8db16ae85f567ba3a2754c30cfc01c8b182fd','Unreviewed SDK')
for(const file of ['components/tour-xingyun.vue','components/chat-voice.vue']){
 const source=read(file);assert.ok(source.includes('await loadXingyunSdk()'));assert.ok(source.includes("hardwareAcceleration:'prefer-hardware'"));assert.ok(!source.includes('script.src=value.sdkUrl'))
}
assert.equal(hash(read('components/tour-xingyun.vue').replace(/\r\n/g,'\n').match(/<style scoped>([\s\S]*?)<\/style>/)[1]),'0a73b923f6ebb819c0ad24786af102bc0aba1f8de248d0ac30834f350ad094a8','Main framing must remain unchanged')
const index=process.argv.indexOf('--compiled');let compiledChecked=false
if(index>=0){const dir=process.argv[index+1],render=fs.readFileSync(path.join(dir,'app-renderjs.js'),'utf8');assert.ok(render.includes('xmov-avatar-2.4.1-compatible.js')&&render.includes('prefer-hardware'));assert.ok(fs.readFileSync(path.join(dir,'static/sdk/xmov-avatar-2.4.1-compatible.js')).equals(sdk));compiledChecked=true}
console.log(JSON.stringify({passed:true,decodeOnly:true,mainFramingUnchanged:true,compiledChecked}))
