import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import TourInteractionView from '../TourInteractionView.vue'

const api = vi.hoisted(() => ({ live: vi.fn(), spots: vi.fn(), chat: vi.fn(), end: vi.fn(), push: vi.fn() }))
const avatarSpeak = vi.hoisted(() => vi.fn(() => false))
vi.mock('@/api/visitor', () => ({ getTourLiveInfo: api.live, getVisitorSpotList: api.spots, sendTourChatMessage: api.chat, endTourSession: api.end }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: api.push }) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() }, ElMessageBox: { confirm: vi.fn() } }))
vi.mock('@/composables/useGeolocation', () => ({ useGeolocation: () => ({ closestSpot: ref(null), autoSwitchEnabled: ref(false), isSupported: () => false, stopTracking: vi.fn() }) }))
vi.mock('@/composables/useRecordedSpeech', () => ({ useRecordedSpeech: () => ({ recording: ref(false), recognizing: ref(false), start: vi.fn(), stop: vi.fn() }) }))
vi.mock('@/components/PwaInstallPrompt.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/DigitalAvatarPlayer.vue', () => ({ default: defineComponent({
  setup(_, { expose }) {
    expose({ getMode: async () => 'audio', speak: avatarSpeak, acceptPerformance: async () => false, acceptJob: () => false, stop: () => {} })
    return () => h('div', { class: 'test-avatar' })
  },
}) }))

const Button = defineComponent({
  inheritAttrs: false, props: ['disabled', 'loading'],
  setup: (props, { attrs, slots }) => () => h('button', { ...attrs, disabled: props.disabled || props.loading }, slots.default?.()),
})
const Input = defineComponent({
  props: ['modelValue', 'disabled'], emits: ['update:modelValue'],
  setup: (props, { attrs, emit }) => () => h('textarea', { ...attrs, value: props.modelValue, disabled: props.disabled, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }),
})
const Dialog = defineComponent({
  props: ['modelValue'], setup: (props, { slots }) => () => props.modelValue ? h('div', [...(slots.default?.() || []), ...(slots.footer?.() || [])]) : null,
})
const spots = [{ spot_id: 1, spot_name: '仁寿殿' }, { spot_id: 2, spot_name: '长廊' }, { spot_id: 3, spot_name: '昆明湖' }]
const ok = <T>(data: T) => ({ data: { success: true, data } })
const session = (index = 0) => ok({
  session_id: 90, name: '测试游客的导览', visitor_preferences: JSON.stringify({ spot_ids: [1, 2, 3] }),
  guide_info: { guide_id: 11, name: '文轩' }, route_info: { name: '经典路线' }, conversation: [],
  current_spot_info: spots[index], next_spot_info: spots[index + 1], current_spot_index: index, final_spot: index === 2,
})
let wrapper: VueWrapper
let play: MockInstance<[], Promise<void>>
let fetchMock: ReturnType<typeof vi.fn>
const button = (text: string) => wrapper.findAll('button').find(item => item.text() === text)!
const mountTour = async () => {
  wrapper = mount(TourInteractionView, { props: { sessionId: '90' }, global: { stubs: { ElButton: Button, ElInput: Input, ElDialog: Dialog, ElIcon: true, ElTooltip: true } } })
  await flushPromises()
}

beforeEach(async () => {
  vi.clearAllMocks()
  sessionStorage.removeItem('tour-language-90')
  localStorage.removeItem('tour-large-reading')
  localStorage.removeItem('tour-text-only')
  api.live.mockResolvedValue(session())
  api.spots.mockResolvedValue(ok({ spot_list: spots }))
  api.chat.mockResolvedValue(ok({ message: '这里是景点介绍。', ttsAudioUrl: '/api/v1/files/voice.wav', aiMeta: { spotContext: '仁寿殿', references: ['景区档案'] } }))
  fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) })
  vi.stubGlobal('fetch', fetchMock)
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function(this: HTMLMediaElement) { this.dispatchEvent(new Event('play')); return Promise.resolve() })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function(this: HTMLMediaElement) { this.dispatchEvent(new Event('pause')) })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await mountTour()
})
afterEach(() => { wrapper.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('网页导览顶部路线流程', () => {
  it('儿童讲解与大字模式保留当前路线，模式传递到后端', async () => {
    await wrapper.find('[aria-label="讲解方式"]').setValue('child')
    await button('大字阅读').trigger('click')
    expect(wrapper.classes()).toContain('large-reading')
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(api.chat.mock.calls[0][5].explanation_mode).toBe('child')
    expect(wrapper.find('.current-stop strong').text()).toBe('仁寿殿')
    expect(localStorage.getItem('tour-large-reading')).toBe('true')
  })

  it('仅文字不启动语音，慢速明确走合成音频而非星云默认语速', async () => {
    await button('仅文字').trigger('click')
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(avatarSpeak).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
    expect(api.chat.mock.calls[0][5].text_only).toBe(true)
    await button('仅文字').trigger('click')
    await button('慢速语音').trigger('click')
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(api.chat.mock.calls[1][5].speech_rate).toBe(0.8)
    expect(avatarSpeak).not.toHaveBeenCalled()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('来源原文以文本显示，保留片段版本而不执行其中HTML', async () => {
    api.chat.mockResolvedValue(ok({message:'讲解',aiMeta:{spotContext:'长廊',evidence:[{
      id:'abc',document:'长廊.md',spot:'长廊',excerpt:'<img src=x onerror=alert(1)>',version:'123'
    }]}}))
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(wrapper.find('.evidence-excerpts').text()).toContain('版本 123')
    expect(wrapper.find('.evidence-excerpts img').exists()).toBe(false)
    expect(wrapper.find('.evidence-excerpts').text()).toContain('<img')
  })

  it('英文模式传递语言并播报英文，切回中文保留对话和当前路线', async () => {
    api.chat.mockResolvedValue(ok({ message: 'The Long Corridor is 728 metres long.', spokenText: 'The Long Corridor is 728 metres long.', language: 'en' }))
    await button('English').trigger('click')
    expect(button('English').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.chat-heading h2').text()).toBe('Scenic Q&A')
    await button('History').trigger('click')
    await flushPromises()
    expect(api.chat.mock.calls[0][5].language).toBe('en')
    expect(avatarSpeak).toHaveBeenCalledWith('The Long Corridor is 728 metres long.')
    expect(wrapper.find('.current-stop strong').text()).toBe('Hall of Benevolence and Longevity')
    expect(wrapper.find('.banner-right').text()).toContain('End tour')
    await button('中文').trigger('click')
    expect(button('中文').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.guide-msg').text()).toContain('728 metres')
    expect(wrapper.find('.chat-heading h2').text()).toBe('景区问答')
    expect(wrapper.find('.current-stop strong').text()).toBe('仁寿殿')
    expect(api.live).toHaveBeenCalledTimes(1)
  })

  it('自选路线直接使用会话中的景点顺序，不依赖第二次景点列表请求', async () => {
    wrapper.unmount()
    const data = session().data.data
    api.live.mockResolvedValue(ok({ ...data, route_info: null, route_spots: spots }))
    api.spots.mockRejectedValue(new Error('spot list unavailable'))
    api.spots.mockClear()
    await mountTour()
    expect(wrapper.find('.current-stop strong').text()).toBe('仁寿殿')
    expect(wrapper.find('.next-stop strong').text()).toBe('长廊')
    expect(wrapper.find('.later-stop strong').text()).toBe('昆明湖')
    expect(api.spots).not.toHaveBeenCalled()
  })

  it('接口成功但没有路线景点时显示可重试提示，不一直加载或发送无景点问题', async () => {
    wrapper.unmount()
    api.live.mockResolvedValue(ok({ ...session().data.data, current_spot_info: null,
      next_spot_info: null, visitor_preferences: '{}', route_spots: [],
      route_error: '本次导览没有景点，请重新规划行程' }))
    await mountTour()
    expect(wrapper.find('[role="alert"]').text()).toContain('重新规划行程')
    expect(wrapper.find('.flow-loading').exists()).toBe(false)
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(api.chat).not.toHaveBeenCalled()
  })

  it('digital human reads spoken text while full detail and clickable sources remain on screen', async () => {
    api.chat.mockResolvedValue(ok({ message: '这里是详细说明，屏幕可以展开阅读。', spokenText: '这里是简洁口语讲解。', aiMeta: {
      spotContext: '仁寿殿', sources: [{ id: 'official', title: '官方资料', url: 'https://www.summerpalace.net.cn/' }]
    } }))
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(avatarSpeak).toHaveBeenCalledWith('这里是简洁口语讲解。')
    expect(wrapper.find('.guide-msg').text()).toContain('详细说明')
    expect(wrapper.find('.msg-sources a').attributes('href')).toBe('https://www.summerpalace.net.cn/')
  })
  it('问答绑定当前站，顶部显示下一站与下下一站', async () => {
    const flow = wrapper.find('.banner-route-flow')
    expect(flow.find('.current-stop').text()).toBe('当前站仁寿殿')
    expect(flow.find('.next-stop').text()).toBe('下一站长廊')
    expect(flow.find('.later-stop').text()).toBe('下下一站昆明湖')
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(api.chat.mock.calls[0].slice(2, 5)).toEqual([1, 2, 'audio'])
    expect(wrapper.find('.msg-sources').text()).toContain('景区档案')
  })

  it('开始导览只关闭介绍，不自动生成景点讲解', async () => {
    await button('开始导览').trigger('click')
    await flushPromises()
    expect(api.chat).not.toHaveBeenCalled()
    expect(wrapper.find('.route-panel').exists()).toBe(false)
    expect(wrapper.find('.guide-toolbar').exists()).toBe(false)
  })

  it('自动播放失败仍保留文字答复', async () => {
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('语音未播放，可查看文字')
    expect(wrapper.find('.guide-msg').text()).toContain('这里是景点介绍')
    expect(api.chat).toHaveBeenCalledTimes(1)
  })

  it('慢速音频不可用时保留答复并提示，不回退到星云默认音色', async () => {
    api.chat.mockResolvedValue(ok({ message: '这里是景点介绍。', ttsAudioUrl: '' }))
    await button('慢速语音').trigger('click')
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(avatarSpeak).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
    expect(wrapper.find('.guide-msg').text()).toContain('景点介绍')
    expect(wrapper.text()).toContain('语音未播放，可查看文字')
  })

  it('顶部下一站防止重复切换，切换后更新流程和问答上下文', async () => {
    let finish!: (value: unknown) => void
    fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve }))
    api.live.mockResolvedValue(session(1))
    await wrapper.find('.next-stop').trigger('click')
    await wrapper.find('.next-stop').trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    finish({ json: async () => ({ success: true }) })
    await flushPromises()
    expect(wrapper.find('.current-stop strong').text()).toBe('长廊')
    expect(wrapper.find('.next-stop strong').text()).toBe('昆明湖')
    expect(wrapper.find('.later-stop').exists()).toBe(false)
    expect(api.chat).not.toHaveBeenCalled()
    await button('历史故事').trigger('click')
    await flushPromises()
    expect(api.chat.mock.calls[0][2]).toBe(2)
  })

  it('最后一站不再提供下一站操作', async () => {
    wrapper.unmount()
    api.live.mockResolvedValue(session(2))
    await mountTour()
    expect(wrapper.find('.current-stop strong').text()).toBe('昆明湖')
    expect(wrapper.find('.next-stop').exists()).toBe(false)
    expect(wrapper.find('.flow-end').text()).toBe('最后一站')
  })

  it('失败的提问恢复输入，方便修改后重试', async () => {
    api.chat.mockRejectedValueOnce(new Error('network'))
    await wrapper.find('textarea').setValue('附近有休息处吗？')
    await button('发送').trigger('click')
    await flushPromises()
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('附近有休息处吗？')
    expect(button('发送').attributes('disabled')).toBeUndefined()
  })

  it('会话加载失败可重试，恢复后再显示下一站', async () => {
    wrapper.unmount()
    api.live.mockRejectedValueOnce(new Error('network'))
    await mountTour()
    expect(wrapper.find('[role="alert"]').text()).toContain('重新加载')
    expect(wrapper.find('.next-stop').exists()).toBe(false)
    await button('重新加载').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.next-stop').attributes('disabled')).toBeUndefined()
  })
})
