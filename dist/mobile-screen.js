'use strict';
const fullscreenRoot=document.documentElement;
const requestGameScreen=fullscreenRoot.requestFullscreen||fullscreenRoot.webkitRequestFullscreen;
const fullscreenButton=document.createElement('button');fullscreenButton.id='fullscreen-button';fullscreenButton.type='button';
fullscreenButton.textContent='На весь экран';fullscreenButton.setAttribute('aria-label','На весь экран');fullscreenButton.title='На весь экран';fullscreenButton.hidden=!requestGameScreen;
window.cardTools.append(fullscreenButton);
function gameIsFullscreen(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
async function openGameFullscreen(){
 if(!mobileInput.matches||!requestGameScreen||gameIsFullscreen())return;
 try{
  await requestGameScreen.call(fullscreenRoot,{navigationUI:'hide'});
  if(gameIsFullscreen()&&screen.orientation?.lock)await screen.orientation.lock('landscape').catch(()=>{});
 }catch{} // Unsupported browsers keep the ordinary game working.
}
fullscreenButton.onclick=async()=>{
 try{
  if(gameIsFullscreen())await (document.exitFullscreen||document.webkitExitFullscreen).call(document);
  else await openGameFullscreen();
 }catch{} // Unsupported browsers keep the ordinary game working.
};
function fullscreenChanged(){
 keysClear();resize();
 const label=gameIsFullscreen()?'Выйти из полного экрана':'На весь экран';fullscreenButton.setAttribute('aria-label',label);fullscreenButton.title=label;fullscreenButton.textContent=label;
 const pauseButton=$('#pause-fullscreen');if(pauseButton)pauseButton.textContent=label;
 if(!gameIsFullscreen())screen.orientation?.unlock?.();
}
document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('webkitfullscreenchange',fullscreenChanged);
document.addEventListener('click',e=>{
 const startButton=e.target.closest?.('#start,#again,#next-race');
 if(startButton&&!startButton.disabled&&!window.onlineActive)openGameFullscreen();
},true);
window.populatePauseSettings=panel=>{
 panel.replaceChildren();
 if(mobileInput.matches&&requestGameScreen){const full=document.createElement('button');full.id='pause-fullscreen';full.textContent=fullscreenButton.textContent;full.onclick=()=>fullscreenButton.click();panel.append(full);}
 const audioButton=document.createElement('button');audioButton.textContent=$('#sound').textContent;audioButton.onclick=()=>{$('#sound').click();audioButton.textContent=$('#sound').textContent;};panel.append(audioButton);
 if(window.onlineActive)window.appendConnectionSettings?.(panel);
};
document.addEventListener('pointerdown',e=>{const panel=$('#pause-settings');if(panel&&!panel.hidden&&!panel.contains(e.target)&&!e.target.closest('#pause-settings-toggle'))panel.hidden=true;});
const localSettingsButton=document.createElement('button');localSettingsButton.id='local-settings-button';localSettingsButton.textContent='Настройки';
const localOptions=document.createElement('div');localOptions.id='local-options';localOptions.hidden=true;
localSettingsButton.onclick=()=>{localOptions.hidden=!localOptions.hidden;};
window.refreshMobileSettings=()=>{
 if(currentMode==='local'){
  if(localSettingsButton.parentElement!==window.cardTools)window.cardTools.append(localSettingsButton,localOptions);
  for(const button of [$('#sound'),$('#install-app'),fullscreenButton])if(button.parentElement!==localOptions)localOptions.append(button);
 }else{
  for(const button of [$('#sound'),$('#install-app'),fullscreenButton])if(button.parentElement===localOptions)window.cardTools.append(button);
  localSettingsButton.remove();localOptions.remove();localOptions.hidden=true;
 }
};
document.addEventListener('pointerdown',e=>{if(!localOptions.hidden&&!localOptions.contains(e.target)&&!localSettingsButton.contains(e.target))localOptions.hidden=true;});

// Fit one fixed landscape composition into the visible browser area as a whole.
// Cards never change their internal tracks when Android chrome opens or collapses.
const compactGarageMedia=matchMedia('(pointer:coarse) and (orientation:landscape) and (min-width:700px)');
let compactGarageViewportHeight=window.visualViewport?.height||innerHeight;
function fitCompactGarage(){
 const lobby=$('#lobby');if(!lobby)return;
 const viewport=window.visualViewport,width=viewport?.width||innerWidth;
 const visibleHeight=viewport?.height||innerHeight,editingText=document.activeElement?.matches('input,textarea,[contenteditable="true"]');
 const keyboard=editingText&&visibleHeight<compactGarageViewportHeight*.82;
 if(!keyboard)compactGarageViewportHeight=visibleHeight;
 const height=keyboard?Math.max(compactGarageViewportHeight,innerHeight):visibleHeight;
 const fitted=Math.min(1,(width-20)/1000,(height-20)/350);
 lobby.style.setProperty('--garage-fit',String(Math.max(.35,fitted)));
}
window.fitCompactGarage=fitCompactGarage;
compactGarageMedia.addEventListener('change',fitCompactGarage);addEventListener('resize',fitCompactGarage);
window.visualViewport?.addEventListener('resize',fitCompactGarage);document.addEventListener('focusout',fitCompactGarage);fitCompactGarage();
