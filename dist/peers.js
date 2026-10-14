'use strict';
// LAN candidates use WebRTC; the existing WebSocket route remains available at all times.
function createPeerTransport(send,getRoom){
 const peers=new Map();let round=-1,enabled=true;
 const ownerOf=player=>player.owner??player.id;
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]??Infinity;
 const sample=(values,value)=>{if(Number.isFinite(value)&&value>=0&&value<10000){values.push(value);if(values.length>8)values.shift();}};
 const notify=()=>send({type:'transport',peers:[...peers.values()].filter(p=>p.selected&&p.channel?.readyState==='open').map(p=>p.id)});
 function ensure(id){
  if(peers.has(id))return peers.get(id);
  if(!enabled||typeof RTCPeerConnection==='undefined')return null;
  let pc;try{pc=new RTCPeerConnection({iceServers:[]});}catch{enabled=false;return null;}
    const peer={id,pc,channel:null,candidates:[],frames:new Map(),direct:[],relay:[],selected:false,created:performance.now()};peers.set(id,peer);
  peer.pc.onicecandidate=e=>{if(e.candidate)send({type:'signal',to:id,data:{candidate:e.candidate.toJSON()}});};
  peer.pc.ondatachannel=e=>attach(peer,e.channel);
  return peer;
 }
 function attach(peer,channel){
  peer.channel=channel;
  channel.onmessage=e=>{
   if(typeof e.data!=='string'||e.data.length>16000)return;
   try{
    const msg=JSON.parse(e.data),now=performance.now();
    if(msg.type==='probe'){channel.send(JSON.stringify({type:'echo',at:msg.at}));return;}
    if(msg.type==='echo'){sample(peer.direct,now-msg.at);peer.lastEcho=now;return;}
    const packet=msg.type==='pose'?{...msg,type:'poses',poses:[{slot:0,seq:msg.seq,pose:msg.pose}]}:msg;
    if(packet.type!=='poses'||packet.round!==getRoom()?.round||!Array.isArray(packet.poses))return;
    for(const item of packet.poses.slice(0,3)){
     if(!Number.isInteger(item.slot)||!Number.isSafeInteger(item.seq)||!item.pose||!['x','y','vx','vy','a','av','wheel'].every(key=>Number.isFinite(item.pose[key])))continue;
     const frames=peer.frames.get(item.slot)||[];if(frames.length&&item.seq<=frames.at(-1).seq)continue;
     frames.push({at:now,seq:item.seq,pose:item.pose});if(frames.length>12)frames.shift();peer.frames.set(item.slot,frames);
    }
   }catch{}
  };
 }
 return {
  update(state){
    const ids=new Set(state.players.map(ownerOf).filter(owner=>owner!==state.you));
   for(const [id,peer] of peers)if(!ids.has(id)){peer.pc.close();peers.delete(id);}
   for(const [id,peer] of peers)if(['failed','closed'].includes(peer.pc.connectionState)&&performance.now()-peer.created>15000){peer.pc.close();peers.delete(id);}
   if(round!==state.round){round=state.round;for(const peer of peers.values())peer.frames.clear();}
   for(const id of ids){
    if(peers.has(id))continue;const peer=ensure(id);if(!peer)continue;
    if(state.you<id){
     attach(peer,peer.pc.createDataChannel('race',{ordered:false,maxRetransmits:0}));
     (async()=>{await peer.pc.setLocalDescription(await peer.pc.createOffer());send({type:'signal',to:id,data:{description:peer.pc.localDescription}});})().catch(()=>{});
    }
   }
  },
  async signal(msg){
   if(!getRoom()?.players.some(p=>ownerOf(p)===msg.from))return;
   const peer=ensure(msg.from);if(!peer)return;
   try{
    if(msg.data?.description){
     await peer.pc.setRemoteDescription(msg.data.description);
     for(const candidate of peer.candidates)await peer.pc.addIceCandidate(candidate);peer.candidates=[];
     if(msg.data.description.type==='offer'){await peer.pc.setLocalDescription(await peer.pc.createAnswer());send({type:'signal',to:msg.from,data:{description:peer.pc.localDescription}});}
    }else if(msg.data?.candidate){if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(msg.data.candidate);else peer.candidates.push(msg.data.candidate);}
   }catch{}
  },
  relay(msg){
   const peer=peers.get(msg.from);if(!peer||!Number.isFinite(msg.data?.at))return;
   if(msg.data.echo)sample(peer.relay,performance.now()-msg.data.at);
   else send({type:'peer-probe',to:msg.from,data:{at:msg.data.at,echo:true}});
  },
  probe(){
   for(const peer of peers.values()){
    const at=performance.now();send({type:'peer-probe',to:peer.id,data:{at}});
    if(peer.channel?.readyState==='open')try{peer.channel.send(JSON.stringify({type:'probe',at}));}catch{}
    const direct=median(peer.direct),relay=median(peer.relay);
    if(peer.direct.length>=2&&peer.relay.length>=2&&at-(peer.lastEcho||0)<5000){
     if(!peer.selected&&direct<relay*.9)peer.selected=true;
     else if(peer.selected&&direct>relay*1.15)peer.selected=false;
    }
   }
   notify();
  },
  broadcast(packet){
   const encoded=JSON.stringify(packet);
   for(const peer of peers.values())if(peer.channel?.readyState==='open'&&peer.channel.bufferedAmount<16000)try{peer.channel.send(encoded);}catch{}
  },
  pose(id,slot=0){
   const peer=peers.get(id),now=performance.now(),frames=peer?.frames.get(slot)||[];
   if(!peer?.selected)return null;
   if(peer.channel?.readyState!=='open'||!frames.length||now-frames.at(-1).at>300){if(frames.length||peer.channel?.readyState!=='open'){peer.selected=false;notify();}return null;}
   const target=now-60;let a=frames[0],b=a;
   for(const frame of frames){if(frame.at<=target)a=frame;else{b=frame;break;}b=a;}
   const mix=b.at>a.at?Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at))):0,pose={...b.pose};
   for(const key of ['x','y','a','wheel'])pose[key]=a.pose[key]+(b.pose[key]-a.pose[key])*mix;
   const ahead=Math.max(0,Math.min(.15,(target-b.at)/1000));
   pose.x+=b.pose.vx*ahead;pose.y+=b.pose.vy*ahead;pose.a+=b.pose.av*ahead;pose.wheel+=b.pose.vx*ahead/17;
   return pose;
  },
  summary(){let direct=0;for(const peer of peers.values())if(peer.selected&&peer.channel?.readyState==='open')direct++;const count=Math.max(0,new Set((getRoom()?.players||[]).map(ownerOf).filter(id=>id!==getRoom()?.you)).size);return count?'Напрямую: '+direct+' · Через сервер: '+(count-direct):'Ожидаем игроков';},
  reset(){for(const peer of peers.values())peer.pc.close();peers.clear();round=-1;},
  debug(){return [...peers.values()].map(p=>({id:p.id,connected:p.channel?.readyState==='open',directRtt:median(p.direct),relayRtt:median(p.relay),selected:p.selected,frames:[...p.frames.values()].reduce((count,frames)=>count+frames.length,0)}));},
 };
}
