import { expect, test } from './fixtures.mjs';

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
  for(const r of results){expect(r.finite,r.model).toBe(true);expect(r.connection,r.model).toBe(true);expect(r.length).toBeGreaterThan(r.restLength*.75);expect(r.length).toBeCloseTo(r.restLength, 7);expect(r.scale.every(v=>Math.abs(v-1)<.0001)).toBe(true);expect(r.maxSize).toBeLessThan(2.2);}
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


test('neck seams remain joined through turns while face geometry and cached assets stay unchanged', async({page})=>{
  await prepare(page);
  const results=await page.evaluate(async()=>{
    const THREE=await import('three');
    const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
    const {clone}=await import('three/addons/utils/SkeletonUtils.js');
    const {createCharacter}=await import('/js/studio/character.js');
    const results=[];
    for(const name of ['kevin','lori','barbara','mark']){
      const male=['kevin','mark'].includes(name);
      const source=(await new GLTFLoader().loadAsync(`/models/${name}/${name}-rigged.glb`)).scene;
      const originals=[];source.traverse(mesh=>{if(mesh.isMesh)originals.push({mesh,positions:mesh.geometry.attributes.position.array.slice(),weights:mesh.geometry.attributes.skinWeight?.array.slice(),normals:mesh.geometry.attributes.normal?.array.slice(),colors:mesh.geometry.attributes.color?.array.slice()});});
      const model=clone(source), actor=createCharacter({look:{model:name},pose:'stand'});
      actor.attachSkin(model);actor.root.updateMatrixWorld(true);
      let head;model.traverse(n=>{if(n.isBone&&n.name==='head')head=n;});
      const headY=head.getWorldPosition(new THREE.Vector3()).y;
      let faceDifference=0,changedNeck=0,invalidWeights=0;
      const surfaces=[];
      model.traverse(mesh=>{
        if(!mesh.isSkinnedMesh)return;
        const original=originals.find(x=>x.mesh.name===mesh.name);const positions=mesh.geometry.attributes.position;
        if(mesh.userData.neckJoinFaired)changedNeck+=mesh.userData.neckJoinFaired;
        const samples=[];
        for(let i=0;i<positions.count;i++){
          const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
          if(p.y>headY+(male?.10:.075)||(p.y>headY+.025&&p.z>(male?.103:.073)))for(let axis=0;axis<3;axis++)faceDifference=Math.max(faceDifference,Math.abs(positions.array[i*3+axis]-original.positions[i*3+axis]));
          if(!mesh.userData.neckWeightsAligned)continue;
          const w=mesh.geometry.attributes.skinWeight;const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];
          if(values.some(v=>!Number.isFinite(v)||v<0||v>1)||Math.abs(values.reduce((a,b)=>a+b)-1)>1e-5)invalidWeights++;
          if(p.y>headY-.018&&p.y<headY+.018&&Math.abs(p.x)<.065)samples.push({mesh,index:i,rest:p});
        }
        if(samples.length)surfaces.push(samples);
      });
      const pairs=[];
      for(let a=0;a<surfaces.length;a++)for(let b=a+1;b<surfaces.length;b++){
        const first=surfaces[a],second=surfaces[b];
        for(let i=0;i<first.length;i+=Math.max(1,Math.floor(first.length/160))){
          const v=first[i];let nearest=null,distance=.0025;
          for(const other of second){const d=v.rest.distanceTo(other.rest);if(d<distance){nearest=other;distance=d;}}
          if(nearest)pairs.push([v,nearest,distance]);
        }
      }
      let maxSeparation=0,maxDrift=0;
      for(const pose of ['stand','sit','sitLean'])for(const x of [-3,3]){
        actor.setPose(pose);actor.setSpeaking(true);actor.setLookTarget(new THREE.Vector3(x,1.25,1));
        for(let i=0;i<120;i++)actor.update(1/60,i/60);
        actor.root.updateMatrixWorld(true);model.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});
        for(const [a,b,rest]of pairs){
          const position=v=>v.mesh.getVertexPosition(v.index,new THREE.Vector3()).applyMatrix4(v.mesh.matrixWorld);
          const distance=position(a).distanceTo(position(b));maxSeparation=Math.max(maxSeparation,distance);maxDrift=Math.max(maxDrift,Math.abs(distance-rest));
        }
      }
      const sourceChanged=originals.some(({mesh,positions,weights,normals,colors})=>normals?.some((v,i)=>v!==mesh.geometry.attributes.normal.array[i])||colors?.some((v,i)=>v!==mesh.geometry.attributes.color.array[i])||positions.some((v,i)=>v!==mesh.geometry.attributes.position.array[i])||weights?.some((v,i)=>v!==mesh.geometry.attributes.skinWeight.array[i]));
      results.push({name,male,changedNeck,faceDifference,invalidWeights,pairs:pairs.length,maxSeparation,maxDrift,sourceChanged});
    }
    return results;
  });
  console.log("Neck seam measurements:", JSON.stringify(results));
  for(const r of results){
    expect(r.changedNeck,r.name).toBeGreaterThan(0);
    expect(r.faceDifference,r.name).toBe(0);
    expect(r.sourceChanged,r.name).toBe(false);
    expect(r.invalidWeights,r.name).toBe(0);
    if(!r.male)expect(r.pairs,r.name).toBeGreaterThan(5);
    expect(r.maxSeparation,JSON.stringify(r)).toBeLessThan(.004);
    expect(r.maxDrift,JSON.stringify(r)).toBeLessThan(.002);
  }
});


test('speaking imported actors never reactivate fallback geometry', async ({page}) => {
  await prepare(page);
  const result = await page.evaluate(async () => {
    const {GLTFLoader} = await import('three/addons/loaders/GLTFLoader.js');
    const {createCharacter} = await import('/js/studio/character.js');
    const leaked = [];
    for (const name of ['kevin', 'lori', 'barbara', 'mark']) {
      const actor = createCharacter({look:{model:name}});
      const fallback = [];
      actor.root.traverse(node => { if(node.isMesh) fallback.push(node); });
      actor.attachSkin((await new GLTFLoader().loadAsync(`/models/${name}/${name}-rigged.glb`)).scene);
      for (const pose of ['stand', 'sit', 'sitLean']) for (const speaking of [true, false, true]) {
        actor.setPose(pose); actor.setSpeaking(speaking);
        for (let frame=0; frame<90; frame++) {
          actor.update(1/60, frame/60);
          if(fallback.some(mesh => mesh.visible)) leaked.push({name,pose,speaking,frame});
        }
      }
    }
    // Procedural-only actors still need their original speaking mouth.
    const actor = createCharacter({look:{}});
    actor.setSpeaking(false); actor.update(1/60, 0);
    const hidden = []; actor.root.traverse(n => { if(n.isMesh && !n.visible) hidden.push(n); });
    actor.setSpeaking(true); actor.update(1/60, 1);
    return {leaked, proceduralMouthVisible:hidden.some(n=>n.visible)};
  });
  expect(result.leaked).toEqual([]);
  expect(result.proceduralMouthVisible).toBe(true);
});
