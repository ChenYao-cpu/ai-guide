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
afterEach(()=>{w?.unmount();vi.clearAllMocks();vi.useRealTimers()})
describe('路线调整必须先预览再确认',()=>{
  it('展示成本和离园依据，确认前不修改行程',async()=>{
    await setup();expect(w.text()).toContain('38');expect(w.text()).toContain('时间变化');expect(w.text()).toContain('-60 分钟')
    expect(api.apply).not.toHaveBeenCalled()
    await w.find('.repair-apply').trigger('click');await flushPromises()
    expect(api.apply).toHaveBeenCalledWith(90,'signed-preview');expect(w.emitted('applied')).toHaveLength(1)
  })
  it('修改条件后必须重新计算，不允许提交旧方案',async()=>{
    await setup();await w.find('.repair-edit').trigger('click');await w.find('input[type=number]').setValue(45)
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
  it('切换方案后提交对应方案的签名，而不是第一份签名',async()=>{
    const primary=result().data.data
    const alternative={...primary,strategy:'shortest',proposal_token:'signed-shorter'}
    await setup();api.preview.mockResolvedValueOnce({data:{success:true,data:{...primary,alternatives:[alternative]}}})
    await w.find('form').trigger('submit');await flushPromises()
    await w.findAll('.repair-plan-choices button')[1].trigger('click')
    await w.find('.repair-apply').trigger('click');await flushPromises()
    expect(api.apply).toHaveBeenCalledWith(90,'signed-shorter')
  })
  it('直接离园允许不填时限，并明确提交所选出口',async()=>{
    await setup();await w.findAll('.repair-goals button')[3].trigger('click')
    await w.find('input[type=number]').setValue('')
    await w.find('.repair-fields select').setValue('north')
    await w.find('form').trigger('submit');await flushPromises()
    expect(api.preview.mock.calls.at(-1)?.[1]).toMatchObject({scenario:'exit',remaining_minutes:null,end_area:'north'})
  })
  it('必游和避台阶条件实际进入规划请求',async()=>{
    await setup();await w.find('.repair-edit').trigger('click');await w.find('.repair-stop-options select').setValue('required')
    await w.findAll('.repair-check input')[0].setValue(true)
    await w.find('form').trigger('submit');await flushPromises()
    expect(api.preview.mock.calls.at(-1)?.[1]).toMatchObject({required_spot_ids:[3],avoid_steps:true,allow_reorder:true})
  })
  it('到期的签名在界面上也不能提交',async()=>{
    vi.useFakeTimers({toFake:['setInterval','clearInterval','Date']})
    await setup();const p={...result().data.data,expires_at:Math.floor(Date.now()/1000)+2}
    api.preview.mockResolvedValueOnce({data:{success:true,data:p}})
    await w.find('form').trigger('submit');await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.text()).toContain('方案已过期')
    await w.find('.repair-apply').trigger('click');expect(api.apply).not.toHaveBeenCalled()
  })
  it('修改条件后迟到的旧预览不能覆盖新方案',async()=>{
    await setup();await w.find('.repair-edit').trigger('click');let finish!:(data:unknown)=>void
    api.preview.mockReturnValueOnce(new Promise(resolve=>{finish=resolve}))
    await w.find('input[type=number]').setValue(45);await w.find('form').trigger('submit')
    const signal=api.preview.mock.calls.at(-1)?.[2]
    await w.find('input[type=number]').setValue(40)
    expect(signal.aborted).toBe(true)
    const latest=result();latest.data.data.totals.total_minutes=35
    api.preview.mockResolvedValueOnce(latest)
    await w.find('form').trigger('submit');await flushPromises()
    const stale=result();stale.data.data.totals.total_minutes=444
    finish(stale);await flushPromises()
    expect(w.find('.repair-plan-choices').text()).toContain('35 分钟')
    expect(w.text()).not.toContain('444')
  })
})
