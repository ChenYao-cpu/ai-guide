// Release gate for regressions that previously made it into Android packages.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict')
function verifyAvatarRelease(root=path.resolve(__dirname,'..'),compiled){
 const read=file=>fs.readFileSync(path.join(root,file),'utf8')
 const sdk=fs.readFileSync(path.join(root,'static/sdk/xmov-avatar-2.4.1-compatible.js'))
 assert.equal(crypto.createHash('sha256').update(sdk).digest('hex'),'6a82d4311c8f3d7403b914a8daa8db16ae85f567ba3a2754c30cfc01c8b182fd','Unreviewed avatar SDK; verify Android decode compatibility before changing the pinned version')
 for(const file of ['components/tour-xingyun.vue','components/chat-voice.vue']){
  const source=read(file)
  assert.match(source,/await loadXingyunSdk\(\)/,file+' must use the packaged loader')
  assert.doesNotMatch(source,/script\.src\s*=\s*value\.sdkUrl|xmovAvatar@latest/,file+' must not load a remote latest SDK')
  assert.match(source,/hardwareAcceleration\s*:\s*['"]prefer-hardware['"]/)
  assert.doesNotMatch(source,/onFrameDataUpdate\s*:/,'Do not send frame data through the App logic bridge')
 }
 assert.match(read('components/chat-voice.vue'),/audioOnlyMode\s*:\s*true/,'Hidden speech must not decode/render a second avatar')
 const tour=read('components/tour-xingyun.vue')
 assert.doesNotMatch(tour,/translateX\(-10%\)/,'Do not reintroduce fixed left shift')
 assert.match(tour,/height:208\.333333%!important/,'Half-body source crop is required')
 assert.match(read('pages/tour/tour.vue'),/56\.25vw/,'Keep the avatar stage wide')
 if(compiled){
  const render=fs.readFileSync(path.join(compiled,'app-renderjs.js'),'utf8')
  assert.ok(render.includes('xmov-avatar-2.4.1-compatible.js')&&render.includes('prefer-hardware'),'Built renderjs lost the compatibility settings')
  const bundled=fs.readFileSync(path.join(compiled,'static/sdk/xmov-avatar-2.4.1-compatible.js'));assert.ok(bundled.equals(sdk),'Built SDK differs from the verified source')
  const css=fs.readFileSync(path.join(compiled,'pages/tour/tour.css'),'utf8');assert.ok(css.includes('208.333333%')&&css.includes('56.25vw'),'Built App lost half-body/wide framing')
 }
 return {passed:true,compiledChecked:!!compiled,pinnedSdk:true,hardwareDecode:true,halfBody:true,audioOnlySpeech:true}
}
module.exports={verifyAvatarRelease}
if(require.main===module){try{const i=process.argv.indexOf('--compiled');console.log(JSON.stringify(verifyAvatarRelease(undefined,i>=0?process.argv[i+1]:undefined)))}catch(error){console.error('Avatar release blocked: '+error.message);process.exitCode=1}}
