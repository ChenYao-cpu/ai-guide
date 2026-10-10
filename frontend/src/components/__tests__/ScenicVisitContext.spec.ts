import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ScenicVisitContext from '../ScenicVisitContext.vue'

let wrapper: VueWrapper | undefined
const props = { latitude: 39.999, longitude: 116.273, spotCount: 6, routeCount: 3, guideCount: 3 }
const forecast = (temperature = 0) => ({
  ok: true,
  json: async () => ({
    current: { time: '2026-10-10T17:00', temperature_2m: temperature, weather_code: 0, relative_humidity_2m: 35, wind_speed_10m: 8.7 },
    daily: { temperature_2m_max: [27], temperature_2m_min: [15], precipitation_probability_max: [0] },
  }),
})
const render = () => mount(ScenicVisitContext, { props, global: { stubs: { ElIcon: true } } })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals() })

describe('scenic weather information', () => {
  it('displays zero values and sends only scenic coordinates without credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(forecast())
    vi.stubGlobal('fetch', fetchMock)
    wrapper = render()
    await flushPromises()
    expect(wrapper.find('.weather-current strong').text()).toBe('0°C')
    expect(wrapper.find('.weather-details dd').text()).toBe('0%')
    expect(wrapper.find('.context-counts').text()).toContain('6景点')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit')
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('latitude')).toBe('39.999')
  })

  it('shows an unavailable state for invalid data and supports retry', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ current: { temperature_2m: null } }) }).mockResolvedValueOnce(forecast(25))
    vi.stubGlobal('fetch', fetchMock)
    wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('天气暂时不可用')
    expect(wrapper.find('.weather-current').exists()).toBe(false)
    await wrapper.find('.weather-empty button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.weather-current strong').text()).toBe('25°C')
  })

  it('ignores a previous coordinate request that finishes later', async () => {
    let complete!: (value: unknown) => void
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { complete = resolve })).mockResolvedValueOnce(forecast(22))
    vi.stubGlobal('fetch', fetchMock)
    wrapper = render()
    await wrapper.setProps({ latitude: 40.01 })
    await flushPromises()
    complete(forecast(99))
    await flushPromises()
    expect(wrapper.find('.weather-current strong').text()).toBe('22°C')
  })
})
