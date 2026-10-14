'use strict';
function createRoomsUI(){
 const browser=document.createElement('main');browser.id='room-browser';browser.hidden=true;
 browser.innerHTML=`<div class="eyebrow">ИГРА С ДРУЗЬЯМИ</div><h1>Онлайн-комнаты</h1><p class="intro">Создайте свою гонку или присоединитесь к друзьям.</p>
 <div class="room-actions"><form id="join-code"><label for="room-code">Код комнаты</label><div><input id="room-code" maxlength="5" minlength="5" pattern="[A-Za-z]{5}" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" spellcheck="false" required aria-label="Код из пяти латинских букв"><button>Войти →</button></div></form><button id="create-room" class="primary">СОЗДАТЬ КОМНАТУ <span>+</span></button></div>
 <p id="directory-notice" role="status"></p><div class="room-columns"><section class="room-group"><h2>В вашей сети <span id="local-count">0</span></h2><p>Комнаты игроков рядом с вами.</p><div id="local-rooms" class="room-cards"></div></section><section class="room-group"><h2>Все комнаты <span id="global-count">0</span></h2><p>Все открытые комнаты, включая вашу сеть.</p><div id="global-rooms" class="room-cards"></div></section></div>`;
 $('#lobby').before(browser);
 const createDialog=document.createElement('dialog');createDialog.id='create-dialog';
 createDialog.innerHTML='<form id="create-form"><h2>Новая комната</h2><label for="room-name">Название</label><input id="room-name" maxlength="36" placeholder="Гонка с друзьями" autocomplete="off"><p>Вы будете ведущим и сможете выбрать трассу и машину.</p><div class="dialog-actions"><button type="button" id="cancel-create">Отмена</button><button class="primary">СОЗДАТЬ</button></div></form>';
 document.body.append(createDialog);
 $('#create-room').onclick=()=>createDialog.showModal();$('#cancel-create').onclick=()=>createDialog.close();
 $('#create-form').onsubmit=e=>{e.preventDefault();send({type:'create-room',name:$('#room-name').value});createDialog.close();};
 $('#room-code').oninput=e=>e.target.value=e.target.value.replace(/[^a-z]/gi,'').toUpperCase();
 $('#join-code').onsubmit=e=>{e.preventDefault();send({type:'join-room',code:$('#room-code').value});};
 const panel=$('#room-panel');
 panel.innerHTML='<div class="room-heading"><h2 id="room-title"></h2><button id="copy-code" title="Скопировать код комнаты"></button></div><p id="host-caption"></p><div class="room-list"></div><p id="room-status"></p><p id="connection-status"></p><div id="room-chat"><h3>Чат комнаты</h3><div id="chat-log" role="log" aria-live="polite"></div><form id="chat-form"><input id="chat-text" maxlength="300" placeholder="Написать сообщение…" aria-label="Сообщение в чат" autocomplete="off"><button aria-label="Отправить сообщение">→</button></form></div>';
 $('#chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chat-text').value.trim();if(text){send({type:'chat',text});$('#chat-text').value='';}};
 const chatArea=$('#room-chat'),chatDialog=document.createElement('dialog');chatDialog.id='chat-dialog';chatDialog.innerHTML='<button id="close-chat" aria-label="Закрыть чат">Закрыть ×</button>';document.body.append(chatDialog);
 const chatButton=document.createElement('button');chatButton.id='chat-toggle';chatButton.textContent='Чат';chatButton.hidden=true;document.querySelector('nav').append(chatButton);
 chatButton.onclick=()=>{keysClear();chatDialog.append(chatArea);chatDialog.showModal();};$('#close-chat').onclick=()=>chatDialog.close();chatDialog.onclose=()=>panel.append(chatArea);
 $('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(roomState.room.code);$('#copy-code').textContent='Код скопирован';setTimeout(()=>{if(roomState)$('#copy-code').textContent=roomState.room.code+' ⧉';},1500);}catch{$('#copy-code').textContent=roomState.room.code;}};
 let messages=[];
 const list=(target,rooms)=>{
  target.replaceChildren();
  if(!rooms.length){const empty=document.createElement('p');empty.className='empty-rooms';empty.textContent=target.id==='local-rooms'?'Пока нет комнат в вашей сети. Создайте первую.':'Пока нет открытых комнат. Начните свою гонку.';target.append(empty);return;}
  for(const room of rooms){
   const card=document.createElement('button');card.className='room-card';card.disabled=room.count>=room.capacity;
   const title=document.createElement('b');title.textContent=room.name;
   const details=document.createElement('span');details.textContent=room.code+' · '+room.count+'/'+room.capacity+' игроков · '+({lobby:'Ожидание',countdown:'Скоро старт',race:'Идёт гонка',result:'Результаты'}[room.phase]||'Ожидание');
   const map=document.createElement('small');map.textContent=MAPS[room.track].name+' · '+VEHICLES[room.vehicle].name;
   card.append(title,details,map);card.onclick=()=>send({type:'join-room',code:room.code});target.append(card);
  }
 };
 return {
  browser,
  directory(state){
   roomState=null;mode='lobby';snapshots=[];onlineRound=-1;localCar=null;window.onlineIndex=undefined;
   $('#lobby').hidden=true;browser.hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;
   const local=state.rooms.filter(room=>room.local);list($('#local-rooms'),local);list($('#global-rooms'),state.rooms);
   $('#local-count').textContent=local.length;$('#global-count').textContent=state.rooms.length;
   onlineBar.textContent='На сайте: '+state.online+' · Комнат: '+state.rooms.length;
   $('#directory-notice').textContent='';$('#menu').hidden=true;
   chatButton.hidden=true;chatDialog.close();
   window.peerTransport?.reset();
  },
  state(state){
   browser.hidden=true;$('#menu').hidden=false;
   chatButton.hidden=false;
   $('#room-title').textContent=state.room.name;$('#copy-code').textContent=state.room.code+' ⧉';
   $('#host-caption').textContent=state.room.host===state.you?'Вы ведущий · выбирайте трассу и машину.':'Трассу и машину выбирает ведущий.';
   $('#lobby h1').textContent='Комната '+state.room.code;
   $('#lobby .eyebrow').textContent='ГОТОВИМСЯ К ГОНКЕ';
   $('#lobby .intro').textContent='Выберите персонажа и нажмите «Готово». После готовности всех — старт через 10 секунд.';
  },
  chat(incoming){
   if(JSON.stringify(messages)===JSON.stringify(incoming))return;messages=incoming;
   const log=$('#chat-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;
   log.replaceChildren();
   for(const message of messages){const line=document.createElement('p'),author=document.createElement('b');author.textContent=(message.from===roomState?.you?'Вы':names[message.character])+' · ';line.append(author,document.createTextNode(message.text));log.append(line);}
   if(atBottom)log.scrollTop=log.scrollHeight;
  },
  notice(text){$('#directory-notice').textContent=text;},
  hide(){browser.hidden=true;createDialog.close();chatDialog.close();chatButton.hidden=true;},
 };
}
