'use strict';
const touchDevice=matchMedia('(pointer:coarse), (max-width:750px)');
const playerOwner=player=>player.owner??player.id;
window.localGameHooks={update,input,activateAbility,togglePause,garage,start,trackChange:$('#track').onchange,vehicleChange:$('#vehicle').onchange};
document.body.classList.add('online');
$('#players').closest('label').hidden=true;
const connectionSession=sessionStorage.getItem('hill-session')||crypto.randomUUID();sessionStorage.setItem('hill-session',connectionSession);
let socket,roomState=null,onlineRound=-1,clockOffset=0,oldPhase='',reconnectTimer,selfRoomRequested=false,roomExitNotice='';
let snapshots=[],snapshotReceived=0,renderedCountdown=-1;
let localCar=null,localCars=new Map(),localControls=[false,false];
let poseSequence=0,lastPoseSent=-Infinity,localSimTime=0,seenRewards=new Set();
let serverToLocal=null,bestRtt=Infinity;
let recentRtts=[],lastPongAt=0,lastStateReceived=0,connectionLost=false;
let interpolationDelay=70,lastPacketAt=0,renderTarget=-Infinity;
const remoteFrames=new Map();
function remotePose(index,target,fallback){
 const frames=remoteFrames.get(index);if(!frames?.length)return fallback;
 let a=frames[0],b=a;
 for(const frame of frames){if(frame.at<=target)a=frame;else{b=frame;break;}b=a;}
 const mix=b.at>a.at?Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at))):0;
 const pose={...b.pose};
 for(const key of ['x','y','a','wheel'])pose[key]=a.pose[key]+(b.pose[key]-a.pose[key])*mix;
 const ahead=Math.max(0,Math.min(.15,(target-b.at)/1000));
 if(b.pose.alive){pose.x+=b.pose.vx*ahead;pose.y+=b.pose.vy*ahead;pose.a+=b.pose.av*ahead;pose.wheel+=b.pose.vx*ahead/17;}
 return pose;
}
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
function controlsForSeat(slot){
 if(paused)return [false,false];
 if(slot===0)return [!!(keys.KeyD||keys.KeyW||keys.TouchGas),!!(keys.KeyA||keys.KeyS||keys.TouchBrake)];
 if(slot===1)return [!!(keys.ArrowUp||keys.ArrowRight),!!(keys.ArrowDown||keys.ArrowLeft)];
 if(slot===2)return [!!keys.Mouse2,!!keys.Mouse0];
 return [!!(keys.KeyI||keys.KeyL),!!(keys.KeyJ||keys.KeyK)];
}
input=i=>{const slot=(window.onlineIndices||[]).indexOf(i);return slot<0?[false,false]:controlsForSeat(slot)};
function localPhysicsStep(c,dt,control){localControls=control;physics(c,dt);}
function installLocalCar(state){
 for(const index of window.onlineIndices||[]){
  const authoritative=state.game.cars[index];if(!authoritative)continue;
  let car=localCars.get(index);if(!car){car={...authoritative,contacts:authoritative.contacts.map(c=>({...c}))};localCars.set(index,car);localSimTime=state.game.time;}
  if(!authoritative.alive){car.alive=false;car.reason=authoritative.reason;}
  for(const reward of state.game.rewards||[]){if(reward.i!==index||seenRewards.has(reward.id))continue;seenRewards.add(reward.id);if(reward.type===0){car.fuel=Math.min(100,car.fuel+40);announce(car,'+40 ТОПЛИВА');}if(reward.type===1){car.boost=5;announce(car,'ТУРБО · 5 СЕК');}if(reward.type===2){car.shield=12;announce(car,'ЩИТ · 12 СЕК');}if(reward.type===3){car.mud=6;announce(car,'КОЛЁСА В ГРЯЗИ · 6 СЕК');}}
 }
 localCar=localCars.get(window.onlineIndices?.[0])||null;
}
function sendPose(force=false){
 const now=performance.now();
 if(!localCars.size||roomState?.phase!=='race'||(!force&&now-lastPoseSent<1000/30))return;
 lastPoseSent=now;
 const poses=(window.onlineIndices||[]).map((index,slot)=>{const car=localCars.get(index);if(!car)return null;const pose={};for(const field of ['x','y','vx','vy','a','av','wheel','fuel','cp','shield','boost','mud','cooldown','air','flip'])pose[field]=car[field];if(paused){pose.vx=0;pose.vy=0;pose.av=0;}pose.alive=car.alive;pose.reason=car.reason;pose.rocketOn=car.rocketOn;return {slot,seq:++poseSequence,time:localSimTime,pose};}).filter(Boolean);
 const packet=poses.length===1?{type:'pose',round:onlineRound,...poses[0]}:{type:'poses',round:onlineRound,poses};
 send(packet);window.peerTransport?.broadcast(packet);
}

const onlineBar=document.createElement('div');onlineBar.id='online-bar';onlineBar.setAttribute('aria-live','polite');document.body.append(onlineBar);
const connectionIndicator=document.createElement('div');connectionIndicator.id='connection-indicator';connectionIndicator.hidden=true;connectionIndicator.setAttribute('role','status');connectionIndicator.setAttribute('aria-live','polite');document.body.append(connectionIndicator);
let showPing=localStorage.getItem('hill-show-ping')==='true';
window.appendConnectionSettings=panel=>{
 const label=document.createElement('label');label.className='connection-setting';
 const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=showPing;checkbox.addEventListener('change',()=>{showPing=checkbox.checked;localStorage.setItem('hill-show-ping',String(showPing));refreshConnectionIndicator();});
 const text=document.createElement('span');text.textContent='Показывать пинг';label.append(checkbox,text);panel.append(label);
};
function refreshConnectionIndicator(){
 const freshRtts=performance.now()-lastPongAt<5000?recentRtts:[],sortedRtts=[...freshRtts].sort((a,b)=>a-b);
 const serverPing=sortedRtts.length?Math.round(sortedRtts[Math.floor(sortedRtts.length/2)]):null;
 const peerPings=window.peerTransport?.pings?.()||[];
 const age=lastStateReceived?performance.now()-lastStateReceived:Infinity;
 const poor=mode==='race'&&(connectionLost||age>1800||serverPing!==null&&serverPing>=400);
 const pingText=[serverPing!==null?'Сервер '+serverPing+' мс':'Сервер —',...peerPings.map(value=>'Игроки '+value+' мс')].join(' · ');
 connectionIndicator.hidden=!poor&&(!showPing||mode!=='race');
 connectionIndicator.classList.toggle('poor',poor);
 connectionIndicator.textContent=poor?'Связь с комнатой нестабильна · гонка продолжается':pingText;
}
window.refreshConnectionIndicator=refreshConnectionIndicator;
const roomPanel=document.createElement('section');roomPanel.id='room-panel';roomPanel.hidden=true;$('#picks').after(roomPanel);
const touch=document.createElement('div');touch.id='touch-controls';touch.hidden=true;touch.innerHTML='<button data-control="brake" aria-label="Тормоз и задний ход"><span class="touch-hint">НАЗАД</span></button><button data-control="ability" aria-label="Способность"><span class="touch-hint">ЩИТ / СПОСОБНОСТЬ</span></button><button data-control="gas" aria-label="Газ"><span class="touch-hint">ГАЗ</span></button>';document.body.append(touch);
const roomUI=createRoomsUI();
window.appendConnectionSettings($('#room-options .drawer-body'));
window.peerTransport=createPeerTransport(send,()=>roomState);
document.title='Hill Rivals · Онлайн-гонка';
$('header>div').textContent='ONLINE MULTIPLAYER';
$('#lobby .eyebrow').textContent='ЕДИНАЯ ОНЛАЙН-ГОНКА';
$('#lobby h1').textContent='Подключение к гонке';
$('#lobby .intro').textContent='Четыре гонщика на компьютере или один на телефоне. Присоединяйтесь по коду комнаты.';
document.querySelector('.vehicle-choice').firstChild.textContent='Машина для гонки ';
const hints=document.querySelectorAll('.hint');hints[hints.length-1].textContent='W / D / ↑ / → — газ · S / A / ↓ / ← — тормоз · E / пробел — способность. На телефоне — кнопки внизу. Новые посетители во время гонки наблюдают и ждут следующий старт.';
$('#pause').hidden=true;
$('#menu').textContent='В комнату';
$('#start').textContent='ПОДКЛЮЧЕНИЕ…';$('#start').disabled=true;
let localCharacter=Number(localStorage.getItem('hill-character')||0)%7;
if(!Number.isInteger(localCharacter)||localCharacter<0)localCharacter=0;
let localAbility=localStorage.getItem('hill-ability')||'turbo';
if(!abilityNames[localAbility])localAbility='turbo';
// A fresh party starts with one racer. Add couch teammates explicitly from the room UI.
let onlineSeatCount=1;
document.body.dataset.players=String(onlineSeatCount);$('#lobby').dataset.party=String(onlineSeatCount);$('#picks').style.setProperty?.('--online-seats',onlineSeatCount);
const onlineCharacters=[...chosen],onlineAbilities=[...abilities];
onlineCharacters[0]=localCharacter;onlineAbilities[0]=localAbility;
function profileForSeat(slot){const nameKey=slot===0?'hill-player-name':'hill-party-name-'+slot;return {name:localStorage.getItem(nameKey)||roomState?.players.find(p=>playerOwner(p)===roomState.you&&(p.slot??0)===slot)?.name||'',character:onlineCharacters[slot]??slot%7,ability:onlineAbilities[slot]||'turbo'};}
window.syncOnlineFromGarage=setup=>{
 if(!setup)return;
 onlineSeatCount=touchDevice.matches?1:onlineSeatCount;$('#players').value=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);$('#lobby').dataset.party=String(onlineSeatCount);$('#picks').style.setProperty?.('--online-seats',onlineSeatCount);
 for(let i=0;i<4;i++){if(Number.isInteger(setup.chosen?.[i]))onlineCharacters[i]=setup.chosen[i];if(setup.abilities?.[i])onlineAbilities[i]=setup.abilities[i];}
 if(Number.isInteger(setup.track))$('#track').value=String(setup.track);if(Number.isInteger(setup.vehicle))$('#vehicle').value=String(setup.vehicle);
 localCharacter=onlineCharacters[0]||0;localAbility=onlineAbilities[0]||'turbo';renderPick();
};
function send(msg){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(msg));}
let profileNameTimer;
function renderPick(){
  $('#picks').innerHTML=Array.from({length:onlineSeatCount},(_,slot)=>{const profile=profileForSeat(slot),bindings=['WASD · W/D газ · S/A тормоз','Стрелки · ↑/→ газ · ↓/← тормоз','Мышь · ПКМ газ · ЛКМ тормоз','IJKL · I/L газ · J/K тормоз'];return `<section class="pick" data-online-seat="${slot}" style="border-top:5px solid ${colors[slot]}"><h3>${slot===0?'ВАШ ГОНЩИК':'ИГРОК '+(slot+1)}</h3><label class="player-name-label" for="player-name-${slot}">Имя гонщика<input type="text" inputmode="text" name="racer-name-${slot}" id="player-name-${slot}" data-name-seat="${slot}" maxlength="24" placeholder="Игрок ${slot+1}" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" value="${escapeLabel(profile.name)}" ${slot>0?'':'aria-label="Ваше имя"'}></label><img class="portrait" src="assets/${assetNames[profile.character]}.png"><div class="choose"><button data-char-seat="${slot}" data-step="-1" aria-label="Предыдущий персонаж">‹</button><b>${names[profile.character]}</b><button data-char-seat="${slot}" data-step="1" aria-label="Следующий персонаж">›</button></div><div class="keys">${bindings[slot]}</div><label class="ability-select">Способность · ${['E','правый Shift','СКМ','U'][slot]}<select data-ability-seat="${slot}">${Object.entries(abilityNames).map(([key,label])=>`<option value="${key}" ${key===profile.ability?'selected':''}>${label}</option>`).join('')}</select></label></section>`;}).join('');
  if(!touchDevice.matches){
   for(let slot=onlineSeatCount;slot<4;slot++){
    const empty=document.createElement('button');empty.type='button';empty.className='pick empty-seat';empty.dataset.addSeat=String(slot);empty.setAttribute('aria-label','Добавить гонщика на этом устройстве');empty.innerHTML='<span aria-hidden="true">+</span><small>Добавить игрока</small>';
    empty.disabled=!!roomState&&roomState.phase!=='lobby'||(roomState?.players.length||0)>=8;
    empty.onclick=()=>{if(roomState?.phase==='lobby')window.changeOnlineParty(1);};$('#picks').append(empty);
   }
   if(onlineSeatCount>1){const card=$('#picks').querySelector(`[data-online-seat="${onlineSeatCount-1}"]`),remove=document.createElement('button');remove.type='button';remove.className='remove-seat';remove.textContent='×';remove.setAttribute('aria-label','Убрать последнего гонщика');remove.disabled=!!roomState&&roomState.phase!=='lobby';remove.onclick=()=>window.changeOnlineParty(-1);card.append(remove);}
  }
  $('#picks').querySelectorAll('[data-name-seat]').forEach(field=>{const slot=+field.dataset.nameSeat;const saveName=()=>{localStorage.setItem(slot===0?'hill-player-name':'hill-party-name-'+slot,field.value.trim().slice(0,24));sendProfile();};field.oninput=()=>{localStorage.setItem(slot===0?'hill-player-name':'hill-party-name-'+slot,field.value.trim().slice(0,24));clearTimeout(profileNameTimer);profileNameTimer=setTimeout(sendProfile,150);};field.onchange=()=>{clearTimeout(profileNameTimer);saveName();};field.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveName();field.blur();}};});
  $('#picks').querySelectorAll('[data-char-seat]').forEach(button=>button.onclick=()=>{if(!['lobby','countdown'].includes(roomState?.phase))return;const slot=+button.dataset.charSeat;onlineCharacters[slot]=(onlineCharacters[slot]+Number(button.dataset.step)+names.length)%names.length;if(slot===0){localCharacter=onlineCharacters[0];localStorage.setItem('hill-character',localCharacter);}renderPick();sendProfile();});
  $('#picks').querySelectorAll('[data-ability-seat]').forEach(select=>select.onchange=()=>{const slot=+select.dataset.abilitySeat;onlineAbilities[slot]=select.value;if(slot===0){localAbility=select.value;localStorage.setItem('hill-ability',localAbility);}sendProfile();});
}
function sendProfile(){clearTimeout(profileNameTimer);const seats=Array.from({length:onlineSeatCount},(_,slot)=>profileForSeat(slot));send({type:'profile',seats});}
renderPick();
function setOnlineSeatCount(count){if(touchDevice.matches)count=1;onlineSeatCount=Math.max(1,Math.min(4,count));$('#players').value=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);$('#lobby').dataset.party=String(onlineSeatCount);$('#picks').style.setProperty?.('--online-seats',onlineSeatCount);renderPick();sendProfile();}
window.onlineSeatCountChanged=setOnlineSeatCount;
touchDevice.addEventListener('change',()=>{if(touchDevice.matches&&onlineSeatCount>1&&['lobby','countdown'].includes(roomState?.phase))setOnlineSeatCount(1);});
window.changeOnlineParty=delta=>{
 const max=Math.min(4,8-(roomState?.players.length-onlineSeatCount||0));
 setOnlineSeatCount(Math.max(1,Math.min(max,onlineSeatCount+delta)));
};
$('#start').onclick=()=>{if(assetsLoaded)send({type:'ready',ready:!roomState?.players.find(p=>playerOwner(p)===roomState.you)?.ready});};
$('#track').onchange=()=>{updateMapDescription();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
$('#vehicle').onchange=()=>{describeVehicle();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
togglePause=()=>{if(mode!=='race')return;paused=!paused;keysClear();sendInput();$('#overlay').hidden=!paused;if(paused)showPauseMenu();};
activateAbility=car=>{const slot=(window.onlineIndices||[]).indexOf(car?.i);if(slot>=0)sendInput(slot);};
garage=()=>{
  if(mode==='race'||mode==='result'){keysClear();paused=false;$('#overlay').hidden=true;send({type:'return-garage'});return;}
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);send({type:'leave-room'});
};
$('#menu').onclick=garage;
function controls(){if(paused)return [false,false];return [!!(keys.KeyW||keys.KeyD||keys.ArrowUp||keys.ArrowRight||keys.TouchGas),!!(keys.KeyS||keys.KeyA||keys.ArrowDown||keys.ArrowLeft||keys.TouchBrake)];}
function sendInput(abilitySlot=-1){
 if(!window.onlineActive)return;
 const seats=(window.onlineIndices||[]).map((index,slot)=>{const [gas,brake]=controlsForSeat(slot),car=localCars.get(index);if(abilitySlot===slot&&car&&!paused)localAbilityAction(car);return {slot,gas,brake,ability:abilitySlot===slot&&!paused};});
 send({type:'input',seats});
}
addEventListener('keydown',e=>{if(!window.onlineActive||e.target.matches('select,input,textarea'))return;if(e.code==='Space'&&!e.repeat)sendInput(0);sendInput();});
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
    if(control==='ability'){if(window.onlineActive)sendInput(0);else activateAbility(cars[0]);}
    else applyTouchInput();
  });
  const release=e=>{if(!touchPointers.delete(e.pointerId))return;applyTouchInput();};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
let movementStarted=false,touchHintTime=0;
window.resetTouchHints=()=>{movementStarted=false;touchHintTime=0;touch.classList.remove('hints-faded');};
window.updateTouchHints=dt=>{
 if(mode!=='race'){window.resetTouchHints();return;}
 const own=cars[(window.onlineIndices||[])[0]??window.onlineIndex??0];
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
  if(paused&&roomState.phase==='race'){sendPose();return;}
  if(roomState.phase==='countdown'){count=Math.max(0,(roomState.startAt-(Date.now()+clockOffset))/1000);return;}
  count=0;
  if(connectionLost&&mode==='race'&&localCars.size&&window.onlineIndices?.length===1&&roomState.racers.length===1){
    const index=window.onlineIndices[0],owned=localCars.get(index);
    cars[index]=Object.assign(cars[index]||{},owned);
    window.localGameHooks.update(dt);
    Object.assign(owned,cars[index]);localCar=owned;localSimTime+=dt;sendPose();
    return;
  }
  if(mode==='race'&&snapshots.length){
    const now=performance.now(),elapsed=now-snapshotReceived;
    const target=renderTarget=Math.max(renderTarget,(serverToLocal===null?roomState.serverNow+elapsed:now-serverToLocal)-interpolationDelay);
    let left=snapshots[0],right=left;
    for(const snapshot of snapshots){if(snapshot.serverNow<=target)left=snapshot;else{right=snapshot;break;}right=left;}
    const mix=right.serverNow>left.serverNow?Math.max(0,Math.min(1,(target-left.serverNow)/(right.serverNow-left.serverNow))):0;
    cars=roomState.game.cars.map((latest,i)=>{
      const car=cars[i]||{},a=left.game.cars[i]||latest,b=right.game.cars[i]||a;
      const owned=localCars.get(i);
      if(owned){
        owned.prevX=owned.x;owned.prevY=owned.y;
        localPhysicsStep(owned,dt,controlsForSeat((window.onlineIndices||[]).indexOf(i)));Object.assign(car,owned);
      }else{
        Object.assign(car,latest);
        for(const field of ['x','y','a','wheel'])car[field]=a[field]+(b[field]-a[field])*mix;
        // A short missing packet should not freeze a moving opponent; bound drift.
        const ahead=Math.max(0,Math.min(.15,(target-right.serverNow)/1000));
        if(b.alive){car.x+=b.vx*ahead;car.y+=b.vy*ahead;car.a+=b.av*ahead;car.wheel+=b.vx*ahead/17;}
        // A server snapshot can repeat an old pose. Interpolate only fresh owner samples.
        Object.assign(car,remotePose(i,target-40,car),{alive:latest.alive,reason:latest.reason});
        const racer=roomState.racers[i],direct=window.peerTransport.pose(racer?.owner,racer?.slot||0);
        if(direct&&latest.alive)Object.assign(car,direct,{alive:latest.alive,reason:latest.reason});
      }
      return car;
    });
    if((window.onlineIndices||[]).length)updateHillBridges(dt);
    localSimTime+=dt;localCar=localCars.get(window.onlineIndices?.[0])||null;
    renderWorld(left,right,mix,Math.max(0,Math.min(.15,(target-right.serverNow)/1000)));
    sendPose();
  }
  if(mode==='race'){
    const own=(window.onlineIndices||[]).map(i=>cars[i]).filter(c=>c?.alive);
    const active=own.length?own:cars.filter(c=>c.alive);
    if(active.length)updateCamera(active,dt);
  }
};
function installGame(state){
  if(!state.game)return;
  const g=state.game;
  const newRound=onlineRound!==state.round;
  if(newRound){window.resetTouchHints();onlineRound=state.round;cam=0;zoom=1;cameraY=0;particles=[];snapshots=[];renderTarget=-Infinity;localCar=null;localCars.clear();poseSequence=0;lastPoseSent=-Infinity;seenRewards.clear();resetHillBridges();keysClear();setWorldSeed(g.seed);}
  const received=performance.now();
  if(newRound){remoteFrames.clear();lastPacketAt=0;interpolationDelay=70;}
  for(let i=0;i<g.cars.length;i++){
   const sample=state.carPoses?.[i];if(!sample?.seq||!Number.isFinite(sample.at))continue;
   const frames=remoteFrames.get(i)||[];
   if(frames.length&&sample.seq<=frames.at(-1).seq)continue;
   frames.push({seq:sample.seq,at:sample.at,pose:{...g.cars[i]}});
   if(frames.length>24)frames.shift();remoteFrames.set(i,frames);
  }
  poseSequence=Math.max(poseSequence,...(state.poseSequences||[state.poseSequence||0]));
  if(lastPacketAt)interpolationDelay+=(Math.max(60,Math.min(140,(received-lastPacketAt)*1.5))-interpolationDelay)*.1;
  lastPacketAt=received;snapshotReceived=received;snapshots.push(state);if(snapshots.length>12)snapshots.shift();
  window.racerNames=state.racers.map((p,i)=>p.name||'Игрок '+(i+1));
  colors.splice(0,colors.length,...state.racers.map(p=>p.color));
  chosen.splice(0,chosen.length,...state.racers.map(p=>p.character));
  abilities.splice(0,abilities.length,...state.racers.map(p=>p.ability));
  state.racers.forEach((_,i)=>abilityKeys[i]=['E','правый Shift','СКМ','U'][i]||'');
  window.onlineIndices=state.racers.map((p,i)=>playerOwner(p)===state.you?i:-1).filter(i=>i>=0);window.onlineIndex=window.onlineIndices[0]??-1;
  track=g.track;vehicleModel=g.vehicle;snowStart=g.snowStart;snowEnd=g.snowEnd;
  if(newRound)time=g.time;
  // Keep object identities so suspension smoothing survives incoming packets.
  if(newRound||state.phase==='result'){
   if(state.phase==='result')localCars.clear();
   cars=g.cars.map((c,i)=>Object.assign(cars[i]||{},c));
   bonus=g.bonus.map(crate=>({...crate}));hillBridgeStates.clear();
   for(const bridge of g.bridges||[])hillBridgeStates.set(bridge.a,{...bridge,q:[...bridge.q],v:[...bridge.v]});
   if(state.phase==='result')time=g.time;
  }
  count=0;
  mode=state.phase==='result'?'result':'race';if(newRound||state.phase==='result')paused=false;
  if(state.phase==='race')installLocalCar(state);
  $('#lobby').hidden=true;$('#foot').hidden=true;$('#hud').hidden=false;
  touch.hidden=state.phase!=='race'||!state.racers.some(p=>playerOwner(p)===state.you);
  if(state.phase==='race'&&!paused)$('#overlay').hidden=true;
}
function renderRoom(state){
  roomUI.state(state);
  track=state.track;vehicleModel=state.vehicle;
  const owned=state.players.filter(p=>playerOwner(p)===state.you).sort((a,b)=>(a.slot??0)-(b.slot??0));
  $('#lobby').dataset.party=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);
  $('#add-local-racer').hidden=true;$('#remove-local-racer').hidden=true;
  const ready=state.players.filter(p=>p.ready).length;
  const spectator=state.phase==='race'&&!state.racers.some(p=>playerOwner(p)===state.you);
  onlineBar.textContent=`На сайте: ${state.online} · В гонке: ${state.inRace} · Готовы: ${ready}/${state.players.length}${spectator?' · Вы наблюдаете':''}`;
  const kickedOwners=new Set();roomPanel.querySelector('.room-list').innerHTML=state.players.map((p,i)=>{const owner=playerOwner(p),canKick=state.room.host===state.you&&owner!==state.you&&!kickedOwners.has(owner);if(canKick)kickedOwners.add(owner);return `<div><span class="room-player-name" ${owner===state.you?'title="На этом устройстве"':''}>${owner===state.room.host?'♛ ':''}${escapeLabel(p.name||'Игрок '+(i+1))}</span><b>${p.online===false?'Не в сети':p.ready?'✓ Готов':'В комнате'}</b>${canKick?`<button class="kick-player" type="button" data-kick-player="${escapeLabel(owner)}" aria-label="Удалить ${escapeLabel(p.name||'игрока')} из комнаты" title="Удалить из комнаты">${menuIcon('kick')}</button>`:''}</div>`;}).join('');
  $('#track').value=state.track;$('#vehicle').value=state.vehicle;
  $('#track').disabled=$('#vehicle').disabled=state.phase!=='lobby'||state.room.host!==state.you;
  $('#picks').querySelectorAll('select,[data-char-seat]').forEach(control=>control.disabled=!['lobby','countdown'].includes(state.phase));
  $('#picks').querySelectorAll('[data-add-seat]').forEach(control=>control.disabled=state.phase!=='lobby'||state.players.length>=8);
  $('#picks').querySelectorAll('.remove-seat').forEach(control=>control.disabled=state.phase!=='lobby');
  updateMapDescription();describeVehicle();
  $('#start').disabled=state.phase==='race';
  const myReady=state.players.find(p=>playerOwner(p)===state.you)?.ready;
  $('#start').textContent=state.phase==='countdown'?'СТАРТ ЧЕРЕЗ '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' С · ОТМЕНИТЬ':myReady?'ОТМЕНИТЬ ГОТОВНОСТЬ':'ГОТОВО';
  $('#menu').disabled=false;$('#menu').textContent='Выйти из комнаты';$('#pause').hidden=state.phase!=='race';
  if(state.phase==='lobby'){
    onlineRound=-1;localCar=null;localCars.clear();
    mode='lobby';count=0;snapshots=[];renderTarget=-Infinity;$('#lobby').hidden=false;$('#foot').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;
    $('#room-status').textContent='Готовы '+ready+' из '+state.players.length;
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
  socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?session='+connectionSession);
  socket.onopen=()=>{serverToLocal=null;bestRtt=Infinity;lastPacketAt=0;sendProfile();const code=roomState?.room.code||new URL(location.href).searchParams.get('room');if(/^[A-Z]{5}$/i.test(code||''))send({type:'join-room',code});send({type:'ping',sent:performance.now()});};
  socket.onmessage=e=>{
    const state=JSON.parse(e.data);
  if(state.type==='room-left'){roomState=null;selfRoomRequested=state.reason!=='left';window.peerTransport.reset();const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);roomExitNotice=state.reason==='kicked'?'Ведущий удалил вас из комнаты.':'Вы вышли из комнаты.';return;}
  if(state.type==='directory'){if(roomState?.room){roomUI.updateDirectory(state);return;}roomUI.directory(state);const requested=new URL(location.href).searchParams.get('room');if(!requested&&!selfRoomRequested){selfRoomRequested=true;send({type:'create-room',track:+$('#track').value,vehicle:+$('#vehicle').value});sendProfile();}if(roomExitNotice)$('#directory-notice').textContent=roomExitNotice;return;}
    if(state.type==='chat'){roomUI.chat(state.messages);return;}
    if(state.type==='notice'){roomUI.notice(state.text);return;}
    if(state.type==='signal'){window.peerTransport.signal(state);return;}
    if(state.type==='peer-probe'){window.peerTransport.relay(state);return;}
    if(state.type==='pong'){
      const now=performance.now(),rtt=now-state.sent;
      if(rtt>=0&&rtt<10000){recentRtts.push(rtt);if(recentRtts.length>9)recentRtts.shift();lastPongAt=now;}
      if(rtt>=0&&rtt<=bestRtt*1.2){bestRtt=Math.min(bestRtt,rtt);serverToLocal=(state.sent+now)/2-state.serverNow;}
      return;
    }
    if(state.type!=='state')return;
    clockOffset=state.serverNow-Date.now();
    const joined=!roomState||state.room.code!==roomState.room?.code;
    const changed=joined||JSON.stringify([state.phase,state.players,state.track,state.vehicle,state.room,state.inRace])!==JSON.stringify([roomState.phase,roomState.players,roomState.track,roomState.vehicle,roomState.room,roomState.inRace]);
    roomState=state;roomExitNotice='';lastStateReceived=performance.now();connectionLost=false;installGame(state);refreshConnectionIndicator();
    window.peerTransport.update(state);
    if(joined){if(state.room.host!==state.you){const owned=state.players.filter(p=>playerOwner(p)===state.you).length;onlineSeatCount=Math.max(1,Math.min(onlineSeatCount,8-(state.players.length-owned)));$('#lobby').dataset.party=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);renderPick();}sendProfile();}
    const seconds=state.phase==='countdown'?Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000)):-1;
    if(changed||seconds!==renderedCountdown)renderRoom(state);
    renderedCountdown=seconds;
  };
  socket.onclose=()=>{connectionLost=true;if(mode!=='race'){$('#start').disabled=true;touch.hidden=true;}refreshConnectionIndicator();if(window.onlineActive){onlineBar.textContent='Связь потеряна. Идёт переподключение…';reconnectTimer=setTimeout(connect,1500);}};
  socket.onerror=()=>socket.close();
}
window.onlineGameHooks={update,input,activateAbility,togglePause,garage,start:$('#start').onclick,trackChange:$('#track').onchange,vehicleChange:$('#vehicle').onchange};
window.onlineSession={
 enter(){selfRoomRequested=false;const url=new URL(location.href);if(url.searchParams.has('room')&&url.searchParams.get('mode')!=='online'){url.searchParams.delete('room');history.replaceState({},'',url);}roomPanel.hidden=false;onlineBar.hidden=true;renderPick();$('#players').closest('label').hidden=true;roomUI.browser.hidden=false;$('#lobby').hidden=false;window.assetsReady.then(connect);},
 leaveRoom(){send({type:'leave-room'});},
 exit(){send({type:'leave-room'});clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.onmessage=null;socket.onopen=null;socket.onerror=null;socket.close();}roomState=null;localCar=null;onlineRound=-1;oldPhase='';window.peerTransport.reset();roomUI.hide();roomPanel.hidden=true;onlineBar.hidden=true;},
};
setInterval(()=>{if(window.onlineActive){window.peerTransport.probe();const status=$('#connection-status');if(status)status.textContent=window.peerTransport.summary();refreshConnectionIndicator();}},1000);
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
