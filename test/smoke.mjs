import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
const base=process.env.TEST_URL||'http://127.0.0.1:3107';
const sockets=[],latest=[],updates=[[],[]];
try {
  assert.equal((await fetch(base+'/health')).status,200);
  for(const asset of ['/','/game.js','/online.js','/maps.js','/vehicles.js','/hills.js','/race-art.js','/style.css','/assets/hills-panorama.png','/assets/car-jeep-open-arches.png','/assets/'+encodeURIComponent('Егерь')+'.png'])assert.equal((await fetch(base+asset)).status,200,asset+' must load');
  for(let i=0;i<2;i++){
    const ws=new WebSocket(base.replace(/^http/,'ws')+'/ws');sockets.push(ws);
    ws.on('message',data=>{const state=JSON.parse(data);latest[i]=state;updates[i].push(state);});
    await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  }
  const until=async(fn,ms=15000)=>{const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,25));}};
  await until(()=>latest.every(s=>s?.online===2));
  sockets[0].send(JSON.stringify({type:'ready',ready:true}));
  await until(()=>latest[0]?.players[0].ready);
  assert.equal(latest[0].phase,'lobby');
  sockets[1].send(JSON.stringify({type:'ready',ready:true}));
  await until(()=>latest.every(s=>s?.phase==='countdown'));
  const deadline=latest[0].startAt;assert.equal(deadline,latest[1].startAt);
  assert.ok(deadline-latest[0].serverNow>9000);
  await until(()=>latest.every(s=>s.phase==='race'));
  assert.equal(latest[0].game.seed,latest[1].game.seed);
  assert.equal(latest[0].game.cars.length,2);
  assert.ok(Date.now()>=deadline);
  const x=latest[0].game.cars[0].x;
  const input=setInterval(()=>sockets[0].send(JSON.stringify({type:'input',gas:true})),100);
  await until(()=>latest[0].game.cars[0].x>x+10,5000);clearInterval(input);
  sockets[1].close();await until(()=>latest[0].phase==='result');
  assert.equal(latest[0].game.winner,0);
  console.log('PASS: two real WebSocket clients, shared ten-second countdown, shared track, movement, disconnect, result');
} finally {for(const ws of sockets)ws.close();}
