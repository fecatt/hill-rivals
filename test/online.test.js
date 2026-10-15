import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createSimulation} from '../server/simulation.js';

function client(){
 let clock=1000;const elements=new Map(),webSockets=[];
 const element=selector=>{
  if(!elements.has(selector))elements.set(selector,{
   value:'0',dataset:{},style:{},hidden:false,disabled:false,innerHTML:'',textContent:'',firstChild:{},
   classList:{add(){},remove(){},toggle(){}},
   addEventListener(){},removeEventListener(){},focus(){},append(){},after(){},remove(){},setAttribute(){},
   closest:()=>element('label'),getContext:()=>({setTransform(){}}),
   querySelector:element,querySelectorAll:()=>[],
  });return elements.get(selector);
 };
 const context=vm.createContext({
  document:{body:element('body'),querySelector:element,querySelectorAll:s=>s==='.hint'?[element('hint')]:[],createElement:()=>element('created'),addEventListener(){}},
  Image:class {},innerWidth:1280,innerHeight:800,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},
  performance:{now:()=>clock},matchMedia:()=>({matches:false,addEventListener(){}}),crypto:webcrypto,
  sessionStorage:{getItem(){},setItem(){}},window:{assetsReady:Promise.resolve(),onlineActive:true},localStorage:{getItem(){},setItem(){}},location:{protocol:'http:',host:'localhost',href:'http://localhost/'},
  createRoomsUI:()=>({browser:{hidden:true},state(){},directory(){},chat(){},notice(){},hide(){}}),
  createPeerTransport:()=>({pose(){},update(){},probe(){},reset(){},broadcast(){},signal(){},relay(){},summary(){return '';}}),
  WebSocket:class {static OPEN=1;readyState=1;constructor(){webSockets.push(this)}send(){}close(){}},setInterval(){},setTimeout(){},clearTimeout(){},
  console,Date,structuredClone,assetsLoaded:true,
 });
 context.document.body.classList={add(){}};
 for(const file of ['maps.js','vehicles.js','hills.js','race-art.js','game.js','online.js'])vm.runInContext(fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),context);
 return {context,run:code=>vm.runInContext(code,context),advance:ms=>clock+=ms,webSockets};
}
function state(){
 const profiles=[{id:'a',character:0,ability:'turbo',color:'red',gas:false},{id:'b',character:1,ability:'jump',color:'blue',gas:false}];
 const sim=createSimulation(profiles,3,0);for(let i=0;i<240;i++)sim.step();
 return {type:'state',you:'a',phase:'race',round:1,serverNow:1000,track:3,vehicle:0,online:2,inRace:2,players:profiles,racers:profiles,game:structuredClone(sim.state())};
}
test('a solo room can start locally after the WebSocket connection closes',()=>{
 const c=client();c.run("roomState={you:'a',phase:'lobby',players:[{id:'a',owner:'a'}]};mode='lobby';connect()");
 c.webSockets[0].onclose();
 assert.equal(c.context.document.querySelector('#start').disabled,false);
 assert.equal(c.context.document.querySelector('#start').textContent,'НАЧАТЬ ОФЛАЙН');
 assert.equal(typeof c.context.document.querySelector('#start').onclick,'function');
});
test('a multiplayer room is not silently converted to an offline solo race',()=>{
 const c=client();c.run("roomState={you:'a',phase:'lobby',players:[{id:'a',owner:'a'},{id:'b',owner:'b'}]};mode='lobby';connect()");
 c.webSockets[0].onclose();
 assert.equal(c.context.document.querySelector('#start').disabled,true);
 assert.notEqual(c.context.document.querySelector('#start').textContent,'НАЧАТЬ ОФЛАЙН');
});
test('our car responds locally while server elimination still ends its participation',()=>{
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

test('local driving survives a 900 ms packet gap and incoming poses cannot move our car',()=>{
 const c=client();c.context.sample=state();c.run('roomState=sample;installGame(sample);keys.TouchGas=true');
 const before=c.run('localCar.x');
 for(let i=0;i<108;i++){c.advance(1000/120);c.run('update(1/120)');}
 const x=c.run('localCar.x'),y=c.run('localCar.y');
 assert.ok(x>before+10);
 c.context.sample=structuredClone(c.context.sample);c.context.sample.game.cars[0].x=25;c.context.sample.game.cars[0].y=y+60;
 c.run('roomState=sample;installGame(sample)');
 assert.equal(c.run('localCar.x'),x);assert.equal(c.run('localCar.y'),y);
 c.run('globalThis.sent=[];send=msg=>sent.push(msg);sendPose(true)');
 assert.equal(c.context.sent[0].type,'pose');assert.equal(c.context.sent[0].pose.x,x);
});

test('solo race keeps its full local simulation running after the server socket drops',()=>{
 const c=client(),sample=state();sample.players=sample.players.slice(0,1);sample.racers=sample.racers.slice(0,1);sample.game.cars=sample.game.cars.slice(0,1);
 c.context.sample=sample;c.run('roomState=sample;installGame(sample);snapshots=[];connectionLost=true;keys.KeyD=true');
 const before=c.run('localCar.x'),time=c.run('time');
 for(let i=0;i<120;i++){c.advance(1000/120);c.run('update(1/120)');}
 assert.ok(c.run('localCar.x')>before+10,'the solo car continues accelerating without server snapshots');
 assert.ok(c.run('time')>time+.9,'offline continuation advances the race world');
});

test('shared bonus rewards apply locally once without replacing the local pose',()=>{
 const c=client();c.context.sample=state();c.run('roomState=sample;installGame(sample);localCar.fuel=30');
 c.context.sample.game.rewards=[{id:7,i:0,type:0}];
 c.run('installGame(sample);installGame(sample)');assert.equal(c.run('localCar.fuel'),70);
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
test('local physics stays finite under incoming snapshots for all eight vehicles',()=>{
 for(let model=0;model<8;model++){
  const c=client(),profiles=[{id:'a',character:0,ability:'turbo',color:'red',gas:true}];
  const sim=createSimulation(profiles,model%7,model),base=state();
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

test('crates and bridges interpolate without mutating server data or confusing removed crates',()=>{
 const c=client();c.context.sample=state();c.run('roomState=sample;installGame(sample)');
 c.run(`const left=structuredClone(sample),right=structuredClone(sample);
 const crate={id:2,x:100,y:100,a:0,age:1,chuteFade:0,vx:60,vy:80,av:1,grounded:false,claimedBy:null,type:0};
 left.serverNow=1000;right.serverNow=1050;
 left.game.bonus=[{...crate,id:1,x:-100,y:-100},crate];right.game.bonus=[{...crate,x:120,y:140,a:.2,age:1.05}];
 left.game.bridges=[{a:100,b:200,q:[0,0],v:[0,0]}];right.game.bridges=[{a:100,b:200,q:[10,4],v:[0,0]}];
 left.game.time=2;right.game.time=2.05;time=2;
 snapshots=[left,right];roomState=right;window.onlineIndex=-1;interpolationDelay=70;snapshotReceived=performance.now()-45;update(1/120);`);
 assert.equal(c.run('bonus.length'),1);
 assert.equal(c.run('bonus[0].id'),2);
 assert.equal(c.run('bonus[0].x'),110);
 assert.equal(c.run('bonus[0].y'),120);
 assert.equal(c.run('hillBridgeStates.get(100).q[0]'),5);
 assert.equal(c.run('right.game.bonus[0].x'),120);
 c.advance(100);c.run('update(1/120)');assert.ok(c.run('bonus[0].x')>120);
 c.advance(5000);c.run('update(1/120)');assert.equal(c.run('bonus[0].x'),129);
 c.run('right.game.bonus[0].grounded=true;update(1/120)');assert.equal(c.run('bonus[0].x'),120);
 c.run('right.game.bonus=[];update(1/120)');assert.equal(c.run('bonus.length'),0);
});

test('animation time never jumps on packet installation and advances during short packet gaps',()=>{
 const c=client();c.context.sample=state();c.run('roomState=sample;installGame(sample);time=5');
 c.context.sample=structuredClone(c.context.sample);c.context.sample.game.time=5.1;c.context.sample.serverNow=1050;
 c.run('roomState=sample;installGame(sample)');assert.equal(c.run('time'),5);
 c.advance(100);c.run('update(1/120)');const before=c.run('time');assert.ok(before>5.1);
 c.context.sample.game.time=5.11;c.context.sample.serverNow=1060;
 c.run('roomState=sample;installGame(sample);update(1/120)');assert.ok(c.run('time')>=before);
});

test('synchronised render timeline does not rewind when packet delay increases',()=>{
 const c=client();c.context.sample=state();c.run('roomState=sample;installGame(sample)');
 c.run(`const left=structuredClone(sample),right=structuredClone(sample);
 left.serverNow=1000;right.serverNow=1050;
 left.game.cars[1].x=100;right.game.cars[1].x=200;
 snapshots=[left,right];roomState=right;serverToLocal=-75;interpolationDelay=70;update(1/120);`);
 assert.equal(c.run('cars[1].x'),110);
 c.run('interpolationDelay=100;update(1/120)');assert.equal(c.run('cars[1].x'),110);
 c.advance(50);c.run('update(1/120)');assert.equal(c.run('cars[1].x'),150);
});

test('duplicate server snapshots do not insert frozen opponent samples',()=>{
 const c=client();c.context.sample=state();
 c.context.sample.carPoses=[{seq:1,at:1000},{seq:1,at:1000}];
 c.context.sample.game.cars[1].x=100;c.context.sample.game.cars[1].vx=100;
 c.run('roomState=sample;installGame(sample)');
 c.context.sample.serverNow=1030;c.run('installGame(sample)');
 assert.equal(c.run('remoteFrames.get(1).length'),1);
 c.context.sample.serverNow=1080;c.context.sample.carPoses[1]={seq:2,at:1050};c.context.sample.game.cars[1].x=105;
 c.run('installGame(sample)');
 assert.equal(c.run('remotePose(1,1025,{}).x'),102.5);
 assert.equal(c.run('remotePose(1,1100,{}).x'),110);
 assert.equal(c.run('remotePose(1,5000,{}).x'),120);
 assert.equal(c.context.sample.game.cars[1].x,105);
});

test('240 Hz callbacks draw every frame and interpolate the 120 Hz physics',()=>{
 const c=client();
 c.run(`mode='race';cars=[{x:0,y:0,a:0,wheel:0}];last=1000;lastDraw=1000;acc=0;
 globalThis.positions=[];globalThis.steps=0;
 update=dt=>{cars[0].x+=120*dt;steps++};
 draw=()=>positions.push(cars[0].x);animateSuspension=()=>{};syncGameScreen=()=>{};`);
 for(let i=1;i<=240;i++){c.advance(1000/240);c.run('frame(performance.now())');}
 assert.equal(c.context.positions.length,240);
 assert.ok(c.context.steps>=119&&c.context.steps<=120);
 for(let i=3;i<c.context.positions.length;i++)assert.ok(Math.abs(c.context.positions[i]-c.context.positions[i-1]-.5)<1e-6,'half-pixel motion each frame');
 assert.ok(Math.abs(c.run('cars[0].x')-c.context.steps)<1e-6,'drawing restores simulation positions');
 assert.ok(Math.abs(c.run('window.gameDebug.getPerformance().fps')-240)<1e-6);
});
