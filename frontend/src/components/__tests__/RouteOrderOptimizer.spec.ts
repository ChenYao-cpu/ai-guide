import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import RouteOrderOptimizer from '../RouteOrderOptimizer.vue'

const api=vi.hoisted(()=>({optimize:vi.fn()}))
vi.mock('@/api/tourExperience',()=>({optimizeRouteOrder:api.optimize,getRouteOverview:vi.fn()}))
const Dialog=defineComponent({setup:(_, {slots})=>()=>h('div',[slots.default?.(),slots.footer?.()])})
const spots=[{spot_id:1,spot_name:'仁寿殿'},{spot_id:2,spot_name:'长廊'},{spot_id:3,spot_name:'昆明湖'}]
function result(unchanged=false){
  const stops=spots.map((s,i)=>({...s,order:i+1,visit_minutes:8}))
  const original={stops,legs:[],complete:true,walking_meters:2000,walking_minutes:30,total_minutes:70}
  return {data:{success:true,data:{input_spot_ids:[1,2,3],spot_ids:unchanged?[1,2,3]:[1,3,2],original_route:original,
    proposed_route:unchanged?original:{...original,stops:[stops[0],stops[2],stops[1]],walking_meters:1000,walking_minutes:15,total_minutes:50},
    unchanged,optimal:true,saved_meters:unchanged?0:1000,saved_minutes:unchanged?0:20}}}
}
let w:VueWrapper
async function setup(){
  w=mount(RouteOrderOptimizer,{props:{spots,pace:'standard'},global:{stubs:{ElDialog:Dialog,ElIcon:true,RouteOverview:true}}})
  await flushPromises()
}
afterEach(()=>{w?.unmount();vi.clearAllMocks()})

describe('optimize the entire selection only after reviewing the proposal',()=>{
  it('shows the real before/after difference and emits the exact chosen order only on apply',async()=>{
    api.optimize.mockResolvedValue(result());await setup()
    expect(api.optimize).toHaveBeenCalledWith([1,2,3],{fixed_start:true,fixed_end:false,pace:'standard'},expect.any(AbortSignal))
    expect(w.find('.order-comparison').text()).toContain('2.00 km')
    expect(w.find('.order-comparison').text()).toContain('1.00 km')
    expect(w.emitted('apply')).toBeUndefined()
    await w.find('.order-apply').trigger('click')
    expect(w.emitted('apply')).toEqual([[[1,3,2]]])
  })
  it('invalidates a proposal after changing endpoint settings and does not apply the old order',async()=>{
    api.optimize.mockResolvedValue(result());await setup()
    await w.findAll('input[type=checkbox]')[1].setValue(true)
    expect(w.find('.order-apply').attributes('disabled')).toBeDefined()
    await w.find('.order-apply').trigger('click');expect(w.emitted('apply')).toBeUndefined()
    api.optimize.mockResolvedValue(result(true))
    await w.find('.order-generate').trigger('click');await flushPromises()
    expect(api.optimize.mock.calls[1][1].fixed_end).toBe(true)
    await w.find('.order-apply').trigger('click')
    expect(w.emitted('close')).toHaveLength(1);expect(w.emitted('apply')).toBeUndefined()
  })
  it('aborts an outdated request and ignores its late result after a newer calculation completes',async()=>{
    let finish!:(v:unknown)=>void
    api.optimize.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
    await setup()
    const signal=api.optimize.mock.calls[0][2]
    await w.findAll('input[type=checkbox]')[1].setValue(true)
    expect(signal.aborted).toBe(true)
    api.optimize.mockResolvedValue(result(true))
    await w.find('.order-generate').trigger('click');await flushPromises()
    finish(result());await flushPromises()
    expect(w.find('.order-apply').text()).toContain('保留当前顺序')
    expect(w.emitted('apply')).toBeUndefined()
  })
  it('rejects missing stops and allows retry without changing the itinerary',async()=>{
    const bad=result();bad.data.data.spot_ids=[1,3]
    api.optimize.mockResolvedValue(bad);await setup()
    expect(w.find('[role=alert]').exists()).toBe(true)
    expect(w.find('.order-apply').attributes('disabled')).toBeDefined()
    api.optimize.mockResolvedValue(result())
    await w.find('.order-generate').trigger('click');await flushPromises()
    expect(w.find('[role=alert]').exists()).toBe(false)
    await w.find('.order-cancel').trigger('click')
    expect(w.emitted('apply')).toBeUndefined();expect(w.emitted('close')).toHaveLength(1)
  })
  it('invalidates the result when the parent changes selected stop order or walking pace',async()=>{
    api.optimize.mockResolvedValue(result());await setup()
    await w.setProps({spots:[spots[2],spots[1],spots[0]],pace:'relaxed'})
    expect(w.find('.order-apply').attributes('disabled')).toBeDefined()
    expect(w.find('.order-optimizer-workspace').exists()).toBe(false)
  })
})
