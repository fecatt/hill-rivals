'use strict';
document.body.classList.add('online');
let socket,roomState=null,onlineRound=-1,clockOffset=0,oldPhase='',reconnectTimer;
const onlineBar=document.createElement('div');onlineBar.id='online-bar';onlineBar.setAttribute('aria-live','polite');document.body.append(onlineBar);
const roomPanel=document.createElement('section');roomPanel.id='room-panel';$('#picks').after(roomPanel);
const touch=document.createElement('div');touch.id='touch-controls';touch.hidden=true;touch.innerHTML='<button data-control="brake">ТОРМОЗ</button><button data-control="ability">СПОСОБНОСТЬ</button><button data-control="gas">ГАЗ</button>';document.body.append(touch);
document.title='Hill Rivals · Онлайн-гонка';
$('header>div').textContent='ONLINE MULTIPLAYER';
$('.eyebrow').textContent='ОБЩАЯ КОМНАТА. ОДИН ПОБЕДИТЕЛЬ.';
$('.intro').textContent='Выбери персонажа. Кто-то нажимает «Готово» — через 10 секунд все в комнате начинают гонку!';
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
$('#start').onclick=()=>send({type:'ready',ready:true});
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
function sendInput(ability=false){const [gas,brake]=controls();send({type:'input',gas,brake,ability});}
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
// Physics comes only from the server. Camera remains local to fit each screen.
update=dt=>{
  if(!roomState)return;
  if(roomState.phase==='countdown'){count=Math.max(0,(roomState.startAt-(Date.now()+clockOffset))/1000);return;}
  count=0;
  if(mode==='race'){
    const own=cars[roomState.racers.findIndex(p=>p.id===roomState.you)];
    const active=own?.alive?[own]:cars.filter(c=>c.alive);
    if(active.length)updateCamera(active,dt);
  }
};
function installGame(state){
  if(!state.game)return;
  const g=state.game;
  if(onlineRound!==state.round){onlineRound=state.round;cam=0;zoom=1;cameraY=0;particles=[];keysClear();}
  colors.splice(0,colors.length,...state.racers.map(p=>p.color));
  chosen.splice(0,chosen.length,...state.racers.map(p=>p.character));
  abilities.splice(0,abilities.length,...state.racers.map(p=>p.ability));
  state.racers.forEach((_,i)=>abilityKeys[i]='E / пробел');
  window.onlineIndex=state.racers.findIndex(p=>p.id===state.you);
  setWorldSeed(g.seed);track=g.track;vehicleModel=g.vehicle;time=g.time;snowStart=g.snowStart;snowEnd=g.snowEnd;
  // Keep object identities so suspension smoothing survives incoming packets.
  cars=g.cars.map((c,i)=>Object.assign(cars[i]||{},c));bonus=g.bonus;count=0;
  mode=state.phase==='result'?'result':'race';paused=false;
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
  $('#start').disabled=['race','countdown'].includes(state.phase);
  $('#start').textContent=state.phase==='countdown'?'СТАРТ ЧЕРЕЗ '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' С':'ГОТОВО';
  $('#menu').disabled=['race','countdown'].includes(state.phase);
  if(state.phase==='lobby'){
    mode='lobby';count=0;$('#lobby').hidden=false;$('#foot').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;
    $('#room-status').textContent='Любой может выбрать трассу и машину. Нажми «Готово», чтобы запустить гонку для всех.';
  }
  if(state.phase==='countdown'){
    $('#room-status').textContent='До общего старта: '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' с. Все, кто в комнате, участвуют!';
    mode='lobby';$('#lobby').hidden=false;$('#overlay').hidden=true;
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
  socket.onopen=()=>{sendProfile();};
  socket.onmessage=e=>{
    const state=JSON.parse(e.data);if(state.type!=='state')return;
    clockOffset=state.serverNow-Date.now();
    const changed=!roomState||JSON.stringify([state.phase,state.players,state.track,state.vehicle,state.host,state.inRace])!==JSON.stringify([roomState.phase,roomState.players,roomState.track,roomState.vehicle,roomState.host,roomState.inRace]);
    roomState=state;installGame(state);
    if(changed||state.phase==='countdown')renderRoom(state);
  };
  socket.onclose=()=>{keysClear();$('#start').disabled=true;touch.hidden=true;onlineBar.textContent='Связь потеряна. Переподключаемся…';roomState=null;oldPhase='';reconnectTimer=setTimeout(connect,1500);};
  socket.onerror=()=>socket.close();
}
connect();
let deployedVersion;
setInterval(async()=>{
  try{const state=await fetch('/health',{cache:'no-store'}).then(r=>r.json());
    if(deployedVersion&&deployedVersion!==state.version){
      if(roomState?.phase==='race'){onlineBar.textContent+=' · Доступно обновление после гонки';return;}
      location.reload();
    }deployedVersion=state.version;
  }catch{}
},5000);
