// Measure the existing text underlines so the resting appearance stays unchanged.
export const planningUnderlineMixin = {
  data(){return {planningInkReady:false,planningInkAnchors:[],planningInk:{left:0,right:0,top:0,height:2,flat:1},planningInkTimer:null,planningInkContainerWidth:0,planningInkMotion:0}},
  computed:{planningInkStyle(){
    const ink=this.planningInk,motion=this.planningInkMotion
    const curve='cubic-bezier(.22,1.18,.36,1)'
    return {left:ink.left+'px',right:(this.planningInkContainerWidth-ink.right)+'px',top:ink.top+'px',height:ink.height+'px',
      transition:motion?'left 352ms '+curve+' '+(motion>0?'48ms':'0ms')+', right 352ms '+curve+' '+(motion>0?'0ms':'48ms'):'none'}
  }},
  onReady(){this.measurePlanningUnderline()},
  onResize(){this.measurePlanningUnderline()},
  onUnload(){clearTimeout(this.planningInkTimer)},
  watch:{tourLanguage(){this.measurePlanningUnderline()}},
  methods:{
    measurePlanningUnderline(){
      this.$nextTick(()=>{
        if(!this.pageReady||!this.pageVisible)return
        const query=uni.createSelectorQuery().in(this)
        query.select('.top-tabs').boundingClientRect()
        query.selectAll('.tt-underline').boundingClientRect()
        query.exec(result=>{
          if(!this.pageReady||!this.pageVisible)return
          const root=result&&result[0],lines=result&&result[1]
          if(!root||!lines||lines.length!==2||lines.some(line=>!line.width))return
          clearTimeout(this.planningInkTimer)
          this.planningInkContainerWidth=root.width
          this.planningInkMotion=0
          this.planningInkAnchors=lines.map(line=>({left:line.left-root.left,right:line.right-root.left,top:line.top-root.top,height:line.height,flat:1}))
          this.planningInk={...this.planningInkAnchors[this.tab==='personal'?1:0]}
          this.planningInkReady=true
        })
      })
    },
    animatePlanningUnderline(next){
      if(!this.planningInkReady){this.measurePlanningUnderline();return}
      clearTimeout(this.planningInkTimer)
      const from=this.planningInk,target=this.planningInkAnchors[next==='personal'?1:0]
      this.planningInkMotion=target.left+target.right>=from.left+from.right?1:-1
      // One view update drives both edges; route-page rendering cannot stall JS frames.
      this.planningInk={...target}
      this.planningInkTimer=setTimeout(()=>{this.planningInkMotion=0},400)
    }
  }
}
