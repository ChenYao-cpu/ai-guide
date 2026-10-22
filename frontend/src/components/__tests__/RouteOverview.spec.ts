import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RouteOverview from '../RouteOverview.vue'
import { loadScenicMap } from '@/utils/leaflet'
import { t } from '@/i18n'
vi.mock('@/utils/leaflet', () => ({ loadScenicMap: vi.fn(), SCENIC_TILES: '/tiles/{z}/{x}/{y}' }))
let wrapper: ReturnType<typeof mount>
afterEach(() => wrapper?.unmount())
describe('Route map lifecycle', () => {
  it('initializes after the conditional map container mounts and removes it on exit', async () => {
    const map = { invalidateSize: vi.fn(), fitBounds: vi.fn(), setView: vi.fn(), remove: vi.fn() }
    const group = { clearLayers: vi.fn(), addTo: vi.fn().mockReturnThis() }
    const layer = {
      addTo: vi.fn().mockReturnThis(),
      bindPopup: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis()
    }
    const L = {
      map: vi.fn().mockReturnValue(map),
      layerGroup: vi.fn().mockReturnValue(group),
      tileLayer: vi.fn().mockReturnValue(layer),
      marker: vi.fn().mockReturnValue(layer),
      divIcon: vi.fn(),
      latLngBounds: vi.fn(),
      polyline: vi.fn().mockReturnValue(layer)
    }
    vi.mocked(loadScenicMap).mockResolvedValue(L)
    const overview: any = {
      stops: [{ spot_id: 1, spot_name: '长廊', order: 1, latitude: 40, longitude: 116 }],
      legs: [],
      complete: true
    }
    wrapper = mount(RouteOverview, {
      props: { overview, mapOnly: true },
      global: { mocks: { $t: t } }
    })
    await flushPromises()
    expect(L.map).toHaveBeenCalledTimes(1)
    expect(L.map.mock.calls[0][0]).toBe(wrapper.get('.route-overview-map').element)
    expect(L.marker).toHaveBeenCalled()
    wrapper.unmount()
    expect(map.remove).toHaveBeenCalledTimes(1)
  })
})
