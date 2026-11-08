import { expect, test } from '@playwright/test';

async function prepare(page) {
  await page.route('**/motion-test', route => route.fulfill({ contentType:'text/html', body:'<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>' }));
  await page.goto('/motion-test');
}

test('neck connection and motion stay bounded through gaze and state transitions', async ({page})=>{
  await prepare(page);
  const result=await page.evaluate(async()=>{
    const THREE=await import('three');
    const {createCharacter}=await import('/js/studio/character.js');
    const make=()=>createCharacter({look:{},seed:7});
    const actor=make();const root=actor.root;
    const neck=root.getObjectByName('actor-neck'), head=root.getObjectByName('actor-head');
    let maxJump=0, maxHeadTurn=0, maxNeckTurn=0, finite=true;
    let previous=null;const distances=[];
    for(let i=0;i<600;i++){
      if(i===60){actor.setSpeaking(true);actor.setLookTarget(new THREE.Vector3(8,4,1));}
      if(i===120)actor.setThinking(true);
      if(i===180){actor.setThinking(false);actor.setSpeaking(false);actor.setPose('sitLean');}
      if(i===300){actor.setPose('stand');actor.setWalking(true);actor.setWalkSpeed(1.4);}
      if(i===420)actor.setWalking(false);
      if(i===480){actor.setHandshake(true);actor.setLookTarget(new THREE.Vector3(-8,.8,1));}
      actor.update(1/60,i/60);root.updateMatrixWorld(true);
      const rotations=[];root.traverse(node=>{if(node.name.startsWith("actor-"))rotations.push(node.rotation.x,node.rotation.y,node.rotation.z);finite&&=node.matrixWorld.elements.every(Number.isFinite);});
      if(previous)maxJump=Math.max(maxJump,...rotations.map((value,j)=>Math.abs(value-previous[j])));
      previous=rotations;
      distances.push(neck.getWorldPosition(new THREE.Vector3()).distanceTo(head.getWorldPosition(new THREE.Vector3())));
      maxHeadTurn=Math.max(maxHeadTurn,Math.abs(head.rotation.y));maxNeckTurn=Math.max(maxNeckTurn,Math.abs(neck.rotation.y));
    }
    const fps=[];
    for(const hz of [30,60,120]){const a=make();a.setThinking(true);a.setLookTarget(new THREE.Vector3(2,1.3,2));for(let i=1;i<=hz*2;i++)a.update(1/hz,i/hz);fps.push(a.root.getObjectByName('actor-shoulderR').rotation.x);}
    return {finite,maxJump,maxHeadTurn,maxNeckTurn,minDistance:Math.min(...distances),maxDistance:Math.max(...distances),fpsSpread:Math.max(...fps)-Math.min(...fps)};
  });
  expect(result.finite).toBe(true);
  expect(result.maxJump).toBeLessThan(.25); // Skeleton poses must ease across transitions.
  expect(result.maxHeadTurn).toBeLessThan(.31);
  expect(result.maxNeckTurn).toBeGreaterThan(result.maxHeadTurn);
  expect(result.maxNeckTurn).toBeLessThan(.46);
  expect(result.minDistance).toBeCloseTo(.105,6);
  expect(result.maxDistance).toBeCloseTo(.105,6);
  expect(result.fpsSpread).toBeLessThan(.01);
});

test('all imported rigs retain finite skinning, head scale and neck connections in seated and standing motion', async({page})=>{
  await prepare(page);
  const results=await page.evaluate(async()=>{
    const THREE=await import('three');
    const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
    const {createCharacter}=await import('/js/studio/character.js');
    const config=await(await fetch('/api/config')).json();const results=[];
    for(const person of config.sharks.filter(p=>p.look.model)){
      const model=(await new GLTFLoader().loadAsync(`/models/${person.look.model}/${person.look.model}-rigged.glb`)).scene;
      let head,neck;model.traverse(n=>{if(n.isBone&&n.name==='head')head=n;if(n.isBone&&n.name==='neck')neck=n;});
      const restLength=head.position.length();const actor=createCharacter({look:person.look,seed:3});actor.attachSkin(model);
      const length=head.position.length();let finite=true,maxSize=0;
      for(const pose of ['stand','sit','sitLean','sitCrossed','sitCrossLegs','sitSlouch']){
        actor.setPose(pose);actor.setSpeaking(true);actor.setLookTarget(new THREE.Vector3(-2,1.3,2));
        for(let i=0;i<90;i++)actor.update(1/60,i/60);
        actor.root.updateMatrixWorld(true);
        const bounds=new THREE.Box3();
        model.traverse(node=>{if(node.isSkinnedMesh){node.skeleton.update();const p=node.geometry.attributes.position;for(let i=0;i<p.count;i+=97){const v=node.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(node.matrixWorld);finite&&=v.toArray().every(Number.isFinite);bounds.expandByPoint(v);}}});
        maxSize=Math.max(maxSize,...bounds.getSize(new THREE.Vector3()).toArray());
      }
      results.push({model:person.look.model,restLength,length,scale:head.scale.toArray(),finite,maxSize,connection:head.parent===neck});
    }
    return results;
  });
  expect(results).toHaveLength(4);
  for(const r of results){expect(r.finite,r.model).toBe(true);expect(r.connection,r.model).toBe(true);expect(r.length).toBeGreaterThan(r.restLength*.75);expect(r.length).toBeLessThan(r.restLength);expect(r.scale.every(v=>Math.abs(v-1)<.0001)).toBe(true);expect(r.maxSize).toBeLessThan(2.2);}
});


test('walking keeps a support foot grounded and swings opposite arms and legs',async({page})=>{
 await prepare(page);
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');const {createCharacter}=await import('/js/studio/character.js');
  const actor=createCharacter({look:{},seed:4});actor.setWalking(true);actor.setWalkSpeed(1.3);
  let worstGroundError=0,opposite=0,samples=0;
  for(let i=0;i<360;i++){
   actor.update(1/60,i/60);actor.root.updateMatrixWorld(true);
   if(i<120)continue;
   const footY=['L','R'].map(side=>actor.root.getObjectByName('actor-foot'+side).getWorldPosition(new THREE.Vector3()).y);
   worstGroundError=Math.max(worstGroundError,Math.abs(Math.min(...footY)-.06));
   const hip=actor.root.getObjectByName('actor-hipL').rotation.x;
   const arm=actor.root.getObjectByName('actor-shoulderL').rotation.x-.05;
   if(Math.abs(hip)>.05){samples++;if(hip*arm<0)opposite++;}
  }
  return {worstGroundError,opposite,samples};
 });
 expect(result.worstGroundError).toBeLessThan(.005);
 expect(result.opposite).toBe(result.samples);
 expect(result.samples).toBeGreaterThan(100);
});
