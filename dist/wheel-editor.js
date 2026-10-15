'use strict';
(()=>{
 const openButton=document.createElement('button');openButton.id='wheel-editor-open';openButton.type='button';openButton.textContent='Расставить колёса';
 document.querySelector('.vehicle-setting').append(openButton);
 const dialog=document.createElement('dialog');dialog.id='wheel-editor';
 dialog.innerHTML=`<div class="wheel-editor-head"><h2>Расстановка колёс</h2><button type="button" id="wheel-editor-close" aria-label="Закрыть редактор">×</button></div>
 <p>Перетаскивай колёса мышью или пальцем. Кузов остаётся на месте. Настройка меняет только внешний вид.</p>
 <label>Машина <select id="wheel-editor-car"></select></label>
 <canvas id="wheel-editor-preview" width="1000" height="480" aria-label="Предпросмотр машины. Колёса можно перетаскивать."></canvas>
 <label>Колесо / ось <select id="wheel-editor-axle"></select></label>
 <div class="wheel-editor-fields">
 <label>Влево / вправо <input id="wheel-editor-x" type="number" min="-35" max="35" step="0.1"></label>
 <label>Вверх / вниз <input id="wheel-editor-y" type="number" min="-35" max="35" step="0.1"></label>
 <label>Размер, % <input id="wheel-editor-scale" type="number" min="40" max="180" step="1"></label></div>
 <p id="wheel-editor-status" role="status" aria-live="polite">Сохраняется в этом браузере. Для общей версии игры скачай файл и отправь его в чат.</p>
 <div class="wheel-editor-actions"><button type="button" id="wheel-editor-save">Сохранить</button><button type="button" id="wheel-editor-export">Скачать настройки всех машин</button><button type="button" id="wheel-editor-reset">Сбросить эту машину</button></div>`;
 document.body.append(dialog);
 const find=id=>dialog.querySelector('#wheel-editor-'+id),preview=find('preview'),paint=preview.getContext('2d');
 const carSelect=find('car'),axleSelect=find('axle'),status=find('status');
 for(const [i,v] of VEHICLES.entries())carSelect.add(new Option(v.name,String(i)));
 let drafts={},model=0,selected=0,transform,drag=null;
 const spec=()=>VEHICLES[model],layout=()=>drafts[spec().kind];
 const wheelName=(i,n)=>n===2?(i===0?'Задние колёса':'Передние колёса'):'Ось '+(i+1)+' (слева направо)';
 function fields(){const w=layout()[selected];for(const key of ['x','y','scale'])find(key).value=key==='scale'?Math.round(w.scale*100):Math.round(w[key]*10)/10;axleSelect.value=String(selected);}
 function chooseCar(){model=+carSelect.value;selected=0;axleSelect.replaceChildren();spec().wheels.forEach((_,i)=>axleSelect.add(new Option(wheelName(i,spec().wheels.length),String(i))));fields();draw();}
 function draw(){
  const v=spec(),wheels=wheelSpecs(v),span=v.wheels.at(-1)-v.wheels[0];
  const z=Math.min(4.5,850/(span+140));transform={z,x:500-(v.wheels[0]+v.wheels.at(-1))/2*z,y:290};
  paint.setTransform(1,0,0,1,0,0);paint.fillStyle='#eaf0e4';paint.fillRect(0,0,1000,480);
  paint.strokeStyle='#ccd7c5';paint.lineWidth=1;for(let x=0;x<=1000;x+=40){paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,480);paint.stroke();}for(let y=0;y<=480;y+=40){paint.beginPath();paint.moveTo(0,y);paint.lineTo(1000,y);paint.stroke();}
  paint.save();paint.translate(transform.x,transform.y);paint.scale(z,z);
  for(const [i,wheel] of wheels.entries()){
   const w=layout()[i],r=wheel.r*w.scale;paint.save();paint.translate(wheel.x+w.x,v.mount+w.y);
   paint.fillStyle='#182b36';paint.beginPath();paint.arc(0,0,r,0,Math.PI*2);paint.fill();paint.fillStyle='#b8cbd3';paint.beginPath();paint.arc(0,0,r*.62,0,Math.PI*2);paint.fill();paint.fillStyle='#607b8e';paint.beginPath();paint.arc(0,0,r*.4,0,Math.PI*2);paint.fill();paint.restore();
  }
  const car={model,i:0,vx:0,vy:0,a:0,contacts:[],emptyCabin:true};
  paint.save();paint.scale(v.bodyScale,1);vehicleBody(car,v,0,paint);paint.restore();
  for(const [i,wheel] of wheels.entries()){
   const w=layout()[i],x=wheel.x+w.x,y=v.mount+w.y,r=wheel.r*w.scale;
   paint.strokeStyle=i===selected?'#df572e':'#3c7456';paint.lineWidth=(i===selected?3:1.5)/z;paint.setLineDash([5/z,4/z]);paint.beginPath();paint.arc(x,y,r+2/z,0,Math.PI*2);paint.stroke();paint.setLineDash([]);
   paint.beginPath();paint.moveTo(x-4/z,y);paint.lineTo(x+4/z,y);paint.moveTo(x,y-4/z);paint.lineTo(x,y+4/z);paint.stroke();
  }
  paint.restore();
 }
 function point(e){const r=preview.getBoundingClientRect();return {x:((e.clientX-r.left)*1000/r.width-transform.x)/transform.z,y:((e.clientY-r.top)*480/r.height-transform.y)/transform.z};}
 preview.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;const p=point(e),v=spec(),wheels=wheelSpecs(v);let hit=-1,distance=Infinity;
  wheels.forEach((wheel,i)=>{const w=layout()[i],d=Math.hypot(p.x-wheel.x-w.x,p.y-v.mount-w.y);if(d<=Math.max(wheel.r*w.scale,12)&&d<distance){hit=i;distance=d;}});
  if(hit<0)return;selected=hit;const w=layout()[selected];drag={id:e.pointerId,x:p.x,y:p.y,oldX:w.x,oldY:w.y};preview.setPointerCapture(e.pointerId);fields();draw();e.preventDefault();
 });
 preview.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=point(e),v=spec(),raw=layout().map(w=>({...w}));raw[selected].x=drag.oldX+p.x-drag.x;raw[selected].y=drag.oldY+p.y-drag.y;drafts[v.kind]=validWheelAlignment(v,raw);fields();draw();status.textContent='Есть несохранённые изменения.';});
 const end=e=>{if(drag?.id!==e.pointerId)return;drag=null;if(preview.hasPointerCapture(e.pointerId))preview.releasePointerCapture(e.pointerId);};
 preview.addEventListener('pointerup',end);preview.addEventListener('pointercancel',end);preview.addEventListener('lostpointercapture',()=>drag=null);
 for(const key of ['x','y','scale'])find(key).addEventListener('input',()=>{if(find(key).value==='')return;const n=Number(find(key).value);if(!Number.isFinite(n))return;const raw=layout().map(w=>({...w}));raw[selected][key]=key==='scale'?n/100:n;drafts[spec().kind]=validWheelAlignment(spec(),raw);draw();status.textContent='Есть несохранённые изменения.';});
 for(const key of ['x','y','scale'])find(key).addEventListener('change',fields);
 carSelect.onchange=chooseCar;axleSelect.onchange=()=>{selected=+axleSelect.value;fields();draw();};
 find('reset').onclick=()=>{drafts[spec().kind]=validWheelAlignment(spec(),DEFAULT_WHEEL_ALIGNMENTS[spec().kind]);fields();draw();status.textContent='Исходное положение восстановлено. Нажми «Сохранить», чтобы применить.';};
 find('save').onclick=()=>{if(saveAllWheelAlignments(drafts)){status.textContent='Все настройки сохранены и применены. Чтобы я внёс их в общую игру, скачай файл и отправь в чат.';}else{status.textContent='Браузер не разрешил сохранение. Скачай файл, чтобы не потерять настройки.';}};
 find('export').onclick=()=>{
  const payload=exportWheelAlignments(drafts),blob=new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='hill-rivals-wheel-settings.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Файл содержит настройки всех '+VEHICLES.length+' машин, включая текущие правки. Отправь его в чат — я применю их для всех игроков.';
 };
 find('close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{drag=null;openButton.focus();});
 openButton.onclick=e=>{e.preventDefault();drafts=Object.fromEntries(VEHICLES.map(v=>[v.kind,validWheelAlignment(v,wheelAlignments[v.kind])]));carSelect.value=$('#vehicle').value;chooseCar();status.textContent='Сохраняется в этом браузере. Скачай настройки всех машин и отправь файл в чат для общей версии игры.';dialog.showModal();};
 window.addEventListener('keydown',e=>{if(dialog.open){e.stopImmediatePropagation();}} ,true);
 window.addEventListener('keyup',e=>{if(dialog.open)e.stopImmediatePropagation();},true);
})();
