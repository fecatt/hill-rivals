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
