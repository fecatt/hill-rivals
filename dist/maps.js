'use strict';
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
const environmentAtlas=new Image();environmentAtlas.src='assets/environment-atlas.png';
let worldSeed=1,biomeOrder=['hills','mountains','highway','city','winter'];
function hash(n,salt=0){let v=(Math.floor(n)^worldSeed^Math.imul(salt,0x9e3779b9))>>>0;v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);return ((v^(v>>>16))>>>0)/4294967296}
function setWorldSeed(seed){worldSeed=seed>>>0;biomeOrder=['hills','mountains','highway','city','winter'];for(let j=4;j>0;j--){let k=Math.floor(hash(j,71)*(j+1));[biomeOrder[j],biomeOrder[k]]=[biomeOrder[k],biomeOrder[j]]}}
function newWorldSeed(){let seed=globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*4294967296);if(seed===worldSeed)seed=(seed+1)>>>0;setWorldSeed(seed)}
function biomeRegion(region){return biomeOrder[((region%5)+5)%5]}
function mapBiome(t,x){return t===6?biomeRegion(Math.max(0,Math.floor(x/BIOME_LENGTH))):MAPS[t].biome}
function ease(t){return t*t*(3-2*t)}
function smoothNoise(x,salt){const i=Math.floor(x),f=ease(x-i);return (hash(i,salt)*(1-f)+hash(i+1,salt)*f)*2-1}
function profile(b,x){const i=['hills','mountains','moon','highway','city','winter'].indexOf(b),amplitudes=[[65,26,8],[120,38,12],[76,32,12],[25,10,3],[34,12,4],[70,28,8]][i],wavelengths=[[230,115,65],[350,160,80],[300,145,85],[480,200,110],[410,185,95],[265,140,75]][i];let v=0;for(let j=0;j<3;j++){const phase=hash(i,j+19)*Math.PI*2,freq=.62+hash(i,j+31)*.78,amp=.62+hash(i,j+47)*.82;v+=amplitudes[j]*amp*Math.sin(x*freq/wavelengths[j]+phase)}return v+smoothNoise(x/520,i+91)*(b==='highway'?12:28)+smoothNoise(x/175,i+211)*amplitudes[0]*.19}
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
 if(b!=='moon')for(let j=0;j<6;j++){const cx=((j*305-cam*.12)%(W+360)+W+360)%(W+360)-150,cy=92+(j%3)*43,w=118+(j%3)*23,h=42+(j%2)*10,cloud=mapCloudTexture(b,w,h);const dx=Math.round((cx-cloud.left)*renderRatio)/renderRatio,dy=Math.round((cy-cloud.top)*renderRatio)/renderRatio,dw=cloud.surface.width/renderRatio,dh=cloud.surface.height/renderRatio;if(!window.sceneLayers?.bitmap(cloud.surface,dx,dy,dw,dh))ctx.drawImage(cloud.surface,dx,dy,dw,dh);}
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
 if(window.sceneLayers?.active){const crop=ENV_CROPS[index],width=height*crop[2]/crop[3];ctx.save();ctx.translate(x,bottom);ctx.rotate(angle);if(flip)ctx.scale(-1,1);window.sceneLayers.bitmap(hillTexture(environmentAtlas,crop,512),-width/2,-height,width,height);ctx.restore();return true;}
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

function drawGround(t,left,right,bottom,flat=false){
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


