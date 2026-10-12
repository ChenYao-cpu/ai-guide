import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import VisitorHomeView from '../VisitorHomeView.vue'
import { wgs84ToGcj02 } from '../../../../../shared/coordinates.js'
import locations from '../../../../../data/summer_palace_locations.json'

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
let leaflet: any
let mapMock: any
let markers: any[]
let resizeMap: () => void
const button = (text: string) => wrapper.findAll('button').find(item => item.text() === text)!
const chooseGuide = async (name: string) => {
  await button('选择数字人').trigger('click')
  await wrapper.findAll('.model-card').find(item => item.text().includes(name))!.trigger('click')
}

describe('scenic map viewport and coordinate anchors', () => {
  it('fits unpadded scenic points with fractional zoom and prevents a city-wide view', () => {
    expect(leaflet.map.mock.calls[0][1]).toMatchObject({ zoomSnap: 0.25, zoomDelta: 0.5, maxBoundsViscosity: 1 })
    const [bounds, options] = mapMock.fitBounds.mock.calls[0]
    expect(bounds.points[0]).toEqual(wgs84ToGcj02(locations.spots['仁寿殿'].latitude,locations.spots['仁寿殿'].longitude))
    expect(bounds.pad).toHaveBeenCalledWith(0.12)
    expect(options).toEqual({ padding: [20,20], maxZoom: 16, animate: false })
    expect(mapMock.setMinZoom).toHaveBeenCalledWith(15.75)
  })
  it('keeps the coordinate at the circle centre when selected and keeps the current viewport', async () => {
    const point = [...markers[0].point]
    expect(markers[0].options.icon.iconAnchor).toEqual([14,14])
    await wrapper.find('.route-card').trigger('click')
    await flushPromises()
    expect(markers[0].point).toEqual(point)
    expect(markers[0].options.icon.iconSize).toEqual([28,28])
    expect(markers[0].options.icon.iconAnchor).toEqual([14,14])
    expect(markers[0].options.icon.html).toContain('box-sizing:border-box')
    expect(markers[0].options.icon.html).not.toContain('transition:all')
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(1)
  })
  it('opens the exact stop at zoom 18 and refits the scenic overview after a narrow resize', async () => {
    await wrapper.findAll('.map-spot-tag')[0].trigger('click')
    expect(mapMock.setView).toHaveBeenCalledWith(markers[0].point,18,{ animate:false })
    mapMock.getBoundsZoom.mockReturnValue(14.4)
    resizeMap()
    expect(mapMock.setMinZoom).toHaveBeenLastCalledWith(14.25)
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(1)
    await button('景区全景').trigger('click')
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(2)
    resizeMap()
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(3)
  })
  it('does not compute a broken zoom limit when personalization hides the map', () => {
    mapMock.getSize.mockReturnValue({ x:0,y:0 })
    resizeMap()
    expect(mapMock.getBoundsZoom).toHaveBeenCalledTimes(1)
    expect(mapMock.setMinZoom).toHaveBeenCalledTimes(1)
    mapMock.getSize.mockReturnValue({ x:320,y:280 })
    resizeMap()
    expect(mapMock.getBoundsZoom).toHaveBeenCalledTimes(2)
  })
})

beforeEach(async () => {
  vi.clearAllMocks()
  markers = []
  mapMock = {
    on: vi.fn(), fitBounds: vi.fn(), closePopup: vi.fn(), setView: vi.fn(),
    setMinZoom: vi.fn(), setMaxBounds: vi.fn(), removeLayer: vi.fn(), remove: vi.fn(),
    invalidateSize: vi.fn(), getBoundsZoom: vi.fn().mockReturnValue(15.9),
    getSize: vi.fn().mockReturnValue({ x:900,y:350 }),
  }
  leaflet = {
    map: vi.fn(() => mapMock), point: (x: number,y: number) => [x,y],
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })), divIcon: vi.fn(options => options),
    latLngBounds: vi.fn(() => {
      const points: number[][] = []
      return { points, extend: (p: number[]) => points.push(p), isValid: () => points.length > 0,
        pad: vi.fn((ratio: number) => ({ points, ratio })) }
    }),
    marker: vi.fn((point: number[], options: any) => {
      const marker: any = { point, options, getLatLng: () => marker.point,
        addTo: () => marker, bindPopup: vi.fn(), on: vi.fn(), openPopup: vi.fn(), remove: vi.fn(),
        setIcon: vi.fn((icon: any) => { marker.options.icon = icon; return marker }),
        setLatLng: vi.fn((p: number[]) => { marker.point = p; return marker }) }
      markers.push(marker)
      return marker
    }),
  }
  vi.stubGlobal('L', leaflet)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resizeMap = callback }
    observe() {}
    disconnect() {}
  })
  api.spots.mockResolvedValue(response({ spot_list: [
    { ...locations.spots['仁寿殿'], spot_id: 1, spot_name: '仁寿殿', category: 'historical', visit_duration: 20 },
    { ...locations.spots['昆明湖'], spot_id: 2, spot_name: '昆明湖', category: 'natural', visit_duration: 30 },
  ] }))
  api.guides.mockResolvedValue(response({ guide_list: [
    { guide_id: 11, name: '小颐' }, { guide_id: 12, name: '宫苑先生' },
  ] }))
  api.routes.mockResolvedValue(response({ route_list: [{ route_id: 7, name: '经典路线', spot_ids: [1], spot_count: 1, spot_names: ['仁寿殿'] }] }))
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
  it('switches the entire planner while preserving selected stop IDs and nickname', async () => {
    await wrapper.find('.route-card').trigger('click')
    await wrapper.find('input[aria-label="导览昵称"]').setValue('原始昵称')
    await button('English').trigger('click')
    expect(wrapper.find('.visitor-intro h2').text()).toBe('Plan your visit')
    expect(wrapper.find('.route-card').text()).toContain('Hall of Benevolence and Longevity')
    expect((wrapper.find('input[aria-label="Tour Nickname"]').element as HTMLInputElement).value).toBe('原始昵称')
    expect(wrapper.find('button[aria-label="Deselect stop: Hall of Benevolence and Longevity"]').attributes('aria-pressed')).toBe('true')
    expect(api.spots).toHaveBeenCalledTimes(1)
    await button('中文').trigger('click')
    expect(wrapper.find('button[aria-label="取消选择 仁寿殿"]').attributes('aria-pressed')).toBe('true')
    expect((wrapper.find('input[aria-label="导览昵称"]').element as HTMLInputElement).value).toBe('原始昵称')
  })

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
    expect(api.recommend).toHaveBeenCalledWith(['nature'], { time_budget_minutes: 90, pace: 'relaxed', start_area: 'east', end_area: 'east', queue_reserve_minutes: 10, excluded_spot_ids: [] })
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
