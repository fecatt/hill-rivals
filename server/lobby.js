import {randomUUID,randomInt,randomBytes,createHmac} from 'node:crypto';
import {Room} from './room.js';
import {isIP} from 'node:net';

function networkAddress(address){
 const value=String(address).replace(/^::ffff:/,'').split('%')[0];
 if(isIP(value)!==6)return value;
 const [left,right]=value.split('::'),a=left?left.split(':'):[],b=right?right.split(':'):[];
 const parts=right!==undefined?[...a,...Array(8-a.length-b.length).fill('0'),...b]:a;
 return 'ipv6:'+parts.slice(0,4).map(part=>parseInt(part,16).toString(16)).join(':');
}

// Network identifiers stay server-side. An IP match is a discovery hint, not proof of LAN connectivity.
export class Lobby {
 constructor(options={}){this.options=options;this.rooms=new Map();this.clients=new Map();this.salt=randomBytes(32);}
 connect(send,address='unknown'){
  const id=randomUUID(),network=createHmac('sha256',this.salt).update(networkAddress(address)).digest('hex');
  this.clients.set(id,{id,send,network,room:null});this.directory(id);return id;
 }
 directory(id){
  const client=this.clients.get(id);if(!client||client.room)return;
  client.send({type:'directory',you:id,online:this.clients.size,rooms:[...this.rooms.values()].map(room=>({
   code:room.code,name:room.name,phase:room.phase,count:room.clients.size,capacity:8,track:room.track,vehicle:room.vehicle,
   local:[...room.clients.keys()].some(key=>this.clients.get(key)?.network===client.network),
  }))});
 }
 broadcastDirectory(){for(const client of this.clients.values())this.directory(client.id);}
 removeFromRoom(client){
  const room=client.room;if(!room)return;room.leave(client.id);client.room=null;
  if(!room.clients.size)this.rooms.delete(room.code);
 }
 disconnect(id){const client=this.clients.get(id);if(!client)return;this.removeFromRoom(client);this.clients.delete(id);this.broadcastDirectory();}
 message(id,msg){
  const client=this.clients.get(id);if(!client)return;
  if(msg.type==='create-room'){
   if(client.room||this.rooms.size>=64)return;
   let code;do{code=Array.from({length:5},()=>String.fromCharCode(65+randomInt(26))).join('');}while(this.rooms.has(code));
   const name=typeof msg.name==='string'?msg.name.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,36):'';
   const room=new Room({...this.options,code,name:name||'Гонка с друзьями'});this.rooms.set(code,room);client.room=room;
   room.join(client.send,id);client.send({type:'chat',messages:room.chat});this.broadcastDirectory();return;
  }
  if(msg.type==='join-room'){
   const code=typeof msg.code==='string'?msg.code.trim().toUpperCase():'';
   if(!/^[A-Z]{5}$/.test(code)){client.send({type:'notice',text:'Введите код из пяти латинских букв.'});return;}
   const room=this.rooms.get(code);
   if(!room){client.send({type:'notice',text:'Комната не найдена. Проверьте код.'});return;}
   if(client.room===room)return;
   if(room.clients.size>=8){client.send({type:'notice',text:'Комната заполнена: максимум 8 игроков.'});return;}
   this.removeFromRoom(client);client.room=room;room.join(client.send,id);client.send({type:'chat',messages:room.chat});this.broadcastDirectory();return;
  }
  if(msg.type==='leave-room'){this.removeFromRoom(client);this.directory(id);this.broadcastDirectory();return;}
  if(msg.type==='directory'){this.directory(id);return;}
  client.room?.message(id,msg);
 }
 tick(){for(const room of this.rooms.values())room.tick();}
 broadcast(){for(const room of this.rooms.values())room.broadcast(false);}
}
