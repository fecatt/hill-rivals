'use strict';
function createRoomsUI(){
 const browser=document.createElement('section');browser.id='room-browser';browser.className='room-connect';
 browser.innerHTML=`<form id="join-code"><label for="room-code">Подключиться к онлайн-комнате</label><div><input id="room-code" maxlength="5" minlength="5" pattern="[A-Za-z]{5}" placeholder="КОД ИЗ 5 БУКВ" autocomplete="off" autocapitalize="characters" spellcheck="false" required aria-label="Код комнаты из пяти латинских букв"></div></form><p id="directory-notice" role="status">Вы в своей комнате. Введите код другой комнаты, чтобы присоединиться.</p>`;
 let attemptedCode='';
 const tryCode=()=>{const field=$('#room-code'),code=field.value;if(code.length===5&&code!==attemptedCode){attemptedCode=code;field.classList.remove('code-error');field.removeAttribute('aria-invalid');$('#directory-notice').textContent='';send({type:'join-room',code});}};
 browser.querySelector('#room-code').oninput=e=>{e.target.value=e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,5);if(e.target.value.length<5)attemptedCode='';e.target.classList.remove('code-error');e.target.removeAttribute('aria-invalid');$('#directory-notice').classList.remove('code-error');$('#directory-notice').textContent='';tryCode();};
 browser.querySelector('#join-code').noValidate=true;browser.querySelector('#join-code').onsubmit=e=>{e.preventDefault();if($('#room-code').value.length!==5){roomUI.notice('Введите пять латинских букв.');return;}attemptedCode='';tryCode();};
 const panel=$('#room-panel');
 panel.innerHTML=`<div class="room-heading"><h2 id="room-title"></h2><button id="rename-room" class="icon-button" title="Изменить название комнаты" aria-label="Изменить название комнаты"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z"/></svg></button><button id="copy-code" title="Скопировать код комнаты"></button></div><form id="rename-form" hidden><input id="room-name" maxlength="36" aria-label="Название комнаты" required><button>Сохранить</button><button type="button" id="cancel-rename">Отмена</button></form><div class="room-invite"><button id="copy-link">Скопировать ссылку</button><button id="show-qr">QR-код</button><span id="invite-status" role="status"></span></div><p id="host-caption"></p><div class="room-list"></div><div class="room-party-controls"><button id="add-local-racer" type="button">＋ Добавить игрока на этом устройстве</button><button id="remove-local-racer" type="button" aria-label="Убрать последнего игрока">−</button></div><p id="room-status"></p><p id="connection-status"></p><div id="room-chat"><h3>Чат комнаты</h3><div id="chat-log" role="log" aria-live="polite"></div><form id="chat-form"><input id="chat-text" maxlength="300" placeholder="Написать сообщение…" aria-label="Сообщение в чат" autocomplete="off"><button aria-label="Отправить сообщение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 18-7-7 18-4-7Z"/><path d="m10 14 5-5"/></svg></button></form></div>`;
 $('#room-title').textContent='Ваша комната';$('#room-status').textContent='Подключение…';
 $('#add-local-racer').onclick=()=>window.changeOnlineParty?.(1);$('#remove-local-racer').onclick=()=>window.changeOnlineParty?.(-1);
 $('#rename-room').onclick=()=>{$('#rename-form').hidden=false;$('#room-name').value=roomState.room.name;$('#room-name').focus();$('#room-name').select();};
 $('#cancel-rename').onclick=()=>$('#rename-form').hidden=true;
 $('#rename-form').onsubmit=e=>{e.preventDefault();const name=$('#room-name').value.trim();if(name){send({type:'rename-room',name});$('#rename-form').hidden=true;}};
 $('#chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chat-text').value.trim();if(text){send({type:'chat',text});$('#chat-text').value='';$('#chat-text').focus();}};
 const chatDialog=document.createElement('dialog');chatDialog.id='chat-dialog';chatDialog.innerHTML='<button id="close-chat" type="button" aria-label="Закрыть чат">×</button>';document.body.append(chatDialog);chatDialog.append($('#room-chat'));$('#room-chat h3').remove();setupGameDrawer(chatDialog,'Чат комнаты',$('#close-chat'));
 const networkDialog=document.createElement('dialog');networkDialog.id='network-dialog';networkDialog.innerHTML='<button id="close-network" type="button" aria-label="Закрыть список игроков">×</button><h2>Игроки в сети</h2><p id="network-summary">Ищем игроков…</p><div id="network-room-list" role="list"></div>';document.body.append(networkDialog);setupGameDrawer(networkDialog,'Игроки в сети',$('#close-network'));
 const chatLog=$('#chat-log'),chatInput=$('#chat-text');chatInput.setAttribute('enterkeyhint','send');
 const syncChatViewport=()=>{const viewport=window.visualViewport;if(viewport){chatDialog.style.setProperty('--chat-viewport-top',viewport.offsetTop+'px');chatDialog.style.setProperty('--chat-viewport-height',viewport.height+'px');}};
 syncChatViewport();window.visualViewport?.addEventListener('resize',syncChatViewport);window.visualViewport?.addEventListener('scroll',syncChatViewport);
 let unreadCount=0,lastChatId=0,activeRoomCode='';
 const setUnread=()=>{const badge=$('#chat-unread');badge.textContent=unreadCount>99?'99+':String(unreadCount);badge.hidden=!unreadCount;chatToggle.setAttribute('aria-label',unreadCount?'Чат, непрочитанных сообщений: '+unreadCount:'Открыть чат');};
 const markChatRead=()=>{unreadCount=0;lastChatId=Math.max(lastChatId,...messages.map(message=>message.id||0));setUnread();};
 const closeChat=()=>chatDialog.close();
 $('#close-chat').onclick=closeChat;
 const closeNetwork=()=>networkDialog.close();$('#close-network').onclick=closeNetwork;
 const sidebar=document.createElement('div');sidebar.id='room-sidebar';sidebar.append($('#copy-link'),$('#show-qr'),panel.querySelector('.room-party-controls'));panel.append(sidebar);$('#copy-link').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1l-1.4 1.4"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1l1.4-1.4"/></svg>';$('#copy-link').title='Скопировать ссылку';$('#copy-link').setAttribute('aria-label','Скопировать ссылку');
 $('#show-qr').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/></svg>';$('#show-qr').title='Показать QR-код';$('#show-qr').setAttribute('aria-label','Показать QR-код');
 panel.append(browser);
 const settingsButton=document.createElement('button');settingsButton.id='room-settings';settingsButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></svg>';settingsButton.title='Настройки';settingsButton.setAttribute('aria-label','Настройки');sidebar.append(settingsButton);
 const options=document.createElement('dialog');options.id='room-options';options.innerHTML='<button id="close-settings" type="button" aria-label="Закрыть настройки">×</button>';document.body.append(options);setupGameDrawer(options,'Настройки',$('#close-settings'));settingsButton.onclick=()=>{if(options.open)options.close();else options.showModal();settingsButton.setAttribute('aria-expanded',String(options.open));};
 const networkToggle=document.createElement('button');networkToggle.id='network-toggle';networkToggle.type='button';networkToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/></svg>';networkToggle.setAttribute('aria-label','Найти в сети');networkToggle.title='Найти в сети';browser.querySelector('#join-code>div').append(networkToggle);networkToggle.onclick=()=>{if(chatDialog.open)chatDialog.close();networkDialog.showModal();send({type:'directory'});};
 const chatToggle=document.createElement('button');chatToggle.id='room-chat-toggle';chatToggle.type='button';chatToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-7.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg><span id="chat-unread" class="chat-unread" hidden></span>';chatToggle.setAttribute('aria-label','Открыть чат');chatToggle.title='Открыть чат';sidebar.append(chatToggle);chatToggle.onclick=()=>{if(chatDialog.open){chatDialog.close();return;}if(networkDialog.open)networkDialog.close();chatDialog.showModal();markChatRead();syncChatViewport();requestAnimationFrame(()=>chatInput.focus());};
 for(const [id,icon] of Object.entries({'network-toggle':'globe','room-chat-toggle':'chat','room-settings':'settings','copy-link':'link','show-qr':'qr','rename-room':'pencil'})){const button=$('#'+id);if(id==='room-chat-toggle'){button.querySelector('svg').outerHTML=menuIcon(icon);}else button.innerHTML=menuIcon(icon);}
 sidebar.prepend(chatToggle);
 const invitation=()=>{const url=new URL(location.href);url.search='';url.searchParams.set('mode','online');url.searchParams.set('room',roomState.room.code);return url.href;};
 document.addEventListener('pointerdown',e=>{if(options.open&&e.target.closest('#close-settings'))settingsButton.setAttribute('aria-expanded','false');});
 const shareDialog=document.createElement('dialog');shareDialog.id='invite-dialog';shareDialog.innerHTML='<button id="close-invite" type="button" aria-label="Закрыть QR-код">×</button><div id="invite-qr" role="img" aria-label="QR-код подключения к комнате"></div>';document.body.append(shareDialog);setupGameDrawer(shareDialog,'QR-код комнаты',$('#close-invite'));
 const copy=async(value,label)=>{try{await navigator.clipboard.writeText(value);$('#directory-notice').textContent=label;}catch{const field=document.createElement('textarea');field.value=value;field.style.cssText='position:fixed;left:-9999px';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();$('#directory-notice').textContent=copied?label:'Не удалось скопировать. Разрешите доступ к буферу обмена.';}};
 $('#copy-code').onclick=()=>copy(roomState.room.code,'Код скопирован');$('#copy-link').onclick=()=>copy(invitation(),'Ссылка скопирована');
 $('#show-qr').onclick=()=>{const qr=qrcode(0,'M');qr.addData(invitation());qr.make();$('#invite-qr').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true});shareDialog.showModal();};
 let messages=[];
 const renderNetworkDirectory=state=>{
  const rooms=state.rooms||[],players=rooms.reduce((total,room)=>total+(room.count||0),0);
  $('#network-summary').textContent=`${state.online||0} подключений · ${players} гонщиков в ${rooms.length} комнатах`;
  const target=$('#network-room-list');target.replaceChildren();
  if(!rooms.length){const empty=document.createElement('p');empty.className='empty-rooms';empty.textContent='Пока никто не создал комнату.';target.append(empty);return;}
  for(const room of rooms){
   const card=document.createElement('article');card.className='network-room-card';card.setAttribute('role','listitem');
   const header=document.createElement('div');header.className='network-room-heading';const title=document.createElement('b');title.textContent=room.name||('Гонка '+room.code);const code=document.createElement('span');code.textContent=room.code;header.append(title,code);
   const people=document.createElement('p');people.className='network-room-players';people.textContent=(room.players||[]).join(' · ')||'Гонщики подключаются';
   const meta=document.createElement('p');meta.className='network-room-meta';meta.textContent=`${room.count||0}/${room.capacity||8} игроков · ${{lobby:'Ожидание',countdown:'Старт скоро',race:'Идёт гонка',result:'Результаты'}[room.phase]||'Ожидание'}${room.local?' · В вашей сети':''}`;
   const action=document.createElement('button');action.type='button';action.textContent=room.code===roomState?.room?.code?'Вы здесь':'Подключиться';action.disabled=room.code===roomState?.room?.code||(room.count||0)>=(room.capacity||8);action.onclick=()=>{closeNetwork();send({type:'join-room',code:room.code});};
   card.append(header,people,meta,action);target.append(card);
  }
 };
 window.setInterval(()=>{if(networkDialog.open)send({type:'directory'});},5000);
 const list=(target,rooms)=>{
  target.replaceChildren();
  if(!rooms.length){const empty=document.createElement('p');empty.className='empty-rooms';empty.textContent=target.id==='local-rooms'?'Пока нет комнат в вашей сети. Создайте первую.':'Пока нет открытых комнат. Начните свою гонку.';target.append(empty);return;}
  for(const room of rooms){const card=document.createElement('button');card.className='room-card';card.disabled=room.count>=room.capacity;const title=document.createElement('b');title.textContent=room.name;const details=document.createElement('span');details.textContent=room.code+' · '+room.count+'/'+room.capacity+' игроков · '+({lobby:'Ожидание',countdown:'Скоро старт',race:'Идёт гонка',result:'Результаты'}[room.phase]||'Ожидание');const map=document.createElement('small');map.textContent=MAPS[room.track].name+' · '+VEHICLES[room.vehicle].name;card.append(title,details,map);card.onclick=()=>send({type:'join-room',code:room.code});target.append(card);}
 };
 return {
  browser,
  updateDirectory:renderNetworkDirectory,
  directory(state){
   roomState=null;mode='lobby';snapshots=[];onlineRound=-1;localCar=null;window.onlineIndex=undefined;window.racerNames=[];
   $('#lobby').hidden=false;browser.hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;touch.hidden=true;if(window.cardTools)($('#room-options .drawer-body')||$('#room-options')).append(window.cardTools);
   onlineBar.textContent='';if(!$('#room-code').hasAttribute('aria-invalid'))$('#directory-notice').textContent='Вы в своей комнате. Введите код другой комнаты, чтобы присоединиться.';$('#menu').hidden=true;
   messages=[];lastChatId=0;unreadCount=0;setUnread();$('#chat-log').replaceChildren();$('#chat-log').hidden=false;$('#rename-form').hidden=true;shareDialog.close();chatDialog.close();window.peerTransport?.reset();
  },
  state(state){
   if(activeRoomCode!==state.room.code){activeRoomCode=state.room.code;messages=[];lastChatId=0;unreadCount=0;$('#chat-log').replaceChildren();setUnread();}
   browser.hidden=false;$('#lobby').hidden=false;$('#menu').hidden=true;if(window.cardTools){const target=$('#room-options .drawer-body');if(window.cardTools.parentElement!==target)target.append(window.cardTools);}
   $('#room-title').textContent=state.room.name;$('#copy-code').textContent=state.room.code+' ⧉';$('#rename-room').hidden=state.room.host!==state.you;$('#rename-room').disabled=!['lobby','result'].includes(state.phase);if(state.room.host!==state.you)$('#rename-form').hidden=true;
   for(const player of state.players.filter(p=>playerOwner(p)===state.you)){const field=$('#player-name-'+(player.slot??0));if(field&&document.activeElement!==field)field.value=player.name||'';}
   $('#host-caption').textContent=state.room.host===state.you?'Вы ведущий · выбирайте трассу и машину.':'Трассу и машину выбирает ведущий.';
   $('#lobby h1').textContent='Комната '+state.room.code;$('#lobby .eyebrow').textContent='ГОТОВИМСЯ К ГОНКЕ';$('#lobby .intro').textContent='Выберите гонщиков на этом устройстве и нажмите «Готово». После готовности всех — старт через 3 секунды.';window.refreshChoices?.();
   const url=new URL(location.href);url.searchParams.set('room',state.room.code);history.replaceState({},'',url);
  },
  chat(incoming){
   if(JSON.stringify(messages)===JSON.stringify(incoming))return;const log=$('#chat-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;
   for(const message of incoming){if((message.id||0)>lastChatId&&!chatDialog.open&&message.from!==roomState?.you)unreadCount++;}
   messages=incoming;lastChatId=Math.max(lastChatId,...messages.map(message=>message.id||0));log.replaceChildren();log.hidden=false;
   for(const message of messages){const line=document.createElement('p');line.className='chat-bubble'+(message.from===roomState?.you?' mine':' theirs');const author=document.createElement('b');author.textContent=message.name||'Игрок';line.append(author,document.createTextNode(message.text));log.append(line);}if(atBottom)log.scrollTop=log.scrollHeight;
   if(chatDialog.open)markChatRead();else setUnread();
  },
  notice(text){$('#directory-notice').textContent=text;$('#directory-notice').classList.remove('code-error');void $('#directory-notice').offsetWidth;$('#directory-notice').classList.add('code-error');const field=$('#room-code');field.classList.remove('code-error');void field.offsetWidth;field.classList.add('code-error');field.setAttribute('aria-invalid','true');},
  hide(){browser.hidden=true;shareDialog.close();options.close();chatDialog.close();networkDialog.close();unreadCount=0;lastChatId=0;activeRoomCode='';setUnread();},
 };
}
