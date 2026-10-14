'use strict';
const VEHICLES=[
 {name:'Классический джип',kind:'jeep',lift:0,radius:18,wheels:[-31,31],mass:900,engine:820,maxSpeed:680,spring:95,damper:12,mount:18,travel:12,grip:1.65,rotation:1,drag:.48,bodyScale:1,description:'Универсальный: средняя тяга и мягкая подвеска.'},
 {name:'Песчаный багги',kind:'buggy',lift:0,radius:21,wheels:[-35,35],mass:580,engine:720,maxSpeed:720,spring:52,damper:8,mount:22,travel:20,grip:1.7,rotation:1.25,drag:.42,bodyScale:1.1,description:'Лёгкий, резвый и прыгучий. Длинный ход подвески.'},
 {name:'Пикап 6×6',kind:'pickup',lift:0,radius:22,wheels:[-50,0,50],mass:1600,engine:1450,maxSpeed:560,spring:110,damper:15,mount:24,travel:15,grip:1.85,rotation:.65,drag:.7,bodyScale:1.4,description:'Тяжёлый трёхосный грузовик: три колеса в боковом виде, тяга на подъёмах.'},
 {name:'Ралли',kind:'rally',lift:0,radius:16,wheels:[-34,34],mass:760,engine:950,maxSpeed:830,spring:135,damper:16,mount:14,travel:8,grip:1.95,rotation:.85,drag:.32,bodyScale:1.08,description:'Быстрый разгон, высокая скорость и короткая жёсткая подвеска.'},
 {name:'Монстр-трак 8×8',kind:'monster',lift:0,radius:28,wheels:[-93,-31,31,93],mass:2800,engine:2650,maxSpeed:490,spring:150,damper:21,mount:32,travel:24,grip:2.15,rotation:.48,drag:1,bodyScale:2,description:'Четыре оси и огромные колёса. Мощный, устойчивый, но медленный.'},
 {name:'Хот-род',kind:'hotrod',lift:2,radius:19,wheelRadii:[24,15],wheels:[-38,38],mass:1050,engine:1400,maxSpeed:950,spring:145,damper:12,mount:18,travel:9,grip:1.75,rotation:1.15,drag:.25,bodyScale:1.18,description:'Большие задние колёса, маленькие передние. Очень быстрый, легко встаёт на дыбы.'},
 {name:'Турборакета',kind:'rocket',lift:0,radius:14,wheels:[-33,33],mass:980,engine:820,maxSpeed:1100,spring:115,damper:14,mount:16,travel:10,grip:1.7,rotation:.8,drag:.4,bodyScale:1.15,rocket:true,description:'Газ даёт реактивную тягу вперёд и вверх даже в воздухе. Тормоз управляет носом; расход топлива повышен.'}
];

// Calibrate the shared world scale against the classic Jeep drawing.
// Its bumper-to-bumper span is 112.592 world units (see race-art.js anchors).
// Reference: a short Willys MB, about 3.33 m long; art is stylised, not a replica.
const REFERENCE_JEEP_LENGTH_METRES=3.33;
const REFERENCE_JEEP_WORLD_LENGTH=112.592;
const WORLD_UNITS_PER_METRE=REFERENCE_JEEP_WORLD_LENGTH/REFERENCE_JEEP_LENGTH_METRES;
function worldMetres(units){return units/WORLD_UNITS_PER_METRE}
function speedKph(velocity){return Math.abs(worldMetres(velocity))*3.6}
function raceMetres(c){return Math.max(0,worldMetres(c.x-c.startX))}

function carSpec(c){return VEHICLES[c.model??vehicleModel]}
function wheelSpecs(v){return v.wheels.map((x,i)=>({x,r:v.wheelRadii?.[i]??v.radius}))}
function inertia(v){const span=v.wheels[v.wheels.length-1]-v.wheels[0];return 1120*(v.mass/900)*(span/62)**2}
function describeVehicle(){const v=VEHICLES[+$('#vehicle').value],s=wheelSpecs(v);$('#vehicle-description').textContent=v.description;$('#vehicle-stats').textContent=`${v.mass} кг · ${s.length} оси (колёс: ${s.length*2}) · радиус колёс ${s.map(w=>w.r).join('/')} · до ${Math.round(speedKph(v.maxSpeed))} км/ч · ход ${v.travel} · жёсткость ${v.spring}`}
let vehicleModel=0;
const suspensionVisuals=new WeakMap();
function visualPose(c){let p=suspensionVisuals.get(c);if(!p||p.model!==carSpec(c).kind){p={model:carSpec(c).kind,wheels:carSpec(c).wheels.map(()=>carSpec(c).mount),bob:0,lastVY:c.vy,lastVX:c.vx};suspensionVisuals.set(c,p)}return p}
function animateSuspension(dt){if(mode!=='race'||paused||count>0)return;for(const c of cars){if(!c.alive)continue;const v=carSpec(c),wheels=wheelSpecs(v),p=visualPose(c),cos=Math.cos(c.a),sin=Math.sin(c.a);for(let j=0;j<wheels.length;j++){const {x:rx,r}=wheels[j],contact=c.contacts.find(w=>w.rx===rx);let target=v.mount+v.travel;if(contact&&cos>.45){const wx=c.x+rx*cos-v.mount*sin;target=(terrain(wx)-r-c.y-rx*sin)/cos;target=Math.max(v.mount-v.travel,Math.min(v.mount+v.travel,target))}p.wheels[j]+=(target-p.wheels[j])*(1-Math.exp(-dt*(v.spring>110?25:14)))}const bump=Math.max(-3,Math.min(3,(c.vy-p.lastVY)*.055));p.bob+=(-bump-p.bob)*(1-Math.exp(-dt*12));p.lastVY=c.vy;p.lastVX=c.vx}}
function strokeLine(points,color,width){ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt'}
function spring(ax,ay,bx,by){strokeLine([[ax,ay],[bx,by]],'#26312d',5);strokeLine([[ax,ay],[bx,by]],'#a3aaa0',2);const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len,pts=[[ax,ay]];for(let j=1;j<10;j++){const k=j/10,offset=j%2?3:-3;pts.push([ax+dx*k+px*offset,ay+dy*k+py*offset])}pts.push([bx,by]);strokeLine(pts,'#e0cf8b',1.8)}
function seatedDriver(c,lift){
 const im=images[chosen[c.i]],mirror=[0,5].includes(chosen[c.i]);if(!im?.complete||!im.naturalWidth)return;
 const iw=im.naturalWidth,ih=im.naturalHeight;ctx.save();ctx.translate(-6,lift);ctx.imageSmoothingEnabled=true;
 // Head and torso have separate scales: a smaller head and a full visible upper body.
 ctx.save();if(mirror)ctx.scale(-1,1);ctx.drawImage(im,iw*.27,0,iw*.44,ih*.43,-14,-66,28,27);ctx.drawImage(im,iw*.18,ih*.41,iw*.64,ih*.31,-20,-40,40,44);ctx.restore();
 ctx.restore();
}
