import * as THREE from './vendor/three.module.js';
import { DEVICE } from './data.js';
import { canvasTexture, roundedShape, panel, mesh, box, instances, inlay, metalMaps, fanPaths } from './art-geometry.js';

function screwSet(parent, locations, part, steel, black) {
  instances(parent,new THREE.CylinderGeometry(.016,.018,.007,48),steel,locations.map(p=>({position:p,rotation:[Math.PI/2,0,0]})),part);
  const slots=[];
  locations.forEach(p=>{for(let j=0;j<3;j++)slots.push({position:[p[0],p[1],p[2]+(p[2]>0?.004:-.004)],rotation:[0,0,j*Math.PI/3]});});
  instances(parent,new THREE.BoxGeometry(.022,.002,.001),black,slots,part);
}

function screenMap() {
  return canvasTexture((c,w,h)=>{
    c.fillStyle='#101e27';c.fillRect(0,0,w,h);
    c.strokeStyle='#bba879';c.lineWidth=2;
    c.strokeRect(20,20,w-40,h-40);c.strokeRect(27,27,w-54,h-54);
    for(const side of [1,-1]){c.beginPath();c.moveTo(w/2+side*40,48);c.lineTo(w/2+side*24,48);c.lineTo(w/2+side*24,39);c.lineTo(w/2,39);c.stroke();}
    c.textAlign='center';c.fillStyle='#e6d9b5';c.font='26px Georgia';c.fillText('A T E L I E R',w/2,86);
    c.fillStyle='#8fa4af';c.font='12px sans-serif';c.fillText('P 1  /  N O C T U R N E',w/2,113);
    c.strokeStyle='#748993';c.lineWidth=1;c.beginPath();c.moveTo(58,136);c.lineTo(w-58,136);c.stroke();
    for(let k=0;k<2;k++) {
      const x=126+k*260,y=235;
      c.strokeStyle='#6d838d';c.lineWidth=2;c.beginPath();c.arc(x,y,69,Math.PI,Math.PI*2);c.stroke();
      for(let i=0;i<13;i++){const a=Math.PI+i*Math.PI/12;c.beginPath();c.moveTo(x+Math.cos(a)*60,y+Math.sin(a)*60);c.lineTo(x+Math.cos(a)*67,y+Math.sin(a)*67);c.stroke();}
      c.strokeStyle='#e2b679';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x-30+k*25,y-45);c.stroke();
      c.fillStyle='#d9caa4';c.font='14px Georgia';c.fillText(k?'R / OUTPUT':'L / OUTPUT',x,y+30);
    }
    c.fillStyle='#ede6d0';c.font='26px Georgia';c.fillText('After the rain',w/2,330);
    c.fillStyle='#8ea3ad';c.font='14px sans-serif';c.fillText('LOCAL SESSION / 07',w/2,362);
    c.fillStyle='#3d515c';c.fillRect(61,405,w-122,3);c.fillStyle='#ccae78';c.fillRect(61,405,173,3);
    c.font='16px sans-serif';c.textAlign='left';c.fillText('02:18',61,441);c.textAlign='right';c.fillText('04:36',w-61,441);
    c.textAlign='center';c.fillStyle='#7a8e96';c.font='12px sans-serif';c.fillText('SIMULATED PLAYBACK',w/2,498);
    const vignette=c.createRadialGradient(w/2,h/2,80,w/2,h/2,390);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#00000070');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  },512,544);
}

// Procedural detailed model. Its local axes and semantic inspection keys remain stable.
export function buildDevice(condition) {
  const group=new THREE.Group();group.name=DEVICE.id;
  const brushed=metalMaps();
  const shell=new THREE.MeshStandardMaterial({color:0x415563,metalness:.82,roughness:.43,roughnessMap:brushed});
  const trim=new THREE.MeshStandardMaterial({color:0xad9772,metalness:.82,roughness:.32});
  const steel=new THREE.MeshStandardMaterial({color:0xb8c6ca,metalness:.9,roughness:.25});
  const black=new THREE.MeshStandardMaterial({color:0x101720,metalness:.15,roughness:.55});
  const backMaterial=new THREE.MeshStandardMaterial({color:0x1a2630,metalness:.48,roughness:condition.wear==='worn'?.62:.4,roughnessMap:brushed});
  const body=panel(group,[.94,1.74,.215],[0,0,0],shell,'body',{radius:.055,bevel:.014,segments:8,curves:16});
  const outline=mesh(group,body.geometry,new THREE.MeshBasicMaterial({color:0x080d14,side:THREE.BackSide}),[0,0,0],'body');outline.scale.setScalar(1.008);
  panel(group,[.906,1.69,.018],[0,0,.116],trim,'body',{radius:.045});
  panel(group,[.884,1.665,.024],[0,0,.132],black,'body',{radius:.04});
  panel(group,[.91,1.69,.024],[0,0,-.122],trim,'back',{radius:.045});
  panel(group,[.888,1.665,.028],[0,0,-.143],backMaterial,'back',{radius:.04});
  // Machined side seams, shoulder rails and three physical side keys.
  for(const sign of [-1,1]) {
    panel(group,[.018,1.4,.014],[sign*.462,-.03,.052],trim,'body',{radius:.008,bevel:.002});
    inlay(group,[[[sign*.463,-.68,-.06],[sign*.463,.69,-.06]]],0x0a1017,'body');
  }
  for(let i=0;i<3;i++)box(group,[.022,.092,.085],[-.479,.18-i*.19,0],black,'body');
  // Stepped Deco screen surround with real bevels, inset gasket and glass surface.
  panel(group,[.812,1.12,.025],[0,.205,.154],trim,'screen',{radius:.025,bevel:.006});
  panel(group,[.788,1.094,.025],[0,.205,.17],black,'screen',{radius:.021,bevel:.005});
  const glass=new THREE.MeshStandardMaterial({map:screenMap(),color:0xe4e8e8,emissive:0x41515b,emissiveIntensity:.26,metalness:.12,roughness:.2});
  mesh(group,new THREE.PlaneGeometry(.748,1.045),glass,[0,.205,.185],'screen');
  inlay(group,[[[-.38,.774,.154],[-.2,.774,.154],[-.2,.794,.154],[.2,.794,.154],[.2,.774,.154],[.38,.774,.154]]],0xd3b988,'body');
  // The stepped sunburst is raised/inlaid, rather than a changed surface colour.
  inlay(group,fanPaths(0,-.735,.153,.1,9),0xbba179,'body');
  const buttonLocations=[[-.24,-.49,.164],[0,-.49,.164],[.24,-.49,.164]];
  buttonLocations.forEach((p,index)=>{
    const outer=mesh(group,new THREE.CylinderGeometry(index===1?.086:.059,index===1?.091:.063,.023,96),trim,p,'body');outer.rotation.x=Math.PI/2;
    const inner=mesh(group,new THREE.CylinderGeometry(index===1?.069:.043,index===1?.069:.043,.008,64),index===1?shell:black,[p[0],p[1],p[2]+.016],'body');inner.rotation.x=Math.PI/2;
    if(index===1){const triangle=new THREE.Shape();triangle.moveTo(-.018,-.025);triangle.lineTo(.027,0);triangle.lineTo(-.018,.025);triangle.closePath();mesh(group,new THREE.ShapeGeometry(triangle),new THREE.MeshBasicMaterial({color:0xd4c397}),[0,-.49,.186],'body');}
    else inlay(group,[[[p[0]+(index===0?.012:-.012),p[1]-.015,.186],[p[0]+(index===0?-.012:.012),p[1],.186],[p[0]+(index===0?.012:-.012),p[1]+.015,.186]]],0xc2ad82,'body');
  });
  // Fine lathed and knurled volume crown, instanced ribs keep draw calls modest.
  const knobGroup=new THREE.Group();knobGroup.position.set(.53,.58,0);knobGroup.rotation.z=-Math.PI/2;knobGroup.userData.part='knob';group.add(knobGroup);
  const profile=[[.0,-.062],[.08,-.062],[.08,-.05],[.108,-.042],[.116,-.025],[.116,.029],[.106,.047],[.08,.054],[0,.054]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(knobGroup,new THREE.LatheGeometry(profile,128),trim,[0,0,0],'knob');
  instances(knobGroup,new THREE.BoxGeometry(.006,.06,.007),black,Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return{position:[Math.cos(a)*.116,0,Math.sin(a)*.116],rotation:[0,-a,0]};}),'knob');
  for(const y of [-.03,.03]){const ring=mesh(knobGroup,new THREE.TorusGeometry(.116,.004,8,96),steel,[0,y,0],'knob');ring.rotation.x=Math.PI/2;}
  // Hollow, multi-step headphone collars and dark bores.
  for(const x of [-.24,.03]) {
    const ringProfile=[[.043,-.01],[.043,.017],[.062,.017],[.071,.006],[.071,-.012],[.043,-.01]].map(([r,y])=>new THREE.Vector2(r,y));
    mesh(group,new THREE.LatheGeometry(ringProfile,96),trim,[x,.887,0],'headphone');
    mesh(group,new THREE.CylinderGeometry(.04,.04,.008,64),black,[x,.887,0],'headphone');
    const ring=mesh(group,new THREE.TorusGeometry(.052,.003,6,64),steel,[x,.907,0],'headphone');ring.rotation.x=Math.PI/2;
  }
  // Rounded rectangular USB shell with actual opening and recessed contact tongue.
  const socketShape=roundedShape(.305,.112,.029);
  socketShape.holes.push(new THREE.Path(roundedShape(.255,.075,.018).getPoints(12)));
  const socket=mesh(group,new THREE.ExtrudeGeometry(socketShape,{depth:.012,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:4,curveSegments:14}),steel,[0,-.897,0],'usb');socket.rotation.x=Math.PI/2;
  if(condition.wear==='port')socket.rotation.z=.12;
  box(group,[.254,.01,.075],[0,-.895,0],black,'usb');
  const tongue=box(group,[.15,.008,.035],[0,-.91,.006],black,'usb');if(condition.wear==='port')tongue.rotation.z=.22;
  instances(group,new THREE.BoxGeometry(.008,.004,.019),trim,Array.from({length:10},(_,i)=>({position:[-.058+i*.013,-.916,.006]})),'usb');
  screwSet(group,[[-.365,.723,-.164],[.365,.723,-.164],[-.365,-.71,-.164],[.365,-.71,-.164]],'back',steel,black);
  screwSet(group,[[-.375,-.742,.151],[.375,-.742,.151]],'body',steel,black);
  const rearPaths=fanPaths(0,.28,-.16,.25,13);
  rearPaths.push([[-.29,.57,-.16],[-.29,-.53,-.16],[.29,-.53,-.16],[.29,.57,-.16]]);
  const rearInlay=inlay(group,rearPaths,0x826e50,'back');
  // Back face artwork faces outwards; there is no real manufacturer or market claim.
  const rearMap=canvasTexture((c,w,h)=>{c.fillStyle='#19232b';c.fillRect(0,0,w,h);c.fillStyle='#bead88';c.textAlign='center';c.font='32px Georgia';c.fillText('ATELIER / P1',w/2,71);c.font='14px sans-serif';c.fillText('NOCTURNE INSTRUMENT',w/2,112);c.fillStyle='#74818a';c.font='12px sans-serif';c.fillText('FICTIONAL DEVICE  /  001',w/2,157);},512,192);
  const plate=mesh(group,new THREE.PlaneGeometry(.55,.22),new THREE.MeshStandardMaterial({map:rearMap,roughness:.5}),[0,-.42,-.162],'back');plate.rotation.y=Math.PI;
  if(condition.wear==='worn') {
    const scratches=[];
    for(let i=0;i<16;i++){const x=-.24+(i%5)*.085,y=.12-(i%7)*.07,len=.08+(i%4)*.04;scratches.push([[x,y,-.166],[x+.012,y-len,-.166]]);}
    inlay(group,scratches,0xadb2ad,'back');
    panel(group,[.057,.135,.003],[.426,-.647,.146],steel,'body',{radius:.015,bevel:.0005,segments:2});
    // A dark abrasion at the edge gives the exposed metal a chipped paint silhouette.
    box(group,[.012,.083,.004],[.402,-.65,.148],black,'body');
  }
  const points={};
  for(const [key,value] of Object.entries(DEVICE.inspectionPoints))points[key]=new THREE.Vector3(...value);
  return {group,points};
}

export function buildAccessories(condition) {
  const group=new THREE.Group();group.userData.part='accessories';
  const carton=new THREE.MeshStandardMaterial({color:0x52606a,roughness:.86});
  const brass=new THREE.MeshStandardMaterial({color:0xbca16b,metalness:.65,roughness:.4});
  const black=new THREE.MeshStandardMaterial({color:0x101820,roughness:.8});
  const hasBox=!['worn','port'].includes(condition.wear);
  if(hasBox) {
    const base=panel(group,[.57,.39,.18],[0,.09,0],carton,'accessories',{radius:.015});base.rotation.x=-Math.PI/2;
    const lid=panel(group,[.585,.405,.036],[0,.198,0],black,'accessories',{radius:.017});lid.rotation.x=-Math.PI/2;
    const logo=canvasTexture((c,w,h)=>{c.fillStyle='#162029';c.fillRect(0,0,w,h);c.strokeStyle='#aa9160';c.lineWidth=3;c.strokeRect(15,15,w-30,h-30);c.textAlign='center';c.fillStyle='#d6c296';c.font='28px Georgia';c.fillText('ATELIER',w/2,72);c.font='15px sans-serif';c.fillText('P 1  /  N O C T U R N E',w/2,112);},512,180);
    const stamp=mesh(group,new THREE.PlaneGeometry(.49,.26),new THREE.MeshStandardMaterial({map:logo,roughness:.7}),[0,.218,0],'accessories');stamp.rotation.x=-Math.PI/2;
  }
  const offset=hasBox ? .43 : 0;
  const curve=new THREE.CatmullRomCurve3(Array.from({length:13},(_,i)=>{const a=i/12*Math.PI*2;return new THREE.Vector3(offset+Math.cos(a)*.13,.025,Math.sin(a)*.12);}));
  mesh(group,new THREE.TubeGeometry(curve,72,.009,10,false),black,[0,0,0],'accessories');
  const plug=panel(group,[.1,.044,.031],[offset+.11,.034,.09],black,'accessories',{radius:.008,bevel:.003});
  box(group,[.041,.023,.035],[offset+.18,.034,.09],brass,'accessories');
  if(condition.wear==='worn'||condition.accessories.includes('收纳袋')) {
    const x=hasBox?-.48:-.4;
    const pouch=panel(group,[.35,.43,.05],[x,.043,.03],new THREE.MeshStandardMaterial({color:0x382f2c,roughness:.96}),'accessories',{radius:.055,bevel:.012,segments:8});pouch.rotation.x=-Math.PI/2;
    const stitches=[];for(let i=0;i<13;i++)stitches.push({position:[x-.145+i*.024,.072,-.145]});
    instances(group,new THREE.BoxGeometry(.008,.002,.005),brass,stitches,'accessories');
  }
  box(group,[.62,.08,.45],[0,.045,0],new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),'accessories');
  return {group,height:hasBox ? .22 : .07};
}
