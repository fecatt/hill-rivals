'use strict';
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke()}}
const paintedBodies={};
const TIRE_DRAW_SCALE=1;
const BODY_ART_SCALE=1.18;
const BODY_BOUNDS={"jeep":[22,144,1497,648],"buggy":[30,169,1488,608],"pickup":[12,177,1514,567],"rally":[43,119,1712,634],"monster":[6,157,1527,610],"hotrod":[28,263,1486,469],"rocket":[43,160,1717,538],"van":[44,124,1684,708]};
BODY_BOUNDS.evo=[43,119,1712,634];
for(const kind of Object.keys(BODY_BOUNDS)){const im=new Image();im.src=kind==='jeep'?'assets/car-jeep-open-arches.png':'assets/car-'+kind+'.png';paintedBodies[kind]=im}
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
