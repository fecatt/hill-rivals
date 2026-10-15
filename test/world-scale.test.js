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
 assert.ok(Math.abs(result.speed-130)<.2);assert.equal(result.mass,2725);assert.deepEqual([...result.driveAxles],[1]);
});
test('Ozon van physics accelerates on flat ground and reaches its 130 km/h cap',()=>{
 const run=fixture();const result=run(`(()=>{
  terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;vehicleModel=7;track=3;input=()=>[true,false];
  const c=newCar(0);c.y=-VEHICLES[7].mount-VEHICLES[7].radius;
  let oneSecond=0;for(let n=0;n<1680;n++){c.fuel=100;physics(c,1/120);if(n===119)oneSecond=speedKph(c.vx)}
  return {oneSecond,top:speedKph(c.vx),angle:c.a};
 })()`);
 assert.ok(result.oneSecond>15&&result.oneSecond<30);assert.ok(Math.abs(result.top-130)<.2);assert.ok(Math.abs(result.angle)<.15);
});
test('speed and race distance share the same metre conversion',()=>{
 const run=fixture();const r=run(`(()=>{
  const c={startX:100,x:100};const before=raceMetres(c);c.x+=680;
  return {metres:raceMetres(c)-before,kph:speedKph(680),reverse:speedKph(-680),checkpoint:worldMetres(checkpoint)};
 })()`);
 assert.ok(Math.abs(r.metres*3.6-r.kph)<1e-9);assert.ok(Math.abs(r.kph-72.401591587)<1e-6);
 assert.equal(r.reverse,r.kph);assert.ok(Math.abs(r.checkpoint-44.363720335)<1e-6);
});
test('scale correction preserves the existing two-second jeep acceleration and movement',()=>{
 const run=fixture();const r=run(`(()=>{
  terrain=()=>0;slope=()=>0;hillBridgeVelocity=()=>0;mode='race';count=0;vehicleModel=0;track=3;input=()=>[true,false];
  const c=newCar(0);c.y=-VEHICLES[0].mount-VEHICLES[0].radius;
  for(let n=0;n<240;n++){c.fuel=100;physics(c,1/120);}
  return {delta:c.x-c.startX,vx:c.vx,metres:raceMetres(c),kph:speedKph(c.vx)};
 })()`);
 assert.ok(Math.abs(r.delta-694.961737431)<1e-6);assert.ok(Math.abs(r.vx-619.850420669)<1e-6);
 assert.ok(Math.abs(r.metres-20.554058775)<1e-6);assert.ok(Math.abs(r.kph-65.99728971)<1e-6);
});
