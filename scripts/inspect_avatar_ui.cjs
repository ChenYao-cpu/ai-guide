const automator = require('../work_dirs/mini-qa/node_modules/miniprogram-automator')
;(async () => {
  const mini = await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'})
  mini.on('exception', error => console.log('EXCEPTION', error))
  try {
    await mini.evaluate(()=>{wx.reLaunch({url:'/pages/tour-guide/tour-guide'});return true})
    await new Promise(resolve=>setTimeout(resolve,2500))
    await mini.evaluate(()=>{const page=getCurrentPages().slice(-1)[0].$vm;if(!page.guides.length)throw Error('No configured guides');page.goSelectGuide();page.previewGuide(page.guides[0]);return true})
    await new Promise(resolve=>setTimeout(resolve,6000))
    const result=await mini.evaluate(()=>{const page=getCurrentPages().slice(-1)[0].$vm;return {guide:page.previewingGuide.name,model:page.previewingGuide.model3dUrl,width:page.previewWidth,pixelRatio:page.previewPixelRatio,status:page.previewModelStatus}})
    console.log('PREVIEW',result)
    if(result.status)throw Error(result.status)
    // Devtools captureScreenshot does not include the native XR framebuffer.
  } finally {mini.disconnect()}
})().catch(error=>{console.error(error);process.exitCode=1})
