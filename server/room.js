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
  join(send,id=randomUUID(),name='') {
    const number=++this.playerSerial;
    this.clients.set(id,{id,send,number,name:name||'Игрок '+number,character:0,ability:'turbo',ready:false,gas:false,brake:false,lastInput:0});
    if(!this.host)this.host=id;
    this.considerStart(); this.broadcast(); return id;
  }
  leave(id) {
    const index=this.racers.findIndex(p=>p.id===id);
    if(this.phase==='race' && index>=0) this.sim.disconnect(index);
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
      const index=this.racers.findIndex(r=>r.id===id);
      if(this.phase==='race'&&index>=0)this.sim.disconnect(index);
      p.inGarage=true;p.ready=false;p.gas=false;p.brake=false;this.broadcast();return;
    }
    if(msg.type==='name'){
      if(typeof msg.name!=='string')return;
      p.name=msg.name.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,24)||'Игрок '+p.number;
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
      p.lastChatAt=this.now();this.chat.push({id:++this.chatSerial,from:id,name:p.name,character:p.character,text,at:this.now()});
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
      const index=this.racers.findIndex(r=>r.id===id);
      if(this.phase!=='race'||index<0||msg.round!==this.round||!Number.isSafeInteger(msg.seq)||msg.seq<1||msg.seq<=(p.poseSeq||0))return;
      if(!Number.isFinite(msg.time)||msg.time<(p.poseTime||0)||msg.time>(this.now()-this.raceStartedAt)/1000+.5)return;
      if(this.sim.pose(index,msg.pose,Math.max(0,(this.now()-(p.lastPoseAt??this.raceStartedAt))/1000))){
        p.poseSeq=msg.seq;p.poseTime=msg.time;p.lastPoseAt=this.now();p.localPhysics=true;
      }
      return;
    }
    if(msg.type==='input') {
      p.gas=msg.gas===true;p.brake=msg.brake===true;p.lastInput=this.now();
      if(msg.ability===true && this.phase==='race'&&!p.localPhysics) {
        const index=this.racers.findIndex(r=>r.id===id);if(index>=0)this.sim.ability(index);
      }
      return;
    }
    if(msg.type==='ready' && ['lobby','countdown','result'].includes(this.phase)) {
      if(this.phase==='result') {this.phase='lobby';this.sim=null;this.racers=[];}
      p.inGarage=false;p.ready=msg.ready===true;
      this.considerStart();
    }
    if(msg.type==='profile' && ['lobby','countdown'].includes(this.phase)) {
      if(Number.isInteger(msg.character)&&msg.character>=0&&msg.character<7)p.character=msg.character;
      if(['turbo','jump','shield'].includes(msg.ability))p.ability=msg.ability;
      p.ready=false;
    }
    if(msg.type==='settings' && this.phase==='lobby' && id===this.host) {
      if(Number.isInteger(msg.track)&&msg.track>=0&&msg.track<7)this.track=msg.track;
      if(Number.isInteger(msg.vehicle)&&msg.vehicle>=0&&msg.vehicle<7)this.vehicle=msg.vehicle;
      for(const c of this.clients.values())c.ready=false;
    }
    this.considerStart(); this.broadcast();
  }
  tick() {
    this.considerStart();
    if(this.phase==='countdown' && this.now()>=this.startAt) {
      this.racers=[...this.clients.values()];
      this.raceStartedAt=this.now();
      this.racers.forEach((p,i)=>{p.color=palette[i%palette.length];p.gas=false;p.brake=false;p.ready=false;p.localPhysics=false;p.poseSeq=0;p.poseTime=0;p.lastPoseAt=this.raceStartedAt;});
      this.sim=this.makeSimulation(this.racers,this.track,this.vehicle);
      this.phase='race';this.round++;this.startAt=null;
    }
    if(this.phase==='race') {
      for(const [index,p] of this.racers.entries()){
        if(this.now()-p.lastInput>1500){p.gas=false;p.brake=false;}
        if(p.localPhysics&&p.disconnectedAt==null&&this.now()-p.lastPoseAt>30000)this.sim.disconnect(index);
      }
      this.sim.step();
      if(this.sim.state().finished){this.phase='result';for(const p of this.clients.values())p.ready=false;}
    }
  }
  snapshot(id, state=this.sim?.state()) {
    const inGarage=this.clients.get(id)?.inGarage;
    return {type:'state',you:id,poseSequence:this.clients.get(id)?.poseSeq||0,phase:inGarage?'lobby':this.phase,round:this.round,serverNow:this.now(),startAt:this.startAt,
      room:{code:this.code,name:this.name,host:this.host},
      track:this.track,vehicle:this.vehicle,
      online:this.clients.size,inRace:this.phase==='race'?state.cars.filter(c=>c.alive&&this.clients.has(this.racers[c.i]?.id)).length:0,
      players:[...this.clients.values()].map(p=>({id:p.id,name:p.name,character:p.character,ability:p.ability,ready:p.ready})),
      racers:this.racers.map(p=>({id:p.id,name:p.name,character:p.character,ability:p.ability,color:p.color})),
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
