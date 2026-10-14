'use strict';
// Same slide timing and gesture threshold as Travagram; vertical scrolling stays native.
const gameDrawers=new Set();
function setupGameDrawer(dialog,title,closeButton){
 const nativeOpen=dialog.showModal.bind(dialog),nativeClose=dialog.close.bind(dialog);
 const head=document.createElement('div');head.className='drawer-head';const heading=document.createElement('h2');heading.textContent=title;heading.id=dialog.id+'-heading';
 const body=document.createElement('div');body.className='drawer-body';
 dialog.querySelector(':scope > h2')?.remove();
 for(const child of [...dialog.children])if(child!==closeButton)body.append(child);
 head.append(heading,closeButton);dialog.append(head,body);dialog.classList.add('game-drawer');dialog.setAttribute('aria-labelledby',heading.id);closeButton.textContent='×';
 let closingTimer,gesture;
 dialog.finishClose=()=>{clearTimeout(closingTimer);dialog.classList.remove('closing');dialog.style.transform='';if(dialog.open)nativeClose();};
 dialog.showModal=()=>{for(const other of gameDrawers)if(other!==dialog)other.finishClose();clearTimeout(closingTimer);dialog.classList.remove('closing');dialog.style.transform='';if(!dialog.open)nativeOpen();};
 dialog.close=()=>{if(!dialog.open)return;dialog.classList.add('closing');dialog.style.transform='';clearTimeout(closingTimer);closingTimer=setTimeout(dialog.finishClose,matchMedia('(prefers-reduced-motion:reduce)').matches?0:240);};
 closeButton.onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
 dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
 dialog.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('input,textarea,button'))return;const t=e.touches[0];gesture={x:t.clientX,y:t.clientY,at:performance.now(),dx:0,drag:false};},{passive:true});
 dialog.addEventListener('touchmove',e=>{if(!gesture||e.touches.length!==1)return;const t=e.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;if(!gesture.drag){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;if(dx<0||Math.abs(dy)>Math.abs(dx)){gesture=null;return;}gesture.drag=true;}gesture.dx=Math.max(0,dx);dialog.style.transition='none';dialog.style.transform='translateX('+gesture.dx+'px)';if(e.cancelable)e.preventDefault();},{passive:false});
 const finish=()=>{if(!gesture)return;const g=gesture;gesture=null;dialog.style.transition='';dialog.style.transform='';if(g.drag&&(g.dx>64||g.dx/Math.max(1,performance.now()-g.at)>.4))dialog.close();};
 dialog.addEventListener('touchend',finish);dialog.addEventListener('touchcancel',()=>{gesture=null;dialog.style.transition='';dialog.style.transform='';});gameDrawers.add(dialog);
 const syncViewport=()=>{const v=window.visualViewport;dialog.style.setProperty('--drawer-height',(v?.height||innerHeight)+'px');dialog.style.setProperty('--drawer-top',(v?.offsetTop||0)+'px');};syncViewport();window.visualViewport?.addEventListener('resize',syncViewport);window.visualViewport?.addEventListener('scroll',syncViewport);
 return body;
}
