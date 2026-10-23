import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import StationServiceView from '../StationServiceView.vue'
import * as api from '@/api/serviceStation'
import { setLocale, t } from '@/i18n'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { stationId: 'test-east' } }) }))
vi.mock('virtual:server-info', () => ({ serverIP: '192.168.1.100', serverPort: 5173 }))
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,dGVzdA==') }
}))
vi.mock('@/components/DigitalAvatarPlayer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/api/serviceStation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/serviceStation')>()
  return {
    ...original,
    getStation: vi.fn(),
    heartbeatStation: vi.fn(),
    beginStationVisit: vi.fn(),
    endStationVisit: vi.fn(),
    extendStationVisit: vi.fn(),
    planAtStation: vi.fn(),
    consultStation: vi.fn(),
    speakAtStation: vi.fn(),
    shareStationPlan: vi.fn(),
    stationShareStatus: vi.fn(),
    stationDirections: vi.fn()
  }
})
const anchor = { node_id: 1, latitude: 40, longitude: 116, label: '接待站' }
const spot = {
  spot_id: 1,
  spot_name: '长廊',
  category: 'cultural',
  description: '景点介绍',
  history_detail: '历史介绍',
  photo_tips: '',
  tour_tips: '',
  service_facilities: '',
  image_path: '',
  visit_duration: 12,
  location: ''
}
const catalog: api.StationCatalog = {
  station: {
    station_id: 'test-east',
    name: '接待站',
    name_en: 'Service station',
    location: '东门',
    location_en: 'East gate',
    anchor,
    default_language: 'zh',
    welcome: '欢迎咨询',
    welcome_en: 'Welcome',
    idle_seconds: 60,
    volume: 0.7,
    demo: true,
    revision: 1,
    announcements: [],
    facilities: []
  },
  guide: null,
  spots: [spot],
  network_version: 'v1',
  catalog_version: 'c1'
}
const plan: api.StationPlan = {
  plan_id: 'p1',
  kind: 'balanced',
  title: '推荐',
  title_en: 'Recommended',
  station: catalog.station,
  guide: null,
  preferences: api.defaultStationPreferences(),
  network_version: 'v1',
  generated_at: '',
  version: 1,
  route: {
    stops: [
      { spot_id: 1, spot_name: '长廊', order: 1, latitude: 40, longitude: 116, visit_minutes: 12 }
    ],
    legs: [],
    walking_meters: 1200,
    walking_minutes: 16,
    exit_minutes: 8,
    visit_minutes: 12,
    rest_minutes: 3,
    total_minutes: 39,
    complete: true,
    pace: 'standard',
    distance_version: 'v1',
    note: ''
  }
}
const visit = { visit_id: 'v1', access_token: 'private-token', expires_at: '' }
const stub = defineComponent({ template: '<div/>' })
const avatarStub = defineComponent({
  props: ['stationVisit', 'stationMode', 'width', 'posterImage'],
  methods: { stop() {} },
  template: '<div class="live-avatar-stub" />'
})
let wrapper: ReturnType<typeof mount>
function render() {
  wrapper = mount(StationServiceView, {
    global: {
      mocks: { $t: t },
      stubs: {
        BrandLogo: stub,
        DigitalAvatarPlayer: avatarStub,
        ScenicSpotCover: stub,
        ScenicVisitContext: stub,
        RouteOverview: stub,
        TourVisualContext: stub,
        StationDirectionsMap: stub,
        Transition: true
      }
    }
  })
  return wrapper
}
const button = (text: string) => wrapper.findAll('button').find((b) => b.text().includes(text))!
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  setLocale('zh')
  localStorage.clear()
  vi.mocked(api.getStation).mockResolvedValue(structuredClone(catalog))
  vi.mocked(api.heartbeatStation).mockResolvedValue({
    revision: 1,
    network_version: 'v1',
    catalog_version: 'c1'
  })
  vi.mocked(api.beginStationVisit).mockResolvedValue(visit)
  vi.mocked(api.endStationVisit).mockResolvedValue({} as any)
  vi.mocked(api.extendStationVisit).mockResolvedValue({} as any)
  vi.mocked(api.planAtStation).mockResolvedValue({ plans: [structuredClone(plan)] })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Fixed service station', () => {
  it('keeps a valid route across language changes and shares the current language', async () => {
    vi.mocked(api.shareStationPlan).mockResolvedValue({
      token: 'claim-token',
      expires_at: new Date(Date.now() + 900000).toISOString()
    })
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    setLocale('en')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Recalculate before pickup')
    const pickup = wrapper.findAll('button').find((b) => b.text().includes('phone'))!
    expect(pickup.attributes('disabled')).toBeUndefined()
    await pickup.trigger('click')
    await flushPromises()
    expect(api.shareStationPlan).toHaveBeenCalledWith(visit, 'p1', undefined, 'en')
    setLocale('zh')
    await flushPromises()
    expect(button('把这条路线带到手机').attributes('disabled')).toBeUndefined()
    expect(api.planAtStation).toHaveBeenCalledTimes(1)
    await button('帮我规划游览').trigger('click')
    await wrapper.get('input[type=number]').setValue(180)
    expect(wrapper.text()).toContain('生成我的游览方案')
  })
  it('restores the canceled question and keeps the previous completed answer paired', async () => {
    const response = {
      answer: '上次完整答案',
      actions: [],
      source: 'local',
      preferences: api.defaultStationPreferences()
    }
    vi.mocked(api.consultStation).mockResolvedValueOnce(response)
    render()
    await flushPromises()
    await button('和数字人聊一聊').trigger('click')
    await flushPromises()
    await wrapper.get('.station-chat-input input').setValue('介绍佛香阁')
    await wrapper.get('.station-chat-input').trigger('submit')
    await flushPromises()
    let resolve!: (data: any) => void
    vi.mocked(api.consultStation).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      })
    )
    await wrapper.get('.station-chat-input input').setValue('介绍德和园')
    await wrapper.get('.station-chat-input').trigger('submit')
    await flushPromises()
    await button('取消').trigger('click')
    expect(wrapper.get('.station-user-question').text()).toBe('介绍佛香阁')
    expect(wrapper.get('.station-answer').text()).toContain('上次完整答案')
    expect((wrapper.get('.station-chat-input input').element as HTMLInputElement).value).toBe(
      '介绍德和园'
    )
    resolve({ ...response, answer: '迟到的德和园答案' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('迟到的德和园答案')
  })
  it('ignores a late answer in the old language after switching language', async () => {
    let resolve!: (data: any) => void
    vi.mocked(api.consultStation).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      })
    )
    render()
    await flushPromises()
    await button('和数字人聊一聊').trigger('click')
    await flushPromises()
    await wrapper.get('.station-chat-input input').setValue('长廊有什么历史故事？')
    await wrapper.get('.station-chat-input').trigger('submit')
    await flushPromises()
    const signal = vi.mocked(api.consultStation).mock.calls[0][2]!
    setLocale('en')
    await flushPromises()
    expect(signal.aborted).toBe(true)
    resolve({
      answer: '旧中文答案',
      actions: [],
      source: 'local',
      preferences: api.defaultStationPreferences()
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('旧中文答案')
    expect(wrapper.find('.station-user-question').exists()).toBe(false)
    expect(wrapper.get('.station-chat-input input').attributes('disabled')).toBeUndefined()
  })
  it('rejects fractional minutes locally with an actionable hint', async () => {
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await wrapper.get('input[type=number]').setValue(60.5)
    expect(wrapper.get('#station-budget-error').text()).toBe('请输入20—480之间的整数分钟')
    expect(button('生成我的游览方案').attributes('disabled')).toBeDefined()
    expect(api.planAtStation).not.toHaveBeenCalled()
    setLocale('en')
    await flushPromises()
    expect(wrapper.get('#station-budget-error').text()).toContain('whole number')
    await wrapper.get('input[type=number]').setValue(60)
    expect(wrapper.find('#station-budget-error').exists()).toBe(false)
  })
  it.each(['wheel', 'touchmove', 'scroll'])(
    'counts %s reading activity, then expires when truly idle',
    async (eventName) => {
      render()
      await flushPromises()
      await button('帮我规划游览').trigger('click')
      await flushPromises()
      const scrollTarget = document.createElement('div')
      document.body.append(scrollTarget)
      try {
        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersByTimeAsync(39000)
          scrollTarget.dispatchEvent(new Event(eventName, { bubbles: eventName !== 'scroll' }))
          await flushPromises()
          expect(wrapper.find('[role=alertdialog]').exists()).toBe(false)
          expect(api.endStationVisit).not.toHaveBeenCalled()
        }
        await vi.advanceTimersByTimeAsync(61000)
        await flushPromises()
        expect(api.endStationVisit).toHaveBeenCalledWith(visit)
        expect(wrapper.find('.station-home-content').exists()).toBe(true)
      } finally {
        scrollTarget.remove()
      }
    }
  )
  it('discards a late microphone transcript after ending the visit', async () => {
    let speech: any
    vi.stubGlobal(
      'SpeechRecognition',
      class {
        constructor() {
          speech = this
        }
        start() {}
        abort() {}
      }
    )
    render()
    await flushPromises()
    await button('和数字人聊一聊').trigger('click')
    await flushPromises()
    await button('说话').trigger('click')
    await button('结束本次使用').trigger('click')
    await button('结束并复位').trigger('click')
    await flushPromises()
    speech.onresult({ results: [[{ transcript: '上一位游客的问题' }]] })
    await button('和数字人聊一聊').trigger('click')
    await flushPromises()
    expect((wrapper.get('.station-chat-input input').element as HTMLInputElement).value).toBe('')
  })

  it('updates the current route directly and keeps the new pickup enabled', async () => {
    vi.mocked(api.consultStation).mockResolvedValue({
      answer: '已更新路线',
      actions: ['plan'],
      source: 'local',
      preferences: { ...plan.preferences, budget: 60 },
      plans: [{ ...plan, plan_id: 'p2', preferences: { ...plan.preferences, budget: 60 } }]
    })
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    await button('时间再短一点').trigger('click')
    await flushPromises()
    expect(api.consultStation).toHaveBeenCalledWith(
      visit,
      expect.objectContaining({ plan_id: 'p1' }),
      expect.any(AbortSignal)
    )
    expect(wrapper.find('.station-result').exists()).toBe(true)
    expect(wrapper.text()).toContain('已更新路线')
    expect(button('把这条路线带到手机').attributes('disabled')).toBeUndefined()
  })
  it('retains the existing route when an edit fails', async () => {
    vi.mocked(api.consultStation).mockRejectedValue({
      response: { status: 422, data: { detail: '已选景点超出时间预算' } }
    })
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    await button('时间再短一点').trigger('click')
    await flushPromises()
    expect(wrapper.find('.station-result').exists()).toBe(true)
    expect(wrapper.text()).toContain('已选景点超出时间预算')
    expect(button('把这条路线带到手机').attributes('disabled')).toBeUndefined()
  })
  it('confirms phone pickup and hides the used QR code', async () => {
    vi.mocked(api.shareStationPlan).mockResolvedValue({
      token: 'claim-token',
      expires_at: new Date(Date.now() + 900000).toISOString()
    })
    vi.mocked(api.stationShareStatus).mockResolvedValue({ status: 'received' })
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    await button('把这条路线带到手机').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    expect(wrapper.text()).not.toContain('在本机预览领取页')
    expect(wrapper.text()).toContain('路线已成功带到手机')
    expect(wrapper.find('.station-share-dialog img').exists()).toBe(false)
    await button('完成，结束本次使用').trigger('click')
    await flushPromises()
    expect(wrapper.find('.station-share-dialog').exists()).toBe(false)
    expect(wrapper.find('.station-home-content').exists()).toBe(true)
  })
  it('does not label an expired consultation as a network outage', async () => {
    vi.mocked(api.getStation).mockResolvedValue({
      ...structuredClone(catalog),
      guide: { guide_id: 1, name: '接待员', render_mode: 'xingyun', poster_image: '' }
    })
    render()
    await flushPromises()
    vi.mocked(api.extendStationVisit).mockRejectedValue({ response: { status: 410 } })
    await vi.advanceTimersByTimeAsync(90000)
    await flushPromises()
    expect(wrapper.find('.station-network').exists()).toBe(false)
  })

  it('uses only concrete route details after a reply containing legacy preferences', async () => {
    vi.mocked(api.consultStation).mockResolvedValue({
      answer: '请确认时间和终点',
      actions: ['plan'],
      source: 'local',
      preferences: {
        ...api.defaultStationPreferences(),
        budget: 180,
        end_area: 'north',
        avoid_steps: true,
        spot_ids: [1],
        interest: 'photo',
        pace: 'relaxed'
      }
    })
    render()
    await flushPromises()
    await button('和数字人聊一聊').trigger('click')
    await flushPromises()
    await wrapper.get('.station-chat-input input').setValue('我有三小时，从北宫门离园')
    await wrapper.get('.station-chat-input').trigger('submit')
    await flushPromises()
    await button('查看路线条件').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('想看什么')
    expect(wrapper.text()).not.toContain('游览节奏')
    expect(wrapper.text()).not.toContain('偏好')
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    expect(api.planAtStation).toHaveBeenCalledWith(
      visit,
      {
        budget: 180,
        end_area: 'north',
        avoid_steps: true,
        spot_ids: [1],
        language: 'zh'
      },
      expect.any(AbortSignal)
    )
  })
  it('shows a compact walking overview for a selected attraction instead of raw road fragments', async () => {
    vi.mocked(api.stationDirections).mockResolvedValue({
      meters: 1374,
      minutes: 19,
      geometry: [
        [40, 116],
        [40.001, 116.001]
      ],
      origin: anchor,
      destination: { ...anchor, label: '长廊' },
      has_steps: true,
      sections: [
        { road_name: '园内步道', meters: 5, steps: false },
        { road_name: '东堤', meters: 400, steps: false },
        { road_name: '园内步道', meters: 4, steps: true }
      ]
    })
    render()
    await flushPromises()
    await button('找景点与设施').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('.station-wayfinding-tabs button')
      .find((b) => b.text() === '景点')!
      .trigger('click')
    await wrapper.get('.station-facility-grid button').trigger('click')
    await flushPromises()
    expect(api.stationDirections).toHaveBeenCalledWith(
      'test-east',
      'spot:长廊',
      expect.any(AbortSignal)
    )
    expect(wrapper.find('.station-walking-directions').exists()).toBe(true)
    expect(wrapper.find('.station-directions-list').exists()).toBe(false)
    expect(wrapper.get('.walking-route-passages').text()).toBe('东堤')
    expect(wrapper.get('.walking-route-steps').text()).toContain('含台阶')
  })
  it('replaces the duplicate chat card with visitor essentials while keeping the live guide chat entrance', async () => {
    render()
    await flushPromises()
    expect(wrapper.text()).not.toContain('问问数字人')
    await button('游园须知').trigger('click')
    await flushPromises()
    expect(wrapper.find('.station-visitor-info').exists()).toBe(true)
    expect(wrapper.text()).toContain('开放时间')
    expect(api.beginStationVisit).not.toHaveBeenCalled()
    await button('和数字人聊一聊').trigger('click')
    await flushPromises()
    expect(wrapper.find('.station-chat').exists()).toBe(true)
    expect(api.beginStationVisit).toHaveBeenCalledTimes(1)
  })
  it('starts with task entrances and creates no tourist session on display', async () => {
    render()
    await flushPromises()
    expect(wrapper.text()).toContain('今天，想怎样游览')
    expect(api.beginStationVisit).not.toHaveBeenCalled()
    expect(wrapper.find('[aria-label="GPS定位"]').exists()).toBe(false)
  })
  it('connects the live receptionist on display without starting the visitor idle countdown', async () => {
    vi.mocked(api.getStation).mockResolvedValue({
      ...catalog,
      guide: { guide_id: 37, name: '文轩', poster_image: '/poster.png', render_mode: 'xingyun' }
    })
    render()
    await flushPromises()
    expect(api.beginStationVisit).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(avatarStub).props('stationVisit')).toEqual(visit)
    expect(wrapper.findComponent(avatarStub).props('posterImage')).toBeUndefined()
    expect(wrapper.findComponent(avatarStub).props('width')).toBe(640)
    expect(wrapper.text()).not.toContain('您现在位于本站')
    expect(wrapper.text()).not.toContain('问得明白')
    expect(wrapper.text()).not.toContain('结束本次使用')
    vi.advanceTimersByTime(180000)
    await flushPromises()
    expect(wrapper.find('[role=alertdialog]').exists()).toBe(false)
    expect(api.endStationVisit).not.toHaveBeenCalled()
  })
  it('revokes the previous consultation and reconnects a fresh receptionist after reset', async () => {
    const fresh = { ...visit, visit_id: 'v2', access_token: 'new-token' }
    vi.mocked(api.getStation).mockResolvedValue({
      ...catalog,
      guide: { guide_id: 37, name: '文轩', poster_image: '', render_mode: 'xingyun' }
    })
    vi.mocked(api.beginStationVisit).mockResolvedValueOnce(visit).mockResolvedValue(fresh)
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    await button('结束本次使用').trigger('click')
    await button('结束并复位').trigger('click')
    await flushPromises()
    expect(api.endStationVisit).toHaveBeenCalledWith(visit)
    expect(api.beginStationVisit).toHaveBeenCalledTimes(2)
    expect(wrapper.findComponent(avatarStub).props('stationVisit')).toEqual(fresh)
    expect(wrapper.text()).not.toContain('结束本次使用')
    vi.advanceTimersByTime(61000)
    await flushPromises()
    expect(wrapper.find('[role=alertdialog]').exists()).toBe(false)
  })
  it('can plan while the initial receptionist credentials are still loading', async () => {
    let resolve!: (v: api.StationVisit) => void
    vi.mocked(api.getStation).mockResolvedValue({
      ...catalog,
      guide: { guide_id: 37, name: '文轩', poster_image: '', render_mode: 'xingyun' }
    })
    vi.mocked(api.beginStationVisit).mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await button('生成我的游览方案').trigger('click')
    resolve(visit)
    await flushPromises()
    expect(api.beginStationVisit).toHaveBeenCalledTimes(1)
    expect(api.planAtStation).toHaveBeenCalledWith(
      visit,
      expect.any(Object),
      expect.any(AbortSignal)
    )
    expect(wrapper.text()).toContain('39 分钟')
  })
  it('offers a retry when the live receptionist credentials fail', async () => {
    vi.mocked(api.getStation).mockResolvedValue({
      ...catalog,
      guide: { guide_id: 37, name: '文轩', poster_image: '', render_mode: 'xingyun' }
    })
    vi.mocked(api.beginStationVisit)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(visit)
    render()
    await flushPromises()
    expect(button('重新连接数字人').exists()).toBe(true)
    await button('重新连接数字人').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(avatarStub).props('stationVisit')).toEqual(visit)
    expect(wrapper.find('.station-avatar-error').exists()).toBe(false)
  })
  it('discards late credentials from a visitor who already ended their visit', async () => {
    let resolveOld!: (v: api.StationVisit) => void
    const fresh = { ...visit, visit_id: 'v2', access_token: 'new-token' }
    vi.mocked(api.getStation).mockResolvedValue({
      ...catalog,
      guide: { guide_id: 37, name: '文轩', poster_image: '', render_mode: 'xingyun' }
    })
    vi.mocked(api.beginStationVisit)
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveOld = r
        })
      )
      .mockResolvedValue(fresh)
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await button('结束本次使用').trigger('click')
    await button('结束并复位').trigger('click')
    await flushPromises()
    resolveOld(visit)
    await flushPromises()
    expect(api.endStationVisit).toHaveBeenCalledWith(visit)
    expect(wrapper.findComponent(avatarStub).props('stationVisit')).toEqual(fresh)
    expect(wrapper.text()).toContain('今天，想怎样游览')
  })
  it('plans from an anonymous station visit and offers a separate phone pickup', async () => {
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    expect(api.planAtStation).toHaveBeenCalledWith(
      visit,
      expect.objectContaining({ budget: 120, end_area: 'east' }),
      expect.any(AbortSignal)
    )
    expect(wrapper.text()).toContain('39 分钟')
    expect(wrapper.text()).toContain('把这条路线带到手机')
  })
  it('retains the chosen attractions and destination when planning with the visible option buttons', async () => {
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    expect(wrapper.find('select[aria-label="选择游览终点"]').exists()).toBe(false)
    const destination = wrapper
      .get('[aria-label="选择游览终点"]')
      .findAll('button')
      .find((b) => b.text().includes('北宫门'))!
    await destination.trigger('click')
    expect(destination.attributes('aria-pressed')).toBe('true')
    await wrapper.get('.station-stop-options button').trigger('click')
    expect(wrapper.get('.station-stop-count').text()).toContain('1')
    await button('清空选择').trigger('click')
    expect(wrapper.get('.station-stop-count').text()).toContain('0')
    await wrapper.get('.station-stop-options button').trigger('click')
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    expect(api.planAtStation).toHaveBeenCalledWith(
      visit,
      expect.objectContaining({ end_area: 'north', spot_ids: [1] }),
      expect.any(AbortSignal)
    )
  })
  it('ending clears the screen and revokes the current consultation', async () => {
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    await wrapper.get('input[type=number]').setValue(180)
    await button('结束本次使用').trigger('click')
    await button('结束并复位').trigger('click')
    await flushPromises()
    expect(api.endStationVisit).toHaveBeenCalledWith(visit)
    expect(wrapper.text()).toContain('今天，想怎样游览')
    expect(wrapper.find('input[type=number]').exists()).toBe(false)
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    expect((wrapper.get('input[type=number]').element as HTMLInputElement).value).toBe('120')
  })
  it('ignores a plan that completes after reset', async () => {
    let resolve!: (v: { plans: api.StationPlan[] }) => void
    vi.mocked(api.planAtStation).mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    await button('生成我的游览方案').trigger('click')
    await flushPromises()
    await button('结束本次使用').trigger('click')
    await button('结束并复位').trigger('click')
    resolve({ plans: [plan] })
    await flushPromises()
    expect(wrapper.text()).toContain('今天，想怎样游览')
    expect(wrapper.find('.station-result').exists()).toBe(false)
  })
  it('warns before idle reset and allows the visitor to keep going', async () => {
    render()
    await flushPromises()
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(41000)
    await flushPromises()
    expect(wrapper.get('[role=alertdialog]').text()).toContain('19')
    await button('我还在，继续使用').trigger('click')
    expect(wrapper.find('[role=alertdialog]').exists()).toBe(false)
    vi.advanceTimersByTime(61000)
    await flushPromises()
    expect(wrapper.text()).toContain('今天，想怎样游览')
    expect(api.endStationVisit).toHaveBeenCalled()
  })
  it('uses cached public facts during network failure and disables online planning', async () => {
    localStorage.setItem(
      'station-public-test-east',
      JSON.stringify({ data: catalog, saved: Date.now() })
    )
    vi.mocked(api.getStation).mockRejectedValue(new Error())
    vi.mocked(api.heartbeatStation).mockRejectedValue(new Error())
    render()
    await flushPromises()
    expect(wrapper.text()).toContain('服务站连接暂不可用')
    await button('帮我规划游览').trigger('click')
    await flushPromises()
    expect(button('生成我的游览方案').attributes('disabled')).toBeDefined()
    expect(api.beginStationVisit).not.toHaveBeenCalled()
  })
  it('does not show an old cached station after the station has been disabled', async () => {
    localStorage.setItem(
      'station-public-test-east',
      JSON.stringify({ data: catalog, saved: Date.now() })
    )
    vi.mocked(api.getStation).mockRejectedValue({
      response: { status: 404, data: { detail: '服务站暂未开放' } }
    })
    render()
    await flushPromises()
    expect(wrapper.text()).toContain('本站暂时无法连接')
    expect(wrapper.text()).not.toContain('今天，想怎样游览')
  })
  it('switches the core task UI into English without changing the fixed origin', async () => {
    render()
    await flushPromises()
    await button('English').trigger('click')
    expect(wrapper.text()).toContain('How would you like to explore?')
    await button('Plan my visit').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Plan your visit')
    expect(wrapper.text()).toContain('East Palace Gate')
    expect(wrapper.text()).toContain('East gate')
  })
})
