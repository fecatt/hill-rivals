'use strict';
// Hills art and bridge simulation are deliberately isolated from the other maps.
const hillArt=new Image(),hillSprites=[];
// tops retain placement after trimming transparent rows from the small textures.
const hillLandscapeLayers=[
 {name:'far',sourceHeight:724,tops:[154,291,246],speed:.08,vertical:.055,top:.05,height:.8},
 {name:'middle',sourceHeight:724,tops:[173,255,233],speed:.22,vertical:.16,top:.27,height:.62},
 {name:'near',sourceHeight:724,tops:[153,181,191],speed:.46,vertical:.32,top:.44,height:.5}
].map(layer=>({...layer,images:[0,1,2].map(index=>{const im=new Image();im.src='assets/hills-'+layer.name+'-'+index+'.webp';return im;})}));
const hillTrees=['hills-oak-clean.webp','hills-birch-clean.webp'].map(name=>{const im=new Image();im.src='assets/'+name;return im});
const hillTreeBounds=[[109,98,1062,1107],[26,13,970,1500]];
const hillCrestSun=new Image();hillCrestSun.src='assets/hills-crest-sun.webp';
const hillSunBounds=[108,55,1095,1093];
const hillCloud=new Image();hillCloud.src='assets/hills-cloud-clean.webp';
const hillCloudBounds=[127,82,1918,557];
hillArt.onload=()=>{
 // Explicit crop bounds also work in file:// browsers, without reading a tainted canvas.
 const crops=[[13,182,321,600],[334,176,242,597],[576,244,364,526],[940,195,304,575],[16,906,311,178],[327,887,356,197],[683,857,215,244],[911,875,329,256]];
 const sx=hillArt.naturalWidth/1254,sy=hillArt.naturalHeight/1254;
 for(let i=0;i<8;i++){
  const [x,y,w,h]=crops[i];hillSprites[i]=[x*sx,y*sy,w*sx,h*sy];
 }
};
hillArt.src='assets/hills-atlas.webp';
// Upload small, reusable textures instead of resampling multi-megapixel PNGs each frame.
const hillTextureCache=new WeakMap();
function hillTexture(im,crop,height){
 let textures=hillTextureCache.get(im);if(!textures){textures=new Map();hillTextureCache.set(im,textures);}
 const key=crop.join(',')+':'+height;if(textures.has(key))return textures.get(key);
 const [x,y,w,h]=crop,texture=document.createElement('canvas');
 texture.height=Math.min(h,height);texture.width=Math.max(1,Math.round(w*texture.height/h));
 const paint=texture.getContext('2d');paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';paint.drawImage(im,x,y,w,h,0,0,texture.width,texture.height);
 textures.set(key,texture);return texture;
}
function hillSprite(index,x,y,height,angle=0,flip=false,key=null){
 const isCloud=index===4||index===5,im=index<4?hillTrees[index%2]:isCloud?hillCloud:hillArt,crop=index<4?hillTreeBounds[index%2]:isCloud?hillCloudBounds:hillSprites[index];if(!crop||!im.complete||!im.naturalWidth)return;
 const [sx,sy,sw,sh]=crop,width=height*sw/sh;
 ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='medium';ctx.translate(x,y);ctx.rotate(angle);if(flip!==Boolean(isCloud&&index===5))ctx.scale(-1,1);
 const texture=hillTexture(im,crop,isCloud?128:512);if(!window.sceneLayers?.bitmap(texture,-width/2,-height,width,height,0,key))ctx.drawImage(texture,-width/2,-height,width,height);ctx.restore();
}
function paintHillSun(){
 const x=W*.82,y=Math.max(82,H*.17),radius=Math.max(34,Math.min(43,W*.036));
 ctx.save();ctx.translate(x,y);ctx.imageSmoothingEnabled=true;
 const halo=ctx.createRadialGradient(0,0,radius*.5,0,0,radius*3.4);
 halo.addColorStop(0,'#fff6be88');halo.addColorStop(.35,'#ffeb9160');halo.addColorStop(1,'#ffdf6900');
 ctx.fillStyle=halo;ctx.fillRect(-radius*3.4,-radius*3.4,radius*6.8,radius*6.8);
 // The emblem stays upright; only the rays turn, slowly, around its centre.
 ctx.save();ctx.rotate(time*.018);
 const beam=ctx.createLinearGradient(radius*.6,0,radius*3.3,0);
 beam.addColorStop(0,'#fff5bf99');beam.addColorStop(.35,'#ffe68866');beam.addColorStop(.75,'#ffe68822');beam.addColorStop(1,'#ffe68800');
 for(let i=0;i<8;i++){
  ctx.save();ctx.rotate(i*Math.PI/4);
  path([[radius*.6,-radius*.1],[radius*3.3,-radius*.28],[radius*3.3,radius*.28],[radius*.6,radius*.1]],beam);
  ctx.restore();
 }
 ctx.restore();ctx.globalAlpha=1;
 const disk=ctx.createRadialGradient(-radius*.2,-radius*.25,0,0,0,radius);
 disk.addColorStop(0,'#fffef0');disk.addColorStop(.72,'#fff6c2');disk.addColorStop(1,'#ffe398');circle(0,0,radius,disk);
 if(hillCrestSun.complete&&hillCrestSun.naturalWidth){
  const [sx,sy,sw,sh]=hillSunBounds;ctx.save();ctx.beginPath();ctx.arc(0,0,radius*.72,0,Math.PI*2);ctx.clip();ctx.globalAlpha=.12;
  ctx.drawImage(hillCrestSun,sx,sy,sw,sh,-radius*.88,-radius*.88,radius*1.76,radius*1.76);ctx.restore();
 }
 ctx.restore();
}
// The sky stays in screen space; landscape assets are independent opaque cutouts.
let hillBackdrop=null,hillSunRaster=null;
function prepareHillBackground(){
 const ratio=renderRatio,key=W+':'+H+':'+ratio;if(hillBackdrop?.key===key)return hillBackdrop;
 const sky=document.createElement('canvas');sky.width=Math.ceil(W*ratio);sky.height=Math.ceil(H*ratio);
 const paint=sky.getContext('2d'),gradient=paint.createLinearGradient(0,0,0,sky.height);gradient.addColorStop(0,'#73c5ed');gradient.addColorStop(1,'#eaf3df');paint.fillStyle=gradient;paint.fillRect(0,0,sky.width,sky.height);
 hillBackdrop={key,sky};return hillBackdrop;
}
function drawHillSun(){
 const ratio=renderRatio,radius=Math.max(34,Math.min(43,W*.036)),pad=Math.ceil(radius*3.5),x=W*.82,y=Math.max(82,H*.17),key=W+':'+H+':'+ratio;
 if(!hillSunRaster||hillSunRaster.key!==key||Math.abs(time-hillSunRaster.time)>=.25){
  const surface=hillSunRaster?.key===key?hillSunRaster.surface:document.createElement('canvas');surface.width=Math.ceil(pad*2*ratio);surface.height=Math.ceil(pad*2*ratio);
  const p=surface.getContext('2d');p.setTransform(ratio,0,0,ratio,(pad-x)*ratio,(pad-y)*ratio);withDrawingContext(p,paintHillSun);hillSunRaster={key,time,surface};
 }
 const dx=Math.round((x-pad)*ratio)/ratio,dy=Math.round((y-pad)*ratio)/ratio,dw=hillSunRaster.surface.width/ratio,dh=hillSunRaster.surface.height/ratio;if(!window.sceneLayers?.bitmap(hillSunRaster.surface,dx,dy,dw,dh,hillSunRaster.time,'sky:sun'))ctx.drawImage(hillSunRaster.surface,dx,dy,dw,dh);
}
function drawHillLandscape(){
 for(const layer of hillLandscapeLayers){
  if(layer.images.some(im=>!im.complete||!im.naturalWidth))continue;
  const unit=H*layer.height/layer.sourceHeight,total=layer.images.reduce((sum,im)=>sum+im.naturalWidth*unit,0),offset=cam*layer.speed,top=H*layer.top-cameraY*scale()*layer.vertical;
  // Each cycle contains the original panorama plus its generated connecting scene.
  // Chunks are exact neighbouring crops. Every copy faces the same direction.
  for(let cycle=Math.floor(offset/total);cycle<=Math.floor((offset+W)/total);cycle++){
   let x=cycle*total-offset;
   for(let j=0;j<layer.images.length;j++){
    const image=layer.images[j],width=image.naturalWidth*unit,height=image.naturalHeight*unit,y=top+layer.tops[j]*unit;
    if(x+width>=0&&x<=W&&!window.sceneLayers?.bitmap(image,x,y,width+.25,height,0,'landscape:'+layer.name+':'+cycle+':'+j))ctx.drawImage(image,x,y,width+.25,height);
    x+=width;
   }
  }
 }
}
function drawHillBackground(){
 document.body.dataset.biome='hills';const backdrop=prepareHillBackground();
 if(!window.sceneLayers?.sky(backdrop.sky))ctx.drawImage(backdrop.sky,0,0,backdrop.sky.width/renderRatio,backdrop.sky.height/renderRatio);
 ctx.save();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='medium';
 drawHillSun();
 // Sun and cloud positions depend on the viewport only, never the camera or clock.
 const count=W<700?3:5;
 for(let j=0;j<count;j++){
  const x=W*((j+.15)/count),y=H*(.14+(j%3)*.055),height=Math.max(26,Math.min(66,H*(.045+(j%2)*.015)));
  hillSprite(4+j%2,x,y,height,0,false,'sky:cloud:'+j);
 }
 drawHillLandscape();ctx.restore();
}
function drawHillTree(cell,x,angle){
 // Broad clearings alternate with dense groves, determined by the world seed.
 if(hash(Math.floor(cell/4),960)<.4||hash(cell,961)<.22)return;
 const localSlope=(terrain(x+24)-terrain(x-24))/48;
 if(Math.abs(localSlope)>.32||Math.abs(slope(x-14))>.4||Math.abs(slope(x+14))>.4)return;
 angle=Math.max(-.16,Math.min(.16,Math.atan(localSlope)*.6));
 const h=205+hash(cell,962)*95;
 hillSprite(Math.floor(hash(cell,963)*4),x,terrain(x)+6,h,angle,hash(cell,964)>.5);
 if(hash(cell,965)>.58){const bx=x+65;if(!bridgeAt(0,bx)&&Math.abs(slope(bx))<.32)hillSprite(7,bx,terrain(bx)+3,28+hash(cell,966)*22)}
}
const hillBridgeStates=new Map();
function resetHillBridges(){hillBridgeStates.clear()}
function hillBridgeState(a,b){let state=hillBridgeStates.get(a);if(!state){state={a,b,q:[0,0],v:[0,0]};hillBridgeStates.set(a,state)}return state}
function hillBridgeHeight(x){const gap=bridgeAt(0,x);if(!gap)return rawTerrain(0,x);const [a,b]=gap,u=(x-a)/(b-a),state=hillBridgeStates.get(a);return mapTerrain(0,x)+7*Math.sin(Math.PI*u)+(state?state.q[0]*Math.sin(Math.PI*u)+state.q[1]*Math.sin(2*Math.PI*u):0)}
function hillBridgeVelocity(t,x){if(t!==0)return 0;const gap=bridgeAt(0,x);if(!gap)return 0;const state=hillBridgeStates.get(gap[0]);if(!state)return 0;const u=(x-gap[0])/(gap[1]-gap[0]);return state.v[0]*Math.sin(Math.PI*u)+state.v[1]*Math.sin(2*Math.PI*u)}
function updateHillBridges(dt){
 if(track!==0)return;
 for(const c of cars)if(c.alive)for(const wheel of wheelSpecs(carSpec(c))){const x=c.x+wheel.x*Math.cos(c.a)-carSpec(c).mount*Math.sin(c.a),gap=bridgeAt(0,x);if(gap)hillBridgeState(...gap)}
 for(const [key,state] of hillBridgeStates){
  const target=[0,0];
  for(const c of cars){if(!c.alive)continue;const spec=carSpec(c),wheels=wheelSpecs(spec);
   for(const w of wheels){const x=c.x+w.x*Math.cos(c.a)-spec.mount*Math.sin(c.a),y=c.y+w.x*Math.sin(c.a)+spec.mount*Math.cos(c.a)+w.r;
    if(x<=state.a||x>=state.b||Math.abs(y-hillBridgeHeight(x))>22)continue;
    const u=(x-state.a)/(state.b-state.a),load=13*(spec.mass/900)/wheels.length;
    target[0]+=load*Math.sin(Math.PI*u);target[1]+=load*.3*Math.sin(2*Math.PI*u);
   }
  }
  for(let j=0;j<2;j++){const omega=j?13:9,damping=j?13:10;state.v[j]+=(omega*omega*(Math.min(38,Math.max(-38,target[j]))-state.q[j])-damping*state.v[j])*dt;state.q[j]+=state.v[j]*dt}
  if(state.b<cam-1400&&Math.abs(state.q[0])+Math.abs(state.q[1])<.02)hillBridgeStates.delete(key);
 }
}
function clipHillBanks(left,right,bottom){
 ctx.beginPath();let edge=left;
 for(const [a,b] of bridgesInRange(0,left-BRIDGE_CHUNK,right)){if(b<=left||a>=right)continue;if(a>edge)ctx.rect(edge,-10000,a-edge,bottom+10000);edge=Math.max(edge,b)}
 if(edge<right)ctx.rect(edge,-10000,right-edge,bottom+10000);ctx.clip();
}
function drawHillBridge(a,b){
 const deck=hillBridgeHeight,segments=Math.ceil((b-a)/12),step=(b-a)/segments;
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 // Low railing follows exactly the same deformed surface as the wheel contacts.
 for(const dy of [-27,-14]){ctx.beginPath();for(let j=0;j<=segments;j++){const x=a+j*step;j?ctx.lineTo(x,deck(x)+dy):ctx.moveTo(x,deck(x)+dy)}ctx.strokeStyle=dy===-27?'#79563b':'#987148';ctx.lineWidth=3;ctx.stroke()}
 for(let j=0;j<=segments;j+=2){const x=a+j*step,y=deck(x);ctx.strokeStyle='#5d4432';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y-29);ctx.lineTo(x,y+3);ctx.stroke();ctx.strokeStyle='#c49b66';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-1,y-27);ctx.lineTo(x-1,y);ctx.stroke()}
 for(let j=0;j<segments;j++){
  const x1=a+j*step,x2=a+(j+1)*step,y1=deck(x1),y2=deck(x2);
  path([[x1,y1],[x2,y2],[x2,y2+9],[x1,y1+9]],j%3?'#ae8050':'#bf945e','#5c4230',1);
  ctx.strokeStyle='#ead09a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1+1,y1+1);ctx.lineTo(x2-1,y2+1);ctx.stroke();
 }
 ctx.restore();
}
