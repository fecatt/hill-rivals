import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:3113';
const server=process.env.TEST_URL?null:spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3113'},stdio:['ignore','pipe','inherit']});
let browser;
try{
 if(server)await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',reject);});
 browser=await chromium.launch();const desktop=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),a=await desktop.newPage(),errors=[];let documents=0;
 a.on('pageerror',e=>errors.push(e.message));a.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===a.mainFrame())documents++;});
 await a.goto(base+'/?mode=online');await a.waitForSelector('#room-browser:not([hidden])');await a.waitForFunction(()=>socket?.readyState===1);
 const shot=async(page,name)=>{if(process.env.TEST_SCREENSHOT_DIR){await page.waitForTimeout(300);await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.TEST_SCREENSHOT_DIR+'/'+name+'.png',fullPage:true});}};
 await shot(a,'directory-desktop');
 assert.equal(await a.locator('nav #mode-button,nav #sound,nav #install-app').count(),0);assert.equal(await a.locator('#mode-button').textContent(),'Играть на одном устройстве');
 await a.locator('#create-room').click();await a.waitForFunction(()=>roomState?.room.code);const code=await a.evaluate(()=>roomState.room.code);assert.match(code,/^[A-Z]{5}$/);assert.equal(await a.locator('#room-title').textContent(),'Гонка '+code);
 assert.equal(await a.locator('#chat-log').isVisible(),false);assert.equal(await a.locator('#player-name').inputValue(),'Игрок 1');
 const grid=await a.evaluate(()=>['racer-column','room-panel'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return {top:b.top,height:b.height};}));assert.ok(Math.abs(grid[0].top-grid[1].top)<1&&Math.abs(grid[0].height-grid[1].height)<1,'columns share top and bottom edges');
 assert.equal(await a.locator('#ability-panel .choice-tiles button').count(),3);await a.locator('#ability-panel button[data-value="jump"]').click();await a.waitForFunction(()=>roomState.players[0].ability==='jump');
 await a.locator('#room-settings').click();assert.equal(await a.locator('#mode-button').isVisible(),true);await a.locator('#room-settings').click();assert.equal(await a.locator('#mode-button').isVisible(),false);
 await a.locator('#rename-room').click();await a.locator('#room-name').fill('Вечерняя гонка');await a.locator('#rename-form button').first().click();await a.waitForFunction(()=>roomState.room.name==='Вечерняя гонка');
 await a.locator('#player-name').fill('Фёдор');await a.locator('#player-name').press('Enter');await a.waitForFunction(()=>roomState.players[0].name==='Фёдор');
 const invite=base+'/?mode=online&room='+code;
 await a.evaluate(()=>{navigator.clipboard.writeText=async text=>{window.copiedLink=text;};});await a.locator('#copy-link').click();assert.equal(await a.evaluate(()=>window.copiedLink),invite);
 await a.locator('#show-qr').click();assert.equal(await a.locator('#invite-url').inputValue(),invite);assert.equal(await a.locator('#invite-qr svg').count(),1);
 await a.addScriptTag({path:path.resolve('node_modules/jsqr/dist/jsQR.js')});
 const decoded=await a.evaluate(async()=>{
  const svg=document.querySelector('#invite-qr svg'),size=svg.viewBox.baseVal.width,image=new Image();
  image.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(svg));await image.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,size,size);const pixels=ctx.getImageData(0,0,size,size);
  return jsQR(pixels.data,size,size)?.data;
 });assert.equal(decoded,invite,'a camera can decode the actual rendered invitation');await shot(a,'room-qr');await a.locator('#close-invite').click();
 const phone=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block'}),b=await phone.newPage();b.on('pageerror',e=>errors.push(e.message));
 await b.goto(invite);await b.waitForFunction(()=>roomState?.players.length===2);assert.equal(await b.locator('#player-name').inputValue(),'Игрок 2');assert.equal(await b.locator('#rename-room').isVisible(),false);
 await b.locator('#player-name').fill('<b>Вера</b>');await b.locator('#player-name').press('Enter');await a.waitForFunction(()=>roomState.players.some(p=>p.name==='<b>Вера</b>'));
 assert.ok((await a.locator('.room-list').textContent()).includes('<b>Вера</b>'));assert.equal(await a.locator('.room-list b b').count(),0,'names are text, not HTML');
 assert.equal(await b.locator('#track').isDisabled(),true);for(let i=0;i<5;i++){await a.locator('#track + .choice-switch button').last().click();if(i===1)assert.equal(await a.locator('#track + .choice-switch .choice-value').textContent(),'Луна');}await b.waitForFunction(()=>roomState.track===5);
 await a.locator('#vehicle + .choice-switch button').last().click();await a.waitForFunction(()=>roomState.vehicle===1);assert.ok((await a.locator('#vehicle-description').textContent()).includes('Лёгкий'));assert.equal(await a.locator('.vehicle-setting #vehicle-description').isVisible(),true);await a.locator('#vehicle + .choice-switch button').first().click();
 for(const page of [a,b]){
  const [track,vehicle]=await Promise.all([page.locator('#track + .choice-switch').boundingBox(),page.locator('#vehicle + .choice-switch').boundingBox()]);assert.ok(Math.abs(track.width-vehicle.width)<1,JSON.stringify({track,vehicle}));assert.ok(Math.abs(track.height-vehicle.height)<1);
 }
 assert.equal(await b.locator('#chat-toggle').count(),0);assert.equal(await b.locator('#room-chat').isVisible(),false);await a.locator('#room-chat-toggle').click();await b.locator('#room-chat-toggle').click();assert.equal(await b.locator('#chat-log').isVisible(),false);const sendBox=await b.locator('#chat-form button').boundingBox();assert.ok(Math.abs(sendBox.width-sendBox.height)<1);assert.equal(await b.locator('#chat-form button svg').count(),1);
 const emptyHeight=(await a.locator('#room-panel').boundingBox()).height;
 await b.locator('#chat-text').fill('<b>Привет!</b>');await b.locator('#chat-form button').click();await a.waitForSelector('#chat-log p');assert.ok((await a.locator('#chat-log').textContent()).includes('<b>Привет!</b>'));assert.equal(await a.locator('#chat-log p b').count(),1);
 assert.ok(Math.abs((await a.locator('#room-panel').boundingBox()).height-emptyHeight)<1,'first message does not resize the room');
 await a.evaluate(()=>roomUI.chat(Array.from({length:20},(_,i)=>({id:i,name:'Игрок',text:'Сообщение '+i}))));assert.ok(Math.abs((await a.locator('#room-panel').boundingBox()).height-emptyHeight)<1,'history scrolls without growing the menu');
 const probe=await phone.newPage();await probe.goto(base+'/?mode=online');await probe.waitForFunction(()=>socket?.readyState===1);await probe.locator('#room-code').fill(code==='ZZZZZ'?'XXXXX':'ZZZZZ');await probe.waitForSelector('#room-code.code-error');assert.equal(await probe.locator('#room-code').getAttribute('aria-invalid'),'true');await probe.waitForTimeout(1600);assert.ok((await probe.locator('#directory-notice').textContent()).includes('не найдена'));await probe.locator('#room-code').fill(code);await probe.waitForFunction(()=>roomState?.room.code);await probe.close();
 await b.reload();await b.waitForFunction(()=>roomState?.players.some(p=>p.id===roomState.you&&p.name==='<b>Вера</b>'));assert.equal(await b.locator('#player-name').inputValue(),'<b>Вера</b>');
 await shot(a,'room-desktop');await shot(b,'room-phone');assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await a.locator('#start').click();await b.locator('#start').click();await a.waitForFunction(()=>roomState?.phase==='countdown');const deadline=await a.evaluate(()=>roomState.startAt-roomState.serverNow);assert.ok(deadline>0&&deadline<=3000);
 await a.waitForFunction(()=>mode==='race',{},{timeout:7000});assert.equal(await b.locator('#touch-controls').isVisible(),true);await a.waitForFunction(()=>document.querySelector('#hud').textContent.includes('Фёдор'));
 await a.locator('#menu').click();await a.waitForSelector('#room-browser:not([hidden])');await b.waitForFunction(()=>roomState.room.host===roomState.you);
 await a.locator('#mode-button').click();await a.waitForFunction(()=>selectedMode==='local');assert.equal(await a.locator('#mode-button').textContent(),'Играть онлайн');
 await a.locator('#players + .choice-tiles button[data-value="3"]').click();await shot(a,'garage-grass');
 await a.locator('#mode-button').click();await a.waitForSelector('#room-browser:not([hidden])');await a.locator('#mode-button').click();await a.waitForFunction(()=>selectedMode==='local');assert.equal(await a.locator('#players').inputValue(),'3');assert.equal(documents,1,'mode switches do not reload the page');
 assert.deepEqual(errors,[]);console.log('PASS: automatic title, rename permissions, persistent escaped names, QR decode/link join, hidden empty chat, square send icon, equal selects, 3-second start, terrain preview, mobile fit, direct mode switches.');
 await desktop.close();await phone.close();
}finally{await browser?.close();server?.kill();}
