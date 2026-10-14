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
    globalThis.sim={
      step:()=>update(1/120),
      ability:i=>activateAbility(cars[i]),
      disconnect:i=>kill(cars[i],'Отключился'),
      state:()=>({cars,bonus,bridges:Array.from(hillBridgeStates.values()),time,seed:worldSeed,track,vehicle:vehicleModel,
        snowStart,snowEnd,winner:winner?.i??null,finished:mode==='result'})
    };
  `, context);
  return context.sim;
}
