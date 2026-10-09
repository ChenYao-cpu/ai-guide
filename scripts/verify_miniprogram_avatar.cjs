// Real UI workflow using Tencent's development-tool SDK. No mocked API/data.
const automator = require('../work_dirs/mini-qa/node_modules/miniprogram-automator')
const path = require('node:path')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
;(async () => {
  const mini = await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'})
  try {
    if(process.argv.includes('--runtime')){
      await mini.evaluate(()=>{const vm=getCurrentPages().slice(-1)[0].$vm;vm.switchMode('cartoon');vm.send('请用两句话介绍仁寿殿')})
      for(let index=0;index<90;index++){
        const result=await mini.evaluate(()=>{const vm=getCurrentPages().slice(-1)[0].$vm;return {guideName:vm.guideName,avatarMode:vm.avatarMode,videoUrl:vm.videoUrl,message:vm.avatarMessage,loading:vm.loading,speaking:vm.speaking}})
        if(result.videoUrl){console.log('RUNTIME VIDEO',result);return}
        await sleep(500)
      }
      throw Error('小程序未生成视频')
    }
    if(process.argv.includes('--inspect')){
      const page=await mini.currentPage()
      console.log('PAGE',page?.path)
      console.log('RUNTIME',await mini.evaluate(()=>{const page=getCurrentPages().slice(-1)[0];const vm=page && page.$vm;return {route:page && page.route,guideName:vm && vm.guideName,guideId:vm && vm.guideId,sessionId:vm && vm.sid,loading:vm && vm.loading,avatarMessage:vm && vm.avatarMessage}}))
      await mini.screenshot({path:path.resolve(__dirname,'../preview-miniprogram.png')})
      console.log('SCREENSHOT saved')
      const notice=await page.$('.avatar-notice')
      console.log('NOTICE',notice?await notice.text():'无提示')
      console.log('VIDEO',!!await page.$('video'))
      await mini.screenshot({path:path.resolve(__dirname,'../preview-miniprogram.png')})
      return
    }
    console.log('Opening tour page')
    const page = await mini.reLaunch('/pages/tour/tour?sessionId=5')
    console.log('Tour opened')
    await page.waitFor('.avatar-mode')
    for(let index=0;index<25;index++){
      const title=await page.$('.nav-title')
      if(title && await title.text()==='小颐')break
      await sleep(500)
    }
    const modes=await page.$$('.avatar-mode')
    for(const mode of modes) if(await mode.text()==='卡通')await mode.tap()
    const input=await page.$('.msg-input')
    await input.input('请用两句话介绍仁寿殿')
    await (await page.$('.send-btn')).tap()
    for(let index=0;index<90;index++){
      const video=await page.$('video')
      if(video){
        console.log('VIDEO',await video.attribute('src'))
        await mini.screenshot({path:path.resolve(__dirname,'../preview-miniprogram.png')})
        console.log('SCREENSHOT saved')
        return
      }
      await sleep(500)
    }
    const notice=await page.$('.avatar-notice')
    await mini.screenshot({path:path.resolve(__dirname,'../preview-miniprogram.png')})
    throw Error('未显示视频：'+(notice?await notice.text():'无状态提示'))
  } finally { mini.disconnect() }
})().catch(error=>{console.error(error.message);process.exitCode=1})
