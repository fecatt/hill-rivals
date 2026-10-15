'use strict';
// Static pixels stay in compositor layers; the frame loop only moves them.
(()=>{
 const mainContext=ctx,root=document.createElement('div');root.id='scene-layers';root.setAttribute('aria-hidden','true');
 Object.assign(root.style,{position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'0',contain:'strict'});
 function group(z){const node=document.createElement('div');Object.assign(node.style,{position:'absolute',inset:'0',overflow:'hidden',zIndex:String(z)});root.append(node);return node;}
 const sky=group(0),back=group(1),ridges=group(2),scenery=group(3),backgroundCanvas=document.createElement('canvas');ridges.append(backgroundCanvas);
 Object.assign(backgroundCanvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});
 const backgroundContext=backgroundCanvas.getContext('2d'),pools=[[],[]],keyedPools=[new Map(),new Map()];let frameId=0,used=[0,0],active=false,skySource=null;
 canvas.style.zIndex='1';for(const id of ['hud','foot']){const node=document.getElementById(id);if(node)node.style.zIndex='3';}document.body.append(root);
 const assign=(style,key,value)=>{if(style[key]!==value)style[key]=value;};
 function bitmap(source,x,y,width,height,version=0,key=null){
  if(!active||(ctx!==mainContext&&ctx!==backgroundContext))return false;
  const layer=ctx===mainContext?1:0,index=key===null?used[layer]++:key,pool=key===null?pools[layer]:keyedPools[layer];let item=key===null?pool[index]:pool.get(key);
  const image=source instanceof HTMLImageElement;
  if(!item||item.image!==image){item?.node.remove();const node=document.createElement('canvas');Object.assign(node.style,{position:'absolute',inset:'auto',left:'0',top:'0',transformOrigin:'0 0',pointerEvents:'none',willChange:'transform'});node.draggable=false;(layer?scenery:back).append(node);item={node,image,source:null,version:null};if(key===null)pool[index]=item;else pool.set(key,item);}
  item.lastFrame=frameId;const node=item.node;node.hidden=false;node.dataset.layerKey=key??'';assign(node.style,'zIndex',key?.startsWith('panorama:')?'0':key?.startsWith('cloud:')?'20':key?.startsWith('depth:0:')?'30':key?.startsWith('depth:1:')?'40':'10');
  if(item.source!==source||item.version!==version){node.width=image?source.naturalWidth:source.width;node.height=image?source.naturalHeight:source.height;node.getContext('2d').drawImage(source,0,0);item.source=source;item.version=version;}
  const m=ctx.getTransform(),r=renderRatio;
  assign(node.style,'width',width+'px');assign(node.style,'height',height+'px');assign(node.style,'opacity',String(ctx.globalAlpha));
  assign(node.style,'transform',`matrix(${m.a/r},${m.b/r},${m.c/r},${m.d/r},${(m.a*x+m.c*y+m.e)/r},${(m.b*x+m.d*y+m.f)/r})`);return true;
 }
 window.sceneLayers={
  begin(){frameId++;active=(mode==='lobby'?+$('#track').value:track)===0;root.hidden=!active;if(!active)return;used=[0,0];if(backgroundCanvas.width!==canvas.width||backgroundCanvas.height!==canvas.height){backgroundCanvas.width=canvas.width;backgroundCanvas.height=canvas.height;}backgroundContext.reset();backgroundContext.setTransform(renderRatio,0,0,renderRatio,0,0);},
  background(action){return withDrawingContext(backgroundContext,action);},
  sky(source){if(!active)return false;if(skySource!==source){Object.assign(source.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});sky.replaceChildren(source);skySource=source;}return true;},
  bitmap,
  end(){for(let layer=0;layer<2;layer++){for(let i=used[layer];i<pools[layer].length;i++)pools[layer][i].node.hidden=true;for(const [key,item] of keyedPools[layer])if(item.lastFrame!==frameId){item.node.remove();keyedPools[layer].delete(key);}}active=false;},
  get active(){return active;}
 };
})();
