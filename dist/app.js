'use strict';
const modeQuery=new URLSearchParams(location.search);
const selectedMode=modeQuery.has('local')?'local':modeQuery.get('mode');
const modeButton=document.createElement('button');modeButton.id='mode-button';modeButton.textContent='Режим игры';
modeButton.onclick=()=>location.href=location.pathname;
document.querySelector('nav').prepend(modeButton);
const installButton=document.createElement('button');installButton.id='install-app';installButton.textContent='Установить';
document.querySelector('nav').append(installButton);
let installPrompt;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
installButton.onclick=async()=>{
  if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return;}
  let help=document.querySelector('#install-help');
  if(!help){help=document.createElement('dialog');help.id='install-help';help.innerHTML='<h2>Игра на телефоне</h2><p><b>Android:</b> открой игру в Chrome и выбери в меню «Установить приложение» или «Добавить на главный экран».</p><p><b>iPhone:</b> открой игру в Safari → «Поделиться» → «На экран Домой».</p><p>Значок игры появится рядом с приложениями. Обычный режим работает и без интернета после первой загрузки.</p><button id="close-install">Понятно</button>';document.body.append(help);help.querySelector('button').onclick=()=>help.close();}
  help.showModal();
};
if(matchMedia('(display-mode: standalone)').matches)installButton.hidden=true;
addEventListener('appinstalled',()=>{installButton.hidden=true;installPrompt=null;});
if(location.protocol==='file:'||selectedMode==='local'){
  document.title='Hill Rivals · Обычная игра';
  document.body.classList.add('local');modeButton.textContent='Обычный · сменить';
}else if(selectedMode==='online'){
  modeButton.textContent='Онлайн · сменить';
  const script=document.createElement('script');script.src='online.js';document.body.append(script);
}else{
  document.body.classList.add('choosing');
  const chooser=document.createElement('main');chooser.id='mode-picker';
  chooser.innerHTML='<div class="eyebrow">ВЫБЕРИ СВОЮ ГОНКУ</div><h1>Держи газ.<br><em>С друзьями или дома.</em></h1><div class="mode-options"><a class="mode-card" href="?mode=online"><span>🌐</span><h2>Онлайн</h2><p>С разных телефонов и компьютеров. Любой нажимает «Готово» — через 10 секунд общий старт.</p><b>В общую комнату →</b></a><a class="mode-card" href="?mode=local"><span>🏁</span><h2>Обычная игра</h2><p>Три гонщика на одном устройстве. Знакомые машины, трассы и способности. Можно играть без интернета.</p><b>В гараж →</b></a></div><p class="hint">Установи игру на телефон кнопкой «Установить» вверху.</p>';
  document.body.append(chooser);
}
if('serviceWorker' in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('/sw.js').then(reg=>reg.update()).catch(()=>{});
}
