import fs from 'node:fs';
const root=new URL('../dist/',import.meta.url);
const scripts=['maps','vehicles','hills','race-art','game','loading','qrcode','menu-icons','drawers','rooms','peers','online','app','mobile-screen','ui-controls','scene-layers','wheel-editor'];
fs.writeFileSync(new URL('game.bundle.js',root),scripts.map(name=>'\n// '+name+'.js\n'+fs.readFileSync(new URL(name+'.js',root),'utf8')).join('\n;\n'));
fs.writeFileSync(new URL('game.css',root),['style','lobby'].map(name=>fs.readFileSync(new URL(name+'.css',root),'utf8')).join('\n'));
console.log('Built one script and one stylesheet for startup.');
