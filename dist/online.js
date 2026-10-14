'use strict';
document.body.classList.add('online');
$('#players').closest('label').hidden=true;
let socket,roomState=null,onlineRound=-1,clockOffset=0,oldPhase='',reconnectTimer;
let snapshots=[],snapshotReceived=0,renderedCountdown=-1;
let predictedCar=null,predictionControls=[false,false],inputHistory=[];
let poseError={x:0,y:0,a:0,wheel:0},serverToLocal=null,bestRtt=Infinity;
let interpolationDelay=70,lastPacketAt=0,renderTarget=-Infinity;
function renderWorld(left,right,mix,ahead){
 const a=left.game,b=right.game;
 // IDs survive collection/removal: array indices do not identify the same crate.
 const previous=new Map(a.bonus.map(crate=>[crate.id,crate]));
 const live=new Set(roomState.game.bonus.map(crate=>crate.id));
 bonus=b.bonus.filter(crate=>live.has(crate.id)&&crate.claimedBy===null).map(crate=>{
  const old=previous.get(crate.id)||crate,draw={...crate};
  for(const field of ['x','y','a','age','chuteFade'])draw[field]=old[field]+(crate[field]-old[field])*mix;
  // Coast only airborne crates, for at most 150 ms; collisions remain server-owned.
  if(!crate.grounded){draw.x+=crate.vx*ahead;draw.y+=crate.vy*ahead;draw.a+=crate.av*ahead;}
  draw.age+=ahead;draw.chuteFade=Math.max(0,draw.chuteFade-ahead);
  return draw;
 });
 const previousBridges=new Map((a.bridges||[]).map(bridge=>[bridge.a,bridge]));
 hillBridgeStates.clear();
 for(const bridge of b.bridges||[]){
  const old=previousBridges.get(bridge.a)||bridge;
  hillBridgeStates.set(bridge.a,{...bridge,q:bridge.q.map((q,j)=>old.q[j]+(q-old.q[j])*mix+bridge.v[j]*ahead),v:[...bridge.v]});
 }
 // Packet installation must never rewind the render clock.
 time=Math.max(time,a.time+(b.time-a.time)*mix+ahead);
}
const predictAbility=activateAbility;
// Use the shared wheel/suspension physics for local response. Race outcomes stay on the server.
input=i=>i===window.onlineIndex?predictionControls:[false,false];
function predictStep(c,dt,control){predictionControls=control;physics(c,dt,true);}
function rebuildPrediction(state,received){
 const index=window.onlineIndex,authoritative=state.game.cars[index];
 if(!authoritative){predictedCar=null;return;}
 const previous=cars[index];
 predictedCar={...authoritative,contacts:authoritative.contacts.map(c=>({...c}))};
 const base=serverToLocal===null?received:Math.min(received,Math.max(received-250,state.serverNow+serverToLocal));
 let cursor=base,control=[false,false];
 for(const command of inputHistory){
  if(command.at<=base){control=[command.gas,command.brake];continue;}
  advance(command.at);
  control=[command.gas,command.brake];
  if(command.ability)predictAbility(predictedCar);
 }
 advance(received);
 function advance(until){for(;cursor<until;){const dt=Math.min(1/120,(until-cursor)/1000);predictStep(predictedCar,dt,control);cursor+=dt*1000;}}
 // Preserve the current displayed pose while small server corrections fade out.
 for(const field of Object.keys(poseError))poseError[field]=previous?previous[field]-predictedCar[field]:0;
 if(Math.hypot(poseError.x,poseError.y)>180||!authoritative.alive)for(const field of Object.keys(poseError))poseError[field]=0;
}

const onlineBar=document.createElement('div');onlineBar.id='online-bar';onlineBar.setAttribute('aria-live','polite');document.body.append(onlineBar);
const roomPanel=document.createElement('section');roomPanel.id='room-panel';$('#picks').after(roomPanel);
const touch=document.createElement('div');touch.id='touch-controls';touch.hidden=true;touch.innerHTML='<button data-control="brake">ТОРМОЗ</button><button data-control="ability">СПОСОБНОСТЬ</button><button data-control="gas">ГАЗ</button>';document.body.append(touch);
document.title='Hill Rivals · Онлайн-гонка';
$('header>div').textContent='ONLINE MULTIPLAYER';
$('.eyebrow').textContent='ОБЩАЯ КОМНАТА. ОДИН ПОБЕДИТЕЛЬ.';
$('.intro').textContent='Выбери персонажа. Когда все нажмут «Готово», начнётся общий отсчёт 10 секунд!';
document.querySelector('.vehicle-choice').firstChild.textContent='Машина для гонки ';
const hints=document.querySelectorAll('.hint');hints[hints.length-1].textContent='W / D / ↑ / → — газ · S / A / ↓ / ← — тормоз · E / пробел — способность. На телефоне — кнопки внизу. Новые посетители во время гонки наблюдают и ждут следующий старт.';
$('#pause').hidden=true;
$('#menu').textContent='В комнату';
$('#start').textContent='ПОДКЛЮЧЕНИЕ…';$('#start').disabled=true;
let localCharacter=Number(localStorage.getItem('hill-character')||0)%7;
if(!Number.isInteger(localCharacter)||localCharacter<0)localCharacter=0;
let localAbility=localStorage.getItem('hill-ability')||'turbo';
if(!abilityNames[localAbility])localAbility='turbo';
function send(msg){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(msg));}
function renderPick(){
  $('#picks').innerHTML=`<section class="pick"><h3>ВАШ ГОНЩИК</h3><img class="portrait" src="assets/${assetNames[localCharacter]}.png"><div class="choose"><button id="prev-char" aria-label="Предыдущий персонаж">‹</button><b>${names[localCharacter]}</b><button id="next-char" aria-label="Следующий персонаж">›</button></div><label class="ability-select">Способность<select id="my-ability">${Object.entries(abilityNames).map(([key,label])=>`<option value="${key}" ${key===localAbility?'selected':''}>${label}</option>`).join('')}</select></label></section>`;
  const change=d=>{if(!['lobby','countdown'].includes(roomState?.phase))return;localCharacter=(localCharacter+d+7)%7;localStorage.setItem('hill-character',localCharacter);renderPick();sendProfile();};
  $('#prev-char').onclick=()=>change(-1);$('#next-char').onclick=()=>change(1);
  $('#my-ability').onchange=e=>{localAbility=e.target.value;localStorage.setItem('hill-ability',localAbility);sendProfile();};
}
function sendProfile(){send({type:'profile',character:localCharacter,ability:localAbility});}
renderPick();
$('#start').onclick=()=>{if(assetsLoaded)send({type:'ready',ready:!roomState?.players.find(p=>p.id===roomState.you)?.ready});};
$('#track').onchange=()=>{updateMapDescription();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
$('#vehicle').onchange=()=>{describeVehicle();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
togglePause=()=>{};
activateAbility=()=>sendInput(true);
garage=()=>{
  if(roomState && ['race','countdown'].includes(roomState.phase))return;
  mode='lobby';$('#lobby').hidden=false;$('#overlay').hidden=true;$('#hud').hidden=true;touch.hidden=true;
};
$('#menu').onclick=garage;
function controls(){return [!!(keys.KeyW||keys.KeyD||keys.ArrowUp||keys.ArrowRight||keys.TouchGas),!!(keys.KeyS||keys.KeyA||keys.ArrowDown||keys.ArrowLeft||keys.TouchBrake)];}
function sendInput(ability=false){
 const [gas,brake]=controls(),at=performance.now(),previous=inputHistory.at(-1);
 if(!previous||previous.gas!==gas||previous.brake!==brake||ability)inputHistory.push({at,gas,brake,ability});
 while(inputHistory.length>1&&inputHistory[1].at<at-2000)inputHistory.shift();
 if(ability&&predictedCar)predictAbility(predictedCar);
 send({type:'input',gas,brake,ability});
}
addEventListener('keydown',e=>{if(e.target.matches('select,input,textarea'))return;if(e.code==='Space'&&!e.repeat)sendInput(true);sendInput();});
addEventListener('keyup',()=>sendInput());
addEventListener('blur',()=>sendInput());
document.addEventListener('visibilitychange',()=>{if(document.hidden){keysClear();sendInput();}});
for(const button of touch.querySelectorAll('button')){
  const key=button.dataset.control==='gas'?'TouchGas':'TouchBrake';
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(button.dataset.control==='ability'){sendInput(true);return;}keys[key]=true;sendInput();});
  const release=()=>{if(button.dataset.control!=='ability'){keys[key]=false;sendInput();}};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
setInterval(()=>{if(roomState?.phase==='race')sendInput();},100);
// Predict only our car; interpolate other racers and follow with a local camera.
update=dt=>{
  if(!roomState)return;
  if(roomState.phase==='countdown'){count=Math.max(0,(roomState.startAt-(Date.now()+clockOffset))/1000);return;}
  count=0;
  if(mode==='race'&&snapshots.length){
    const now=performance.now(),elapsed=now-snapshotReceived;
    const target=renderTarget=Math.max(renderTarget,(serverToLocal===null?roomState.serverNow+elapsed:now-serverToLocal)-interpolationDelay);
    let left=snapshots[0],right=left;
    for(const snapshot of snapshots){if(snapshot.serverNow<=target)left=snapshot;else{right=snapshot;break;}right=left;}
    const mix=right.serverNow>left.serverNow?Math.max(0,Math.min(1,(target-left.serverNow)/(right.serverNow-left.serverNow))):0;
    cars=roomState.game.cars.map((latest,i)=>{
      const car=cars[i]||{},a=left.game.cars[i]||latest,b=right.game.cars[i]||a;
      if(i===window.onlineIndex&&predictedCar){
        if(elapsed<250&&latest.alive)predictStep(predictedCar,dt,controls());
        Object.assign(car,predictedCar,{alive:latest.alive,reason:latest.reason});
        for(const field of Object.keys(poseError)){poseError[field]*=Math.exp(-dt*14);car[field]=predictedCar[field]+poseError[field];}
      }else{
        Object.assign(car,latest);
        for(const field of ['x','y','a','wheel'])car[field]=a[field]+(b[field]-a[field])*mix;
        // A short missing packet should not freeze a moving opponent; bound drift.
        const ahead=Math.max(0,Math.min(.15,(target-right.serverNow)/1000));
        if(b.alive){car.x+=b.vx*ahead;car.y+=b.vy*ahead;car.a+=b.av*ahead;car.wheel+=b.vx*ahead/17;}
      }
      return car;
    });
    renderWorld(left,right,mix,Math.max(0,Math.min(.15,(target-right.serverNow)/1000)));
  }
  if(mode==='race'){
    const own=cars[roomState.racers.findIndex(p=>p.id===roomState.you)];
    const active=own?.alive?[own]:cars.filter(c=>c.alive);
    if(active.length)updateCamera(active,dt);
  }
};
function installGame(state){
  if(!state.game)return;
  const g=state.game;
  const newRound=onlineRound!==state.round;
  if(newRound){onlineRound=state.round;cam=0;zoom=1;cameraY=0;particles=[];snapshots=[];renderTarget=-Infinity;predictedCar=null;poseError={x:0,y:0,a:0,wheel:0};inputHistory=[];resetHillBridges();keysClear();setWorldSeed(g.seed);}
  const received=performance.now();
  if(lastPacketAt)interpolationDelay+=(Math.max(60,Math.min(140,(received-lastPacketAt)*1.5))-interpolationDelay)*.1;
  lastPacketAt=received;snapshotReceived=received;snapshots.push(state);if(snapshots.length>12)snapshots.shift();
  colors.splice(0,colors.length,...state.racers.map(p=>p.color));
  chosen.splice(0,chosen.length,...state.racers.map(p=>p.character));
  abilities.splice(0,abilities.length,...state.racers.map(p=>p.ability));
  state.racers.forEach((_,i)=>abilityKeys[i]='E / пробел');
  window.onlineIndex=state.racers.findIndex(p=>p.id===state.you);
  track=g.track;vehicleModel=g.vehicle;snowStart=g.snowStart;snowEnd=g.snowEnd;
  if(newRound)time=g.time;
  // Keep object identities so suspension smoothing survives incoming packets.
  if(newRound||state.phase==='result'){
   cars=g.cars.map((c,i)=>Object.assign(cars[i]||{},c));
   bonus=g.bonus.map(crate=>({...crate}));hillBridgeStates.clear();
   for(const bridge of g.bridges||[])hillBridgeStates.set(bridge.a,{...bridge,q:[...bridge.q],v:[...bridge.v]});
   if(state.phase==='result')time=g.time;
  }
  count=0;
  mode=state.phase==='result'?'result':'race';paused=false;
  if(state.phase==='race')rebuildPrediction(state,received);
  $('#lobby').hidden=true;$('#foot').hidden=true;$('#hud').hidden=false;
  touch.hidden=state.phase!=='race'||!state.racers.some(p=>p.id===state.you);
  if(state.phase==='race')$('#overlay').hidden=true;
}
function renderRoom(state){
  const ready=state.players.filter(p=>p.ready).length;
  const spectator=state.phase==='race'&&!state.racers.some(p=>p.id===state.you);
  onlineBar.textContent=`На сайте: ${state.online} · В гонке: ${state.inRace} · Готовы: ${ready}/${state.players.length}${spectator?' · Вы наблюдаете':''}`;
  roomPanel.innerHTML=`<h3>Комната · ${state.players.length} онлайн</h3><div class="room-list">${state.players.map((p,i)=>`<div>${p.id===state.you?'Вы':'Гонщик '+(i+1)} · ${names[p.character]} <b>${p.ready?'✓ Готов':'В комнате'}</b></div>`).join('')}</div><p id="room-status"></p>`;
  $('#track').value=state.track;$('#vehicle').value=state.vehicle;
  $('#track').disabled=$('#vehicle').disabled=state.phase!=='lobby';
  $('#my-ability').disabled=!['lobby','countdown'].includes(state.phase);
  $('#prev-char').disabled=$('#next-char').disabled=!['lobby','countdown'].includes(state.phase);
  updateMapDescription();describeVehicle();
  $('#start').disabled=state.phase==='race';
  const myReady=state.players.find(p=>p.id===state.you)?.ready;
  $('#start').textContent=state.phase==='countdown'?'СТАРТ ЧЕРЕЗ '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' С · ОТМЕНИТЬ':myReady?'ОТМЕНИТЬ ГОТОВНОСТЬ':'ГОТОВО';
  $('#menu').disabled=['race','countdown'].includes(state.phase);
  if(state.phase==='lobby'){
    mode='lobby';count=0;snapshots=[];renderTarget=-Infinity;$('#lobby').hidden=false;$('#foot').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;
    $('#room-status').textContent='Любой может выбрать трассу и машину. Старт начнётся, когда все нажмут «Готово». Можно отменить готовность.';
  }
  if(state.phase==='countdown'){
    $('#room-status').textContent='До общего старта: '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' с. Все, кто в комнате, участвуют!';
    mode='lobby';$('#lobby').hidden=false;$('#hud').hidden=true;touch.hidden=true;$('#overlay').hidden=true;
  }
  if(state.phase==='result'&&oldPhase!=='result'){
    $('#overlay').hidden=false;
    const ranked=[...cars].sort((a,b)=>b.x-a.x);
    $('#overlay').innerHTML=`<div class="eyebrow">ГОНКА ОКОНЧЕНА</div><h2>${state.game.winner===null?'Все выбыли':'Гонщик '+(state.game.winner+1)+' победил!'}</h2><p>${ranked.map(c=>`${names[chosen[c.i]]} · ${Math.max(0,Math.floor((c.x-c.startX)/10))} м`).join('<br>')}</p><button id="next-race">Следующая гонка</button>`;
    $('#next-race').onclick=()=>{send({type:'ready',ready:true});};
  }
  oldPhase=state.phase;
}
function connect(){
  clearTimeout(reconnectTimer);onlineBar.textContent='Подключение к серверу…';
  socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
  socket.onopen=()=>{serverToLocal=null;bestRtt=Infinity;lastPacketAt=0;sendProfile();send({type:'ping',sent:performance.now()});};
  socket.onmessage=e=>{
    const state=JSON.parse(e.data);
    if(state.type==='pong'){
      const now=performance.now(),rtt=now-state.sent;
      if(rtt>=0&&rtt<=bestRtt*1.2){bestRtt=Math.min(bestRtt,rtt);serverToLocal=(state.sent+now)/2-state.serverNow;}
      return;
    }
    if(state.type!=='state')return;
    clockOffset=state.serverNow-Date.now();
    const changed=!roomState||JSON.stringify([state.phase,state.players,state.track,state.vehicle,state.host,state.inRace])!==JSON.stringify([roomState.phase,roomState.players,roomState.track,roomState.vehicle,roomState.host,roomState.inRace]);
    roomState=state;installGame(state);
    const seconds=state.phase==='countdown'?Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000)):-1;
    if(changed||seconds!==renderedCountdown)renderRoom(state);
    renderedCountdown=seconds;
  };
  socket.onclose=()=>{keysClear();$('#start').disabled=true;touch.hidden=true;onlineBar.textContent='Связь потеряна. Переподключаемся…';roomState=null;predictedCar=null;snapshots=[];oldPhase='';reconnectTimer=setTimeout(connect,1500);};
  socket.onerror=()=>socket.close();
}
window.assetsReady.then(connect);
setInterval(()=>{if(socket?.readyState===WebSocket.OPEN)send({type:'ping',sent:performance.now()});},2000);
let deployedVersion;
setInterval(async()=>{
  try{const state=await fetch('/health',{cache:'no-store'}).then(r=>r.json());
    if(deployedVersion&&deployedVersion!==state.version){
      if(roomState?.phase==='race'){onlineBar.textContent+=' · Доступно обновление после гонки';return;}
      location.reload();
    }deployedVersion=state.version;
  }catch{}
},5000);
