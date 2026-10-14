import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3141'},stdio:['ignore','pipe','inherit']});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',reject)});
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:852,height:393},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();
 await page.goto('http://127.0.0.1:3141');await page.waitForFunction(()=>roomState?.room&&assetsLoaded);
 await page.evaluate(()=>document.documentElement.requestFullscreen());await page.waitForFunction(()=>!!document.fullscreenElement);
 const before=await page.evaluate(()=>({vw:innerWidth,vh:innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollY,html:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY,bodyHeight:document.body.getBoundingClientRect().height,lobby:document.querySelector('#lobby').getBoundingClientRect().toJSON()}));
 await page.evaluate(()=>scrollTo(0,9999));await page.waitForTimeout(100);
 const after=await page.evaluate(()=>({scrollY,scrollHeight:document.documentElement.scrollHeight,lobbyTop:document.querySelector('#lobby').getBoundingClientRect().top,lobbyBottom:document.querySelector('#lobby').getBoundingClientRect().bottom}));
 console.log(JSON.stringify({before,after}));assert.equal(after.scrollY,0);assert.ok(after.scrollHeight<=before.vh+1);assert.ok(after.lobbyTop>=0&&after.lobbyBottom<=before.vh+1);
 await context.close();
}finally{await browser?.close();server.kill();}
