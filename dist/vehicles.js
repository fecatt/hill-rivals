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

function drivenAxles(v){return v.driveAxles??v.wheels.map((_,i)=>i)}
function driveLabel(v){const axles=drivenAxles(v);return v.wheels.length*2+'×'+axles.length*2+(axles.length===1?(axles[0]===0?' · задний':' · передний'):' · полный')}
function vehicleStats(v){return [['Макс. скорость',Math.round(speedKph(v.maxSpeed))+' км/ч'],['Мощность',v.powerHp?v.powerHp+' л.с.':'Не задана'],['Масса',v.mass+' кг'],['Привод',driveLabel(v)],['Колёса / оси',v.wheels.length*2+' / '+v.wheels.length],['Характеристики',v.specLabel??(v.specSource?'ГАЗель NEXT · заводские':'Игровая модель')]]}
function carSpec(c){return VEHICLES[c.model??vehicleModel]}
function baseWheelSpecs(v){return v.wheels.map((x,i)=>({x,y:v.mount,r:v.wheelRadii?.[i]??v.radius}))}
function wheelSpecs(v){return baseWheelSpecs(v).map((w,i)=>{const a=typeof wheelAppearance==='function'?wheelAppearance(v,i):{x:0,y:0,scale:1};return {x:w.x+a.x,y:w.y+a.y,r:w.r*a.scale}})}
function inertia(v){const xs=wheelSpecs(v).map(w=>w.x),span=Math.max(10,Math.max(...xs)-Math.min(...xs));return 1120*(v.mass/900)*(span/62)**2}
function describeVehicle(){const v=VEHICLES[+$('#vehicle').value];$('#vehicle-description').textContent=v.description+(v.specSource?'':' Характеристики условные: точный серийный прототип не задан.');$('#vehicle-stats').textContent=vehicleStats(v).map(([label,value])=>label+': '+value).join(' · ')}
let vehicleModel=0;
const suspensionVisuals=new WeakMap();
function visualPose(c){const wheels=wheelSpecs(carSpec(c)),key=carSpec(c).kind+JSON.stringify(wheels);let p=suspensionVisuals.get(c);if(!p||p.model!==key){p={model:key,wheels:wheels.map(w=>w.y),bob:0,lastVY:c.vy,lastVX:c.vx};suspensionVisuals.set(c,p)}return p}
function animateSuspension(dt){if(mode!=='race'||paused||count>0)return;for(const c of cars){if(!c.alive)continue;const v=carSpec(c),wheels=wheelSpecs(v),p=visualPose(c),cos=Math.cos(c.a),sin=Math.sin(c.a);for(let j=0;j<wheels.length;j++){const {x:rx,y:mount,r}=wheels[j],contact=c.contacts.find(w=>w.rx===rx);let target=mount+v.travel;if(contact&&cos>.45){const wx=c.x+rx*cos-mount*sin;target=(terrain(wx)-r-c.y-rx*sin)/cos;target=Math.max(mount-v.travel,Math.min(mount+v.travel,target))}p.wheels[j]+=(target-p.wheels[j])*(1-Math.exp(-dt*(v.spring>110?25:14)))}const bump=Math.max(-3,Math.min(3,(c.vy-p.lastVY)*.055));p.bob+=(-bump-p.bob)*(1-Math.exp(-dt*12));p.lastVY=c.vy;p.lastVX=c.vx}}
function strokeLine(points,color,width){ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt'}
function spring(ax,ay,bx,by){strokeLine([[ax,ay],[bx,by]],'#26312d',5);strokeLine([[ax,ay],[bx,by]],'#a3aaa0',2);const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len,pts=[[ax,ay]];for(let j=1;j<10;j++){const k=j/10,offset=j%2?3:-3;pts.push([ax+dx*k+px*offset,ay+dy*k+py*offset])}pts.push([bx,by]);strokeLine(pts,'#e0cf8b',1.8)}
function seatedDriver(c,lift){
 const im=images[chosen[c.i]],mirror=[0,5].includes(chosen[c.i]);if(!im?.complete||!im.naturalWidth)return;
 const iw=im.naturalWidth,ih=im.naturalHeight;ctx.save();ctx.translate(-6,lift);ctx.imageSmoothingEnabled=true;
 // Head and torso have separate scales: a smaller head and a full visible upper body.
 ctx.save();if(mirror)ctx.scale(-1,1);ctx.drawImage(im,iw*.27,0,iw*.44,ih*.43,-14,-66,28,27);ctx.drawImage(im,iw*.18,ih*.41,iw*.64,ih*.31,-20,-40,40,44);ctx.restore();
 ctx.restore();
}
