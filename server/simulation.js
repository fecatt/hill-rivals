import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';

// Run the same physics and terrain code as the offline game, without a renderer.
export function createSimulation(players, trackId, model) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: '0', dataset: {}, style: {}, hidden: false, innerHTML: '',
      addEventListener() {}, focus() {}, getContext: () => ({setTransform() {}})
    });
    return elements.get(selector);
  };
  const context = vm.createContext({
    document: {body:{dataset:{}},querySelector: element, querySelectorAll: () => [], addEventListener() {}},
    Image: class {}, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    addEventListener() {}, requestAnimationFrame() {}, performance,
    matchMedia: () => ({matches:false,addEventListener() {}}),
    crypto: webcrypto, window: {}, console
  });
  for (const file of ['maps.js', 'vehicles.js', 'hills.js', 'race-art.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(new URL('../dist/' + file, import.meta.url), 'utf8'), context);
  }
  context.profiles = players;
  context.trackId = trackId;
  context.modelId = model;
  vm.runInContext(`
    colors.splice(0,colors.length,...profiles.map(p=>p.color));
    chosen.splice(0,chosen.length,...profiles.map(p=>p.character));
    abilities.splice(0,abilities.length,...profiles.map(p=>p.ability));
    $('#track').value=trackId; $('#vehicle').value=modelId;
    playerCount=profiles.length;start(); count=0;
    input=i=>[!!profiles[i]?.gas,!!profiles[i]?.brake];
    endRace=()=>{mode='result';keysClear()};
    const pendingPoses=new Map(),rewards=[];
    const serverPhysics=physics;
    physics=(c,dt)=>{
      if(!profiles[c.i]?.localPhysics){serverPhysics(c,dt);return;}
      const pose=pendingPoses.get(c.i);
      if(pose&&c.alive){Object.assign(c,pose);pendingPoses.delete(c.i);}
    };
    const serverCollect=collectBonuses;
    collectBonuses=()=>{
      serverCollect();
      for(const b of bonus)if(b.claimedBy!==null)rewards.push({id:b.id,i:b.claimedBy,type:b.type});
      if(rewards.length>128)rewards.splice(0,rewards.length-128);
    };
    globalThis.sim={
      step:()=>update(1/120),
      ability:i=>activateAbility(cars[i]),
      disconnect:i=>kill(cars[i],'Отключился'),
      pose:(i,raw,elapsed)=>{
        const c=cars[i];if(!c?.alive||!raw||typeof raw!=='object')return false;
        const pose={},limits={x:[25,1e9],y:[-1e9,1e9],vx:[-200,carSpec(c).maxSpeed*1.24+10],vy:[-950,750],a:[-1e9,1e9],av:[-7.1,7.1],wheel:[-1e9,1e9],fuel:[0,100],cp:[0,1e9],shield:[0,12],boost:[0,5],mud:[0,6],cooldown:[0,14],air:[0,1e9],flip:[-1e9,1e9]};
        for(const [field,[low,high]] of Object.entries(limits)){
          const value=raw[field];if(!Number.isFinite(value)||value<low||value>high)return false;pose[field]=value;
        }
        const previous=pendingPoses.get(i)||c;
        if(Math.abs(pose.x-previous.x)>(carSpec(c).maxSpeed*1.24+200)*Math.min(5,elapsed)+64||Math.abs(pose.y-previous.y)>950*Math.min(5,elapsed)+120)return false;
        if(typeof raw.alive!=='boolean')return false;
        pose.alive=raw.alive;pose.reason=raw.alive?'':['Переворот','Авария','Нет топлива'].includes(raw.reason)?raw.reason:'Авария';pose.rocketOn=raw.rocketOn===true&&carSpec(c).rocket===true;
        profiles[i].localPhysics=true;pendingPoses.set(i,pose);return true;
      },
      state:()=>({cars,bonus,rewards,bridges:Array.from(hillBridgeStates.values()),time,seed:worldSeed,track,vehicle:vehicleModel,
        snowStart,snowEnd,winner:winner?.i??null,finished:mode==='result'})
    };
  `, context);
  return context.sim;
}
