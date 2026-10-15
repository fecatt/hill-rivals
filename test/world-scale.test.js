import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';

function fixture(){
 const elements=new Map();const element=s=>{
  if(!elements.has(s))elements.set(s,{value:'0',dataset:{},style:{},hidden:false,innerHTML:'',addEventListener(){},focus(){},getContext:()=>({setTransform(){}})});
  return elements.get(s);
 };
 const c=vm.createContext({document:{body:{dataset:{}},querySelector:element,querySelectorAll:()=>[],addEventListener(){}},Image:class{},innerWidth:1280,innerHeight:800,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},performance,matchMedia:()=>({matches:false,addEventListener(){}}),crypto:webcrypto,window:{},console});
 for(const name of ['maps','vehicles','hills','race-art','game'])vm.runInContext(fs.readFileSync(new URL('../dist/'+name+'.js',import.meta.url),'utf8'),c);
 return expression=>vm.runInContext(expression,c);
}

test('world scale matches the actual classic jeep drawing, independent of camera zoom',()=>{
 const run=fixture();const result=run(`(()=>{
  const v=VEHICLES[0],a=BODY_ANCHORS.jeep,b=BODY_BOUNDS.jeep;
  const unit=(v.wheels.at(-1)-v.wheels[0])/(a.axles.at(-1)-a.axles[0])*BODY_ART_SCALE;
  const length=v.wheels.at(-1)-v.wheels[0]+((a.axles[0]-b[0])+(b[0]+b[2]-a.axles.at(-1)))*unit;
  const original=worldMetres(length);zoom=.42;W=393;return {length,original,zoomed:worldMetres(length)};
 })()`);
 assert.ok(Math.abs(result.length-112.592)<1e-9);
 assert.ok(Math.abs(result.original-3.33)<1e-9);assert.equal(result.original,result.zoomed);
});
test('Ozon van uses Gazelle dimensions, true 130 km/h cap, heavy mass and rear drive',()=>{
 const run=fixture();const result=run(`(()=>{
  const v=VEHICLES[7],a=BODY_ANCHORS.van,b=BODY_BOUNDS.van;
  const unit=(v.wheels.at(-1)-v.wheels[0])/(a.axles.at(-1)-a.axles[0])*BODY_ART_SCALE;
  const length=v.wheels.at(-1)-v.wheels[0]+((a.axles[0]-b[0])+(b[0]+b[2]-a.axles.at(-1)))*unit;
  return {kind:v.kind,wheelbase:worldMetres(v.wheels.at(-1)-v.wheels[0]),length:worldMetres(length),speed:speedKph(v.maxSpeed),mass:v.mass,driveAxles:v.driveAxles};
 })()`);
 assert.equal(result.kind,'van');assert.ok(Math.abs(result.wheelbase-3.14)<.02);assert.ok(Math.abs(result.length-5.3)<.3);
 assert.ok(Math.abs(result.speed-130)<.2);assert.equal(result.mass,2725);assert.deepEqual([...result.driveAxles],[0]);
});
test('Ozon van physics accelerates on flat ground and reaches its 130 km/h cap',()=>{
 const run=fixture();const result=run(`(()=>{
  terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;vehicleModel=7;track=3;input=()=>[true,false];
  const c=newCar(0);c.y=-VEHICLES[7].mount-VEHICLES[7].radius;
  let oneSecond=0;for(let n=0;n<7200;n++){c.fuel=100;physics(c,1/120);if(n===119)oneSecond=speedKph(c.vx)}
  return {oneSecond,top:speedKph(c.vx),angle:c.a};
 })()`);
 assert.ok(result.oneSecond>3&&result.oneSecond<20);assert.ok(Math.abs(result.top-130)<.2);assert.ok(Math.abs(result.angle)<.15);
});
test('speed and race distance share the same metre conversion',()=>{
 const run=fixture();const r=run(`(()=>{
  const c={startX:100,x:100};const before=raceMetres(c);c.x+=680;
  return {metres:raceMetres(c)-before,kph:speedKph(680),reverse:speedKph(-680),checkpoint:worldMetres(checkpoint)};
 })()`);
 assert.ok(Math.abs(r.metres*3.6-r.kph)<1e-9);assert.ok(Math.abs(r.kph-72.401591587)<1e-6);
 assert.equal(r.reverse,r.kph);assert.ok(Math.abs(r.checkpoint-44.363720335)<1e-6);
});
test('jeep accelerates forward with consistent speed and distance units',()=>{
 const run=fixture();const r=run(`(()=>{
  terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;vehicleModel=0;track=3;input=()=>[true,false];
  const c=newCar(0);c.y=-VEHICLES[0].mount-VEHICLES[0].radius;
  for(let n=0;n<240;n++){c.fuel=100;physics(c,1/120);}
  return {delta:c.x-c.startX,vx:c.vx,metres:raceMetres(c),kph:speedKph(c.vx)};
 })()`);
 assert.ok(r.delta>100);assert.ok(r.vx>0);assert.ok(r.kph<=105.1);
 assert.ok(Math.abs(r.delta/r.metres-r.vx*3.6/r.kph)<1e-6);
});

test('garage reports the actual driven axles and verified power only',()=>{
 const run=fixture();
 assert.equal(run('driveLabel(VEHICLES[7])'),'4×2 · задний');
 assert.equal(run('driveLabel(VEHICLES[5])'),'4×2 · задний');
 assert.equal(run('driveLabel(VEHICLES[2])'),'6×6 · полный');
 assert.equal(run('driveLabel(VEHICLES[4])'),'8×8 · полный');
 assert.equal(run('vehicleStats(VEHICLES[7])[1][1]'),'106.8 л.с.');
 assert.equal(run('vehicleStats(VEHICLES[6])[1][1]'),'Не задана');
});

test('holding gas on level lunar ground does not automatically flip ordinary cars',()=>{
 for(const model of [0,1,2,3,4,5,7,8]){
  const run=fixture();const result=run(`(()=>{
   terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;vehicleModel=${model};track=2;input=()=>[true,false];
   const c=newCar(0);c.y=-carSpec(c).mount-Math.max(...wheelSpecs(carSpec(c)).map(w=>w.r));
   for(let n=0;n<3600;n++){c.fuel=100;physics(c,1/120)}
   return {alive:c.alive,angle:c.a,speed:c.vx};
  })()`);
  assert.ok(result.alive&&Math.abs(result.angle)<.3&&result.speed>0,JSON.stringify({model,...result}));
 }
});

test('gas and brake pitch the car in opposite directions only after takeoff',()=>{
 for(const brake of [false,true]){
  const run=fixture();const result=run(`(()=>{
   terrain=()=>10000;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;track=2;vehicleModel=0;input=()=>[${!brake},${brake}];
   const c=newCar(0);c.y=0;c.air=0;physics(c,1/120);const initial=c.av;
   for(let n=0;n<60;n++)physics(c,1/120);return {initial,av:c.av};
  })()`);
  assert.equal(result.initial,0);assert.ok(brake?result.av>0:result.av<0);
 }
});

test('rocket exceeds the former 117 km/h cap without launching vertically on level ground',()=>{
 const run=fixture();const result=run(`(()=>{
  terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;vehicleModel=6;track=3;input=()=>[true,false];
  const c=newCar(0);c.y=-30;for(let n=0;n<1200;n++){c.fuel=100;physics(c,1/120)}
  return {speed:speedKph(c.vx),alive:c.alive,angle:c.a};
 })()`);
 assert.ok(result.alive&&result.speed>250&&Math.abs(result.angle)<.2);
});

test('Evo is a separate ninth car with European GSR specs and reaches its advertised speed',()=>{
 const run=fixture();const result=run(`(()=>{
  terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;vehicleModel=8;track=3;input=()=>[true,false];
  const c=newCar(0),v=carSpec(c);c.y=-v.mount-v.radius;let to100=0;
  for(let n=0;n<9600;n++){c.fuel=100;physics(c,1/120);if(!to100&&speedKph(c.vx)>=100)to100=(n+1)/120}
  return {count:VEHICLES.length,hatch:VEHICLES[3].kind,kind:v.kind,power:v.powerHp,mass:v.mass,wheelbase:worldMetres(v.wheels[1]-v.wheels[0]),speed:speedKph(c.vx),alive:c.alive,to100};
 })()`);
 assert.equal(result.count,9);assert.equal(result.hatch,'rally');assert.equal(result.kind,'evo');
 assert.equal(result.power,295);assert.equal(result.mass,1560);assert.ok(Math.abs(result.wheelbase-2.65)<.02);
 assert.ok(result.alive&&Math.abs(result.speed-240)<.2,JSON.stringify(result));
 assert.ok(result.to100>4&&result.to100<8,JSON.stringify(result));
});

test('custom wheels change actual ride height without changing spring, damper or suspension travel',()=>{
 const run=fixture(),result=run(`(()=>{
  terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;input=()=>[false,false];mode='race';count=0;vehicleModel=8;track=3;
  const v=VEHICLES[8],settings=[v.spring,v.damper,v.travel];
  function settle(layout){wheelAlignmentPreview={evo:layout};const c=newCar(0);for(let n=0;n<1200;n++)physics(c,1/120);return {y:c.y,alive:c.alive};}
  const original=settle(validWheelAlignment(v,[])),changed=settle(v.wheels.map(()=>({x:0,y:6,scale:1.4})));
  wheelAlignmentPreview=null;return {original,changed,settings,after:[v.spring,v.damper,v.travel]};
 })()`);
 assert.ok(result.original.alive&&result.changed.alive);assert.ok(Math.abs((result.original.y-result.changed.y)-(6+11.5*.4))<.05,JSON.stringify(result));
 assert.deepEqual([...result.settings],[...result.after]);
});

test('driver placement does not alter physical wheel geometry and exported settings include every driver',()=>{
 const run=fixture(),result=run(`(()=>{
  const before=JSON.stringify(wheelSpecs(VEHICLES[8]));driverAlignmentPreview={evo:{x:10,y:-12,scale:1.7}};
  const after=JSON.stringify(wheelSpecs(VEHICLES[8]));const payload=exportWheelAlignments({},driverAlignmentPreview);driverAlignmentPreview=null;
  return {before,after,payload};
 })()`);
 assert.equal(result.before,result.after);assert.equal(result.payload.version,2);assert.equal(result.payload.vehicles.length,9);
 assert.deepEqual({...result.payload.vehicles.find(v=>v.kind==='evo').driver},{x:10,y:-12,scale:1.7});
});

test('slow drawing reduces backing resolution without changing the world or simulation state',()=>{
 const run=fixture(),result=run(`(()=>{
  const c=newCar(0),before={width:W,height:H,ratio:renderRatio,car:JSON.stringify(c)};
  for(let n=0;n<180;n++)adaptRenderQuality(25);
  return {before,width:W,height:H,ratio:renderRatio,backing:canvas.width,car:JSON.stringify(c),hz:window.gameDebug.getPerformance().physicsHz};
 })()`);
 assert.ok(result.ratio<result.before.ratio);assert.equal(result.width,result.before.width);assert.equal(result.height,result.before.height);
 assert.equal(result.car,result.before.car);assert.equal(result.hz,120);assert.equal(result.backing,Math.round(result.width*result.ratio));
});

test('FPS estimate measures frame work independently of display intervals and clears on pause',()=>{
 const run=fixture();const fast=run(`(()=>{mode='race';paused=false;recordFramePerformance(2,1000);for(let i=0;i<60;i++){frameTimes.push(1000/60);recordFramePerformance(2,1017+i*1000/60);}return {stats:window.gameDebug.getPerformance(),text:$('#fps-meter').textContent};})()`);
 assert.equal(fast.stats.estimatedFps,500);assert.ok(Math.abs(fast.stats.fps-60)<1e-8);assert.match(fast.text,/500 FPS/);
 const resumed=run(`(()=>{paused=true;recordFramePerformance(0,2200);paused=false;recordFramePerformance(25,2300);return window.gameDebug.getPerformance();})()`);
 assert.equal(resumed.estimatedFps,40);assert.equal(resumed.frameWorkMs,25);
});
