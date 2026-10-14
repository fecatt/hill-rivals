import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3141'},stdio:['ignore','pipe','inherit']});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',reject)});
 browser=await chromium.launch();
 const desktop=await browser.newContext({viewport:{width:1770,height:1195},serviceWorkers:'block'}),desktopPage=await desktop.newPage();
 await desktopPage.goto('http://127.0.0.1:3141');await desktopPage.waitForFunction(()=>roomState?.room&&assetsLoaded);
 const icon=await desktopPage.locator('#copy-link svg').evaluate(e=>({viewBox:e.getAttribute('viewBox'),paths:e.querySelectorAll('path').length,box:e.getBoundingClientRect().toJSON()}));assert.equal(icon.viewBox,'0 0 32 32');assert.equal(icon.paths,2);assert.ok(icon.box.width>0&&icon.box.height>0);
 await desktopPage.evaluate(()=>scrollTo(0,1000));await desktopPage.waitForTimeout(50);
 const windowed=await desktopPage.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight,viewport:innerHeight,body:getComputedStyle(document.body).overflowY,lobby:document.querySelector('#lobby').getBoundingClientRect().toJSON()}));
 console.log('windowed='+JSON.stringify(windowed));assert.equal(windowed.y,0);assert.ok(windowed.height<=windowed.viewport+1);assert.ok(windowed.lobby.bottom<=windowed.viewport);
 await desktop.close();
 const context=await browser.newContext({viewport:{width:852,height:393},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();
 await page.goto('http://127.0.0.1:3141');await page.waitForFunction(()=>roomState?.room&&assetsLoaded);
 await page.evaluate(()=>document.documentElement.requestFullscreen());await page.waitForFunction(()=>!!document.fullscreenElement);
 const before=await page.evaluate(()=>({vw:innerWidth,vh:innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollY,html:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY,bodyHeight:document.body.getBoundingClientRect().height,lobby:document.querySelector('#lobby').getBoundingClientRect().toJSON()}));
 await page.evaluate(()=>scrollTo(0,9999));await page.waitForTimeout(100);
 const after=await page.evaluate(()=>({scrollY,scrollHeight:document.documentElement.scrollHeight,lobbyTop:document.querySelector('#lobby').getBoundingClientRect().top,lobbyBottom:document.querySelector('#lobby').getBoundingClientRect().bottom}));
 console.log(JSON.stringify({before,after}));assert.equal(after.scrollY,0);assert.ok(after.scrollHeight<=before.vh+1);assert.ok(after.lobbyTop>=0&&after.lobbyBottom<=before.vh+1);
 await context.close();
}finally{await browser?.close();server.kill();}
