import test from 'node:test';
import assert from 'node:assert/strict';
import {Lobby} from '../server/lobby.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
function setup(){const lobby=new Lobby(),messages=new Map();const connect=network=>{const list=[];const id=lobby.connect(msg=>list.push(structuredClone(msg)),network);messages.set(id,list);return id;};return {lobby,messages,connect,last:(id,type)=>messages.get(id).filter(m=>m.type===type).at(-1)};}
test('room code and settings survive empty room, disconnection and server restart',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hill-rooms-'));
 try{
  const storeFile=path.join(dir,'rooms.json');let now=1000;const lobby=new Lobby({storeFile,now:()=>now}),messages=[];
  const deliver=msg=>messages.push(msg),id=lobby.connect(deliver,'home','session');lobby.message(id,{type:'create-room'});const code=messages.find(m=>m.type==='state').room.code;
  lobby.message(id,{type:'rename-room',name:'Друзья'});lobby.message(id,{type:'settings',track:4,vehicle:2});lobby.disconnect(id,deliver);now+=1500;
  const reconnected=lobby.connect(()=>{},'home','session');assert.equal(reconnected,id);assert.equal(lobby.clients.get(id).room.code,code);
  lobby.disconnect(id,deliver);assert.ok(lobby.clients.has(id),'obsolete socket close cannot disconnect new connection');
  lobby.disconnect(id);now+=31000;lobby.tick();assert.equal(lobby.rooms.get(code).clients.size,0);now+=5000;lobby.tick();assert.ok(lobby.rooms.has(code));
  const restarted=new Lobby({storeFile,now:()=>now});const out=[],next=restarted.connect(msg=>out.push(msg));restarted.message(next,{type:'join-room',code});const state=out.find(m=>m.type==='state');assert.equal(state.room.name,'Друзья');assert.equal(state.track,4);assert.equal(state.vehicle,2);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true,force:true});}
});
test('global directory lists every room and local directory marks only matching networks',()=>{
 const {lobby,connect,last}=setup(),a=connect('home'),b=connect('home'),c=connect('elsewhere');
 lobby.message(a,{type:'create-room',name:'Наша гонка'});const code=last(a,'state').room.code;assert.match(code,/^[A-Z]{5}$/);
 assert.equal(last(b,'directory').rooms[0].local,true);assert.equal(last(c,'directory').rooms[0].local,false);
 lobby.message(c,{type:'create-room',name:'Другой заезд'});lobby.message(b,{type:'directory'});
 assert.equal(last(b,'directory').rooms.length,2);assert.equal(last(b,'directory').rooms.filter(r=>r.local).length,1);
 lobby.message(b,{type:'join-room',code:code.toLowerCase()});assert.equal(last(b,'state').room.code,code);
 assert.equal(last(b,'state').room.host,a);lobby.message(b,{type:'settings',track:3});assert.equal(lobby.rooms.get(code).track,0);
 lobby.message(a,{type:'settings',track:3});assert.equal(lobby.rooms.get(code).track,3);
 lobby.disconnect(a);assert.equal(last(b,'state').room.host,b);
 lobby.disconnect(b);assert.equal(lobby.rooms.has(code),true);
});
test('chat and signaling remain inside the selected room; missing codes report an error',()=>{
 const {lobby,connect,last,messages}=setup(),a=connect('one'),b=connect('two'),c=connect('three');
 lobby.message(a,{type:'create-room'});const code=last(a,'state').room.code;lobby.message(b,{type:'join-room',code});lobby.message(c,{type:'create-room'});
 const before=messages.get(c).length;lobby.message(a,{type:'chat',text:'<img onerror=alert(1)> привет'});
 assert.equal(last(b,'chat').messages[0].text,'<img onerror=alert(1)> привет');assert.equal(messages.get(c).length,before);
 lobby.message(a,{type:'signal',to:c,data:{description:{type:'offer'}}});assert.equal(messages.get(c).length,before);
 lobby.message(a,{type:'signal',to:b,data:{description:{type:'offer'}}});assert.equal(last(b,'signal').from,a);
 const d=connect('one');lobby.message(d,{type:'join-room',code:'12345'});assert.equal(last(d,'notice').text,'Введите код из пяти латинских букв.');
 lobby.message(d,{type:'join-room',code:'ZZZZZ'});assert.ok(last(d,'notice').text.includes('не найдена'));
});

test('IPv6 devices in the same /64 and IPv4 mapped addresses are discovered together',()=>{
 const {lobby,connect,last}=setup(),a=connect('2001:db8:1:2::10'),b=connect('2001:db8:1:2::20');
 lobby.message(a,{type:'create-room'});assert.equal(last(b,'directory').rooms[0].local,true);
 const c=connect('::ffff:192.0.2.10'),d=connect('192.0.2.10');lobby.message(c,{type:'create-room'});assert.equal(last(d,'directory').rooms.some(room=>room.local),true);
});

test('rooms receive automatic titles, only the host renames, and player names survive room changes',()=>{
 const {lobby,connect,last}=setup(),a=connect('home'),b=connect('home');
 lobby.message(a,{type:'name',name:'  Фёдор  '});lobby.message(a,{type:'create-room'});
 const code=last(a,'state').room.code;assert.equal(last(a,'state').room.name,'Гонка '+code);
 lobby.message(b,{type:'join-room',code});assert.equal(last(b,'state').players[1].name,'Игрок 2');
 lobby.message(b,{type:'rename-room',name:'Чужое название'});assert.equal(last(a,'state').room.name,'Гонка '+code);
 lobby.message(a,{type:'rename-room',name:'Наш заезд'});assert.equal(last(b,'state').room.name,'Наш заезд');
 lobby.message(b,{type:'name',name:'<b>Вера</b>'});lobby.message(b,{type:'chat',text:'Привет'});
 assert.equal(last(a,'chat').messages[0].name,'<b>Вера</b>');
 lobby.message(b,{type:'leave-room'});lobby.message(b,{type:'create-room'});
 assert.equal(last(b,'state').players[0].name,'<b>Вера</b>');
 assert.equal(last(a,'state').players[0].name,'Фёдор');
});

test('empty rooms expire after fifteen minutes and occupied rooms never expire',()=>{
 let now=1000;const lobby=new Lobby({now:()=>now}),messages=[];
 const a=lobby.connect(m=>messages.push(m),'home');lobby.message(a,{type:'create-room'});const code=messages.find(m=>m.type==='state').room.code;
 now+=20*60*1000;lobby.tick();assert.ok(lobby.rooms.has(code),'active room survives');
 lobby.message(a,{type:'leave-room'});const emptyAt=now;
 now=emptyAt+15*60*1000-1;lobby.tick();assert.ok(lobby.rooms.has(code));
 lobby.message(a,{type:'join-room',code});lobby.tick();assert.ok(lobby.rooms.has(code),'returning player resets timer');
 now+=20*60*1000;lobby.tick();assert.ok(lobby.rooms.has(code));lobby.disconnect(a);
 now+=15*60*1000;lobby.tick();assert.equal(lobby.rooms.has(code),false);
});

test('empty-room deadline persists through server restart and expires from stored directory',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hill-expire-'));
 try{
  const storeFile=path.join(dir,'rooms.json');let now=10000;const lobby=new Lobby({storeFile,now:()=>now}),out=[];
  const id=lobby.connect(m=>out.push(m),'home','session');lobby.message(id,{type:'create-room'});const code=out.find(m=>m.type==='state').room.code;
  lobby.disconnect(id);now+=31000;lobby.tick();now+=10*60*1000;
  const restarted=new Lobby({storeFile,now:()=>now});assert.ok(restarted.rooms.has(code));
  now=10000+15*60*1000;restarted.tick();assert.equal(restarted.rooms.has(code),false);
  assert.equal(new Lobby({storeFile,now:()=>now}).rooms.has(code),false);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true,force:true});}
});
