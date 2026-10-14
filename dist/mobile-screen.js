'use strict';
const fullscreenRoot=document.documentElement;
const requestGameScreen=fullscreenRoot.requestFullscreen||fullscreenRoot.webkitRequestFullscreen;
const fullscreenButton=document.createElement('button');fullscreenButton.id='fullscreen-button';fullscreenButton.type='button';
fullscreenButton.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>';
fullscreenButton.setAttribute('aria-label','На весь экран');fullscreenButton.title='На весь экран';fullscreenButton.hidden=!requestGameScreen;
document.querySelector('nav').prepend(fullscreenButton);
function gameIsFullscreen(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
async function openGameFullscreen(){
 if(!mobileInput.matches||!requestGameScreen||gameIsFullscreen())return;
 try{
  // Start/ready tap still holds the browser's required user activation.
  await requestGameScreen.call(fullscreenRoot,{navigationUI:'hide'});
  if(gameIsFullscreen()&&screen.orientation?.lock)await screen.orientation.lock('landscape').catch(()=>{});
 }catch{} // Unsupported browsers keep the ordinary game working.
}
fullscreenButton.onclick=async()=>{
 if(!gameIsFullscreen()){await openGameFullscreen();return;}
 try{await (document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch{}
};
document.addEventListener('click',e=>{
 const startButton=e.target.closest?.('#start,#again,#next-race');
 if(startButton&&!startButton.disabled)openGameFullscreen();
},true);
function fullscreenChanged(){
 keysClear();resize();
 const label=gameIsFullscreen()?'Выйти из полного экрана':'На весь экран';fullscreenButton.setAttribute('aria-label',label);fullscreenButton.title=label;
 if(!gameIsFullscreen())screen.orientation?.unlock?.();
}
document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('webkitfullscreenchange',fullscreenChanged);
