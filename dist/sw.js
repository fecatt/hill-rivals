const CACHE='hill-rivals-app-v50';
const FILES=['/','/game.bundle.js','/game.css','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png',...['Егерь','Вышня','Голубой','Комунистичкий','Нинглеб','Рэп_зеленный','Синяк'].map(n=>'/assets/'+encodeURIComponent(n)+'.webp')];
FILES.push(...['environment-atlas','hills-atlas','hills-oak-clean','hills-birch-clean','hills-crest-sun','hills-cloud-clean','car-jeep-open-arches','car-buggy','car-pickup','car-rally','car-monster','car-hotrod','car-rocket','car-van','car-evo'].map(name=>'/assets/'+name+'.webp'));
FILES.push(...['far','middle','near'].flatMap(layer=>[0,1,2].map(index=>'/assets/hills-'+layer+'-'+index+'.webp')));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hill-rivals-app-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||['/health','/ws','/github-webhook'].includes(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const key=event.request.mode==='navigate'?'/':event.request;
    // Decoded assets have already been preloaded; reuse the persistent cache.
    if(url.pathname.startsWith('/assets/')&&!url.searchParams.has('_asset_retry')){const cached=await cache.match(event.request);if(cached)return cached;}
    try{
      const response=await fetch(event.request);
      if(response.ok)await cache.put(key,response.clone());
      return response;
    }catch{
      return await cache.match(key)||new Response('Нет сети. Открой обычный режим после первой загрузки игры.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
