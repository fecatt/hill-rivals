import {randomUUID,randomInt,randomBytes,createHmac} from 'node:crypto';
import {Room} from './room.js';
import {isIP} from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
const EMPTY_ROOM_TTL=15*60*1000;

function networkAddress(address){
 const value=String(address).replace(/^::ffff:/,'').split('%')[0];
 if(isIP(value)!==6)return value;
 const [left,right]=value.split('::'),a=left?left.split(':'):[],b=right?right.split(':'):[];
 const parts=right!==undefined?[...a,...Array(8-a.length-b.length).fill('0'),...b]:a;
 return 'ipv6:'+parts.slice(0,4).map(part=>parseInt(part,16).toString(16)).join(':');
}

// Network identifiers stay server-side. An IP match is a discovery hint, not proof of LAN connectivity.
export class Lobby {
 constructor(options={}){
  this.options=options;this.rooms=new Map();this.clients=new Map();this.sessions=new Map();this.salt=randomBytes(32);
  if(options.storeFile&&fs.existsSync(options.storeFile))for(const saved of JSON.parse(fs.readFileSync(options.storeFile,'utf8'))){
   if(!/^[A-Z]{5}$/.test(saved.code))continue;
   const room=new Room({...options,code:saved.code,name:saved.name});room.track=saved.track;room.vehicle=saved.vehicle;room.playerSerial=saved.playerSerial||0;room.emptySince=saved.emptySince??(options.now||Date.now)();if((options.now||Date.now)()-room.emptySince<EMPTY_ROOM_TTL)this.rooms.set(room.code,room);
  }
 }
 persistRooms(){
  if(!this.options.storeFile)return;
  const file=this.options.storeFile;fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',JSON.stringify([...this.rooms.values()].map(r=>({code:r.code,name:r.name,track:r.track,vehicle:r.vehicle,playerSerial:r.playerSerial,emptySince:r.emptySince??null}))));fs.renameSync(file+'.tmp',file);
 }
 markOccupancy(room){
  if(!room)return;
  const occupied=[...room.clients.values()].some(p=>p.disconnectedAt==null);
  if(occupied)room.emptySince=null;
  else if(room.emptySince==null)room.emptySince=(this.options.now||Date.now)();
 }
 connect(send,address='unknown',session=''){
  const previous=session&&this.sessions.get(session);
  if(previous){
   previous.send=send;previous.disconnectedAt=null;this.clients.set(previous.id,previous);
   if(previous.room?.clients.has(previous.id)){const party=previous.room.clients.get(previous.id);party.send=send;party.disconnectedAt=null;for(const seat of party.seats)seat.disconnectedAt=null;this.markOccupancy(previous.room);this.persistRooms();previous.room.broadcast();send({type:'chat',messages:previous.room.chat});}
   else this.directory(previous.id);
   return previous.id;
  }
  const id=randomUUID(),network=createHmac('sha256',this.salt).update(networkAddress(address)).digest('hex');
  const client={id,send,network,room:null,name:''};this.clients.set(id,client);if(session)this.sessions.set(session,client);this.directory(id);return id;
 }
 directory(id,includeRoom=false){
  const client=this.clients.get(id);if(!client||client.room&&!includeRoom)return;
  client.send({type:'directory',you:id,online:this.clients.size,rooms:[...this.rooms.values()].map(room=>({
   code:room.code,name:room.name,phase:room.phase,count:room.seatCount(),capacity:8,track:room.track,vehicle:room.vehicle,
   players:[...room.clients.values()].filter(p=>p.disconnectedAt==null).flatMap(p=>p.seats.map(seat=>seat.name)),
   local:[...room.clients.keys()].some(key=>this.clients.get(key)?.network===client.network),
  }))});
 }
 broadcastDirectory(){for(const client of this.clients.values())this.directory(client.id);}
 removeFromRoom(client,deleteIfEmpty=false){
  const room=client.room;if(!room)return;room.leave(client.id);client.room=null;this.markOccupancy(room);
  if(deleteIfEmpty&&room.clients.size===0)this.rooms.delete(room.code);
  this.persistRooms();
 }
 disconnect(id,expectedSend){
  const client=this.clients.get(id);if(!client||expectedSend&&client.send!==expectedSend)return;
  if([...this.sessions.values()].includes(client)){client.disconnectedAt=(this.options.now||Date.now)();client.send=()=>{};const party=client.room?.clients.get(id);if(party){party.send=()=>{};party.disconnectedAt=client.disconnectedAt;for(const seat of party.seats){seat.disconnectedAt=client.disconnectedAt;seat.gas=false;seat.brake=false;}}}
  else this.removeFromRoom(client);
  this.clients.delete(id);this.markOccupancy(client.room);this.persistRooms();this.broadcastDirectory();
 }
 message(id,msg){
  const client=this.clients.get(id);if(!client)return;
  if(msg.type==='name'){
   if(typeof msg.name!=='string')return;
   client.name=msg.name.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,24);
   client.room?.message(id,{type:'name',name:client.name});return;
  }
  if(msg.type==='create-room'){
   if(client.room)return;
   let code;do{code=Array.from({length:5},()=>String.fromCharCode(65+randomInt(26))).join('');}while(this.rooms.has(code));
   const name=typeof msg.name==='string'?msg.name.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,36):'';
   const room=new Room({...this.options,code,name:name||'Гонка '+code});if(Number.isInteger(msg.track)&&msg.track>=0&&msg.track<7)room.track=msg.track;if(Number.isInteger(msg.vehicle)&&msg.vehicle>=0&&msg.vehicle<8)room.vehicle=msg.vehicle;this.rooms.set(code,room);client.room=room;
   room.join(client.send,id,client.name);this.markOccupancy(room);this.persistRooms();client.send({type:'chat',messages:room.chat});this.broadcastDirectory();return;
  }
  if(msg.type==='join-room'){
   const code=typeof msg.code==='string'?msg.code.trim().toUpperCase():'';
   if(!/^[A-Z]{5}$/.test(code)){client.send({type:'notice',text:'Введите код из пяти латинских букв.'});return;}
   const room=this.rooms.get(code);
   if(!room){client.send({type:'notice',text:'Комната не найдена. Проверьте код.'});return;}
   if(client.room===room)return;
   if(room.seatCount()>=8){client.send({type:'notice',text:'Комната заполнена: максимум 8 гонщиков.'});return;}
   this.removeFromRoom(client,true);client.room=room;room.join(client.send,id,client.name);this.markOccupancy(room);this.persistRooms();client.send({type:'chat',messages:room.chat});this.broadcastDirectory();return;
  }
  if(msg.type==='leave-room'){this.removeFromRoom(client,true);client.send({type:'room-left',reason:'left'});this.directory(id);this.broadcastDirectory();return;}
  if(msg.type==='kick-player'){
   const room=client.room,targetId=typeof msg.player==='string'?msg.player:'';
   if(!room||room.host!==id||!targetId||targetId===id)return;
   const target=this.clients.get(targetId);if(!target||target.room!==room)return;
   target.send({type:'room-left',reason:'kicked'});this.removeFromRoom(target);this.directory(target.id);this.broadcastDirectory();return;
  }
  if(msg.type==='directory'){this.directory(id,true);return;}
  client.room?.message(id,msg);if(['rename-room','settings','profile'].includes(msg.type))this.persistRooms();if(msg.type==='profile')this.broadcastDirectory();
 }
 tick(){
  const now=(this.options.now||Date.now)();for(const [token,client] of this.sessions)if(client.disconnectedAt!==null&&client.disconnectedAt!==undefined&&now-client.disconnectedAt>=5*60*1000){this.removeFromRoom(client);client.disconnectedAt=null;this.sessions.delete(token);}
  let expired=false;
  for(const [code,room] of this.rooms){this.markOccupancy(room);if(room.emptySince!=null&&now-room.emptySince>=EMPTY_ROOM_TTL){this.rooms.delete(code);expired=true;}}
  if(expired){this.persistRooms();this.broadcastDirectory();}
  for(const room of this.rooms.values())if(room.clients.size)room.tick();
 }
 broadcast(){for(const room of this.rooms.values())room.broadcast(false);}
}
