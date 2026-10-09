// Cubism 2 万能桩 — Proxy 自动兜底所有缺失属性
(function(global) {
  function Stub() {}
  Stub.prototype = {};
  function Props() { return new Proxy({}, { get(t,k) { return t[k] !== undefined ? t[k] : (typeof k === 'string' ? 0 : undefined); } }); }

  global.AMotion = Stub;
  global.Live2DMotion = Stub;
  global.PhysicsHair = Stub;
  global.L2DPhysicsHair = Stub;

  var Model = function(){};
  Model.loadModel = function(){ return new Model(); };
  global.Live2DModelWebGL = Model;

  global.Live2DPhysics = { PhysicsHair: Stub };
  global.PlatformManager = { createManager: function(){ return {}; } };
  global.UtSystem = { getUserTimeMSec: function(){ return Date.now(); } };
  global.UtDebug = { debug: function(){}, error: function(){}, warning: function(){}, setDebugMode: function(){} };
  global.LDTransform = Stub;
  global.LDGL = Stub;
  global.Live2DTransform = Stub;
  global.Live2DGL = Stub;

  global.Live2D = { Live2DModelWebGL: Model, Live2DMotion: Stub, PhysicsHair: Stub, PlatformManager: global.PlatformManager };

  // Proxy 万能 L2D — 任何未定义属性都返回安全值
  global.L2D = new Proxy({
    TargetPoint: { OPEN: 1 },
    RenderMode: new Proxy({},{get(){return 0}}),
    BlendMode: new Proxy({},{get(){return 0}}),
    EyeState: { STATE_FIRST:0, STATE_INTERVAL:1, STATE_CLOSING:2, STATE_CLOSED:3, STATE_OPENING:4 },
    MotionQueueEntry: Stub, PartsData: Stub, ParamData: Stub, DrawData: Stub,
    DrawDataID: Stub, BaseDataID: Stub, Pallet: Stub,
    Matrix44: function(){ this.identity=function(){}; },
    Color: function(){ return {R:1,G:1,B:1,A:1}; }
  }, {
    get(target, key) {
      if (target[key] !== undefined) return target[key];
      if (typeof key === 'string' && key.startsWith('SRC')) return 0;
      return new Proxy({},{get(){return 0}});
    }
  });
})(window);
