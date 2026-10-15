'use strict';
// Wait for the actual images used by the renderer, including browser decoding.
// Keep the same Image objects so the renderer never starts with empty textures.
let assetsLoaded=false;
const loadingScreen=document.createElement('div');loadingScreen.id='loading-screen';
loadingScreen.innerHTML='<section><h2>Загрузка игры</h2><p id="loading-status" role="status" aria-live="polite">Загружаем машины, персонажей и трассы…</p><progress id="loading-progress" max="1" value="0"></progress><button id="retry-loading" hidden>Повторить загрузку</button></section>';
document.body.append(loadingScreen);
const gameImages=[...images,environmentAtlas,hillArt,...(typeof hillLandscapeLayers==='undefined'?[]:hillLandscapeLayers.flatMap(layer=>layer.images)),...hillTrees,hillCrestSun,hillCloud,...Object.values(paintedBodies)];
function decodeAsset(im){
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>finish(Error('Время загрузки истекло')),45000);
  const finish=error=>{clearTimeout(timeout);im.removeEventListener('load',loaded);im.removeEventListener('error',failed);error?reject(error):resolve();};
  const loaded=()=>{if(!im.naturalWidth){failed();return;}im.decode().then(()=>finish(),finish);};
  const failed=()=>finish(Error('Не удалось загрузить текстуры'));
  if(im.complete&&im.naturalWidth){loaded();return;}
  im.addEventListener('load',loaded,{once:true});im.addEventListener('error',failed,{once:true});
  if(im.complete){const src=im.src;im.src='';im.src=src;}
 });
}
let resolveAssets;
window.assetsReady=new Promise(resolve=>resolveAssets=resolve);
async function loadGameAssets(){
 $('#retry-loading').hidden=true;let done=0;
 const results=await Promise.allSettled(gameImages.map(async im=>{await decodeAsset(im);$('#loading-progress').value=++done/gameImages.length;$('#loading-status').textContent=`Текстуры: ${done} / ${gameImages.length}`;}));
 if(results.some(r=>r.status==='rejected')){$('#loading-status').textContent='Не удалось загрузить все текстуры. Проверь соединение и повтори загрузку.';$('#retry-loading').hidden=false;return;}
 // Build the reusable scenery textures before racing rather than on the first frame.
 for(let i=0;i<hillTrees.length;i++)hillTexture(hillTrees[i],hillTreeBounds[i],512);
 hillTexture(hillCloud,hillCloudBounds,128);
 for(const crop of (typeof ENV_CROPS==='undefined'?[]:ENV_CROPS))hillTexture(environmentAtlas,crop,512);
 if(typeof prepareHillBackground==='function')prepareHillBackground();
 assetsLoaded=true;loadingScreen.remove();resolveAssets();
}
$('#retry-loading').onclick=loadGameAssets;
loadGameAssets();
