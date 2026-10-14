'use strict';
function createRoomsUI(){
 const browser=document.createElement('main');browser.id='room-browser';browser.hidden=true;
 browser.innerHTML=`<div class="eyebrow">ИГРА С ДРУЗЬЯМИ</div><h1>Онлайн-комнаты</h1><p class="intro">Создайте свою гонку или присоединитесь к друзьям.</p><div class="room-actions"><form id="join-code"><label for="room-code">Код комнаты</label><div><input id="room-code" maxlength="5" minlength="5" pattern="[A-Za-z]{5}" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" spellcheck="false" required aria-label="Код из пяти латинских букв"></div></form><button id="create-room" class="primary">СОЗДАТЬ КОМНАТУ <span>+</span></button></div><p id="directory-notice" role="status"></p><div class="room-columns"><section class="room-group"><h2>В вашей сети <span id="local-count">0</span></h2><p>Комнаты игроков рядом с вами.</p><div id="local-rooms" class="room-cards"></div></section><section class="room-group"><h2>Все комнаты <span id="global-count">0</span></h2><p>Все открытые комнаты, включая вашу сеть.</p><div id="global-rooms" class="room-cards"></div></section></div>`;
 $('#lobby').before(browser);$('#create-room').onclick=()=>send({type:'create-room'});
 let attemptedCode='';
 const tryCode=()=>{const field=$('#room-code'),code=field.value;if(code.length===5&&code!==attemptedCode){attemptedCode=code;field.classList.remove('code-error');field.removeAttribute('aria-invalid');$('#directory-notice').textContent='';send({type:'join-room',code});}};
 $('#room-code').oninput=e=>{e.target.value=e.target.value.replace(/[^a-z]/gi,'').toUpperCase();if(e.target.value.length<5)attemptedCode='';e.target.classList.remove('code-error');e.target.removeAttribute('aria-invalid');$('#directory-notice').textContent='';tryCode();};
 $('#join-code').onsubmit=e=>{e.preventDefault();attemptedCode='';tryCode();};
 const panel=$('#room-panel');
 panel.innerHTML=`<div class="room-heading"><h2 id="room-title"></h2><button id="rename-room" class="icon-button" title="Изменить название комнаты" aria-label="Изменить название комнаты"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z"/></svg></button><button id="copy-code" title="Скопировать код комнаты"></button></div><form id="rename-form" hidden><input id="room-name" maxlength="36" aria-label="Название комнаты" required><button>Сохранить</button><button type="button" id="cancel-rename">Отмена</button></form><div class="room-invite"><button id="copy-link">Скопировать ссылку</button><button id="show-qr">QR-код</button><span id="invite-status" role="status"></span></div><p id="host-caption"></p><div class="room-list"></div><p id="room-status"></p><p id="connection-status"></p><div id="room-chat"><h3>Чат комнаты</h3><div id="chat-log" role="log" aria-live="polite" hidden></div><form id="chat-form"><input id="chat-text" maxlength="300" placeholder="Написать сообщение…" aria-label="Сообщение в чат" autocomplete="off"><button aria-label="Отправить сообщение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 18-7-7 18-4-7Z"/><path d="m10 14 5-5"/></svg></button></form></div>`;
 $('#rename-room').onclick=()=>{$('#rename-form').hidden=false;$('#room-name').value=roomState.room.name;$('#room-name').focus();$('#room-name').select();};
 $('#cancel-rename').onclick=()=>$('#rename-form').hidden=true;
 $('#rename-form').onsubmit=e=>{e.preventDefault();const name=$('#room-name').value.trim();if(name){send({type:'rename-room',name});$('#rename-form').hidden=true;}};
 $('#chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chat-text').value.trim();if(text){send({type:'chat',text});$('#chat-text').value='';}};
 const sidebar=document.createElement('div');sidebar.id='room-sidebar';sidebar.append($('#copy-link'),$('#show-qr'));panel.append(sidebar);$('#copy-link').textContent='Ссылка';
 const settingsButton=document.createElement('button');settingsButton.id='room-settings';settingsButton.textContent='Настройки';sidebar.append(settingsButton);
 const options=document.createElement('div');options.id='room-options';options.hidden=true;panel.append(options);settingsButton.onclick=()=>{options.hidden=!options.hidden;settingsButton.setAttribute('aria-expanded',String(!options.hidden));};
 const chatToggle=document.createElement('button');chatToggle.id='room-chat-toggle';chatToggle.textContent='Открыть чат';panel.append(chatToggle);$('#room-chat').hidden=true;chatToggle.onclick=()=>{const open=$('#room-chat').hidden;$('#room-chat').hidden=!open;panel.classList.toggle('chat-open',open);chatToggle.textContent=open?'Показать игроков':'Открыть чат';chatToggle.setAttribute('aria-expanded',String(open));if(open)$('#chat-text').focus();};
 const invitation=()=>{const url=new URL(location.href);url.search='';url.searchParams.set('mode','online');url.searchParams.set('room',roomState.room.code);return url.href;};
 const shareDialog=document.createElement('dialog');shareDialog.id='invite-dialog';shareDialog.innerHTML='<button id="close-invite" class="dialog-close" aria-label="Закрыть приглашение">Закрыть ×</button><h2>Пригласить в комнату</h2><div id="invite-qr" role="img" aria-label="QR-код для подключения к комнате"></div><p>Откройте камеру телефона и наведите её на код.</p><input id="invite-url" readonly aria-label="Ссылка на комнату"><button id="copy-invite-link">Скопировать ссылку</button>';document.body.append(shareDialog);
 const copy=async(value,label)=>{try{await navigator.clipboard.writeText(value);$('#invite-status').textContent=label;}catch{$('#invite-url').value=value;if(!shareDialog.open)shareDialog.showModal();$('#invite-url').focus();$('#invite-url').select();$('#invite-status').textContent='Выделите и скопируйте ссылку.';}};
 $('#copy-code').onclick=()=>copy(roomState.room.code,'Код скопирован');$('#copy-link').onclick=()=>copy(invitation(),'Ссылка скопирована');
 $('#close-invite').onclick=()=>shareDialog.close();$('#copy-invite-link').onclick=()=>copy(invitation(),'Ссылка скопирована');
 $('#show-qr').onclick=()=>{const url=invitation(),qr=qrcode(0,'M');qr.addData(url);qr.make();$('#invite-qr').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true});$('#invite-url').value=url;shareDialog.showModal();};
 let messages=[];
 const list=(target,rooms)=>{
  target.replaceChildren();
  if(!rooms.length){const empty=document.createElement('p');empty.className='empty-rooms';empty.textContent=target.id==='local-rooms'?'Пока нет комнат в вашей сети. Создайте первую.':'Пока нет открытых комнат. Начните свою гонку.';target.append(empty);return;}
  for(const room of rooms){const card=document.createElement('button');card.className='room-card';card.disabled=room.count>=room.capacity;const title=document.createElement('b');title.textContent=room.name;const details=document.createElement('span');details.textContent=room.code+' · '+room.count+'/'+room.capacity+' игроков · '+({lobby:'Ожидание',countdown:'Скоро старт',race:'Идёт гонка',result:'Результаты'}[room.phase]||'Ожидание');const map=document.createElement('small');map.textContent=MAPS[room.track].name+' · '+VEHICLES[room.vehicle].name;card.append(title,details,map);card.onclick=()=>send({type:'join-room',code:room.code});target.append(card);}
 };
 return {
  browser,
  directory(state){
   roomState=null;mode='lobby';snapshots=[];onlineRound=-1;localCar=null;window.onlineIndex=undefined;window.racerNames=[];
   $('#lobby').hidden=true;browser.hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;if(window.cardTools)browser.append(window.cardTools);
   const local=state.rooms.filter(room=>room.local);list($('#local-rooms'),local);list($('#global-rooms'),state.rooms);$('#local-count').textContent=local.length;$('#global-count').textContent=state.rooms.length;
   onlineBar.textContent='На сайте: '+state.online+' · Комнат: '+state.rooms.length;if(!$('#room-code').hasAttribute('aria-invalid'))$('#directory-notice').textContent='';$('#menu').hidden=true;
   messages=[];$('#chat-log').replaceChildren();$('#chat-log').hidden=true;$('#rename-form').hidden=true;shareDialog.close();window.peerTransport?.reset();
  },
  state(state){
   browser.hidden=true;$('#menu').hidden=false;$('#menu').textContent='Выйти из комнаты';if(window.cardTools)$('#lobby').append(window.cardTools);
   $('#room-title').textContent=state.room.name;$('#copy-code').textContent=state.room.code+' ⧉';$('#rename-room').hidden=state.room.host!==state.you;$('#rename-room').disabled=!['lobby','result'].includes(state.phase);if(state.room.host!==state.you)$('#rename-form').hidden=true;
   const me=state.players.find(p=>p.id===state.you),field=$('#player-name');if(field&&document.activeElement!==field)field.value=me?.name||'';
   $('#host-caption').textContent=state.room.host===state.you?'Вы ведущий · выбирайте трассу и машину.':'Трассу и машину выбирает ведущий.';
   $('#lobby h1').textContent='Комната '+state.room.code;$('#lobby .eyebrow').textContent='ГОТОВИМСЯ К ГОНКЕ';$('#lobby .intro').textContent='Выберите персонажа и нажмите «Готово». После готовности всех — старт через 3 секунды.';window.refreshChoices?.();
   const url=new URL(location.href);url.searchParams.set('room',state.room.code);history.replaceState({},'',url);
  },
  chat(incoming){
   if(JSON.stringify(messages)===JSON.stringify(incoming))return;messages=incoming;const log=$('#chat-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;log.replaceChildren();log.hidden=!messages.length;
   for(const message of messages){const line=document.createElement('p'),author=document.createElement('b');author.textContent=(message.name||'Игрок')+' · ';line.append(author,document.createTextNode(message.text));log.append(line);}if(atBottom)log.scrollTop=log.scrollHeight;
  },
  notice(text){$('#directory-notice').textContent=text;const field=$('#room-code');field.classList.remove('code-error');void field.offsetWidth;field.classList.add('code-error');field.setAttribute('aria-invalid','true');},
  hide(){browser.hidden=true;shareDialog.close();options.hidden=true;$('#room-chat').hidden=true;panel.classList.remove('chat-open');chatToggle.textContent='Открыть чат';},
 };
}
