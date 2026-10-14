'use strict';
const modeQuery=new URLSearchParams(location.search);
let selectedMode=modeQuery.has('local')?'local':modeQuery.get('mode')||(modeQuery.has('room')?'online':null);
const modeButton=document.createElement('button');modeButton.id='mode-button';modeButton.textContent='Режим игры';
document.querySelector('nav').prepend(modeButton);
const installButton=document.createElement('button');installButton.id='install-app';installButton.textContent='Установить';document.querySelector('nav').append(installButton);
const cardTools=document.createElement('div');cardTools.className='card-tools';cardTools.append(modeButton,$('#sound'),installButton);window.cardTools=cardTools;$('#lobby').append(cardTools);
const chooser=document.createElement('main');chooser.id='mode-picker';chooser.hidden=true;
chooser.innerHTML='<div class="eyebrow">MIREA RACING</div><h1>Выберите режим</h1><div class="mode-options"><a class="mode-card" href="?mode=online"><span>🌐</span><h2>Онлайн</h2><p>Создавайте комнаты, находите друзей в своей сети или присоединяйтесь по коду.</p><b>Найти гонку →</b></a><a class="mode-card" href="?mode=local"><span>🏁</span><h2>Обычная игра</h2><p>Соло или до трёх игроков на одном устройстве. Доступна без интернета после первой загрузки.</p><b>В гараж →</b></a></div>';
document.body.append(chooser);
let currentMode=null;
let savedLocal={colors:[...colors],chosen:[...chosen],abilities:[...abilities],playerCount,track:+$('#track').value,vehicle:+$('#vehicle').value};
function chooseMode(next,push=true){
 if(!['online','local'].includes(next))next=null;
 if(currentMode===next&&currentMode!==undefined)return;
 const apply=()=>{
  if(currentMode==='local')savedLocal={colors:[...colors],chosen:[...chosen],abilities:[...abilities],playerCount,track:+$('#track').value,vehicle:+$('#vehicle').value};
  window.onlineActive=false;window.onlineSession.exit();
  mode='lobby';count=0;time=0;cam=0;zoom=1;cameraY=0;cars=[];bonus=[];particles=[];keysClear();resetHillBridges();window.onlineIndex=undefined;
  currentMode=selectedMode=next;
  document.body.classList.toggle('online',next==='online');document.body.classList.toggle('local',next==='local');document.body.classList.toggle('choosing',next===null);
  const hooks=next==='online'?window.onlineGameHooks:window.localGameHooks;
  update=hooks.update;input=hooks.input;activateAbility=hooks.activateAbility;togglePause=hooks.togglePause;garage=hooks.garage;
  start=next==='local'?()=>{if(assetsLoaded)window.localGameHooks.start();}:window.localGameHooks.start;
  $('#start').onclick=next==='online'?hooks.start:start;$('#track').onchange=hooks.trackChange;$('#vehicle').onchange=()=>{hooks.vehicleChange();if(next==='local')vehicleModel=+$('#vehicle').value;};
  $('#menu').onclick=garage;$('#pause').onclick=togglePause;$('#pause').hidden=next!=='local';$('#menu').hidden=next!=='local';$('#menu').disabled=false;$('#menu').textContent='Гараж';
  $('#overlay').hidden=true;$('#hud').hidden=true;$('#touch-controls').hidden=true;$('#foot').hidden=true;chooser.hidden=next!==null;
  $('#lobby').hidden=next!=='local';$('#players').closest('label').hidden=next==='online';
  document.querySelector('header>div').textContent=next==='online'?'ОНЛАЙН-КОМНАТЫ':next==='local'?'ОБЫЧНАЯ ИГРА':'ГОНКИ ПО ХОЛМАМ';
  modeButton.textContent=next==='online'?'Играть на одном устройстве':'Играть онлайн';
  (next==='online'?$('#room-browser'):next==='local'?$('#lobby'):chooser).append(cardTools);
  document.title='Mirea Racing'+(next==='online'?' · Онлайн':next==='local'?' · Обычная игра':'');
  if(next==='local'){
   colors.splice(0,colors.length,...savedLocal.colors);chosen.splice(0,chosen.length,...savedLocal.chosen);abilities.splice(0,abilities.length,...savedLocal.abilities);playerCount=savedLocal.playerCount;
   $('#players').value=playerCount;document.body.dataset.players=playerCount;$('#track').value=savedLocal.track;$('#vehicle').value=savedLocal.vehicle;
   picks();vehicleModel=+$('#vehicle').value;$('#lobby h1').textContent='Обычная игра';$('#lobby .eyebrow').textContent='СОЛО ИЛИ ОДИН ЭКРАН';
   $('#lobby .intro').textContent='Выберите машину, трассу и персонажа.';$('#start').textContent='НА СТАРТ →';$('#start').disabled=!assetsLoaded;
   $('#track').disabled=$('#vehicle').disabled=false;$('#vehicle-description').hidden=false;$('#map-description').hidden=false;updateMapDescription();describeVehicle();
  }
  if(next==='online'){window.onlineActive=true;$('#vehicle-description').hidden=false;$('#map-description').hidden=false;window.onlineSession.enter();}
  window.refreshChoices?.();syncGameScreen();window.scrollTo(0,0);
  if(push){const url=new URL(location.href);url.searchParams.delete('local');if(next!=='online')url.searchParams.delete('room');if(next)url.searchParams.set('mode',next);else url.searchParams.delete('mode');history.pushState({},'',url);}
 };
 if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.startViewTransition(apply);else apply();
}
modeButton.onclick=()=>chooseMode(currentMode==='online'?'local':'online');
for(const link of chooser.querySelectorAll('a'))link.onclick=e=>{e.preventDefault();chooseMode(new URL(link.href).searchParams.get('mode'));};
addEventListener('popstate',()=>chooseMode(new URLSearchParams(location.search).get('mode'),false));
let installPrompt;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
installButton.onclick=async()=>{
 if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return;}
 let help=$('#install-help');if(!help){help=document.createElement('dialog');help.id='install-help';help.innerHTML='<h2>Игра на телефоне</h2><p><b>Android:</b> Chrome → меню → «Установить приложение».</p><p><b>iPhone:</b> Safari → «Поделиться» → «На экран Домой».</p><button>Понятно</button>';document.body.append(help);help.querySelector('button').onclick=()=>help.close();}help.showModal();
};
if(matchMedia('(display-mode: standalone)').matches)installButton.hidden=true;
addEventListener('appinstalled',()=>{installButton.hidden=true;installPrompt=null;});
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('/sw.js').then(reg=>reg.update()).catch(()=>{});
let appVersion;
setInterval(async()=>{if(window.onlineActive||location.protocol==='file:')return;try{const health=await fetch('/health',{cache:'no-store'}).then(r=>r.json());if(appVersion&&health.version!==appVersion){if(mode!=='race')location.reload();return;}appVersion=health.version;}catch{}},5000);
currentMode=undefined;chooseMode(location.protocol==='file:'?'local':selectedMode,false);
window.gameDebug.start=()=>start();
window.assetsReady.then(()=>{if(currentMode==='local')$('#start').disabled=false;});
