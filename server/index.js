import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {Lobby} from './lobby.js';
import {gzip} from 'node:zlib';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const version=process.env.APP_VERSION||'development';
const lobby=new Lobby({storeFile:process.env.ROOM_STORE_FILE});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const compressedFiles=new Map();
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,version,online:lobby.clients.size,rooms:lobby.rooms.size}));return;}
  let file;
  try {file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);res.end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    const etag='W/"'+stat.size.toString(16)+'-'+Math.trunc(stat.mtimeMs).toString(16)+'"',headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','ETag':etag,'Last-Modified':stat.mtime.toUTCString()};
    const compressible=/\.(html|js|css|svg|webmanifest)$/.test(file);if(compressible)headers.Vary='Accept-Encoding';
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;}
    if(compressible&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){
      const key=file+':'+etag,send=buffer=>{res.writeHead(200,{...headers,'Content-Encoding':'gzip','Content-Length':buffer.length});res.end(req.method==='HEAD'?undefined:buffer);};
      const cached=compressedFiles.get(key);if(cached){send(cached);return;}
      fs.readFile(file,(error,source)=>{if(error){res.writeHead(500);res.end();return;}gzip(source,(error,buffer)=>{if(error){res.writeHead(500);res.end();return;}if(compressedFiles.size>=32)compressedFiles.delete(compressedFiles.keys().next().value);compressedFiles.set(key,buffer);send(buffer);});});return;
    }
    res.writeHead(200,{...headers,'Content-Length':stat.size});
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(file).pipe(res);
  });
});
const wss=new WebSocketServer({noServer:true,maxPayload:16384});
server.on('upgrade',(req,socket,head)=>{
  let originAllowed=true;
  try{if(req.headers.origin)originAllowed=new URL(req.headers.origin).host===req.headers.host;}catch{originAllowed=false;}
  if(new URL(req.url,'http://localhost').pathname!=='/ws'||!originAllowed||wss.clients.size>=64){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',(ws,req)=>{
  ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  // nginx overwrites this header from the incoming PROXY protocol address.
  const address=process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress):req.socket.remoteAddress;
  const deliver=msg=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<64000)ws.send(JSON.stringify(msg));};
  const id=lobby.connect(deliver,address,/^[0-9a-f-]{36}$/i.test(new URL(req.url,'http://localhost').searchParams.get('session')||'')?new URL(req.url,'http://localhost').searchParams.get('session'):'');
  let windowAt=Date.now(),messages=0;
  ws.on('message',data=>{
    if(lobby.clients.get(id)?.send!==deliver)return;
    if(Date.now()-windowAt>1000){windowAt=Date.now();messages=0;}
    if(++messages>80)return;
    try{const msg=JSON.parse(data.toString());if(msg&&typeof msg==='object'){if(msg.type==='ping'){ws.send(JSON.stringify({type:'pong',sent:msg.sent,serverNow:Date.now()}));return;}lobby.message(id,msg);}}catch{}
  });
  ws.on('close',()=>lobby.disconnect(id,deliver));ws.on('error',()=>ws.close());
});
let last=performance.now(),acc=0,nextBroadcast=0;
const timer=setInterval(()=>{
  const now=performance.now();acc+=Math.min(.25,(now-last)/1000);last=now;
  while(acc>=1/120){lobby.tick();acc-=1/120;}
  if(now>=nextBroadcast){lobby.broadcast();nextBroadcast=now+1000/30;}
},1000/120);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},15000);
const directoryTimer=setInterval(()=>lobby.broadcastDirectory(),1500);
server.listen(Number(process.env.PORT||3107),process.env.HOST||'127.0.0.1',()=>console.log('Hill Rivals listening',server.address()));
function shutdown(){clearInterval(timer);clearInterval(heartbeat);clearInterval(directoryTimer);for(const ws of wss.clients)ws.close(1012,'Server updating');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
