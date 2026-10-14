import {randomUUID} from 'node:crypto';
import {createSimulation} from './simulation.js';

const palette = ['#e64d36','#418acb','#e5b83d','#8b5cc7','#2b9b82','#e779a8','#b07945'];
export class Room {
  constructor({now = Date.now, countdownMs = 10000, makeSimulation = createSimulation} = {}) {
    this.now=now; this.countdownMs=countdownMs; this.makeSimulation=makeSimulation;
    this.clients=new Map(); this.phase='lobby'; this.startAt=null;
    this.track=0; this.vehicle=0; this.racers=[]; this.round=0; this.sim=null;
  }
  join(send) {
    const id=randomUUID();
    this.clients.set(id,{id,send,character:0,ability:'turbo',ready:false,gas:false,brake:false,lastInput:0});
    this.considerStart(); this.broadcast(); return id;
  }
  leave(id) {
    const index=this.racers.findIndex(p=>p.id===id);
    if(this.phase==='race' && index>=0) this.sim.disconnect(index);
    this.clients.delete(id);
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
    if(msg.type==='input') {
      p.gas=msg.gas===true;p.brake=msg.brake===true;p.lastInput=this.now();
      if(msg.ability===true && this.phase==='race') {
        const index=this.racers.findIndex(r=>r.id===id);if(index>=0)this.sim.ability(index);
      }
      return;
    }
    if(msg.type==='ready' && ['lobby','countdown','result'].includes(this.phase)) {
      if(this.phase==='result') {this.phase='lobby';this.sim=null;this.racers=[];}
      p.ready=msg.ready===true;
      this.considerStart();
    }
    if(msg.type==='profile' && ['lobby','countdown'].includes(this.phase)) {
      if(Number.isInteger(msg.character)&&msg.character>=0&&msg.character<7)p.character=msg.character;
      if(['turbo','jump','shield'].includes(msg.ability))p.ability=msg.ability;
      p.ready=false;
    }
    if(msg.type==='settings' && this.phase==='lobby') {
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
      this.racers.forEach((p,i)=>{p.color=palette[i%palette.length];p.gas=false;p.brake=false;p.ready=false;});
      this.sim=this.makeSimulation(this.racers,this.track,this.vehicle);
      this.phase='race';this.round++;this.startAt=null;
    }
    if(this.phase==='race') {
      for(const p of this.racers)if(this.now()-p.lastInput>1500){p.gas=false;p.brake=false;}
      this.sim.step();
      if(this.sim.state().finished){this.phase='result';for(const p of this.clients.values())p.ready=false;}
    }
  }
  snapshot(id, state=this.sim?.state()) {
    return {type:'state',you:id,phase:this.phase,round:this.round,serverNow:this.now(),startAt:this.startAt,
      track:this.track,vehicle:this.vehicle,
      online:this.clients.size,inRace:this.phase==='race'?state.cars.filter(c=>c.alive&&this.clients.has(this.racers[c.i]?.id)).length:0,
      players:[...this.clients.values()].map(p=>({id:p.id,character:p.character,ability:p.ability,ready:p.ready})),
      racers:this.racers.map(p=>({id:p.id,character:p.character,ability:p.ability,color:p.color})),
      game:state};
  }
  broadcast() {const state=this.sim?.state();for(const p of this.clients.values())p.send(this.snapshot(p.id,state));}
}
