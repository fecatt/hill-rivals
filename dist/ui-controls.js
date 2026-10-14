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
  const drive=v.wheels.length*2+'×'+v.wheels.length*2;
  // The physics engine uses mass/900 and world units. Convert force × speed to metric hp.
  const forceNewtons=v.engine*900/WORLD_UNITS_PER_METRE,powerHp=Math.round(forceNewtons*worldMetres(v.maxSpeed)/735.5);
  const rows=[['Макс. скорость',Math.round(speedKph(v.maxSpeed))+' км/ч'],['Мощность',powerHp+' л.с.'],['Масса',v.mass+' кг'],['Привод',drive],['Колёса / оси',v.wheels.length*2+' / '+v.wheels.length],['Ход подвески',Math.round(worldMetres(v.travel*2)*100)+' см']];
  $('#car-specs').dataset.model=$('#vehicle').value;$('#car-specs').innerHTML=rows.map(([label,value])=>'<div'+(label==='Мощность'?' title="Расчётная игровая мощность на колёсах: сила тяги × максимальная скорость."':'')+'><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('');
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
 if(online&&mode==='lobby'&&roomState?.room){$('#menu').hidden=true;if(window.cardTools.parentElement!==$('#room-options'))$('#room-options').append(window.cardTools);}
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
