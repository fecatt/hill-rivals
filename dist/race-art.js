'use strict';
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke()}}
const paintedBodies={};
const TIRE_DRAW_SCALE=1;
const BODY_ART_SCALE=1.18;
const BODY_BOUNDS={"jeep":[22,144,1497,648],"buggy":[30,169,1488,608],"pickup":[12,177,1514,567],"rally":[43,119,1712,634],"monster":[6,157,1527,610],"hotrod":[28,263,1486,469],"rocket":[43,160,1717,538],"van":[44,124,1684,708]};
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
 van:{axles:[400,1464],y:730,seat:1260,floor:655,size:.38}
};
function vehicleBody(c,v,bob){
 const im=paintedBodies[v.kind],crop=BODY_BOUNDS[v.kind],a=BODY_ANCHORS[v.kind];if(!im?.complete||!im.naturalWidth)return;
 // Undo the old model-wide horizontal stretch. The painting's vertical scale comes
 // from its real axle spacing, never an arbitrary rectangular height.
 ctx.save();ctx.scale(1/v.bodyScale,1);ctx.imageSmoothingEnabled=true;
 const specs=wheelSpecs(v),pose=visualPose(c),first=specs[0].x,last=specs[specs.length-1].x;
 const unit=(last-first)/(a.axles[a.axles.length-1]-a.axles[0])*BODY_ART_SCALE;
 const wheelY=pose.wheels.reduce((sum,y,j)=>sum+y+specs[j].r*(1-TIRE_DRAW_SCALE),0)/pose.wheels.length+bob;
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
 const seatX=mapX(a.seat),floor=wheelY+(a.floor-a.y)*unit+(a.seatDrop||0);
 // Enlarge the seated figure while keeping its head at the same cabin height.
 const openCabin=['jeep','buggy','hotrod','rocket'].includes(v.kind);
 const driverSize=a.size*(openCabin?1.32:1.15),driverFloor=floor+79*(driverSize-a.size)+(openCabin?3:0);
 // Draw the complete seated figure FIRST; the entire body is then in front of it.
 if(!c.emptyCabin){ctx.save();ctx.beginPath();ctx.rect(seatX-24,top-20,48,Math.max(20,driverFloor-top+20));ctx.clip();ctx.translate(seatX+6*driverSize,driverFloor-13*driverSize);ctx.scale(driverSize,driverSize);seatedDriver(c,0);ctx.restore();}
 // Wheels are drawn first. Use the painting's own transparent wheel wells;
 // never erase the foreground fenders with a circular wheel mask.
 for(const [s1,s2,x1,x2] of strips)ctx.drawImage(im,s1,crop[1],s2-s1,crop[3],x1,top,x2-x1+.15,height);
 ctx.restore();
}
function drawTurboFlame(x,y,power=1){
 ctx.save();ctx.translate(x,y);const pulse=1+Math.sin(time*39)*.12+Math.sin(time*67)*.08,length=(36+power*24)*pulse;
 const glow=ctx.createRadialGradient(-length*.4,0,1,-length*.4,0,length*.65);glow.addColorStop(0,'#ffae4266');glow.addColorStop(1,'#ff842000');ctx.fillStyle=glow;ctx.fillRect(-length*1.2,-length*.65,length*1.4,length*1.3);
 for(let i=0;i<3;i++){const size=1-i*.23,l=length*size,h=(11-i*2)*pulse,wave=Math.sin(time*48+i*2)*3;
  ctx.beginPath();ctx.moveTo(2,-h);ctx.bezierCurveTo(-l*.3,-h*1.2,-l*.42,-h*.5,-l,-h*.12+wave);ctx.bezierCurveTo(-l*.58,h*.7,-l*.35,h*1.15,2,h);ctx.quadraticCurveTo(-7,0,2,-h);ctx.fillStyle=['#f16b30','#ffc652','#fff5c8'][i];ctx.fill();
 }
 for(let j=0;j<5;j++){const age=(time*3.2+j*.21)%1;ctx.globalAlpha=1-age;circle(-length*.5-age*45,Math.sin(j*4+time*8)*(3+age*7),1.8*(1-age),'#ffd36c')}
 ctx.restore();
}
function drawVehicle(c){
 const v=carSpec(c),p=visualPose(c),wheels=wheelSpecs(v);ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);if(!c.alive)ctx.globalAlpha=.4;
 if(c.alive&&(c.boost>0||v.rocket&&c.rocketOn)){ctx.save();ctx.scale(v.bodyScale,1);drawTurboFlame(v.rocket?-70:-54,v.rocket?-17:7,c.boost>0?1.25:.65);ctx.restore()}
 for(let j=0;j<wheels.length;j++){const {x:rx,r:physicalR}=wheels[j],r=physicalR*TIRE_DRAW_SCALE,yy=p.wheels[j]+physicalR-r;ctx.save();ctx.translate(rx,yy);ctx.rotate(c.wheel*18/r);
  const tire=ctx.createRadialGradient(-r*.3,-r*.35,2,0,0,r);tire.addColorStop(0,'#536271');tire.addColorStop(.65,'#293946');tire.addColorStop(1,'#142431');circle(0,0,r,tire,'#122230');circle(0,0,r*.62,'#bdd0d9','#354d5d');circle(0,0,r*.43,'#617b8e');for(let k=0;k<6;k++){ctx.rotate(Math.PI/3);strokeLine([[r*.17,0],[r*.49,0]],'#e3eef0',2.3)}circle(0,0,3,'#e7efef');
  if(c.mud>0){for(let k=0;k<7;k++){const a=k*.9;circle(Math.cos(a)*r*.62,Math.sin(a)*r*.62,r*(k%2?.21:.28),k%2?'#9b713f':'#674b30')}circle(-r*.18,r*.1,r*.25,'#886039')}
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
 const parked={i:0,model,x,y:ground-v.mount-Math.max(...wheelSpecs(v).map(w=>w.r)),vx:0,vy:0,a:0,wheel:0,alive:true,contacts:[],shield:0,boost:0,mud:0,noticeTime:0,emptyCabin:true};
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
