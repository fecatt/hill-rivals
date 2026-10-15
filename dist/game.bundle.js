
// maps.js
'use strict';
// The loader owns network concurrency; constructing artwork must not start 31 requests.
function queuedGameImage(src){const im=new Image();im.assetSource=src;return im;}
const MAPS=[
 {name:'Зелёные холмы',biome:'hills',gravity:420,description:'Большие деревья, плавные холмы и деревянные мосты.'},
 {name:'Горы',biome:'mountains',gravity:420,description:'Высокие перевалы, скалы и мосты над ущельями.'},
 {name:'Луна',biome:'moon',gravity:70,description:'Гравитация в 6 раз слабее. Длинные прыжки над кратерами.'},
 {name:'Шоссе',biome:'highway',gravity:420,description:'Быстрое шоссе без мостов: асфальт, длинные прямые и пологие подъёмы.'},
 {name:'Город',biome:'city',gravity:420,description:'Улицы, дома, фонари и мосты над каналами.'},
 {name:'Зима',biome:'winter',gravity:420,description:'Снежные холмы, хвойный лес и переменный снегопад.'},
 {name:'Большое путешествие',biome:'mixed',gravity:420,description:'Бесконечный маршрут. Биомы меняются примерно каждые 3 км.'}
];
const PALETTES={
 hills:{sky:['#83cfe9','#d7efdc'],layers:['#87adb5','#76a787','#5f885c'],soil:'#a47b49',edge:'#466c32',top:'#7fc444',shine:'#a0d65a'},
 mountains:{sky:['#96bed6','#e2e8e5'],layers:['#93a5b5','#7c909e','#647e86'],soil:'#827f72',edge:'#505d55',top:'#859774',shine:'#bac49a'},
 moon:{sky:['#111428','#343759'],layers:['#626481','#54566d','#464b60'],soil:'#777c88',edge:'#505665',top:'#b0b6bd',shine:'#d8d9dd'},
 highway:{sky:['#8acde7','#e3ead3'],layers:['#a3c2b5','#8ab08a','#749365'],soil:'#a08765',edge:'#3a4144',top:'#5d6668',shine:'#7c8381'},
 city:{sky:['#b3d6df','#f4dcc6'],layers:['#a6b5bd','#839ba8','#6f8c96'],soil:'#998774',edge:'#373e40',top:'#606b70',shine:'#7b8586'},
 winter:{sky:['#90b9d3','#e8f4fa'],layers:['#b5cbdc','#9cb6c8','#8da8b8'],soil:'#8a9fac',edge:'#98bccd',top:'#eef7fa',shine:'#fff'}
};
const BIOME_LENGTH=30000,BRIDGE_CHUNK=3200;
const ENV_CROPS=[[8,5,405,380],[425,5,220,380],[654,5,280,380],[936,5,320,380],[48,390,310,320],[338,390,310,320],[636,390,326,320],[965,390,290,320],[48,715,310,300],[358,715,290,300],[650,715,315,300],[970,715,285,300],[8,1020,332,220],[348,1020,320,220],[680,1020,300,220],[990,1020,270,220]];
const environmentAtlas=queuedGameImage('assets/environment-atlas.webp');
let worldSeed=1,biomeOrder=['hills','mountains','highway','city','winter'];
function hash(n,salt=0){let v=(Math.floor(n)^worldSeed^Math.imul(salt,0x9e3779b9))>>>0;v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);return ((v^(v>>>16))>>>0)/4294967296}
function setWorldSeed(seed){worldSeed=seed>>>0;biomeOrder=['hills','mountains','highway','city','winter'];for(let j=4;j>0;j--){let k=Math.floor(hash(j,71)*(j+1));[biomeOrder[j],biomeOrder[k]]=[biomeOrder[k],biomeOrder[j]]}}
function newWorldSeed(){let seed=globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*4294967296);if(seed===worldSeed)seed=(seed+1)>>>0;setWorldSeed(seed)}
function biomeRegion(region){return biomeOrder[((region%5)+5)%5]}
function mapBiome(t,x){return t===6?biomeRegion(Math.max(0,Math.floor(x/BIOME_LENGTH))):MAPS[t].biome}
function ease(t){return t*t*(3-2*t)}
function smoothNoise(x,salt){const i=Math.floor(x),f=ease(x-i);return (hash(i,salt)*(1-f)+hash(i+1,salt)*f)*2-1}
const BIOME_NAMES=['hills','mountains','moon','highway','city','winter'],PROFILE_AMPLITUDES=[[65,26,8],[120,38,12],[76,32,12],[25,10,3],[34,12,4],[70,28,8]],PROFILE_WAVELENGTHS=[[230,115,65],[350,160,80],[300,145,85],[480,200,110],[410,185,95],[265,140,75]],profileParameters=new Map();
let profileSeed=null;
function profile(b,x){
 if(profileSeed!==worldSeed){profileParameters.clear();profileSeed=worldSeed;}
 let parameters=profileParameters.get(b);if(!parameters){const i=BIOME_NAMES.indexOf(b),amplitudes=PROFILE_AMPLITUDES[i],wavelengths=PROFILE_WAVELENGTHS[i];parameters={i,amplitudes,wavelengths,waves:amplitudes.map((amplitude,j)=>({phase:hash(i,j+19)*Math.PI*2,freq:.62+hash(i,j+31)*.78,amp:amplitude*(.62+hash(i,j+47)*.82)}))};profileParameters.set(b,parameters);}
 const {i,amplitudes,wavelengths,waves}=parameters;let v=0;for(let j=0;j<3;j++){const wave=waves[j];v+=wave.amp*Math.sin(x*wave.freq/wavelengths[j]+wave.phase)}return v+smoothNoise(x/520,i+91)*(b==='highway'?12:28)+smoothNoise(x/175,i+211)*amplitudes[0]*.19;
}
function terrainShape(b,x){const i=['hills','mountains','moon','highway','city','winter'].indexOf(b),ranges=[155,260,190,30,58,170],step=2600,at=x/step,n=Math.floor(at),f=ease(at-n),scale=ranges[i];const point=k=>(hash(k,i+401)*2-1)*scale;return (point(n)*(1-f)+point(n+1)*f)*.8+smoothNoise(x/730,i+431)*scale*.18}
function rawTerrain(t,x){const ramp=ease(Math.min(1,Math.max(0,(x-800)/650)));let b=mapBiome(t,x),v=profile(b,x)+terrainShape(b,x);if(t===6){const boundary=Math.round(x/BIOME_LENGTH)*BIOME_LENGTH;if(boundary>0&&Math.abs(x-boundary)<600){const region=boundary/BIOME_LENGTH,f=ease((x-boundary+600)/1200),before=biomeRegion(region-1),after=biomeRegion(region);v=(profile(before,x)+terrainShape(before,x))*(1-f)+(profile(after,x)+terrainShape(after,x))*f}}return ramp*v*(1+Math.min(.15,Math.max(0,x-3000)/80000))}
function bridgeForChunk(t,chunk){
 if(chunk<0||t===3||hash(chunk,t+111)>.72)return null;
 const a=chunk*BRIDGE_CHUNK+1050+hash(chunk,t+133)*1350,b=a+260+hash(chunk,t+151)*160,biome=mapBiome(t,(a+b)/2);
 if(!['hills','mountains','city'].includes(biome)||mapBiome(t,a+8)!==biome||mapBiome(t,b-8)!==biome)return null;
 return [a,b]
}
function bridgesInRange(t,left,right){const bridges=[];for(let j=Math.max(0,Math.floor(left/BRIDGE_CHUNK));j<=Math.floor(right/BRIDGE_CHUNK);j++){const bridge=bridgeForChunk(t,j);if(bridge&&bridge[1]>=left&&bridge[0]<=right)bridges.push(bridge)}return bridges}
function bridgeAt(t,x){const bridge=bridgeForChunk(t,Math.floor(x/BRIDGE_CHUNK));return bridge&&x>=bridge[0]&&x<=bridge[1]?bridge:null}
function biomeBoundaries(left,right){const boundaries=[];for(let x=(Math.floor(left/BIOME_LENGTH)+1)*BIOME_LENGTH;x<right;x+=BIOME_LENGTH)if(x>0)boundaries.push(x);return boundaries}
function mapTerrain(t,x){const bridge=bridgeAt(t,x);if(!bridge)return rawTerrain(t,x);const [a,b]=bridge,k=(x-a)/(b-a);return rawTerrain(t,a)*(1-k)+rawTerrain(t,b)*k}
function groundHeight(t,x){if(t===0&&bridgeAt(t,x))return hillBridgeHeight(x);const bridge=bridgeAt(t,x);if(!bridge)return rawTerrain(t,x);const [a,b]=bridge,u=(x-a)/(b-a);let sag=Math.sin(Math.PI*u)*5;for(const c of (typeof cars==='undefined'?[]:cars)){if(!c.alive||c.x<a||c.x>b)continue;const carU=(c.x-a)/(b-a),distance=u-carU,width=.115,vehicle=VEHICLES[c.model],load=vehicle?32*Math.sqrt(vehicle.mass/900):32,weight=load*Math.exp(-.5*(distance/width)**2),wave=.88+.12*Math.sin(time*13-distance*18);sag+=weight*wave+4*Math.sin(time*10-distance*22)*Math.exp(-Math.abs(distance)/.24)}return mapTerrain(t,x)+sag}
function mountainPeak(cell,layer){const periods=[510,690,860],period=periods[layer],center=(cell+.5+(hash(cell,830+layer)-.5)*.52)*period,skip=hash(cell,840+layer)<.12,height=(68+hash(cell,850+layer)*102)*(1-layer*.19),left=period*(.38+hash(cell,860+layer)*.2),right=period*(.38+hash(cell,870+layer)*.2);return {center,skip,height,left,right}}
function mountainHeight(wx,layer){const period=[510,690,860][layer],cell=Math.floor(wx/period);let h=0;for(let k=cell-2;k<=cell+2;k++){const p=mountainPeak(k,layer);if(p.skip)continue;const d=wx-p.center,r=d<0?p.left:p.right,u=Math.max(0,1-Math.abs(d)/r);h=Math.max(h,p.height*Math.pow(u,.76))}return h+smoothNoise(wx/(74+layer*25),layer+881)*4}
let mapSkyRaster=null;const mapCloudRasters=new Map();
function paintMapSky(b){
 const p=PALETTES[b],sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,p.sky[0]);sky.addColorStop(.62,p.sky[1]);sky.addColorStop(1,b==='moon'?'#555b6b':'#f4efd9');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 if(b==='moon'){for(let j=0;j<110;j++)circle((j*137.37)%W,(j*j*19.7)%(H*.66),j%5?1:2,'#fff9');const g=ctx.createRadialGradient(W*.82,118,12,W*.82,118,78);g.addColorStop(0,'#e7f6ff');g.addColorStop(.58,'#8ad4e5');g.addColorStop(1,'#70aebe00');ctx.fillStyle=g;ctx.fillRect(W*.72,40,200,160);circle(W*.82,118,42,'#9bdeec');ctx.save();ctx.globalAlpha=.7;path([[W*.8,79],[W*.81,116],[W*.835,129],[W*.833,153],[W*.815,133],[W*.79,124]],'#66a785');ctx.restore();}
 else{const sun=ctx.createRadialGradient(W*.82,120,8,W*.82,120,95);sun.addColorStop(0,b==='winter'?'#fffef3':'#fff9dc');sun.addColorStop(.42,b==='winter'?'#fffbe8':'#fff1bf');sun.addColorStop(1,'#fff1bd00');ctx.fillStyle=sun;ctx.fillRect(W*.7,18,250,205);circle(W*.82,120,39,b==='winter'?'#fffdf1':'#fff3c6');}
}
function mapSkyTexture(b){const key=b+':'+W+':'+H+':'+renderRatio;if(mapSkyRaster?.key===key)return mapSkyRaster.surface;const surface=document.createElement('canvas');surface.width=Math.ceil(W*renderRatio);surface.height=Math.ceil(H*renderRatio);const p=surface.getContext('2d');p.scale(renderRatio,renderRatio);withDrawingContext(p,()=>paintMapSky(b));mapSkyRaster={key,surface};return surface;}
function mapCloudTexture(b,w,h){
 const key=(b==='winter')+':'+w+':'+h+':'+renderRatio;if(mapCloudRasters.has(key))return mapCloudRasters.get(key);
 // Keep the blur in a small reusable bitmap, not six live filters per frame.
 if(mapCloudRasters.size>=12)mapCloudRasters.clear();const pad=32,surface=document.createElement('canvas');surface.width=Math.ceil((w*2+pad*2)*renderRatio);surface.height=Math.ceil((h*2+pad*2)*renderRatio);const p=surface.getContext('2d');p.setTransform(renderRatio,0,0,renderRatio,(w+pad)*renderRatio,(h+pad)*renderRatio);
 withDrawingContext(p,()=>{const cg=ctx.createLinearGradient(0,-h,0,h);cg.addColorStop(0,'#ffffffc9');cg.addColorStop(.7,'#ffffffad');cg.addColorStop(1,b==='winter'?'#dbe9efb0':'#d4edf0aa');ctx.beginPath();ctx.moveTo(-w*.52,h*.18);ctx.bezierCurveTo(-w*.7,-h*.02,-w*.48,-h*.47,-w*.17,-h*.37);ctx.bezierCurveTo(-w*.05,-h*.88,w*.38,-h*.85,w*.42,-h*.31);ctx.bezierCurveTo(w*.77,-h*.4,w*.84,h*.08,w*.57,h*.25);ctx.bezierCurveTo(w*.39,h*.52,-w*.25,h*.52,-w*.52,h*.18);ctx.closePath();ctx.fillStyle=cg;ctx.shadowColor='#537d8a30';ctx.shadowBlur=16;ctx.fill();});
 const raster={surface,left:w+pad,top:h+pad};mapCloudRasters.set(key,raster);return raster;
}
function mapBackground(t,x){if(t===0){drawHillBackground();return}
 const b=mapBiome(t,x),p=PALETTES[b];if(document.body&&document.body.dataset.biome!==b)document.body.dataset.biome=b;
 const sky=mapSkyTexture(b);if(!window.sceneLayers?.sky(sky))ctx.drawImage(sky,0,0,sky.width/renderRatio,sky.height/renderRatio);
 if(b!=='moon')for(let j=0;j<6;j++){const cx=W*(j+.15)/6,cy=92+(j%3)*43,w=118+(j%3)*23,h=42+(j%2)*10,cloud=mapCloudTexture(b,w,h);const dx=Math.round((cx-cloud.left)*renderRatio)/renderRatio,dy=Math.round((cy-cloud.top)*renderRatio)/renderRatio,dw=cloud.surface.width/renderRatio,dh=cloud.surface.height/renderRatio;if(!window.sceneLayers?.bitmap(cloud.surface,dx,dy,dw,dh))ctx.drawImage(cloud.surface,dx,dy,dw,dh);}
 const ridge=layer=>{const speed=.075+layer*.075,base=H*(.37+layer*.15),step=18,pts=[];for(let sx=-step;sx<=W+step;sx+=step){const wx=sx+cam*speed;let y=base;
  if(b==='mountains'||b==='winter'){y-=mountainHeight(wx,layer);y+=smoothNoise(wx/(115+layer*32),layer+901)*7}
  else if(b==='highway')y+=Math.sin(wx/(370-layer*30))*13+smoothNoise(wx/(270+layer*18),layer+911)*11;
  else if(b==='city'){y+=Math.sin(wx/(230-layer*19))*16+Math.sin(wx/91)*6;const lotWidth=78+layer*17,lot=Math.floor(wx/lotWidth),local=((wx%lotWidth)+lotWidth)%lotWidth,buildingHeight=35+hash(lot,layer+811)*(layer===0?115:65);if(local<lotWidth*.78)y-=buildingHeight;}
  else if(b==='moon')y+=Math.sin(wx/(260-layer*28))*40+Math.sin(wx/89)*13;
  else y+=smoothNoise(wx/(245-layer*26),layer+961)*(36-layer*5)+smoothNoise(wx/(84+layer*12),layer+971)*11;pts.push([sx,y])}
  ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(...pts[0]);for(let i=1;i<pts.length;i++)ctx.lineTo(...pts[i]);ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=p.layers[layer];ctx.fill();ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)ctx.lineTo(...pts[i]);ctx.strokeStyle=b==='winter'?'#f5fbff99':b==='moon'?'#b6bfd033':'#e7efd055';ctx.lineWidth=layer===2?2.2:1.4;ctx.stroke();
  if((b==='mountains'||b==='winter')&&layer<2){const period=[510,690,860][layer],first=Math.floor(cam*speed/period)-2,last=Math.ceil((cam*speed+W)/period)+2;for(let k=first;k<=last;k++){const peak=mountainPeak(k,layer);if(peak.skip)continue;const px=peak.center-cam*speed,py=base-peak.height;if(px< -50||px>W+50)continue;const capW=Math.min(68+hash(k,981+layer)*42,peak.left+peak.right)*(.78-layer*.16),capH=Math.min(peak.height*.31,38);path([[px-capW*.46,py+capH*.72],[px-capW*.26,py+capH*.36],[px-capW*.11,py+capH*.48],[px,py+1],[px+capW*.12,py+capH*.39],[px+capW*.24,py+capH*.31],[px+capW*.45,py+capH*.73],[px+capW*.21,py+capH*.63],[px,py+capH*.77],[px-capW*.17,py+capH*.58]],b==='winter'?'#f8fcff':'#eef5f1');path([[px,py+1],[px+capW*.12,py+capH*.39],[px+capW*.24,py+capH*.31],[px+capW*.45,py+capH*.73],[px+capW*.21,py+capH*.63],[px,py+capH*.77]],b==='winter'?'#dbe8ed':'#cbd7d5')}}
  else if(b==='hills'&&layer<2){ctx.save();ctx.globalAlpha=.13;ctx.strokeStyle='#f5f7cf';ctx.lineWidth=2;ctx.beginPath();for(let j=0;j<pts.length;j+=7){const q=pts[j];if(j===0)ctx.moveTo(q[0],q[1]+8);else ctx.lineTo(q[0],q[1]+8)}ctx.stroke();ctx.restore()}
 };for(let l=0;l<3;l++)ridge(l)
}
const envSpriteRasters=new Map();let envSpriteRasterPixels=0;
function drawEnvSprite(index,x,bottom,height,flip=false,angle=0){
 if(!environmentAtlas.complete||!environmentAtlas.naturalWidth)return false;
 if(window.sceneLayers?.active&&(mode==='lobby'?+$('#track').value:track)===0){const crop=ENV_CROPS[index],width=height*crop[2]/crop[3];ctx.save();ctx.translate(x,bottom);ctx.rotate(angle);if(flip)ctx.scale(-1,1);window.sceneLayers.bitmap(hillTexture(environmentAtlas,crop,512),-width/2,-height,width,height,0,'env:'+index+':'+x+':'+bottom);ctx.restore();return true;}
 const matrix=ctx.getTransform(),pixelScale=Math.hypot(matrix.a,matrix.b),factor=Math.max(.25,Math.abs(zoom-1)<1e-6?pixelScale:Math.round(pixelScale*20)/20),pixels=Math.max(1,Math.round(height*factor)),rotation=Math.round(angle*1000)/1000,key=index+':'+pixels+':'+factor+':'+flip+':'+rotation;
 let raster=envSpriteRasters.get(key);
 if(!raster){
  const [sx,sy,sw,sh]=ENV_CROPS[index],w=pixels*sw/sh,h=pixels,c=Math.cos(rotation),sn=Math.sin(rotation),corners=[[-w/2,-h],[w/2,-h],[-w/2,0],[w/2,0]].map(([a,b])=>[a*c-b*sn,a*sn+b*c]);
  const left=Math.floor(Math.min(...corners.map(p=>p[0])))-2,top=Math.floor(Math.min(...corners.map(p=>p[1])))-2,width=Math.ceil(Math.max(...corners.map(p=>p[0])))-left+2,rasterHeight=Math.ceil(Math.max(...corners.map(p=>p[1])))-top+2;
  const surface=document.createElement('canvas');surface.width=width;surface.height=rasterHeight;const p=surface.getContext('2d');p.translate(-left,-top);p.rotate(rotation);if(flip)p.scale(-1,1);p.imageSmoothingEnabled=true;p.drawImage(hillTexture(environmentAtlas,ENV_CROPS[index],512),-w/2,-h,w,h);
  const area=width*rasterHeight;while(envSpriteRasters.size&&(envSpriteRasterPixels+area>12000000||envSpriteRasters.size>=64)){const old=envSpriteRasters.keys().next().value;envSpriteRasterPixels-=envSpriteRasters.get(old).area;envSpriteRasters.delete(old);}
  raster={surface,left,top,area};envSpriteRasters.set(key,raster);envSpriteRasterPixels+=area;
 }
 // These decorations sit in an unrotated world view. Align the cached bitmap
 // to backing pixels to avoid another software resample while the camera pans.
 const px=matrix.b===0&&matrix.c===0?(Math.round(matrix.a*x+matrix.e)-matrix.e)/matrix.a:x,py=matrix.b===0&&matrix.c===0?(Math.round(matrix.d*bottom+matrix.f)-matrix.f)/matrix.d:bottom;
 ctx.drawImage(raster.surface,px+raster.left/factor,py+raster.top/factor,raster.surface.width/factor,raster.surface.height/factor);return true;
}
function pine(x,y,size,snow,angle=0){const h=145*size;if(drawEnvSprite(snow?8+Math.floor(hash(Math.round(x/50),43)*4):4+Math.floor(hash(Math.round(x/50),41)*4),x,y,h,hash(Math.round(x),44)>.5,angle))return;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);ctx.fillStyle='#6d5946';ctx.fillRect(-5,-100,10,100);for(let j=0;j<4;j++){const yy=-145+j*29,w=24+j*12;path([[0,yy],[-w,yy+57],[w,yy+57]],snow?'#527980':'#326348','#284e43',1)}ctx.restore()}
function building(x,y,height,width,variant=0){const palette=[['#40515d','#718590','#e8c98c'],['#55505a','#93827d','#f2d7a0'],['#394c55','#728d8c','#d5e1b0'],['#545d67','#8d9ba1','#f2c77e']][variant%4],left=x-width/2,top=y-height;ctx.fillStyle='#273b43';ctx.fillRect(left-4,top-5,width+8,8);ctx.fillStyle=palette[0];ctx.fillRect(left,top,width,height);ctx.fillStyle=palette[1];ctx.fillRect(left+5,top+5,width-10,height-7);ctx.fillStyle='#ffffff18';ctx.fillRect(left+8,top+6,Math.max(4,width*.16),height-12);const floors=Math.max(2,Math.floor(height/34)),cols=Math.max(2,Math.floor(width/27));for(let r=0;r<floors;r++)for(let c=0;c<cols;c++){const wx=left+12+c*(width-24)/cols,wy=top+17+r*(height-28)/floors;ctx.fillStyle=hash(Math.floor(x+wx+wy),variant+71)>.2?palette[2]+'cc':'#263c49';ctx.fillRect(wx,wy,Math.min(13,(width-25)/cols),Math.min(17,(height-30)/floors))}ctx.fillStyle='#303f45';ctx.fillRect(left-2,y-4,width+4,5);if(variant%3===0){ctx.fillStyle='#41494a';ctx.fillRect(x-2,top-18,4,15);ctx.beginPath();ctx.arc(x,top-20,3,0,Math.PI*2);ctx.fillStyle='#f9d895';ctx.fill()}}
function mapScenery(t,left,right){
 const first=Math.floor(left/184)-1,last=Math.ceil(right/184)+1;
 for(let cell=first;cell<=last;cell++){const anchor=cell*184,roll=hash(cell,601);if(roll<.19)continue;const x=anchor+24+hash(cell,602)*136;if(x<left-150||x>right+150)continue;const b=mapBiome(t,x),gap=bridgeAt(t,x);if(gap&&x>gap[0]-110&&x<gap[1]+110)continue;const y=terrain(x)+12,variant=Math.floor(hash(cell,603)*4),flip=hash(cell,604)>.5,angle=Math.max(-.22,Math.min(.22,Math.atan((terrain(x+24)-terrain(x-24))/48)*.55));
  if(t===0){drawHillTree(cell,x,angle);continue}
  if(b==='hills'){const h=190+hash(cell,605)*120;drawEnvSprite(variant,x,y,h,flip,angle);if(hash(cell,606)>.58){const sx=x+(hash(cell,607)>.5?1:-1)*(65+hash(cell,608)*55);if(!bridgeAt(t,sx))drawEnvSprite(Math.floor(hash(cell,609)*4),sx,terrain(sx)+12,118+hash(cell,610)*58,flip,Math.max(-.22,Math.min(.22,Math.atan((terrain(sx+24)-terrain(sx-24))/48)*.55)))}}
  else if(b==='mountains'||b==='winter'){const h=(b==='winter'?205:190)+hash(cell,611)*100;pine(x,y,h/145,b==='winter',angle);if(hash(cell,612)>.5){const rock=12+Math.floor(hash(cell,613)*2),rh=38+hash(cell,614)*48;drawEnvSprite(rock,x+(flip?1:-1)*(45+hash(cell,615)*54),terrain(x+(flip?1:-1)*75)+10,rh,flip,angle)}}
  else if(b==='city'){building(x,y,118+hash(cell,616)*185,62+hash(cell,617)*68,variant);if(hash(cell,618)>.58)building(x+110+hash(cell,619)*55,terrain(x+150)-5,70+hash(cell,620)*110,48+hash(cell,621)*28,variant+1)}
  else if(b==='highway'){if(hash(cell,622)>.44){ctx.fillStyle='#d9ddd1';ctx.fillRect(x,y-58,5,58);ctx.fillStyle='#3d665c';ctx.fillRect(x-28,y-78,72,30);ctx.strokeStyle='#f2e8c7';ctx.lineWidth=2;ctx.strokeRect(x-28,y-78,72,30);ctx.fillStyle='#fff8df';ctx.font='bold 13px Arial';ctx.fillText(hash(cell,623)>.5?'→  12 km':'R-07',x-20,y-59)}else{ctx.fillStyle='#e8e3ca';ctx.fillRect(x,y-20,4,20);ctx.fillStyle='#efcc72';ctx.beginPath();ctx.arc(x+2,y-24,5,0,Math.PI*2);ctx.fill()}}
  else if(b==='moon'){const rock=12+Math.floor(hash(cell,624)*2);drawEnvSprite(rock,x,y,56+hash(cell,625)*64,flip,angle);if(hash(cell,626)>.7){ctx.strokeStyle='#8995a1';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+45,y);ctx.lineTo(x+52,y-34-hash(cell,627)*22);ctx.lineTo(x+59,y);ctx.stroke()}}
  if(b==='hills'||b==='winter'){for(let j=0;j<3;j++){if(hash(cell*7+j,628)<.45)continue;const fx=x-70+j*54+(hash(cell+j,629)-.5)*28,fy=terrain(fx)+9;drawEnvSprite(15,fx,fy,24+hash(cell+j,630)*22,flip,Math.max(-.18,Math.min(.18,Math.atan((terrain(fx+18)-terrain(fx-18))/36)*.45)))}}
 }
}
function drawWater(t,a,b,left,right,bottom){
 const mid=(a+b)*.5,level=mapTerrain(t,mid)+142,x1=Math.max(left,a-120),x2=Math.min(right,b+120),bank1=mapTerrain(t,x1)+5,bank2=mapTerrain(t,x2)+5;if(x2<=x1)return;
 const depth=Math.min(245,Math.max(170,b-a)*.42),deep=level+depth;
 ctx.save();ctx.beginPath();ctx.moveTo(x1,bank1);ctx.bezierCurveTo(x1+18,bank1+42,x1+35,level+24,x1+76,level);ctx.lineTo(x2-76,level);ctx.bezierCurveTo(x2-35,level+24,x2-18,bank2+42,x2,bank2);ctx.bezierCurveTo(x2-18,bank2+112,x2-60,deep+20,mid,deep+26);ctx.bezierCurveTo(x1+60,deep+20,x1+18,bank1+112,x1,bank1);ctx.closePath();
 const g=ctx.createLinearGradient(0,level-5,0,deep+25);g.addColorStop(0,'#92d2d3');g.addColorStop(.1,'#55b5c2');g.addColorStop(.48,'#287f9b');g.addColorStop(1,'#194e70');ctx.fillStyle=g;ctx.fill();ctx.clip();
 const surface=ctx.createLinearGradient(0,level,0,level+42);surface.addColorStop(0,'#d9f0d5aa');surface.addColorStop(.45,'#9ce0dc77');surface.addColorStop(1,'#9ce0dc00');ctx.fillStyle=surface;ctx.fillRect(x1,level-3,x2-x1,46);
 for(let j=0;j<10;j++){const y=level+11+j*18+Math.sin(time*.8+j)*3,span=38+(j*19%100),shift=((time*(10+j%4)+j*47)%(x2-x1+span))-span;ctx.beginPath();ctx.moveTo(x1+shift,y);ctx.bezierCurveTo(x1+shift+span*.3,y-2,x1+shift+span*.7,y+2,x1+shift+span,y);ctx.strokeStyle=j<2?'#e2f4dcb0':'#b9e8e766';ctx.lineWidth=j<2?2:1;ctx.stroke()}
 for(let j=0;j<14;j++){const rx=x1+((j*61+time*7)%(x2-x1)),ry=level+26+(j*29%(depth-36));ctx.fillStyle=j%3?'#b9e9e333':'#eff8d940';ctx.fillRect(rx,ry,2+j%3,7+j%12)}ctx.restore();
 ctx.strokeStyle='#c9a06a';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x1-6,bank1);ctx.quadraticCurveTo(x1+20,level+13,x1+58,level+2);ctx.moveTo(x2-58,level+2);ctx.quadraticCurveTo(x2-20,level+13,x2+6,bank2);ctx.stroke()
}
function drawSuspensionBridge(a,b,biome){if(track===0){drawHillBridge(a,b);return}
 const span=b-a,deck=x=>groundHeight(track,x),anchor=x=>mapTerrain(track,x),x1=a+span*.25,x2=b-span*.25,mid=(a+b)*.5,top1=anchor(x1)-145,top2=anchor(x2)-145,centerCable=anchor(mid)-84;
 drawWater(track,a,b,a-110,b+110,Math.max(top1,top2)+430);
 const cableY=x=>{const knots=[[a,anchor(a)-24],[x1,top1],[mid,centerCable],[x2,top2],[b,anchor(b)-24]];for(let i=0;i<knots.length-1;i++){const [ax,ay]=knots[i],[bx,by]=knots[i+1];if(x<=bx){const u=Math.max(0,Math.min(1,(x-ax)/(bx-ax)));return ay+(by-ay)*u}}return anchor(b)-24};
 for(const off of [-12,12]){ctx.beginPath();ctx.moveTo(a,anchor(a)-24+off);ctx.quadraticCurveTo(a+(x1-a)*.42,top1+off,x1,top1+off);ctx.quadraticCurveTo(x1+(mid-x1)*.52,centerCable-12+off,mid,centerCable+off);ctx.quadraticCurveTo(mid+(x2-mid)*.48,top2-12+off,x2,top2+off);ctx.quadraticCurveTo(x2+(b-x2)*.58,anchor(b)-10+off,b,anchor(b)-24+off);ctx.strokeStyle=off<0?'#354a50':'#829095';ctx.lineWidth=off<0?5:2;ctx.stroke()}
 for(const [tx,top] of [[x1,top1],[x2,top2]]){const y=anchor(tx);ctx.fillStyle='#38484b';ctx.fillRect(tx-9,top-4,18,y-top+6);ctx.fillStyle=biome==='hills'?'#ad895b':'#aab7b8';ctx.fillRect(tx-20,top-7,40,9);ctx.fillStyle='#6e7c79';ctx.fillRect(tx-15,top+7,4,y-top-9);ctx.fillRect(tx+11,top+7,4,y-top-9);ctx.strokeStyle='#d7c08e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(tx-9,top+10);ctx.lineTo(tx+9,y-12);ctx.moveTo(tx+9,top+10);ctx.lineTo(tx-9,y-12);ctx.stroke();ctx.fillStyle='#4a5552';ctx.fillRect(tx-23,y+5,46,10);ctx.fillStyle='#625746';ctx.fillRect(tx-17,y+14,7,166);ctx.fillRect(tx+10,y+14,7,166)}
 for(let x=a+5;x<b;x+=10){if(x<x1-5||x>x2+5)continue;const y=deck(x),wire=cableY(x);ctx.strokeStyle='#6c7774';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,wire+3);ctx.lineTo(x,y-9);ctx.stroke()}
 ctx.beginPath();ctx.moveTo(a,deck(a)+5);for(let x=a+5;x<=b;x+=5)ctx.lineTo(x,deck(x)+5);ctx.strokeStyle='#352f29';ctx.lineWidth=18;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();ctx.beginPath();ctx.moveTo(a,deck(a));for(let x=a+5;x<=b;x+=5)ctx.lineTo(x,deck(x));ctx.strokeStyle=biome==='hills'?'#a87843':'#89979a';ctx.lineWidth=11;ctx.stroke();ctx.lineCap='butt';
 for(let x=a+4;x<b;x+=12){const y=deck(x);ctx.strokeStyle=x%2?'#d8bd89':'#80623e';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,y-2);ctx.lineTo(x,y+6);ctx.stroke()}
 ctx.strokeStyle='#443d34';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a,deck(a)-23);ctx.lineTo(x1,deck(x1)-22);ctx.lineTo(x2,deck(x2)-22);ctx.lineTo(b,deck(b)-23);ctx.stroke();for(let x=a+12;x<b;x+=26){const y=deck(x);ctx.strokeStyle='#675847';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-21);ctx.lineTo(x,y-2);ctx.stroke()}
}
function drawCityBridge(a,b){const mid=(a+b)*.5,deck=x=>groundHeight(track,x),level=mapTerrain(track,mid)+145;drawWater(track,a,b,a-150,b+150,level+360);ctx.strokeStyle='#59636a';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(a,deck(a)+3);ctx.quadraticCurveTo(mid,deck(mid)+34,b,deck(b)+3);ctx.stroke();ctx.strokeStyle='#bac0bd';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(a,deck(a));ctx.quadraticCurveTo(mid,deck(mid)+28,b,deck(b));ctx.stroke();for(const x of [a+(b-a)*.25,a+(b-a)*.75]){ctx.fillStyle='#66747b';ctx.fillRect(x-9,deck(x)+8,18,level-deck(x)-2);ctx.fillStyle='#9ba6a7';ctx.fillRect(x-20,deck(x)+5,40,8)}for(let x=a+12;x<b;x+=30){ctx.strokeStyle='#68777b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,deck(x)-2);ctx.lineTo(x,deck(x)-24);ctx.stroke()}}

// Cache only static banks. Loaded bridges remain live physics and live geometry.
// Fixed world-space tiles also stop soil detail from shimmering as the camera moves.
const groundTiles=new Map();let groundTilePixels=0,groundTileSeed=null;
function drawGround(t,left,right,bottom,flat=false){
 if(flat||bridgesInRange(t,left-600,right+600).length||t===6&&biomeBoundaries(left-600,right+600).length){drawGroundRaw(t,left,right,bottom,flat);return;}
 if(groundTileSeed!==worldSeed){groundTiles.clear();groundTilePixels=0;groundTileSeed=worldSeed;}
 const transform=ctx.getTransform(),pixelScale=Math.hypot(transform.a,transform.b),factor=Math.abs(zoom-1)<1e-6?pixelScale:Math.max(.25,Math.round(pixelScale*20)/20),size=512;
 for(let tile=Math.floor(left/size);tile<=Math.floor(right/size);tile++){
  const x=tile*size,key=t+':'+tile+':'+factor;let raster=groundTiles.get(key);
  if(!raster){
   let high=Infinity,low=-Infinity;for(let wx=x-24;wx<=x+size+24;wx+=4){const y=rawTerrain(t,wx);high=Math.min(high,y);low=Math.max(low,y);}
   const top=Math.floor(high)-20,end=Math.ceil(low)+230,height=end-top,surface=document.createElement('canvas');surface.width=Math.ceil(size*factor);surface.height=Math.ceil(height*factor);
   const paint=surface.getContext('2d');paint.setTransform(factor,0,0,factor,-x*factor,-top*factor);withDrawingContext(paint,()=>drawGroundRaw(t,x-24,x+size+24,end));
   const pixels=surface.width*surface.height;while(groundTiles.size&&(groundTilePixels+pixels>24000000||groundTiles.size>=32)){const old=groundTiles.keys().next().value;groundTilePixels-=groundTiles.get(old).pixels;groundTiles.delete(old);}
   raster={surface,top,end,pixels};groundTiles.set(key,raster);groundTilePixels+=pixels;
  }else{groundTiles.delete(key);groundTiles.set(key,raster);}
  // The raster covers all detail; the remaining underground is a solid colour.
  ctx.fillStyle=PALETTES[mapBiome(t,x+size/2)].soil;if(bottom>raster.end)ctx.fillRect(x,raster.end-1,size,bottom-raster.end+1);
  const px=transform.b===0&&transform.c===0?(Math.round(transform.a*x+transform.e)-transform.e)/transform.a:x,py=transform.b===0&&transform.c===0?(Math.round(transform.d*raster.top+transform.f)-transform.f)/transform.d:raster.top;
  ctx.drawImage(raster.surface,px,py,raster.surface.width/factor,raster.surface.height/factor);
 }
}
function drawGroundRaw(t,left,right,bottom,flat=false){
 const surfaceHeight=flat?()=>0:x=>groundHeight(t,x);
 ctx.save();if(t===0&&!flat){clipHillBanks(left,right,bottom)}
 const bounds=[left,...(t===6?biomeBoundaries(left,right):[]),right];
 for(let j=0;j<bounds.length-1;j++){const a=bounds[j],b=bounds[j+1],p=PALETTES[mapBiome(t,(a+b)/2)],pts=[[a,bottom]];for(let x=a;x<b;x+=6)pts.push([x,surfaceHeight(x)]);pts.push([b,surfaceHeight(b)],[b,bottom]);path(pts,p.soil)}
 for(let cell=Math.floor(left/58)-1;cell<=Math.ceil(right/58)+1;cell++){const x=cell*58+hash(cell,721)*58,b=mapBiome(t,x),y=surfaceHeight(x),count=b==='moon'?4:3;for(let j=0;j<count;j++){const px=x+(hash(cell*5+j,722)-.5)*46,py=y+24+j*(b==='moon'?48:37)+hash(cell+j,723)*21,w=3+hash(cell+j,724)*(b==='moon'?10:7),h=2+hash(cell+j,725)*4,shade=hash(cell+j,726);ctx.beginPath();ctx.moveTo(px-w,py);ctx.lineTo(px-w*.35,py-h);ctx.lineTo(px+w*.72,py-h*.55);ctx.lineTo(px+w,py+h*.2);ctx.lineTo(px-w*.45,py+h);ctx.closePath();ctx.fillStyle=b==='moon'?(shade>.5?'#b9bdc766':'#555c6d99'):b==='winter'?(shade>.55?'#f3fbff9c':'#718c9a77'):b==='city'?(shade>.55?'#c3b49a77':'#665e5688'):(shade>.5?'#c4996177':'#6d593f88');ctx.fill()}if(b==='city'&&hash(cell,727)>.35){ctx.strokeStyle='#665e5655';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-18,y+120+hash(cell,728)*45);ctx.lineTo(x+25,y+120+hash(cell,729)*45);ctx.stroke()}}
 for(let j=0;j<bounds.length-1;j++){const a=bounds[j],b=bounds[j+1],p=PALETTES[mapBiome(t,(a+b)/2)];ctx.beginPath();ctx.moveTo(a,surfaceHeight(a));for(let x=a+5;x<b;x+=5)ctx.lineTo(x,surfaceHeight(x));ctx.lineTo(b,surfaceHeight(b));ctx.lineWidth=14;ctx.strokeStyle=p.edge;ctx.stroke();ctx.lineWidth=9;ctx.strokeStyle=p.top;ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle=p.shine;ctx.stroke()}
 for(let x=Math.floor(left/65)*65;x<right;x+=65)if(['city','highway'].includes(mapBiome(t,x))&&(flat||!bridgeAt(t,x))){ctx.beginPath();ctx.moveTo(x,surfaceHeight(x)-2);ctx.lineTo(x+26,surfaceHeight(x+26)-2);ctx.lineWidth=3;ctx.strokeStyle='#f5e4a9';ctx.stroke()}
 ctx.restore();
 if(!flat)for(const [a,b] of bridgesInRange(t,left,right)){const biome=mapBiome(t,(a+b)/2);if(biome==='city')drawCityBridge(a,b);else drawSuspensionBridge(a,b,biome)}
}
function snowing(){return time>=snowStart&&time<snowEnd}
function drawWeather(){const center=cam+W/scale()*.5;if(mapBiome(track,center)!=='winter'||!snowing())return;ctx.fillStyle='#d7e4ef18';ctx.fillRect(0,0,W,H);for(let j=0;j<150;j++){const x=((j*137.1+time*(18+j%7)*1.8+Math.sin(time+j)*20)%W+W)%W,y=(j*53+time*(55+j%35))%H;circle(x,y,1+j%3*.5,'#ffffffcf')}}



;

// vehicles.js
'use strict';
const VEHICLES=[
 {name:'Willys MB',powerHp:60,specLabel:'Willys MB · справочные',specSource:'https://www.asme.org/wwwasmeorg/media/ResourceFiles/AboutASME/Who%20We%20Are/Engineering%20History/Landmarks/152-Jeep-Model-MB-1947.pdf',topSpeedKph:105,kind:'jeep',lift:0,radius:18,wheels:[-31,31],mass:1113,engine:200,maxSpeed:680,spring:95,damper:12,mount:18,travel:12,grip:1.65,rotation:1,drag:.04,bodyScale:1,description:'Willys MB — лёгкий армейский джип: 60 л.с. (gross), около 1 113 кг, до 105 км/ч. Полный привод, мягкая подвеска; кузов стилизован под прототип.'},
 {name:'Песчаный багги',kind:'buggy',driveAxles:[0],lift:0,radius:21,wheels:[-35,35],mass:580,engine:720,maxSpeed:720,spring:52,damper:8,mount:22,travel:20,grip:1.7,rotation:1.25,drag:.42,bodyScale:1.1,description:'Лёгкий багги с задним приводом и длинным ходом подвески. Быстро разгоняется, охотно прыгает и требует аккуратного баланса в воздухе.'},
 {name:'Пикап 6×6',kind:'pickup',lift:0,radius:22,wheels:[-50,0,50],mass:1600,engine:1450,maxSpeed:560,spring:110,damper:15,mount:24,travel:15,grip:1.85,rotation:.65,drag:.7,bodyScale:1.4,description:'Тяжёлый грузовик с приводом на все шесть колёс. Три оси помогают удерживать контакт с дорогой и преодолевать крутые подъёмы.'},
 {name:'Ралли',kind:'rally',lift:0,radius:16,wheels:[-34,34],mass:760,engine:950,maxSpeed:830,spring:135,damper:16,mount:14,travel:8,grip:1.95,rotation:.85,drag:.32,bodyScale:1.08,description:'Быстрый раллийный автомобиль с полным приводом. Жёсткая подвеска хороша для скоростных участков, но требует аккуратности на крупных неровностях.'},
 {name:'Монстр-трак 8×8',kind:'monster',lift:0,radius:28,wheels:[-93,-31,31,93],mass:2800,engine:2650,maxSpeed:490,spring:150,damper:21,mount:32,travel:24,grip:2.15,rotation:.48,drag:1,bodyScale:2,description:'Мощный монстр-трак с четырьмя ведущими осями и огромными колёсами. Устойчив на препятствиях, но большая масса ограничивает скорость и манёвренность.'},
 {name:'Хот-род',kind:'hotrod',driveAxles:[0],lift:2,radius:19,wheelRadii:[24,15],wheels:[-38,38],mass:1050,engine:1400,maxSpeed:950,spring:145,damper:12,mount:18,travel:9,grip:1.75,rotation:1.15,drag:.25,bodyScale:1.18,description:'Быстрый хот-род с большими задними и маленькими передними колёсами. Резкий газ легко поднимает нос — следите за балансом на подъёмах.'},
 {name:'Турборакета',kind:'rocket',lift:0,radius:14,wheels:[-33,33],mass:980,engine:820,maxSpeed:3000,spring:115,damper:14,mount:16,travel:10,grip:1.7,rotation:.8,drag:.4,bodyScale:1.15,rocket:true,description:'Вымышленный реактивный автомобиль. Газ включает тягу вдоль корпуса, в воздухе газ поднимает нос, тормоз опускает. Игровой предел скорости — 320 км/ч; расход топлива повышен.'},
 {name:'Фургон Ozon · ГАЗель NEXT',kind:'van',lift:0,radius:12,wheels:[-53,53],driveAxles:[0],powerHp:106.8,specSource:'https://www.avtogaz.ru/models/gazelle-next/gazelle-next-cmf/specifications/',mass:2725,engine:450,maxSpeed:1220.7,spring:200,damper:24,mount:12,travel:8,grip:1.45,rotation:.42,drag:.08,bodyScale:1.08,description:'Тяжёлый цельнометаллический фургон с задним приводом: 2 725 кг, 106,8 л.с., дорожный просвет 170 мм и скорость до 130 км/ч.'},
 {name:'Mitsubishi Lancer Evolution X GSR',kind:'evo',powerHp:295,topSpeedKph:240,specLabel:'Evo X GSR · заводские',specSource:'https://mitsubishi-motors.bg/ckfinder/userfiles/files/3_lancer_evo_new(1).pdf',lift:0,radius:11.5,wheels:[-44.8,44.8],mass:1560,engine:350,maxSpeed:2254,spring:140,damper:18,mount:12,travel:7,grip:1.95,rotation:.7,drag:.005,bodyScale:1.08,description:'Mitsubishi Lancer Evolution X GSR (Европа, 5-МКПП): 2.0 турбо, 295 л.с., 366 Н·м, 1 560 кг, 240 км/ч, полный привод S-AWC. Заводской разгон 0–100 км/ч — 5,4 с; физика игры упрощена.'}
];

// Calibrate the shared world scale against the classic Jeep drawing.
// Its bumper-to-bumper span is 112.592 world units (see race-art.js anchors).
// Reference: a short Willys MB, about 3.33 m long; art is stylised, not a replica.
const REFERENCE_JEEP_LENGTH_METRES=3.33;
const REFERENCE_JEEP_WORLD_LENGTH=112.592;
const WORLD_UNITS_PER_METRE=REFERENCE_JEEP_WORLD_LENGTH/REFERENCE_JEEP_LENGTH_METRES;
// Fictional rocket tuning, expressed in km/h to keep the garage and physics in sync.
VEHICLES.find(v=>v.rocket).topSpeedKph=320;
for(const v of VEHICLES)if(v.topSpeedKph)v.maxSpeed=v.topSpeedKph/3.6*WORLD_UNITS_PER_METRE;
function worldMetres(units){return units/WORLD_UNITS_PER_METRE}
function speedKph(velocity){return Math.abs(worldMetres(velocity))*3.6}
function raceMetres(c){return Math.max(0,worldMetres(c.x-c.startX))}

const vehicleGeometry=new WeakMap();
function geometry(v){
 const appearance=i=>typeof wheelAppearance==='function'?wheelAppearance(v,i):null;
 let entry=vehicleGeometry.get(v);
 if(entry&&entry.mount===v.mount&&entry.radius===v.radius&&entry.mass===v.mass&&entry.baseX.length===v.wheels.length&&entry.baseX.every((x,i)=>{const a=appearance(i);return x===v.wheels[i]&&entry.baseR[i]===(v.wheelRadii?.[i]??v.radius)&&entry.alignment[i][0]===(a?.x??0)&&entry.alignment[i][1]===(a?.y??0)&&entry.alignment[i][2]===(a?.scale??1)}))return entry;
 const base=v.wheels.map((x,i)=>({x,y:v.mount,r:v.wheelRadii?.[i]??v.radius})),values=base.map((_,i)=>{const a=appearance(i);return [a?.x??0,a?.y??0,a?.scale??1]});
 const wheels=base.map((w,i)=>({x:w.x+values[i][0],y:w.y+values[i][1],r:w.r*values[i][2]})),xs=wheels.map(w=>w.x),span=Math.max(10,Math.max(...xs)-Math.min(...xs));
 entry={base,wheels,baseX:[...v.wheels],baseR:base.map(w=>w.r),mount:v.mount,radius:v.radius,mass:v.mass,alignment:values,inertia:1120*(v.mass/900)*(span/62)**2,axles:v.wheels.map((_,i)=>i)};vehicleGeometry.set(v,entry);return entry;
}
function drivenAxles(v){return v.driveAxles??geometry(v).axles}
function driveLabel(v){const axles=drivenAxles(v);return v.wheels.length*2+'×'+axles.length*2+(axles.length===1?(axles[0]===0?' · задний':' · передний'):' · полный')}
function vehicleStats(v){return [['Макс. скорость',Math.round(speedKph(v.maxSpeed))+' км/ч'],['Мощность',v.powerHp?v.powerHp+' л.с.':'Не задана'],['Масса',v.mass+' кг'],['Привод',driveLabel(v)],['Колёса / оси',v.wheels.length*2+' / '+v.wheels.length],['Характеристики',v.specLabel??(v.specSource?'ГАЗель NEXT · заводские':'Игровая модель')]]}
function carSpec(c){return VEHICLES[c.model??vehicleModel]}
function baseWheelSpecs(v){return geometry(v).base}
function wheelSpecs(v){return geometry(v).wheels}
function inertia(v){return geometry(v).inertia}
function describeVehicle(){const v=VEHICLES[+$('#vehicle').value];$('#vehicle-description').textContent=v.description+(v.specSource?'':' Характеристики условные: точный серийный прототип не задан.');$('#vehicle-stats').textContent=vehicleStats(v).map(([label,value])=>label+': '+value).join(' · ')}
let vehicleModel=0;
const suspensionVisuals=new WeakMap();
function visualPose(c){const v=carSpec(c),wheels=wheelSpecs(v);let p=suspensionVisuals.get(c);if(!p||p.geometry!==wheels||p.model!==v.kind){p={model:v.kind,geometry:wheels,wheels:wheels.map(w=>w.y),bob:0,lastVY:c.vy,lastVX:c.vx};suspensionVisuals.set(c,p)}return p}
function animateSuspension(dt){if(mode!=='race'||paused||count>0)return;for(const c of cars){if(!c.alive)continue;const v=carSpec(c),wheels=wheelSpecs(v),p=visualPose(c),cos=Math.cos(c.a),sin=Math.sin(c.a);for(let j=0;j<wheels.length;j++){const {x:rx,y:mount,r}=wheels[j],contact=c.contacts.find(w=>w.rx===rx);let target=mount+v.travel;if(contact&&cos>.45){const wx=c.x+rx*cos-mount*sin;target=(terrain(wx)-r-c.y-rx*sin)/cos;target=Math.max(mount-v.travel,Math.min(mount+v.travel,target))}p.wheels[j]+=(target-p.wheels[j])*(1-Math.exp(-dt*(v.spring>110?25:14)))}const bump=Math.max(-3,Math.min(3,(c.vy-p.lastVY)*.055));p.bob+=(-bump-p.bob)*(1-Math.exp(-dt*12));p.lastVY=c.vy;p.lastVX=c.vx}}
function strokeLine(points,color,width){ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt'}
function spring(ax,ay,bx,by){strokeLine([[ax,ay],[bx,by]],'#26312d',5);strokeLine([[ax,ay],[bx,by]],'#a3aaa0',2);const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len,pts=[[ax,ay]];for(let j=1;j<10;j++){const k=j/10,offset=j%2?3:-3;pts.push([ax+dx*k+px*offset,ay+dy*k+py*offset])}pts.push([bx,by]);strokeLine(pts,'#e0cf8b',1.8)}
function seatedDriver(c,lift){
 const im=images[chosen[c.i]],mirror=[0,5].includes(chosen[c.i]);if(!im?.complete||!im.naturalWidth)return;
 const iw=im.naturalWidth,ih=im.naturalHeight;ctx.save();ctx.translate(-6,lift);ctx.imageSmoothingEnabled=true;
 // Keep the original big-head, short-body character proportions. The car body
 // hides the lower half naturally instead of rebuilding a thin driver from crops.
 const height=84,width=height*iw/ih;
 ctx.save();if(mirror)ctx.scale(-1,1);ctx.drawImage(im,-width/2,-66,width,height);ctx.restore();
 ctx.restore();
}

;

// hills.js
'use strict';
// Hills art and bridge simulation are deliberately isolated from the other maps.
const hillArt=queuedGameImage('assets/hills-atlas.webp'),hillSprites=[];
// tops retain placement after trimming transparent rows from the small textures.
const hillLandscapeLayers=[
 {name:'far',sourceHeight:724,tops:[154,291,246],speed:.08,vertical:.055,top:.05,height:.8},
 {name:'middle',sourceHeight:724,tops:[173,255,233],speed:.22,vertical:.16,top:.27,height:.62},
 {name:'near',sourceHeight:724,tops:[153,181,191],speed:.46,vertical:.32,top:.44,height:.5}
].map(layer=>({...layer,images:[0,1,2].map(index=>{return queuedGameImage('assets/hills-'+layer.name+'-'+index+'.webp');})}));
const hillTrees=['hills-oak-clean.webp','hills-birch-clean.webp'].map(name=>{return queuedGameImage('assets/'+name)});
const hillTreeBounds=[[109,98,1062,1107],[26,13,970,1500]];
const hillCrestSun=queuedGameImage('assets/hills-crest-sun.webp');
const hillSunBounds=[108,55,1095,1093];
const hillCloud=queuedGameImage('assets/hills-cloud-clean.webp');
const hillCloudBounds=[127,82,1918,557];
hillArt.onload=()=>{
 // Explicit crop bounds also work in file:// browsers, without reading a tainted canvas.
 const crops=[[13,182,321,600],[334,176,242,597],[576,244,364,526],[940,195,304,575],[16,906,311,178],[327,887,356,197],[683,857,215,244],[911,875,329,256]];
 const sx=hillArt.naturalWidth/1254,sy=hillArt.naturalHeight/1254;
 for(let i=0;i<8;i++){
  const [x,y,w,h]=crops[i];hillSprites[i]=[x*sx,y*sy,w*sx,h*sy];
 }
};

// Upload small, reusable textures instead of resampling multi-megapixel PNGs each frame.
const hillTextureCache=new WeakMap();
function hillTexture(im,crop,height){
 let textures=hillTextureCache.get(im);if(!textures){textures=new Map();hillTextureCache.set(im,textures);}
 const key=crop.join(',')+':'+height;if(textures.has(key))return textures.get(key);
 const [x,y,w,h]=crop,texture=document.createElement('canvas');
 texture.height=Math.min(h,height);texture.width=Math.max(1,Math.round(w*texture.height/h));
 const paint=texture.getContext('2d');paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';paint.drawImage(im,x,y,w,h,0,0,texture.width,texture.height);
 textures.set(key,texture);return texture;
}
function hillSprite(index,x,y,height,angle=0,flip=false,key=null){
 const isCloud=index===4||index===5,im=index<4?hillTrees[index%2]:isCloud?hillCloud:hillArt,crop=index<4?hillTreeBounds[index%2]:isCloud?hillCloudBounds:hillSprites[index];if(!crop||!im.complete||!im.naturalWidth)return;
 const [sx,sy,sw,sh]=crop,width=height*sw/sh;
 ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='medium';ctx.translate(x,y);ctx.rotate(angle);if(flip!==Boolean(isCloud&&index===5))ctx.scale(-1,1);
 const texture=hillTexture(im,crop,isCloud?128:512);if(!window.sceneLayers?.bitmap(texture,-width/2,-height,width,height,0,key))ctx.drawImage(texture,-width/2,-height,width,height);ctx.restore();
}
function paintHillSun(){
 const x=W*.82,y=Math.max(82,H*.17),radius=Math.max(34,Math.min(43,W*.036));
 ctx.save();ctx.translate(x,y);ctx.imageSmoothingEnabled=true;
 const halo=ctx.createRadialGradient(0,0,radius*.5,0,0,radius*3.4);
 halo.addColorStop(0,'#fff6be88');halo.addColorStop(.35,'#ffeb9160');halo.addColorStop(1,'#ffdf6900');
 ctx.fillStyle=halo;ctx.fillRect(-radius*3.4,-radius*3.4,radius*6.8,radius*6.8);
 // The emblem stays upright; only the rays turn, slowly, around its centre.
 ctx.save();ctx.rotate(time*.018);
 const beam=ctx.createLinearGradient(radius*.6,0,radius*3.3,0);
 beam.addColorStop(0,'#fff5bf99');beam.addColorStop(.35,'#ffe68866');beam.addColorStop(.75,'#ffe68822');beam.addColorStop(1,'#ffe68800');
 for(let i=0;i<8;i++){
  ctx.save();ctx.rotate(i*Math.PI/4);
  path([[radius*.6,-radius*.1],[radius*3.3,-radius*.28],[radius*3.3,radius*.28],[radius*.6,radius*.1]],beam);
  ctx.restore();
 }
 ctx.restore();ctx.globalAlpha=1;
 const disk=ctx.createRadialGradient(-radius*.2,-radius*.25,0,0,0,radius);
 disk.addColorStop(0,'#fffef0');disk.addColorStop(.72,'#fff6c2');disk.addColorStop(1,'#ffe398');circle(0,0,radius,disk);
 if(hillCrestSun.complete&&hillCrestSun.naturalWidth){
  const [sx,sy,sw,sh]=hillSunBounds;ctx.save();ctx.beginPath();ctx.arc(0,0,radius*.72,0,Math.PI*2);ctx.clip();ctx.globalAlpha=.12;
  ctx.drawImage(hillCrestSun,sx,sy,sw,sh,-radius*.88,-radius*.88,radius*1.76,radius*1.76);ctx.restore();
 }
 ctx.restore();
}
// The sky stays in screen space; landscape assets are independent opaque cutouts.
let hillBackdrop=null,hillSunRaster=null;
function prepareHillBackground(){
 const ratio=renderRatio,key=W+':'+H+':'+ratio;if(hillBackdrop?.key===key)return hillBackdrop;
 const sky=document.createElement('canvas');sky.width=Math.ceil(W*ratio);sky.height=Math.ceil(H*ratio);
 const paint=sky.getContext('2d'),gradient=paint.createLinearGradient(0,0,0,sky.height);gradient.addColorStop(0,'#73c5ed');gradient.addColorStop(1,'#eaf3df');paint.fillStyle=gradient;paint.fillRect(0,0,sky.width,sky.height);
 hillBackdrop={key,sky};return hillBackdrop;
}
function drawHillSun(){
 const ratio=renderRatio,radius=Math.max(34,Math.min(43,W*.036)),pad=Math.ceil(radius*3.5),x=W*.82,y=Math.max(82,H*.17),key=W+':'+H+':'+ratio;
 if(!hillSunRaster||hillSunRaster.key!==key||Math.abs(time-hillSunRaster.time)>=.25){
  const surface=hillSunRaster?.key===key?hillSunRaster.surface:document.createElement('canvas');surface.width=Math.ceil(pad*2*ratio);surface.height=Math.ceil(pad*2*ratio);
  const p=surface.getContext('2d');p.setTransform(ratio,0,0,ratio,(pad-x)*ratio,(pad-y)*ratio);withDrawingContext(p,paintHillSun);hillSunRaster={key,time,surface};
 }
 const dx=Math.round((x-pad)*ratio)/ratio,dy=Math.round((y-pad)*ratio)/ratio,dw=hillSunRaster.surface.width/ratio,dh=hillSunRaster.surface.height/ratio;if(!window.sceneLayers?.bitmap(hillSunRaster.surface,dx,dy,dw,dh,hillSunRaster.time,'sky:sun'))ctx.drawImage(hillSunRaster.surface,dx,dy,dw,dh);
}
function drawHillLandscape(){
 for(const layer of hillLandscapeLayers){
  if(layer.images.some(im=>!im.complete||!im.naturalWidth))continue;
  const unit=H*layer.height/layer.sourceHeight,total=layer.images.reduce((sum,im)=>sum+im.naturalWidth*unit,0),offset=cam*layer.speed,top=H*layer.top-cameraY*scale()*layer.vertical;
  // Each cycle contains the original panorama plus its generated connecting scene.
  // Chunks are exact neighbouring crops. Every copy faces the same direction.
  for(let cycle=Math.floor(offset/total);cycle<=Math.floor((offset+W)/total);cycle++){
   let x=cycle*total-offset;
   for(let j=0;j<layer.images.length;j++){
    const image=layer.images[j],width=image.naturalWidth*unit,height=image.naturalHeight*unit,y=top+layer.tops[j]*unit;
    if(x+width>=0&&x<=W&&!window.sceneLayers?.bitmap(image,x,y,width+.25,height,0,'landscape:'+layer.name+':'+cycle+':'+j))ctx.drawImage(image,x,y,width+.25,height);
    x+=width;
   }
  }
 }
}
function drawHillBackground(){
 document.body.dataset.biome='hills';const backdrop=prepareHillBackground();
 if(!window.sceneLayers?.sky(backdrop.sky))ctx.drawImage(backdrop.sky,0,0,backdrop.sky.width/renderRatio,backdrop.sky.height/renderRatio);
 ctx.save();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='medium';
 drawHillSun();
 // Sun and cloud positions depend on the viewport only, never the camera or clock.
 const count=W<700?3:5;
 for(let j=0;j<count;j++){
  const x=W*((j+.15)/count),y=H*(.14+(j%3)*.055),height=Math.max(26,Math.min(66,H*(.045+(j%2)*.015)));
  hillSprite(4+j%2,x,y,height,0,false,'sky:cloud:'+j);
 }
 drawHillLandscape();ctx.restore();
}
function drawHillTree(cell,x,angle){
 // Broad clearings alternate with dense groves, determined by the world seed.
 if(hash(Math.floor(cell/4),960)<.4||hash(cell,961)<.22)return;
 const localSlope=(terrain(x+24)-terrain(x-24))/48;
 if(Math.abs(localSlope)>.32||Math.abs(slope(x-14))>.4||Math.abs(slope(x+14))>.4)return;
 angle=Math.max(-.16,Math.min(.16,Math.atan(localSlope)*.6));
 const h=205+hash(cell,962)*95;
 hillSprite(Math.floor(hash(cell,963)*4),x,terrain(x)+6,h,angle,hash(cell,964)>.5);
 if(hash(cell,965)>.58){const bx=x+65;if(!bridgeAt(0,bx)&&Math.abs(slope(bx))<.32)hillSprite(7,bx,terrain(bx)+3,28+hash(cell,966)*22)}
}
const hillBridgeStates=new Map();
function resetHillBridges(){hillBridgeStates.clear()}
function hillBridgeState(a,b){let state=hillBridgeStates.get(a);if(!state){state={a,b,q:[0,0],v:[0,0]};hillBridgeStates.set(a,state)}return state}
function hillBridgeHeight(x){const gap=bridgeAt(0,x);if(!gap)return rawTerrain(0,x);const [a,b]=gap,u=(x-a)/(b-a),state=hillBridgeStates.get(a);return mapTerrain(0,x)+7*Math.sin(Math.PI*u)+(state?state.q[0]*Math.sin(Math.PI*u)+state.q[1]*Math.sin(2*Math.PI*u):0)}
function hillBridgeVelocity(t,x){if(t!==0)return 0;const gap=bridgeAt(0,x);if(!gap)return 0;const state=hillBridgeStates.get(gap[0]);if(!state)return 0;const u=(x-gap[0])/(gap[1]-gap[0]);return state.v[0]*Math.sin(Math.PI*u)+state.v[1]*Math.sin(2*Math.PI*u)}
function updateHillBridges(dt){
 if(track!==0)return;
 for(const c of cars)if(c.alive)for(const wheel of wheelSpecs(carSpec(c))){const x=c.x+wheel.x*Math.cos(c.a)-carSpec(c).mount*Math.sin(c.a),gap=bridgeAt(0,x);if(gap)hillBridgeState(...gap)}
 for(const [key,state] of hillBridgeStates){
  const target=[0,0];
  for(const c of cars){if(!c.alive)continue;const spec=carSpec(c),wheels=wheelSpecs(spec);
   for(const w of wheels){const x=c.x+w.x*Math.cos(c.a)-spec.mount*Math.sin(c.a),y=c.y+w.x*Math.sin(c.a)+spec.mount*Math.cos(c.a)+w.r;
    if(x<=state.a||x>=state.b||Math.abs(y-hillBridgeHeight(x))>22)continue;
    const u=(x-state.a)/(state.b-state.a),load=13*(spec.mass/900)/wheels.length;
    target[0]+=load*Math.sin(Math.PI*u);target[1]+=load*.3*Math.sin(2*Math.PI*u);
   }
  }
  for(let j=0;j<2;j++){const omega=j?13:9,damping=j?13:10;state.v[j]+=(omega*omega*(Math.min(38,Math.max(-38,target[j]))-state.q[j])-damping*state.v[j])*dt;state.q[j]+=state.v[j]*dt}
  if(state.b<cam-1400&&Math.abs(state.q[0])+Math.abs(state.q[1])<.02)hillBridgeStates.delete(key);
 }
}
function clipHillBanks(left,right,bottom){
 ctx.beginPath();let edge=left;
 for(const [a,b] of bridgesInRange(0,left-BRIDGE_CHUNK,right)){if(b<=left||a>=right)continue;if(a>edge)ctx.rect(edge,-10000,a-edge,bottom+10000);edge=Math.max(edge,b)}
 if(edge<right)ctx.rect(edge,-10000,right-edge,bottom+10000);ctx.clip();
}
function drawHillBridge(a,b){
 const deck=hillBridgeHeight,segments=Math.ceil((b-a)/12),step=(b-a)/segments;
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 // Low railing follows exactly the same deformed surface as the wheel contacts.
 for(const dy of [-27,-14]){ctx.beginPath();for(let j=0;j<=segments;j++){const x=a+j*step;j?ctx.lineTo(x,deck(x)+dy):ctx.moveTo(x,deck(x)+dy)}ctx.strokeStyle=dy===-27?'#79563b':'#987148';ctx.lineWidth=3;ctx.stroke()}
 for(let j=0;j<=segments;j+=2){const x=a+j*step,y=deck(x);ctx.strokeStyle='#5d4432';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y-29);ctx.lineTo(x,y+3);ctx.stroke();ctx.strokeStyle='#c49b66';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-1,y-27);ctx.lineTo(x-1,y);ctx.stroke()}
 for(let j=0;j<segments;j++){
  const x1=a+j*step,x2=a+(j+1)*step,y1=deck(x1),y2=deck(x2);
  path([[x1,y1],[x2,y2],[x2,y2+9],[x1,y1+9]],j%3?'#ae8050':'#bf945e','#5c4230',1);
  ctx.strokeStyle='#ead09a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1+1,y1+1);ctx.lineTo(x2-1,y2+1);ctx.stroke();
 }
 ctx.restore();
}

;

// race-art.js
'use strict';
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke()}}
const paintedBodies={};
const TIRE_DRAW_SCALE=1;
const BODY_ART_SCALE=1.18;
const BODY_BOUNDS={"jeep":[22,144,1497,648],"buggy":[30,169,1488,608],"pickup":[12,177,1514,567],"rally":[43,119,1712,634],"monster":[6,157,1527,610],"hotrod":[28,263,1486,469],"rocket":[43,160,1717,538],"van":[44,124,1684,708]};
BODY_BOUNDS.evo=[43,119,1712,634];
for(const kind of Object.keys(BODY_BOUNDS)){const im=queuedGameImage(kind==='jeep'?'assets/car-jeep-open-arches.webp':'assets/car-'+kind+'.webp');paintedBodies[kind]=im}
// Source anchors are wheel-arch centres in each original painting.
const BODY_ANCHORS={
 jeep:{axles:[355,1240],y:710,seat:710,floor:620,size:.48,seatDrop:4},
 buggy:{axles:[245,1270],y:770,seat:750,floor:650,size:.38},
 pickup:{axles:[210,545,1280],y:700,seat:975,floor:585,size:.42},
 rally:{axles:[335,1440],y:690,seat:860,floor:420,size:.25,seatDrop:9},
 monster:{axles:[210,545,1230],y:710,seat:850,floor:540,size:.58},
 hotrod:{axles:[310,1340],y:710,seat:645,floor:520,size:.38,seatDrop:12},
 rocket:{axles:[440,1390],y:690,seat:860,floor:470,size:.35,seatDrop:16},
 evo:{axles:[335,1440],y:690,seat:930,floor:420,size:.25,seatDrop:9},
 van:{axles:[400,1464],y:730,seat:1260,floor:510,size:.38}
};
// Wheel alignment is shared by contact physics, suspension and drawing.
const WHEEL_ALIGNMENT_KEY='hill-rivals-wheel-alignment-v1';
const DEFAULT_WHEEL_ALIGNMENTS={},DEFAULT_DRIVER_ALIGNMENTS={};
let wheelAlignments={...DEFAULT_WHEEL_ALIGNMENTS},wheelAlignmentPreview=null,driverAlignments={...DEFAULT_DRIVER_ALIGNMENTS},driverAlignmentPreview=null;
function validDriverAlignment(raw){const limit=(n,lo,hi,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;return {x:limit(raw?.x,-60,60,0),y:limit(raw?.y,-60,60,0),scale:limit(raw?.scale,.3,2.5,1)}}
const DEFAULT_APPEARANCE=Object.freeze({x:0,y:0,scale:1});
function driverAppearance(v){return driverAlignmentPreview?.[v.kind]??driverAlignments[v.kind]??DEFAULT_APPEARANCE}
function validWheelAlignment(v,raw){return v.wheels.map((_,i)=>{const w=raw?.[i]||{};const limit=(n,lo,hi,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;return {x:limit(w.x,-35,35,0),y:limit(w.y,-35,35,0),scale:limit(w.scale,.4,1.8,1)}})}
try{if(typeof localStorage!=='undefined'){const saved=JSON.parse(localStorage.getItem(WHEEL_ALIGNMENT_KEY)||'{}');for(const v of VEHICLES){if(Array.isArray(saved?.[v.kind]))wheelAlignments[v.kind]=validWheelAlignment(v,saved[v.kind]);if(saved?.__drivers?.[v.kind])driverAlignments[v.kind]=validDriverAlignment(saved.__drivers[v.kind]);}}}catch{}
function wheelAppearance(v,index,alignment=wheelAlignmentPreview?.[v.kind]??wheelAlignments[v.kind]){return alignment?.[index]??DEFAULT_APPEARANCE}
function saveAllWheelAlignments(raw,rawDrivers=driverAlignments){const next=Object.fromEntries(VEHICLES.map(v=>[v.kind,validWheelAlignment(v,raw[v.kind])])),drivers=Object.fromEntries(VEHICLES.map(v=>[v.kind,validDriverAlignment(rawDrivers[v.kind])]));try{localStorage.setItem(WHEEL_ALIGNMENT_KEY,JSON.stringify({...next,__drivers:drivers}));}catch{return false}wheelAlignments=next;driverAlignments=drivers;return true}
function exportWheelAlignments(raw=wheelAlignments,rawDrivers=driverAlignments){return {format:'hill-rivals-wheel-alignment',version:2,vehicles:VEHICLES.map(v=>({kind:v.kind,name:v.name,wheels:validWheelAlignment(v,raw[v.kind]),driver:validDriverAlignment(rawDrivers[v.kind])}))}}
function vehicleBodyRaw(c,v,bob,paint=ctx,wheelYOverride=null){
 const im=paintedBodies[v.kind],crop=BODY_BOUNDS[v.kind],a=BODY_ANCHORS[v.kind];if(!im?.complete||!im.naturalWidth)return;
 // Undo the old model-wide horizontal stretch. The painting's vertical scale comes
 // from its real axle spacing, never an arbitrary rectangular height.
 paint.save();paint.scale(1/v.bodyScale,1);paint.imageSmoothingEnabled=true;
 const specs=baseWheelSpecs(v),pose=visualPose(c),physical=wheelSpecs(v),first=specs[0].x,last=specs[specs.length-1].x;
 const unit=(last-first)/(a.axles[a.axles.length-1]-a.axles[0])*BODY_ART_SCALE;
 const wheelY=wheelYOverride??pose.wheels.reduce((sum,y,j)=>sum+y-(physical[j].y-v.mount)+specs[j].r*(1-TIRE_DRAW_SCALE),0)/pose.wheels.length+bob;
 const top=wheelY+(crop[1]-a.y)*unit,height=crop[3]*unit;
 let strips=[];
 if(v.kind==='monster'){
  // Reuse the painted rear-bed section for the fourth physical axle.
  const s=a.axles;strips=[[crop[0],s[0],first-(s[0]-crop[0])*unit,first],[s[0],s[1],first,specs[1].x],[s[0],s[1],specs[1].x,specs[2].x],[s[1],s[2],specs[2].x,last],[s[2],crop[0]+crop[2],last,last+(crop[0]+crop[2]-s[2])*unit]];
 }else{
  const source=[crop[0],...a.axles,crop[0]+crop[2]],dest=[first-(a.axles[0]-crop[0])*unit,...specs.map(w=>w.x),last+(crop[0]+crop[2]-a.axles[a.axles.length-1])*unit];
  for(let j=0;j<source.length-1;j++)strips.push([source[j],source[j+1],dest[j],dest[j+1]]);
 }
 const mapX=x=>{for(const [s1,s2,x1,x2] of strips)if(x>=s1&&x<=s2)return x1+(x-s1)/(s2-s1)*(x2-x1);return 0};
 const driver=driverAppearance(v),seatX=mapX(a.seat)+driver.x,floor=wheelY+(a.floor-a.y)*unit+(a.seatDrop||0);
 // Enlarge the seated figure while keeping its head at the same cabin height.
 const openCabin=['jeep','buggy','hotrod','rocket'].includes(v.kind);
 const baseDriverSize=a.size*(openCabin?1.32:1.15),driverSize=baseDriverSize*driver.scale,driverFloor=floor+79*(baseDriverSize-a.size)+(openCabin?3:0)+driver.y;
 // Draw the complete seated figure FIRST; the entire body is then in front of it.
 if(!c.emptyCabin){paint.save();paint.beginPath();paint.rect(seatX-40*driver.scale,top-80,80*driver.scale,Math.max(20,driverFloor-top+100));paint.clip();paint.translate(seatX+6*driverSize,driverFloor-13*driverSize);paint.scale(driverSize,driverSize);seatedDriver(c,0);paint.restore();}
 // Wheels are drawn first. Use the painting's own transparent wheel wells;
 // never erase the foreground fenders with a circular wheel mask.
 for(const [s1,s2,x1,x2] of strips)paint.drawImage(im,s1,crop[1],s2-s1,crop[3],x1,top,x2-x1+.15,height);
 paint.restore();
}
// Bake the unchanged body and driver once; suspension only moves the bitmap.
const bodyRasterCache=new Map();let bodyRasterPixels=0;
function vehicleBody(c,v,bob,paint=ctx){
 const im=paintedBodies[v.kind],driver=images[chosen[c.i]];
 if(!im?.complete||!im.naturalWidth)return;
 const m=paint.getTransform(),density=Math.max(1,Math.min(3,Math.ceil(Math.hypot(m.a,m.b)-1e-6))),appearance=driverAppearance(v),key=[v.kind,chosen[c.i],driver?.naturalWidth||0,!!c.emptyCabin,appearance.x,appearance.y,appearance.scale,density].join('|');
 let raster=bodyRasterCache.get(key);
 if(!raster){
  // Derive bounds from the authored crop and driver clip. Never read GPU pixels
  // back to the CPU or scan a multi-megapixel canvas during a race.
  const crop=BODY_BOUNDS[v.kind],anchor=BODY_ANCHORS[v.kind],base=baseWheelSpecs(v),unit=(base.at(-1).x-base[0].x)/(anchor.axles.at(-1)-anchor.axles[0])*BODY_ART_SCALE;
  const bodyLeft=base[0].x-(anchor.axles[0]-crop[0])*unit,bodyRight=base.at(-1).x+(crop[0]+crop[2]-anchor.axles.at(-1))*unit;
  let seat=0;const source=[crop[0],...anchor.axles,crop[0]+crop[2]],dest=[bodyLeft,...base.map(w=>w.x),bodyRight];
  if(v.kind==='monster'){const j=anchor.seat<anchor.axles[1]?0:1;seat=base[j===0?0:2].x+(anchor.seat-anchor.axles[j])/(anchor.axles[j+1]-anchor.axles[j])*(base[j===0?1:3].x-base[j===0?0:2].x);}else for(let j=0;j<source.length-1;j++)if(anchor.seat>=source[j]&&anchor.seat<=source[j+1]){seat=dest[j]+(anchor.seat-source[j])/(source[j+1]-source[j])*(dest[j+1]-dest[j]);break;}
  seat+=appearance.x;const bodyTop=(crop[1]-anchor.y)*unit,bodyBottom=(crop[1]+crop[3]-anchor.y)*unit;
  let minX=bodyLeft,maxX=bodyRight,minY=bodyTop,maxY=bodyBottom;
  if(!c.emptyCabin&&driver?.complete&&driver.naturalWidth){const open=['jeep','buggy','hotrod','rocket'].includes(v.kind),baseSize=anchor.size*(open?1.32:1.15),driverSize=baseSize*appearance.scale,floor=(anchor.floor-anchor.y)*unit+(anchor.seatDrop||0),driverFloor=floor+79*(baseSize-anchor.size)+(open?3:0)+appearance.y,halfWidth=42*driver.naturalWidth/driver.naturalHeight*driverSize;
   minX=Math.min(minX,Math.max(seat-40*appearance.scale,seat-halfWidth));maxX=Math.max(maxX,Math.min(seat+40*appearance.scale,seat+halfWidth));minY=Math.min(minY,Math.max(bodyTop-80,driverFloor-79*driverSize));maxY=Math.max(maxY,Math.min(floor+100,driverFloor+5*driverSize));}
  const left=Math.floor(minX/v.bodyScale)-2,top=Math.floor(minY)-2,right=Math.ceil(maxX/v.bodyScale)+2,bottom=Math.ceil(maxY)+2;
  const width=right-left,height=bottom-top,surface=document.createElement('canvas');surface.width=width*density;surface.height=height*density;
  const target=surface.getContext('2d');target.scale(density,density);target.translate(-left,-top);
  withDrawingContext(target,()=>vehicleBodyRaw(c,v,0,target,0));
  raster={canvas:surface,x:left,y:top,w:width,h:height,pixels:surface.width*surface.height};
  while(bodyRasterCache.size&&(bodyRasterCache.size>=48||bodyRasterPixels+raster.pixels>12000000)){const oldest=bodyRasterCache.keys().next().value;bodyRasterPixels-=bodyRasterCache.get(oldest).pixels;bodyRasterCache.delete(oldest);}bodyRasterCache.set(key,raster);bodyRasterPixels+=raster.pixels;
 }else{bodyRasterCache.delete(key);bodyRasterCache.set(key,raster);}
 const base=baseWheelSpecs(v),physical=wheelSpecs(v),pose=visualPose(c),wheelY=pose.wheels.reduce((sum,y,j)=>sum+y-(physical[j].y-v.mount)+base[j].r*(1-TIRE_DRAW_SCALE),0)/pose.wheels.length+bob;
 paint.drawImage(raster.canvas,raster.x,raster.y+wheelY,raster.w,raster.h);
}
function withDrawingContext(paint,action){const previous=ctx;try{ctx=paint;return action()}finally{ctx=previous}}
let warmedVehicleKey='';
function warmSelectedVehicle(){
 if(typeof assetsLoaded!=='undefined'&&!assetsLoaded)return;
 const model=+$('#vehicle').value,v=VEHICLES[model],appearance=driverAppearance(v),key=[model,...chosen,appearance.x,appearance.y,appearance.scale].join('|');
 if(key===warmedVehicleKey)return;warmedVehicleKey=key;
 const surface=document.createElement('canvas');surface.width=surface.height=1;const paint=surface.getContext('2d');
 // Populate the tiny car rasters in the garage, before the race camera moves.
 for(let i=0;i<chosen.length;i++)for(let density=1;density<=3;density++){paint.setTransform(density,0,0,density,0,0);vehicleBody({i,model,vx:0,vy:0},v,0,paint);}
}
function drawVehicleOn(paint,c){return withDrawingContext(paint,()=>drawVehicle(c))}
function drawTurboFlame(x,y,power=1){
 ctx.save();ctx.translate(x,y);const pulse=1+Math.sin(time*39)*.12+Math.sin(time*67)*.08,length=(36+power*24)*pulse;
 const glow=ctx.createRadialGradient(-length*.4,0,1,-length*.4,0,length*.65);glow.addColorStop(0,'#ffae4266');glow.addColorStop(1,'#ff842000');ctx.fillStyle=glow;ctx.fillRect(-length*1.2,-length*.65,length*1.4,length*1.3);
 for(let i=0;i<3;i++){const size=1-i*.23,l=length*size,h=(11-i*2)*pulse,wave=Math.sin(time*48+i*2)*3;
  ctx.beginPath();ctx.moveTo(2,-h);ctx.bezierCurveTo(-l*.3,-h*1.2,-l*.42,-h*.5,-l,-h*.12+wave);ctx.bezierCurveTo(-l*.58,h*.7,-l*.35,h*1.15,2,h);ctx.quadraticCurveTo(-7,0,2,-h);ctx.fillStyle=['#f16b30','#ffc652','#fff5c8'][i];ctx.fill();
 }
 for(let j=0;j<5;j++){const age=(time*3.2+j*.21)%1;ctx.globalAlpha=1-age;circle(-length*.5-age*45,Math.sin(j*4+time*8)*(3+age*7),1.8*(1-age),'#ffd36c')}
 ctx.restore();
}
const wheelRasterCache=new Map();
function drawWheelRaster(r,muddy){
 const m=ctx.getTransform(),density=Math.max(1,Math.min(3,Math.ceil(Math.hypot(m.a,m.b)-1e-6))),key=[r,muddy,density].join('|');let image=wheelRasterCache.get(key);
 if(!image){
  const size=Math.ceil((r+2)*2),surface=document.createElement('canvas');surface.width=surface.height=size*density;const target=surface.getContext('2d');target.scale(density,density);target.translate(size/2,size/2);
  withDrawingContext(target,()=>{  const tire=ctx.createRadialGradient(-r*.3,-r*.35,2,0,0,r);tire.addColorStop(0,'#536271');tire.addColorStop(.65,'#293946');tire.addColorStop(1,'#142431');circle(0,0,r,tire,'#122230');circle(0,0,r*.62,'#bdd0d9','#354d5d');circle(0,0,r*.43,'#617b8e');for(let k=0;k<6;k++){ctx.rotate(Math.PI/3);strokeLine([[r*.17,0],[r*.49,0]],'#e3eef0',2.3)}circle(0,0,3,'#e7efef');

  if(muddy){for(let k=0;k<7;k++){const a=k*.9;circle(Math.cos(a)*r*.62,Math.sin(a)*r*.62,r*(k%2?.21:.28),k%2?'#9b713f':'#674b30')}circle(-r*.18,r*.1,r*.25,'#886039')}});
  image={surface,size};if(wheelRasterCache.size>=64)wheelRasterCache.delete(wheelRasterCache.keys().next().value);wheelRasterCache.set(key,image);
 }
 ctx.drawImage(image.surface,-image.size/2,-image.size/2,image.size,image.size);
}
function drawVehicle(c){
 const v=carSpec(c),p=visualPose(c),wheels=wheelSpecs(v);ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);if(!c.alive)ctx.globalAlpha=.4;
 if(c.alive&&(c.boost>0||v.rocket&&c.rocketOn)){ctx.save();ctx.scale(v.bodyScale,1);drawTurboFlame(v.rocket?-70:-54,v.rocket?-17:7,c.boost>0?1.25:.65);ctx.restore()}
 for(let j=0;j<wheels.length;j++){const {x:rx,r:physicalR}=wheels[j],r=physicalR*TIRE_DRAW_SCALE,yy=p.wheels[j];ctx.save();ctx.translate(rx,yy);ctx.rotate(c.wheel*18/r);
  drawWheelRaster(r,c.mud>0);
  ctx.restore();
  if(c.mud>0&&input(c.i)[0]){for(let k=0;k<5;k++){const age=(time*4+k*.19+j*.13)%1;ctx.globalAlpha=(1-age)*(c.alive?1:.4);circle(rx-age*36,yy-r*.3-age*32+age*age*25,2.8*(1-age)+.8,k%2?'#8b613c':'#5f4530')}ctx.globalAlpha=c.alive?1:.4}
 }
 ctx.save();ctx.scale(v.bodyScale,1);vehicleBody(c,v,p.bob);ctx.restore();
 if(c.shield>0){ctx.strokeStyle='#79e9f5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-10,65*v.bodyScale,0,Math.PI*2);ctx.stroke()}
 ctx.restore();
 if(c.alive&&c.noticeTime>0){ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillStyle='#fff9df';ctx.strokeStyle='#2d4935';ctx.lineWidth=4;ctx.strokeText(c.notice,c.x,c.y-87);ctx.fillText(c.notice,c.x,c.y-87);ctx.textAlign='left'}
}
const CRATE_COLORS=['#d65d46','#e8ad36','#4dafbc','#987044'];
function drawGarageRoad(){
 const roadY=H*.89,t=+$('#track').value,model=+$('#vehicle').value,v=VEHICLES[model],size=Math.min(1.7,Math.max(.7,W/1000),W*.24/(v.wheels.at(-1)-v.wheels[0]+Math.max(...wheelSpecs(v).map(w=>w.r))*2+45));
 const halfSpan=(v.wheels.at(-1)-v.wheels[0])/2+Math.max(...wheelSpecs(v).map(w=>w.r))+25;const x=Math.max(W*.15/size,halfSpan+12),ground=0;
 ctx.save();ctx.translate(0,roadY);ctx.scale(size,size);
 // A level garage road keeps the parked vehicle clear of the menu.
 const roadWidth=W/size,roadHeight=(H-roadY)/size;
 drawGround(t,0,roadWidth,roadHeight+300,true);
 const parked={i:0,model,x,y:ground-Math.max(...wheelSpecs(v).map(w=>w.y+w.r)),vx:0,vy:0,a:0,wheel:0,alive:true,contacts:[],shield:0,boost:0,mud:0,noticeTime:0,emptyCabin:true};
 drawVehicle(parked);ctx.restore();
}
let crateSerial=0;
function newCrate(x,type){const y=terrain(x)-330;return {id:++crateSerial,x,y,prevX:x,prevY:y,vx:0,vy:50,a:0,av:0,type,claimedBy:null,age:0,deployed:true,chuteFade:0,grounded:false}}
function crateSupport(b){const cs=Math.cos(b.a),sn=Math.sin(b.a);let best={depth:-Infinity,x:b.x};for(const [x,y] of [[-16,-16],[16,-16],[-16,16],[16,16]]){const wx=b.x+x*cs-y*sn,wy=b.y+x*sn+y*cs,sl=slope(wx),len=Math.hypot(1,sl),depth=(wy-terrain(wx))/len;if(depth>best.depth)best={depth,x:wx,nx:sl/len,ny:-1/len}}return best}
function updateCrate(b,dt){
 b.prevX=b.x;b.prevY=b.y;b.age+=dt;b.chuteFade=Math.max(0,b.chuteFade-dt);
 b.vy+=MAPS[track].gravity*dt;if(b.deployed){b.vy*=Math.exp(-dt*3);b.vx+=(Math.sin(time*.9+b.type)*9-b.vx)*dt*.8;b.a=Math.sin(time*1.5+b.type)*.08}else{b.a+=b.av*dt;b.vx*=Math.exp(-dt*.12)}
 b.x+=b.vx*dt;b.y+=b.vy*dt;
 const hit=crateSupport(b);b.grounded=hit.depth>=-.3;if(!b.grounded)return;
 b.x+=hit.nx*Math.max(0,hit.depth);b.y+=hit.ny*Math.max(0,hit.depth);
 if(b.deployed){b.deployed=false;b.chuteFade=.65}
 const surface=hillBridgeVelocity(track,hit.x),normal=b.vx*hit.nx+(b.vy-surface)*hit.ny;
 if(normal<0){const restitution=normal<-28?.22:0;b.vx-=hit.nx*normal*(1+restitution);b.vy-=hit.ny*normal*(1+restitution)}
 const tx=-hit.ny,ty=hit.nx,tangent=b.vx*tx+(b.vy-surface)*ty,friction=Math.min(Math.abs(tangent),MAPS[track].gravity*.36*dt)*Math.sign(tangent);b.vx-=tx*friction;b.vy-=ty*friction;
 const target=Math.atan(slope(b.x));b.av+=(target-b.a)*35*dt;b.av*=Math.exp(-dt*9);
 // Re-project after rotation on the next fixed step; never stop above the surface.
}
function drawCrate(b){
 const col=CRATE_COLORS[b.type];ctx.save();ctx.translate(b.x,b.y);
 if(b.deployed||b.chuteFade>0){ctx.save();const fade=b.deployed?1:b.chuteFade/.65;ctx.globalAlpha=fade;ctx.translate(Math.sin(time*1.8+b.type)*5,-20-(1-fade)*12);ctx.scale(1,Math.max(.15,fade));
  strokeLine([[-34,-39],[-12,4]],'#e9eadc',1.4);strokeLine([[34,-39],[12,4]],'#e9eadc',1.4);strokeLine([[0,-49],[0,4]],'#e9eadc',1.2);
  ctx.beginPath();ctx.moveTo(-37,-38);ctx.bezierCurveTo(-32,-78,31,-78,37,-38);ctx.quadraticCurveTo(27,-45,18,-38);ctx.quadraticCurveTo(9,-45,0,-38);ctx.quadraticCurveTo(-9,-45,-18,-38);ctx.quadraticCurveTo(-27,-45,-37,-38);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#3b5162';ctx.lineWidth=1.6;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-12,-65);ctx.quadraticCurveTo(-20,-52,-18,-39);ctx.lineTo(0,-43);ctx.quadraticCurveTo(0,-59,-1,-70);ctx.closePath();ctx.fillStyle='#fff0d9';ctx.fill();ctx.beginPath();ctx.moveTo(10,-66);ctx.quadraticCurveTo(19,-52,18,-39);ctx.strokeStyle='#fff0d9';ctx.lineWidth=6;ctx.stroke();ctx.restore();
 }
 ctx.rotate(b.a);rounded(-17,-17,34,34,5,'#314757','#182d3a');const g=ctx.createLinearGradient(0,-16,0,16);g.addColorStop(0,'#ffffff');g.addColorStop(.15,col);g.addColorStop(1,'#334552');rounded(-15,-15,30,30,4,g);rounded(-12,-12,24,24,3,col);strokeLine([[-13,-14],[12,-14]],'#fff4d890',1.3);
 for(const x of [-12,12])for(const y of [-12,12])circle(x,y,1.2,'#d9e3dd');ctx.strokeStyle='#fff8e5';ctx.fillStyle='#fff8e5';ctx.lineWidth=2.4;
 if(b.type===0){rounded(-6,-7,12,15,2,'#fff8e5');rounded(-3,-11,6,4,1,'#fff8e5');rounded(-3,-3,6,4,1,col)}
 if(b.type===1){strokeLine([[-8,-7],[-2,0],[-8,7]],'#fff8e5',3);strokeLine([[1,-7],[7,0],[1,7]],'#fff8e5',3)}
 if(b.type===2){path([[-8,-8],[8,-8],[7,3],[0,10],[-7,3]],'#fff8e5');path([[-4,-4],[4,-4],[3,2],[0,5],[-3,2]],col)}
 if(b.type===3){rounded(-11,-11,22,22,4,'#ecdcb5');rounded(-8,3,16,6,3,'#62422c');rounded(-6,-2,12,7,3,'#795336');rounded(-3,-6,8,6,3,'#8e633c');path([[-1,-4],[0,-10],[5,-5],[4,-2]],'#8e633c');circle(-3,3,1.2,'#fff1cc');circle(3,3,1.2,'#fff1cc')}
 ctx.restore();
}

;

// game.js
'use strict';
const canvas=document.querySelector('canvas'),$=s=>document.querySelector(s);let ctx=canvas.getContext('2d');
const assetNames=['Егерь','Вышня','Голубой','Комунистичкий','Нинглеб','Рэп_зеленный','Синяк'],names=assetNames.map(n=>({'Голубой':'Гейнинзя','Комунистичкий':'Комунинзя'}[n]||n)),images=assetNames.map(n=>{return queuedGameImage('assets/'+n+'.webp')}),colors=['#e64d36','#418acb','#e5b83d','#72a85a'],chosen=[0,1,2,3],abilities=['turbo','jump','shield','turbo'],keys={};
let playerCount=1;
let W=innerWidth,H=innerHeight,mode='lobby',cars=[],cam=0,zoom=1,cameraY=0,time=0,count=3,bonus=[],particles=[],nextDrop=6,track=0,paused=false,winner=null,audio=null,sound=false,engineAudio,snowStart=Infinity,snowEnd=0,nextSnow=8;
const checkpoint=1500,baseScale=()=>Math.min(1.3,Math.max(.7,W/1250)),scale=()=>baseScale()*(mode==='lobby'?1:zoom);
const abilityNames={turbo:'Турбо',jump:'Прыжок',shield:'Щит'},abilityKeys=['E','Правый Shift','СКМ','U'];
// Bound the backing store on dense phone screens; physics stays in CSS pixels.
const mobileInput=matchMedia('(pointer: coarse), (max-width: 750px)');
let renderRatio=1,renderQuality=1,renderCostTotal=0,renderCostSamples=0,renderCostAverage=0,renderQualityCooldown=0,renderQualityGoodFrames=0;
const refreshIntervals=[];let refreshLast=0,targetFrameMs=1000/60;
function measureRefresh(now){
 if(refreshLast){const interval=now-refreshLast;if(interval>=4&&interval<40){refreshIntervals.push(interval);if(refreshIntervals.length>180)refreshIntervals.shift();if(refreshIntervals.length>=30){const sorted=[...refreshIntervals].sort((a,b)=>a-b);const measured=Math.max(1000/120,sorted[Math.floor(sorted.length*.1)]);targetFrameMs=mode==='lobby'||paused?measured:Math.min(targetFrameMs,measured);}}}refreshLast=now;
}
function resize(){
 W=innerWidth;H=innerHeight;
 const pixelBudget=mobileInput.matches?2400000:8300000;
 renderRatio=Math.min(devicePixelRatio||1,mobileInput.matches?1.5:2,Math.sqrt(pixelBudget/(W*H)))*renderQuality;
 canvas.width=Math.round(W*renderRatio);canvas.height=Math.round(H*renderRatio);
 ctx.setTransform(renderRatio,0,0,renderRatio,0,0);
}
function adaptRenderQuality(cost){
 if(!Number.isFinite(cost)||cost<0)return;
 if(renderQualityCooldown>0){renderQualityCooldown--;return;}
 renderCostTotal+=cost;if(++renderCostSamples<30)return;
 renderCostAverage=renderCostTotal/renderCostSamples;renderCostTotal=0;renderCostSamples=0;
 const recent=frameTimes.slice(-60).sort((a,b)=>a-b),cadence=recent[Math.floor(recent.length*.75)]||targetFrameMs,meanFrame=recent.length?recent.reduce((sum,n)=>sum+Math.min(n,targetFrameMs*2),0)/recent.length:targetFrameMs;
 if((renderCostAverage>targetFrameMs*.85||cadence>targetFrameMs*1.35||recent.length>=30&&meanFrame>targetFrameMs*1.08)&&renderQuality>.5){renderQuality=Math.max(.5,renderQuality*.9);renderQualityCooldown=90;renderQualityGoodFrames=0;resize();}
 else if(renderCostAverage<targetFrameMs*.45&&cadence<targetFrameMs*1.12&&renderQuality<1){renderQualityGoodFrames+=30;if(renderQualityGoodFrames>=600){renderQuality=Math.min(1,renderQuality+.05);renderQualityGoodFrames=0;renderQualityCooldown=180;resize();}}
 else renderQualityGoodFrames=0;
}
addEventListener('resize',resize);mobileInput.addEventListener('change',resize);resize();
function syncGameScreen(){
 const screen=mode==='lobby'?'lobby':'race';
 if(document.body.dataset.screen!==screen){document.body.dataset.screen=screen;if(screen==='race')window.scrollTo(0,0);}
 const controls=$('#touch-controls');
 if(controls)controls.hidden=mode!=='race'||paused||(window.onlineIndices?.length? !window.onlineIndices.some(i=>cars[i]?.alive):window.onlineIndex!==undefined? !cars[window.onlineIndex]?.alive:false);
}

function terrain(x){return groundHeight(track,x)}
function slope(x){return (terrain(x+1)-terrain(x-1))/2}
function picks(){ $('#picks').innerHTML=chosen.slice(0,playerCount).map((n,i)=>`<section class="pick" style="border-top:5px solid ${colors[i]}"><h3>ИГРОК 0${i+1} <span style="float:right;color:${colors[i]}">●</span></h3><img class="portrait" style="transform:scaleX(${[0,5].includes(n)?-1:1})" src="assets/${assetNames[n]}.webp"><div class="choose"><button data-i="${i}" data-d="-1" aria-label="Предыдущий персонаж">‹</button><b>${names[n].replace('_',' ')}</b><button data-i="${i}" data-d="1" aria-label="Следующий персонаж">›</button></div><div class="keys">${['WASD · W/D газ · S/A назад','СТРЕЛКИ · ↑/→ газ · ↓/← назад','МЫШЬ · ПКМ газ · ЛКМ назад','IJKL · I/L газ · J/K назад'][i]}</div><label class="ability-select">Способность · ${abilityKeys[i]}<select data-ability="${i}">${Object.keys(abilityNames).map(a=>`<option value="${a}" ${abilities[i]===a?'selected':''}>${abilityNames[a]}</option>`).join('')}</select></label></section>`).join('');document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{chosen[b.dataset.i]=(chosen[b.dataset.i]+Number(b.dataset.d)+names.length)%names.length;picks()})}picks();
$('#players').onchange=()=>{playerCount=+$('#players').value;document.body.dataset.players=playerCount;if(window.onlineActive){window.onlineSeatCountChanged?.(playerCount);return}picks()};document.body.dataset.players=playerCount;
function enforceComputerLocalMultiplayer(){if(window.onlineActive)return;for(const option of Array.from($('#players').options||[]))if(option.value!=='1')option.disabled=mobileInput.matches;if(mobileInput.matches){playerCount=1;$('#players').value='1';document.body.dataset.players='1';picks();}}
enforceComputerLocalMultiplayer();mobileInput.addEventListener('change',()=>{enforceComputerLocalMultiplayer();resize();});
document.querySelector('#picks').addEventListener('change',e=>{if(e.target.dataset.ability!==undefined)abilities[+e.target.dataset.ability]=e.target.value});
function updateMapDescription(){$('#map-description').textContent=MAPS[+$('#track').value].description+' Бесконечная трасса. При каждом старте — новый вариант рельефа.'}$('#track').onchange=updateMapDescription;updateMapDescription();
function newCar(i){const v=VEHICLES[vehicleModel],spawnX=Math.max(100,Math.max(...wheelSpecs(v).map(w=>Math.abs(w.x)))+Math.max(...wheelSpecs(v).map(w=>w.r))+25)+i*Math.max(110,Math.max(...wheelSpecs(v).map(w=>w.x))-Math.min(...wheelSpecs(v).map(w=>w.x))+2*Math.max(...wheelSpecs(v).map(w=>w.r))+18);return {i,model:vehicleModel,rocketOn:false,startX:spawnX,x:spawnX,y:terrain(spawnX)-Math.max(...wheelSpecs(v).map(w=>w.y+w.r))-3,vx:0,vy:0,a:0,av:0,fuel:100,cp:0,alive:true,reason:'',wheel:0,contacts:[],shield:0,boost:0,mud:0,coins:0,air:0,flip:0,notice:'',noticeTime:0,ability:abilities[i],cooldown:0,prevX:spawnX,prevY:-43}}
$('#vehicle').onchange=describeVehicle;describeVehicle();
function start(){if(mobileInput.matches){playerCount=1;$('#players').value='1';document.body.dataset.players='1';}window.resetTouchHints?.();vehicleModel=+$('#vehicle').value;newWorldSeed();track=+$('#track').value;snowStart=Infinity;snowEnd=0;nextSnow=6+Math.random()*6;resetHillBridges();cars=colors.slice(0,playerCount).map((_,i)=>newCar(i));cam=0;zoom=1;cameraY=0;time=0;count=3;nextDrop=5;bonus=[];particles=[];mode='race';paused=false;winner=null;$('#lobby').hidden=true;$('#foot').hidden=true;$('#hud').hidden=false;$('#overlay').hidden=true;keysClear();canvas.focus()}
$('#start').onclick=start;function keysClear(){Object.keys(keys).forEach(k=>keys[k]=false);window.resetTouchInput?.()}function garage(){mode='lobby';paused=false;$('#lobby').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;$('#foot').hidden=false;keysClear()}$('#menu').onclick=garage;
function showPauseMenu(){
 $('#overlay').hidden=false;$('#overlay').innerHTML='<h2>Пауза</h2><button id="resume">Продолжить</button><button id="pause-garage">Вернуться в гараж</button><button id="pause-settings-toggle">Настройки</button><div id="pause-settings" hidden></div>';
 $('#resume').onclick=togglePause;$('#pause-garage').onclick=()=>{paused=false;garage()};
 $('#pause-settings-toggle').onclick=()=>{const panel=$('#pause-settings');panel.hidden=!panel.hidden;if(!panel.hidden)window.populatePauseSettings?.(panel)};
}
function togglePause(){if(mode!=='race')return;paused=!paused;keysClear();$('#overlay').hidden=!paused;if(paused)showPauseMenu()}
$('#pause').onclick=togglePause;
addEventListener('keydown',e=>{if(e.target?.matches?.('input,textarea,select,[contenteditable]'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys[e.code]=true;if(!e.repeat){const i=['KeyE','ShiftRight','unused','KeyU'].indexOf(e.code);if(i>=0)activateAbility(cars[i])}if(e.code==='Escape'&&!e.repeat)togglePause()});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{keysClear();if(mode==='race'&&!paused)togglePause()});document.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('mousedown',e=>{keys['Mouse'+e.button]=true;if(e.button===1)activateAbility(cars[2]);e.preventDefault()});addEventListener('mouseup',e=>keys['Mouse'+e.button]=false);
// Engine audio: combustion pulses, exhaust resonance and filtered intake air.
// Kept in game.js so the existing offline cache includes the complete sound.
class RacingEngineAudio {
 constructor(context){
  this.context=context;this.rpm=850;this.throttle=0;this.gear=0;this.shiftUntil=0;
  this.master=context.createGain();this.master.gain.value=0;
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-18;compressor.knee.value=12;compressor.ratio.value=3;
  this.master.connect(compressor);compressor.connect(context.destination);this.initEffects(compressor);
  this.exhaust=context.createBiquadFilter();this.exhaust.type='lowpass';this.exhaust.frequency.value=650;this.exhaust.Q.value=.55;
  const body=context.createBiquadFilter();body.type='peaking';body.frequency.value=125;body.Q.value=.7;body.gain.value=3;
  const rumbleCut=context.createBiquadFilter();rumbleCut.type='highpass';rumbleCut.frequency.value=32;rumbleCut.Q.value=.5;
  this.exhaust.connect(body);body.connect(rumbleCut);rumbleCut.connect(this.master);
  this.motor=context.createBufferSource();this.motor.buffer=this.combustionBuffer();this.motor.loop=true;this.motor.playbackRate.value=850/1600;
  this.motor.connect(this.exhaust);this.motor.start();
  this.intake=context.createBufferSource();
  const air=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=air.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  this.intake.buffer=air;this.intake.loop=true;
  const airFilter=context.createBiquadFilter();airFilter.type='bandpass';airFilter.frequency.value=850;airFilter.Q.value=.5;
  this.airGain=context.createGain();this.airGain.gain.value=.015;
  this.intake.connect(airFilter);airFilter.connect(this.airGain);this.airGain.connect(this.master);this.intake.start();
 }
 combustionBuffer(){
  const sr=this.context.sampleRate,period=60/(1600*2),fires=96,length=Math.round(period*fires*sr);
  const buffer=this.context.createBuffer(1,length,sr),data=buffer.getChannelData(0);
  let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let fire=0;fire<fires;fire++){
   const start=Math.round((fire+((random()-.5)*.025))*length/fires);
   const strength=[1,.89,.96,.85][fire%4]*(.95+random()*.1);
   for(let j=0;j<sr*.085;j++){
    const t=j/sr,envelope=(1-Math.exp(-t*1800))*Math.exp(-t*80);
    const thump=Math.sin(2*Math.PI*95*t)*.7+Math.sin(2*Math.PI*185*t)*.22;
    const burn=(random()*2-1)*Math.exp(-t*230)*.28;
    const index=(start+j+length)%length;
    data[index]+=strength*(thump*envelope+burn);
   }
  }
  let peak=0;for(const x of data)peak=Math.max(peak,Math.abs(x));
  for(let i=0;i<data.length;i++)data[i]=data[i]/peak*.8;
  return buffer;
 }
 update(dt,state,now=this.context.currentTime){
  const c=state.car,active=state.active&&c?.alive&&c.fuel>0;
  const spec=state.spec||{},heavy=['pickup','monster','hotrod'].includes(spec.kind);
  const throttle=active&&state.gas&&!state.brake?1:0;
  this.throttle+=(throttle-this.throttle)*(1-Math.exp(-dt*9));
  const speed=Math.abs(c?.vx||0),ratio=Math.min(1,speed/(spec.maxSpeed||680));
  const gear=Math.min(4,Math.floor(ratio*5));
  if(gear>this.gear&&throttle)this.shiftUntil=now+.16;
  this.gear=gear;
  const idle=heavy?700:850,range=heavy?2600:3400;
  const roadRPM=idle+700+(ratio*5-gear)*range*.65;
  let target=idle+this.throttle*(750+ratio*1100);
  if(speed>45)target=Math.max(target,roadRPM*(throttle?1:.78));
  if((c?.air||0)>.15&&throttle)target+=800;
  if((c?.boost||0)>0&&throttle)target+=350;
  if(now<this.shiftUntil)target*=.72;
  target=Math.max(idle,Math.min(heavy?3900:4800,target));
  this.rpm+=(target-this.rpm)*(1-Math.exp(-dt*(target>this.rpm?5:3)));
  this.motor.playbackRate.setTargetAtTime(this.rpm/1600,now,.055);
  this.exhaust.frequency.setTargetAtTime((heavy?480:580)+this.throttle*650+ratio*220,now,.09);
  this.airGain.gain.setTargetAtTime(.002+this.throttle*.008+(c?.rocketOn?.025:0),now,.08);
  this.master.gain.setTargetAtTime(active?.19+this.throttle*.09:0,now,active?.08:.045);
 }
  initEffects(output){
  const ctx=this.context;
  this.effects=ctx.createGain();this.effects.gain.value=1;this.effects.connect(output);
  this.voices=new Set();this.lastEffects=new Map();this.effectBuffers=new Map();
  for(const kind of ['land','crash','bonus','fuel','turbo','jump','shield','shield-hit','mud','tick','go','finish'])this.effectBuffers.set(kind,this.effectBuffer(kind));
  // Low, broad air turbulence rather than a narrow intake hiss.
  const noise=ctx.createBuffer(2,ctx.sampleRate*4,ctx.sampleRate);
  for(let channel=0;channel<2;channel++){
   const data=noise.getChannelData(channel);let pink=0;
   for(let i=0;i<data.length;i++){pink=.97*pink+.03*(Math.random()*2-1);data[i]=pink*4;}
  }
  this.wind=ctx.createBufferSource();this.wind.buffer=noise;this.wind.loop=true;
  const windLow=ctx.createBiquadFilter();windLow.type='lowpass';windLow.frequency.value=1200;windLow.Q.value=.5;
  const windHigh=ctx.createBiquadFilter();windHigh.type='highpass';windHigh.frequency.value=150;windHigh.Q.value=.5;
  this.windGain=ctx.createGain();this.windGain.gain.value=0;
  this.wind.connect(windLow);windLow.connect(windHigh);windHigh.connect(this.windGain);this.windGain.connect(output);this.wind.start();
  this.turboAir=ctx.createBufferSource();this.turboAir.buffer=noise;this.turboAir.loop=true;
  const turboFilter=ctx.createBiquadFilter();turboFilter.type='bandpass';turboFilter.frequency.value=460;turboFilter.Q.value=.6;
  this.turboGain=ctx.createGain();this.turboGain.gain.value=0;
  this.turboAir.connect(turboFilter);turboFilter.connect(this.turboGain);this.turboGain.connect(output);this.turboAir.start();
  this.previousMode='lobby';this.previousCount=0;
 }
 effectBuffer(kind){
  const duration={land:.24,crash:.65,bonus:.32,fuel:.55,turbo:.7,jump:.3,shield:.8,'shield-hit':.45,mud:.32,tick:.13,go:.4,finish:.9}[kind];
  const sr=this.context.sampleRate,buffer=this.context.createBuffer(1,Math.ceil(sr*duration),sr),data=buffer.getChannelData(0);
  let lowNoise=0,phase=0;
  for(let i=0;i<data.length;i++){
   const t=i/sr,p=t/duration,noise=Math.random()*2-1;
   lowNoise=.88*lowNoise+.12*noise;
   const attack=Math.min(1,t/.008),tail=Math.pow(1-p,2);let value=0;
   if(kind==='land'||kind==='crash'){
    const hard=kind==='crash';phase+=2*Math.PI*(hard?95-55*p:105-65*p)/sr;
    value=Math.sin(phase)*Math.exp(-t*(hard?8:20))*.6+lowNoise*Math.exp(-t*(hard?5:18))*(hard?1.2:.65);
    if(hard)value+=Math.sin(t*2*Math.PI*370)*Math.exp(-t*14)*.12;
   }else if(kind==='shield'||kind==='shield-hit'){
    const hit=kind==='shield-hit',frequency=hit?500-330*p:85+360*(1-Math.exp(-t*13));
    phase+=2*Math.PI*frequency/sr;
    value=(Math.sin(phase)*.4+Math.sin(phase*1.012)*.22+Math.sin(phase*2)*.12)*tail;
    value+=lowNoise*Math.exp(-t*12)*.5;
   }else if(kind==='turbo'||kind==='jump'){
    phase+=2*Math.PI*(kind==='jump'?200+650*p:130+430*p)/sr;
    value=lowNoise*Math.sin(Math.PI*p)*(kind==='turbo'?1.3:.8)+Math.sin(phase)*tail*.15;
   }else if(kind==='mud'){
    value=lowNoise*Math.sin(Math.PI*p)*1.2+Math.sin(2*Math.PI*70*t)*tail*.12;
   }else{
    const notes=kind==='finish'?[523.25,659.25,783.99,1046.5]:kind==='fuel'?[392,523.25,659.25]:kind==='bonus'?[880,1174.66]:kind==='go'?[880]:[520];
    const slot=Math.min(notes.length-1,Math.floor(p*notes.length)),local=t-slot*duration/notes.length;
    const env=Math.min(1,local/.006)*Math.exp(-local*(kind==='tick'?32:12));
    value=(Math.sin(2*Math.PI*notes[slot]*local)+Math.sin(2*Math.PI*notes[slot]*2*local)*.15)*env*.28*tail;
   }
   data[i]=value*attack*Math.min(1,(duration-t)/.025);
  }
  return buffer;
 }
 play(kind,strength=1,pan=0,key=kind,now=this.context.currentTime){
  const buffer=this.effectBuffers.get(kind);if(!buffer||this.voices.size>=20)return false;
  const interval=kind==='land'?.18:.075;
  if(now-(this.lastEffects.get(key)??-Infinity)<interval)return false;
  this.lastEffects.set(key,now);
  const source=this.context.createBufferSource(),gain=this.context.createGain(),panner=this.context.createStereoPanner();
  source.buffer=buffer;source.playbackRate.value=['tick','go','finish','bonus','fuel'].includes(kind)?1:.97+Math.random()*.06;
  gain.gain.value=Math.min(1,Math.max(.08,strength))*(kind==='land'?.32:kind==='crash'?.36:.26);
  panner.pan.value=Math.max(-.8,Math.min(.8,pan));
  source.connect(gain);gain.connect(panner);panner.connect(this.effects);
  this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();panner.disconnect();};
  source.start(now);return true;
 }
 updateEnvironment(state,now=this.context.currentTime){
  const enabled=!!state.enabled,c=state.car,moving=enabled&&state.active&&c?.alive;
  // Wind depends on road speed, including coasting with the gas released.
  const speed=speedKph(c?.vx||0),amount=Math.max(0,Math.min(1,(speed-50)/60));
  const gust=.88+.12*Math.sin(now*2.1)+.05*Math.sin(now*5.3);
  if(enabled!==this.environmentEnabled){
   if(!enabled)this.silence();
   else {this.effects.gain.cancelScheduledValues(now);this.effects.gain.setTargetAtTime(1,now,.02);}
  }
  this.environmentEnabled=enabled;
  this.windGain.gain.setTargetAtTime(moving?amount*amount*.7*gust:0,now,moving?.25:.025);
  this.turboGain.gain.setTargetAtTime(moving&&c.boost>0?.13:0,now,moving?.15:.025);
  const mode=state.mode,count=Math.max(0,Math.ceil(state.count||0));
  if(enabled){
   if(mode==='race'&&count>0&&count!==this.previousCount)this.play('tick',.65,0,'tick',now);
   if(mode==='race'&&count===0&&(this.previousCount>0||this.previousMode!=='race'))this.play('go',.8,0,'go',now);
   if(mode==='result'&&this.previousMode==='race')this.play('finish',.7,0,'finish',now);
  }
  this.previousMode=mode;this.previousCount=count;
 }

 silence(){const now=this.context.currentTime;for(const bus of [this.master,this.effects,this.windGain,this.turboGain]){bus.gain.cancelScheduledValues(now);bus.gain.setTargetAtTime(0,now,.025);}for(const source of this.voices)source.stop();}

}

$('#sound').onclick=()=>{
 sound=!sound;$('#sound').textContent='Звук: '+(sound?'вкл':'выкл');
 if(sound){if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();engineAudio=new RacingEngineAudio(audio);}audio.resume().catch(()=>{});}
 else engineAudio?.silence();
};
function input(i){return i===0?[keys.KeyW||keys.KeyD||keys.TouchGas,keys.KeyS||keys.KeyA||keys.TouchBrake]:i===1?[keys.ArrowUp||keys.ArrowRight,keys.ArrowDown||keys.ArrowLeft]:i===2?[keys.Mouse2,keys.Mouse0]:[keys.KeyI||keys.KeyL,keys.KeyJ||keys.KeyK]}
function activateAbility(c){if(mode!=='race'||paused||count>0||!c?.alive||c.cooldown>0)return;if(c.ability==='turbo'){c.boost=Math.max(c.boost,2.8);c.cooldown=11;announce(c,'ТУРБО АКТИВИРОВАНО')}if(c.ability==='jump'){c.vy=Math.min(c.vy,-250);c.cooldown=8;announce(c,'ПРЫЖОК')}if(c.ability==='shield'){c.shield=Math.max(c.shield,4);c.cooldown=14;announce(c,'ЩИТ АКТИВИРОВАН')}}
function raceSound(c,kind,strength=1){
 if(!sound||!engineAudio||paused||document.hidden||mode!=='race'||count>0)return;
 if(c&&window.onlineIndex!==undefined&&!(window.onlineIndices||[window.onlineIndex]).includes(c.i))return;
 const pan=c&&window.onlineIndex===undefined?Math.max(-.7,Math.min(.7,((c.x-cam)*scale()/W-.5)*1.4)):0;
 engineAudio.play(kind,strength,pan,kind+':'+(c?.i??'all'));
}
function announce(c,t){
 c.notice=t;c.noticeTime=2.5;
 if(t.includes('ЩИТ СПАС'))raceSound(c,'shield-hit');
 else if(t.includes('ЩИТ'))raceSound(c,'shield');
 else if(t.includes('ТУРБО'))raceSound(c,'turbo');
 else if(t==='ПРЫЖОК')raceSound(c,'jump');
 else if(t.includes('ГРЯЗИ'))raceSound(c,'mud');
 else if(t.includes('БАК ПОЛНЫЙ'))raceSound(c,'fuel');
 else if(t.includes('ТОПЛИВА'))raceSound(c,'bonus');
}
function kill(c,r){if(!c.alive)return;if(c.shield>0&&r==='Переворот'){c.shield=0;c.a=0;c.av=0;c.y=terrain(c.x)-65;c.vy=-80;announce(c,'ЩИТ СПАС МАШИНУ');return}raceSound(c,r==='Нет топлива'?'mud':'crash');c.alive=false;c.reason=r;for(let n=0;n<16;n++)particles.push({x:c.x,y:c.y,vx:(Math.random()-.5)*150,vy:-Math.random()*140,life:1,color:colors[c.i]})}
function physics(c,dt,predict=false){if(!c.alive)return;const v=carSpec(c),mass=v.mass/900,I=inertia(v);let [gas,brake]=input(c.i);gas=!!gas&&c.fuel>0;c.shield=Math.max(0,c.shield-dt);c.boost=Math.max(0,c.boost-dt);c.mud=Math.max(0,(c.mud||0)-dt);c.cooldown=Math.max(0,c.cooldown-dt);c.noticeTime-=dt;c.fuel=Math.max(0,c.fuel-dt*(gas?(v.rocket?9:6.2):brake&&c.vx< -3?3.8:.2));c.vy+=MAPS[track].gravity*dt;c.contacts=[];let grounded=0,impactSpeed=0;
// Each wheel applies a spring/damper force at its attachment point.
for(const [wheelIndex,wheel] of wheelSpecs(v).entries()){const rx=wheel.x,ry=wheel.y,cos=Math.cos(c.a),sin=Math.sin(c.a),px=rx*cos-ry*sin,py=rx*sin+ry*cos,wx=c.x+px,wy=c.y+py,sl=slope(wx),len=Math.hypot(sl,1),nx=sl/len,ny=-1/len,penetration=(wy+wheel.r-terrain(wx))/len;let compression=0;if(penetration>0){grounded++;const pvx=c.vx-c.av*py,pvy=c.vy+c.av*px,vn=pvx*nx+(pvy-hillBridgeVelocity(track,wx))*ny;impactSpeed=Math.max(impactSpeed,-vn);let force=Math.max(0,Math.min(2300*mass,penetration*v.spring-vn*v.damper));c.vx+=nx*force/mass*dt;c.vy+=ny*force/mass*dt;c.av+=(px*ny-py*nx)*force/I*dt;let tx=1/len,ty=sl/len,vt=pvx*tx+pvy*ty,driveAxles=drivenAxles(v);let drive=gas?(driveAxles.includes(wheelIndex)?v.engine/driveAxles.length:0)*(c.boost>0?1.52:1):0;if(brake){drive=gas?0:(c.fuel>0&&vt<12?-300:-Math.max(-500,Math.min(500,vt*22)));}else drive-=vt*v.drag;drive=Math.max(-force*v.grip*(c.mud>0?.22:1),Math.min(force*v.grip*(c.mud>0?.22:1),drive));c.vx+=tx*drive/mass*dt;c.vy+=ty*drive/mass*dt;c.av+=(px*ty-py*tx)*drive/I*dt*.15*(MAPS[track].gravity/420);compression=Math.min(11,penetration*.45)}c.contacts.push({rx,compression})}
if(!predict&&grounded&&impactSpeed>65)raceSound(c,'land',Math.min(1,(impactSpeed-35)/240)*Math.min(1.2,Math.sqrt(mass)));
c.rocketOn=!!(v.rocket&&gas&&!brake);if(c.rocketOn){const thrust=(c.boost>0?1.65:1);c.vx+=(Math.cos(c.a)*1800)*thrust/mass*dt;c.vy+=(Math.sin(c.a)*1800)*thrust/mass*dt}// Pitch controls require sustained loss of all wheel contacts, including on the Moon.
if(!grounded&&c.air>.08)c.av+=v.rotation*((gas&&!brake?-2.4:0)+(brake&&!gas?2.4:0))*dt;if(track===2&&!grounded)c.av*=Math.exp(-dt*.7);c.av*=Math.exp(-dt*(grounded?.85:.18));c.vx*=Math.exp(-dt*.055);c.vx=Math.max(-190,Math.min(v.maxSpeed*(c.boost>0?1.24:1),c.vx));c.vy=Math.max(v.rocket?-900:-550,Math.min(700,c.vy));c.av=Math.max(-7,Math.min(7,c.av));c.x+=c.vx*dt;c.y+=c.vy*dt;c.a+=c.av*dt;c.wheel+=c.vx*dt/17+(c.mud>0&&gas?18*dt:0);c.x=Math.max(25,c.x);c.air=grounded?0:c.air+dt;
// Head impact causes a crash, rather than an arbitrary angle threshold.
let hx=c.x+Math.sin(c.a)*41,hy=c.y-Math.cos(c.a)*41;if(!predict&&hy+8>terrain(hx)&&Math.cos(c.a)<.5)kill(c,'Переворот');if(!predict&&c.y>terrain(c.x)+85)kill(c,'Авария');if(!predict&&c.fuel<=0&&Math.abs(c.vx)<5&&grounded)kill(c,'Нет топлива');let cp=Math.floor(c.x/checkpoint);if(cp>c.cp){c.cp=cp;if(!v.rocket||terrain(c.x)-c.y<120){c.fuel=100;announce(c,'ЗАПРАВКА · БАК ПОЛНЫЙ')}else announce(c,'ЗАПРАВКА ПРОЛЕТЕЛА ВНИЗУ')}
}
function endRace(){mode='result';keysClear();let ranked=[...cars].sort((a,b)=>b.x-a.x);$('#overlay').hidden=false;$('#overlay').innerHTML=`<div class="eyebrow">ГОНКА ОКОНЧЕНА</div><h2>${cars.length===1?'Заезд завершён':winner?'Игрок '+(winner.i+1)+' победил!':'Все выбыли'}</h2><p>${ranked.map(c=>`<span style="color:${colors[c.i]}">●</span> ${escapeLabel(racerName(c))} — ${Math.floor(raceMetres(c))} м ${c.reason?'· '+c.reason:''}`).join('<br>')}</p><button id="again">Ещё гонка</button><button id="back">В гараж</button>`;$('#again').onclick=start;$('#back').onclick=garage}
// Swept contacts give each crate to the first car reaching it during this physics step.
function contactTime(c,b){const ax=c.prevX-b.prevX,ay=c.prevY-b.prevY,dx=(c.x-c.prevX)-(b.x-b.prevX),dy=(c.y-c.prevY)-(b.y-b.prevY),radius=52;const C=ax*ax+ay*ay-radius*radius;if(C<=0)return 0;const A=dx*dx+dy*dy;if(A<1e-10)return null;const B=2*(ax*dx+ay*dy),disc=B*B-4*A*C;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:null}
function collectBonuses(){for(const b of bonus){if(b.claimedBy!==null)continue;let first=null,firstTime=Infinity;for(const c of cars){if(!c.alive)continue;const t=contactTime(c,b);if(t!==null&&t<firstTime){first=c;firstTime=t}}if(first){b.claimedBy=first.i;if(b.type===0){first.fuel=Math.min(100,first.fuel+40);announce(first,'+40 ТОПЛИВА')}if(b.type===1){first.boost=5;announce(first,'ТУРБО · 5 СЕК')}if(b.type===2){first.shield=12;announce(first,'ЩИТ · 12 СЕК')}if(b.type===3){first.mud=6;announce(first,'КОЛЁСА В ГРЯЗИ · 6 СЕК')}}}}
function updateCamera(active,dt){const lead=Math.max(...active.map(c=>c.x)),tail=Math.min(...active.map(c=>c.x)),span=lead-tail;const verticalSpan=Math.max(...active.map(c=>c.y))-Math.min(...active.map(c=>c.y));const targetZoom=Math.max(.42,Math.min(1,W/(baseScale()*(span+480)),H*.65/(baseScale()*(verticalSpan+210))));zoom+=(targetZoom-zoom)*(1-Math.exp(-dt*5));const view=W/scale();const targetCam=Math.max(0,span<view-200?(lead+tail)*.5-view*.5:lead-view+180);cam+=(targetCam-cam)*(1-Math.exp(-dt*6));const top=Math.min(...active.map(c=>c.y)),bottom=Math.max(...active.map(c=>c.y)),verticalSpeed=active.reduce((sum,c)=>sum+c.vy,0)/active.length;const targetY=(top+bottom)*.5+H*.10/scale()+verticalSpeed*.12;cameraY+=(targetY-cameraY)*(1-Math.exp(-dt*4));return {lead,view}}
function update(dt){if(mode!=='race'||paused)return;if(count>0){count-=dt;return}time+=dt;if(time>nextSnow){snowStart=time;snowEnd=time+8+Math.random()*8;nextSnow=snowEnd+9+Math.random()*15}updateHillBridges(dt);for(const c of cars){c.prevX=c.x;c.prevY=c.y;physics(c,dt)}if(mode!=='race')return;let active=cars.filter(c=>c.alive);if(!active.length){endRace();return}const {lead}=updateCamera(active,dt);for(const c of active)if(c.x+55*carSpec(c).bodyScale<cam)kill(c,'Отстал за экран');active=cars.filter(c=>c.alive);if(active.length===1&&cars.some(c=>!c.alive)){winner=active[0];endRace();return}if(time>nextDrop){nextDrop=time+4+Math.random()*4;const x=lead+240+Math.random()*340;bonus.push(newCrate(x,Math.floor(Math.random()*4)))}for(const b of bonus)updateCrate(b,dt);collectBonuses();bonus=bonus.filter(b=>b.age<24&&b.claimedBy===null);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.life-=dt}particles=particles.filter(p=>p.life>0)}
function path(points,fill,stroke,width=2){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
function tree(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#786347';ctx.fillRect(-4,-40,8,40);circle(0,-52,23,'#56954b');circle(-16,-40,20,'#4b8840');circle(16,-42,19,'#69a751');ctx.restore()}
function background(){const paint=()=>mapBackground(mode==='lobby'?+$('#track').value:track,mode==='lobby'?0:cam+W/scale()*.5);if(window.sceneLayers?.active)window.sceneLayers.background(paint);else paint()}
function carDraw(c){drawVehicle(c)}
function world(){const s=scale(),base=H*.69-cameraY*s;ctx.save();ctx.translate(-cam*s,base);ctx.scale(s,s);let left=cam-100,right=cam+W/s+100;if(track===0)mapScenery(track,left,right);drawGround(track,left,right,Math.max(500,(H-base)/s+250));if(track!==0)mapScenery(track,left,right);for(let x=Math.max(checkpoint,Math.floor(left/checkpoint)*checkpoint);x<right;x+=checkpoint){let y=terrain(x);ctx.fillStyle='#f8edcb';ctx.fillRect(x-4,y-103,5,103);path([[x,y-100],[x+45,y-88],[x,y-76]],'#e64d36');ctx.fillStyle='#fff7df';ctx.font='bold 13px Arial';ctx.fillText(Math.round(Math.max(0,worldMetres(x-(cars[window.onlineIndex??0]?.startX??0))))+' м · ЗАПРАВКА',x-35,y-116);ctx.fillStyle='#e64d36';ctx.fillRect(x+12,y-35,21,26);ctx.strokeStyle='#3e4b30';ctx.lineWidth=3;ctx.strokeRect(x+12,y-35,21,26);ctx.strokeRect(x+17,y-41,10,7);ctx.fillStyle='#f5dfc1';ctx.fillRect(x+17,y-26,11,4)}
for(const b of bonus)if(b.claimedBy===null)drawCrate(b);
cars.slice().sort((a,b)=>a.x-b.x).forEach(c=>carDraw(c));for(let p of particles)circle(p.x,p.y,4,p.color);ctx.restore()}
function escapeLabel(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function racerName(c){return window.onlineIndex!==undefined?(window.racerNames?.[c.i]||'Игрок '+(c.i+1)):names[chosen[c.i]].replace('_',' ')}
let hudRoster='',hudNext=0;
function renderHud(){
 const now=performance.now();if(now<hudNext)return;hudNext=now+100;
 let shown=cars;
 if(window.onlineIndex!==undefined){
  const own=(window.onlineIndices||[window.onlineIndex]).map(i=>cars[i]).filter(Boolean),leader=cars.filter(c=>c.alive).reduce((a,b)=>!a||b.x>a.x?b:a,null);
  shown=mobileInput.matches&&own.length?[own[0]]:[...own,...(leader&&!own.includes(leader)?[leader]:[])];
 }
 const roster=shown.map(c=>c.i+':'+chosen[c.i]+':'+colors[c.i]+':'+racerName(c)).join('|');
 if(roster!==hudRoster){
  hudRoster=roster;
  $('#hud').innerHTML=shown.map(c=>`<div class="stat" style="--color:${colors[c.i]}"><strong>${escapeLabel(racerName(c))}</strong><small></small><div class="fuel"><i></i></div><p class="telemetry"></p><p class="ability-status"></p></div>`).join('');
 }
 shown.forEach((c,j)=>{
  const stat=$('#hud').children[j];if(!stat)return;
  stat.style.opacity=c.alive?1:.6;
  stat.querySelector('small').textContent=Math.floor(raceMetres(c))+' м';
  const fuel=stat.querySelector('.fuel i');fuel.style.width=c.fuel+'%';fuel.style.background=c.fuel<20?'#e64d36':'#65a53b';
  stat.querySelector('.telemetry').textContent=c.alive?`${Math.round(c.fuel)}% · ${Math.round(speedKph(c.vx))} км/ч${window.onlineIndex!==undefined?' · '+((window.onlineIndices||[window.onlineIndex]).includes(c.i)?'Вы':'Соперник'):''}`:c.reason;
  const status=`${c.mud>0?'Грязь '+Math.ceil(c.mud)+' с · ':''}${abilityNames[c.ability]} · ${c.cooldown>0?Math.ceil(c.cooldown)+' с':'готово'}`;
  stat.querySelector('.ability-status').textContent=status;
  if(c.i===(window.onlineIndex??0)){
   const button=$('[data-control="ability"]');
   if(button){button.querySelector('.touch-hint').textContent=abilityNames[c.ability]+(c.cooldown>0?' · '+Math.ceil(c.cooldown)+' с':'');button.setAttribute('aria-label',abilityNames[c.ability]);button.disabled=!c.alive||c.cooldown>0||count>0;}
  }
 });
}
// Each frame starts independently of any interrupted or clipped drawing.
function resetDrawingSurface(){
 if(typeof ctx.reset==='function')ctx.reset();
 else canvas.width=canvas.width;
 ctx.setTransform(renderRatio,0,0,renderRatio,0,0);
}
function drawScene(){resetDrawingSurface();background();if(mode==='lobby'){drawGarageRoad();return}world();drawWeather();renderHud();if(!mobileInput.matches){ctx.fillStyle='#20382f';ctx.font='bold 12px Arial';ctx.fillText(MAPS[track].name+' · '+(track===2?'ГРАВИТАЦИЯ ×⅙ · ':'')+'∞',26,H-32);ctx.textAlign='right';ctx.fillText('В ВОЗДУХЕ: ГАЗ ↑ НОС  /  ТОРМОЗ ↓ НОС     •     '+time.toFixed(1)+' с',W-26,H-32);ctx.textAlign='left';ctx.fillStyle='#20382f30';ctx.fillRect(26,H-20,W-52,5);cars.forEach(c=>{ctx.fillStyle=colors[c.i];ctx.fillRect(26+Math.min(1,Math.max(0,(c.x-cam)/(W/scale())))*(W-52),H-24,7,13)});}if(count>0){ctx.fillStyle='#fff8e7';ctx.strokeStyle='#35543d';ctx.lineWidth=6;ctx.font='bold 100px Arial';ctx.textAlign='center';ctx.strokeText(Math.ceil(count),W/2,H*.4);ctx.fillText(Math.ceil(count),W/2,H*.4);ctx.font='bold 16px Arial';ctx.fillStyle='#20382f';ctx.fillText('ПРИГОТОВЬТЕСЬ',W/2,H*.4+40);ctx.textAlign='left'}}
function draw(){window.sceneLayers?.begin();try{drawScene()}finally{window.sceneLayers?.end()}}
let last=performance.now(),lastDraw=0,acc=0,previousCamera=null;
const previousCratePoses=new Map();let previousSceneTime=null;
const previousPoses=new WeakMap(),renderFields=['x','y','a','wheel'];
const frameTimes=[],frameWorkTimes=[];
let performanceNext=0,performanceWasRunning=false;
function getPerformanceStats(){
 const sorted=[...frameTimes].sort((a,b)=>a-b),mean=values=>values.length?values.reduce((sum,n)=>sum+n,0)/values.length:0,workMs=mean(frameWorkTimes);
 return {fps:frameTimes.length?1000/mean(frameTimes):0,estimatedFps:workMs>0?1000/workMs:0,frameWorkMs:workMs,p95FrameMs:sorted[Math.floor(sorted.length*.95)]||0,renderRatio,canvasWidth:canvas.width,canvasHeight:canvas.height,physicsHz:120,frameCap:null};
}
function recordFramePerformance(cost,now){
 const running=mode==='race'&&!paused,meter=$('#fps-meter');meter.hidden=mode!=='race';
 if(running!==performanceWasRunning){frameWorkTimes.length=0;frameTimes.length=0;performanceNext=0;performanceWasRunning=running;}
 if(!running){meter.textContent='FPS · пауза';return;}
 frameWorkTimes.push(cost);if(frameWorkTimes.length>120)frameWorkTimes.shift();
 if(now<performanceNext)return;performanceNext=now+500;
 const stats=getPerformanceStats();meter.textContent=Math.round(stats.fps)+' FPS\nКадр 95%: '+stats.p95FrameMs.toFixed(1)+' мс';
}

function drawInterpolated(alpha){
 const camera=[cam,cameraY,zoom],sceneTime=time,saved=[],savedCrates=[];
 if(previousCamera&&mode==='race'&&!paused){
  if(previousSceneTime!==null&&Math.abs(time-previousSceneTime)<.1)time=previousSceneTime+(time-previousSceneTime)*alpha;
  for(const crate of bonus){
   const previous=previousCratePoses.get(crate.id);if(!previous)continue;const fields=['x','y','a','age','chuteFade'],current=fields.map(key=>crate[key]);savedCrates.push([crate,fields,current]);fields.forEach((key,i)=>crate[key]=previous[i]+(current[i]-previous[i])*alpha);
  }
  [cam,cameraY,zoom]=camera.map((value,i)=>previousCamera[i]+(value-previousCamera[i])*alpha);
  for(const car of cars){
   const previous=previousPoses.get(car);if(!previous)continue;
   const current=renderFields.map(key=>car[key]);saved.push([car,current]);
   renderFields.forEach((key,i)=>car[key]=previous[i]+(current[i]-previous[i])*alpha);
  }
 }
 try{draw();}finally{
  [cam,cameraY,zoom]=camera;time=sceneTime;
  for(const [crate,fields,current] of savedCrates)fields.forEach((key,i)=>crate[key]=current[i]);
  for(const [car,current] of saved)renderFields.forEach((key,i)=>car[key]=current[i]);
 }
}
function frame(now){
 requestAnimationFrame(frame);
 if(document.hidden){last=now;acc=0;refreshLast=0;return;}
 measureRefresh(now);
 // Avoid rendering a static lobby at 120 Hz on high-refresh phones.
 const interval=mode==='lobby'||paused?1000/15:0;
 if(now-lastDraw<interval-.5)return;
 if(mode==='race'&&lastDraw){frameTimes.push(now-lastDraw);if(frameTimes.length>240)frameTimes.shift();}
 lastDraw=now;
 const frameStarted=performance.now();
 const dt=Math.min(.05,(now-last)/1000);last=now;
 acc+=dt;while(acc>=1/120){
  previousCamera=[cam,cameraY,zoom];previousSceneTime=time;
  previousCratePoses.clear();for(const crate of bonus)previousCratePoses.set(crate.id,[crate.x,crate.y,crate.a,crate.age,crate.chuteFade]);
  for(const car of cars)previousPoses.set(car,renderFields.map(key=>car[key]));
  update(1/120);acc-=1/120;
 }
 const renderingStarted=performance.now();
 if(mode==='lobby')time+=dt;syncGameScreen();window.updateTouchHints?.(dt);animateSuspension(dt);drawInterpolated(acc*120);
 if(mode==='lobby'){window.refreshChoices?.();window.renderSettingPreviews?.();warmSelectedVehicle();}
 if(engineAudio){
  const ownIndex=window.onlineIndex??0,c=cars[ownIndex],controls=c?input(c.i):[false,false];
  engineAudio.updateEnvironment({enabled:sound&&!paused&&!document.hidden,active:mode==='race'&&!paused&&count<=0,car:c,mode,count});
  engineAudio.update(dt,{active:sound&&mode==='race'&&!paused&&count<=0,car:c,spec:c?carSpec(c):null,gas:controls[0],brake:controls[1]});
 }
 if(mode==='race'&&!paused)adaptRenderQuality(performance.now()-renderingStarted);
 recordFramePerformance(performance.now()-frameStarted,now);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{keysClear();last=performance.now();acc=0;frameTimes.length=0;frameWorkTimes.length=0;lastDraw=0;performanceNext=0;if(document.hidden)engineAudio?.silence();});
window.gameDebug={getPerformance:getPerformanceStats,getState:()=>({mode,playerCount,count,cam,zoom,time,renderRatio,cars:cars.map(c=>({...c})),bonus:bonus.length,seed:worldSeed,vehicle:VEHICLES[vehicleModel].name,track,biome:mapBiome(track,cam+W/scale()*.5),snowing:snowing()}),activateAbility,start,step:n=>{for(let j=0;j<n;j++)update(1/120)},setInput:(i,g,b)=>{const k=[['KeyD','KeyA'],['ArrowRight','ArrowLeft'],['Mouse2','Mouse0']][i];keys[k[0]]=g;keys[k[1]]=b}};











;

// loading.js
'use strict';
// Wait for the actual images used by the renderer, including browser decoding.
// Keep the same Image objects so the renderer never starts with empty textures.
let assetsLoaded=false;
const loadingScreen=document.createElement('div');loadingScreen.id='loading-screen';loadingScreen.className='asset-status';
loadingScreen.innerHTML='<section><h2>Загрузка игры</h2><p id="loading-status" role="status" aria-live="polite">Загружаем машины, персонажей и трассы…</p><progress id="loading-progress" max="1" value="0"></progress><button id="retry-loading" hidden>Повторить загрузку</button></section>';
document.body.append(loadingScreen);
const gameImages=[...new Set([...images,environmentAtlas,hillArt,...(typeof hillLandscapeLayers==='undefined'?[]:hillLandscapeLayers.flatMap(layer=>layer.images)),...hillTrees,hillCrestSun,hillCloud,...Object.values(paintedBodies)])];
const decodedAssets=new Set();let failedAssets=new Set(),loadingAssets=false;
function decodeAsset(im,reload=false){
 return new Promise((resolve,reject)=>{
  let settled=false;const timeout=setTimeout(()=>finish(Error('Время загрузки истекло')),180000);
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);im.removeEventListener('load',loaded);im.removeEventListener('error',failed);error?reject(error):resolve();};
  const loaded=()=>{if(!im.naturalWidth){failed();return;}im.decode().then(()=>finish(),finish);};
  const failed=()=>finish(Error('Не удалось загрузить текстуры'));
  if((!reload||typeof im.src!=='string'||!im.src)&&im.complete&&im.naturalWidth){loaded();return;}
  im.addEventListener('load',loaded,{once:true});im.addEventListener('error',failed,{once:true});
  if(reload&&typeof im.src==='string'&&im.src){const url=new URL(im.src,location.href);url.searchParams.set('_asset_retry',String(Date.now()));im.src=url.href;return;}
  if(im.assetSource&&!im.getAttribute('src')){im.src=im.assetSource;return;}
  if(im.complete){const src=im.src;im.src='';im.src=src;}
 });
}
let resolveAssets;
window.assetsReady=new Promise(resolve=>resolveAssets=resolve);
async function loadGameAssets(){
 if(loadingAssets)return;loadingAssets=true;
 $('#retry-loading').hidden=true;$('#retry-loading').disabled=true;
 let done=decodedAssets.size;const previousFailures=failedAssets;failedAssets=new Set();
 $('#loading-status').textContent=`Текстуры: ${done} / ${gameImages.length}`;
 const preferred=[images[0],paintedBodies.jeep,...(typeof hillLandscapeLayers==='undefined'?[]:hillLandscapeLayers.flatMap(layer=>layer.images))];
 const pending=[...new Set([...preferred,...gameImages])].filter(im=>im&&!decodedAssets.has(im));
 const worker=async()=>{while(pending.length){const im=pending.shift();try{await decodeAsset(im,previousFailures.has(im));decodedAssets.add(im);}catch(error){failedAssets.add(im);}finally{$('#loading-progress').value=++done/gameImages.length;$('#loading-status').textContent=`Текстуры: ${decodedAssets.size} / ${gameImages.length}`;}}};
 await Promise.allSettled(Array.from({length:3},worker));
 if(failedAssets.size){const names=[...failedAssets].slice(0,3).map(im=>{try{return decodeURIComponent((im.src||'изображение').split('/').pop().split('?')[0]);}catch{return 'изображение';}});$('#loading-status').textContent=`Не загрузились: ${names.join(', ')}${failedAssets.size>3?' и ещё '+(failedAssets.size-3):''}. Повторная загрузка скачает только недостающие файлы.`;$('#retry-loading').hidden=false;$('#retry-loading').disabled=false;loadingAssets=false;return;}
 // Build the reusable scenery textures before racing rather than on the first frame.
 for(let i=0;i<hillTrees.length;i++)hillTexture(hillTrees[i],hillTreeBounds[i],512);
 hillTexture(hillCloud,hillCloudBounds,128);
 for(const crop of (typeof ENV_CROPS==='undefined'?[]:ENV_CROPS))hillTexture(environmentAtlas,crop,512);
 if(typeof prepareHillBackground==='function')prepareHillBackground();
 assetsLoaded=true;if(typeof warmSelectedVehicle==='function')warmSelectedVehicle();loadingAssets=false;loadingScreen.remove();resolveAssets();
}
$('#retry-loading').onclick=loadGameAssets;
loadGameAssets();

;

// qrcode.js
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));

;

// menu-icons.js
'use strict';
// Shared vector artwork uses one grid and one consistent stroke.
const menuIconPaths={
 globe:'<circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="5.5" ry="12"/><path d="M4 16h24M6.2 9h19.6M6.2 23h19.6"/>',
 chat:'<path d="M16 4a12 12 0 1 1-6.3 22.2L3 29l2.8-6.7A12 12 0 0 1 16 4Z"/><circle class="icon-dot" cx="11" cy="16" r="1.4"/><circle class="icon-dot" cx="16" cy="16" r="1.4"/><circle class="icon-dot" cx="21" cy="16" r="1.4"/>',
 link:'<g transform="scale(1.3333)"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></g>',
 leave:'<path d="M14 4H5a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h9"/><path d="M12 16h17m-6-6 6 6-6 6"/><path d="M9 16h.01"/>',
 kick:'<path d="M8 8l16 16M24 8 8 24"/>',
 qr:'<path d="M4 4h9v9H4zM19 4h9v9h-9zM4 19h9v9H4zM19 19h4v4h-4zM27 19v4M19 27h4M27 27h1"/><path d="M8 8h1v1H8zM23 8h1v1h-1zM8 23h1v1H8z"/>',
 pencil:'<path d="m21 5 6 6M5 27l7-2L28 9a2 2 0 0 0 0-3l-2-2a2 2 0 0 0-3 0L7 20Z"/>',
 turbo:'<path class="icon-accent" d="M18 3 7 18h8l-1 11 11-16h-8Z"/>',
 jump:'<path class="icon-accent" d="m16 3-10 11h6v10h8V14h6Z"/><path d="M6 29h20"/>',
 shield:'<path class="icon-accent" d="m16 3 11 4v9c0 7-6 11-11 14C11 27 5 23 5 16V7Z"/><path d="M16 8v15M10 12l6-4 6 4"/>',
 left:'<path d="m19 7-9 9 9 9"/>',right:'<path d="m13 7 9 9-9 9"/>',
 sun:'<circle class="weather-sun" cx="16" cy="16" r="6"/><path d="M16 2v3M16 27v3M2 16h3M27 16h3M6 6l2 2M24 24l2 2M6 26l2-2M24 8l2-2"/>',
 cloud:'<path class="weather-cloud" d="M8 25a6 6 0 0 1-1-12 9 9 0 0 1 17-1 6.5 6.5 0 0 1 0 13Z"/>',
 snow:'<path class="weather-cloud" d="M8 21a5 5 0 0 1-1-10 8 8 0 0 1 15-1 5.5 5.5 0 0 1 1 11Z"/><path d="m8 26 2 2m0-2-2 2m7-2 2 2m0-2-2 2m7-2 2 2m0-2-2 2"/>',
 moon:'<path class="weather-cloud" d="M24 25A13 13 0 0 1 8 5a12 12 0 0 0 16 20Z"/>'
};
// Eight regular teeth make a symmetrical, readable gear even at small sizes.
menuIconPaths.settings='<path d="'+Array.from({length:32},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/16,r=[11,11,8.8,8.8][i%4];return (i?'L':'M')+(16+Math.cos(angle)*r).toFixed(2)+' '+(16+Math.sin(angle)*r).toFixed(2);}).join(' ')+'Z"/><circle cx="16" cy="16" r="4"/>';
function menuIcon(name){return '<svg class="menu-icon icon-'+name+'" viewBox="0 0 32 32" aria-hidden="true" focusable="false">'+(menuIconPaths[name]||'')+'</svg>';}

;

// drawers.js
'use strict';
// Same slide timing and gesture threshold as Travagram; vertical scrolling stays native.
const gameDrawers=new Set();
function setupGameDrawer(dialog,title,closeButton){
 const nativeOpen=dialog.showModal.bind(dialog),nativeClose=dialog.close.bind(dialog);
 const head=document.createElement('div');head.className='drawer-head';const heading=document.createElement('h2');heading.textContent=title;heading.id=dialog.id+'-heading';
 const body=document.createElement('div');body.className='drawer-body';
 dialog.querySelector(':scope > h2')?.remove();
 for(const child of [...dialog.children])if(child!==closeButton)body.append(child);
 head.append(heading,closeButton);dialog.append(head,body);dialog.classList.add('game-drawer');dialog.setAttribute('aria-labelledby',heading.id);closeButton.textContent='×';
 let closingTimer,gesture;
 dialog.finishClose=()=>{clearTimeout(closingTimer);dialog.classList.remove('closing');dialog.style.transform='';if(dialog.open)nativeClose();};
 dialog.showModal=()=>{for(const other of gameDrawers)if(other!==dialog)other.finishClose();clearTimeout(closingTimer);dialog.classList.remove('closing');dialog.style.transform='';if(!dialog.open)nativeOpen();};
 dialog.close=()=>{if(!dialog.open)return;dialog.classList.add('closing');dialog.style.transform='';clearTimeout(closingTimer);closingTimer=setTimeout(dialog.finishClose,matchMedia('(prefers-reduced-motion:reduce)').matches?0:240);};
 closeButton.onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
 dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
 dialog.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('input,textarea,button'))return;const t=e.touches[0];gesture={x:t.clientX,y:t.clientY,at:performance.now(),dx:0,drag:false};},{passive:true});
 dialog.addEventListener('touchmove',e=>{if(!gesture||e.touches.length!==1)return;const t=e.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;if(!gesture.drag){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;if(dx<0||Math.abs(dy)>Math.abs(dx)){gesture=null;return;}gesture.drag=true;}gesture.dx=Math.max(0,dx);dialog.style.transition='none';dialog.style.transform='translateX('+gesture.dx+'px)';if(e.cancelable)e.preventDefault();},{passive:false});
 const finish=()=>{if(!gesture)return;const g=gesture;gesture=null;dialog.style.transition='';dialog.style.transform='';if(g.drag&&(g.dx>64||g.dx/Math.max(1,performance.now()-g.at)>.4))dialog.close();};
 dialog.addEventListener('touchend',finish);dialog.addEventListener('touchcancel',()=>{gesture=null;dialog.style.transition='';dialog.style.transform='';});gameDrawers.add(dialog);
 const syncViewport=()=>{const v=window.visualViewport;dialog.style.setProperty('--drawer-height',(v?.height||innerHeight)+'px');dialog.style.setProperty('--drawer-top',(v?.offsetTop||0)+'px');};syncViewport();window.visualViewport?.addEventListener('resize',syncViewport);window.visualViewport?.addEventListener('scroll',syncViewport);
 return body;
}

;

// rooms.js
'use strict';
function createRoomsUI(){
 const browser=document.createElement('section');browser.id='room-browser';browser.className='room-connect';
 browser.innerHTML=`<form id="join-code" autocomplete="off"><label for="room-code">Подключиться к онлайн-комнате</label><div><input type="text" inputmode="text" name="room-code" id="room-code" maxlength="5" minlength="5" pattern="[A-Za-z]{5}" placeholder="КОД ИЗ 5 БУКВ" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" required aria-label="Код комнаты из пяти латинских букв"></div></form><p id="directory-notice" role="status">Вы в своей комнате. Введите код другой комнаты, чтобы присоединиться.</p>`;
 let attemptedCode='';
 const tryCode=()=>{const field=$('#room-code'),code=field.value;if(code.length===5&&code!==attemptedCode){attemptedCode=code;field.classList.remove('code-error');field.removeAttribute('aria-invalid');$('#directory-notice').textContent='';send({type:'join-room',code});}};
 browser.querySelector('#room-code').oninput=e=>{e.target.value=e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,5);if(e.target.value.length<5)attemptedCode='';e.target.classList.remove('code-error');e.target.removeAttribute('aria-invalid');$('#directory-notice').classList.remove('code-error');$('#directory-notice').textContent='';tryCode();};
 browser.querySelector('#join-code').noValidate=true;browser.querySelector('#join-code').onsubmit=e=>{e.preventDefault();if($('#room-code').value.length!==5){roomUI.notice('Введите пять латинских букв.');return;}attemptedCode='';tryCode();};
 const panel=$('#room-panel');
 panel.innerHTML=`<div class="room-heading"><h2 id="room-title" aria-label="Название комнаты"></h2><button id="rename-room" class="icon-button" title="Изменить название комнаты" aria-label="Изменить название комнаты"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z"/></svg></button><button id="copy-code" title="Скопировать код комнаты"></button></div><div class="room-invite"><button id="copy-link">Скопировать ссылку</button><button id="show-qr">QR-код</button><span id="invite-status" role="status"></span></div><p id="host-caption"></p><div class="room-list"></div><div class="room-party-controls"><button id="add-local-racer" type="button">＋ Добавить игрока на этом устройстве</button><button id="remove-local-racer" type="button" aria-label="Убрать последнего игрока">−</button></div><p id="room-status"></p><p id="connection-status"></p><div id="room-chat"><h3>Чат комнаты</h3><div id="chat-log" role="log" aria-live="polite"></div><form id="chat-form" autocomplete="off"><textarea id="chat-text" name="message" rows="1" inputmode="text" maxlength="300" placeholder="Написать сообщение…" aria-label="Сообщение в чат" autocomplete="off" autocapitalize="sentences" autocorrect="on" spellcheck="true" enterkeyhint="send"></textarea><button aria-label="Отправить сообщение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 18-7-7 18-4-7Z"/><path d="m10 14 5-5"/></svg></button></form></div>`;
 panel.querySelector('.room-heading').append($('#room-status'));
 $('#room-title').textContent='Ваша комната';$('#room-status').textContent='Подключение…';
 $('#add-local-racer').onclick=()=>window.changeOnlineParty?.(1);$('#remove-local-racer').onclick=()=>window.changeOnlineParty?.(-1);
 const roomTitle=$('#room-title'),renameButton=$('#rename-room');let editingRoomName=false,originalRoomName='';
 const stopRoomNameEdit=save=>{if(!editingRoomName)return;const name=roomTitle.textContent.trim().slice(0,36);roomTitle.contentEditable='false';roomTitle.removeAttribute('role');roomTitle.removeAttribute('aria-multiline');editingRoomName=false;renameButton.setAttribute('aria-label','Изменить название комнаты');renameButton.title='Изменить название комнаты';renameButton.innerHTML=menuIcon('pencil');roomTitle.textContent=save&&name?name:originalRoomName;if(save&&name&&name!==originalRoomName)send({type:'rename-room',name});};
 renameButton.onpointerdown=e=>{if(editingRoomName)e.preventDefault();};renameButton.onmousedown=e=>{if(editingRoomName)e.preventDefault();};
 renameButton.onclick=()=>{if(editingRoomName){stopRoomNameEdit(true);return;}originalRoomName=roomTitle.textContent;editingRoomName=true;roomTitle.contentEditable='true';roomTitle.setAttribute('role','textbox');roomTitle.setAttribute('aria-label','Название комнаты');roomTitle.setAttribute('aria-multiline','false');renameButton.setAttribute('aria-label','Сохранить название комнаты');renameButton.title='Сохранить название комнаты';renameButton.innerHTML='<svg class="menu-icon icon-check" viewBox="0 0 32 32" aria-hidden="true"><path d="m6 17 7 7L27 9"/></svg>';roomTitle.focus({preventScroll:true});const selection=getSelection(),range=document.createRange();range.selectNodeContents(roomTitle);selection.removeAllRanges();selection.addRange(range);};
 roomTitle.onkeydown=e=>{if(!editingRoomName)return;if(e.key==='Enter'){e.preventDefault();stopRoomNameEdit(true);}else if(e.key==='Escape'){e.preventDefault();stopRoomNameEdit(false);}};
 roomTitle.onblur=()=>stopRoomNameEdit(true);
 $('#chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chat-text').value.trim();if(text){send({type:'chat',text});$('#chat-text').value='';$('#chat-text').focus();}};
 $('#chat-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chat-form').requestSubmit();}});
 const chatDialog=document.createElement('dialog');chatDialog.id='chat-dialog';chatDialog.innerHTML='<button id="close-chat" type="button" aria-label="Закрыть чат">×</button>';document.body.append(chatDialog);chatDialog.append($('#room-chat'));$('#room-chat h3').remove();setupGameDrawer(chatDialog,'Чат комнаты',$('#close-chat'));
 const networkDialog=document.createElement('dialog');networkDialog.id='network-dialog';networkDialog.innerHTML='<button id="close-network" type="button" aria-label="Закрыть список игроков">×</button><h2>Игроки в сети</h2><div id="network-room-list" role="list"></div>';document.body.append(networkDialog);setupGameDrawer(networkDialog,'Игроки в сети',$('#close-network'));
 const chatLog=$('#chat-log'),chatInput=$('#chat-text');chatInput.setAttribute('enterkeyhint','send');
 const touchChat=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;let chatKeyboardSeen=false,chatFocusHeight=0;
 const syncChatViewport=()=>{const viewport=window.visualViewport;if(viewport){chatDialog.style.setProperty('--chat-viewport-top',viewport.offsetTop+'px');chatDialog.style.setProperty('--chat-viewport-height',viewport.height+'px');}if(!touchChat)return;if(!chatInput.matches(':focus')){chatKeyboardSeen=false;chatFocusHeight=0;chatDialog.classList.remove('keyboard-open');return;}const height=viewport?.height||innerHeight;if(height<chatFocusHeight-80)chatKeyboardSeen=true;if(chatKeyboardSeen&&height>=chatFocusHeight-40)chatDialog.classList.remove('keyboard-open');else chatDialog.classList.add('keyboard-open');};
 chatInput.addEventListener('focus',()=>{if(touchChat){chatKeyboardSeen=false;chatFocusHeight=window.visualViewport?.height||innerHeight;chatDialog.classList.add('keyboard-open');}});
 chatInput.addEventListener('blur',()=>{chatKeyboardSeen=false;chatDialog.classList.remove('keyboard-open');});
 syncChatViewport();window.visualViewport?.addEventListener('resize',syncChatViewport);window.visualViewport?.addEventListener('scroll',syncChatViewport);
 let unreadCount=0,lastChatId=0,activeRoomCode='';
 const setUnread=()=>{const badge=$('#chat-unread');badge.textContent=unreadCount>99?'99+':String(unreadCount);badge.hidden=!unreadCount;chatToggle.setAttribute('aria-label',unreadCount?'Чат, непрочитанных сообщений: '+unreadCount:'Открыть чат');};
 const markChatRead=()=>{unreadCount=0;lastChatId=Math.max(lastChatId,...messages.map(message=>message.id||0));setUnread();};
 const closeChat=()=>chatDialog.close();
 $('#close-chat').onclick=closeChat;
 const closeNetwork=()=>networkDialog.close();$('#close-network').onclick=closeNetwork;
 const sidebar=document.createElement('div');sidebar.id='room-sidebar';sidebar.append($('#copy-link'),$('#show-qr'),panel.querySelector('.room-party-controls'));panel.append(sidebar);$('#copy-link').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1l-1.4 1.4"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1l1.4-1.4"/></svg>';$('#copy-link').title='Скопировать ссылку';$('#copy-link').setAttribute('aria-label','Скопировать ссылку');
 $('#show-qr').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/></svg>';$('#show-qr').title='Показать QR-код';$('#show-qr').setAttribute('aria-label','Показать QR-код');
 panel.append(browser);
 const settingsButton=document.createElement('button');settingsButton.id='room-settings';settingsButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></svg>';settingsButton.title='Настройки';settingsButton.setAttribute('aria-label','Настройки');sidebar.append(settingsButton);
 const options=document.createElement('dialog');options.id='room-options';options.innerHTML='<button id="close-settings" type="button" aria-label="Закрыть настройки">×</button>';document.body.append(options);setupGameDrawer(options,'Настройки',$('#close-settings'));settingsButton.onclick=()=>{if(options.open)options.close();else options.showModal();settingsButton.setAttribute('aria-expanded',String(options.open));};
 const networkToggle=document.createElement('button');networkToggle.id='network-toggle';networkToggle.type='button';networkToggle.setAttribute('aria-label','Игроки в сети');networkToggle.title='Игроки в сети';sidebar.insertBefore(networkToggle,settingsButton);networkToggle.onclick=()=>{if(chatDialog.open)chatDialog.close();networkDialog.querySelector('.drawer-body').scrollTop=0;networkDialog.showModal();send({type:'directory'});};
 const leaveRoom=document.createElement('button');leaveRoom.id='leave-room';leaveRoom.type='button';leaveRoom.setAttribute('aria-label','Выйти из комнаты');leaveRoom.title='Выйти из комнаты';sidebar.insertBefore(leaveRoom,settingsButton);leaveRoom.onclick=()=>window.onlineSession?.leaveRoom();
 const chatToggle=document.createElement('button');chatToggle.id='room-chat-toggle';chatToggle.type='button';chatToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-7.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg><span id="chat-unread" class="chat-unread" hidden></span>';chatToggle.setAttribute('aria-label','Открыть чат');chatToggle.title='Открыть чат';sidebar.append(chatToggle);chatToggle.onclick=()=>{if(chatDialog.open){chatDialog.close();return;}if(networkDialog.open)networkDialog.close();chatDialog.showModal();markChatRead();syncChatViewport();};
 for(const [id,icon] of Object.entries({'network-toggle':'globe','leave-room':'leave','room-chat-toggle':'chat','room-settings':'settings','copy-link':'link','show-qr':'qr','rename-room':'pencil'})){const button=$('#'+id);if(id==='room-chat-toggle'){button.querySelector('svg').outerHTML=menuIcon(icon);}else button.innerHTML=menuIcon(icon);}
 panel.addEventListener('click',event=>{const button=event.target.closest('[data-kick-player]');if(button&&!button.disabled)send({type:'kick-player',player:button.dataset.kickPlayer});});
 sidebar.prepend(chatToggle);
 const invitation=()=>{const url=new URL(location.href);url.search='';url.searchParams.set('mode','online');url.searchParams.set('room',roomState.room.code);return url.href;};
 document.addEventListener('pointerdown',e=>{if(options.open&&e.target.closest('#close-settings'))settingsButton.setAttribute('aria-expanded','false');});
 const shareDialog=document.createElement('dialog');shareDialog.id='invite-dialog';shareDialog.innerHTML='<button id="close-invite" type="button" aria-label="Закрыть QR-код">×</button><div id="invite-qr" role="img" aria-label="QR-код подключения к комнате"></div>';document.body.append(shareDialog);setupGameDrawer(shareDialog,'QR-код комнаты',$('#close-invite'));
 const copy=async(value,label)=>{try{await navigator.clipboard.writeText(value);$('#directory-notice').textContent=label;}catch{const field=document.createElement('textarea');field.value=value;field.style.cssText='position:fixed;left:-9999px';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();$('#directory-notice').textContent=copied?label:'Не удалось скопировать. Разрешите доступ к буферу обмена.';}};
 $('#copy-code').onclick=()=>copy(roomState.room.code,'Код скопирован');$('#copy-link').onclick=()=>copy(invitation(),'Ссылка скопирована');
 $('#show-qr').onclick=()=>{const qr=qrcode(0,'M');qr.addData(invitation());qr.make();$('#invite-qr').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true});shareDialog.showModal();};
 let messages=[];
 let networkDirectorySignature='';
 const renderNetworkDirectory=state=>{
  const rooms=state.rooms||[];
  const target=$('#network-room-list'),scrollContainer=target.parentElement,signature=JSON.stringify(rooms);
  if(signature===networkDirectorySignature&&target.childElementCount)return;
  const scrollTop=scrollContainer.scrollTop;target.replaceChildren();networkDirectorySignature=signature;
  if(!rooms.length){const empty=document.createElement('p');empty.className='empty-rooms';empty.textContent='Пока никто не создал комнату.';target.append(empty);return;}
  for(const room of rooms){
   const card=document.createElement('article');card.className='network-room-card';card.setAttribute('role','listitem');
   const header=document.createElement('div');header.className='network-room-heading';const title=document.createElement('b');title.textContent=room.name||('Гонка '+room.code);const code=document.createElement('span');code.textContent=room.code;header.append(title,code);
   const people=document.createElement('p');people.className='network-room-players';people.textContent=(room.players||[]).join(' · ')||'Гонщики подключаются';
   const meta=document.createElement('p');meta.className='network-room-meta';meta.textContent=`${room.count||0}/${room.capacity||8} игроков · ${{lobby:'Ожидание',countdown:'Старт скоро',race:'Идёт гонка',result:'Результаты'}[room.phase]||'Ожидание'}${room.local?' · В вашей сети':''}`;
   const action=document.createElement('button');action.type='button';action.textContent=room.code===roomState?.room?.code?'Вы здесь':'Подключиться';action.disabled=room.code===roomState?.room?.code||(room.count||0)>=(room.capacity||8);action.onclick=()=>{closeNetwork();send({type:'join-room',code:room.code});};
   card.append(header,people,meta,action);target.append(card);
  }
  scrollContainer.scrollTop=Math.min(scrollTop,scrollContainer.scrollHeight-scrollContainer.clientHeight);
 };
 window.setInterval(()=>{if(networkDialog.open)send({type:'directory'});},5000);
 const list=(target,rooms)=>{
  target.replaceChildren();
  if(!rooms.length){const empty=document.createElement('p');empty.className='empty-rooms';empty.textContent=target.id==='local-rooms'?'Пока нет комнат в вашей сети. Создайте первую.':'Пока нет открытых комнат. Начните свою гонку.';target.append(empty);return;}
  for(const room of rooms){const card=document.createElement('button');card.className='room-card';card.disabled=room.count>=room.capacity;const title=document.createElement('b');title.textContent=room.name;const details=document.createElement('span');details.textContent=room.code+' · '+room.count+'/'+room.capacity+' игроков · '+({lobby:'Ожидание',countdown:'Скоро старт',race:'Идёт гонка',result:'Результаты'}[room.phase]||'Ожидание');const map=document.createElement('small');map.textContent=MAPS[room.track].name+' · '+VEHICLES[room.vehicle].name;card.append(title,details,map);card.onclick=()=>send({type:'join-room',code:room.code});target.append(card);}
 };
 return {
  browser,
  updateDirectory:renderNetworkDirectory,
  directory(state){
   roomState=null;mode='lobby';snapshots=[];onlineRound=-1;localCar=null;window.onlineIndex=undefined;window.racerNames=[];
   $('#lobby').hidden=false;browser.hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;if(window.cardTools)($('#room-options .drawer-body')||$('#room-options')).append(window.cardTools);
   $('#room-title').textContent='Онлайн-комнаты';$('#copy-code').textContent='';$('#rename-room').hidden=true;$('.room-list').replaceChildren();$('#room-status').textContent='Выберите комнату из сети или введите её код.';renderNetworkDirectory(state);
   onlineBar.textContent='';if(!$('#room-code').hasAttribute('aria-invalid'))$('#directory-notice').textContent='Выберите комнату в сети или введите код другой комнаты.';$('#menu').hidden=true;
   messages=[];lastChatId=0;unreadCount=0;setUnread();$('#chat-log').replaceChildren();$('#chat-log').hidden=false;stopRoomNameEdit(false);shareDialog.close();chatDialog.close();window.peerTransport?.reset();
  },
  state(state){
   if(activeRoomCode!==state.room.code){activeRoomCode=state.room.code;messages=[];lastChatId=0;unreadCount=0;$('#chat-log').replaceChildren();setUnread();}
   browser.hidden=false;$('#lobby').hidden=false;$('#menu').hidden=true;if(window.cardTools){const target=$('#room-options .drawer-body');if(window.cardTools.parentElement!==target)target.append(window.cardTools);}
   if(!editingRoomName)$('#room-title').textContent=state.room.name;$('#copy-code').textContent=state.room.code+' ⧉';$('#rename-room').hidden=state.room.host!==state.you;$('#rename-room').disabled=!['lobby','result'].includes(state.phase);if(state.room.host!==state.you)stopRoomNameEdit(false);
   for(const player of state.players.filter(p=>playerOwner(p)===state.you)){const field=$('#player-name-'+(player.slot??0));if(field&&document.activeElement!==field)field.value=player.name||'';}
   $('#host-caption').textContent=state.room.host===state.you?'Вы ведущий · выбирайте трассу и машину.':'Трассу и машину выбирает ведущий.';
   $('#lobby h1').textContent='Комната '+state.room.code;$('#lobby .eyebrow').textContent='ГОТОВИМСЯ К ГОНКЕ';$('#lobby .intro').textContent='Выберите гонщиков на этом устройстве и нажмите «Готово». После готовности всех — старт через 3 секунды.';window.refreshChoices?.();
   const url=new URL(location.href);url.searchParams.set('room',state.room.code);history.replaceState({},'',url);
  },
  chat(incoming){
   if(JSON.stringify(messages)===JSON.stringify(incoming))return;const log=$('#chat-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;
   for(const message of incoming){if((message.id||0)>lastChatId&&!chatDialog.open&&message.from!==roomState?.you)unreadCount++;}
   messages=incoming;lastChatId=Math.max(lastChatId,...messages.map(message=>message.id||0));log.replaceChildren();log.hidden=false;
   for(const message of messages){const line=document.createElement('p');line.className='chat-bubble'+(message.from===roomState?.you?' mine':' theirs');const author=document.createElement('b');author.textContent=message.name||'Игрок';line.append(author,document.createTextNode(message.text));log.append(line);}if(atBottom)log.scrollTop=log.scrollHeight;
   if(chatDialog.open)markChatRead();else setUnread();
  },
  notice(text){$('#directory-notice').textContent=text;$('#directory-notice').classList.remove('code-error');void $('#directory-notice').offsetWidth;$('#directory-notice').classList.add('code-error');const field=$('#room-code');field.classList.remove('code-error');void field.offsetWidth;field.classList.add('code-error');field.setAttribute('aria-invalid','true');},
  hide(){browser.hidden=true;shareDialog.close();options.close();chatDialog.close();networkDialog.close();unreadCount=0;lastChatId=0;activeRoomCode='';setUnread();},
 };
}

;

// peers.js
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
    for(const item of packet.poses.slice(0,4)){
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
  pings(){const now=performance.now();return [...peers.values()].filter(peer=>peer.selected&&peer.channel?.readyState==='open'&&peer.direct.length&&now-(peer.lastEcho||0)<5000).map(peer=>Math.round(median(peer.direct)));},
  reset(){for(const peer of peers.values())peer.pc.close();peers.clear();round=-1;},
  debug(){return [...peers.values()].map(p=>({id:p.id,connected:p.channel?.readyState==='open',directRtt:median(p.direct),relayRtt:median(p.relay),selected:p.selected,frames:[...p.frames.values()].reduce((count,frames)=>count+frames.length,0)}));},
 };
}

;

// online.js
'use strict';
const touchDevice=matchMedia('(pointer:coarse), (max-width:750px)');
const playerOwner=player=>player.owner??player.id;
window.localGameHooks={update,input,activateAbility,togglePause,garage,start,trackChange:$('#track').onchange,vehicleChange:$('#vehicle').onchange};
document.body.classList.add('online');
$('#players').closest('label').hidden=true;
const connectionSession=sessionStorage.getItem('hill-session')||crypto.randomUUID();sessionStorage.setItem('hill-session',connectionSession);
let socket,roomState=null,onlineRound=-1,clockOffset=0,oldPhase='',reconnectTimer,selfRoomRequested=false,roomExitNotice='',connectionOpenedAt=0;
let snapshots=[],snapshotReceived=0,renderedCountdown=-1;
let localCar=null,localCars=new Map(),localControls=[false,false];
let poseSequence=0,lastPoseSent=-Infinity,localSimTime=0,seenRewards=new Set();
let serverToLocal=null,bestRtt=Infinity;
let recentRtts=[],lastPongAt=0,lastStateReceived=0,connectionLost=false;
let interpolationDelay=70,lastPacketAt=0,renderTarget=-Infinity;
const remoteFrames=new Map();
function remotePose(index,target,fallback){
 const frames=remoteFrames.get(index);if(!frames?.length)return fallback;
 let a=frames[0],b=a;
 for(const frame of frames){if(frame.at<=target)a=frame;else{b=frame;break;}b=a;}
 const mix=b.at>a.at?Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at))):0;
 const pose={...b.pose};
 for(const key of ['x','y','a','wheel'])pose[key]=a.pose[key]+(b.pose[key]-a.pose[key])*mix;
 const ahead=Math.max(0,Math.min(.15,(target-b.at)/1000));
 if(b.pose.alive){pose.x+=b.pose.vx*ahead;pose.y+=b.pose.vy*ahead;pose.a+=b.pose.av*ahead;pose.wheel+=b.pose.vx*ahead/17;}
 return pose;
}
function renderWorld(left,right,mix,ahead){
 const a=left.game,b=right.game;
 // IDs survive collection/removal: array indices do not identify the same crate.
 const previous=new Map(a.bonus.map(crate=>[crate.id,crate]));
 const live=new Set(roomState.game.bonus.map(crate=>crate.id));
 bonus=b.bonus.filter(crate=>live.has(crate.id)&&crate.claimedBy===null).map(crate=>{
  const old=previous.get(crate.id)||crate,draw={...crate};
  for(const field of ['x','y','a','age','chuteFade'])draw[field]=old[field]+(crate[field]-old[field])*mix;
  // Coast only airborne crates, for at most 150 ms; collisions remain server-owned.
  if(!crate.grounded){draw.x+=crate.vx*ahead;draw.y+=crate.vy*ahead;draw.a+=crate.av*ahead;}
  draw.age+=ahead;draw.chuteFade=Math.max(0,draw.chuteFade-ahead);
  return draw;
 });
 if(window.onlineIndex<0){
 const previousBridges=new Map((a.bridges||[]).map(bridge=>[bridge.a,bridge]));
 hillBridgeStates.clear();
 for(const bridge of b.bridges||[]){
  const old=previousBridges.get(bridge.a)||bridge;
  hillBridgeStates.set(bridge.a,{...bridge,q:bridge.q.map((q,j)=>old.q[j]+(q-old.q[j])*mix+bridge.v[j]*ahead),v:[...bridge.v]});
 }
 }
 // Packet installation must never rewind the render clock.
 time=Math.max(time,a.time+(b.time-a.time)*mix+ahead);
}
const localAbilityAction=activateAbility;
// The owning device runs continuous physics. Server packets never replace its pose.
function controlsForSeat(slot){
 if(paused)return [false,false];
 if(slot===0)return [!!(keys.KeyD||keys.KeyW||keys.TouchGas),!!(keys.KeyA||keys.KeyS||keys.TouchBrake)];
 if(slot===1)return [!!(keys.ArrowUp||keys.ArrowRight),!!(keys.ArrowDown||keys.ArrowLeft)];
 if(slot===2)return [!!keys.Mouse2,!!keys.Mouse0];
 return [!!(keys.KeyI||keys.KeyL),!!(keys.KeyJ||keys.KeyK)];
}
input=i=>{const slot=(window.onlineIndices||[]).indexOf(i);return slot<0?[false,false]:controlsForSeat(slot)};
function localPhysicsStep(c,dt,control){localControls=control;physics(c,dt);}
function installLocalCar(state){
 for(const index of window.onlineIndices||[]){
  const authoritative=state.game.cars[index];if(!authoritative)continue;
  let car=localCars.get(index);if(!car){car={...authoritative,contacts:authoritative.contacts.map(c=>({...c}))};localCars.set(index,car);localSimTime=state.game.time;}
  if(!authoritative.alive){car.alive=false;car.reason=authoritative.reason;}
  for(const reward of state.game.rewards||[]){if(reward.i!==index||seenRewards.has(reward.id))continue;seenRewards.add(reward.id);if(reward.type===0){car.fuel=Math.min(100,car.fuel+40);announce(car,'+40 ТОПЛИВА');}if(reward.type===1){car.boost=5;announce(car,'ТУРБО · 5 СЕК');}if(reward.type===2){car.shield=12;announce(car,'ЩИТ · 12 СЕК');}if(reward.type===3){car.mud=6;announce(car,'КОЛЁСА В ГРЯЗИ · 6 СЕК');}}
 }
 localCar=localCars.get(window.onlineIndices?.[0])||null;
}
function sendPose(force=false){
 const now=performance.now();
 if(!localCars.size||roomState?.phase!=='race'||(!force&&now-lastPoseSent<1000/30))return;
 lastPoseSent=now;
 const poses=(window.onlineIndices||[]).map((index,slot)=>{const car=localCars.get(index);if(!car)return null;const pose={};for(const field of ['x','y','vx','vy','a','av','wheel','fuel','cp','shield','boost','mud','cooldown','air','flip'])pose[field]=car[field];if(paused){pose.vx=0;pose.vy=0;pose.av=0;}pose.alive=car.alive;pose.reason=car.reason;pose.rocketOn=car.rocketOn;return {slot,seq:++poseSequence,time:localSimTime,pose};}).filter(Boolean);
 const packet=poses.length===1?{type:'pose',round:onlineRound,...poses[0]}:{type:'poses',round:onlineRound,poses};
 send(packet);window.peerTransport?.broadcast(packet);
}

const onlineBar=document.createElement('div');onlineBar.id='online-bar';onlineBar.setAttribute('aria-live','polite');document.body.append(onlineBar);
const connectionIndicator=document.createElement('div');connectionIndicator.id='connection-indicator';connectionIndicator.hidden=true;connectionIndicator.setAttribute('role','status');connectionIndicator.setAttribute('aria-live','polite');document.body.append(connectionIndicator);
let showPing=localStorage.getItem('hill-show-ping')==='true';
window.appendConnectionSettings=panel=>{
 const label=document.createElement('label');label.className='connection-setting';
 const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=showPing;checkbox.addEventListener('change',()=>{showPing=checkbox.checked;localStorage.setItem('hill-show-ping',String(showPing));refreshConnectionIndicator();});
 const text=document.createElement('span');text.textContent='Показывать пинг';label.append(checkbox,text);panel.append(label);
};
function refreshConnectionIndicator(){
 const freshRtts=performance.now()-lastPongAt<5000?recentRtts:[],sortedRtts=[...freshRtts].sort((a,b)=>a-b);
 const serverPing=sortedRtts.length?Math.round(sortedRtts[Math.floor(sortedRtts.length/2)]):null;
 const peerPings=window.peerTransport?.pings?.()||[];
 const age=lastStateReceived?performance.now()-lastStateReceived:Infinity;
 const poor=mode==='race'&&(connectionLost||age>1800||serverPing!==null&&serverPing>=400);
 const pingText=[serverPing!==null?'Сервер '+serverPing+' мс':'Сервер —',...peerPings.map(value=>'Игроки '+value+' мс')].join(' · ');
 connectionIndicator.hidden=!poor&&(!showPing||mode!=='race');
 connectionIndicator.classList.toggle('poor',poor);
 connectionIndicator.textContent=poor?'Связь с комнатой нестабильна · гонка продолжается':pingText;
}
window.refreshConnectionIndicator=refreshConnectionIndicator;
const roomPanel=document.createElement('section');roomPanel.id='room-panel';roomPanel.hidden=true;$('#picks').after(roomPanel);
const touch=document.createElement('div');touch.id='touch-controls';touch.hidden=true;touch.innerHTML='<button data-control="brake" aria-label="Тормоз и задний ход"><span class="touch-hint">НАЗАД</span></button><button data-control="ability" aria-label="Способность"><span class="touch-hint">ЩИТ / СПОСОБНОСТЬ</span></button><button data-control="gas" aria-label="Газ"><span class="touch-hint">ГАЗ</span></button>';document.body.append(touch);
const roomUI=createRoomsUI();
window.appendConnectionSettings($('#room-options .drawer-body'));
window.peerTransport=createPeerTransport(send,()=>roomState);
document.title='Hill Rivals · Онлайн-гонка';
$('header>div').textContent='ONLINE MULTIPLAYER';
$('#lobby .eyebrow').textContent='ЕДИНАЯ ОНЛАЙН-ГОНКА';
$('#lobby h1').textContent='Подключение к гонке';
$('#lobby .intro').textContent='Четыре гонщика на компьютере или один на телефоне. Присоединяйтесь по коду комнаты.';
document.querySelector('.vehicle-choice').firstChild.textContent='Машина для гонки ';
const hints=document.querySelectorAll('.hint');hints[hints.length-1].textContent='W / D / ↑ / → — газ · S / A / ↓ / ← — тормоз · E / пробел — способность. На телефоне — кнопки внизу. Новые посетители во время гонки наблюдают и ждут следующий старт.';
$('#pause').hidden=true;
$('#menu').textContent='В комнату';
$('#start').textContent='ПОДКЛЮЧЕНИЕ…';$('#start').disabled=true;
let localCharacter=Number(localStorage.getItem('hill-character')||0)%7;
if(!Number.isInteger(localCharacter)||localCharacter<0)localCharacter=0;
let localAbility=localStorage.getItem('hill-ability')||'turbo';
if(!abilityNames[localAbility])localAbility='turbo';
// A fresh party starts with one racer. Add couch teammates explicitly from the room UI.
let onlineSeatCount=1;
document.body.dataset.players=String(onlineSeatCount);$('#lobby').dataset.party=String(onlineSeatCount);$('#picks').style.setProperty?.('--online-seats',onlineSeatCount);
const onlineCharacters=[...chosen],onlineAbilities=[...abilities];
onlineCharacters[0]=localCharacter;onlineAbilities[0]=localAbility;
function profileForSeat(slot){const nameKey=slot===0?'hill-player-name':'hill-party-name-'+slot;return {name:localStorage.getItem(nameKey)||roomState?.players.find(p=>playerOwner(p)===roomState.you&&(p.slot??0)===slot)?.name||'',character:onlineCharacters[slot]??slot%7,ability:onlineAbilities[slot]||'turbo'};}
window.syncOnlineFromGarage=setup=>{
 if(!setup)return;
 onlineSeatCount=touchDevice.matches?1:onlineSeatCount;$('#players').value=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);$('#lobby').dataset.party=String(onlineSeatCount);$('#picks').style.setProperty?.('--online-seats',onlineSeatCount);
 for(let i=0;i<4;i++){if(Number.isInteger(setup.chosen?.[i]))onlineCharacters[i]=setup.chosen[i];if(setup.abilities?.[i])onlineAbilities[i]=setup.abilities[i];}
 if(Number.isInteger(setup.track))$('#track').value=String(setup.track);if(Number.isInteger(setup.vehicle))$('#vehicle').value=String(setup.vehicle);
 localCharacter=onlineCharacters[0]||0;localAbility=onlineAbilities[0]||'turbo';renderPick();
};
window.getOfflineSoloSetup=()=>{
 const offlineChosen=[...chosen],offlineAbilities=[...abilities];
 offlineChosen[0]=onlineCharacters[0]??offlineChosen[0];offlineAbilities[0]=onlineAbilities[0]||offlineAbilities[0];
 return {colors:[...colors],chosen:offlineChosen,abilities:offlineAbilities,playerCount:1,track:+$('#track').value,vehicle:+$('#vehicle').value};
};
function send(msg){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(msg));}
let profileNameTimer;
function renderPick(){
  $('#picks').innerHTML=Array.from({length:onlineSeatCount},(_,slot)=>{const profile=profileForSeat(slot),bindings=['WASD · W/D газ · S/A тормоз','Стрелки · ↑/→ газ · ↓/← тормоз','Мышь · ПКМ газ · ЛКМ тормоз','IJKL · I/L газ · J/K тормоз'];return `<section class="pick" data-online-seat="${slot}" style="border-top:5px solid ${colors[slot]}"><h3>${slot===0?'ВАШ ГОНЩИК':'ИГРОК '+(slot+1)}</h3><label class="player-name-label" for="player-name-${slot}">Имя гонщика<input type="text" inputmode="text" name="racer-name-${slot}" id="player-name-${slot}" data-name-seat="${slot}" maxlength="24" placeholder="Игрок ${slot+1}" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" value="${escapeLabel(profile.name)}" ${slot>0?'':'aria-label="Ваше имя"'}></label><img class="portrait" src="assets/${assetNames[profile.character]}.webp"><div class="choose"><button data-char-seat="${slot}" data-step="-1" aria-label="Предыдущий персонаж">‹</button><b>${names[profile.character]}</b><button data-char-seat="${slot}" data-step="1" aria-label="Следующий персонаж">›</button></div><div class="keys">${bindings[slot]}</div><label class="ability-select">Способность · ${['E','правый Shift','СКМ','U'][slot]}<select data-ability-seat="${slot}">${Object.entries(abilityNames).map(([key,label])=>`<option value="${key}" ${key===profile.ability?'selected':''}>${label}</option>`).join('')}</select></label></section>`;}).join('');
  if(!touchDevice.matches){
   for(let slot=onlineSeatCount;slot<4;slot++){
    const empty=document.createElement('button');empty.type='button';empty.className='pick empty-seat';empty.dataset.addSeat=String(slot);empty.setAttribute('aria-label','Добавить гонщика на этом устройстве');empty.innerHTML='<span aria-hidden="true">+</span><small>Добавить игрока</small>';
    empty.disabled=!!roomState&&roomState.phase!=='lobby'||(roomState?.players.length||0)>=8;
    empty.onclick=()=>{if(roomState?.phase==='lobby')window.changeOnlineParty(1);};$('#picks').append(empty);
   }
   if(onlineSeatCount>1){const card=$('#picks').querySelector(`[data-online-seat="${onlineSeatCount-1}"]`),remove=document.createElement('button');remove.type='button';remove.className='remove-seat';remove.textContent='×';remove.setAttribute('aria-label','Убрать последнего гонщика');remove.disabled=!!roomState&&roomState.phase!=='lobby';remove.onclick=()=>window.changeOnlineParty(-1);card.append(remove);}
  }
  $('#picks').querySelectorAll('[data-name-seat]').forEach(field=>{const slot=+field.dataset.nameSeat;const saveName=()=>{localStorage.setItem(slot===0?'hill-player-name':'hill-party-name-'+slot,field.value.trim().slice(0,24));sendProfile();};field.oninput=()=>{localStorage.setItem(slot===0?'hill-player-name':'hill-party-name-'+slot,field.value.trim().slice(0,24));clearTimeout(profileNameTimer);profileNameTimer=setTimeout(sendProfile,150);};field.onchange=()=>{clearTimeout(profileNameTimer);saveName();};field.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveName();field.blur();}};});
  $('#picks').querySelectorAll('[data-char-seat]').forEach(button=>button.onclick=()=>{if(!['lobby','countdown'].includes(roomState?.phase))return;const slot=+button.dataset.charSeat;onlineCharacters[slot]=(onlineCharacters[slot]+Number(button.dataset.step)+names.length)%names.length;if(slot===0){localCharacter=onlineCharacters[0];localStorage.setItem('hill-character',localCharacter);}renderPick();sendProfile();});
  $('#picks').querySelectorAll('[data-ability-seat]').forEach(select=>select.onchange=()=>{const slot=+select.dataset.abilitySeat;onlineAbilities[slot]=select.value;if(slot===0){localAbility=select.value;localStorage.setItem('hill-ability',localAbility);}sendProfile();});
}
function sendProfile(){clearTimeout(profileNameTimer);const seats=Array.from({length:onlineSeatCount},(_,slot)=>profileForSeat(slot));send({type:'profile',seats});}
renderPick();
function setOnlineSeatCount(count){if(touchDevice.matches)count=1;onlineSeatCount=Math.max(1,Math.min(4,count));$('#players').value=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);$('#lobby').dataset.party=String(onlineSeatCount);$('#picks').style.setProperty?.('--online-seats',onlineSeatCount);renderPick();sendProfile();}
window.onlineSeatCountChanged=setOnlineSeatCount;
touchDevice.addEventListener('change',()=>{if(touchDevice.matches&&onlineSeatCount>1&&['lobby','countdown'].includes(roomState?.phase))setOnlineSeatCount(1);});
window.changeOnlineParty=delta=>{
 const max=Math.min(4,8-(roomState?.players.length-onlineSeatCount||0));
 setOnlineSeatCount(Math.max(1,Math.min(max,onlineSeatCount+delta)));
};
const readyOnline=()=>{
 if(!assetsLoaded)return;
 const ready=!!roomState?.players.find(p=>playerOwner(p)===roomState.you)?.ready;
 send({type:'ready',ready:!ready});
 if(!ready)setTimeout(()=>{
  const acknowledged=!!roomState?.players.find(p=>playerOwner(p)===roomState.you)?.ready;
  if(window.onlineActive&&mode==='lobby'&&!acknowledged)offerOfflineSolo();
 },5000);
};
$('#start').onclick=readyOnline;
$('#track').onchange=()=>{updateMapDescription();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
$('#vehicle').onchange=()=>{describeVehicle();send({type:'settings',track:+$('#track').value,vehicle:+$('#vehicle').value});};
togglePause=()=>{if(mode!=='race')return;paused=!paused;keysClear();sendInput();$('#overlay').hidden=!paused;if(paused)showPauseMenu();};
activateAbility=car=>{const slot=(window.onlineIndices||[]).indexOf(car?.i);if(slot>=0)sendInput(slot);};
garage=()=>{
  if(mode==='race'||mode==='result'){keysClear();paused=false;$('#overlay').hidden=true;send({type:'return-garage'});return;}
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);send({type:'leave-room'});
};
$('#menu').onclick=garage;
function controls(){if(paused)return [false,false];return [!!(keys.KeyW||keys.KeyD||keys.ArrowUp||keys.ArrowRight||keys.TouchGas),!!(keys.KeyS||keys.KeyA||keys.ArrowDown||keys.ArrowLeft||keys.TouchBrake)];}
function sendInput(abilitySlot=-1){
 if(!window.onlineActive)return;
 const seats=(window.onlineIndices||[]).map((index,slot)=>{const [gas,brake]=controlsForSeat(slot),car=localCars.get(index);if(abilitySlot===slot&&car&&!paused)localAbilityAction(car);return {slot,gas,brake,ability:abilitySlot===slot&&!paused};});
 send({type:'input',seats});
}
addEventListener('keydown',e=>{if(!window.onlineActive||e.target.matches('select,input,textarea'))return;if(e.code==='Space'&&!e.repeat)sendInput(0);sendInput();});
addEventListener('keyup',()=>sendInput());
addEventListener('blur',()=>sendInput());
document.addEventListener('visibilitychange',()=>{if(document.hidden){keysClear();sendInput();}});
const touchPointers=new Map();
function applyTouchInput(){keys.TouchGas=[...touchPointers.values()].includes('gas');keys.TouchBrake=[...touchPointers.values()].includes('brake');sendInput();}
window.resetTouchInput=()=>{touchPointers.clear();};
for(const button of touch.querySelectorAll('button')){
  const control=button.dataset.control;
  button.addEventListener('pointerdown',e=>{
    if(mode!=='race'||paused||!mobileInput.matches)return;
    e.preventDefault();button.setPointerCapture(e.pointerId);touchPointers.set(e.pointerId,control);
    if(control==='ability'){if(window.onlineActive)sendInput(0);else activateAbility(cars[0]);}
    else applyTouchInput();
  });
  const release=e=>{if(!touchPointers.delete(e.pointerId))return;applyTouchInput();};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
let movementStarted=false,touchHintTime=0;
window.resetTouchHints=()=>{movementStarted=false;touchHintTime=0;touch.classList.remove('hints-faded');};
window.updateTouchHints=dt=>{
 if(mode!=='race'){window.resetTouchHints();return;}
 const own=cars[(window.onlineIndices||[])[0]??window.onlineIndex??0];
 if(!paused&&count<=0&&own?.alive){
    if(Math.abs(own.vx)>1)movementStarted=true;
  if(movementStarted)touchHintTime+=dt;
 }
 touch.classList.toggle('hints-faded',touchHintTime>=5);
};
setInterval(()=>{if(roomState?.phase==='race')sendInput();},100);
// Simulate our car locally; interpolate the remote cars and shared bonuses.
update=dt=>{
  if(!roomState)return;
  if(paused&&roomState.phase==='race'){sendPose();return;}
  if(roomState.phase==='countdown'){count=Math.max(0,(roomState.startAt-(Date.now()+clockOffset))/1000);return;}
  count=0;
  if(connectionLost&&mode==='race'&&localCars.size&&window.onlineIndices?.length===1&&roomState.racers.length===1){
    const index=window.onlineIndices[0],owned=localCars.get(index);
    cars[index]=Object.assign(cars[index]||{},owned);
    window.localGameHooks.update(dt);
    Object.assign(owned,cars[index]);localCar=owned;localSimTime+=dt;sendPose();
    return;
  }
  if(mode==='race'&&snapshots.length){
    const now=performance.now(),elapsed=now-snapshotReceived;
    const target=renderTarget=Math.max(renderTarget,(serverToLocal===null?roomState.serverNow+elapsed:now-serverToLocal)-interpolationDelay);
    let left=snapshots[0],right=left;
    for(const snapshot of snapshots){if(snapshot.serverNow<=target)left=snapshot;else{right=snapshot;break;}right=left;}
    const mix=right.serverNow>left.serverNow?Math.max(0,Math.min(1,(target-left.serverNow)/(right.serverNow-left.serverNow))):0;
    cars=roomState.game.cars.map((latest,i)=>{
      const car=cars[i]||{},a=left.game.cars[i]||latest,b=right.game.cars[i]||a;
      const owned=localCars.get(i);
      if(owned){
        owned.prevX=owned.x;owned.prevY=owned.y;
        localPhysicsStep(owned,dt,controlsForSeat((window.onlineIndices||[]).indexOf(i)));Object.assign(car,owned);
      }else{
        Object.assign(car,latest);
        for(const field of ['x','y','a','wheel'])car[field]=a[field]+(b[field]-a[field])*mix;
        // A short missing packet should not freeze a moving opponent; bound drift.
        const ahead=Math.max(0,Math.min(.15,(target-right.serverNow)/1000));
        if(b.alive){car.x+=b.vx*ahead;car.y+=b.vy*ahead;car.a+=b.av*ahead;car.wheel+=b.vx*ahead/17;}
        // A server snapshot can repeat an old pose. Interpolate only fresh owner samples.
        Object.assign(car,remotePose(i,target-40,car),{alive:latest.alive,reason:latest.reason});
        const racer=roomState.racers[i],direct=window.peerTransport.pose(racer?.owner,racer?.slot||0);
        if(direct&&latest.alive)Object.assign(car,direct,{alive:latest.alive,reason:latest.reason});
      }
      return car;
    });
    if((window.onlineIndices||[]).length)updateHillBridges(dt);
    localSimTime+=dt;localCar=localCars.get(window.onlineIndices?.[0])||null;
    renderWorld(left,right,mix,Math.max(0,Math.min(.15,(target-right.serverNow)/1000)));
    sendPose();
  }
  if(mode==='race'){
    const own=(window.onlineIndices||[]).map(i=>cars[i]).filter(c=>c?.alive);
    const active=own.length?own:cars.filter(c=>c.alive);
    if(active.length)updateCamera(active,dt);
  }
};
function installGame(state){
  if(!state.game)return;
  const g=state.game;
  const newRound=onlineRound!==state.round;
  if(newRound){window.resetTouchHints();onlineRound=state.round;cam=0;zoom=1;cameraY=0;particles=[];snapshots=[];renderTarget=-Infinity;localCar=null;localCars.clear();poseSequence=0;lastPoseSent=-Infinity;seenRewards.clear();resetHillBridges();keysClear();setWorldSeed(g.seed);}
  const received=performance.now();
  if(newRound){remoteFrames.clear();lastPacketAt=0;interpolationDelay=70;}
  for(let i=0;i<g.cars.length;i++){
   const sample=state.carPoses?.[i];if(!sample?.seq||!Number.isFinite(sample.at))continue;
   const frames=remoteFrames.get(i)||[];
   if(frames.length&&sample.seq<=frames.at(-1).seq)continue;
   frames.push({seq:sample.seq,at:sample.at,pose:{...g.cars[i]}});
   if(frames.length>24)frames.shift();remoteFrames.set(i,frames);
  }
  poseSequence=Math.max(poseSequence,...(state.poseSequences||[state.poseSequence||0]));
  if(lastPacketAt)interpolationDelay+=(Math.max(60,Math.min(140,(received-lastPacketAt)*1.5))-interpolationDelay)*.1;
  lastPacketAt=received;snapshotReceived=received;snapshots.push(state);if(snapshots.length>12)snapshots.shift();
  window.racerNames=state.racers.map((p,i)=>p.name||'Игрок '+(i+1));
  colors.splice(0,colors.length,...state.racers.map(p=>p.color));
  chosen.splice(0,chosen.length,...state.racers.map(p=>p.character));
  abilities.splice(0,abilities.length,...state.racers.map(p=>p.ability));
  state.racers.forEach((_,i)=>abilityKeys[i]=['E','правый Shift','СКМ','U'][i]||'');
  window.onlineIndices=state.racers.map((p,i)=>playerOwner(p)===state.you?i:-1).filter(i=>i>=0);window.onlineIndex=window.onlineIndices[0]??-1;
  track=g.track;vehicleModel=g.vehicle;snowStart=g.snowStart;snowEnd=g.snowEnd;
  if(newRound)time=g.time;
  // Keep object identities so suspension smoothing survives incoming packets.
  if(newRound||state.phase==='result'){
   if(state.phase==='result')localCars.clear();
   cars=g.cars.map((c,i)=>Object.assign(cars[i]||{},c));
   bonus=g.bonus.map(crate=>({...crate}));hillBridgeStates.clear();
   for(const bridge of g.bridges||[])hillBridgeStates.set(bridge.a,{...bridge,q:[...bridge.q],v:[...bridge.v]});
   if(state.phase==='result')time=g.time;
  }
  count=0;
  mode=state.phase==='result'?'result':'race';if(newRound||state.phase==='result')paused=false;
  if(state.phase==='race')installLocalCar(state);
  $('#lobby').hidden=true;$('#foot').hidden=true;$('#hud').hidden=false;
  touch.hidden=state.phase!=='race'||!state.racers.some(p=>playerOwner(p)===state.you);
  if(state.phase==='race'&&!paused)$('#overlay').hidden=true;
}
function renderRoom(state){
  onlineBar.hidden=true;
  roomUI.state(state);
  track=state.track;vehicleModel=state.vehicle;
  const owned=state.players.filter(p=>playerOwner(p)===state.you).sort((a,b)=>(a.slot??0)-(b.slot??0));
  $('#lobby').dataset.party=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);
  $('#add-local-racer').hidden=true;$('#remove-local-racer').hidden=true;
  const ready=state.players.filter(p=>p.ready).length;
  const spectator=state.phase==='race'&&!state.racers.some(p=>playerOwner(p)===state.you);
  onlineBar.textContent=`На сайте: ${state.online} · В гонке: ${state.inRace} · Готовы: ${ready}/${state.players.length}${spectator?' · Вы наблюдаете':''}`;
  const kickedOwners=new Set();roomPanel.querySelector('.room-list').innerHTML=state.players.map((p,i)=>{const owner=playerOwner(p),canKick=state.room.host===state.you&&owner!==state.you&&!kickedOwners.has(owner);if(canKick)kickedOwners.add(owner);return `<div><span class="room-player-name" ${owner===state.you?'title="На этом устройстве"':''}>${owner===state.room.host?'♛ ':''}${escapeLabel(p.name||'Игрок '+(i+1))}</span><b>${p.online===false?'Не в сети':p.ready?'✓ Готов':'В комнате'}</b>${canKick?`<button class="kick-player" type="button" data-kick-player="${escapeLabel(owner)}" aria-label="Удалить ${escapeLabel(p.name||'игрока')} из комнаты" title="Удалить из комнаты">${menuIcon('kick')}</button>`:''}</div>`;}).join('');
  $('#track').value=state.track;$('#vehicle').value=state.vehicle;
  $('#track').disabled=$('#vehicle').disabled=state.phase!=='lobby'||state.room.host!==state.you;
  $('#picks').querySelectorAll('select,[data-char-seat]').forEach(control=>control.disabled=!['lobby','countdown'].includes(state.phase));
  $('#picks').querySelectorAll('[data-add-seat]').forEach(control=>control.disabled=state.phase!=='lobby'||state.players.length>=8);
  $('#picks').querySelectorAll('.remove-seat').forEach(control=>control.disabled=state.phase!=='lobby');
  updateMapDescription();describeVehicle();
  $('#start').disabled=!assetsLoaded||state.phase==='race';
  $('#start').onclick=readyOnline;
  const myReady=state.players.find(p=>playerOwner(p)===state.you)?.ready;
  $('#start').textContent=!assetsLoaded?'ЗАГРУЗКА ТЕКСТУР…':state.phase==='countdown'?'СТАРТ ЧЕРЕЗ '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' С · ОТМЕНИТЬ':myReady?'ОТМЕНИТЬ ГОТОВНОСТЬ':'ГОТОВО';
  $('#menu').disabled=false;$('#menu').textContent='Выйти из комнаты';$('#pause').hidden=state.phase!=='race';
  if(state.phase==='lobby'){
    onlineRound=-1;localCar=null;localCars.clear();
    mode='lobby';count=0;snapshots=[];renderTarget=-Infinity;$('#lobby').hidden=false;$('#foot').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;
    $('#room-status').textContent='Готовы '+ready+' из '+state.players.length;
  }
  if(state.phase==='countdown'){
    $('#room-status').textContent='До общего старта: '+Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000))+' с. Все, кто в комнате, участвуют!';
    mode='lobby';$('#lobby').hidden=false;$('#hud').hidden=true;touch.hidden=true;$('#overlay').hidden=true;
  }
  if(state.phase==='result'&&oldPhase!=='result'){
    $('#overlay').hidden=false;
    const ranked=[...cars].sort((a,b)=>b.x-a.x);
    $('#overlay').innerHTML=`<div class="eyebrow">ГОНКА ОКОНЧЕНА</div><h2>${state.game.winner===null?'Все выбыли':escapeLabel(state.racers[state.game.winner]?.name||'Игрок '+(state.game.winner+1))+' победил!'}</h2><p>${ranked.map(c=>`${escapeLabel(racerName(c))} · ${Math.floor(raceMetres(c))} м`).join('<br>')}</p><button id="next-race">Следующая гонка</button>`;
    $('#next-race').onclick=()=>{send({type:'ready',ready:true});};
  }
  oldPhase=state.phase;
}
window.assetsReady.then(()=>{if(window.onlineActive&&roomState)renderRoom(roomState);});
function connect(){
  if(!window.onlineActive)return;
  if(socket&&[0,1].includes(socket.readyState))return;
  clearTimeout(reconnectTimer);connectionOpenedAt=performance.now();onlineBar.textContent='Подключение к серверу…';
  socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?session='+connectionSession);
  socket.onopen=()=>{connectionOpenedAt=performance.now();lastStateReceived=connectionOpenedAt;serverToLocal=null;bestRtt=Infinity;lastPacketAt=0;sendProfile();const code=roomState?.room.code||new URL(location.href).searchParams.get('room');if(/^[A-Z]{5}$/i.test(code||''))send({type:'join-room',code});send({type:'ping',sent:performance.now()});};
  socket.onmessage=e=>{
    const state=JSON.parse(e.data);
  if(state.type==='room-left'){roomState=null;selfRoomRequested=state.reason!=='left';window.peerTransport.reset();const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);roomExitNotice=state.reason==='kicked'?'Ведущий удалил вас из комнаты.':'Вы вышли из комнаты.';return;}
  if(state.type==='directory'){if(roomState?.room){roomUI.updateDirectory(state);return;}roomUI.directory(state);const requested=new URL(location.href).searchParams.get('room');if(!requested&&!selfRoomRequested){selfRoomRequested=true;send({type:'create-room',track:+$('#track').value,vehicle:+$('#vehicle').value});sendProfile();}if(roomExitNotice)$('#directory-notice').textContent=roomExitNotice;return;}
    if(state.type==='chat'){roomUI.chat(state.messages);return;}
    if(state.type==='notice'){roomUI.notice(state.text);return;}
    if(state.type==='signal'){window.peerTransport.signal(state);return;}
    if(state.type==='peer-probe'){window.peerTransport.relay(state);return;}
    if(state.type==='pong'){
      const now=performance.now(),rtt=now-state.sent;
      if(rtt>=0&&rtt<10000){recentRtts.push(rtt);if(recentRtts.length>9)recentRtts.shift();lastPongAt=now;}
      if(rtt>=0&&rtt<=bestRtt*1.2){bestRtt=Math.min(bestRtt,rtt);serverToLocal=(state.sent+now)/2-state.serverNow;}
      return;
    }
    if(state.type!=='state')return;
    clockOffset=state.serverNow-Date.now();
    const joined=!roomState||state.room.code!==roomState.room?.code;
    const changed=joined||JSON.stringify([state.phase,state.players,state.track,state.vehicle,state.room,state.inRace])!==JSON.stringify([roomState.phase,roomState.players,roomState.track,roomState.vehicle,roomState.room,roomState.inRace]);
    roomState=state;roomExitNotice='';lastStateReceived=performance.now();connectionLost=false;installGame(state);refreshConnectionIndicator();
    window.peerTransport.update(state);
    if(joined){if(state.room.host!==state.you){const owned=state.players.filter(p=>playerOwner(p)===state.you).length;onlineSeatCount=Math.max(1,Math.min(onlineSeatCount,8-(state.players.length-owned)));$('#lobby').dataset.party=String(onlineSeatCount);document.body.dataset.players=String(onlineSeatCount);renderPick();}sendProfile();}
    const seconds=state.phase==='countdown'?Math.max(0,Math.ceil((state.startAt-state.serverNow)/1000)):-1;
    if(changed||seconds!==renderedCountdown||$('#start').textContent==='НАЧАТЬ ОФЛАЙН')renderRoom(state);
    renderedCountdown=seconds;
  };
  socket.onclose=()=>{
    connectionLost=true;let offlineAvailable=false;
    if(mode!=='race'){$('#start').disabled=true;touch.hidden=true;offlineAvailable=offerOfflineSolo();}
    refreshConnectionIndicator();
    if(window.onlineActive){onlineBar.textContent=offlineAvailable?'Сервер недоступен. Одиночный заезд можно начать без интернета.':'Связь потеряна. Идёт переподключение…';reconnectTimer=setTimeout(connect,1500);}
  };
  socket.onerror=()=>socket.close();
}
window.onlineGameHooks={update,input,activateAbility,togglePause,garage,start:$('#start').onclick,trackChange:$('#track').onchange,vehicleChange:$('#vehicle').onchange};
window.onlineSession={
 enter(){selfRoomRequested=false;const url=new URL(location.href);if(url.searchParams.has('room')&&url.searchParams.get('mode')!=='online'){url.searchParams.delete('room');history.replaceState({},'',url);}roomPanel.hidden=false;onlineBar.hidden=true;renderPick();$('#players').closest('label').hidden=true;roomUI.browser.hidden=false;$('#lobby').hidden=false;connect();},
 leaveRoom(){send({type:'leave-room'});},
 exit(){send({type:'leave-room'});clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.onmessage=null;socket.onopen=null;socket.onerror=null;socket.close();}roomState=null;localCar=null;onlineRound=-1;oldPhase='';window.peerTransport.reset();roomUI.hide();roomPanel.hidden=true;onlineBar.hidden=true;},
};
function canFallbackToSolo(){
 if(onlineSeatCount!==1)return false;
 if(!roomState)return !new URL(location.href).searchParams.has('room');
 const owners=new Set(roomState.players.map(playerOwner));
 return owners.size===1&&owners.has(roomState.you);
}
function offerOfflineSolo(){
 if(!window.onlineActive||mode!=='lobby'||!assetsLoaded||!canFallbackToSolo())return false;
 onlineBar.hidden=false;onlineBar.textContent='Сервер не отвечает. Одиночный заезд можно начать без интернета.';
 $('#start').disabled=false;$('#start').textContent='НАЧАТЬ ОФЛАЙН';$('#start').onclick=()=>window.startOfflineSolo?.();
 return true;
}
setInterval(()=>{if(window.onlineActive){window.peerTransport.probe();const status=$('#connection-status');if(status)status.textContent=window.peerTransport.summary();refreshConnectionIndicator();}},1000);
setInterval(()=>{if(socket?.readyState===WebSocket.OPEN)send({type:'ping',sent:performance.now()});},2000);
setInterval(()=>{
 if(!window.onlineActive)return;
 const now=performance.now();
 if(socket?.readyState===0&&now-connectionOpenedAt>8000){socket.close();return;}
 if(socket?.readyState===WebSocket.OPEN&&lastStateReceived&&now-lastStateReceived>5000){
  connectionLost=true;refreshConnectionIndicator();
  if(mode!=='race')offerOfflineSolo();
  socket.close();
 }
 if(socket?.readyState===WebSocket.OPEN&&!roomState&&now-connectionOpenedAt>8000)offerOfflineSolo();
},1000);
let deployedVersion;
setInterval(async()=>{
  if(!window.onlineActive)return;
  try{const state=await fetch('/health',{cache:'no-store'}).then(r=>r.json());
    if(deployedVersion&&deployedVersion!==state.version){
      if(roomState?.phase==='race'){onlineBar.textContent+=' · Доступно обновление после гонки';return;}
      location.reload();
    }deployedVersion=state.version;
  }catch{}
},5000);

;

// app.js
'use strict';
// The online lobby is the single web entry point. Keep the local build for file:// previews.
const modeFromUrl=()=>location.protocol==='file:'||new URL(location.href).searchParams.get('mode')==='local'?'local':'online';
let selectedMode=modeFromUrl();
if(!$('#players').querySelector('option[value="4"]'))$('#players').add(new Option('4 игрока','4'));
const modeButton=document.createElement('button');modeButton.id='mode-button';modeButton.textContent='Режим игры';
document.querySelector('nav').prepend(modeButton);
modeButton.hidden=true;
document.querySelector('header>div')?.remove();
const pauseButton=$('#pause');pauseButton.setAttribute('aria-label','Пауза');pauseButton.title='Пауза · Esc';
const pauseGlyph=document.createElement('span');pauseGlyph.className='pause-glyph';pauseGlyph.setAttribute('aria-hidden','true');pauseGlyph.append(document.createElement('i'),document.createElement('i'));pauseButton.replaceChildren(pauseGlyph);
const installButton=document.createElement('button');installButton.id='install-app';installButton.textContent='Установить';document.querySelector('nav').append(installButton);
const cardTools=document.createElement('div');cardTools.className='card-tools';cardTools.append(modeButton,$('#sound'),installButton);window.cardTools=cardTools;$('#lobby').append(cardTools);
let currentMode=null;
let savedLocal={colors:[...colors],chosen:[...chosen],abilities:[...abilities],playerCount,track:+$('#track').value,vehicle:+$('#vehicle').value};
function chooseMode(next,push=true,afterApply=null,transition=true){
 if(!['online','local'].includes(next))next='local';
 if(currentMode===next&&currentMode!==undefined)return;
 const apply=()=>{
  if(currentMode==='local')savedLocal={colors:[...colors],chosen:[...chosen],abilities:[...abilities],playerCount,track:+$('#track').value,vehicle:+$('#vehicle').value};
  window.onlineActive=false;window.onlineSession.exit();
  mode='lobby';count=0;time=0;cam=0;zoom=1;cameraY=0;cars=[];bonus=[];particles=[];keysClear();resetHillBridges();window.onlineIndex=undefined;
  currentMode=selectedMode=next;
  document.body.classList.toggle('online',next==='online');document.body.classList.toggle('local',next==='local');document.body.classList.remove('choosing');
  modeButton.hidden=next==='online';modeButton.onclick=()=>chooseMode(next==='online'?'local':'online');
  const hooks=next==='online'?window.onlineGameHooks:window.localGameHooks;
  update=hooks.update;input=hooks.input;activateAbility=hooks.activateAbility;togglePause=hooks.togglePause;garage=hooks.garage;
  start=next==='local'?()=>{if(assetsLoaded)window.localGameHooks.start();}:window.localGameHooks.start;
  $('#start').onclick=next==='online'?hooks.start:start;$('#track').onchange=hooks.trackChange;$('#vehicle').onchange=()=>{hooks.vehicleChange();if(next==='local')vehicleModel=+$('#vehicle').value;};
  $('#menu').onclick=garage;$('#pause').onclick=togglePause;$('#pause').hidden=next!=='local';$('#menu').hidden=next!=='local';$('#menu').disabled=false;$('#menu').textContent='Гараж';
  $('#overlay').hidden=true;$('#hud').hidden=true;$('#touch-controls').hidden=true;$('#foot').hidden=true;
  $('#lobby').hidden=false;$('#room-browser').hidden=next!=='online';$('#players').closest('label').hidden=next==='online'||mobileInput.matches;
  modeButton.textContent=next==='online'?'Вернуться в гараж':'Играть онлайн';
  cardTools.hidden=false;
  (next==='online'?($('#room-options .drawer-body')||$('#room-options')):$('#lobby')).append(cardTools);
  document.title='Mirea Racing'+(next==='online'?' · Онлайн':next==='local'?' · Обычная игра':'');
  if(next==='local'){
   colors.splice(0,colors.length,...savedLocal.colors);chosen.splice(0,chosen.length,...savedLocal.chosen);abilities.splice(0,abilities.length,...savedLocal.abilities);playerCount=savedLocal.playerCount;
   $('#players').value=playerCount;document.body.dataset.players=playerCount;$('#track').value=savedLocal.track;$('#vehicle').value=savedLocal.vehicle;
   picks();vehicleModel=+$('#vehicle').value;$('#lobby h1').textContent='Гараж';$('#lobby .eyebrow').textContent='ОДНА КОМАНДА · ДО ТРЁХ ГОНЩИКОВ';
   $('#lobby .intro').textContent='Выберите гонщиков, машину и трассу. Для гонки с друзьями откройте онлайн-комнаты.';$('#start').textContent='НА СТАРТ →';$('#start').disabled=!assetsLoaded;
   $('#track').disabled=$('#vehicle').disabled=false;$('#vehicle-description').hidden=false;$('#map-description').hidden=false;updateMapDescription();describeVehicle();
  }
  if(next==='online'){window.onlineActive=true;$('#vehicle-description').hidden=false;$('#map-description').hidden=false;window.syncOnlineFromGarage?.(savedLocal);window.onlineSession.enter();}
  window.refreshChoices?.();syncGameScreen();window.scrollTo(0,0);
  if(push){const url=new URL(location.href);url.searchParams.delete('room');url.searchParams.set('mode',next);history.pushState({},'',url);}
  afterApply?.();
 };
 if(transition&&document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const view=document.startViewTransition(apply);
  // Rotation/fullscreen may cancel the snapshot animation after the UI updates.
  view.ready.catch(()=>{});
 }else apply();
}
window.startOfflineSolo=()=>{
 const setup=window.getOfflineSoloSetup?.()||{};
 savedLocal={...savedLocal,...setup,playerCount:1};
 chooseMode('local',true,()=>window.localGameHooks.start(),false);
};
addEventListener('popstate',()=>{chooseMode(modeFromUrl(),false);});
let installPrompt;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
installButton.onclick=async()=>{
 if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return;}
 let help=$('#install-help');if(!help){help=document.createElement('dialog');help.id='install-help';help.innerHTML='<h2>Игра на телефоне</h2><p><b>Android:</b> Chrome → меню → «Установить приложение».</p><p><b>iPhone:</b> Safari → «Поделиться» → «На экран Домой».</p><button>Понятно</button>';document.body.append(help);help.querySelector('button').onclick=()=>help.close();}help.showModal();
};
if(matchMedia('(display-mode: standalone)').matches)installButton.hidden=true;
addEventListener('appinstalled',()=>{installButton.hidden=true;installPrompt=null;});
if('serviceWorker' in navigator&&location.protocol!=='file:')window.assetsReady.then(()=>navigator.serviceWorker.register('/sw.js').then(reg=>reg.update())).catch(()=>{});
let appVersion;
setInterval(async()=>{if(window.onlineActive||location.protocol==='file:')return;try{const health=await fetch('/health',{cache:'no-store'}).then(r=>r.json());if(appVersion&&health.version!==appVersion){if(mode!=='race')location.reload();return;}appVersion=health.version;}catch{}},5000);
currentMode=undefined;chooseMode(selectedMode,false);
window.gameDebug.start=()=>start();
window.assetsReady.then(()=>{if(currentMode==='local')$('#start').disabled=false;});

;

// mobile-screen.js
'use strict';
const fullscreenRoot=document.documentElement;
const requestGameScreen=fullscreenRoot.requestFullscreen||fullscreenRoot.webkitRequestFullscreen;
const fullscreenButton=document.createElement('button');fullscreenButton.id='fullscreen-button';fullscreenButton.type='button';
fullscreenButton.textContent='На весь экран';fullscreenButton.setAttribute('aria-label','На весь экран');fullscreenButton.title='На весь экран';fullscreenButton.hidden=!requestGameScreen;
window.cardTools.append(fullscreenButton);
function gameIsFullscreen(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
async function openGameFullscreen(){
 if(!mobileInput.matches||!requestGameScreen||gameIsFullscreen())return;
 try{
  await requestGameScreen.call(fullscreenRoot,{navigationUI:'hide'});
  if(gameIsFullscreen()&&screen.orientation?.lock)await screen.orientation.lock('landscape').catch(()=>{});
 }catch{} // Unsupported browsers keep the ordinary game working.
}
fullscreenButton.onclick=async()=>{
 try{
  if(gameIsFullscreen())await (document.exitFullscreen||document.webkitExitFullscreen).call(document);
  else await openGameFullscreen();
 }catch{} // Unsupported browsers keep the ordinary game working.
};
function fullscreenChanged(){
 keysClear();resize();
 const label=gameIsFullscreen()?'Выйти из полного экрана':'На весь экран';fullscreenButton.setAttribute('aria-label',label);fullscreenButton.title=label;fullscreenButton.textContent=label;
 const pauseButton=$('#pause-fullscreen');if(pauseButton)pauseButton.textContent=label;
 if(!gameIsFullscreen())screen.orientation?.unlock?.();
}
document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('webkitfullscreenchange',fullscreenChanged);
document.addEventListener('click',e=>{
 const startButton=e.target.closest?.('#start,#again,#next-race');
 if(startButton&&!startButton.disabled&&!window.onlineActive)openGameFullscreen();
},true);
window.populatePauseSettings=panel=>{
 panel.replaceChildren();
 if(mobileInput.matches&&requestGameScreen){const full=document.createElement('button');full.id='pause-fullscreen';full.textContent=fullscreenButton.textContent;full.onclick=()=>fullscreenButton.click();panel.append(full);}
 const audioButton=document.createElement('button');audioButton.textContent=$('#sound').textContent;audioButton.onclick=()=>{$('#sound').click();audioButton.textContent=$('#sound').textContent;};panel.append(audioButton);
 if(window.onlineActive)window.appendConnectionSettings?.(panel);
};
document.addEventListener('pointerdown',e=>{const panel=$('#pause-settings');if(panel&&!panel.hidden&&!panel.contains(e.target)&&!e.target.closest('#pause-settings-toggle'))panel.hidden=true;});
const localSettingsButton=document.createElement('button');localSettingsButton.id='local-settings-button';localSettingsButton.textContent='Настройки';
const localOptions=document.createElement('div');localOptions.id='local-options';localOptions.hidden=true;
localSettingsButton.onclick=()=>{localOptions.hidden=!localOptions.hidden;};
window.refreshMobileSettings=()=>{
 if(currentMode==='local'){
  if(localSettingsButton.parentElement!==window.cardTools)window.cardTools.append(localSettingsButton,localOptions);
  for(const button of [$('#sound'),$('#install-app'),fullscreenButton])if(button.parentElement!==localOptions)localOptions.append(button);
 }else{
  for(const button of [$('#sound'),$('#install-app'),fullscreenButton])if(button.parentElement===localOptions)window.cardTools.append(button);
  localSettingsButton.remove();localOptions.remove();localOptions.hidden=true;
 }
};
document.addEventListener('pointerdown',e=>{if(!localOptions.hidden&&!localOptions.contains(e.target)&&!localSettingsButton.contains(e.target))localOptions.hidden=true;});

// Fit one fixed landscape composition into the visible browser area as a whole.
// Cards never change their internal tracks when Android chrome opens or collapses.
const compactGarageMedia=matchMedia('(pointer:coarse) and (orientation:landscape) and (min-width:700px)');
let compactGarageViewportHeight=window.visualViewport?.height||innerHeight;
function fitCompactGarage(){
 const lobby=$('#lobby');if(!lobby)return;
 const viewport=window.visualViewport,width=viewport?.width||innerWidth;
 const visibleHeight=viewport?.height||innerHeight,editingText=document.activeElement?.matches('input,textarea,[contenteditable="true"]');
 const keyboard=editingText&&visibleHeight<compactGarageViewportHeight*.82;
 if(!keyboard)compactGarageViewportHeight=visibleHeight;
 const height=keyboard?Math.max(compactGarageViewportHeight,innerHeight):visibleHeight;
 const fitted=Math.min(1,(width-20)/1000,(height-20)/350);
 lobby.style.setProperty('--garage-fit',String(Math.max(.35,fitted)));
}
window.fitCompactGarage=fitCompactGarage;
compactGarageMedia.addEventListener('change',fitCompactGarage);addEventListener('resize',fitCompactGarage);
window.visualViewport?.addEventListener('resize',fitCompactGarage);document.addEventListener('focusout',fitCompactGarage);fitCompactGarage();

;

// ui-controls.js
'use strict';
// Game-style choices keep the existing values and change handlers as their model.
const choiceControls=new Map();
function mountChoiceControls(){
 for(const select of document.querySelectorAll('#lobby select')){
  if(choiceControls.has(select))continue;
  select.classList.add('choice-model');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  if(select.id==='my-ability'||select.dataset.ability!==undefined||select.dataset.abilitySeat!==undefined||select.id==='players'){
   const group=document.createElement('div');group.className='choice-tiles';group.setAttribute('role','group');
   const icons={turbo:menuIcon('turbo'),jump:menuIcon('jump'),shield:menuIcon('shield')};
   for(const option of select.options){const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.innerHTML=select.id==='players'?option.value:'<span aria-hidden="true">'+icons[option.value]+'</span><small>'+option.textContent+'</small>';button.setAttribute('aria-label',option.textContent);button.onclick=()=>{if(select.disabled)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refreshChoices();};group.append(button);}
   select.after(group);choiceControls.set(select,{tiles:true,group,buttons:group.querySelectorAll('button')});continue;
  }
  const group=document.createElement('div');group.className='choice-switch';group.setAttribute('role','group');
  const title=select.id==='track'?'мир':select.id==='vehicle'?'машина':select.id==='players'?'число игроков':'способность';
  group.innerHTML=`<button type="button" class="choice-arrow" aria-label="Предыдущий вариант: ${title}">${menuIcon('left')}</button><span class="choice-value" aria-live="polite"></span><button type="button" class="choice-arrow" aria-label="Следующий вариант: ${title}">${menuIcon('right')}</button>`;
  select.after(group);const buttons=group.querySelectorAll('button'),value=group.querySelector('.choice-value');
  const change=direction=>{
   if(select.disabled)return;const options=Array.from(select.options),at=options.findIndex(o=>o.value===select.value);
   select.value=options[(at+direction+options.length)%options.length].value;select.dispatchEvent(new Event('change',{bubbles:true}));
   value.getAnimations().forEach(a=>a.cancel());if(!matchMedia('(prefers-reduced-motion: reduce)').matches)value.animate([{opacity:0,transform:`translateX(${direction*12}px)`},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'ease-out'});
   refreshChoices();
  };
  buttons[0].onclick=()=>change(-1);buttons[1].onclick=()=>change(1);
  group.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();change(e.key==='ArrowLeft'?-1:1);}};
  choiceControls.set(select,{group,buttons,value,last:''});
 }
}
function refreshChoices(){
 window.refreshMobileSettings?.();
 mountChoiceControls();
 for(const [select,control] of choiceControls){
  if(!select.isConnected){choiceControls.delete(select);continue;}
   if(control.tiles){for(const [index,b] of [...control.buttons].entries()){const option=Array.from(select.options).find(o=>o.value===b.dataset.value);b.disabled=select.disabled||!!option?.disabled;b.classList.toggle('selected',b.dataset.value===select.value);b.setAttribute('aria-pressed',String(b.dataset.value===select.value));}continue;}
  const option=select.selectedOptions[0],label=select.id==='track'?MAPS[+select.value].name:option?.textContent.split(' · ')[0]||'';
  if(control.last!==label){control.value.textContent=label;control.last=label;}
  for(const button of control.buttons)button.disabled=select.disabled;control.group.classList.toggle('locked',select.disabled);
 }
 const online=!!window.onlineActive;
 $('#ability-panel').replaceChildren();
 for(const button of document.querySelectorAll('#picks [data-char-seat]'))if(!button.querySelector('svg'))button.innerHTML=menuIcon(button.dataset.step==='-1'?'left':'right');
 const v=VEHICLES[+$('#vehicle').value];
 if($('#car-specs').dataset.model!==$('#vehicle').value){
  const rows=vehicleStats(v);
  $('#car-specs').dataset.model=$('#vehicle').value;$('#car-specs').innerHTML=rows.map(([label,value])=>'<div'+(label==='Характеристики'&&v.specSource?' title="'+v.specSource+'"':'')+'><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('');
 }
 $('#world-description').textContent=MAPS[+$('#track').value].description;
 const map=MAPS[+$('#track').value];
 if($('#track-specs').dataset.map!==$('#track').value){
  // Scenic weather presets belong to the fictional routes, not a live forecast.
  const presets=[
   [['sun',18],['cloud',19],['sun',21]],
   [['cloud',6],['cloud',8],['sun',3]],
   [['sun',120],['moon',-20],['moon',-170]],
   [['sun',22],['sun',26],['cloud',21]],
   [['cloud',20],['sun',23],['cloud',18]],
   [['snow',-12],['cloud',-8],['snow',-14]],
   [['sun',18],['cloud',5],['snow',-10]]
  ];
  const labels=map.biome==='moon'?['Свет','Тень','Ночь']:map.biome==='mixed'?['Холмы','Горы','Зима']:['Утро','День','Вечер'];
  $('#track-specs').dataset.map=$('#track').value;$('#track-specs').innerHTML=presets[+$('#track').value].map(([icon,temp],i)=>'<div>'+menuIcon(icon)+'<dd>'+(temp>0?'+':'')+temp+'°</dd></div>').join('');
 }
 const startParent=online&&$('#room-panel')?$('#room-panel'):$('.bottom');if($('#start').parentElement!==startParent)startParent.append($('#start'));
 if(online&&mode==='lobby'&&roomState?.room){$('#menu').hidden=true;const target=$('#room-options .drawer-body')||$('#room-options');if(window.cardTools.parentElement!==target)target.append(window.cardTools);}
 else if(online&&mode==='race'){$('#menu').hidden=true;$('#pause').hidden=false;}
 else if(!online){if($('#menu').parentElement!==document.querySelector('nav'))document.querySelector('nav').append($('#menu'));$('#menu').hidden=true;$('#pause').hidden=mode!=='race';}
}
const settings=$('.bottom'),worldLabel=$('#track').closest('label'),vehicleLabel=$('#vehicle').closest('label');
worldLabel.classList.add('setting-card','world-setting');vehicleLabel.classList.add('setting-card','vehicle-setting');
worldLabel.firstChild.textContent='';vehicleLabel.firstChild.textContent='';worldLabel.setAttribute('aria-label','Выбор трассы');vehicleLabel.setAttribute('aria-label','Выбор машины');

vehicleLabel.append($('#vehicle-description'));$('#map-description').hidden=true;
const racerColumn=document.createElement('section');racerColumn.id='racer-column';$('#picks').before(racerColumn);racerColumn.append($('#picks'));const abilityPanel=document.createElement('section');abilityPanel.id='ability-panel';racerColumn.append(abilityPanel);
 const worldDescription=document.createElement('p');worldDescription.id='world-description';worldLabel.append(worldDescription);
 const trackSpecs=document.createElement('dl');trackSpecs.id='track-specs';worldLabel.append(trackSpecs);
 const specs=document.createElement('dl');specs.id='car-specs';vehicleLabel.append(specs);
new MutationObserver(()=>refreshChoices()).observe($('#picks'),{childList:true,subtree:true});
window.refreshChoices=refreshChoices;refreshChoices();

;

// scene-layers.js
'use strict';
// Static pixels stay in compositor layers; the frame loop only moves them.
(()=>{
 const mainContext=ctx,root=document.createElement('div');root.id='scene-layers';root.setAttribute('aria-hidden','true');
 Object.assign(root.style,{position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'0',contain:'strict'});
 function group(z){const node=document.createElement('div');Object.assign(node.style,{position:'absolute',inset:'0',overflow:'hidden',zIndex:String(z)});root.append(node);return node;}
 const sky=group(0),back=group(1),ridges=group(2),scenery=group(3),backgroundCanvas=document.createElement('canvas');ridges.append(backgroundCanvas);
 Object.assign(backgroundCanvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});
 const backgroundContext=backgroundCanvas.getContext('2d'),pools=[[],[]],keyedPools=[new Map(),new Map()];let frameId=0,used=[0,0],active=false,skySource=null;
 canvas.style.zIndex='1';for(const id of ['hud','foot']){const node=document.getElementById(id);if(node)node.style.zIndex='3';}document.body.append(root);
 const assign=(style,key,value)=>{if(style[key]!==value)style[key]=value;};
 function bitmap(source,x,y,width,height,version=0,key=null){
  if(!active||(ctx!==mainContext&&ctx!==backgroundContext))return false;
  const layer=ctx===mainContext?1:0,index=key===null?used[layer]++:key,pool=key===null?pools[layer]:keyedPools[layer];let item=key===null?pool[index]:pool.get(key);
  const image=source instanceof HTMLImageElement;
  if(!item||item.image!==image){item?.node.remove();const node=document.createElement(image?'img':'canvas');Object.assign(node.style,{position:'absolute',inset:'auto',left:'0',top:'0',transformOrigin:'0 0',pointerEvents:'none',willChange:'transform'});node.draggable=false;(layer?scenery:back).append(node);item={node,image,source:null,version:null};if(key===null)pool[index]=item;else pool.set(key,item);}
  item.lastFrame=frameId;const node=item.node;node.hidden=false;node.dataset.layerKey=key??'';assign(node.style,'zIndex',key==='sky:sun'?'0':key?.startsWith('sky:cloud:')?'5':key?.startsWith('landscape:far:')?'10':key?.startsWith('landscape:middle:')?'20':key?.startsWith('landscape:near:')?'30':'10');
  if(item.source!==source||item.version!==version){if(image){node.src=source.currentSrc||source.src;node.alt='';}else{node.width=source.width;node.height=source.height;node.getContext('2d').drawImage(source,0,0);}item.source=source;item.version=version;}
  const m=ctx.getTransform(),r=renderRatio;
  assign(node.style,'width',width+'px');assign(node.style,'height',height+'px');assign(node.style,'opacity',String(ctx.globalAlpha));
  assign(node.style,'transform',`matrix(${m.a/r},${m.b/r},${m.c/r},${m.d/r},${(m.a*x+m.c*y+m.e)/r},${(m.b*x+m.d*y+m.f)/r})`);return true;
 }
 window.sceneLayers={
  begin(){frameId++;active=true;root.hidden=false;used=[0,0];backgroundCanvas.hidden=true;backgroundContext.setTransform(renderRatio,0,0,renderRatio,0,0);},
  background(action){return withDrawingContext((mode==='lobby'?+$('#track').value:track)===0?backgroundContext:mainContext,action);},
  sky(source){if(!active)return false;if(skySource!==source){Object.assign(source.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});sky.replaceChildren(source);skySource=source;}return true;},
  bitmap,
  end(){for(let layer=0;layer<2;layer++){for(let i=used[layer];i<pools[layer].length;i++)pools[layer][i].node.hidden=true;for(const [key,item] of keyedPools[layer])if(item.lastFrame!==frameId){item.node.remove();keyedPools[layer].delete(key);}}active=false;},
  get active(){return active;}
 };
})();

;

// wheel-editor.js
'use strict';
(()=>{
 const openButton=document.createElement('button');openButton.id='wheel-editor-open';openButton.type='button';openButton.textContent='Расставить колёса';
 document.querySelector('.vehicle-setting').append(openButton);
 const dialog=document.createElement('dialog');dialog.id='wheel-editor';
 dialog.innerHTML=`<div class="wheel-editor-head"><h2>Колёса и водитель</h2><button type="button" id="wheel-editor-close" aria-label="Закрыть редактор">×</button></div>
 <p>Перетаскивай колёса мышью или пальцем. Кузов остаётся на месте. Положение и размер колёс влияют на езду. Проверь результат кнопкой «Тест-драйв».</p>
 <label>Машина <select id="wheel-editor-car"></select></label>
 <canvas id="wheel-editor-preview" width="1000" height="480" aria-label="Предпросмотр машины. Колёса можно перетаскивать."></canvas>
 <label>Что перемещать <select id="wheel-editor-part"><option value="wheels">Колёса</option><option value="driver">Водитель</option></select></label>
 <label class="wheel-only">Колесо / ось <select id="wheel-editor-axle"></select></label>
 <div class="wheel-editor-fields wheel-only">
 <label>Влево / вправо <input id="wheel-editor-x" type="number" min="-35" max="35" step="0.1"></label>
 <label>Вверх / вниз <input id="wheel-editor-y" type="number" min="-35" max="35" step="0.1"></label>
 <label>Размер, % <input id="wheel-editor-scale" type="number" min="40" max="180" step="1"></label></div>
 <div class="wheel-editor-fields driver-only" hidden><label>Водитель: влево / вправо <input id="wheel-editor-driver-x" type="number" min="-60" max="60" step="0.1"></label><label>Водитель: вверх / вниз <input id="wheel-editor-driver-y" type="number" min="-60" max="60" step="0.1"></label><label>Размер водителя, % <input id="wheel-editor-driver-scale" type="number" min="30" max="250" step="1"></label></div>
 <p id="wheel-editor-status" role="status" aria-live="polite">Сохраняется в этом браузере. Для общей версии игры скачай файл и отправь его в чат.</p>
 <div class="wheel-editor-actions"><button type="button" id="wheel-editor-test">Тест-драйв</button><button type="button" id="wheel-editor-save">Сохранить</button><button type="button" id="wheel-editor-export">Скачать настройки всех машин</button><button type="button" id="wheel-editor-reset">Сбросить эту машину</button></div>`;
 document.body.append(dialog);
 const testPanel=document.createElement('div');testPanel.id='wheel-test-controls';testPanel.hidden=true;testPanel.innerHTML='<label>Испытательная трасса <select id="wheel-test-road"><option value="flat">Ровная дорога</option><option value="hills">Холмы</option><option value="moon">Луна</option></select></label><p>W / D — газ · S / A — тормоз · R — заново. Можно пользоваться кнопками ниже.</p><div class="wheel-test-pedals"><button type="button" data-pedal="brake">Тормоз / назад</button><button type="button" data-pedal="gas">Газ</button><button type="button" id="wheel-test-restart">Заново</button></div>';
 dialog.querySelector('#wheel-editor-preview').after(testPanel);
 const find=id=>dialog.querySelector('#wheel-editor-'+id),preview=find('preview'),paint=preview.getContext('2d');
 const carSelect=find('car'),axleSelect=find('axle'),status=find('status');
 for(const [i,v] of VEHICLES.entries())carSelect.add(new Option(v.name,String(i)));
 let drafts={},driverDrafts={},model=0,selected=0,transform,drag=null;
 const spec=()=>VEHICLES[model],layout=()=>drafts[spec().kind];
 const wheelName=(i,n)=>n===2?(i===0?'Задние колёса':'Передние колёса'):'Ось '+(i+1)+' (слева направо)';
 function fields(){const d=driverDrafts[spec().kind];for(const key of ['x','y','scale'])find('driver-'+key).value=key==='scale'?Math.round(d.scale*100):Math.round(d[key]*10)/10;const w=layout()[selected];for(const key of ['x','y','scale'])find(key).value=key==='scale'?Math.round(w.scale*100):Math.round(w[key]*10)/10;axleSelect.value=String(selected);}
 function chooseCar(){stopTest();model=+carSelect.value;selected=0;axleSelect.replaceChildren();spec().wheels.forEach((_,i)=>axleSelect.add(new Option(wheelName(i,spec().wheels.length),String(i))));fields();draw();}
 function draw(){
  const v=spec(),wheels=baseWheelSpecs(v),span=v.wheels.at(-1)-v.wheels[0];
  const z=Math.min(4.5,850/(span+140));transform={z,x:500-(v.wheels[0]+v.wheels.at(-1))/2*z,y:290};
  paint.setTransform(1,0,0,1,0,0);paint.fillStyle='#eaf0e4';paint.fillRect(0,0,1000,480);
  paint.strokeStyle='#ccd7c5';paint.lineWidth=1;for(let x=0;x<=1000;x+=40){paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,480);paint.stroke();}for(let y=0;y<=480;y+=40){paint.beginPath();paint.moveTo(0,y);paint.lineTo(1000,y);paint.stroke();}
  paint.save();paint.translate(transform.x,transform.y);paint.scale(z,z);
  for(const [i,wheel] of wheels.entries()){
   const w=layout()[i],r=wheel.r*w.scale;paint.save();paint.translate(wheel.x+w.x,v.mount+w.y);
   paint.fillStyle='#182b36';paint.beginPath();paint.arc(0,0,r,0,Math.PI*2);paint.fill();paint.fillStyle='#b8cbd3';paint.beginPath();paint.arc(0,0,r*.62,0,Math.PI*2);paint.fill();paint.fillStyle='#607b8e';paint.beginPath();paint.arc(0,0,r*.4,0,Math.PI*2);paint.fill();paint.restore();
  }
  const car={model,i:0,vx:0,vy:0,a:0,contacts:[],emptyCabin:false};
  paint.save();paint.scale(v.bodyScale,1);const previousDriver=driverAlignmentPreview;try{driverAlignmentPreview=driverDrafts;withDrawingContext(paint,()=>vehicleBody(car,v,0,paint))}finally{driverAlignmentPreview=previousDriver}paint.restore();
  for(const [i,wheel] of wheels.entries()){
   const w=layout()[i],x=wheel.x+w.x,y=v.mount+w.y,r=wheel.r*w.scale;
   paint.strokeStyle=i===selected?'#df572e':'#3c7456';paint.lineWidth=(i===selected?3:1.5)/z;paint.setLineDash([5/z,4/z]);paint.beginPath();paint.arc(x,y,r+2/z,0,Math.PI*2);paint.stroke();paint.setLineDash([]);
   paint.beginPath();paint.moveTo(x-4/z,y);paint.lineTo(x+4/z,y);paint.moveTo(x,y-4/z);paint.lineTo(x,y+4/z);paint.stroke();
  }
  paint.restore();
 }
 function point(e){const r=preview.getBoundingClientRect();return {x:((e.clientX-r.left)*1000/r.width-transform.x)/transform.z,y:((e.clientY-r.top)*480/r.height-transform.y)/transform.z};}
 preview.addEventListener('pointerdown',e=>{
  if(testCar)return;
  if(e.button!==0)return;const p=point(e),v=spec(),wheels=baseWheelSpecs(v);
  if(find('part').value==='driver'){const d=driverDrafts[v.kind];drag={id:e.pointerId,driver:true,x:p.x,y:p.y,oldX:d.x,oldY:d.y};preview.setPointerCapture(e.pointerId);e.preventDefault();return}
  let hit=-1,distance=Infinity;
  wheels.forEach((wheel,i)=>{const w=layout()[i],d=Math.hypot(p.x-wheel.x-w.x,p.y-v.mount-w.y);if(d<=Math.max(wheel.r*w.scale,12)&&d<distance){hit=i;distance=d;}});
  if(hit<0)return;selected=hit;const w=layout()[selected];drag={id:e.pointerId,x:p.x,y:p.y,oldX:w.x,oldY:w.y};preview.setPointerCapture(e.pointerId);fields();draw();e.preventDefault();
 });
 preview.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=point(e),v=spec();if(drag.driver){driverDrafts[v.kind]=validDriverAlignment({...driverDrafts[v.kind],x:drag.oldX+p.x-drag.x,y:drag.oldY+p.y-drag.y});fields();draw();status.textContent='Есть несохранённые изменения.';return}const raw=layout().map(w=>({...w}));raw[selected].x=drag.oldX+p.x-drag.x;raw[selected].y=drag.oldY+p.y-drag.y;drafts[v.kind]=validWheelAlignment(v,raw);fields();draw();status.textContent='Есть несохранённые изменения.';});
 const end=e=>{if(drag?.id!==e.pointerId)return;drag=null;if(preview.hasPointerCapture(e.pointerId))preview.releasePointerCapture(e.pointerId);};
 preview.addEventListener('pointerup',end);preview.addEventListener('pointercancel',end);preview.addEventListener('lostpointercapture',()=>drag=null);
 for(const key of ['x','y','scale'])find(key).addEventListener('input',()=>{if(find(key).value==='')return;const n=Number(find(key).value);if(!Number.isFinite(n))return;const raw=layout().map(w=>({...w}));raw[selected][key]=key==='scale'?n/100:n;drafts[spec().kind]=validWheelAlignment(spec(),raw);draw();status.textContent='Есть несохранённые изменения.';});
 for(const key of ['x','y','scale'])find(key).addEventListener('change',fields);
 for(const key of ['x','y','scale']){find('driver-'+key).addEventListener('input',()=>{const input=find('driver-'+key);if(input.value==='')return;const value=Number(input.value);if(!Number.isFinite(value))return;driverDrafts[spec().kind]=validDriverAlignment({...driverDrafts[spec().kind],[key]:key==='scale'?value/100:value});draw();status.textContent='Есть несохранённые изменения.';});find('driver-'+key).addEventListener('change',fields);}
 find('part').onchange=()=>{for(const e of dialog.querySelectorAll('.wheel-only'))e.hidden=find('part').value==='driver';for(const e of dialog.querySelectorAll('.driver-only'))e.hidden=find('part').value!=='driver';draw();};
 carSelect.onchange=chooseCar;axleSelect.onchange=()=>{selected=+axleSelect.value;fields();draw();};
 find('reset').onclick=()=>{drafts[spec().kind]=validWheelAlignment(spec(),DEFAULT_WHEEL_ALIGNMENTS[spec().kind]);driverDrafts[spec().kind]=validDriverAlignment(DEFAULT_DRIVER_ALIGNMENTS[spec().kind]);fields();draw();status.textContent='Исходное положение восстановлено. Нажми «Сохранить», чтобы применить.';};
 find('save').onclick=()=>{if(saveAllWheelAlignments(drafts,driverDrafts)){status.textContent='Все настройки сохранены и применены. Чтобы я внёс их в общую игру, скачай файл и отправь в чат.';}else{status.textContent='Браузер не разрешил сохранение. Скачай файл, чтобы не потерять настройки.';}};
 find('export').onclick=()=>{
  const payload=exportWheelAlignments(drafts,driverDrafts),blob=new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='hill-rivals-wheel-settings.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Файл содержит настройки всех '+VEHICLES.length+' машин, включая текущие правки. Отправь его в чат — я применю их для всех игроков.';
 };
 find('close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{stopTest();drag=null;openButton.focus();});
 openButton.onclick=e=>{e.preventDefault();drafts=Object.fromEntries(VEHICLES.map(v=>[v.kind,validWheelAlignment(v,wheelAlignments[v.kind])]));driverDrafts=Object.fromEntries(VEHICLES.map(v=>[v.kind,validDriverAlignment(driverAlignments[v.kind])]));carSelect.value=$('#vehicle').value;chooseCar();status.textContent='Сохраняется в этом браузере. Скачай настройки всех машин и отправь файл в чат для общей версии игры.';dialog.showModal();};

 let testCar=null,testFrame=0,testLast=0,testAccumulator=0,testKeys={gas:false,brake:false};const pedalPointers=new Map();
 const testRoad=document.querySelector('#wheel-test-road');
 function ground(x){return testRoad.value==='flat'?0:Math.sin(x/150)*24+Math.sin(x/65)*7}
 function withTestWorld(action){const old={track,terrain,slope,hillBridgeVelocity,input,vehicleModel,preview:wheelAlignmentPreview,driverPreview:driverAlignmentPreview};try{wheelAlignmentPreview=drafts;driverAlignmentPreview=driverDrafts;vehicleModel=model;track=testRoad.value==='moon'?2:3;terrain=ground;slope=x=>(ground(x+1)-ground(x-1))/2;hillBridgeVelocity=()=>0;input=()=>[testKeys.gas||[...pedalPointers.values()].includes('gas'),testKeys.brake||[...pedalPointers.values()].includes('brake')];return action()}finally{track=old.track;terrain=old.terrain;slope=old.slope;hillBridgeVelocity=old.hillBridgeVelocity;input=old.input;vehicleModel=old.vehicleModel;wheelAlignmentPreview=old.preview;driverAlignmentPreview=old.driverPreview}}
 function restartTest(){testKeys={gas:false,brake:false};pedalPointers.clear();testAccumulator=0;withTestWorld(()=>{testCar=newCar(0);testCar.startX=testCar.x;});}
 function stopTest(){cancelAnimationFrame(testFrame);testFrame=0;testCar=null;pedalPointers.clear();testKeys={gas:false,brake:false};testPanel.hidden=true;dialog.classList.remove('testing');find('test').textContent='Тест-драйв';}
 function testTick(now){if(!testCar||!dialog.open)return;const elapsed=Math.max(0,Math.min(.05,(now-testLast)/1000));testLast=now;testAccumulator+=elapsed;withTestWorld(()=>{
  while(testAccumulator>=1/120){physics(testCar,1/120);testAccumulator-=1/120;}
  paint.setTransform(1,0,0,1,0,0);paint.fillStyle=testRoad.value==='moon'?'#263248':'#c6e6ec';paint.fillRect(0,0,1000,480);
  const z=3.2,camX=testCar.x-100,camY=testCar.y-75;paint.save();paint.scale(z,z);paint.translate(-camX,-camY);
  paint.beginPath();paint.moveTo(camX,camY+480/z);for(let x=camX;x<=camX+1000/z+4;x+=4)paint.lineTo(x,ground(x));paint.lineTo(camX+1000/z+4,camY+480/z);paint.closePath();paint.fillStyle=testRoad.value==='moon'?'#9298a5':'#7a9c65';paint.fill();paint.strokeStyle='#3b5440';paint.lineWidth=2/z;paint.stroke();
  drawVehicleOn(paint,testCar);paint.restore();
  paint.fillStyle='#fff8e7';paint.fillRect(12,12,370,56);paint.fillStyle='#20382f';paint.font='bold 18px Arial';paint.fillText(Math.round(speedKph(testCar.vx))+' км/ч · '+Math.round(raceMetres(testCar))+' м',24,36);paint.font='14px Arial';paint.fillText(testCar.alive?'Текущая расстановка колёс':testCar.reason+' — нажми «Заново»',24,56);
 });testFrame=requestAnimationFrame(testTick);}
 find('test').onclick=()=>{if(testCar){stopTest();draw();return}testPanel.hidden=false;dialog.classList.add('testing');find('test').textContent='Вернуться к колёсам';restartTest();testLast=performance.now();testFrame=requestAnimationFrame(testTick);status.textContent='Пробный заезд с текущими правками. После проверки вернись к колёсам или сохрани настройки.';};
 testRoad.onchange=restartTest;document.querySelector('#wheel-test-restart').onclick=restartTest;
 for(const button of testPanel.querySelectorAll('[data-pedal]')){button.onpointerdown=e=>{e.preventDefault();pedalPointers.set(e.pointerId,button.dataset.pedal);button.setPointerCapture(e.pointerId)};const release=e=>pedalPointers.delete(e.pointerId);button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;}
 window.addEventListener('blur',()=>{testKeys={gas:false,brake:false};pedalPointers.clear();});
 window.gameDebug.getWheelTest=()=>testCar?{car:{...testCar},wheels:withTestWorld(()=>wheelSpecs(spec())),driver:{...driverDrafts[spec().kind]}}:null;
 // Activate touch buttons on release even after a captured canvas drag. Suppress
 // the optional compatibility click so a tap cannot start and stop a trial twice.
 for(const button of dialog.querySelectorAll('button:not([data-pedal])')){let lastTouch=-Infinity;button.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')return;e.preventDefault();lastTouch=performance.now();button.click();});button.addEventListener('click',e=>{if(e.isTrusted&&performance.now()-lastTouch<700)e.stopImmediatePropagation();},true);}
 window.addEventListener('keydown',e=>{if(dialog.open){if(testCar){if(['KeyW','KeyD','ArrowUp','ArrowRight'].includes(e.code))testKeys.gas=true;if(['KeyS','KeyA','ArrowDown','ArrowLeft'].includes(e.code))testKeys.brake=true;if(e.code==='KeyR'&&!e.repeat)restartTest();if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();}e.stopImmediatePropagation();}} ,true);
 window.addEventListener('keyup',e=>{if(dialog.open){if(['KeyW','KeyD','ArrowUp','ArrowRight'].includes(e.code))testKeys.gas=false;if(['KeyS','KeyA','ArrowDown','ArrowLeft'].includes(e.code))testKeys.brake=false;e.stopImmediatePropagation();}},true);
})();
