import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h } from 'vue'
import { setLocale } from '@/i18n'
import RouteCarousel from '../RouteCarousel.vue'

let wrapper: VueWrapper
const select = vi.fn()
function setup(reduced = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  wrapper = mount(RouteCarousel, { props: { routes: [1, 2, 3].map(i => ({ route_id: i, name: `路线${i}` })) },
    slots: { default: ({ route }: any) => h('button', { onClick: () => select(route.route_id) }, route.name) } })
  return wrapper.find('.carousel-viewport').element as HTMLElement
}
beforeEach(() => { setLocale('zh'); vi.useFakeTimers(); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false) })
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); select.mockClear() })

describe('推荐路线滑动浏览', () => {
  it('卡片循环切换；侧卡点击先居中，再次点击才选择', async () => {
    setup()
    await wrapper.find('[aria-label="上一条路线"]').trigger('click')
    expect(wrapper.find('.carousel-count').text()).toContain('03')
    expect(select).not.toHaveBeenCalled()
    await wrapper.findAll('.route-slide button')[1].trigger('click')
    expect(wrapper.find('.carousel-count').text()).toContain('02')
    expect(select).not.toHaveBeenCalled()
    await wrapper.findAll('.route-slide button')[1].trigger('click')
    expect(select).toHaveBeenCalledWith(2)
  })
  it('鼠标悬停仍会自动翻转，主动暂停后停止', async () => {
    setup(); await wrapper.find('.route-carousel').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(4500)
    expect(wrapper.find('.carousel-count').text()).toContain('02')
    await vi.advanceTimersByTimeAsync(4500)
    expect(wrapper.find('.carousel-count').text()).toContain('03')
    await vi.advanceTimersByTimeAsync(4500)
    expect(wrapper.find('.carousel-count').text()).toContain('01')
    await wrapper.find('[aria-label="暂停轮播"]').trigger('click')
    await vi.advanceTimersByTimeAsync(13500)
    expect(wrapper.find('.carousel-count').text()).toContain('01')
    expect(wrapper.find('[aria-label="继续轮播"]').exists()).toBe(true)
  })
  it('尊重减少动态效果设置，同时保留键盘翻页', async () => {
    setup(true); await vi.advanceTimersByTimeAsync(14000)
    expect(wrapper.find('.carousel-count').text()).toContain('01')
    await wrapper.find('.carousel-viewport').trigger('keydown', { key: 'End' })
    expect(wrapper.find('.carousel-count').text()).toContain('03')
    expect(select).not.toHaveBeenCalled()
  })
  it('查看详细行程时暂停轮播，关闭后重新计时', async () => {
    setup()
    await wrapper.setProps({ suspended: true })
    await vi.advanceTimersByTimeAsync(15000)
    expect(wrapper.find('.carousel-count').text()).toContain('01')
    await wrapper.setProps({ suspended: false })
    await vi.advanceTimersByTimeAsync(4400)
    expect(wrapper.find('.carousel-count').text()).toContain('01')
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('.carousel-count').text()).toContain('02')
  })
})
