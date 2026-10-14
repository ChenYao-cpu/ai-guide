import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import TourRouteRepair from '../TourRouteRepair.vue'

const api=vi.hoisted(()=>({preview:vi.fn(),apply:vi.fn()}))
vi.mock('@/api/visitor',()=>({previewTourRepair:api.preview,applyTourRepair:api.apply}))
const Dialog=defineComponent({setup:(_, {slots})=>()=>h('div',slots.default?.())})
let w:VueWrapper
const result=(feasible=true)=>({data:{success:true,data:{feasible,exit_only:false,current_spot:'长廊',next_spots:[{spot_id:3,spot_name:'昆明湖'}],removed:[],end_anchor:'仁寿殿',proposal_token:feasible?'signed-preview':'',totals:{visit_minutes:20,walk_minutes:10,rest_minutes:3,exit_minutes:5,reserve_minutes:0,total_minutes:38,walking_meters:700},original_totals:{total_minutes:98},options:{remaining_minutes:60,pace:'standard',end_area:'east',excluded_spot_ids:[]}}}})
async function setup(feasible=true){
  api.preview.mockResolvedValue(result(feasible));api.apply.mockResolvedValue({data:{success:true}})
  w=mount(TourRouteRepair,{props:{sessionId:90,currentName:'长廊',remainingSpots:[{spot_id:3,spot_name:'昆明湖'}],initialMinutes:60},global:{stubs:{ElDialog:Dialog}}})
  await w.find('form').trigger('submit');await flushPromises()
}
afterEach(()=>{w?.unmount();vi.clearAllMocks()})
describe('路线调整必须先预览再确认',()=>{
  it('展示成本和离园依据，确认前不修改行程',async()=>{
    await setup();expect(w.text()).toContain('38');expect(w.text()).toContain('原剩余行程')
    expect(api.apply).not.toHaveBeenCalled()
    await w.find('.repair-apply').trigger('click');await flushPromises()
    expect(api.apply).toHaveBeenCalledWith(90,'signed-preview');expect(w.emitted('applied')).toHaveLength(1)
  })
  it('修改条件后必须重新计算，不允许提交旧方案',async()=>{
    await setup();await w.find('input[type=number]').setValue(45)
    expect(w.find('.repair-apply').attributes('disabled')).toBeDefined()
    await w.find('.repair-apply').trigger('click');expect(api.apply).not.toHaveBeenCalled()
  })
  it('时间不足的方案不可确认',async()=>{
    await setup(false);expect(w.text()).toContain('时间不足')
    expect(w.find('.repair-apply').attributes('disabled')).toBeDefined()
  })
  it('服务端拒绝过期方案时保留预览，显示重算提示',async()=>{
    await setup();api.apply.mockRejectedValueOnce({response:{data:{detail:'路线或进度已变化，请重新生成方案'}}})
    await w.find('.repair-apply').trigger('click');await flushPromises()
    expect(w.find('[role=alert]').text()).toContain('重新生成');expect(w.emitted('applied')).toBeUndefined()
  })
})
