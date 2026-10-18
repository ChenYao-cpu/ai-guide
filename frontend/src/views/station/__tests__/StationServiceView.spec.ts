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
let wrapper: ReturnType<typeof mount>
function render() {
  wrapper = mount(StationServiceView, {
    global: {
      mocks: { $t: t },
      stubs: {
        BrandLogo: stub,
        DigitalAvatarPlayer: stub,
        ScenicSpotCover: stub,
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
})

describe('Fixed service station', () => {
  it('starts with task entrances and creates no tourist session on display', async () => {
    render()
    await flushPromises()
    expect(wrapper.text()).toContain('今天，想怎样游览')
    expect(api.beginStationVisit).not.toHaveBeenCalled()
    expect(wrapper.find('[aria-label="GPS定位"]').exists()).toBe(false)
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
    expect(wrapper.text()).not.toContain('行程已经安排好')
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
    expect(wrapper.text()).toContain('网络暂不可用')
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
    expect(wrapper.text()).toContain('START AT THIS STATION')
    expect(wrapper.text()).toContain('East Palace Gate')
    expect(wrapper.text()).toContain('Service station')
  })
})
