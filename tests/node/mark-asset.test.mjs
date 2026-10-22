import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const parents = { pelvis: null, spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head' };
const controls = ['mouthOpen', 'blink', 'smile', 'frown'];
for (const side of ['L', 'R']) {
  Object.assign(parents, {
    ['upperarm.' + side]: 'chest', ['forearm.' + side]: 'upperarm.' + side,
    ['hand.' + side]: 'forearm.' + side, ['thigh.' + side]: 'pelvis',
    ['shin.' + side]: 'thigh.' + side, ['foot.' + side]: 'shin.' + side,
  });
}
let asset;
async function load() {
  return asset ??= (async () => {
    const bytes = await readFile(new URL('../../public/models/mark/mark-rigged.glb', import.meta.url));
    assert.ok(bytes.length < 12e6, 'runtime byte budget');
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    gltf.scene.updateMatrixWorld(true);
    return { json, gltf };
  })();
}

test('Mark exports exact 18-bone hierarchy with neutral facial controls', async () => {
  const { json, gltf } = await load();
  assert.ok(json.skins?.length);
  const joints = new Set(json.skins.flatMap(skin => skin.joints));
  assert.equal(joints.size, 18);
  assert.deepEqual([...joints].map(i => json.nodes[i].name).sort(), Object.keys(parents).sort());
  for (const index of joints) {
    const node = json.nodes[index];
    const parent = json.nodes.find(candidate => candidate.children?.includes(index));
    if (parents[node.name]) assert.equal(parent?.name, parents[node.name]);
    else assert.ok(!parent || !joints.has(json.nodes.indexOf(parent)), 'pelvis is sole joint root');
  }
  assert.deepEqual([...new Set(json.meshes.flatMap(mesh => mesh.extras?.targetNames ?? []))].sort(), [...controls].sort());
  assert.equal(gltf.animations.length, 0, 'QA poses must not be exported');
  gltf.scene.traverse(object => {
    for (const weight of object.morphTargetInfluences ?? []) assert.equal(weight, 0, 'neutral default expression');
    if (object.isSkinnedMesh) {
      // A jaw rotation baked into export would violate its rest/inverse-bind identity.
      const index = object.skeleton.bones.findIndex(bone => bone.name === 'jaw');
      assert.ok(index >= 0);
      const rest = object.skeleton.bones[index].matrixWorld.clone().multiply(object.skeleton.boneInverses[index]);
      const identity = new THREE.Matrix4();
      assert.ok(rest.elements.every((value, i) => Math.abs(value - identity.elements[i]) < 1e-4), 'jaw is in neutral bind pose');
    }
  });
});

test('Mark morphs have finite nonzero position deltas on a connected facial mesh', async () => {
  const { gltf } = await load();
  const faces = [];
  gltf.scene.traverse(object => {
    if (object.isMesh && controls.every(name => name in (object.morphTargetDictionary ?? {}))) faces.push(object);
  });
  assert.ok(faces.length, 'face with all four controls');
  const face = faces.find(object => /anatomical.?face/i.test(object.name));
  assert.ok(face, 'named connected anatomical face, not accessory brows');
  assert.ok(face.geometry.attributes.position.count > 1000, 'anatomical face topology');
  for (const name of controls) {
    const delta = face.geometry.morphAttributes.position[face.morphTargetDictionary[name]];
    assert.ok(delta, `${name} position target`);
    assert.equal(delta.count, face.geometry.attributes.position.count);
    let affected = 0, maximum = 0;
    for (let i = 0; i < delta.count; i++) {
      const values = [delta.getX(i), delta.getY(i), delta.getZ(i)];
      assert.ok(values.every(Number.isFinite));
      const distance = Math.hypot(...values);
      if (distance > 1e-7) affected++;
      maximum = Math.max(maximum, distance);
    }
    assert.ok(affected > 10, `${name} affects multiple facial vertices`);
    assert.ok(maximum > 1e-4 && maximum < .15, `${name} usable metre-scale deformation: ${maximum}`);
  }
});

test('Mark has normalized skin weights and metre-scale standing Y-up, +Z-forward, left +X coordinates', async () => {
  const { gltf } = await load();
  let vertices = 0;
  gltf.scene.traverse(object => {
    if (!object.isSkinnedMesh) return;
    const { position, skinWeight: weights, skinIndex: indices } = object.geometry.attributes;
    assert.ok(weights && indices);
    for (let index = 0; index < position.count; index++) {
      const values = [weights.getX(index), weights.getY(index), weights.getZ(index), weights.getW(index)];
      assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
      assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-4);
      for (const joint of [indices.getX(index), indices.getY(index), indices.getZ(index), indices.getW(index)]) assert.ok(Number.isInteger(joint) && joint >= 0 && joint < 18);
      vertices++;
    }
  });
  assert.ok(vertices > 1000);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(size.y > 1.7 && size.y < 2.05, `metre-scale height ${size.y}`);
  assert.ok(size.x < 1 && size.z < .6);
  // GLTFLoader sanitizes periods in bone names; raw contract names are checked above.
  const point = name => {
    const bone = gltf.scene.getObjectByName(name.replaceAll('.', ''));
    assert.ok(bone, `bone ${name}`);
    return bone.getWorldPosition(new THREE.Vector3());
  };
  assert.ok(point('thigh.L').x > point('thigh.R').x);
  assert.ok(point('upperarm.L').x > point('upperarm.R').x);
  for (const side of ['L', 'R']) {
    const hip = point('thigh.' + side), knee = point('shin.' + side), ankle = point('foot.' + side);
    assert.ok(hip.y > knee.y && knee.y > ankle.y, 'standing rest legs');
    assert.ok(Math.abs(hip.z - knee.z) < .08 && Math.abs(knee.z - ankle.z) < .08, 'not a baked seated pose');
  }
  assert.ok(point('jaw').z > point('head').z, 'jaw landmark is anterior in +Z');
});

test('Mark remains an asset-only addition without application integration', async () => {
  const source = await readFile(new URL('../../public/js/app.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('models/mark'));
});
