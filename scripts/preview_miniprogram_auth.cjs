const automator = require('../work_dirs/mini-qa/node_modules/miniprogram-automator')
const path = require('node:path')
;(async()=>{
  const mini = await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'})
  try {
    await mini.reLaunch('/pages/auth/auth')
    console.log('PAGE', await mini.evaluate(()=>getCurrentPages().slice(-1)[0].route))
    await Promise.race([
      mini.screenshot({path:path.resolve(__dirname,'../preview-miniprogram-auth.png')}),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Developer-tool screenshot unavailable')),12000))
    ])
    console.log('SCREENSHOT saved')
  } finally { await mini.disconnect() }
})().catch(e=>{console.error(e.message);process.exitCode=1})
