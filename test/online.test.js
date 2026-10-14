import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createSimulation} from '../server/simulation.js';

function client(){
 let clock=1000;const elements=new Map();
 const element=selector=>{
  if(!elements.has(selector))elements.set(selector,{
   value:'0',dataset:{},style:{},hidden:false,disabled:false,innerHTML:'',textContent:'',firstChild:{},
   addEventListener(){},removeEventListener(){},focus(){},append(){},after(){},remove(){},setAttribute(){},
   closest:()=>element('label'),getContext:()=>({setTransform(){}}),
   querySelector:element,querySelectorAll:()=>[],
  });return elements.get(selector);
 };
 const context=vm.createContext({
  document:{body:element('body'),querySelector:element,querySelectorAll:s=>s==='.hint'?[element('hint')]:[],createElement:()=>element('created'),addEventListener(){}},
  Image:class {},innerWidth:1280,innerHeight:800,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},
  performance:{now:()=>clock},matchMedia:()=>({matches:false,addEventListener(){}}),crypto:webcrypto,
  window:{assetsReady:Promise.resolve()},localStorage:{getItem(){},setItem(){}},location:{protocol:'http:',host:'localhost'},
  WebSocket:class {static OPEN=1;readyState=1;send(){}},setInterval(){},setTimeout(){},clearTimeout(){},
  console,Date,structuredClone,assetsLoaded:true,
 });
 context.document.body.classList={add(){}};
 for(const file of ['maps.js','vehicles.js','hills.js','race-art.js','game.js','online.js'])vm.runInContext(fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),context);
 return {context,run:code=>vm.runInContext(code,context),advance:ms=>clock+=ms};
}
function state(){
 const profiles=[{id:'a',character:0,ability:'turbo',color:'red',gas:false},{id:'b',character:1,ability:'jump',color:'blue',gas:false}];
 const sim=createSimulation(profiles,3,0);for(let i=0;i<240;i++)sim.step();
 return {type:'state',you:'a',phase:'race',round:1,serverNow:1000,track:3,vehicle:0,online:2,inRace:2,players:profiles,racers:profiles,game:structuredClone(sim.state())};
}
test('our car responds before any server response, while outcomes remain authoritative',()=>{
 const c=client();c.context.sample=state();c.run('roomState=sample;installGame(sample)');
 const before=c.run('cars[0].vx');
 c.run('keys.KeyD=true;sendInput()');
 for(let i=0;i<12;i++){c.advance(1000/120);c.run('update(1/120)');}
 assert.ok(c.run('cars[0].vx')>before+1,'predict throttle during a 100 ms packet gap');
 assert.equal(c.context.sample.game.cars[0].vx,before,'server snapshot is immutable');
 c.context.sample.game.cars[0].alive=false;c.context.sample.game.cars[0].reason='Отключился';
 c.context.sample.serverNow+=100;c.run('installGame(sample);update(1/120)');
 assert.equal(c.run('cars[0].alive'),false);
});
test('opponents interpolate and briefly coast, with bounded extrapolation during lost packets',()=>{
 const c=client();c.context.sample=state();c.run('roomState=sample;installGame(sample)');
 c.run(`const left=structuredClone(sample),right=structuredClone(sample);
 left.serverNow=1000;right.serverNow=1050;left.game.cars[1].x=100;right.game.cars[1].x=200;
 right.game.cars[1].vx=100;snapshots=[left,right];roomState=right;interpolationDelay=70;
 snapshotReceived=performance.now()-45;update(1/120);`);
 assert.equal(c.run('cars[1].x'),150);
 c.advance(100);c.run('update(1/120)');assert.ok(c.run('cars[1].x')>200);
 c.advance(5000);c.run('update(1/120)');assert.equal(c.run('cars[1].x'),215);
});
test('prediction stays finite under repeated corrections for all seven vehicles',()=>{
 for(let model=0;model<7;model++){
  const c=client(),profiles=[{id:'a',character:0,ability:'turbo',color:'red',gas:true}];
  const sim=createSimulation(profiles,model,model),base=state();
  c.run('keys.KeyD=true');
  for(let packet=0;packet<40;packet++){
   for(let i=0;i<4;i++)sim.step();
   c.context.sample={...base,racers:profiles,game:structuredClone(sim.state()),serverNow:1000+packet*1000/30};
   c.run('roomState=sample;installGame(sample);keys.KeyD=true;sendInput()');
   for(let i=0;i<4;i++){c.advance(1000/120);c.run('update(1/120)');}
   assert.equal(c.run('cars.every(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.a))'),true);
  }
 }
});
