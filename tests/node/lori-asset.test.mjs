import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const parents = { pelvis: null, spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head' };
for (const side of ['L', 'R']) {
  Object.assign(parents, {
    ['upperarm.' + side]: 'chest',
    ['forearm.' + side]: 'upperarm.' + side,
    ['hand.' + side]: 'forearm.' + side,
    ['thigh.' + side]: 'pelvis',
    ['shin.' + side]: 'thigh.' + side,
    ['foot.' + side]: 'shin.' + side,
  });
}

let asset;
async function load() {
  return asset ??= (async () => {
    const bytes = await readFile(new URL('../../public/models/lori/lori-rigged.glb', import.meta.url));
    assert.ok(bytes.length < 12e6, 'runtime byte budget');
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
    assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2.0');
    assert.equal(bytes.readUInt32LE(8), bytes.length, 'complete GLB');
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
    );
    return { json, gltf };
  })();
}

test('Lori exports isolated 18-bone skeleton and four facial controls', async () => {
  const { json, gltf } = await load();
  const joints = new Set(json.skins.flatMap(skin => skin.joints));
  assert.equal(joints.size, 18);
  assert.deepEqual([...joints].map(i => json.nodes[i].name).sort(), Object.keys(parents).sort());
  for (const index of joints) {
    const node = json.nodes[index];
    const expected = parents[node.name];
    const parent = json.nodes.find(candidate => candidate.children?.includes(index));
    if (expected) assert.equal(parent.name, expected);
    else assert.equal(node.name, 'pelvis');
  }
  const morphs = new Set(json.meshes.flatMap(mesh => mesh.extras?.targetNames ?? []));
  assert.deepEqual([...morphs].sort(), ['mouthOpen', 'blink', 'smile', 'frown'].sort());
  assert.equal(gltf.animations.length, 0, 'standing bind pose, not baked QA animation');
});

test('Lori skin weights are finite, normalized, bounded and character-sized', async () => {
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
      for (const joint of [indices.getX(index), indices.getY(index), indices.getZ(index), indices.getW(index)]) {
        assert.ok(joint < 18);
      }
      vertices++;
    }
  });
  assert.ok(vertices > 1000);
  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  assert.ok(size.y > 1.6 && size.y < 1.9, `metre-scale height ${size.y}`);
  assert.ok(size.x < 1 && size.z < .6);
  // Three.js sanitizes periods in animation/bone node names; raw names are tested above.
  const left = gltf.scene.getObjectByName('thighL');
  const right = gltf.scene.getObjectByName('thighR');
  assert.ok(left.getWorldPosition(new THREE.Vector3()).x > right.getWorldPosition(new THREE.Vector3()).x);
});

test('Lori is not silently integrated over the existing cast', async () => {
  const source = await readFile(new URL('../../public/js/app.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('models/lori'));
});
