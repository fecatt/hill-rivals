import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port=3142,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',reject);});
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const hostContext=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),host=await hostContext.newPage();
 await host.goto(base+'/?mode=online');await host.waitForFunction(()=>roomState?.room&&assetsLoaded);
 const code=await host.evaluate(()=>roomState.room.code);
 const guestContext=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}),guest=await guestContext.newPage();
 await guest.goto(`${base}/?mode=online&room=${code}`);await guest.waitForFunction(()=>roomState?.players.length===2&&assetsLoaded);
 const toolbar=await guest.evaluate(()=>{const ids=[...document.querySelectorAll('#room-sidebar>button')].map(button=>button.id),button=$('#network-toggle').getBoundingClientRect(),svg=$('#network-toggle svg').getBoundingClientRect();return {ids,buttonX:button.x+button.width/2,buttonY:button.y+button.height/2,iconX:svg.x+svg.width/2,iconY:svg.y+svg.height/2,inside:$('#room-sidebar').contains($('#network-toggle')),inJoinForm:$('#join-code').contains($('#network-toggle'))};});
 assert.ok(toolbar.inside&&!toolbar.inJoinForm,'players-online button belongs to the room toolbar');
 assert.ok(toolbar.ids.indexOf('network-toggle')<toolbar.ids.indexOf('leave-room')&&toolbar.ids.indexOf('leave-room')<toolbar.ids.indexOf('room-settings'),'players-online and leave buttons sit above settings');
 assert.ok(Math.abs(toolbar.buttonX-toolbar.iconX)<=1&&Math.abs(toolbar.buttonY-toolbar.iconY)<=1,'players-online icon is centered inside its button');
 assert.equal(await host.locator('.kick-player').count(),1,'host can remove the guest');assert.equal(await guest.locator('.kick-player').count(),0,'guest cannot remove another player');
 guest.setDefaultTimeout(6000);
 await guest.locator('#leave-room').tap();await guest.waitForFunction(old=>roomState?.room&&roomState.room.code!==old,code).catch(async error=>{throw new Error(error.message+' '+JSON.stringify(await guest.evaluate(()=>({room:roomState?.room,query:location.search,notice:$('#directory-notice').textContent,online:onlineActive,ready:socket?.readyState}))));});
 const freshCode=await guest.evaluate(()=>roomState.room.code);assert.notEqual(freshCode,code,'leaving creates a fresh room');
 await guest.locator('#network-toggle').tap();await guest.waitForSelector('#network-dialog[open]');assert.ok((await guest.locator('#network-room-list').textContent()).includes(code));const directoryCards=await guest.locator('.network-room-card').evaluateAll(cards=>cards.map(card=>({shrink:getComputedStyle(card).flexShrink,actionHeight:card.querySelector('button').getBoundingClientRect().height})));assert.ok(directoryCards.every(card=>card.shrink==='0'&&Math.abs(card.actionHeight-52)<1),'room cards keep their full height and actions stay compact: '+JSON.stringify(directoryCards));const scrollModel=await guest.evaluate(()=>({body:getComputedStyle($('#network-dialog .drawer-body')).overflowY,list:getComputedStyle($('#network-room-list')).overflowY,thumb:getComputedStyle($('#network-dialog .drawer-body'),'::-webkit-scrollbar').width}));assert.equal(scrollModel.body,'auto','the whole directory drawer body scrolls');assert.equal(scrollModel.list,'visible','room list no longer has a nested clipping boundary');await guest.locator('.network-room-card').filter({hasText:code}).locator('button').click();await guest.waitForFunction(expected=>roomState?.room.code===expected,code);await host.waitForFunction(()=>document.querySelectorAll('.kick-player').length===1);
 await host.locator('.kick-player').click();await guest.waitForFunction(()=>!roomState?.room&&!new URL(location.href).searchParams.has('room')&&document.querySelector('#directory-notice').textContent.includes('удалил вас'));await host.waitForFunction(()=>roomState?.players.length===1);
 assert.ok((await guest.locator('#directory-notice').textContent()).includes('удалил вас'));assert.equal(await host.evaluate(()=>roomState.players.length),1);
 assert.deepEqual(await host.evaluate(()=>[...document.querySelectorAll('.room-list .kick-player')].length),0);
 console.log('PASS: mobile toolbar alignment/order, host-only kick, leave-room flow and network room discovery.');
}finally{await browser?.close();server.kill();}
