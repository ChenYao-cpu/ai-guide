import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import XingyunGuide from '../XingyunGuide.vue'
import DigitalAvatarPlayer from '../DigitalAvatarPlayer.vue'

const http = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/base', () => ({ request_handler: http }))
vi.mock('@/api/xingyunTour', () => ({ avatarHeaders: () => ({}) }))
vi.mock('../TourAvatar3D.vue', () => ({ default: { render: () => null } }))
let wrapper: VueWrapper | undefined
let callbacks: Record<string, any>
let download: Record<string, any>

beforeEach(() => {
  vi.clearAllMocks()
  http.get.mockResolvedValue({ data: { configured: true, provider: 'xingyun' } })
  callbacks = {}
  download = {}
  vi.stubGlobal('XmovAvatar', class {
    constructor(options: Record<string, any>) { callbacks = options }
    async init(options: Record<string, any>) { download = options }
    destroy() {}
    interactiveidle() {}
    speak() {}
  })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals();vi.useRealTimers() })

describe('数字人加载呈现', () => {
  it('断线后有限重连，旧实例迟到的就绪事件无效',async()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout']})
    wrapper=mount(XingyunGuide,{props:{guideId:37,tourId:90}});await flushPromises()
    const old=callbacks
    callbacks.onInitEvent(4000);await flushPromises()
    download.onClose();await flushPromises()
    expect(wrapper.text()).toContain('自动重连')
    old.onInitEvent(4000);await nextTick()
    expect(wrapper.find('.xingyun-canvas').attributes('style')).toContain('hidden')
    await vi.advanceTimersByTimeAsync(2000);await flushPromises()
    callbacks.onMessage({code:5000,message:'offline'});await flushPromises()
    await vi.advanceTimersByTimeAsync(6000);await flushPromises()
    callbacks.onMessage({code:5000,message:'offline'});await flushPromises()
    expect(wrapper.text()).not.toContain('自动重连')
    expect(wrapper.find('button').text()).toBe('连接数字人')
  })
  it('主动断开后不自动重新连接',async()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout']})
    wrapper=mount(XingyunGuide,{props:{guideId:37,tourId:90}});await flushPromises()
    callbacks.onInitEvent(4000);await flushPromises()
    await wrapper.find('button').trigger('click')
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10000);await flushPromises()
    expect(wrapper.find('.xingyun-canvas').attributes('style')).toContain('hidden')
    expect(wrapper.text()).not.toContain('自动重连')
  })
  it('下载时只显示文字，隐藏头像和画布，准备好后展示画布', async () => {
    wrapper = mount(XingyunGuide, { props: { guideId: 37, tourId: 90, posterImage: '/head.png' } })
    await flushPromises()
    download.onDownloadProgress(42)
    await nextTick()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toBe('数字人正在加载中')
    expect(wrapper.find('.xingyun-canvas').attributes('style')).toContain('visibility: hidden')
    expect(wrapper.findAll('button')).toHaveLength(0)
    callbacks.onInitEvent(4000)
    await nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('.xingyun-canvas').attributes('style')).toContain('visibility: visible')
    expect(wrapper.find('button').text()).toBe('断开连接')
    expect(wrapper.emitted('connected')?.at(-1)).toEqual([true])
  })

  it('连接失败显示重试入口，不用头像替代', async () => {
    wrapper = mount(XingyunGuide, { props: { guideId: 37, tourId: 90, posterImage: '/head.png' } })
    await flushPromises()
    callbacks.onInitEvent(4000)
    callbacks.onMessage({ code: 5000, message: '连接失败' })
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toContain('请重试')
    expect(wrapper.find('.xingyun-canvas').attributes('style')).toContain('visibility: hidden')
    expect(wrapper.find('button').text()).toBe('连接数字人')
  })

  it('查询数字人类型之前也不提前闪现头像', async () => {
    let resolve!: (value: unknown) => void
    http.get.mockImplementation((url: string) => url.startsWith('/avatar/')
      ? new Promise(r => { resolve = r })
      : Promise.resolve({ data: { configured: true, provider: 'xingyun' } }))
    wrapper = mount(DigitalAvatarPlayer, { props: { guideId: 37, tourId: 90, posterImage: '/head.png' } })
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.avatar-loading').text()).toBe('数字人正在加载中')
    resolve({ data: { data: { preferredMode: 'xingyun', realistic: { ready: false }, cartoon: { ready: false } } } })
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.avatar-loading').exists()).toBe(false)
    expect(wrapper.find('.xingyun-guide').isVisible()).toBe(true)
  })
})
