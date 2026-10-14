'use strict';
// Shared vector artwork uses one grid and one consistent stroke.
const menuIconPaths={
 globe:'<circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="5.5" ry="12"/><path d="M4 16h24M6.2 9h19.6M6.2 23h19.6"/>',
 chat:'<path d="M16 4a12 12 0 1 1-6.3 22.2L3 29l2.8-6.7A12 12 0 0 1 16 4Z"/><circle class="icon-dot" cx="11" cy="16" r="1.4"/><circle class="icon-dot" cx="16" cy="16" r="1.4"/><circle class="icon-dot" cx="21" cy="16" r="1.4"/>',
 link:'<path d="m13 19 6-6M10.5 15.5l-2 2a5 5 0 0 0 7 7l3-3a5 5 0 0 0 0-7M21.5 16.5l2-2a5 5 0 0 0-7-7l-3 3a5 5 0 0 0 0 7"/>',
 qr:'<path d="M4 4h9v9H4zM19 4h9v9h-9zM4 19h9v9H4zM19 19h4v4h-4zM27 19v4M19 27h4M27 27h1"/><path d="M8 8h1v1H8zM23 8h1v1h-1zM8 23h1v1H8z"/>',
 pencil:'<path d="m21 5 6 6M5 27l7-2L28 9a2 2 0 0 0 0-3l-2-2a2 2 0 0 0-3 0L7 20Z"/>',
 turbo:'<path class="icon-accent" d="M18 3 7 18h8l-1 11 11-16h-8Z"/>',
 jump:'<path class="icon-accent" d="m16 3-10 11h6v10h8V14h6Z"/><path d="M6 29h20"/>',
 shield:'<path class="icon-accent" d="m16 3 11 4v9c0 7-6 11-11 14C11 27 5 23 5 16V7Z"/><path d="M16 8v15M10 12l6-4 6 4"/>',
 left:'<path d="m19 7-9 9 9 9"/>',right:'<path d="m13 7 9 9-9 9"/>',
 sun:'<circle class="weather-sun" cx="16" cy="16" r="6"/><path d="M16 2v3M16 27v3M2 16h3M27 16h3M6 6l2 2M24 24l2 2M6 26l2-2M24 8l2-2"/>',
 cloud:'<path class="weather-cloud" d="M8 25a6 6 0 0 1-1-12 9 9 0 0 1 17-1 6.5 6.5 0 0 1 0 13Z"/>',
 snow:'<path class="weather-cloud" d="M8 21a5 5 0 0 1-1-10 8 8 0 0 1 15-1 5.5 5.5 0 0 1 1 11Z"/><path d="m8 26 2 2m0-2-2 2m7-2 2 2m0-2-2 2m7-2 2 2m0-2-2 2"/>',
 moon:'<path class="weather-cloud" d="M24 25A13 13 0 0 1 8 5a12 12 0 0 0 16 20Z"/>'
};
// Eight regular teeth make a symmetrical, readable gear even at small sizes.
menuIconPaths.settings='<path d="'+Array.from({length:32},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/16,r=[11,11,8.8,8.8][i%4];return (i?'L':'M')+(16+Math.cos(angle)*r).toFixed(2)+' '+(16+Math.sin(angle)*r).toFixed(2);}).join(' ')+'Z"/><circle cx="16" cy="16" r="4"/>';
function menuIcon(name){return '<svg class="menu-icon icon-'+name+'" viewBox="0 0 32 32" aria-hidden="true" focusable="false">'+(menuIconPaths[name]||'')+'</svg>';}
