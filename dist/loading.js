'use strict';
// Wait for the actual images used by the renderer, including browser decoding.
// Keep the same Image objects so the renderer never starts with empty textures.
let assetsLoaded=false;
const loadingScreen=document.createElement('div');loadingScreen.id='loading-screen';
loadingScreen.innerHTML='<section><h2>Загрузка игры</h2><p id="loading-status" role="status" aria-live="polite">Загружаем машины, персонажей и трассы…</p><progress id="loading-progress" max="1" value="0"></progress><button id="retry-loading" hidden>Повторить загрузку</button></section>';
document.body.append(loadingScreen);
const gameImages=[...new Set([...images,environmentAtlas,hillArt,...(typeof hillLandscapeLayers==='undefined'?[]:hillLandscapeLayers.flatMap(layer=>layer.images)),...hillTrees,hillCrestSun,hillCloud,...Object.values(paintedBodies)])];
const decodedAssets=new Set();let failedAssets=new Set(),loadingAssets=false;
function decodeAsset(im,reload=false){
 return new Promise((resolve,reject)=>{
  let settled=false;const timeout=setTimeout(()=>finish(Error('Время загрузки истекло')),180000);
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);im.removeEventListener('load',loaded);im.removeEventListener('error',failed);error?reject(error):resolve();};
  const loaded=()=>{if(!im.naturalWidth){failed();return;}im.decode().then(()=>finish(),finish);};
  const failed=()=>finish(Error('Не удалось загрузить текстуры'));
  if((!reload||typeof im.src!=='string'||!im.src)&&im.complete&&im.naturalWidth){loaded();return;}
  im.addEventListener('load',loaded,{once:true});im.addEventListener('error',failed,{once:true});
  if(reload&&typeof im.src==='string'&&im.src){const url=new URL(im.src,location.href);url.searchParams.set('_asset_retry',String(Date.now()));im.src=url.href;return;}
  if(im.complete){const src=im.src;im.src='';im.src=src;}
 });
}
let resolveAssets;
window.assetsReady=new Promise(resolve=>resolveAssets=resolve);
async function loadGameAssets(){
 if(loadingAssets)return;loadingAssets=true;
 $('#retry-loading').hidden=true;$('#retry-loading').disabled=true;
 let done=decodedAssets.size;const previousFailures=failedAssets;failedAssets=new Set();
 $('#loading-status').textContent=`Текстуры: ${done} / ${gameImages.length}`;
 await Promise.allSettled(gameImages.filter(im=>!decodedAssets.has(im)).map(async im=>{try{await decodeAsset(im,previousFailures.has(im));decodedAssets.add(im);}catch(error){failedAssets.add(im);}finally{$('#loading-progress').value=++done/gameImages.length;$('#loading-status').textContent=`Текстуры: ${decodedAssets.size} / ${gameImages.length}`;}}));
 if(failedAssets.size){const names=[...failedAssets].slice(0,3).map(im=>{try{return decodeURIComponent((im.src||'изображение').split('/').pop().split('?')[0]);}catch{return 'изображение';}});$('#loading-status').textContent=`Не загрузились: ${names.join(', ')}${failedAssets.size>3?' и ещё '+(failedAssets.size-3):''}. Повторная загрузка скачает только недостающие файлы.`;$('#retry-loading').hidden=false;$('#retry-loading').disabled=false;loadingAssets=false;return;}
 // Build the reusable scenery textures before racing rather than on the first frame.
 for(let i=0;i<hillTrees.length;i++)hillTexture(hillTrees[i],hillTreeBounds[i],512);
 hillTexture(hillCloud,hillCloudBounds,128);
 for(const crop of (typeof ENV_CROPS==='undefined'?[]:ENV_CROPS))hillTexture(environmentAtlas,crop,512);
 if(typeof prepareHillBackground==='function')prepareHillBackground();
 assetsLoaded=true;if(typeof warmSelectedVehicle==='function')warmSelectedVehicle();loadingAssets=false;loadingScreen.remove();resolveAssets();
}
$('#retry-loading').onclick=loadGameAssets;
loadGameAssets();
