import * as THREE from './vendor/three.module.js';
import { DEVICE } from './data.js';
import { buildDevice, buildAccessories } from './device-model.js';
import { buildRoom } from './atelier-room.js';
export { buildDevice } from './device-model.js';

function disposeTree(root) {
  const geometries=new Set(), materials=new Set(), textures=new Set();
  root.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    (Array.isArray(object.material)?object.material:[object.material]).filter(Boolean).forEach(material=>materials.add(material));
  });
  materials.forEach(material=>{for(const key of ['map','roughnessMap','metalnessMap','normalMap','bumpMap','emissiveMap','alphaMap'])if(material[key])textures.add(material[key]);});
  geometries.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());
}

export function createShop(host,onInspect,onStatus){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch(e){throw Error('此浏览器无法启动 WebGL 2。请使用支持硬件加速的 Chrome / Edge，或更换设备。');}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 host.append(renderer.domElement);const canvas=renderer.domElement;canvas.setAttribute('aria-label','3D 播放器检测台：拖动旋转，滚轮或双指缩放；下方也可用文本按钮操作');canvas.tabIndex=0;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#111e2b');scene.fog=new THREE.Fog('#172b3c',6,16);
 const camera=new THREE.PerspectiveCamera(38,1,.1,40);let distance=4.2;const aim=new THREE.Vector3(0,1.48,.12);camera.position.set(0,1.95,distance);camera.lookAt(aim);
 const envImages=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');const g=ctx.createLinearGradient(0,0,0,64);g.addColorStop(0,i===2?'#f0e3c5':'#a2b7ca');g.addColorStop(.48,'#223443');g.addColorStop(.6,'#c7b38d');g.addColorStop(1,'#102132');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return c;});const environment=new THREE.CubeTexture(envImages);environment.colorSpace=THREE.SRGBColorSpace;environment.needsUpdate=true;scene.environment=environment;
 scene.add(new THREE.HemisphereLight(0xc7d9e9,0x2b211d,1.25));
 const key=new THREE.DirectionalLight(0xffe5b8,3.8);key.position.set(-3,5,4);key.castShadow=true;
 key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.015;scene.add(key);
 const rim=new THREE.DirectionalLight(0xb1d3ee,3.1);rim.position.set(3,3,-2);scene.add(rim);
 const fill=new THREE.DirectionalLight(0x9fbdce,.75);fill.position.set(1,1,4);scene.add(fill);
 buildRoom(scene);
 const accessories=new THREE.Group();accessories.position.set(1.27,.6,.18);accessories.userData.part='accessories';scene.add(accessories);
 function loadAccessories(condition) {
  disposeTree(accessories);accessories.clear();
  const kit=buildAccessories(condition);accessories.add(kit.group);
  accessories.userData.point=new THREE.Vector3(1.27,.6+kit.height,.18);
 }
 let model=null,selected=null,tool='visual',frame=0,disposed=false,lost=false,active=true,down=null,lastPinch=0,autoSpin=false;const pointers=new Map();let yaw=0,pitch=0;
 const ray=new THREE.Raycaster();ray.params.Line.threshold=.008;const point=new THREE.Vector2();const hitTargets=[];
 const focusMarker=new THREE.Mesh(new THREE.TorusGeometry(.085,.008,6,32),new THREE.MeshBasicMaterial({color:0xffb86c,transparent:true,opacity:.9,depthTest:false}));focusMarker.renderOrder=5;focusMarker.visible=false;scene.add(focusMarker);
 const select=part=>{selected=part;};
 const load=c=>{loadAccessories(c);if(model){scene.remove(model.group);disposeTree(model.group);}model=buildDevice(c);model.group.scale.setScalar(DEVICE.scale);model.group.position.set(0,1.61,.12);scene.add(model.group);hitTargets.length=0;hitTargets.push(model.group,accessories);yaw=0;pitch=0;selected=null;};
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(host);
 const zoom=delta=>{distance=THREE.MathUtils.clamp(distance+delta,2.7,5.5);camera.position.set(0,1.48+distance*.112,distance);camera.lookAt(aim);};
 const setView=view=>{yaw=view==='back'?Math.PI:view==='side'?-Math.PI/2:0;pitch=view==='ports'?-.65:view==='top'?.65:0;select(null);};
 function hit(event){const rect=canvas.getBoundingClientRect();point.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(point,camera);const hits=ray.intersectObjects(hitTargets,true);if(!hits.length)return null;let object=hits[0].object;while(object&&!object.userData.part)object=object.parent;return object?.userData.part||null;}
 function pointerDown(e){if(e.pointerType==='mouse'&&e.button!==0)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)down={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};else {if(down)down.moved=true;lastPinch=0;}autoSpin=false;}
 function pointerMove(e){if(!pointers.has(e.pointerId))return;const previous=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];const span=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)zoom((lastPinch-span)*.012);lastPinch=span;return;}
 if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;yaw+=(e.clientX-previous.x)*.009;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-previous.y)*.006,-1.05,1.05);}
 function pointerUp(e){if(down?.id===e.pointerId&&!down.moved&&pointers.size===1){const part=hit(e);if(part){select(part);onInspect(tool,part);}else onStatus('请点击设备表面或柜台附件，也可使用文本检测点。');}pointers.delete(e.pointerId);if(!pointers.size)down=null;lastPinch=0;}
 const wheel=e=>{e.preventDefault();zoom(e.deltaY*.0025);};
 const keyboard=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')yaw-=.18;if(e.key==='ArrowRight')yaw+=.18;if(e.key==='ArrowUp')pitch=Math.max(-1.05,pitch-.15);if(e.key==='ArrowDown')pitch=Math.min(1.05,pitch+.15);if(e.key==='+')zoom(-.2);if(e.key==='-')zoom(.2);}};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;});canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keyboard);
 const contextLost=e=>{e.preventDefault();lost=true;cancelAnimationFrame(frame);onStatus('WebGL 上下文暂时丢失，已暂停画面。恢复后继续，进度保存在本地。');};
 const contextRestored=()=>{lost=false;resize();onStatus('3D 画面已恢复。');if(!document.hidden){active=true;loop();}};canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
 let ticks=0;
 function loop() {
  if(disposed||lost||!active)return;
  frame=requestAnimationFrame(loop);
  if(model){if(autoSpin)yaw+=.002;model.group.rotation.set(pitch+DEVICE.rotation[0],yaw+DEVICE.rotation[1],DEVICE.rotation[2]);}
  if(model&&selected){
    focusMarker.visible=true;
    if(selected==='accessories')focusMarker.position.copy(accessories.userData.point);
    else if(model.points[selected]){model.group.updateMatrixWorld(true);focusMarker.position.copy(model.points[selected]).applyMatrix4(model.group.matrixWorld);}
    focusMarker.quaternion.copy(camera.quaternion);
  }else focusMarker.visible=false;
  renderer.render(scene,camera);ticks++;
 }
 const pause=()=>{active=false;cancelAnimationFrame(frame);};const resume=()=>{if(disposed||lost||active)return;active=true;resize();loop();};const visibility=()=>document.hidden?pause():resume();document.addEventListener('visibilitychange',visibility);const pageHide=()=>pause();const pageShow=()=>resume();window.addEventListener('pagehide',pageHide);window.addEventListener('pageshow',pageShow);
 resize();loop();
 return {load,setTool:value=>{tool=value;},setView,zoom,select,
  diagnostics:()=>({renderedFrames:ticks,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,rotation:model?{x:pitch,y:yaw}:null,distance,webgl:renderer.capabilities.isWebGL2!==false}),
  pointFor:part=>{if(!model)return null;let p;if(part==='accessories')p=accessories.userData.point?.clone()||new THREE.Vector3(1.27,.8,.2);else if(model.points[part]){model.group.updateMatrixWorld(true);p=model.points[part].clone().applyMatrix4(model.group.matrixWorld);}else return null;p.project(camera);return{x:(p.x+1)*host.clientWidth/2,y:(1-p.y)*host.clientHeight/2};},
  dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);disposeTree(scene);environment.dispose();renderer.dispose();canvas.remove();}
 };
}
