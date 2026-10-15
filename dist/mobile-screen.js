'use strict';
window.populatePauseSettings=panel=>{
 panel.replaceChildren();
 const audioButton=document.createElement('button');audioButton.textContent=$('#sound').textContent;audioButton.onclick=()=>{$('#sound').click();audioButton.textContent=$('#sound').textContent;};panel.append(audioButton);
};
document.addEventListener('pointerdown',e=>{const panel=$('#pause-settings');if(panel&&!panel.hidden&&!panel.contains(e.target)&&!e.target.closest('#pause-settings-toggle'))panel.hidden=true;});
const localSettingsButton=document.createElement('button');localSettingsButton.id='local-settings-button';localSettingsButton.textContent='Настройки';
const localOptions=document.createElement('div');localOptions.id='local-options';localOptions.hidden=true;
localSettingsButton.onclick=()=>{localOptions.hidden=!localOptions.hidden;};
window.refreshMobileSettings=()=>{
 if(currentMode==='local'){
  if(localSettingsButton.parentElement!==window.cardTools)window.cardTools.append(localSettingsButton,localOptions);
  for(const button of [$('#sound'),$('#install-app')])if(button.parentElement!==localOptions)localOptions.append(button);
 }else{
  for(const button of [$('#sound'),$('#install-app')])if(button.parentElement===localOptions)window.cardTools.append(button);
  localSettingsButton.remove();localOptions.remove();localOptions.hidden=true;
 }
};
document.addEventListener('pointerdown',e=>{if(!localOptions.hidden&&!localOptions.contains(e.target)&&!localSettingsButton.contains(e.target))localOptions.hidden=true;});

// Fit one fixed landscape composition into the visible browser area as a whole.
// Cards never change their internal tracks when Android chrome opens or collapses.
const compactGarageMedia=matchMedia('(pointer:coarse) and (orientation:landscape) and (min-width:700px)');
function fitCompactGarage(){
 const lobby=$('#lobby');if(!lobby)return;
 const viewport=window.visualViewport,width=viewport?.width||innerWidth;
 const keyboard=document.activeElement?.matches('input,textarea')&&viewport&&viewport.height<innerHeight*.75;
 const height=keyboard?innerHeight:(viewport?.height||innerHeight);
 const fitted=Math.min(1,(width-20)/1000,(height-20)/350);
 lobby.style.setProperty('--garage-fit',String(Math.max(.35,fitted)));
}
compactGarageMedia.addEventListener('change',fitCompactGarage);addEventListener('resize',fitCompactGarage);
window.visualViewport?.addEventListener('resize',fitCompactGarage);document.addEventListener('focusout',fitCompactGarage);fitCompactGarage();
