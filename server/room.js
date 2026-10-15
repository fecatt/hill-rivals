import {randomUUID} from 'node:crypto';
import {createSimulation} from './simulation.js';

const palette = ['#e64d36','#418acb','#e5b83d','#8b5cc7','#2b9b82','#e779a8','#b07945'];
export class Room {
  constructor({now = Date.now, countdownMs = 3000, makeSimulation = createSimulation,code='',name='Комната'} = {}) {
    this.now=now; this.countdownMs=countdownMs; this.makeSimulation=makeSimulation;
    this.clients=new Map(); this.phase='lobby'; this.startAt=null;
    this.track=0; this.vehicle=0; this.racers=[]; this.round=0; this.sim=null;
    this.code=code;this.name=name;this.host=null;this.chat=[];this.chatSerial=0;this.playerSerial=0;
  }
  seatId(id,slot){return slot===0?id:id+':'+slot;}
  seatCount(){return [...this.clients.values()].reduce((n,p)=>n+p.seats.length,0);}
  setSeats(p,profiles){
    if(!Array.isArray(profiles)||profiles.length<1||profiles.length>4)return false;
    const others=this.seatCount()-p.seats.length;if(others+profiles.length>8)return false;
    if(this.phase==='race'&&p.seats.length)return false;
    p.seats=profiles.map((profile,slot)=>{
      const old=p.seats[slot]||{};
      const number=old.number||(slot===0?p.number:++this.playerSerial);
      return {id:this.seatId(p.id,slot),owner:p.id,slot,number,name:typeof profile?.name==='string'?profile.name.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,24)||'Игрок '+number:old.name||'Игрок '+number,character:Number.isInteger(profile?.character)&&profile.character>=0&&profile.character<7?profile.character:old.character||0,ability:['turbo','jump','shield'].includes(profile?.ability)?profile.ability:old.ability||'turbo',ready:false,gas:false,brake:false,lastInput:0};
    });
    p.name=p.seats[0].name;return true;
  }
  racerIndex(owner,slot){return this.racers.findIndex(r=>r.owner===owner&&r.slot===slot);}
  join(send,id=randomUUID(),name='') {
    const number=++this.playerSerial;
    const party={id,send,number,name:name||'Игрок '+number,ready:false,inGarage:false,seats:[],directPeers:new Set()};
    this.clients.set(id,party);party.gas=false;party.brake=false;this.setSeats(party,[{name:party.name}]);
    if(!this.host)this.host=id;
    this.considerStart(); this.broadcast(); return id;
  }
  leave(id) {
    if(this.phase==='race')for(const [index,racer] of this.racers.entries())if(racer.owner===id)this.sim.disconnect(index);
    this.clients.delete(id);
    if(this.host===id)this.host=this.clients.keys().next().value||null;
    if(!this.clients.size) {this.phase='lobby';this.sim=null;this.startAt=null;this.racers=[];}
    this.considerStart(); this.broadcast();
  }
  considerStart() {
    if(!['lobby','countdown'].includes(this.phase))return;
    const allReady=this.clients.size>0&&[...this.clients.values()].every(p=>p.ready);
    if(!allReady){this.phase='lobby';this.startAt=null;return;}
    if(this.phase==='lobby'){this.phase='countdown';this.startAt=this.now()+this.countdownMs;}
  }

  message(id,msg) {
    const p=this.clients.get(id); if(!p) return;
    if(msg.type==='return-garage'){
      if(this.phase==='race')for(const [index,racer] of this.racers.entries())if(racer.owner===id)this.sim.disconnect(index);
      p.inGarage=true;p.ready=false;for(const seat of p.seats){seat.gas=false;seat.brake=false;}this.broadcast();return;
    }
    if(msg.type==='name'){
      if(typeof msg.name!=='string')return;
      p.name=msg.name.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,24)||'Игрок '+p.number;p.seats[0].name=p.name;
      this.broadcast();return;
    }
    if(msg.type==='rename-room'){
      if(id!==this.host||!['lobby','result'].includes(this.phase)||typeof msg.name!=='string')return;
      const name=msg.name.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,36);
      if(name){this.name=name;this.broadcast();}return;
    }
    if(msg.type==='transport'){
      p.directPeers=new Set(Array.isArray(msg.peers)?msg.peers.filter(key=>key!==id&&this.clients.has(key)).slice(0,7):[]);return;
    }
    if(msg.type==='chat'){
      if(typeof msg.text!=='string'||this.now()-(p.lastChatAt??-Infinity)<500)return;
      const text=msg.text.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300);if(!text)return;
      p.lastChatAt=this.now();this.chat.push({id:++this.chatSerial,from:id,name:p.seats[0]?.name||p.name,character:p.seats[0]?.character||0,text,at:this.now()});
      if(this.chat.length>80)this.chat.shift();
      for(const c of this.clients.values())c.send({type:'chat',messages:this.chat});
      return;
    }
    if(['signal','peer-probe'].includes(msg.type)){
      const target=this.clients.get(msg.to);if(!target||target.id===id)return;
      if(msg.type==='signal'&&JSON.stringify(msg.data||{}).length>12000)return;
      target.send({type:msg.type,from:id,data:msg.data});return;
    }
    if(msg.type==='pose'){
      msg={...msg,type:'poses',poses:[{slot:0,seq:msg.seq,time:msg.time,pose:msg.pose}]};
    }
    if(msg.type==='poses'){
      if(this.phase!=='race'||msg.round!==this.round||!Array.isArray(msg.poses))return;
      const now=this.now();
      for(const item of msg.poses.slice(0,4)){
        const slot=Number.isInteger(item.slot)?item.slot:0,index=this.racerIndex(id,slot),seat=p.seats[slot];
        if(index<0||!seat||!Number.isSafeInteger(item.seq)||item.seq<1||item.seq<=(seat.poseSeq||0))continue;
        if(!Number.isFinite(item.time)||item.time<(seat.poseTime||0)||item.time>(now-this.raceStartedAt)/1000+.5)continue;
        if(this.sim.pose(index,item.pose,Math.max(0,(now-(seat.lastPoseAt??this.raceStartedAt))/1000))){seat.poseSeq=item.seq;seat.poseTime=item.time;seat.lastPoseAt=now;seat.localPhysics=true;if(slot===0)p.localPhysics=true;}
      }
      return;
    }
    if(msg.type==='input') {
      const controls=Array.isArray(msg.seats)?msg.seats:[{slot:0,gas:msg.gas,brake:msg.brake,ability:msg.ability}];
      for(const control of controls.slice(0,4)){const seat=p.seats[control.slot];if(!seat)continue;seat.gas=control.gas===true;seat.brake=control.brake===true;seat.lastInput=this.now();if(control.slot===0){p.gas=seat.gas;p.brake=seat.brake;p.lastInput=seat.lastInput;}if(control.ability===true&&this.phase==='race'&&!seat.localPhysics){const index=this.racerIndex(id,control.slot);if(index>=0)this.sim.ability(index);}}
      return;
    }
    if(msg.type==='ready' && ['lobby','countdown','result'].includes(this.phase)) {
      if(this.phase==='result') {this.phase='lobby';this.sim=null;this.racers=[];}
      p.inGarage=false;p.ready=msg.ready===true;
      this.considerStart();
    }
    if(msg.type==='profile' && ['lobby','countdown'].includes(this.phase)) {
      if(msg.seats){if(!this.setSeats(p,msg.seats)){p.send({type:'notice',text:'В комнате может быть не больше 8 гонщиков.'});return;}}
      else {const first=p.seats[0];if(Number.isInteger(msg.character)&&msg.character>=0&&msg.character<7)first.character=msg.character;if(['turbo','jump','shield'].includes(msg.ability))first.ability=msg.ability;}
      p.ready=false;
    }
    if(msg.type==='settings' && this.phase==='lobby' && id===this.host) {
      if(Number.isInteger(msg.track)&&msg.track>=0&&msg.track<7)this.track=msg.track;
      if(Number.isInteger(msg.vehicle)&&msg.vehicle>=0&&msg.vehicle<8)this.vehicle=msg.vehicle;
      for(const c of this.clients.values())c.ready=false;
    }
    this.considerStart(); this.broadcast();
  }
  tick() {
    this.considerStart();
    if(this.phase==='countdown' && this.now()>=this.startAt) {
      this.racers=[...this.clients.values()].flatMap(p=>p.seats);
      this.raceStartedAt=this.now();
      this.racers.forEach((p,i)=>{p.color=palette[i%palette.length];p.gas=false;p.brake=false;p.ready=false;p.localPhysics=false;p.poseSeq=0;p.poseTime=0;p.lastPoseAt=this.raceStartedAt;});
      this.sim=this.makeSimulation(this.racers,this.track,this.vehicle);
      this.phase='race';this.round++;this.startAt=null;
    }
    if(this.phase==='race') {
      for(const [index,p] of this.racers.entries()){
        if(this.now()-p.lastInput>1500){p.gas=false;p.brake=false;const owner=this.clients.get(p.owner);if(p.slot===0&&owner){owner.gas=false;owner.brake=false;}}
        if(p.localPhysics&&p.disconnectedAt==null&&this.now()-p.lastPoseAt>30000)this.sim.disconnect(index);
      }
      this.sim.step();
      if(this.sim.state().finished){this.phase='result';for(const p of this.clients.values())p.ready=false;}
    }
  }
  snapshot(id, state=this.sim?.state()) {
    const inGarage=this.clients.get(id)?.inGarage,party=this.clients.get(id);
    return {type:'state',you:id,poseSequence:party?.seats[0]?.poseSeq||0,poseSequences:party?.seats.map(seat=>seat.poseSeq||0)||[],phase:inGarage?'lobby':this.phase,round:this.round,serverNow:this.now(),startAt:this.startAt,
      room:{code:this.code,name:this.name,host:this.host},
      track:this.track,vehicle:this.vehicle,
      online:this.seatCount(),inRace:this.phase==='race'?state.cars.filter(c=>c.alive&&this.clients.has(this.racers[c.i]?.owner)).length:0,
      players:[...this.clients.values()].flatMap(p=>p.seats.map(seat=>({id:seat.id,owner:p.id,slot:seat.slot,name:seat.name,character:seat.character,ability:seat.ability,ready:p.ready,online:p.disconnectedAt==null}))),
      racers:this.racers.map(p=>({id:p.id,owner:p.owner,slot:p.slot,name:p.name,character:p.character,ability:p.ability,color:p.color})),
      carPoses:this.racers.map(p=>({seq:p.poseSeq||0,at:p.lastPoseAt??this.raceStartedAt})),
      game:inGarage?null:state};
  }
  broadcast(force=true) {
    const state=this.sim?.state(),now=this.now();
    for(const p of this.clients.values()){
      const direct=this.phase==='race'&&this.clients.size>1&&[...this.clients.keys()].every(id=>id===p.id||p.directPeers?.has(id));
      // Direct peers exchange cars at 30 Hz. Keep a 10 Hz server backup and shared-world stream.
      if(!force&&direct&&now-(p.lastSnapshotAt??-Infinity)<100)continue;
      p.lastSnapshotAt=now;p.send(this.snapshot(p.id,state));
    }
  }
}
