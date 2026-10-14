import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {Room} from './room.js';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const version=process.env.APP_VERSION||'development';
const room=new Room();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,version,online:room.clients.size,phase:room.phase}));return;}
  let file;
  try {file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);res.end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(file).pipe(res);
  });
});
const wss=new WebSocketServer({noServer:true,maxPayload:2048});
server.on('upgrade',(req,socket,head)=>{
  let originAllowed=true;
  try{if(req.headers.origin)originAllowed=new URL(req.headers.origin).host===req.headers.host;}catch{originAllowed=false;}
  if(req.url!=='/ws'||!originAllowed||wss.clients.size>=64){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
wss.on('connection',ws=>{
  ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  const id=room.join(msg=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<64000)ws.send(JSON.stringify(msg));});
  let windowAt=Date.now(),messages=0;
  ws.on('message',data=>{
    if(Date.now()-windowAt>1000){windowAt=Date.now();messages=0;}
    if(++messages>80)return;
    try{const msg=JSON.parse(data.toString());if(msg&&typeof msg==='object'){if(msg.type==='ping'){ws.send(JSON.stringify({type:'pong',sent:msg.sent,serverNow:Date.now()}));return;}room.message(id,msg);}}catch{}
  });
  ws.on('close',()=>room.leave(id));ws.on('error',()=>ws.close());
});
let last=performance.now(),acc=0,nextBroadcast=0;
const timer=setInterval(()=>{
  const now=performance.now();acc+=Math.min(.25,(now-last)/1000);last=now;
  while(acc>=1/120){room.tick();acc-=1/120;}
  if(now>=nextBroadcast){room.broadcast();nextBroadcast=now+1000/30;}
},1000/120);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},15000);
server.listen(Number(process.env.PORT||3107),process.env.HOST||'127.0.0.1',()=>console.log('Hill Rivals listening',server.address()));
function shutdown(){clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1012,'Server updating');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
