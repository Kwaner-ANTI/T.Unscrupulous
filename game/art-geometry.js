import * as THREE from './vendor/three.module.js';

export function canvasTexture(draw, width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function roundedShape(width, height, radius) {
  const x = -width / 2, y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const s = new THREE.Shape();
  s.moveTo(x+r,y); s.lineTo(x+width-r,y);
  s.quadraticCurveTo(x+width,y,x+width,y+r); s.lineTo(x+width,y+height-r);
  s.quadraticCurveTo(x+width,y+height,x+width-r,y+height); s.lineTo(x+r,y+height);
  s.quadraticCurveTo(x,y+height,x,y+height-r); s.lineTo(x,y+r);
  s.quadraticCurveTo(x,y,x+r,y);
  return s;
}

export function panel(parent, size, position, material, part, options = {}) {
  const [w,h,d] = size;
  const bevel = Math.min(options.bevel ?? .006, d*.4);
  const geometry = new THREE.ExtrudeGeometry(roundedShape(w-2*bevel,h-2*bevel,options.radius ?? .035), {
    depth:d-2*bevel, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel,
    bevelSegments:options.segments ?? 5, curveSegments:options.curves ?? 10, steps:1
  });
  geometry.translate(0,0,-(d-2*bevel)/2);
  const positionAttribute=geometry.getAttribute('position');
  const uv=[];
  for(let i=0;i<positionAttribute.count;i++)uv.push(positionAttribute.getX(i)/w+.5,positionAttribute.getY(i)/h+.5);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  return mesh(parent, geometry, material, position, part);
}

export function mesh(parent, geometry, material, position = [0,0,0], part) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position); object.castShadow = true; object.receiveShadow = true;
  if (part) object.userData.part = part;
  parent.add(object); return object;
}

export function box(parent, size, position, material, part) {
  return mesh(parent, new THREE.BoxGeometry(...size), material, position, part);
}

export function instances(parent, geometry, material, transforms, part) {
  const result = new THREE.InstancedMesh(geometry,material,transforms.length);
  const helper = new THREE.Object3D();
  transforms.forEach((item,index) => {
    helper.position.set(...item.position);
    helper.rotation.set(...(item.rotation || [0,0,0]));
    helper.scale.set(...(item.scale || [1,1,1]));
    helper.updateMatrix(); result.setMatrixAt(index,helper.matrix);
  });
  result.castShadow = true; result.receiveShadow = true;
  if (part) result.userData.part = part;
  parent.add(result); return result;
}

export function inlay(parent, paths, color = 0xbca675, part) {
  const positions = [];
  for (const points of paths) for (let i=1;i<points.length;i++) positions.push(...points[i-1],...points[i]);
  const object = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial({color}));
  if (part) object.userData.part = part;
  parent.add(object); return object;
}

export function metalMaps() {
  const roughness = canvasTexture((ctx,w,h) => {
    ctx.fillStyle='#969696';ctx.fillRect(0,0,w,h);
    for(let y=0;y<h;y++) {
      const value=135+Math.sin(y*3.71)*22+Math.sin(y*.19)*10;
      ctx.fillStyle=`rgb(${value},${value},${value})`;ctx.fillRect(0,y,w,1);
    }
  },256,512);
  roughness.colorSpace=THREE.NoColorSpace;
  return roughness;
}

export function fanPaths(cx,cy,z,radius,count=11) {
  const paths=[];
  for(let i=0;i<count;i++) {
    const a=Math.PI*i/(count-1);
    paths.push([[cx+Math.cos(a)*radius*.22,cy+Math.sin(a)*radius*.22,z],[cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,z]]);
  }
  for(const factor of [.36,.72,1]) {
    paths.push(Array.from({length:49},(_,i)=>[cx+Math.cos(i/48*Math.PI)*radius*factor,cy+Math.sin(i/48*Math.PI)*radius*factor,z]));
  }
  return paths;
}
