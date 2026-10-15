import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3129'},stdio:['ignore','pipe','inherit']});let browser;
try{
 await new Promise(r=>server.stdout.once('data',r));browser=await chromium.launch(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let release;const held=new Promise(r=>release=r);await page.route('**/assets/hills-far-0.webp',async route=>{await held;await route.continue();});
 await page.goto('http://localhost:3129/?mode=local',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof hillBackdrop!=='undefined'&&hillBackdrop?.sky);assert.equal(await page.evaluate(()=>assetsLoaded),false,'scenery decoding is required before entering the game');
 release();await page.waitForFunction(()=>assetsLoaded);
 const result=await page.evaluate(()=>{
  start();paused=true;count=0;cam=0;cameraY=0;zoom=1;time=1;draw();
  const layer=key=>document.querySelector('[data-layer-key="'+key+'"]'),position=key=>new DOMMatrix(layer(key).style.transform).e;
  const cloud=layer('sky:cloud:1'),sky=[cloud.style.transform,layer('sky:sun').style.transform],keys=['far','middle','near'].map(name=>'landscape:'+name+':0:0'),before=keys.map(position);
  cam=100;time=3;draw();const shifts=keys.map((key,i)=>position(key)-before[i]);
  cam=3000;cameraY=150;time=7;draw();const anchored=cloud===layer('sky:cloud:1')&&sky[0]===cloud.style.transform&&sky[1]===layer('sky:sun').style.transform;
  for(let j=0;j<12;j++){cam=j*2000;draw();}
  const nodes=[...document.querySelectorAll('#scene-layers [data-layer-key]')],retained=nodes.length,solid=nodes.filter(n=>n.dataset.layerKey.startsWith('landscape:')).every(n=>n.style.opacity==='1'&&new DOMMatrix(n.style.transform).a>0);
  const textures=hillLandscapeLayers.map(plan=>{
   const width=plan.images.reduce((sum,im)=>sum+im.naturalWidth,0),height=plan.sourceHeight,surface=document.createElement('canvas');surface.width=width;surface.height=height;const paint=surface.getContext('2d');let x=0;for(const [i,im] of plan.images.entries()){paint.drawImage(im,x,plan.tops[i]);x+=im.naturalWidth;}
   const pixels=paint.getImageData(0,0,width,height).data;let sky=0,solid=0,total=0,error=0;for(let xx=0;xx<width;xx++)if(pixels[xx*4+3]===0)sky++;
   for(let y=Math.floor(height*.8);y<height;y++)for(let xx=0;xx<width;xx++){total++;if(pixels[(y*width+xx)*4+3]===255)solid++;}
   for(let y=0;y<height;y++){const a=y*width*4,b=(y*width+width-1)*4;for(let c=0;c<4;c++)error+=Math.abs(pixels[a+c]-pixels[b+c]);}
   return {name:plan.name,width,height,sky:sky/width,solid:solid/total,wrapError:error/(height*4)};
  });
  cam=0;cameraY=0;time=1;draw();bonus=[newCrate(510,0),newCrate(720,2)];bonus.forEach((b,j)=>{b.y=terrain(b.x)-150-j*90;});draw();
  return {shifts,anchored,retained,solid,textures};
 });
 assert.ok(result.anchored,'sky objects are fixed while camera and animation time change');assert.ok(result.retained<70,'offscreen plans are removed');assert.ok(result.solid,'all landscape layers are fully opaque and never reflected');
 for(const [i,expected] of [-8,-22,-46].entries())assert.ok(Math.abs(result.shifts[i]-expected)<.01,'independent parallax speeds');
 for(const texture of result.textures){assert.ok(texture.width>=3800,'long original plus generated connecting scene');assert.ok(texture.sky>.98,'transparent sky');assert.ok(texture.solid>.98,'solid land has no ghost alpha');assert.ok(texture.wrapError<20,'the loop boundary remains a continuous scene');}
 if(process.env.SCENE_SCREENSHOT)await page.screenshot({path:process.env.SCENE_SCREENSHOT});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result));console.log('PASS: delayed scenery, fixed sky objects, three opaque alpha-cutout layers, long non-mirrored panoramas, loop seams, bounded offscreen layers.');
}finally{await browser?.close();server.kill();}
