const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const {verifyAvatarRelease}=require('../scripts/verify-avatar-release.cjs'),root=path.resolve(__dirname,'..')
function fixture(t){
 const parent=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'zhiyou-avatar-release-'))
 for(const name of ['static/sdk/xmov-avatar-2.4.1-compatible.js','components/tour-xingyun.vue','components/chat-voice.vue','pages/tour/tour.vue']){const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(root,name),file)}
 t.after(()=>{assert.equal(path.dirname(fs.realpathSync(dir)),parent);assert.ok(path.basename(dir).startsWith('zhiyou-avatar-release-'));fs.rmSync(dir,{recursive:true})})
 return {dir,change(name,modify){const file=path.join(dir,name);fs.writeFileSync(file,modify(fs.readFileSync(file,'utf8')))}}
}
test('release gate accepts the tested compatibility and half-body profile',()=>assert.equal(verifyAvatarRelease(root).passed,true))
test('release gate rejects restoring the remote SDK loader from an upstream baseline',t=>{const h=fixture(t);h.change('components/tour-xingyun.vue',s=>s.replace('await loadXingyunSdk()','await fetch(value.sdkUrl)'));assert.throws(()=>verifyAvatarRelease(h.dir),/packaged loader/)})
test('release gate rejects reinstating software decoding',t=>{const h=fixture(t);h.change('components/tour-xingyun.vue',s=>s.replace("hardwareAcceleration:'prefer-hardware'","hardwareAcceleration:'prefer-software'"));assert.throws(()=>verifyAvatarRelease(h.dir))})
test('release gate rejects hidden speech video rendering',t=>{const h=fixture(t);h.change('components/chat-voice.vue',s=>s.replace('audioOnlyMode:true','audioOnlyMode:false'));assert.throws(()=>verifyAvatarRelease(h.dir),/Hidden speech/)})
test('release gate rejects unverified SDK replacement',t=>{const h=fixture(t);h.change('static/sdk/xmov-avatar-2.4.1-compatible.js',s=>s+'\n');assert.throws(()=>verifyAvatarRelease(h.dir),/Unreviewed avatar SDK/)})
