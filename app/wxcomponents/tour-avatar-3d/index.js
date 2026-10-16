const {createScopedThreejs}=require('./lib/threejs');
const {registerGLTFLoader}=require('./lib/gltf-loader');
Component({
  properties:{motionUrl:{type:String,value:""},motionStartedAt:{type:Number,value:0},portrait:{type:Boolean,value:false},width:{type:Number,value:0},height:{type:Number,value:0},
    sceneUrl:{type:String,observer:'load'},animation:{type:String,value:'idle'},
    progress:{type:Number,value:0,observer(value){this._progress=value;this._progressAt=Date.now()}},
    duration:{type:Number,value:0},speaking:{type:Boolean,value:false}},
  lifetimes:{ready(){this.init()},detached(){this._disposed=true;this._version=(this._version||0)+1;if(this.canvas&&this._frame)this.canvas.cancelAnimationFrame(this._frame);this.disposeModel();if(this._renderer)this._renderer.dispose()}},
  methods:{
    init(){this.createSelectorQuery().select('#avatar-canvas').fields({node:true,size:true}).exec(rows=>{
      if(this._disposed)return;
      try{
        const row=rows[0];if(!row||!row.node)throw Error('WebGL画布不可用');
        const canvas=this.canvas=row.node,T=this.THREE=createScopedThreejs(canvas);registerGLTFLoader(T);
        const w=row.width||360,h=row.height||300;
        this._renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});
        this._renderer.setPixelRatio(Math.min(wx.getSystemInfoSync().pixelRatio||1,1.5));this._renderer.setSize(w,h,false);
        this._renderer.outputEncoding=T.sRGBEncoding;
        this.scene=new T.Scene();this.scene.background=new T.Color(0xf5f7ff);
        this.scene.add(new T.HemisphereLight(0xffffff,0xadb5c5,1.2));
        const key=new T.DirectionalLight(0xffffff,1.5);key.position.set(1,3,4);this.scene.add(key);
        const fill=new T.DirectionalLight(0xffffff,.8);fill.position.set(-2,1.5,3);this.scene.add(fill);
        this.camera=new T.PerspectiveCamera(30,w/h,.01,100);
        this.load(this.data.sceneUrl);this._last=Date.now();this.loop();
      }catch(e){this.fail(e)}
    })},
    disposeModel(){if(!this.model)return;this.scene.remove(this.model);this.model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){for(const v of Object.values(m))if(v&&v.isTexture)v.dispose();m.dispose()}}});this.model=null;this.mixer=null;this._tracks=[];this._armTracks=[]},
    load(url){if(!this._renderer||!url||this._disposed)return;const version=this._version=(this._version||0)+1;this.triggerEvent('loading');
      new this.THREE.GLTFLoader().load(url,async gltf=>{
        if(version!==this._version||this._disposed)return;
        try{
          this.disposeModel();const T=this.THREE;this.model=gltf.scene;this.scene.add(this.model);this.model.traverse(o=>{o.frustumCulled=false});
          const box=new T.Box3().setFromObject(this.model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
          const viewHeight=this.data.portrait?size.y*.5:size.y*1.1;
          const targetY=this.data.portrait?box.min.y+size.y*.78:center.y;
          const distance=viewHeight/(2*Math.tan(T.Math.degToRad(this.camera.fov)/2));
          this.camera.position.set(center.x,targetY,box.max.z+distance);this.camera.lookAt(center.x,targetY,center.z);this.camera.updateProjectionMatrix();
          this.mixer=new T.AnimationMixer(this.model);const clip=gltf.animations.find(c=>c.name===this.data.animation)||gltf.animations[0];
          this._idle=clip&&clip.name==='idle';this._idleTime=0;
          if(clip){const action=this.mixer.clipAction(clip);action.setLoop(this._idle?T.LoopRepeat:T.LoopOnce,this._idle?Infinity:1);action.clampWhenFinished=true;action.play();this.mixer.update(0)}
          const payload=await new Promise((resolve,reject)=>wx.request({url:url.replace(/\.glb(?=\?|$)/,'.morph.json'),success:r=>r.statusCode===200?resolve(r.data):reject(Error('口型数据加载失败')),fail:reject}));
          if(version!==this._version||this._disposed)return;
          const motionPayload=this.data.motionUrl&&this.data.motionUrl!==url?await new Promise((resolve,reject)=>wx.request({url:this.data.motionUrl.replace(/\.glb(?=\?|$)/,'.morph.json'),success:r=>r.statusCode===200?resolve(r.data):reject(Error('手臂动作数据加载失败')),fail:reject})):payload;
          if(version!==this._version||this._disposed)return;
          this._armTracks=(motionPayload.armTracks||[]).map(track=>({bone:this.model.getObjectByName(track.node),track})).filter(x=>x.bone);
          this._tracks=(payload.tracks||[]).map(track=>{const root=this.model.getObjectByName(track.node),meshes=[];if(root)root.traverse(o=>{if(o.isMesh&&o.morphTargetInfluences)meshes.push(o)});return {track,meshes}});
          if(this._tracks.some(t=>!t.meshes.length))throw Error('模型口型节点缺失');
          this._renderer.render(this.scene,this.camera);this.triggerEvent('ready');
        }catch(e){this.fail(e)}
      },undefined,e=>{if(version===this._version)this.fail(e)});
    },
    loop(){if(this._disposed)return;this._frame=this.canvas.requestAnimationFrame(()=>this.loop());
      const now=Date.now(),dt=Math.min(.1,(now-this._last)/1000);this._last=now;
      if(this.mixer){this._idleTime+=dt;const extra=this.data.speaking?Math.min(.3,(now-(this._progressAt||now))/1000):0;
        const seconds=this._idle?this._idleTime:Math.min(this.data.duration,(this._progress||0)*this.data.duration+extra);
        this.mixer.update(seconds-this.mixer.time);
        const motionSeconds=this.data.motionStartedAt?Math.max(0,(now-this.data.motionStartedAt)/1000):this._idleTime;
        for(const {bone,track} of this._armTracks||[]){
          const times=track.times;let lo=0,hi=times.length-1;
          while(lo+1<hi){const mid=(lo+hi)>>1;if(times[mid]<=motionSeconds)lo=mid;else hi=mid}
          const mix=Math.max(0,Math.min(1,(motionSeconds-times[lo])/Math.max(.001,times[hi]-times[lo])));
          const a=new this.THREE.Quaternion().fromArray(track.values,lo*4),b=new this.THREE.Quaternion().fromArray(track.values,hi*4);
          bone.quaternion.copy(a).slerp(b,mix);
        }
        for(const item of this._tracks||[]){const t=item.track,end=t.times[t.times.length-1],time=this._idle?seconds%end:seconds;let lo=0,hi=t.times.length-1;
          while(lo+1<hi){const mid=(lo+hi)>>1;if(t.times[mid]<=time)lo=mid;else hi=mid}
          const mix=Math.max(0,Math.min(1,(time-t.times[lo])/Math.max(.001,t.times[hi]-t.times[lo]))),n=t.names.length;
          for(const mesh of item.meshes)for(let i=0;i<n;i++)mesh.morphTargetInfluences[i]=t.values[lo*n+i]*(1-mix)+t.values[hi*n+i]*mix;
        }
      }
      if(this._renderer)this._renderer.render(this.scene,this.camera);
    },
    fail(e){this._lastError=e&&e.message||e&&e.errMsg||String(e);console.error('[tour-avatar-3d]',this._lastError);this.triggerEvent('error',{message:'3D加载失败：'+this._lastError})}
  }
});
