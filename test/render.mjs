import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3120'},stdio:['ignore','pipe','inherit']});
let browser;
try{
 await new Promise(r=>server.stdout.once('data',r));browser=await chromium.launch();const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3120/?mode=online');await page.waitForFunction(()=>assetsLoaded&&roomState?.room);await page.locator('#start').click();await page.waitForFunction(()=>mode==='race');
 const result=await page.evaluate(()=>{
  const failures=[];let states=0;
  for(let t=0;t<7;t++)for(let m=0;m<9;m++)for(let character=0;character<7;character++){
   track=t;vehicleModel=m;chosen[0]=character;cars=[Object.assign(newCar(0),{boost:5,mud:6,shield:12,noticeTime:1})];cam=0;cameraY=0;zoom=1;bonus=[0,1,2,3].map(type=>newCrate(300+type*90,type));
   try{draw();const matrix=ctx.getTransform();if(matrix.e||matrix.f||ctx.globalAlpha!==1)failures.push({t,m,character,matrix:matrix.toString(),alpha:ctx.globalAlpha});states++;}catch(e){failures.push({t,m,character,error:e.stack});resize();}
  }
  // Compare complete pixels after contamination, including a surviving clip.
  cars[0].boost=0;cars[0].mud=0;track=4;bonus=[];draw();const clean=canvas.toDataURL();
  ctx.save();ctx.translate(130,H*.65);ctx.globalAlpha=.4;ctx.fillStyle='#eac778';ctx.fillRect(0,0,W,H);ctx.beginPath();ctx.rect(0,0,100,100);ctx.clip();draw();const recovered=canvas.toDataURL()===clean;
  // Changing vehicles in a subsequent round reuses car identities.
  const car=cars[0];car.model=0;visualPose(car);car.model=4;const suspension=visualPose(car).wheels.length===4;
  const actualDraw=carDraw;carDraw=()=>{ctx.save();ctx.translate(100,300);throw Error('test interrupted vehicle');};try{draw();}catch{}finally{carDraw=actualDraw;}car.model=vehicleModel;draw();const afterFailure=canvas.toDataURL()===clean;
  chosen[0]=undefined;draw();return {failures,states,recovered,suspension,afterFailure};
 });
 assert.deepEqual(result.failures,[]);assert.equal(result.states,441);assert.ok(result.recovered,'opacity, transform and clip cannot corrupt following frames');assert.ok(result.afterFailure,'an interrupted vehicle draw cannot corrupt following frames');assert.ok(result.suspension,'new vehicle rebuilds cached suspension');assert.deepEqual(errors,[]);
 console.log('PASS: 343 map/vehicle/character states with effects; pixel-identical recovery from dirty or interrupted draw; vehicle change; absent portrait.');
}finally{await browser?.close();server.kill();}
