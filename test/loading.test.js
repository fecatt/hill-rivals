import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function loading(decode){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:0,textContent:'',remove(){this.removed=true;}});return elements.get(id);};
 const image={complete:true,naturalWidth:100,naturalHeight:100,addEventListener(){},removeEventListener(){},decode};
 const context=vm.createContext({$:get,document:{body:{append(){}},createElement:()=>get('screen')},images:[image],environmentAtlas:image,hillArt:image,hillPanorama:image,hillTrees:[],hillCrestSun:image,hillCloud:image,paintedBodies:{},hillTexture(){},hillTreeBounds:[],hillCloudBounds:[],window:{},setTimeout,clearTimeout,console});
 vm.runInContext(fs.readFileSync(new URL('../dist/loading.js',import.meta.url),'utf8'),context);
 return {context,get};
}
test('loading screen waits for image decoding before allowing gameplay',async()=>{
 let decode;const pending=new Promise(resolve=>decode=resolve),l=loading(()=>pending);
 let completed=false;l.context.window.assetsReady.then(()=>completed=true);
 await new Promise(r=>setImmediate(r));assert.equal(completed,false);assert.equal(l.get('screen').removed,undefined);
 decode();await l.context.window.assetsReady;assert.equal(l.get('screen').removed,true);
});
test('a failed image keeps the loading screen visible and offers a working retry',async()=>{
 let fail=true;const l=loading(()=>fail?Promise.reject(Error('decode failed')):Promise.resolve());
 await new Promise(r=>setImmediate(r));
 assert.equal(l.get('#retry-loading').hidden,false);assert.equal(l.get('screen').removed,undefined);
 fail=false;await l.get('#retry-loading').onclick();await l.context.window.assetsReady;
 assert.equal(l.get('screen').removed,true);
});
