import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3111'},stdio:['ignore','pipe','inherit']});
let browser,receiveBlackoutUntil=0;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',reject);});
 browser=await chromium.launch();
 const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const pages=[await context.newPage(),await context.newPage()],errors=[];
 for(const page of pages){
  page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket('**/ws',socket=>{
   const remote=socket.connectToServer();let count=0,delivery=0;
   socket.onMessage(message=>setTimeout(()=>remote.send(message),45));
   remote.onMessage(message=>{
    // Preserve TCP order while introducing a variable 45-165 ms receive delay.
    const wait=++count%17===0?165:45;
    delivery=Math.max(delivery,Date.now()+wait,receiveBlackoutUntil);
    setTimeout(()=>socket.send(message),delivery-Date.now());
   });
  });
  await page.goto('http://127.0.0.1:3111/?mode=online');
  await page.waitForFunction(()=>document.querySelector('#start').textContent==='ГОТОВО');
 }
 await pages[0].selectOption('#track','3');
 await pages[1].waitForFunction(()=>roomState.track===3);
 for(const page of pages)await page.locator('#start').click();
 await pages[0].waitForFunction(()=>mode==='race',{},{timeout:18000});
 await pages[0].waitForFunction(()=>roomState.game.cars[window.onlineIndex]?.alive&&poseSequence>0);
 receiveBlackoutUntil=Date.now()+1100;
 // Let packets already in flight drain, then test a real touch while replies stop.
 await pages[0].waitForTimeout(200);
 const before=await pages[0].evaluate(()=>({x:localCar.x,vx:localCar.vx,seq:poseSequence}));
 const gas=await pages[0].locator('[data-control="gas"]').boundingBox();
 const session=await context.newCDPSession(pages[0]);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:gas.x+gas.width/2,y:gas.y+gas.height/2}]});
 await pages[0].waitForTimeout(150);
 const response=await pages[0].evaluate(()=>({vx:localCar.vx,gas:!!keys.TouchGas}));
 assert.equal(response.gas,true);assert.ok(response.vx>before.vx+1,'touch accelerates without a server reply');
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await pages[0].waitForTimeout(500);
 const duringGap=await pages[0].evaluate(()=>({x:localCar.x,seq:poseSequence,gas:!!keys.TouchGas}));
 assert.ok(duringGap.x>before.x+1,'local physics continues beyond the previous 250 ms cutoff');assert.equal(duringGap.gas,false);
 await pages[1].waitForFunction(()=>roomState.game.cars.some(c=>c.x!==c.startX));
 assert.ok(duringGap.seq>before.seq,'local poses are transmitted');
 const result=await pages[0].evaluate(async()=>{
  let frames=0,packets=0,movingFrames=0,rewinds=0,lastTime=time,lastY=null,tracked=null;
  const old=socket.onmessage;socket.onmessage=e=>{packets++;old(e);};
  const end=performance.now()+10000,intervals=[];let last=performance.now();
  await new Promise(resolve=>{function sample(now){
   frames++;intervals.push(now-last);last=now;
   if(time<lastTime-1e-8)rewinds++;lastTime=time;
   const crate=bonus.find(b=>!b.grounded);
   if(crate){if(tracked===crate.id&&lastY!==crate.y)movingFrames++;tracked=crate.id;lastY=crate.y;}
   if(now>=end)resolve();else requestAnimationFrame(sample);
  }requestAnimationFrame(sample);});
  socket.onmessage=old;
  intervals.sort((a,b)=>a-b);
  return {frames,packets,movingFrames,rewinds,p95FrameMs:intervals[Math.floor(intervals.length*.95)],finite:cars.every(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)),phase:roomState.phase};
 });
 assert.equal(result.rewinds,0);assert.equal(result.finite,true);assert.ok(result.movingFrames>30,'falling crates move between packets');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({...result,touchWithoutServerReply:true,localPhysicsDuringGap:true}));
 await context.close();
}finally{await browser?.close();server.kill();}
