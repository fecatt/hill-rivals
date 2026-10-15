import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3148'},windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
try{
 await new Promise(resolve=>server.stdout.once('data',resolve));
 const url='http://127.0.0.1:3148/assets/hills-far-0.webp',response=await fetch(url),body=await response.arrayBuffer();
 assert.equal(Number(response.headers.get('content-length')),body.byteLength);assert.ok(response.headers.get('etag'));
 const unchanged=await fetch(url,{headers:{'If-None-Match':response.headers.get('etag')}});assert.equal(unchanged.status,304);assert.equal((await unchanged.arrayBuffer()).byteLength,0);
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('content-length'),String(body.byteLength));
 const scriptURL='http://127.0.0.1:3148/game.bundle.js',compressed=await fetch(scriptURL,{headers:{'Accept-Encoding':'gzip'}}),decoded=await compressed.text(),plain=await fetch(scriptURL,{headers:{'Accept-Encoding':'identity'}});
 assert.equal(compressed.headers.get('content-encoding'),'gzip');assert.equal(compressed.headers.get('vary'),'Accept-Encoding');assert.equal(decoded,await plain.text());assert.ok(Number(compressed.headers.get('content-length'))<Buffer.byteLength(decoded)*.5,'startup script should transfer less than half its uncompressed size');
 browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||undefined});const page=await browser.newPage({serviceWorkers:'block'}),requests=[],errors=[];let allow=false;
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/assets/'))requests.push(request.url());});
 await page.route('**/assets/hills-far-0.webp*',route=>allow?route.continue():route.fulfill({status:503,body:'temporary failure'}));
 await page.goto('http://127.0.0.1:3148/?mode=local');await page.locator('#retry-loading').waitFor({state:'visible'});
 assert.match(await page.locator('#loading-status').textContent(),/hills-far-0.webp/);
 const goodCount=requests.filter(url=>url.endsWith('/assets/car-evo.webp')).length;assert.equal(goodCount,1);
 allow=true;await page.locator('#retry-loading').click();await page.waitForFunction(()=>assetsLoaded);
 assert.ok(requests.some(url=>url.includes('hills-far-0.webp?_asset_retry=')),'retry bypasses a stale cached response');
 assert.equal(requests.filter(url=>url.endsWith('/assets/car-evo.webp')).length,goodCount,'healthy images are not fetched again');assert.deepEqual(errors,[]);
 console.log('PASS: missing texture is named; retry bypasses stale cache and preserves healthy images; Content-Length, HEAD and ETag/304 prevent redundant downloads.');
}finally{await browser?.close();server.kill();}
