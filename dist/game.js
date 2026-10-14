'use strict';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),$=s=>document.querySelector(s);
const assetNames=['Егерь','Вышня','Голубой','Комунистичкий','Нинглеб','Рэп_зеленный','Синяк'],names=assetNames.map(n=>({'Голубой':'Гейнинзя','Комунистичкий':'Комунинзя'}[n]||n)),images=assetNames.map(n=>{let i=new Image;i.src='assets/'+n+'.png';return i}),colors=['#e64d36','#418acb','#e5b83d'],chosen=[0,1,2],abilities=['turbo','jump','shield'],keys={};
let playerCount=1;
let W=innerWidth,H=innerHeight,mode='lobby',cars=[],cam=0,zoom=1,cameraY=0,time=0,count=3,bonus=[],particles=[],nextDrop=6,track=0,paused=false,winner=null,audio=null,sound=false,engineAudio,snowStart=Infinity,snowEnd=0,nextSnow=8;
const checkpoint=1500,baseScale=()=>Math.min(1.3,Math.max(.7,W/1250)),scale=()=>baseScale()*(mode==='lobby'?1:zoom);
const abilityNames={turbo:'Турбо',jump:'Прыжок',shield:'Щит'},abilityKeys=['E','Правый Shift','СКМ'];
// Bound the backing store on dense phone screens; physics stays in CSS pixels.
const mobileInput=matchMedia('(pointer: coarse)');
let renderRatio=1;
function resize(){
 W=innerWidth;H=innerHeight;
 renderRatio=Math.min(devicePixelRatio||1,mobileInput.matches?1.5:2,Math.sqrt(2400000/(W*H)));
 canvas.width=Math.round(W*renderRatio);canvas.height=Math.round(H*renderRatio);
 ctx.setTransform(renderRatio,0,0,renderRatio,0,0);
}
addEventListener('resize',resize);mobileInput.addEventListener('change',resize);resize();
function syncGameScreen(){
 const screen=mode==='lobby'?'lobby':'race';
 if(document.body.dataset.screen!==screen){document.body.dataset.screen=screen;if(screen==='race')window.scrollTo(0,0);}
 const controls=$('#touch-controls');
 if(controls)controls.hidden=mode!=='race'||paused||(window.onlineIndex!==undefined? !cars[window.onlineIndex]?.alive:false);
}

function terrain(x){return groundHeight(track,x)}
function slope(x){return (terrain(x+1)-terrain(x-1))/2}
function picks(){ $('#picks').innerHTML=chosen.slice(0,playerCount).map((n,i)=>`<section class="pick" style="border-top:5px solid ${colors[i]}"><h3>ИГРОК 0${i+1} <span style="float:right;color:${colors[i]}">●</span></h3><img class="portrait" style="transform:scaleX(${[0,5].includes(n)?-1:1})" src="assets/${assetNames[n]}.png"><div class="choose"><button data-i="${i}" data-d="-1" aria-label="Предыдущий персонаж">‹</button><b>${names[n].replace('_',' ')}</b><button data-i="${i}" data-d="1" aria-label="Следующий персонаж">›</button></div><div class="keys">${['WASD · W/D газ · S/A назад','СТРЕЛКИ · ↑/→ газ · ↓/← назад','МЫШЬ · ПКМ газ · ЛКМ назад'][i]}</div><label class="ability-select">Способность · ${abilityKeys[i]}<select data-ability="${i}">${Object.keys(abilityNames).map(a=>`<option value="${a}" ${abilities[i]===a?'selected':''}>${abilityNames[a]}</option>`).join('')}</select></label></section>`).join('');document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{chosen[b.dataset.i]=(chosen[b.dataset.i]+Number(b.dataset.d)+names.length)%names.length;picks()})}picks();
$('#players').onchange=()=>{playerCount=+$('#players').value;document.body.dataset.players=playerCount;picks()};document.body.dataset.players=playerCount;
document.querySelector('#picks').addEventListener('change',e=>{if(e.target.dataset.ability!==undefined)abilities[+e.target.dataset.ability]=e.target.value});
function updateMapDescription(){$('#map-description').textContent=MAPS[+$('#track').value].description+' Бесконечная трасса. При каждом старте — новый вариант рельефа.'}$('#track').onchange=updateMapDescription;updateMapDescription();
function newCar(i){const v=VEHICLES[vehicleModel],spawnX=Math.max(100,Math.max(...v.wheels.map(Math.abs))+Math.max(...wheelSpecs(v).map(w=>w.r))+25)+i*Math.max(110,v.wheels[v.wheels.length-1]-v.wheels[0]+2*Math.max(...wheelSpecs(v).map(w=>w.r))+18);return {i,model:vehicleModel,rocketOn:false,startX:spawnX,x:spawnX,y:terrain(spawnX)-v.mount-Math.max(...wheelSpecs(v).map(w=>w.r))-3,vx:0,vy:0,a:0,av:0,fuel:100,cp:0,alive:true,reason:'',wheel:0,contacts:[],shield:0,boost:0,mud:0,coins:0,air:0,flip:0,notice:'',noticeTime:0,ability:abilities[i],cooldown:0,prevX:spawnX,prevY:-43}}
$('#vehicle').onchange=describeVehicle;describeVehicle();
function start(){vehicleModel=+$('#vehicle').value;newWorldSeed();track=+$('#track').value;snowStart=Infinity;snowEnd=0;nextSnow=6+Math.random()*6;resetHillBridges();cars=colors.slice(0,playerCount).map((_,i)=>newCar(i));cam=0;zoom=1;cameraY=0;time=0;count=3;nextDrop=5;bonus=[];particles=[];mode='race';paused=false;winner=null;$('#lobby').hidden=true;$('#foot').hidden=true;$('#hud').hidden=false;$('#overlay').hidden=true;keysClear();canvas.focus()}
$('#start').onclick=start;function keysClear(){Object.keys(keys).forEach(k=>keys[k]=false)}function garage(){mode='lobby';paused=false;$('#lobby').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;$('#foot').hidden=false;keysClear()}$('#menu').onclick=garage;
function togglePause(){if(mode!=='race')return;paused=!paused;keysClear();$('#overlay').hidden=!paused;if(paused){$('#overlay').innerHTML='<h2>Пауза</h2><p>Переведи дыхание. Холмы подождут.</p><button id="resume">Продолжить</button>';$('#resume').onclick=togglePause}}$('#pause').onclick=togglePause;
addEventListener('keydown',e=>{if(e.target?.matches?.('input,textarea,select,[contenteditable]'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys[e.code]=true;if(!e.repeat){const i=['KeyE','ShiftRight','unused'].indexOf(e.code);if(i>=0)activateAbility(cars[i])}if(e.code==='Escape'&&!e.repeat)togglePause()});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{keysClear();if(mode==='race'&&!paused)togglePause()});document.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('mousedown',e=>{keys['Mouse'+e.button]=true;if(e.button===1)activateAbility(cars[2]);e.preventDefault()});addEventListener('mouseup',e=>keys['Mouse'+e.button]=false);
// Engine audio: combustion pulses, exhaust resonance and filtered intake air.
// Kept in game.js so the existing offline cache includes the complete sound.
class RacingEngineAudio {
 constructor(context){
  this.context=context;this.rpm=850;this.throttle=0;this.gear=0;this.shiftUntil=0;
  this.master=context.createGain();this.master.gain.value=0;
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-18;compressor.knee.value=12;compressor.ratio.value=3;
  this.master.connect(compressor);compressor.connect(context.destination);this.initEffects(compressor);
  this.exhaust=context.createBiquadFilter();this.exhaust.type='lowpass';this.exhaust.frequency.value=650;this.exhaust.Q.value=.55;
  const body=context.createBiquadFilter();body.type='peaking';body.frequency.value=125;body.Q.value=.7;body.gain.value=3;
  const rumbleCut=context.createBiquadFilter();rumbleCut.type='highpass';rumbleCut.frequency.value=32;rumbleCut.Q.value=.5;
  this.exhaust.connect(body);body.connect(rumbleCut);rumbleCut.connect(this.master);
  this.motor=context.createBufferSource();this.motor.buffer=this.combustionBuffer();this.motor.loop=true;this.motor.playbackRate.value=850/1600;
  this.motor.connect(this.exhaust);this.motor.start();
  this.intake=context.createBufferSource();
  const air=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=air.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  this.intake.buffer=air;this.intake.loop=true;
  const airFilter=context.createBiquadFilter();airFilter.type='bandpass';airFilter.frequency.value=850;airFilter.Q.value=.5;
  this.airGain=context.createGain();this.airGain.gain.value=.015;
  this.intake.connect(airFilter);airFilter.connect(this.airGain);this.airGain.connect(this.master);this.intake.start();
 }
 combustionBuffer(){
  const sr=this.context.sampleRate,period=60/(1600*2),fires=96,length=Math.round(period*fires*sr);
  const buffer=this.context.createBuffer(1,length,sr),data=buffer.getChannelData(0);
  let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let fire=0;fire<fires;fire++){
   const start=Math.round((fire+((random()-.5)*.025))*length/fires);
   const strength=[1,.89,.96,.85][fire%4]*(.95+random()*.1);
   for(let j=0;j<sr*.085;j++){
    const t=j/sr,envelope=(1-Math.exp(-t*1800))*Math.exp(-t*80);
    const thump=Math.sin(2*Math.PI*95*t)*.7+Math.sin(2*Math.PI*185*t)*.22;
    const burn=(random()*2-1)*Math.exp(-t*230)*.28;
    const index=(start+j+length)%length;
    data[index]+=strength*(thump*envelope+burn);
   }
  }
  let peak=0;for(const x of data)peak=Math.max(peak,Math.abs(x));
  for(let i=0;i<data.length;i++)data[i]=data[i]/peak*.8;
  return buffer;
 }
 update(dt,state,now=this.context.currentTime){
  const c=state.car,active=state.active&&c?.alive&&c.fuel>0;
  const spec=state.spec||{},heavy=['pickup','monster','hotrod'].includes(spec.kind);
  const throttle=active&&state.gas&&!state.brake?1:0;
  this.throttle+=(throttle-this.throttle)*(1-Math.exp(-dt*9));
  const speed=Math.abs(c?.vx||0),ratio=Math.min(1,speed/(spec.maxSpeed||680));
  const gear=Math.min(4,Math.floor(ratio*5));
  if(gear>this.gear&&throttle)this.shiftUntil=now+.16;
  this.gear=gear;
  const idle=heavy?700:850,range=heavy?2600:3400;
  const roadRPM=idle+700+(ratio*5-gear)*range*.65;
  let target=idle+this.throttle*(750+ratio*1100);
  if(speed>45)target=Math.max(target,roadRPM*(throttle?1:.78));
  if((c?.air||0)>.15&&throttle)target+=800;
  if((c?.boost||0)>0&&throttle)target+=350;
  if(now<this.shiftUntil)target*=.72;
  target=Math.max(idle,Math.min(heavy?3900:4800,target));
  this.rpm+=(target-this.rpm)*(1-Math.exp(-dt*(target>this.rpm?5:3)));
  this.motor.playbackRate.setTargetAtTime(this.rpm/1600,now,.055);
  this.exhaust.frequency.setTargetAtTime((heavy?480:580)+this.throttle*650+ratio*220,now,.09);
  this.airGain.gain.setTargetAtTime(.002+this.throttle*.008+(c?.rocketOn?.025:0),now,.08);
  this.master.gain.setTargetAtTime(active?.19+this.throttle*.09:0,now,active?.08:.045);
 }
  initEffects(output){
  const ctx=this.context;
  this.effects=ctx.createGain();this.effects.gain.value=1;this.effects.connect(output);
  this.voices=new Set();this.lastEffects=new Map();this.effectBuffers=new Map();
  for(const kind of ['land','crash','bonus','fuel','turbo','jump','shield','shield-hit','mud','tick','go','finish'])this.effectBuffers.set(kind,this.effectBuffer(kind));
  // Low, broad air turbulence rather than a narrow intake hiss.
  const noise=ctx.createBuffer(2,ctx.sampleRate*4,ctx.sampleRate);
  for(let channel=0;channel<2;channel++){
   const data=noise.getChannelData(channel);let pink=0;
   for(let i=0;i<data.length;i++){pink=.97*pink+.03*(Math.random()*2-1);data[i]=pink*4;}
  }
  this.wind=ctx.createBufferSource();this.wind.buffer=noise;this.wind.loop=true;
  const windLow=ctx.createBiquadFilter();windLow.type='lowpass';windLow.frequency.value=1200;windLow.Q.value=.5;
  const windHigh=ctx.createBiquadFilter();windHigh.type='highpass';windHigh.frequency.value=150;windHigh.Q.value=.5;
  this.windGain=ctx.createGain();this.windGain.gain.value=0;
  this.wind.connect(windLow);windLow.connect(windHigh);windHigh.connect(this.windGain);this.windGain.connect(output);this.wind.start();
  this.turboAir=ctx.createBufferSource();this.turboAir.buffer=noise;this.turboAir.loop=true;
  const turboFilter=ctx.createBiquadFilter();turboFilter.type='bandpass';turboFilter.frequency.value=460;turboFilter.Q.value=.6;
  this.turboGain=ctx.createGain();this.turboGain.gain.value=0;
  this.turboAir.connect(turboFilter);turboFilter.connect(this.turboGain);this.turboGain.connect(output);this.turboAir.start();
  this.previousMode='lobby';this.previousCount=0;
 }
 effectBuffer(kind){
  const duration={land:.24,crash:.65,bonus:.32,fuel:.55,turbo:.7,jump:.3,shield:.8,'shield-hit':.45,mud:.32,tick:.13,go:.4,finish:.9}[kind];
  const sr=this.context.sampleRate,buffer=this.context.createBuffer(1,Math.ceil(sr*duration),sr),data=buffer.getChannelData(0);
  let lowNoise=0,phase=0;
  for(let i=0;i<data.length;i++){
   const t=i/sr,p=t/duration,noise=Math.random()*2-1;
   lowNoise=.88*lowNoise+.12*noise;
   const attack=Math.min(1,t/.008),tail=Math.pow(1-p,2);let value=0;
   if(kind==='land'||kind==='crash'){
    const hard=kind==='crash';phase+=2*Math.PI*(hard?95-55*p:105-65*p)/sr;
    value=Math.sin(phase)*Math.exp(-t*(hard?8:20))*.6+lowNoise*Math.exp(-t*(hard?5:18))*(hard?1.2:.65);
    if(hard)value+=Math.sin(t*2*Math.PI*370)*Math.exp(-t*14)*.12;
   }else if(kind==='shield'||kind==='shield-hit'){
    const hit=kind==='shield-hit',frequency=hit?500-330*p:85+360*(1-Math.exp(-t*13));
    phase+=2*Math.PI*frequency/sr;
    value=(Math.sin(phase)*.4+Math.sin(phase*1.012)*.22+Math.sin(phase*2)*.12)*tail;
    value+=lowNoise*Math.exp(-t*12)*.5;
   }else if(kind==='turbo'||kind==='jump'){
    phase+=2*Math.PI*(kind==='jump'?200+650*p:130+430*p)/sr;
    value=lowNoise*Math.sin(Math.PI*p)*(kind==='turbo'?1.3:.8)+Math.sin(phase)*tail*.15;
   }else if(kind==='mud'){
    value=lowNoise*Math.sin(Math.PI*p)*1.2+Math.sin(2*Math.PI*70*t)*tail*.12;
   }else{
    const notes=kind==='finish'?[523.25,659.25,783.99,1046.5]:kind==='fuel'?[392,523.25,659.25]:kind==='bonus'?[880,1174.66]:kind==='go'?[880]:[520];
    const slot=Math.min(notes.length-1,Math.floor(p*notes.length)),local=t-slot*duration/notes.length;
    const env=Math.min(1,local/.006)*Math.exp(-local*(kind==='tick'?32:12));
    value=(Math.sin(2*Math.PI*notes[slot]*local)+Math.sin(2*Math.PI*notes[slot]*2*local)*.15)*env*.28*tail;
   }
   data[i]=value*attack*Math.min(1,(duration-t)/.025);
  }
  return buffer;
 }
 play(kind,strength=1,pan=0,key=kind,now=this.context.currentTime){
  const buffer=this.effectBuffers.get(kind);if(!buffer||this.voices.size>=20)return false;
  const interval=kind==='land'?.18:.075;
  if(now-(this.lastEffects.get(key)??-Infinity)<interval)return false;
  this.lastEffects.set(key,now);
  const source=this.context.createBufferSource(),gain=this.context.createGain(),panner=this.context.createStereoPanner();
  source.buffer=buffer;source.playbackRate.value=['tick','go','finish','bonus','fuel'].includes(kind)?1:.97+Math.random()*.06;
  gain.gain.value=Math.min(1,Math.max(.08,strength))*(kind==='land'?.32:kind==='crash'?.36:.26);
  panner.pan.value=Math.max(-.8,Math.min(.8,pan));
  source.connect(gain);gain.connect(panner);panner.connect(this.effects);
  this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();panner.disconnect();};
  source.start(now);return true;
 }
 updateEnvironment(state,now=this.context.currentTime){
  const enabled=!!state.enabled,c=state.car,moving=enabled&&state.active&&c?.alive;
  // Wind depends on road speed, including coasting with the gas released.
  const speed=speedKph(c?.vx||0),amount=Math.max(0,Math.min(1,(speed-50)/60));
  const gust=.88+.12*Math.sin(now*2.1)+.05*Math.sin(now*5.3);
  if(enabled!==this.environmentEnabled){
   if(!enabled)this.silence();
   else {this.effects.gain.cancelScheduledValues(now);this.effects.gain.setTargetAtTime(1,now,.02);}
  }
  this.environmentEnabled=enabled;
  this.windGain.gain.setTargetAtTime(moving?amount*amount*.7*gust:0,now,moving?.25:.025);
  this.turboGain.gain.setTargetAtTime(moving&&c.boost>0?.13:0,now,moving?.15:.025);
  const mode=state.mode,count=Math.max(0,Math.ceil(state.count||0));
  if(enabled){
   if(mode==='race'&&count>0&&count!==this.previousCount)this.play('tick',.65,0,'tick',now);
   if(mode==='race'&&count===0&&(this.previousCount>0||this.previousMode!=='race'))this.play('go',.8,0,'go',now);
   if(mode==='result'&&this.previousMode==='race')this.play('finish',.7,0,'finish',now);
  }
  this.previousMode=mode;this.previousCount=count;
 }

 silence(){const now=this.context.currentTime;for(const bus of [this.master,this.effects,this.windGain,this.turboGain]){bus.gain.cancelScheduledValues(now);bus.gain.setTargetAtTime(0,now,.025);}for(const source of this.voices)source.stop();}

}

$('#sound').onclick=()=>{
 sound=!sound;$('#sound').textContent='Звук: '+(sound?'вкл':'выкл');
 if(sound){if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();engineAudio=new RacingEngineAudio(audio);}audio.resume().catch(()=>{});}
 else engineAudio?.silence();
};
function input(i){return i===0?[keys.KeyW||keys.KeyD||keys.TouchGas,keys.KeyS||keys.KeyA||keys.TouchBrake]:i===1?[keys.ArrowUp||keys.ArrowRight,keys.ArrowDown||keys.ArrowLeft]:[keys.Mouse2,keys.Mouse0]}
function activateAbility(c){if(mode!=='race'||paused||count>0||!c?.alive||c.cooldown>0)return;if(c.ability==='turbo'){c.boost=Math.max(c.boost,2.8);c.cooldown=11;announce(c,'ТУРБО АКТИВИРОВАНО')}if(c.ability==='jump'){c.vy=Math.min(c.vy,-250);c.cooldown=8;announce(c,'ПРЫЖОК')}if(c.ability==='shield'){c.shield=Math.max(c.shield,4);c.cooldown=14;announce(c,'ЩИТ АКТИВИРОВАН')}}
function raceSound(c,kind,strength=1){
 if(!sound||!engineAudio||paused||document.hidden||mode!=='race'||count>0)return;
 if(c&&window.onlineIndex!==undefined&&c.i!==window.onlineIndex)return;
 const pan=c&&window.onlineIndex===undefined?Math.max(-.7,Math.min(.7,((c.x-cam)*scale()/W-.5)*1.4)):0;
 engineAudio.play(kind,strength,pan,kind+':'+(c?.i??'all'));
}
function announce(c,t){
 c.notice=t;c.noticeTime=2.5;
 if(t.includes('ЩИТ СПАС'))raceSound(c,'shield-hit');
 else if(t.includes('ЩИТ'))raceSound(c,'shield');
 else if(t.includes('ТУРБО'))raceSound(c,'turbo');
 else if(t==='ПРЫЖОК')raceSound(c,'jump');
 else if(t.includes('ГРЯЗИ'))raceSound(c,'mud');
 else if(t.includes('БАК ПОЛНЫЙ'))raceSound(c,'fuel');
 else if(t.includes('ТОПЛИВА'))raceSound(c,'bonus');
}
function kill(c,r){if(!c.alive)return;if(c.shield>0&&r==='Переворот'){c.shield=0;c.a=0;c.av=0;c.y=terrain(c.x)-65;c.vy=-80;announce(c,'ЩИТ СПАС МАШИНУ');return}raceSound(c,r==='Нет топлива'?'mud':'crash');c.alive=false;c.reason=r;for(let n=0;n<16;n++)particles.push({x:c.x,y:c.y,vx:(Math.random()-.5)*150,vy:-Math.random()*140,life:1,color:colors[c.i]})}
function physics(c,dt,predict=false){if(!c.alive)return;const v=carSpec(c),mass=v.mass/900,I=inertia(v);let [gas,brake]=input(c.i);gas=!!gas&&c.fuel>0;c.shield=Math.max(0,c.shield-dt);c.boost=Math.max(0,c.boost-dt);c.mud=Math.max(0,(c.mud||0)-dt);c.cooldown=Math.max(0,c.cooldown-dt);c.noticeTime-=dt;c.fuel=Math.max(0,c.fuel-dt*(gas?(v.rocket?9:6.2):brake&&c.vx< -3?3.8:.2));c.vy+=MAPS[track].gravity*dt;c.contacts=[];let grounded=0,impactSpeed=0;
// Each wheel applies a spring/damper force at its attachment point.
for(const wheel of wheelSpecs(v)){const rx=wheel.x,ry=v.mount,cos=Math.cos(c.a),sin=Math.sin(c.a),px=rx*cos-ry*sin,py=rx*sin+ry*cos,wx=c.x+px,wy=c.y+py,sl=slope(wx),len=Math.hypot(sl,1),nx=sl/len,ny=-1/len,penetration=(wy+wheel.r-terrain(wx))/len;let compression=0;if(penetration>0){grounded++;const pvx=c.vx-c.av*py,pvy=c.vy+c.av*px,vn=pvx*nx+(pvy-hillBridgeVelocity(track,wx))*ny;impactSpeed=Math.max(impactSpeed,-vn);let force=Math.max(0,Math.min(2300*mass,penetration*v.spring-vn*v.damper));c.vx+=nx*force/mass*dt;c.vy+=ny*force/mass*dt;c.av+=(px*ny-py*nx)*force/I*dt;let tx=1/len,ty=sl/len,vt=pvx*tx+pvy*ty;let drive=gas?(v.engine/v.wheels.length*(c.boost>0?1.52:1)):0;if(brake){drive=gas?0:(c.fuel>0&&vt<12?-300:-Math.max(-500,Math.min(500,vt*22)));}else drive-=vt*v.drag;drive=Math.max(-force*v.grip*(c.mud>0?.22:1),Math.min(force*v.grip*(c.mud>0?.22:1),drive));c.vx+=tx*drive/mass*dt;c.vy+=ty*drive/mass*dt;c.av+=(px*ty-py*tx)*drive/I*dt;compression=Math.min(11,penetration*.45)}c.contacts.push({rx,compression})}
if(!predict&&grounded&&impactSpeed>65)raceSound(c,'land',Math.min(1,(impactSpeed-35)/240)*Math.min(1.2,Math.sqrt(mass)));
c.rocketOn=!!(v.rocket&&gas&&!brake);if(c.rocketOn){const thrust=(c.boost>0?1.65:1);c.vx+=(Math.cos(c.a)*540+Math.sin(c.a)*690)*thrust/mass*dt;c.vy+=(Math.sin(c.a)*540-Math.cos(c.a)*690)*thrust/mass*dt}c.av+=v.rotation*(gas?(v.rocket?-.35:grounded?-2.8:-5.8):0)*dt+v.rotation*(brake?(v.rocket?1.5:grounded?2.5:5.2):0)*dt;if(track===2&&!grounded)c.av*=Math.exp(-dt*.7);c.av*=Math.exp(-dt*(grounded?.85:.18));c.vx*=Math.exp(-dt*.055);c.vx=Math.max(-190,Math.min(v.maxSpeed*(c.boost>0?1.24:1),c.vx));c.vy=Math.max(v.rocket?-900:-550,Math.min(700,c.vy));c.av=Math.max(-7,Math.min(7,c.av));c.x+=c.vx*dt;c.y+=c.vy*dt;c.a+=c.av*dt;c.wheel+=c.vx*dt/17+(c.mud>0&&gas?18*dt:0);c.x=Math.max(25,c.x);c.air=grounded?0:c.air+dt;
// Head impact causes a crash, rather than an arbitrary angle threshold.
let hx=c.x+Math.sin(c.a)*41,hy=c.y-Math.cos(c.a)*41;if(!predict&&hy+8>terrain(hx)&&Math.cos(c.a)<.5)kill(c,'Переворот');if(!predict&&c.y>terrain(c.x)+85)kill(c,'Авария');if(!predict&&c.fuel<=0&&Math.abs(c.vx)<5&&grounded)kill(c,'Нет топлива');let cp=Math.floor(c.x/checkpoint);if(cp>c.cp){c.cp=cp;if(!v.rocket||terrain(c.x)-c.y<120){c.fuel=100;announce(c,'ЗАПРАВКА · БАК ПОЛНЫЙ')}else announce(c,'ЗАПРАВКА ПРОЛЕТЕЛА ВНИЗУ')}
}
function endRace(){mode='result';keysClear();let ranked=[...cars].sort((a,b)=>b.x-a.x);$('#overlay').hidden=false;$('#overlay').innerHTML=`<div class="eyebrow">ГОНКА ОКОНЧЕНА</div><h2>${cars.length===1?'Заезд завершён':winner?'Игрок '+(winner.i+1)+' победил!':'Все выбыли'}</h2><p>${ranked.map(c=>`<span style="color:${colors[c.i]}">●</span> ${escapeLabel(racerName(c))} — ${Math.floor(raceMetres(c))} м ${c.reason?'· '+c.reason:''}`).join('<br>')}</p><button id="again">Ещё гонка</button><button id="back">В гараж</button>`;$('#again').onclick=start;$('#back').onclick=garage}
// Swept contacts give each crate to the first car reaching it during this physics step.
function contactTime(c,b){const ax=c.prevX-b.prevX,ay=c.prevY-b.prevY,dx=(c.x-c.prevX)-(b.x-b.prevX),dy=(c.y-c.prevY)-(b.y-b.prevY),radius=52;const C=ax*ax+ay*ay-radius*radius;if(C<=0)return 0;const A=dx*dx+dy*dy;if(A<1e-10)return null;const B=2*(ax*dx+ay*dy),disc=B*B-4*A*C;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:null}
function collectBonuses(){for(const b of bonus){if(b.claimedBy!==null)continue;let first=null,firstTime=Infinity;for(const c of cars){if(!c.alive)continue;const t=contactTime(c,b);if(t!==null&&t<firstTime){first=c;firstTime=t}}if(first){b.claimedBy=first.i;if(b.type===0){first.fuel=Math.min(100,first.fuel+40);announce(first,'+40 ТОПЛИВА')}if(b.type===1){first.boost=5;announce(first,'ТУРБО · 5 СЕК')}if(b.type===2){first.shield=12;announce(first,'ЩИТ · 12 СЕК')}if(b.type===3){first.mud=6;announce(first,'КОЛЁСА В ГРЯЗИ · 6 СЕК')}}}}
function updateCamera(active,dt){const lead=Math.max(...active.map(c=>c.x)),tail=Math.min(...active.map(c=>c.x)),span=lead-tail;const verticalSpan=Math.max(...active.map(c=>c.y))-Math.min(...active.map(c=>c.y));const targetZoom=Math.max(.42,Math.min(1,W/(baseScale()*(span+480)),H*.65/(baseScale()*(verticalSpan+210))));zoom+=(targetZoom-zoom)*(1-Math.exp(-dt*5));const view=W/scale();const targetCam=Math.max(0,span<view-200?(lead+tail)*.5-view*.5:lead-view+180);cam+=(targetCam-cam)*(1-Math.exp(-dt*6));const top=Math.min(...active.map(c=>c.y)),bottom=Math.max(...active.map(c=>c.y)),verticalSpeed=active.reduce((sum,c)=>sum+c.vy,0)/active.length;const targetY=(top+bottom)*.5+H*.10/scale()+verticalSpeed*.12;cameraY+=(targetY-cameraY)*(1-Math.exp(-dt*4));return {lead,view}}
function update(dt){if(mode!=='race'||paused)return;if(count>0){count-=dt;return}time+=dt;if(time>nextSnow){snowStart=time;snowEnd=time+8+Math.random()*8;nextSnow=snowEnd+9+Math.random()*15}updateHillBridges(dt);for(const c of cars){c.prevX=c.x;c.prevY=c.y;physics(c,dt)}if(mode!=='race')return;let active=cars.filter(c=>c.alive);if(!active.length){endRace();return}const {lead}=updateCamera(active,dt);for(const c of active)if(c.x+55*carSpec(c).bodyScale<cam)kill(c,'Отстал за экран');active=cars.filter(c=>c.alive);if(active.length===1&&cars.some(c=>!c.alive)){winner=active[0];endRace();return}if(time>nextDrop){nextDrop=time+4+Math.random()*4;const x=lead+240+Math.random()*340;bonus.push(newCrate(x,Math.floor(Math.random()*4)))}for(const b of bonus)updateCrate(b,dt);collectBonuses();bonus=bonus.filter(b=>b.age<24&&b.claimedBy===null);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.life-=dt}particles=particles.filter(p=>p.life>0)}
function path(points,fill,stroke,width=2){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
function tree(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#786347';ctx.fillRect(-4,-40,8,40);circle(0,-52,23,'#56954b');circle(-16,-40,20,'#4b8840');circle(16,-42,19,'#69a751');ctx.restore()}
function background(){mapBackground(mode==='lobby'?+$('#track').value:track,mode==='lobby'?0:cam+W/scale()*.5)}
function carDraw(c){drawVehicle(c)}
function world(){const s=scale(),base=H*.69-cameraY*s;ctx.save();ctx.translate(-cam*s,base);ctx.scale(s,s);let left=cam-100,right=cam+W/s+100;if(track===0)mapScenery(track,left,right);drawGround(track,left,right,Math.max(500,(H-base)/s+250));if(track!==0)mapScenery(track,left,right);for(let x=Math.max(checkpoint,Math.floor(left/checkpoint)*checkpoint);x<right;x+=checkpoint){let y=terrain(x);ctx.fillStyle='#f8edcb';ctx.fillRect(x-4,y-103,5,103);path([[x,y-100],[x+45,y-88],[x,y-76]],'#e64d36');ctx.fillStyle='#fff7df';ctx.font='bold 13px Arial';ctx.fillText(Math.round(Math.max(0,worldMetres(x-(cars[window.onlineIndex??0]?.startX??0))))+' м · ЗАПРАВКА',x-35,y-116);ctx.fillStyle='#e64d36';ctx.fillRect(x+12,y-35,21,26);ctx.strokeStyle='#3e4b30';ctx.lineWidth=3;ctx.strokeRect(x+12,y-35,21,26);ctx.strokeRect(x+17,y-41,10,7);ctx.fillStyle='#f5dfc1';ctx.fillRect(x+17,y-26,11,4)}
for(const b of bonus)if(b.claimedBy===null)drawCrate(b);
cars.slice().sort((a,b)=>a.x-b.x).forEach(c=>carDraw(c));for(let p of particles)circle(p.x,p.y,4,p.color);ctx.restore()}
function escapeLabel(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function racerName(c){return window.onlineIndex!==undefined?(window.racerNames?.[c.i]||'Игрок '+(c.i+1)):names[chosen[c.i]].replace('_',' ')}
let hudRoster='',hudNext=0;
function renderHud(){
 const now=performance.now();if(now<hudNext)return;hudNext=now+100;
 let shown=cars;
 if(window.onlineIndex!==undefined){
  const own=cars[window.onlineIndex],leader=cars.filter(c=>c.alive).reduce((a,b)=>!a||b.x>a.x?b:a,null);
  shown=mobileInput.matches&&own?[own]:cars.filter(c=>c===own||c===leader);
 }
 const roster=shown.map(c=>c.i+':'+chosen[c.i]+':'+colors[c.i]+':'+racerName(c)).join('|');
 if(roster!==hudRoster){
  hudRoster=roster;
  $('#hud').innerHTML=shown.map(c=>`<div class="stat" style="--color:${colors[c.i]}"><strong>${escapeLabel(racerName(c))}</strong><small></small><div class="fuel"><i></i></div><p class="telemetry"></p><p class="ability-status"></p></div>`).join('');
 }
 shown.forEach((c,j)=>{
  const stat=$('#hud').children[j];if(!stat)return;
  stat.style.opacity=c.alive?1:.6;
  stat.querySelector('small').textContent=Math.floor(raceMetres(c))+' м';
  const fuel=stat.querySelector('.fuel i');fuel.style.width=c.fuel+'%';fuel.style.background=c.fuel<20?'#e64d36':'#65a53b';
  stat.querySelector('.telemetry').textContent=c.alive?`${Math.round(c.fuel)}% · ${Math.round(speedKph(c.vx))} км/ч${window.onlineIndex!==undefined?' · '+(c.i===window.onlineIndex?'Вы':'Соперник'):''}`:c.reason;
  const status=`${c.mud>0?'Грязь '+Math.ceil(c.mud)+' с · ':''}${abilityNames[c.ability]} · ${c.cooldown>0?Math.ceil(c.cooldown)+' с':'готово'}`;
  stat.querySelector('.ability-status').textContent=status;
  if(c.i===(window.onlineIndex??0)){
   const button=$('[data-control="ability"]');
   if(button){button.textContent=abilityNames[c.ability]+(c.cooldown>0?' · '+Math.ceil(c.cooldown)+' с':'');button.disabled=!c.alive||c.cooldown>0||count>0;}
  }
 });
}
function draw(){background();if(mode==='lobby'){drawGarageRoad();return}world();drawWeather();renderHud();if(!mobileInput.matches){ctx.fillStyle='#20382f';ctx.font='bold 12px Arial';ctx.fillText(MAPS[track].name+' · '+(track===2?'ГРАВИТАЦИЯ ×⅙ · ':'')+'∞',26,H-32);ctx.textAlign='right';ctx.fillText('ГАЗ ↑ НОС  /  ТОРМОЗ ↓ НОС     •     '+time.toFixed(1)+' с',W-26,H-32);ctx.textAlign='left';ctx.fillStyle='#20382f30';ctx.fillRect(26,H-20,W-52,5);cars.forEach(c=>{ctx.fillStyle=colors[c.i];ctx.fillRect(26+Math.min(1,Math.max(0,(c.x-cam)/(W/scale())))*(W-52),H-24,7,13)});}if(count>0){ctx.fillStyle='#fff8e7';ctx.strokeStyle='#35543d';ctx.lineWidth=6;ctx.font='bold 100px Arial';ctx.textAlign='center';ctx.strokeText(Math.ceil(count),W/2,H*.4);ctx.fillText(Math.ceil(count),W/2,H*.4);ctx.font='bold 16px Arial';ctx.fillStyle='#20382f';ctx.fillText('ПРИГОТОВЬТЕСЬ',W/2,H*.4+40);ctx.textAlign='left'}}
let last=performance.now(),lastDraw=0,acc=0;
function frame(now){
 requestAnimationFrame(frame);
 if(document.hidden){last=now;acc=0;return;}
 // Avoid rendering a static lobby at 120 Hz on high-refresh phones.
 const interval=mode==='lobby'||paused?1000/15:1000/60;
 if(now-lastDraw<interval-.5)return;lastDraw=now;
 const dt=Math.min(.05,(now-last)/1000);last=now;
 acc+=dt;while(acc>=1/120){update(1/120);acc-=1/120}
 if(mode==='lobby')time+=dt;syncGameScreen();animateSuspension(dt);draw();
 if(engineAudio){
  const ownIndex=window.onlineIndex??0,c=cars[ownIndex],controls=c?input(c.i):[false,false];
  engineAudio.updateEnvironment({enabled:sound&&!paused&&!document.hidden,active:mode==='race'&&!paused&&count<=0,car:c,mode,count});
  engineAudio.update(dt,{active:sound&&mode==='race'&&!paused&&count<=0,car:c,spec:c?carSpec(c):null,gas:controls[0],brake:controls[1]});
 }
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{keysClear();last=performance.now();acc=0;if(document.hidden)engineAudio?.silence();});
window.gameDebug={getState:()=>({mode,playerCount,count,cam,zoom,time,renderRatio,cars:cars.map(c=>({...c})),bonus:bonus.length,seed:worldSeed,vehicle:VEHICLES[vehicleModel].name,track,biome:mapBiome(track,cam+W/scale()*.5),snowing:snowing()}),activateAbility,start,step:n=>{for(let j=0;j<n;j++)update(1/120)},setInput:(i,g,b)=>{const k=[['KeyD','KeyA'],['ArrowRight','ArrowLeft'],['Mouse2','Mouse0']][i];keys[k[0]]=g;keys[k[1]]=b}};










