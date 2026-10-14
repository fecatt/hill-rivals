'use strict';
window.localGameHooks={update,input,activateAbility,togglePause,garage,start,trackChange:$('#track').onchange,vehicleChange:$('#vehicle').onchange};
document.body.classList.add('online');
$('#players').closest('label').hidden=true;
let socket,roomState=null,onlineRound=-1,clockOffset=0,oldPhase='',reconnectTimer;
let snapshots=[],snapshotReceived=0,renderedCountdown=-1;
let localCar=null,localControls=[false,false];
let poseSequence=0,lastPoseSent=-Infinity,localSimTime=0,seenRewards=new Set();
let serverToLocal=null,bestRtt=Infinity;
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
 if(window.onlineIndex<0){
 const previousBridges=new Map((a.bridges||[]).map(bridge=>[bridge.a,bridge]));
 hillBridgeStates.clear();
 for(const bridge of b.bridges||[]){
  const old=previousBridges.get(bridge.a)||bridge;
  hillBridgeStates.set(bridge.a,{...bridge,q:bridge.q.map((q,j)=>old.q[j]+(q-old.q[j])*mix+bridge.v[j]*ahead),v:[...bridge.v]});
 }
 }
 // Packet installation must never rewind the render clock.
 time=Math.max(time,a.time+(b.time-a.time)*mix+ahead);
}
const localAbilityAction=activateAbility;
// The owning device runs continuous physics. Server packets never replace its pose.
input=i=>i===window.onlineIndex?localControls:[false,false];
function localPhysicsStep(c,dt,control){localControls=control;physics(c,dt);}
function installLocalCar(state){
 const index=window.onlineIndex,authoritative=state.game.cars[index];
 if(!authoritative){localCar=null;return;}
 if(!localCar){
  localCar={...authoritative,contacts:authoritative.contacts.map(c=>({...c}))};
  localSimTime=state.game.time;
 }
 if(!authoritative.alive){localCar.alive=false;localCar.reason=authoritative.reason;}
 for(const reward of state.game.rewards||[]){
  if(reward.i!==index||seenRewards.has(reward.id))continue;
  seenRewards.add(reward.id);
  if(reward.type===0){localCar.fuel=Math.min(100,localCar.fuel+40);announce(localCar,'+40 ТОПЛИВА');}
  if(reward.type===1){localCar.boost=5;announce(localCar,'ТУРБО · 5 СЕК');}
  if(reward.type===2){localCar.shield=12;announce(localCar,'ЩИТ · 12 СЕК');}
  if(reward.type===3){localCar.mud=6;announce(localCar,'КОЛЁСА В ГРЯЗИ · 6 СЕК');}
 }
}
function sendPose(force=false){
 const now=performance.now();
 if(!localCar||roomState?.phase!=='race'||(!force&&now-lastPoseSent<1000/30))return;
 lastPoseSent=now;
 const pose={};
 for(const field of ['x','y','vx','vy','a','av','wheel','fuel','cp','shield','boost','mud','cooldown','air','flip'])pose[field]=localCar[field];
 pose.alive=localCar.alive;pose.reason=localCar.reason;pose.rocketOn=localCar.rocketOn;
 const packet={type:'pose',round:onlineRound,seq:++poseSequence,time:localSimTime,pose};
 send(packet);window.peerTransport?.broadcast(packet);
}

const onlineBar=document.createElement('div');onlineBar.id='online-bar';onlineBar.setAttribute('aria-live','polite');document.body.append(onlineBar);
const roomPanel=document.createElement('section');roomPanel.id='room-panel';$('#picks').after(roomPanel);
const touch=document.createElement('div');touch.id='touch-controls';touch.hidden=true;touch.innerHTML='<button data-control="brake" aria-label="Тормоз и задний ход"><span class="touch-hint">НАЗАД</span></button><button data-control="ability" aria-label="Способность"><span class="touch-hint">СПОСОБНОСТЬ</span></button><button data-control="gas" aria-label="Газ"><span class="touch-hint">ГАЗ</span></button>';document.body.append(touch);
const roomUI=createRoomsUI();
window.peerTransport=createPeerTransport(send,()=>roomState);
document.title='Hill Rivals · Онлайн-гонка';
$('header>div').textContent='ONLINE MULTIPLAYER';
$('#lobby .eyebrow').textContent='ГОТОВИМСЯ К ГОНКЕ';
$('#lobby .intro').textContent='Выберите персонажа и нажмите «Готово».';
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
  $('#picks').innerHTML=`<section class="pick"><h3>ВАШ ГОНЩИК</h3><label class="player-name-label" for="player-name">Ваше имя<input id="player-name" maxlength="24" placeholder="Игрок 1" autocomplete="nickname"></label><img class="portrait" src="assets/${assetNames[localCharacter]}.png"><div class="choose"><button id="prev-char" aria-label="Предыдущий персонаж">‹</button><b>${names[localCharacter]}</b><button id="next-char" aria-label="Следующий персонаж">›</button></div><label class="ability-select">Способность<select id="my-ability">${Object.entries(abilityNames).map(([key,label])=>`<option value="${key}" ${key===localAbility?'selected':''}>${label}</option>`).join('')}</select></label></section>`;
  const field=$('#player-name');field.value=localStorage.getItem('hill-player-name')||roomState?.players.find(p=>p.id===roomState.you)?.name||'';
  const saveName=()=>{const name=field.value.trim().slice(0,24);localStorage.setItem('hill-player-name',name);send({type:'name',name});};
  field.onchange=saveName;field.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveName();field.blur();}};
  const change=d=>{if(!['lobby','countdown'].includes(roomState?.phase))return;localCharacter=(localCharacter+d+7)%7;localStorage.setItem('hill-character',localCharacter);renderPick();sendProfile();};
  $('#prev-char').onclick=()=>change(-1);$('#next-char').onclick=()=>change(1);
  $('#my-ability').onchange=e=>{localAbility=e.target.value;localStorage.setItem('hill-ability',localAbility);sendProfile();};
}
function sendProfile(){send({type:'name',name:localStorage.getItem('hill-player-name')||''});send({type:'profile',character:localCharacter,ability:localAbility});}
renderPick();
$('#start').onclick=()=>{if(assetsLoaded)send({type:'ready',ready:!roomState?.players.find(p=>p.id===roomState.you)?.ready});};
$('#track').onchange=()=>{updateMapDescription();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
$('#vehicle').onchange=()=>{describeVehicle();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
togglePause=()=>{};
activateAbility=()=>sendInput(true);
garage=()=>{
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);send({type:'leave-room'});
};
$('#menu').onclick=garage;
function controls(){return [!!(keys.KeyW||keys.KeyD||keys.ArrowUp||keys.ArrowRight||keys.TouchGas),!!(keys.KeyS||keys.KeyA||keys.ArrowDown||keys.ArrowLeft||keys.TouchBrake)];}
function sendInput(ability=false){
 if(!window.onlineActive)return;
 const [gas,brake]=controls();
 if(ability&&localCar)localAbilityAction(localCar);
 send({type:'input',gas,brake});
}
addEventListener('keydown',e=>{if(!window.onlineActive||e.target.matches('select,input,textarea'))return;if(e.code==='Space'&&!e.repeat)sendInput(true);sendInput();});
addEventListener('keyup',()=>sendInput());
addEventListener('blur',()=>sendInput());
document.addEventListener('visibilitychange',()=>{if(document.hidden){keysClear();sendInput();}});
const touchPointers=new Map();
function applyTouchInput(){keys.TouchGas=[...touchPointers.values()].includes('gas');keys.TouchBrake=[...touchPointers.values()].includes('brake');sendInput();}
window.resetTouchInput=()=>{touchPointers.clear();};
for(const button of touch.querySelectorAll('button')){
  const control=button.dataset.control;
  button.addEventListener('pointerdown',e=>{
    if(mode!=='race'||paused||!mobileInput.matches)return;
    e.preventDefault();button.setPointerCapture(e.pointerId);touchPointers.set(e.pointerId,control);
    if(control==='ability'){if(window.onlineActive)sendInput(true);else activateAbility(cars[0]);}
    else applyTouchInput();
  });
  const release=e=>{if(!touchPointers.delete(e.pointerId))return;applyTouchInput();};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
let movementStarted=false,touchHintTime=0;
window.resetTouchHints=()=>{movementStarted=false;touchHintTime=0;touch.classList.remove('hints-faded');};
window.updateTouchHints=dt=>{
 if(mode!=='race'){window.resetTouchHints();return;}
 const own=cars[window.onlineIndex??0];
 if(!paused&&count<=0&&own?.alive){
  if(Math.abs(own.vx)>1)movementStarted=true;
  if(movementStarted)touchHintTime+=dt;
 }
 touch.classList.toggle('hints-faded',touchHintTime>=5);
};
setInterval(()=>{if(roomState?.phase==='race')sendInput();},100);
// Simulate our car locally; interpolate the remote cars and shared bonuses.
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
      if(i===window.onlineIndex&&localCar){
        localCar.prevX=localCar.x;localCar.prevY=localCar.y;
        updateHillBridges(dt);localPhysicsStep(localCar,dt,controls());localSimTime+=dt;
        Object.assign(car,localCar);
      }else{
        Object.assign(car,latest);
        for(const field of ['x','y','a','wheel'])car[field]=a[field]+(b[field]-a[field])*mix;
        // A short missing packet should not freeze a moving opponent; bound drift.
        const ahead=Math.max(0,Math.min(.15,(target-right.serverNow)/1000));
        if(b.alive){car.x+=b.vx*ahead;car.y+=b.vy*ahead;car.a+=b.av*ahead;car.wheel+=b.vx*ahead/17;}
        const direct=window.peerTransport.pose(roomState.racers[i]?.id);
        if(direct&&latest.alive)Object.assign(car,direct,{alive:latest.alive,reason:latest.reason});
      }
      return car;
    });
    renderWorld(left,right,mix,Math.max(0,Math.min(.15,(target-right.serverNow)/1000)));
    sendPose();
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
  if(newRound){window.resetTouchHints();onlineRound=state.round;cam=0;zoom=1;cameraY=0;particles=[];snapshots=[];renderTarget=-Infinity;localCar=null;poseSequence=0;lastPoseSent=-Infinity;seenRewards.clear();resetHillBridges();keysClear();setWorldSeed(g.seed);}
  const received=performance.now();
  if(lastPacketAt)interpolationDelay+=(Math.max(60,Math.min(140,(received-lastPacketAt)*1.5))-interpolationDelay)*.1;
  lastPacketAt=received;snapshotReceived=received;snapshots.push(state);if(snapshots.length>12)snapshots.shift();
  window.racerNames=state.racers.map((p,i)=>p.name||'Игрок '+(i+1));
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
  if(state.phase==='race')installLocalCar(state);
  $('#lobby').hidden=true;$('#foot').hidden=true;$('#hud').hidden=false;
  touch.hidden=state.phase!=='race'||!state.racers.some(p=>p.id===state.you);
  if(state.phase==='race')$('#overlay').hidden=true;
}
function renderRoom(state){
  roomUI.state(state);
  track=state.track;vehicleModel=state.vehicle;
  const ready=state.players.filter(p=>p.ready).length;
  const spectator=state.phase==='race'&&!state.racers.some(p=>p.id===state.you);
  onlineBar.textContent=`На сайте: ${state.online} · В гонке: ${state.inRace} · Готовы: ${ready}/${state.players.length}${spectator?' · Вы наблюдаете':''}`;
  roomPanel.querySelector('.room-list').innerHTML=state.players.map((p,i)=>`<div>${p.id===state.room.host?'♛ ':''}${escapeLabel(p.name||'Игрок '+(i+1))}${p.id===state.you?' · Вы':''} <b>${p.ready?'✓ Готов':'В комнате'}</b></div>`).join('');
  $('#track').value=state.track;$('#vehicle').value=state.vehicle;
  $('#track').disabled=$('#vehicle').disabled=state.phase!=='lobby'||state.room.host!==state.you;
  $('#my-ability').disabled=!['lobby','countdown'].includes(state.phase);
  $('#prev-char').disabled=$('#next-char').disabled=!['lobby','countdown'].includes(state.phase);
  updateMapDescription();describeVehicle();
  $('#start').disabled=state.phase==='race';
  const myReady=state.players.find(p=>p.id===state.you)?.ready;
  $('#start').textContent=state.phase==='countdown'?'СТАРТ ЧЕРЕЗ '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' С · ОТМЕНИТЬ':myReady?'ОТМЕНИТЬ ГОТОВНОСТЬ':'ГОТОВО';
  $('#menu').disabled=false;$('#menu').textContent='Выйти из комнаты';
  if(state.phase==='lobby'){
    mode='lobby';count=0;snapshots=[];renderTarget=-Infinity;$('#lobby').hidden=false;$('#foot').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;
    $('#room-status').textContent='Готовы '+ready+' из '+state.players.length+'. Старт — после готовности всех игроков.';
  }
  if(state.phase==='countdown'){
    $('#room-status').textContent='До общего старта: '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' с. Все, кто в комнате, участвуют!';
    mode='lobby';$('#lobby').hidden=false;$('#hud').hidden=true;touch.hidden=true;$('#overlay').hidden=true;
  }
  if(state.phase==='result'&&oldPhase!=='result'){
    $('#overlay').hidden=false;
    const ranked=[...cars].sort((a,b)=>b.x-a.x);
    $('#overlay').innerHTML=`<div class="eyebrow">ГОНКА ОКОНЧЕНА</div><h2>${state.game.winner===null?'Все выбыли':escapeLabel(state.racers[state.game.winner]?.name||'Игрок '+(state.game.winner+1))+' победил!'}</h2><p>${ranked.map(c=>`${escapeLabel(racerName(c))} · ${Math.floor(raceMetres(c))} м`).join('<br>')}</p><button id="next-race">Следующая гонка</button>`;
    $('#next-race').onclick=()=>{send({type:'ready',ready:true});};
  }
  oldPhase=state.phase;
}
function connect(){
  if(!window.onlineActive)return;
  if(socket&&[0,1].includes(socket.readyState))return;
  clearTimeout(reconnectTimer);onlineBar.textContent='Подключение к серверу…';
  socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
  socket.onopen=()=>{serverToLocal=null;bestRtt=Infinity;lastPacketAt=0;sendProfile();const code=roomState?.room.code||new URL(location.href).searchParams.get('room');if(/^[A-Z]{5}$/i.test(code||''))send({type:'join-room',code});send({type:'ping',sent:performance.now()});};
  socket.onmessage=e=>{
    const state=JSON.parse(e.data);
    if(state.type==='directory'){roomUI.directory(state);return;}
    if(state.type==='chat'){roomUI.chat(state.messages);return;}
    if(state.type==='notice'){roomUI.notice(state.text);return;}
    if(state.type==='signal'){window.peerTransport.signal(state);return;}
    if(state.type==='peer-probe'){window.peerTransport.relay(state);return;}
    if(state.type==='pong'){
      const now=performance.now(),rtt=now-state.sent;
      if(rtt>=0&&rtt<=bestRtt*1.2){bestRtt=Math.min(bestRtt,rtt);serverToLocal=(state.sent+now)/2-state.serverNow;}
      return;
    }
    if(state.type!=='state')return;
    clockOffset=state.serverNow-Date.now();
    const joined=!roomState||state.room.code!==roomState.room?.code;
    const changed=joined||JSON.stringify([state.phase,state.players,state.track,state.vehicle,state.room,state.inRace])!==JSON.stringify([roomState.phase,roomState.players,roomState.track,roomState.vehicle,roomState.room,roomState.inRace]);
    roomState=state;installGame(state);
    window.peerTransport.update(state);
    if(joined)sendProfile();
    const seconds=state.phase==='countdown'?Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000)):-1;
    if(changed||seconds!==renderedCountdown)renderRoom(state);
    renderedCountdown=seconds;
  };
  socket.onclose=()=>{keysClear();$('#start').disabled=true;touch.hidden=true;roomState=null;localCar=null;snapshots=[];oldPhase='';window.peerTransport.reset();if(window.onlineActive){onlineBar.textContent='Связь потеряна. Переподключаемся…';reconnectTimer=setTimeout(connect,1500);}};
  socket.onerror=()=>socket.close();
}
window.onlineGameHooks={update,input,activateAbility,togglePause,garage,start:$('#start').onclick,trackChange:$('#track').onchange,vehicleChange:$('#vehicle').onchange};
window.onlineSession={
 enter(){roomPanel.hidden=false;onlineBar.hidden=false;renderPick();$('#players').closest('label').hidden=true;roomUI.browser.hidden=false;$('#lobby').hidden=true;window.assetsReady.then(connect);},
 exit(){clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.onmessage=null;socket.onopen=null;socket.onerror=null;socket.close();}roomState=null;localCar=null;onlineRound=-1;oldPhase='';window.peerTransport.reset();roomUI.hide();roomPanel.hidden=true;onlineBar.hidden=true;},
};
setInterval(()=>{if(window.onlineActive){window.peerTransport.probe();const status=$('#connection-status');if(status)status.textContent=window.peerTransport.summary();}},2000);
setInterval(()=>{if(socket?.readyState===WebSocket.OPEN)send({type:'ping',sent:performance.now()});},2000);
let deployedVersion;
setInterval(async()=>{
  if(!window.onlineActive)return;
  try{const state=await fetch('/health',{cache:'no-store'}).then(r=>r.json());
    if(deployedVersion&&deployedVersion!==state.version){
      if(roomState?.phase==='race'){onlineBar.textContent+=' · Доступно обновление после гонки';return;}
      location.reload();
    }deployedVersion=state.version;
  }catch{}
},5000);
