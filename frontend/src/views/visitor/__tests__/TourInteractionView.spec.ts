import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import TourInteractionView from '../TourInteractionView.vue'

const api = vi.hoisted(() => ({ live: vi.fn(), spots: vi.fn(), chat: vi.fn(), end: vi.fn(), push: vi.fn() }))
vi.mock('@/api/visitor', () => ({ getTourLiveInfo: api.live, getVisitorSpotList: api.spots, sendTourChatMessage: api.chat, endTourSession: api.end }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: api.push }) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() }, ElMessageBox: { confirm: vi.fn() } }))
vi.mock('@/composables/useGeolocation', () => ({ useGeolocation: () => ({ closestSpot: ref(null), autoSwitchEnabled: ref(false), isSupported: () => false, stopTracking: vi.fn() }) }))
vi.mock('@/composables/useRecordedSpeech', () => ({ useRecordedSpeech: () => ({ recording: ref(false), recognizing: ref(false), start: vi.fn(), stop: vi.fn() }) }))
vi.mock('@/components/PwaInstallPrompt.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/DigitalAvatarPlayer.vue', () => ({ default: defineComponent({
  setup(_, { expose }) {
    expose({ getMode: async () => 'audio', speak: () => false, acceptPerformance: async () => false, acceptJob: () => false, stop: () => {} })
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
const ok = (data: unknown) => ({ data: { success: true, data } })
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
