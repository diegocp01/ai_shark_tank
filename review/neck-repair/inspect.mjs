import { assertScriptedServer } from '../offline.js';
await assertScriptedServer('http://127.0.0.1:5059');
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1500,height:720}});
try{
await page.route('**/character-review',r=>r.fulfill({contentType:'text/html',body:`<html><head><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script></head><body style="margin:0;background:#20252a"><script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter} from '/js/studio/character.js';
const config=await(await fetch('/api/config')).json();
const founder={id:'founder',displayName:'Founder',color:'#79aaac',look:{top:'suit',suit:'#2a3545',skin:'#c98e63',hair:'#32271f',hairStyle:'short'}};
window.actors=[];window.THREE=THREE;
window.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1500,660);renderer.setScissorTest(true);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);
for(const [i,person] of [founder,...config.sharks].entries()){
 const actor=createCharacter({look:person.look,color:person.color,seed:i+1,pose:'stand'});
 const scene=new THREE.Scene();scene.background=new THREE.Color('#29323b');scene.add(actor.root);scene.add(new THREE.HemisphereLight('#ffffff','#706459',2.5));const light=new THREE.DirectionalLight('#fff0dd',3);light.position.set(2,4,4);scene.add(light);
 if(person.look.model){const gltf=await new GLTFLoader().loadAsync('/models/'+person.look.model+'/'+person.look.model+'-rigged.glb');actor.attachSkin(gltf.scene);}
 const camera=new THREE.PerspectiveCamera(31,250/660,.01,30);camera.position.set(.42,1.52,1.9);camera.lookAt(0,1.47,0);
 const label=document.createElement('div');label.textContent=person.displayName;label.style.cssText='position:absolute;top:680px;left:'+i*250+'px;width:250px;text-align:center;color:white;font:16px Arial';document.body.append(label);
 window.actors.push({actor,scene,camera,id:person.id});
}
window.render=(time=2)=>{window.actors.forEach(({actor,scene,camera},i)=>{actor.update(1/60,time);renderer.setViewport(i*250,0,250,660);renderer.setScissor(i*250,0,250,660);renderer.render(scene,camera);});};
for(let i=0;i<120;i++)window.render(i/60);window.ready=true;
</script></body></html>`}));
await page.goto('http://127.0.0.1:5059/character-review');await page.waitForFunction(()=>window.ready,{},{timeout:120000});
await page.screenshot({path:`review/neck-repair/${process.argv[2]||'before'}-neutral.png`});
await page.evaluate(()=>{for(const {actor} of actors){actor.setLookTarget(new THREE.Vector3(2,1.1,2));actor.setSpeaking(true);}for(let i=0;i<120;i++)render(2+i/60);});
await page.screenshot({path:`review/neck-repair/${process.argv[2]||'before'}-turn.png`});
if(process.argv[2] === 'after') {
 await page.evaluate(()=>{
   for(const {actor,scene,camera,id} of actors){
    camera.position.set(.4,1.2,4);camera.lookAt(0,.9,0);actor.setSpeaking(false);actor.setLookTarget(new THREE.Vector3(1,1.2,3));
    actor.setPose(id==='founder'?'stand':'sitLean');actor.setWalking(id==='founder');actor.setWalkSpeed(1.3);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new THREE.MeshStandardMaterial({color:'#69737c',roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
   }
   for(let i=0;i<180;i++)render(4+i/60);
 });
 for(let frame=0;frame<4;frame++){
  await page.evaluate(frame=>{for(let i=0;i<14;i++)render(7+(frame*14+i)/60);},frame);
  await page.screenshot({path:`review/neck-repair/after-motion-${frame}.png`});
 }
}
if(['after','revision'].includes(process.argv[2])) {
 const detailDir = process.argv[2] === 'after' ? 'review/neck-repair/closeups' : '/tmp/shark-neck-review';
 await mkdir(detailDir, {recursive:true});
 await page.setViewportSize({width:720,height:900});
 await page.evaluate(()=>{renderer.setSize(720,900);renderer.setScissorTest(false);document.querySelectorAll('div').forEach(d=>d.remove());});
 const summary=await page.evaluate(()=>actors.map(({actor})=>{let meshes=[];actor.root.traverse(m=>{if(!m.isSkinnedMesh)return;const p=m.geometry.attributes.position;const b=new THREE.Box3().setFromBufferAttribute(p);meshes.push({name:m.name,material:m.material.name,color:m.material.color.toArray(),vertexColors:m.material.vertexColors,box:[b.min.toArray(),b.max.toArray()],faired:m.userData.neckJoinFaired});});return {model:actor.look.model,meshes};}));
 await writeFile('/tmp/shark-neck-review/meshes.json',JSON.stringify(summary,null,2));
 for(const id of ['kevin','lori','barbara','mark']) {
  for(const [angle,pos] of Object.entries({front:[0,1.6,1.2],quarter:[.75,1.6,1],profile:[1.2,1.6,.08]})) {
   await page.evaluate(({id,pos})=>{
    const {actor,scene,camera}=actors.find(a=>a.actor.look.model===id);
    camera.aspect=720/900;camera.updateProjectionMatrix();camera.position.set(...pos);camera.lookAt(0,1.57,0);
    actor.setPose('stand');actor.setWalking(false);
    actor.setLookTarget(new THREE.Vector3(0,1.5,3));actor.setSpeaking(true);
    for(let i=0;i<120;i++)actor.update(1/60,10+i/60);
    renderer.setViewport(0,0,720,900);renderer.render(scene,camera);
   }, {id,pos});
   await page.screenshot({path:`${detailDir}/${id}-${angle}.png`});
  }
 }
}
console.log('Captured cast and requested close-ups.');
}finally{await browser.close();}
