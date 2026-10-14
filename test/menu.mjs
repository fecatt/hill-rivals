import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3138'},stdio:['ignore','pipe','inherit']});
let browser;
const errors=[];
try {
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',reject)});
 browser=await chromium.launch();
 const desktop=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const page=await desktop.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3138');
 await page.waitForFunction(()=>roomState?.room&&assetsLoaded).catch(async error=>{const state=await page.evaluate(()=>({readyState:document.readyState,online:window.onlineActive,assetsLoaded:window.assetsLoaded,room:window.roomState?.room,body:document.body.innerText.slice(0,300)}));throw new Error(error.message+'; page errors: '+errors.join(' | ')+'; state: '+JSON.stringify(state));});
 assert.equal(await page.locator('.pick[data-online-seat]').count(),1);
 assert.equal(await page.locator('.empty-seat').count(),3);
 assert.equal(await page.locator('#world-preview').count(),0);
 assert.equal(await page.locator('#vehicle-preview').count(),0);
 assert.ok((await page.locator('#car-specs').textContent()).includes('Макс. скорость'));
 assert.ok((await page.locator('#car-specs').textContent()).includes('л.с.'));
 assert.equal(await page.locator('#join-code button[type=submit]').count(),0);
 assert.equal(await page.locator('#room-sidebar #network-toggle .icon-globe').count(),1);
 assert.equal(await page.locator('#track-specs dd').count(),3);
 assert.equal(await page.locator('#track-specs dt').count(),0);
 assert.equal(await page.locator('[data-ability-seat="0"] + .choice-tiles button').count(),3);
 await page.locator('.empty-seat').first().click();await page.waitForFunction(()=>roomState.players.length===2);
 assert.equal(await page.locator('.pick[data-online-seat]').count(),2);
 assert.equal(await page.locator('.empty-seat').count(),2);
 await page.locator('[data-ability-seat="0"] + .choice-tiles [data-value="jump"]').click();await page.waitForFunction(()=>roomState.players[0].ability==='jump');
 await page.locator('[data-char-seat="0"][data-step="1"]').click();await page.waitForFunction(()=>roomState.players[0].character===onlineCharacters[0]);
 await page.locator('#player-name-0').fill('Фёдор');await page.locator('#player-name-0').press('Enter');await page.waitForFunction(()=>roomState.players[0].name==='Фёдор');
 await page.locator('#rename-room').click();await page.locator('#room-name').fill('FLIBS');await page.locator('#rename-form button').first().click();await page.waitForFunction(()=>roomState.room.name==='FLIBS');
 const shot=async(name,p=page)=>{if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:process.env.TEST_SCREENSHOT_DIR+'/'+name+'.png',fullPage:false});}};
 const checkLayout=async(p)=>{
  const result=await p.evaluate(()=>{const form=document.querySelector('#room-browser').getBoundingClientRect(),start=document.querySelector('#start').getBoundingClientRect();return {scroll:document.documentElement.scrollWidth,width:innerWidth,overlap:form.bottom>start.top+1,form:form.toJSON(),start:start.toJSON()}});
  assert.ok(result.scroll<=result.width+1,'no horizontal overflow: '+JSON.stringify(result));assert.equal(result.overlap,false,'code entry is not covered by ready: '+JSON.stringify(result));
 };
 await checkLayout(page);await shot('menu-desktop');
 const terrainCheck=await page.evaluate(()=>{
  const beforeTrack=$('#track').value,beforeVehicle=$('#vehicle').value,surfaces=[];
  for(let i=0;i<7;i++){$('#track').value=String(i);draw();surfaces.push(canvas.toDataURL());}
  $('#track').value=beforeTrack;$('#vehicle').value='0';draw();const jeep=canvas.toDataURL();$('#vehicle').value='4';draw();const monster=canvas.toDataURL();$('#vehicle').value=beforeVehicle;draw();
  return {distinct:new Set(surfaces).size,changes:jeep!==monster};
 });assert.equal(terrainCheck.distinct,7);assert.equal(terrainCheck.changes,true);
 for(const viewport of [{width:1280,height:720},{width:1024,height:768}]){await page.setViewportSize(viewport);await checkLayout(page);await shot('menu-'+viewport.width);}
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.empty-seat').first().click();await page.waitForFunction(()=>roomState.players.length===3);
 await page.locator('.empty-seat').first().click();await page.waitForFunction(()=>roomState.players.length===4);
 assert.equal(await page.locator('.empty-seat').count(),0);await checkLayout(page);
 await page.locator('#player-name-3').fill('Ёрик');
 await page.waitForFunction(()=>document.querySelector('.room-list').textContent.includes('Ёрик'));
 assert.equal(await page.locator('.room-list>div').count(),4);
 await shot('menu-four-racers');
 await page.locator('.remove-seat').click();await page.waitForFunction(()=>roomState.players.length===3);
 assert.ok(!(await page.locator('.room-list').textContent()).includes('Ёрик'));
 assert.equal(await page.locator('.room-list>div').count(),3);
 await page.locator('.remove-seat').click();await page.waitForFunction(()=>roomState.players.length===2);
 const code=await page.evaluate(()=>roomState.room.code);
 const phone=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const guest=await phone.newPage();guest.on('pageerror',e=>errors.push(e.message));await guest.goto('http://127.0.0.1:3138');await guest.waitForFunction(()=>roomState?.room&&assetsLoaded);
 assert.equal(await guest.locator('.empty-seat').count(),0);
 await guest.locator('#room-code').fill('abcdefghij');assert.equal((await guest.locator('#room-code').inputValue()).length,5);
 await guest.locator('#room-code').fill('ZZZZZ');await guest.waitForSelector('#room-code[aria-invalid="true"]');assert.ok((await guest.locator('#directory-notice').getAttribute('class')).includes('code-error'));
 await guest.locator('#room-code').fill(code);await guest.waitForFunction(expected=>roomState?.room.code===expected,code);await page.waitForFunction(()=>roomState.players.length===3);
 assert.equal(await guest.locator('#track').isDisabled(),true);
 await page.locator('#track + .choice-switch button').last().click();await guest.waitForFunction(()=>roomState.track===1);
 await page.locator('#vehicle + .choice-switch button').last().click();await guest.waitForFunction(()=>roomState.vehicle===1);
 await checkLayout(guest);
 const card=await guest.locator('[data-online-seat="0"]').boundingBox();assert.ok(card.height<=260,'phone racer card fits instead of stretching: '+card.height);
 await guest.locator('#network-toggle').tap();assert.equal(await guest.locator('#network-dialog').isVisible(),true);await guest.waitForSelector('.network-room-card');await guest.locator('#close-network').tap();
 await guest.locator('#start').tap();await guest.waitForFunction(()=>roomState.players.some(p=>playerOwner(p)===roomState.you&&p.ready));
 assert.equal(await guest.evaluate(()=>!!document.fullscreenElement),false,'ready tap does not resize the garage into fullscreen');
 await guest.locator('#start').tap();await guest.waitForFunction(()=>roomState.players.every(p=>playerOwner(p)!==roomState.you||!p.ready));
 await guest.evaluate(()=>scrollTo(0,0));await shot('menu-phone',guest);
 await guest.setViewportSize({width:852,height:393});await checkLayout(guest);await shot('menu-phone-landscape',guest);assert.ok((await guest.locator('[data-online-seat="0"]').boundingBox()).height<=300,'landscape phone card stays bounded');
 for(const height of [280,320,393,320]){
  await guest.setViewportSize({width:852,height});
  await guest.waitForFunction(()=>{const r=$('#room-panel').getBoundingClientRect();return r.bottom<=(visualViewport?.height||innerHeight)+1;});
  const visible=await guest.evaluate(()=>['.world-setting','.vehicle-setting','#racer-column','#room-panel','#start'].map(selector=>({selector,rect:$(selector).getBoundingClientRect().toJSON(),w:document.documentElement.clientWidth,h:visualViewport?.height||innerHeight})));
  for(const item of visible){assert.ok(item.rect.left>=-1&&item.rect.right<=item.w+1&&item.rect.top>=-1&&item.rect.bottom<=item.h+1,'whole menu fits with browser bar at '+height+': '+JSON.stringify(item));}
  const bounds=await guest.evaluate(()=>{const panel=$('#room-panel').getBoundingClientRect();return [...document.querySelectorAll('#room-sidebar>button')].map(b=>({id:b.id,r:b.getBoundingClientRect().toJSON(),panel:panel.toJSON()}));});
  for(const b of bounds){assert.ok(b.r.right<=b.panel.right&&b.r.left>=b.panel.left&&b.r.top>=b.panel.top&&b.r.bottom<=b.panel.bottom,'toolbar stays inside at '+height+': '+JSON.stringify(b));}
  await guest.locator('#room-settings').tap();await guest.waitForSelector('#room-options[open]');await guest.waitForTimeout(420);await guest.evaluate(name=>send({type:'name',name}),'Телефон '+height);await guest.waitForFunction(name=>roomState.players.some(p=>playerOwner(p)===roomState.you&&p.name===name),'Телефон '+height);assert.ok(await guest.locator('#room-options .drawer-body #sound').isVisible());await guest.locator('#close-settings').tap();await guest.waitForSelector('#room-options',{state:'hidden'});
 }
 await guest.setViewportSize({width:852,height:393});
 await guest.locator('#room-chat-toggle').click();
 await guest.waitForSelector('#chat-dialog[open]');await guest.waitForTimeout(420);const emptyLog=await guest.locator('#chat-log').boundingBox();assert.ok(emptyLog&&emptyLog.height>60,'empty chat already has a message area');
 assert.equal(await guest.locator('#chat-text').getAttribute('type'),'text');assert.equal(await guest.locator('#chat-text').getAttribute('name'),'message');assert.equal(await guest.locator('#chat-text').getAttribute('inputmode'),'text');assert.equal(await guest.locator('#chat-text').getAttribute('autocomplete'),'off');assert.equal(await guest.locator('#chat-form').getAttribute('autocomplete'),'off');
 const chatInputBounds=await guest.locator('#chat-text').boundingBox(),chatFormBounds=await guest.locator('#chat-form').boundingBox();assert.ok(chatInputBounds&&chatFormBounds&&chatFormBounds.y>=emptyLog.y+emptyLog.height,'chat form has its own row after the log');
 await guest.locator('#chat-text').focus();await guest.setViewportSize({width:852,height:240});await guest.waitForFunction(()=>document.querySelector('#chat-dialog').getBoundingClientRect().bottom<=(visualViewport?.height||innerHeight)+1);
 const keyboardLayout=await guest.evaluate(()=>({viewport:visualViewport?.height||innerHeight,dialog:$('#chat-dialog').getBoundingClientRect().toJSON(),form:$('#chat-form').getBoundingClientRect().toJSON(),input:$('#chat-text').getBoundingClientRect().toJSON(),log:$('#chat-log').getBoundingClientRect().toJSON()}));assert.ok(keyboardLayout.form.bottom<=keyboardLayout.viewport+1&&keyboardLayout.input.bottom<=keyboardLayout.viewport+1,'chat input and send button stay above the simulated keyboard: '+JSON.stringify(keyboardLayout));assert.ok(keyboardLayout.log.height>=30,'chat log shrinks before the input is pushed offscreen: '+JSON.stringify(keyboardLayout));await guest.setViewportSize({width:852,height:393});
 const send=await guest.locator('#chat-form button').boundingBox(),input=await guest.locator('#chat-text').boundingBox();assert.equal(send.height,input.height);
 const iconCenters=await guest.evaluate(()=>[...document.querySelectorAll('#room-sidebar>button')].map(button=>{const b=button.getBoundingClientRect(),icon=button.querySelector('svg')?.getBoundingClientRect();return {id:button.id,b:{x:b.x+b.width/2,y:b.y+b.height/2},icon:icon&&{x:icon.x+icon.width/2,y:icon.y+icon.height/2}}}));for(const item of iconCenters){assert.ok(item.icon&&Math.abs(item.b.x-item.icon.x)<=1&&Math.abs(item.b.y-item.icon.y)<=1,'mobile icon is centered in its button '+JSON.stringify(item));}
 const head=await guest.locator('#chat-dialog .drawer-head').boundingBox();assert.ok(head.y+head.height<=emptyLog.y,'heading never covers messages');await shot('drawer-chat-phone',guest);await guest.locator('#chat-text').fill('Привет из телефона');await guest.locator('#chat-form button').click();await page.waitForFunction(()=>document.querySelector('#chat-log').textContent.includes('Привет из телефона'));await guest.locator('#close-chat').click();
 await page.locator('#show-qr').click();assert.equal(await page.locator('#invite-qr svg').count(),1);assert.equal(await page.locator('#invite-dialog input,#copy-invite-link').count(),0);await page.waitForTimeout(420);await shot('drawer-qr-desktop');await page.locator('#close-invite').click();
 await page.locator('#network-toggle').click();await page.waitForSelector('.network-room-card');await page.locator('#close-network').click();
 await guest.locator('#room-chat-toggle').tap();await guest.waitForTimeout(420);
 const session=await phone.newCDPSession(guest),rect=await guest.locator('#chat-dialog .drawer-head h2').boundingBox(),x=rect.x+10,y=rect.y+10;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*18,y}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await guest.waitForSelector('#chat-dialog',{state:'hidden'});
 await page.locator('#start').click();await guest.waitForFunction(()=>roomState.players.filter(p=>p.ready).length===2);await guest.locator('#start').tap();
 await page.waitForFunction(()=>mode==='race');await guest.waitForFunction(()=>mode==='race');
 assert.deepEqual(errors,[]);
 console.log('PASS: startup, 2x2 seats, add/remove up to four racers, name/character/ability, room rename, join code, host settings, chat, QR, online directory, shared race start, desktop and mobile layouts.');
} finally {await browser?.close();server.kill();}
