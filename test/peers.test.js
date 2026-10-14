import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function fixture(blocked=false){
 let clock=1000;const sent=[],connections=[],room={you:'a',round:1,players:[{id:'a'},{id:'b'}]};
 class Connection{
  constructor(){if(blocked)throw Error('blocked');this.connectionState='connected';connections.push(this);}
  createDataChannel(){return this.channel={readyState:'open',bufferedAmount:0,send(){}};}
  async createOffer(){return {type:'offer'};}
  async setLocalDescription(value){this.localDescription=value;}
  close(){this.connectionState='closed';this.channel.readyState='closed';}
 }
 const context=vm.createContext({RTCPeerConnection:Connection,performance:{now:()=>clock},send:msg=>sent.push(msg),getRoom:()=>room});
 vm.runInContext(fs.readFileSync(new URL('../dist/peers.js',import.meta.url),'utf8')+'\nglobalThis.transport=createPeerTransport(send,getRoom);',context);
 const transport=context.transport;transport.update(room);
 return {transport,room,sent,connections,advance:ms=>clock+=ms};
}
test('direct path is selected by measured latency and stale packets immediately restore server fallback',()=>{
 const f=fixture(),channel=f.connections[0].channel;
 for(let i=0;i<2;i++){channel.onmessage({data:JSON.stringify({type:'echo',at:998})});f.transport.relay({from:'b',data:{at:970,echo:true}});}
 f.transport.probe();assert.equal(f.transport.debug()[0].selected,true);assert.deepEqual([...f.sent.at(-1).peers],['b']);
 const pose={x:100,y:100,a:0,wheel:0,vx:100,vy:0,av:0};
 channel.onmessage({data:JSON.stringify({type:'pose',round:1,seq:1,pose})});assert.equal(f.transport.pose('b').x,100);
 f.advance(100);channel.onmessage({data:JSON.stringify({type:'pose',round:1,seq:2,pose:{...pose,x:110}})});assert.equal(f.transport.pose('b').x,104);
 f.advance(400);assert.equal(f.transport.pose('b'),null);assert.equal(f.sent.at(-1).peers.length,0);
});
test('fast server path and browsers blocking WebRTC retain working server transport',()=>{
 const f=fixture();for(let i=0;i<2;i++){f.connections[0].channel.onmessage({data:JSON.stringify({type:'echo',at:950})});f.transport.relay({from:'b',data:{at:998,echo:true}});}
 f.transport.probe();assert.equal(f.transport.debug()[0].selected,false);
 const blocked=fixture(true);assert.equal(blocked.transport.pose('b'),null);assert.equal(blocked.transport.summary(),'Напрямую: 0 · Через сервер: 1');
});
