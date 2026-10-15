import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3129'},stdio:['ignore','pipe','inherit']});let browser;
try{
 await new Promise(r=>server.stdout.once('data',r));browser=await chromium.launch(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let release;const held=new Promise(r=>release=r);await page.route('**/assets/hills-panorama.png',async route=>{await held;await route.continue();});
 await page.goto('http://localhost:3129/?mode=local',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof hillBackdrop!=='undefined'&&hillBackdrop?.panorama===null);
 // Firefox can expose image dimensions before the download completes.
 await page.evaluate(()=>{Object.defineProperties(hillPanorama,{naturalWidth:{value:1536,configurable:true},naturalHeight:{value:1024,configurable:true}});prepareHillBackground();});release();await page.waitForFunction(()=>assetsLoaded);
 const result=await page.evaluate(()=>{
  delete hillPanorama.naturalWidth;delete hillPanorama.naturalHeight;start();paused=true;count=0;cam=0;cameraY=0;zoom=1;time=1;draw();
  const layer=key=>document.querySelector('[data-layer-key="'+key+'"]'),position=key=>new DOMMatrix(layer(key).style.transform).e;
  const panorama=layer('panorama:0'),cloud=layer('cloud:1'),far=position('depth:0:0'),near=position('depth:1:0'),distant=position('panorama:0');
  cam=100;draw();const shifts=[position('panorama:0')-distant,position('depth:0:0')-far,position('depth:1:0')-near];
  cam=3000;draw();const sameCloud=cloud===layer('cloud:1');
  for(let j=0;j<12;j++){cam=j*2000;draw();}
  const retained=document.querySelectorAll('#scene-layers [data-layer-key]').length;
  cam=0;draw();bonus=[newCrate(510,0),newCrate(720,2)];bonus.forEach((b,j)=>{b.y=terrain(b.x)-150-j*90;});draw();
  return {restored:!!hillBackdrop.panorama,visible:panorama.width>0,shifts,sameCloud,retained,stack:+layer('panorama:0').style.zIndex<+layer('cloud:1').style.zIndex};
 });
 assert.ok(result.restored&&result.visible,'late panorama replaces the cached empty background');assert.ok(result.sameCloud,'surviving clouds retain the same compositor node across tile boundaries');assert.ok(result.retained<70,'offscreen planes are removed');assert.ok(result.stack,'clouds stay in front of a late panorama');
 for(const [i,expected] of [-5.5,-16,-32].entries())assert.ok(Math.abs(result.shifts[i]-expected)<.01,'independent parallax speeds');
 if(process.env.SCENE_SCREENSHOT)await page.screenshot({path:process.env.SCENE_SCREENSHOT});
 assert.deepEqual(errors,[]);console.log('PASS: late panorama loading, cloud identity, layer order, three parallax speeds, bounded offscreen layers.');
}finally{await browser?.close();server.kill();}
