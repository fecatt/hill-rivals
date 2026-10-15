import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3146'},windowsHide:true,stdio:['ignore','pipe','inherit']});
let browser;
try{
 await new Promise(resolve=>server.stdout.once('data',resolve));
 browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||undefined});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2,serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:3146/?mode=local');await page.waitForFunction(()=>assetsLoaded);
 await page.evaluate(()=>{frame=()=>{};});await page.waitForTimeout(50);
 const result=await page.evaluate(()=>{
  const failures=[];let cases=0;
  // Compare the cached silhouette to the uncached authored drawing, including
  // the extreme driver placements allowed by the editor.
  for(let model=0;model<9;model++)for(const placement of [{x:0,y:0,scale:1},{x:-60,y:-60,scale:2.5},{x:60,y:60,scale:2.5},{x:0,y:0,scale:.3}])for(const density of [1,2,3]){
   const v=VEHICLES[model];driverAlignmentPreview={[v.kind]:placement};const c=newCar(0);c.model=model;
   const render=cached=>{const surface=document.createElement('canvas');surface.width=surface.height=600;const p=surface.getContext('2d',{willReadFrequently:true});p.translate(300,300);p.scale(density,density);withDrawingContext(p,()=>cached?vehicleBody(c,v,0,p):vehicleBodyRaw(c,v,0,p,v.mount));return p.getImageData(0,0,600,600).data;};
   const raw=render(false),cached=render(true);let missing=0;
   for(let i=3;i<raw.length;i+=4)if(raw[i]>200&&cached[i]<20){let covered=false;const pixel=(i-3)/4,x=pixel%600,y=Math.floor(pixel/600);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<600&&y+dy>=0&&y+dy<600&&cached[((y+dy)*600+x+dx)*4+3]>=20)covered=true;if(!covered)missing++;}
   if(missing)failures.push({model,placement,density,missing});cases++;
  }
  driverAlignmentPreview=null;mode='race';count=0;setWorldSeed(12345678);cars=[newCar(0)];
  // A cold cache must never cause synchronous pixel readback in the game loop.
  const read=CanvasRenderingContext2D.prototype.getImageData;
  try{
   CanvasRenderingContext2D.prototype.getImageData=()=>{throw Error('pixel readback inside renderer');};
   bodyRasterCache.clear();bodyRasterPixels=0;
   for(let t=0;t<7;t++)for(const x of [0,3000,30000,90000,150000]){track=t;cam=x;cars[0].x=x+400;cars[0].y=terrain(cars[0].x)-40;draw();}
  }finally{CanvasRenderingContext2D.prototype.getImageData=read;}
  const pixels=groundTilePixels,bodyPixels=bodyRasterPixels;
  setWorldSeed(87654321);track=3;cam=0;draw();const seedReset=groundTileSeed===worldSeed;
  track=0;cam=0;draw();const images=document.querySelectorAll('#scene-layers img').length;
  return {failures,cases,pixels,bodyPixels,seedReset,images};
 });
 assert.deepEqual(result.failures,[],'caching must not clip car bodies or drivers');
 assert.equal(result.cases,108);assert.ok(result.pixels<=24000000);assert.ok(result.bodyPixels<=12000000);assert.ok(result.seedReset);assert.ok(result.images>0,'panoramas share decoded images');assert.deepEqual(errors,[]);
 await page.goto(new URL('../PLAY.html',import.meta.url).href);await page.waitForFunction(()=>assetsLoaded&&currentMode==='local');await page.locator('#start').click();await page.waitForFunction(()=>mode==='race');assert.deepEqual(errors,[],'the unpacked game must also launch without a server');
 console.log('PASS: 108 vehicle silhouettes including extreme driver edits; no pixel readback across seven maps; bounded caches; world-seed invalidation; shared panorama images; offline file launch.');
}finally{await browser?.close();server.kill();}
