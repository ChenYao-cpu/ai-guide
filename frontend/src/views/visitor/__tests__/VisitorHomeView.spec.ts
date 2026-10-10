import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import VisitorHomeView from '../VisitorHomeView.vue'

const api = vi.hoisted(() => ({
  spots: vi.fn(), guides: vi.fn(), routes: vi.fn(), recommend: vi.fn(), ai: vi.fn(), push: vi.fn(),
}))
vi.mock('@/api/visitor', () => ({
  getVisitorSpotList: api.spots, getVisitorGuideList: api.guides, getVisitorRouteList: api.routes,
  getRouteRecommendation: api.recommend, aiChatRecommend: api.ai,
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: api.push }) }))
vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
  ElMessageBox: { confirm: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/components/PwaInstallPrompt.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/QrFloating.vue', () => ({ default: { render: () => null } }))

const Input = defineComponent({
  inheritAttrs: false, props: ['modelValue', 'disabled', 'placeholder', 'size'], emits: ['update:modelValue'],
  setup: (props, { attrs, emit }) => () => h('input', {
    ...attrs, value: props.modelValue, disabled: props.disabled, placeholder: props.placeholder,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
  }),
})
const Button = defineComponent({
  inheritAttrs: false, props: ['disabled', 'loading'],
  setup: (props, { attrs, slots }) => () => h('button', { ...attrs, disabled: props.disabled || props.loading }, slots.default?.()),
})
const Dialog = defineComponent({
  props: ['modelValue'], setup: (props, { slots }) => () => props.modelValue ? h('div', slots.default?.()) : null,
})
const response = (data: unknown) => ({ data: { code: 0, data } })
let wrapper: VueWrapper
let fetchMock: ReturnType<typeof vi.fn>
const button = (text: string) => wrapper.findAll('button').find(item => item.text() === text)!
const chooseGuide = async (name: string) => {
  await button('选择数字人').trigger('click')
  await wrapper.findAll('.model-card').find(item => item.text().includes(name))!.trigger('click')
}

beforeEach(async () => {
  vi.clearAllMocks()
  api.spots.mockResolvedValue(response({ spot_list: [
    { spot_id: 1, spot_name: '仁寿殿', category: 'historical', visit_duration: 20 },
    { spot_id: 2, spot_name: '昆明湖', category: 'natural', visit_duration: 30 },
  ] }))
  api.guides.mockResolvedValue(response({ guide_list: [
    { guide_id: 11, name: '小颐' }, { guide_id: 12, name: '宫苑先生' },
  ] }))
  api.routes.mockResolvedValue(response({ route_list: [{ route_id: 7, name: '经典路线', spot_ids: [1], spot_count: 1 }] }))
  api.recommend.mockResolvedValue(response({ name: '湖景路线', spot_ids: [2], spot_names: ['昆明湖'], spot_count: 1 }))
  api.ai.mockResolvedValue(response({ spot_ids: [2], spot_count: 1, ai_response: '推荐昆明湖', preferences: ['nature'] }))
  fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: { session_id: 90 } }) })
  vi.stubGlobal('fetch', fetchMock)
  wrapper = mount(VisitorHomeView, {
    global: {
      stubs: { ElInput: Input, ElButton: Button, ElDialog: Dialog, ElDrawer: Dialog, ElIcon: true, ElTag: true, ScenicVisitContext: true },
      directives: { loading: () => {} },
    },
  })
  await flushPromises()
})
afterEach(() => { wrapper.unmount(); vi.unstubAllGlobals() })

describe('independent visitor planning flows', () => {
  it('uses the mobile tour destination when mounted by the mobile entry', async () => {
    await wrapper.setProps({ tourPathPrefix: '/m/tour/' })
    await wrapper.find('.route-card').trigger('click')
    await chooseGuide('小颐')
    await button('开始导览').trigger('click')
    await flushPromises()
    expect(api.push).toHaveBeenCalledWith({ path: '/m/tour/90' })
  })

  it('sends time, pace and starting area and shows concrete selection reasons', async () => {
    api.recommend.mockResolvedValue(response({ name: '自然风光路线', spot_ids: [2], spot_names: ['昆明湖'], spot_count: 1,
      estimated_time_minutes: 85, requested_time_minutes: 90, visit_time_minutes: 30, walking_time_minutes: 45, rest_time_minutes: 10,
      recommendation_explanation: '含步行和休息', score_details: [{ spot_id: 2, reason: '岸边观察湖面与水岸' }] }))
    await button('个性化').trigger('click')
    await wrapper.findAll('.pref-card')[1].trigger('click')
    await wrapper.find('select[aria-label="可用时长"]').setValue('90')
    await wrapper.find('select[aria-label="步行节奏"]').setValue('relaxed')
    await wrapper.find('select[aria-label="出发区域"]').setValue('east')
    await button('生成个性化路线').trigger('click')
    await flushPromises()
    expect(api.recommend).toHaveBeenCalledWith(['nature'], { time_budget_minutes: 90, pace: 'relaxed', start_area: 'east' })
    expect(wrapper.find('.plan-metrics').text()).toContain('步行 45 分钟')
    expect(wrapper.find('.itinerary-reason').text()).toBe('岸边观察湖面与水岸')
    await chooseGuide('小颐')
    expect(button('开始导览').attributes('disabled')).toBeUndefined()
    await wrapper.find('select[aria-label="可用时长"]').setValue('120')
    expect(wrapper.find('[role="status"]').text()).toContain('重新生成')
    expect(button('开始导览').attributes('disabled')).toBeDefined()
  })

  it('keeps comprehensive exclusive from individual interests', async () => {
    await button('个性化').trigger('click')
    await wrapper.findAll('.pref-card')[0].trigger('click')
    await wrapper.findAll('.pref-card')[1].trigger('click')
    await wrapper.findAll('.pref-card')[4].trigger('click')
    expect(wrapper.findAll('.pref-card.selected').length).toBe(1)
    await button('生成个性化路线').trigger('click')
    await flushPromises()
    expect(api.recommend.mock.calls[0][0]).toEqual(['comprehensive'])
    await wrapper.findAll('.pref-card')[3].trigger('click')
    expect(wrapper.findAll('.pref-card.selected').length).toBe(1)
    expect(wrapper.findAll('.pref-card')[4].attributes('aria-pressed')).toBe('false')
  })

  it('starts a browsed route with a guide and no preference requirement', async () => {
    expect(wrapper.find('.ai-chat-panel').isVisible()).toBe(false)
    await wrapper.find('.route-card').trigger('click')
    await chooseGuide('小颐')
    expect(wrapper.findAll('.menu-item')[0].attributes('aria-pressed')).toBe('true')
    expect(button('开始导览').attributes('disabled')).toBeUndefined()
    await button('开始导览').trigger('click')
    await flushPromises()
    const params = new URL(fetchMock.mock.calls[0][0], 'http://localhost').searchParams
    expect(params.get('guide_id')).toBe('11')
    expect(params.get('route_id')).toBe('7')
    expect(params.get('spot_ids')).toBe('[1]')
    expect(params.get('visitor_preferences')).toBe('')
    expect(api.push).toHaveBeenCalledWith({ path: '/visitor/90' })
  })

  it('preserves each module’s spots and guide when switching', async () => {
    await wrapper.find('.route-card').trigger('click')
    await chooseGuide('小颐')
    await button('个性化').trigger('click')
    expect(wrapper.find('.start-summary').text()).toContain('0 个景点')
    await wrapper.findAll('.pref-card')[1].trigger('click')
    await button('生成个性化路线').trigger('click')
    await flushPromises()
    await chooseGuide('宫苑先生')
    expect(wrapper.find('.personal-itinerary').text()).toContain('昆明湖')
    await button('浏览路线').trigger('click')
    expect(wrapper.find('.chosen-guide').text()).toBe('小颐')
    expect(wrapper.find('.spot-selection-summary').text()).toContain('仁寿殿')
    expect(wrapper.find('.route-card').classes()).toContain('selected')
    await button('个性化').trigger('click')
    expect(wrapper.find('.chosen-guide').text()).toBe('宫苑先生')
    await button('开始导览').trigger('click')
    await flushPromises()
    const params = new URL(fetchMock.mock.calls[0][0], 'http://localhost').searchParams
    expect(params.get('guide_id')).toBe('12')
    expect(params.get('route_id')).toBe('0')
    expect(params.get('spot_ids')).toBe('[2]')
    expect(params.get('visitor_preferences')).toBe('nature')
  })

  it('keeps AI results in personal planning and allows starting without preference chips', async () => {
    api.ai.mockResolvedValue(response({ spot_ids: [2], ai_response: '推荐昆明湖', spot_count: 1 }))
    await button('个性化').trigger('click')
    await wrapper.find('input[aria-label="游览需求"]').setValue('自然风光半小时')
    await wrapper.find('button[aria-label="发送游览需求"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.menu-item')[1].attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.personal-itinerary').text()).toContain('昆明湖')
    await chooseGuide('小颐')
    expect(button('开始导览').attributes('disabled')).toBeUndefined()
    await button('开始导览').trigger('click')
    await flushPromises()
    expect(new URL(fetchMock.mock.calls[0][0], 'http://localhost').searchParams.get('visitor_preferences')).toBe('')
  })

  it('does not overwrite a browsed route when an AI request completes after switching', async () => {
    let complete!: (value: unknown) => void
    api.ai.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    await wrapper.find('.route-card').trigger('click')
    await button('个性化').trigger('click')
    await wrapper.find('input[aria-label="游览需求"]').setValue('游览湖景')
    await wrapper.find('button[aria-label="发送游览需求"]').trigger('click')
    await button('浏览路线').trigger('click')
    complete(response({ spot_ids: [2], ai_response: '推荐昆明湖' }))
    await flushPromises()
    expect(wrapper.findAll('.menu-item')[0].attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.spot-selection-summary').text()).toContain('仁寿殿')
    expect(wrapper.find('.spot-selection-summary').text()).not.toContain('昆明湖')
    await button('个性化').trigger('click')
    expect(wrapper.find('.personal-itinerary').text()).toContain('昆明湖')
  })

  it('clears the preset route binding when its spots are edited', async () => {
    await wrapper.find('.route-card').trigger('click')
    await wrapper.find('button[aria-label="选择景点 昆明湖"]').trigger('click')
    await chooseGuide('小颐')
    await button('开始导览').trigger('click')
    await flushPromises()
    const params = new URL(fetchMock.mock.calls[0][0], 'http://localhost').searchParams
    expect(params.get('route_id')).toBe('0')
    expect(params.get('spot_ids')).toBe('[1,2]')
  })
})
