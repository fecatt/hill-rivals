'use strict';
// Game-style choices keep the existing values and change handlers as their model.
const choiceControls=new Map();
function mountChoiceControls(){
 for(const select of document.querySelectorAll('#lobby select')){
  if(choiceControls.has(select))continue;
  select.classList.add('choice-model');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  if(select.id==='my-ability'||select.dataset.ability!==undefined||select.id==='players'){
   const group=document.createElement('div');group.className='choice-tiles';group.setAttribute('role','group');
   const icons={turbo:'ϟ',jump:'↟',shield:'◇'};
   for(const option of select.options){const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.innerHTML=select.id==='players'?option.value:'<span aria-hidden="true">'+icons[option.value]+'</span><small>'+option.textContent+'</small>';button.setAttribute('aria-label',option.textContent);button.onclick=()=>{if(select.disabled)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refreshChoices();};group.append(button);}
   select.after(group);choiceControls.set(select,{tiles:true,group,buttons:group.querySelectorAll('button')});continue;
  }
  const group=document.createElement('div');group.className='choice-switch';group.setAttribute('role','group');
  const title=select.id==='track'?'мир':select.id==='vehicle'?'машина':select.id==='players'?'число игроков':'способность';
  group.innerHTML=`<button type="button" class="choice-arrow" aria-label="Предыдущий вариант: ${title}">‹</button><span class="choice-value" aria-live="polite"></span><button type="button" class="choice-arrow" aria-label="Следующий вариант: ${title}">›</button>`;
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
 const v=VEHICLES[+$('#vehicle').value];
 if($('#car-specs').dataset.model!==String($('#vehicle').value)){$('#car-specs').dataset.model=$('#vehicle').value;$('#car-specs').innerHTML='<div><dt>Скорость</dt><dd>'+Math.round(speedKph(v.maxSpeed))+' км/ч</dd></div><div><dt>Масса</dt><dd>'+v.mass+' кг</dd></div><div><dt>Колёса</dt><dd>'+v.wheels.length*2+'</dd></div>';}
 $('#world-description').textContent=MAPS[+$('#track').value].description;
 const startParent=online&&$('#room-panel')?$('#room-panel'):$('.bottom');if($('#start').parentElement!==startParent)startParent.append($('#start'));
 if(online&&mode==='lobby'&&roomState?.room){$('#menu').hidden=true;if(window.cardTools.parentElement!==$('#room-options'))$('#room-options').append(window.cardTools);}
 else if(online&&mode==='race'){$('#menu').hidden=true;$('#pause').hidden=false;}
 else if(!online){if($('#menu').parentElement!==document.querySelector('nav'))document.querySelector('nav').append($('#menu'));$('#menu').hidden=true;$('#pause').hidden=mode!=='race';}
}
const settings=$('.bottom'),worldLabel=$('#track').closest('label'),vehicleLabel=$('#vehicle').closest('label');
worldLabel.classList.add('setting-card','world-setting');vehicleLabel.classList.add('setting-card','vehicle-setting');
worldLabel.firstChild.textContent='МИР';vehicleLabel.firstChild.textContent='МАШИНА';
const worldPreview=document.createElement('canvas');worldPreview.id='world-preview';worldPreview.width=640;worldPreview.height=220;worldLabel.insertBefore(worldPreview,$('#track'));
const vehiclePreview=document.createElement('canvas');vehiclePreview.id='vehicle-preview';vehiclePreview.width=640;vehiclePreview.height=220;vehicleLabel.insertBefore(vehiclePreview,$('#vehicle'));vehicleLabel.append($('#vehicle-description'));$('#map-description').hidden=true;
const racerColumn=document.createElement('section');racerColumn.id='racer-column';$('#picks').before(racerColumn);racerColumn.append($('#picks'));const abilityPanel=document.createElement('section');abilityPanel.id='ability-panel';racerColumn.append(abilityPanel);
 const worldDescription=document.createElement('p');worldDescription.id='world-description';worldLabel.append(worldDescription);
 const specs=document.createElement('dl');specs.id='car-specs';vehicleLabel.append(specs);
 let lastVehiclePreview='';
function renderSettingPreviews(){
 if(mode!=='lobby')return;
 const worldContext=worldPreview.getContext('2d'),sourceW=canvas.width*.4,sourceH=canvas.height*.3;
 worldContext.drawImage(canvas,(canvas.width-sourceW)*.5,canvas.height*.23,sourceW,sourceH,0,0,640,220);
 const v=VEHICLES[+$('#vehicle').value],im=paintedBodies[v.kind];if(!im?.complete||!im.naturalWidth)return;
 const stamp=v.kind+':'+im.naturalWidth;if(stamp===lastVehiclePreview)return;lastVehiclePreview=stamp;
 const preview=vehiclePreview.getContext('2d'),wheels=wheelSpecs(v),a=BODY_ANCHORS[v.kind],crop=BODY_BOUNDS[v.kind];
 const first=wheels[0].x,last=wheels.at(-1).x,unit=(last-first)/(a.axles.at(-1)-a.axles[0])*BODY_ART_SCALE;
 const length=last-first+((a.axles[0]-crop[0])+(crop[0]+crop[2]-a.axles.at(-1)))*unit,maxRadius=Math.max(...wheels.map(w=>w.r)),scale=Math.min(3.6,530/length,190/(maxRadius+(a.y-crop[1])*unit));
 preview.clearRect(0,0,640,220);preview.save();preview.translate(320,205-maxRadius*scale);preview.scale(scale,scale);
 for(const wheel of wheels){preview.fillStyle='#233b40';preview.beginPath();preview.arc(wheel.x,0,wheel.r,0,Math.PI*2);preview.fill();preview.fillStyle='#a5bbc0';preview.beginPath();preview.arc(wheel.x,0,wheel.r*.62,0,Math.PI*2);preview.fill();preview.fillStyle='#48626b';preview.beginPath();preview.arc(wheel.x,0,wheel.r*.32,0,Math.PI*2);preview.fill();}
 let strips;
 if(v.kind==='monster'){const s=a.axles;strips=[[crop[0],s[0],first-(s[0]-crop[0])*unit,first],[s[0],s[1],first,wheels[1].x],[s[0],s[1],wheels[1].x,wheels[2].x],[s[1],s[2],wheels[2].x,last],[s[2],crop[0]+crop[2],last,last+(crop[0]+crop[2]-s[2])*unit]];}
 else{const source=[crop[0],...a.axles,crop[0]+crop[2]],dest=[first-(a.axles[0]-crop[0])*unit,...wheels.map(w=>w.x),last+(crop[0]+crop[2]-a.axles.at(-1))*unit];strips=source.slice(0,-1).map((x,i)=>[x,source[i+1],dest[i],dest[i+1]]);}
 for(const [s1,s2,x1,x2] of strips)preview.drawImage(im,s1,crop[1],s2-s1,crop[3],x1,(crop[1]-a.y)*unit,x2-x1+.15,crop[3]*unit);
 preview.restore();
}
new MutationObserver(()=>refreshChoices()).observe($('#picks'),{childList:true,subtree:true});
window.refreshChoices=refreshChoices;window.renderSettingPreviews=renderSettingPreviews;refreshChoices();
