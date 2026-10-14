import test from 'node:test';
import assert from 'node:assert/strict';
import {Lobby} from '../server/lobby.js';
function setup(){const lobby=new Lobby(),messages=new Map();const connect=network=>{const list=[];const id=lobby.connect(msg=>list.push(structuredClone(msg)),network);messages.set(id,list);return id;};return {lobby,messages,connect,last:(id,type)=>messages.get(id).filter(m=>m.type===type).at(-1)};}
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
 lobby.disconnect(b);assert.equal(lobby.rooms.has(code),false);
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
