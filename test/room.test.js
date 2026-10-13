import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../server/room.js';
test('one ready visitor starts all players after exactly ten seconds',()=>{
  let now=1000;const room=new Room({now:()=>now});
  const a=room.join(()=>{}),b=room.join(()=>{});
  room.message(a,{type:'ready',ready:true});assert.equal(room.phase,'countdown');
  assert.equal(room.clients.get(b).ready,false);assert.equal(room.startAt,11000);
  now=10999;room.tick();assert.equal(room.phase,'countdown');
  now=11000;room.tick();assert.equal(room.phase,'race');
  assert.equal(room.snapshot(a).game.cars.length,2);
  const x=room.snapshot(a).game.cars[0].x;
  for(let i=0;i<240;i++){now+=1000/120;room.message(a,{type:'input',gas:true});room.tick();}
  assert.ok(room.snapshot(a).game.cars[0].x>x);
  assert.deepEqual(room.snapshot(a).game,room.snapshot(b).game);
});
test('arrivals, departures and repeated ready clicks do not restart or cancel countdown',()=>{
  let now=1000;const room=new Room({now:()=>now});const a=room.join(()=>{});
  room.message(a,{type:'ready',ready:true});assert.equal(room.phase,'countdown');
  const deadline=room.startAt;now+=2000;
  const b=room.join(()=>{});assert.equal(room.phase,'countdown');
  room.message(b,{type:'ready',ready:true});assert.equal(room.startAt,deadline);
  room.message(a,{type:'ready',ready:false});assert.equal(room.phase,'countdown');
  room.leave(a);assert.equal(room.startAt,deadline);
  const c=room.join(()=>{});room.message(c,{type:'profile',character:4,ability:'jump'});
  now=deadline;room.tick();assert.equal(room.racers.length,2);
  assert.equal(room.racers[1].character,4);
});
test('any visitor selects settings; active race visitors spectate; disconnect ends two-car race',()=>{
  let now=0;const room=new Room({now:()=>now});const a=room.join(()=>{}),b=room.join(()=>{});
  room.message(b,{type:'settings',track:4});assert.equal(room.track,4);
  room.message(a,{type:'settings',track:100,vehicle:-1});assert.equal(room.track,4);
  assert.equal('host' in room.snapshot(a),false);
  room.message(a,{type:'profile',character:6,ability:'shield'});
  room.message(a,{type:'ready',ready:true});room.message(b,{type:'ready',ready:true});
  now=10000;room.tick();const c=room.join(()=>{});
  assert.equal(room.snapshot(c).online,3);assert.equal(room.racers.length,2);
  assert.equal(room.snapshot(c).game.cars[0].ability,'shield');
  room.leave(b);room.tick();assert.equal(room.phase,'result');
  assert.equal(room.snapshot(a).game.winner,0);
  room.message(a,{type:'ready',ready:true});assert.equal(room.phase,'countdown');
  room.message(c,{type:'ready',ready:true});assert.equal(room.phase,'countdown');
});
test('empty room resets; forgotten controls expire; all models run finite physics',()=>{
  for(let model=0;model<7;model++){
    let now=0;const room=new Room({now:()=>now});const a=room.join(()=>{});
    room.message(a,{type:'settings',vehicle:model,track:model});room.message(a,{type:'ready',ready:true});
    now=10000;room.tick();room.message(a,{type:'input',gas:true});
    now+=1600;room.tick();assert.equal(room.clients.get(a).gas,false);
    for(let i=0;i<240;i++)room.tick();
    for(const car of room.sim.state().cars)assert.ok(Number.isFinite(car.x)&&Number.isFinite(car.y));
    room.leave(a);assert.equal(room.phase,'lobby');assert.equal(room.sim,null);
  }
});
