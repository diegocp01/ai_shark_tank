import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ORIGINAL_SHA256 = "dbea5f16f48a24347ac5a8f120a1ed15a950dbdffdd6ac899f47d756139f5638";
const BONE_PARENTS = {
  pelvis: null,
  spine: "pelvis",
  chest: "spine",
  neck: "chest",
  head: "neck",
  jaw: "head",
  "upperarm.L": "chest",
  "forearm.L": "upperarm.L",
  "hand.L": "forearm.L",
  "upperarm.R": "chest",
  "forearm.R": "upperarm.R",
  "hand.R": "forearm.R",
  "thigh.L": "pelvis",
  "shin.L": "thigh.L",
  "foot.L": "shin.L",
  "thigh.R": "pelvis",
  "shin.R": "thigh.R",
  "foot.R": "shin.R",
};
const BONE_NAMES = Object.keys(BONE_PARENTS).sort();
const MORPH_NAMES = ["mouthOpen", "blink", "smile", "frown"].sort();
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const COMPONENT_TYPES = {
  5120: { bytes: 1, read: "readInt8", divisor: 127 },
  5121: { bytes: 1, read: "readUInt8", divisor: 255 },
  5122: { bytes: 2, read: "readInt16LE", divisor: 32767 },
  5123: { bytes: 2, read: "readUInt16LE", divisor: 65535 },
  5125: { bytes: 4, read: "readUInt32LE", divisor: 4294967295 },
  5126: { bytes: 4, read: "readFloatLE" },
};

let rigPromise;
function loadRig() {
  rigPromise ??= (async () => {
    const bytes = await readFile(new URL("../../public/models/kevin/kevin-rigged.glb", import.meta.url));
    assert.ok(bytes.length > 20 && bytes.length < 12_000_000, `GLB byte budget: ${bytes.length}`);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, "GLB magic");
    assert.equal(bytes.readUInt32LE(4), 2, "glTF 2");
    assert.equal(bytes.readUInt32LE(8), bytes.length, "declared GLB length");
    const chunks = new Map();
    let offset = 12;
    while (offset < bytes.length) {
      assert.ok(offset + 8 <= bytes.length, "complete GLB chunk header");
      const length = bytes.readUInt32LE(offset);
      const type = bytes.readUInt32LE(offset + 4);
      assert.equal(length % 4, 0, "aligned GLB chunk");
      assert.ok(offset + 8 + length <= bytes.length, "chunk is contained in the GLB");
      assert.ok(!chunks.has(type), "no duplicate GLB chunk types");
      if (offset === 12) assert.equal(type, 0x4e4f534a, "JSON is the first GLB chunk");
      chunks.set(type, bytes.subarray(offset + 8, offset + 8 + length));
      offset += 8 + length;
    }
    assert.equal(offset, bytes.length, "no truncated or trailing chunks");
    assert.ok(chunks.has(0x4e4f534a) && chunks.has(0x004e4942), "JSON and binary chunks exist");
    const json = JSON.parse(chunks.get(0x4e4f534a).toString("utf8"));
    const bin = chunks.get(0x004e4942);
    assert.equal(json.asset.version, "2.0");
    assert.equal(json.buffers.length, 1, "one embedded GLB buffer");
    assert.equal(json.buffers[0].uri, undefined, "no external geometry buffer");
    assert.ok(bin.length >= json.buffers[0].byteLength && bin.length - json.buffers[0].byteLength < 4,
      "binary chunk has only alignment padding");
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
    );
    gltf.scene.updateMatrixWorld(true);
    const meshes = [];
    const bones = new Map();
    gltf.scene.traverse((node) => {
      if (node.isMesh) meshes.push(node);
      if (node.isBone) {
        // THREE sanitizes periods in names. The parser association preserves the glTF identity.
        const index = gltf.parser.associations.get(node)?.nodes;
        assert.ok(Number.isInteger(index), `${node.name} retains its source joint association`);
        const name = json.nodes[index].name;
        assert.ok(!bones.has(name), `unique runtime joint: ${name}`);
        bones.set(name, node);
      }
    });
    return { bytes, json, bin, gltf, meshes, bones };
  })();
  return rigPromise;
}

// Read the source accessors, not just THREE's attributes: GLTFLoader normalizes
// floating-point skin weights and could otherwise hide a broken exported asset.
function readAccessor({ json, bin }, index) {
  const accessor = json.accessors[index];
  assert.ok(accessor, `accessor ${index} exists`);
  const width = COMPONENTS[accessor.type];
  const component = COMPONENT_TYPES[accessor.componentType];
  assert.ok(width && component, `supported accessor layout: ${accessor.type}/${accessor.componentType}`);
  const values = new Float64Array(accessor.count * width);
  const readFromView = (viewIndex, byteOffset, count, target, targetWidth = width, type = component) => {
    const view = json.bufferViews[viewIndex];
    assert.ok(view && view.buffer === 0, "accessor uses the embedded buffer");
    const stride = view.byteStride ?? targetWidth * type.bytes;
    assert.ok(stride >= targetWidth * type.bytes, "accessor stride accommodates each element");
    const end = byteOffset + (count ? (count - 1) * stride + targetWidth * type.bytes : 0);
    assert.ok(byteOffset >= 0 && end <= view.byteLength, "accessor is contained in its buffer view");
    assert.ok((view.byteOffset ?? 0) + view.byteLength <= json.buffers[0].byteLength,
      "buffer view is contained in the declared buffer");
    for (let vertex = 0; vertex < count; vertex++) {
      for (let axis = 0; axis < targetWidth; axis++) {
        const offset = (view.byteOffset ?? 0) + byteOffset + vertex * stride + axis * type.bytes;
        target[vertex * targetWidth + axis] = bin[type.read](offset);
      }
    }
  };
  if (accessor.bufferView !== undefined) {
    readFromView(accessor.bufferView, accessor.byteOffset ?? 0, accessor.count, values);
  }
  if (accessor.sparse) {
    const { count, indices, values: sparseValues } = accessor.sparse;
    const indicesType = COMPONENT_TYPES[indices.componentType];
    assert.ok([5121, 5123, 5125].includes(indices.componentType), "unsigned sparse indices");
    const replacements = new Float64Array(count * width);
    const indicesArray = new Float64Array(count);
    readFromView(indices.bufferView, indices.byteOffset ?? 0, count, indicesArray, 1, indicesType);
    readFromView(sparseValues.bufferView, sparseValues.byteOffset ?? 0, count, replacements);
    let previous = -1;
    indicesArray.forEach((vertex, i) => {
      assert.ok(vertex > previous && vertex < accessor.count, "ordered, in-range sparse indices");
      values.set(replacements.subarray(i * width, (i + 1) * width), vertex * width);
      previous = vertex;
    });
  }
  if (accessor.normalized) {
    assert.ok(component.divisor, "only integer accessors may be normalized");
    for (let i = 0; i < values.length; i++) values[i] = Math.max(-1, values[i] / component.divisor);
  }
  return { accessor, values, width };
}

test("Kevin rig is a separate, bounded GLB and leaves the original asset byte-for-byte unchanged", async () => {
  const original = await readFile(new URL("../../public/models/kevin/kevin.glb", import.meta.url));
  assert.equal(createHash("sha256").update(original).digest("hex"), ORIGINAL_SHA256,
    "original Kevin GLB SHA-256");
  const rig = await loadRig();
  assert.notEqual(createHash("sha256").update(rig.bytes).digest("hex"), ORIGINAL_SHA256,
    "rig is not a renamed copy of the static asset");
});

test("Kevin exports exactly the 18 named joints and their required parent-child hierarchy", async () => {
  const { json, bones } = await loadRig();
  assert.ok(json.skins?.length > 0, "at least one glTF skin");
  const jointIndices = new Set(json.skins.flatMap((skin) => skin.joints));
  assert.equal(jointIndices.size, BONE_NAMES.length, "exactly 18 distinct exported joints");
  assert.deepEqual([...jointIndices].map((index) => json.nodes[index]?.name).sort(), BONE_NAMES);
  assert.deepEqual([...bones.keys()].sort(), BONE_NAMES, "all joints load as THREE.Bone objects");
  const parentIndices = new Map();
  json.nodes.forEach((node, parent) => {
    for (const child of node.children ?? []) {
      assert.ok(!parentIndices.has(child), `node ${child} has only one parent`);
      parentIndices.set(child, parent);
    }
  });
  for (const index of jointIndices) {
    const name = json.nodes[index].name;
    const expectedParent = BONE_PARENTS[name];
    const parent = parentIndices.get(index);
    const bone = bones.get(name);
    if (expectedParent === null) {
      assert.ok(!jointIndices.has(parent), "pelvis is the root joint; an armature wrapper is allowed");
      assert.ok(!bone.parent?.isBone, "runtime pelvis has no parent bone");
    } else {
      assert.equal(json.nodes[parent]?.name, expectedParent, `${name} exported parent`);
      assert.equal(bone.parent, bones.get(expectedParent), `${name} runtime parent`);
    }
  }
  for (const skin of json.skins) {
    assert.equal(new Set(skin.joints).size, skin.joints.length, "no duplicate joints within a skin");
  }
});

test("Kevin rest pose uses Y-up, +Z front, and +X for the character's left", async () => {
  const { bones } = await loadRig();
  const position = (name) => {
    assert.ok(bones.has(name), `joint ${name} exists`);
    return bones.get(name).getWorldPosition(new THREE.Vector3());
  };
  for (const [upper, lower] of [["head", "neck"], ["neck", "chest"], ["chest", "spine"], ["spine", "pelvis"]]) {
    assert.ok(position(upper).y > position(lower).y, `${upper} is above ${lower} in Y-up space`);
  }
  const pelvis = position("pelvis");
  for (const side of ["L", "R"]) {
    for (const part of ["upperarm", "forearm", "hand", "thigh", "shin", "foot"]) {
      const x = position(`${part}.${side}`).x - pelvis.x;
      assert.ok(side === "L" ? x > 0 : x < 0, `${part}.${side} is on the correct X side`);
    }
    assert.ok(position(`thigh.${side}`).y > position(`shin.${side}`).y, `${side} knee is below hip`);
    assert.ok(position(`shin.${side}`).y > position(`foot.${side}`).y, `${side} ankle is below knee`);
  }
  assert.ok(position("jaw").z > position("head").z, "jaw pivot is toward the +Z-facing front");
});

test("Kevin source skin weights are finite, nonnegative, normalized, and use valid joint indices", async () => {
  const rig = await loadRig();
  let primitives = 0;
  for (const node of rig.json.nodes) {
    if (node.mesh === undefined || node.skin === undefined) continue;
    const skin = rig.json.skins[node.skin];
    assert.ok(skin, `${node.name} references a valid skin`);
    for (const primitive of rig.json.meshes[node.mesh].primitives) {
      primitives++;
      const joints = readAccessor(rig, primitive.attributes.JOINTS_0);
      const weights = readAccessor(rig, primitive.attributes.WEIGHTS_0);
      const positions = rig.json.accessors[primitive.attributes.POSITION];
      assert.equal(joints.width, 4, "four joint slots per vertex");
      assert.equal(weights.width, 4, "four weight slots per vertex");
      assert.equal(joints.accessor.count, positions.count, "joint count matches vertices");
      assert.equal(weights.accessor.count, positions.count, "weight count matches vertices");
      assert.ok([5121, 5123].includes(joints.accessor.componentType), "unsigned joint indices");
      assert.ok(!joints.accessor.normalized, "joint indices must not be normalized");
      assert.equal(primitive.attributes.JOINTS_1, undefined, "no unsupported second joint set in THREE runtime");
      assert.equal(primitive.attributes.WEIGHTS_1, undefined, "no unsupported second weight set in THREE runtime");
      for (let vertex = 0; vertex < positions.count; vertex++) {
        let total = 0;
        for (let slot = 0; slot < 4; slot++) {
          const index = vertex * 4 + slot;
          const joint = joints.values[index];
          const weight = weights.values[index];
          assert.ok(Number.isInteger(joint) && joint >= 0 && joint < skin.joints.length,
            `${node.name} vertex ${vertex}: valid joint ${joint}`);
          assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1,
            `${node.name} vertex ${vertex}: finite nonnegative weight ${weight}`);
          total += weight;
        }
        assert.ok(Math.abs(total - 1) < 1e-4, `${node.name} vertex ${vertex}: normalized weight sum ${total}`);
      }
    }
  }
  assert.ok(primitives > 0, "skinned primitives exist in the source GLB");
});

test("Kevin loads actual skinned meshes with valid inverse bind matrices and runtime weights", async () => {
  const { meshes, bones } = await loadRig();
  const skinned = meshes.filter((mesh) => mesh.isSkinnedMesh);
  assert.ok(skinned.length > 0, "THREE.SkinnedMesh geometry exists");
  for (const mesh of skinned) {
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    assert.ok(position?.count > 0 && skinIndex && skinWeight, `${mesh.name} has skin attributes`);
    assert.equal(skinIndex.count, position.count);
    assert.equal(skinWeight.count, position.count);
    assert.equal(skinIndex.itemSize, 4);
    assert.equal(skinWeight.itemSize, 4);
    const skeleton = mesh.skeleton;
    assert.ok(skeleton?.bones.length > 0, `${mesh.name} has a runtime skeleton`);
    assert.equal(skeleton.boneInverses.length, skeleton.bones.length);
    assert.ok(skeleton.bones.every((bone) => [...bones.values()].includes(bone)), "skin references the exported bones");
    for (const matrix of [mesh.bindMatrix, mesh.bindMatrixInverse, ...skeleton.boneInverses]) {
      assert.ok(matrix.elements.every(Number.isFinite), `${mesh.name} finite bind matrix`);
      assert.ok(Math.abs(matrix.determinant()) > 1e-12, `${mesh.name} invertible bind matrix`);
    }
    const indices = new THREE.Vector4();
    const weights = new THREE.Vector4();
    for (let vertex = 0; vertex < position.count; vertex++) {
      indices.fromBufferAttribute(skinIndex, vertex);
      weights.fromBufferAttribute(skinWeight, vertex);
      assert.ok(indices.toArray().every((joint) => Number.isInteger(joint) && joint >= 0 && joint < skeleton.bones.length));
      assert.ok(weights.toArray().every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 1));
      assert.ok(Math.abs(weights.x + weights.y + weights.z + weights.w - 1) < 1e-4);
    }
  }
});

test("Kevin exposes exactly four working facial morphs, without exporting Basis", async () => {
  const rig = await loadRig();
  const morphed = rig.meshes.filter((mesh) => Object.keys(mesh.morphTargetDictionary ?? {}).length > 0);
  assert.ok(morphed.length > 0, "a facial morph target dictionary exists");
  const nonzero = new Map(MORPH_NAMES.map((name) => [name, false]));
  let headSkinnedMorph = false;
  for (const mesh of morphed) {
    const dictionary = mesh.morphTargetDictionary;
    assert.deepEqual(Object.keys(dictionary).sort(), MORPH_NAMES, `${mesh.name} exact morph names (no Basis)`);
    assert.deepEqual(Object.values(dictionary).sort((a, b) => a - b), [0, 1, 2, 3], "four distinct morph indices");
    assert.equal(mesh.morphTargetInfluences.length, MORPH_NAMES.length);
    assert.ok(mesh.morphTargetInfluences.every(Number.isFinite), "finite default morph influences");
    assert.equal(mesh.geometry.morphTargetsRelative, true, "glTF relative morph displacements");
    assert.equal(mesh.geometry.morphAttributes.position?.length, MORPH_NAMES.length, "four position morph targets");
    for (const [name, index] of Object.entries(dictionary)) {
      const delta = mesh.geometry.morphAttributes.position[index];
      assert.equal(delta.count, mesh.geometry.attributes.position.count, `${name} vertex count`);
      assert.equal(delta.itemSize, 3, `${name} displacement dimensions`);
      for (let vertex = 0; vertex < delta.count; vertex++) {
        const xyz = [delta.getX(vertex), delta.getY(vertex), delta.getZ(vertex)];
        assert.ok(xyz.every(Number.isFinite), `${mesh.name}/${name} finite delta at vertex ${vertex}`);
        if (!xyz.some((value) => Math.abs(value) > 1e-8)) continue;
        nonzero.set(name, true);
        if (!mesh.isSkinnedMesh) continue;
        const indices = new THREE.Vector4().fromBufferAttribute(mesh.geometry.attributes.skinIndex, vertex);
        const weights = new THREE.Vector4().fromBufferAttribute(mesh.geometry.attributes.skinWeight, vertex);
        headSkinnedMorph ||= indices.toArray().some((joint, slot) =>
          weights.getComponent(slot) > 0 && [rig.bones.get("head"), rig.bones.get("jaw")].includes(mesh.skeleton.bones[joint]));
      }
    }
  }
  for (const [name, changed] of nonzero) assert.ok(changed, `${name} has nonzero exported displacement`);
  assert.ok(headSkinnedMorph, "facial morph deltas affect geometry weighted to the head or jaw");
  // Rigid eyes, brows, and hair do not need their own facial shape keys.
});

test("Kevin rig retains finite, detailed, human-scale geometry", async () => {
  const { gltf, meshes } = await loadRig();
  let triangles = 0;
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position;
    assert.ok(positions?.count > 0, `${mesh.name} contains vertices`);
    for (const coordinate of positions.array) assert.ok(Number.isFinite(coordinate), `${mesh.name} finite geometry`);
    for (const attribute of Object.values(mesh.geometry.attributes)) {
      for (const value of attribute.array) assert.ok(Number.isFinite(value), `${mesh.name} finite vertex attribute`);
    }
    assert.ok(mesh.matrixWorld.elements.every(Number.isFinite), `${mesh.name} finite world transform`);
    const indices = mesh.geometry.index;
    if (indices) {
      for (const index of indices.array) assert.ok(Number.isInteger(index) && index >= 0 && index < positions.count);
    }
    const corners = indices?.count ?? positions.count;
    assert.equal(corners % 3, 0, `${mesh.name} complete triangles`);
    triangles += corners / 3;
  }
  assert.ok(triangles > 1000 && triangles < 500000, `real-time detailed geometry: ${triangles} triangles`);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), "finite skinned bounds");
  assert.ok(size.y > 1.5 && size.y < 2.1, `human height: ${size.y}`);
  assert.ok(size.x > 0.2 && size.x < 2.2, `human width: ${size.x}`);
  assert.ok(size.z > 0.1 && size.z < 1, `human depth: ${size.z}`);
  assert.ok(Math.abs(bounds.min.y) < 0.05, `feet rest near the ground: ${bounds.min.y}`);
});

function updateRuntimeSkin(rig) {
  rig.gltf.scene.updateMatrixWorld(true);
  for (const skeleton of new Set(rig.meshes.filter((mesh) => mesh.isSkinnedMesh).map((mesh) => mesh.skeleton))) {
    skeleton.update();
  }
}

function skinnedWorldPosition(mesh, vertex) {
  const position = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex);
  return mesh.applyBoneTransform(vertex, position).applyMatrix4(mesh.matrixWorld);
}

test("Kevin forearm rotation deforms its weighted vertices without dragging the torso", async () => {
  const rig = await loadRig();
  updateRuntimeSkin(rig);
  const forearm = rig.bones.get("forearm.L");
  assert.ok(forearm, "left forearm exists");
  const torsoBones = new Set(["pelvis", "spine", "chest"].map((name) => rig.bones.get(name)));
  const armBones = new Set(BONE_NAMES.filter((name) => /^(upperarm|forearm|hand)\./.test(name))
    .map((name) => rig.bones.get(name)));
  const rotationAxis = new THREE.Vector3(1, 0, 0).transformDirection(forearm.matrixWorld);
  const pivot = forearm.getWorldPosition(new THREE.Vector3());
  const forearmSamples = [];
  const torsoSamples = [];
  const indices = new THREE.Vector4();
  const weights = new THREE.Vector4();
  for (const mesh of rig.meshes.filter((node) => node.isSkinnedMesh)) {
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    for (let vertex = 0; vertex < position.count; vertex++) {
      if (forearmSamples.length >= 32 && torsoSamples.length >= 32) break;
      indices.fromBufferAttribute(skinIndex, vertex);
      weights.fromBufferAttribute(skinWeight, vertex);
      let forearmWeight = 0;
      let torsoWeight = 0;
      let armWeight = 0;
      for (let slot = 0; slot < 4; slot++) {
        const bone = mesh.skeleton.bones[indices.getComponent(slot)];
        const weight = weights.getComponent(slot);
        if (bone === forearm) forearmWeight += weight;
        if (torsoBones.has(bone)) torsoWeight += weight;
        if (armBones.has(bone)) armWeight += weight;
      }
      if (forearmSamples.length < 32 && forearmWeight > 1 - 1e-6) {
        const before = skinnedWorldPosition(mesh, vertex);
        const offset = before.clone().sub(pivot);
        const radius = offset.clone().addScaledVector(rotationAxis, -offset.dot(rotationAxis)).length();
        // Points on the rotation axis legitimately do not move.
        if (radius > 0.01) forearmSamples.push({ mesh, vertex, before });
      }
      if (torsoSamples.length < 32 && torsoWeight > 1 - 1e-6 && armWeight === 0) {
        torsoSamples.push({ mesh, vertex, before: skinnedWorldPosition(mesh, vertex) });
      }
    }
  }
  assert.ok(forearmSamples.length >= 8, "multiple fully forearm-weighted vertices exist away from the rotation axis");
  assert.ok(torsoSamples.length >= 8, "multiple torso vertices have no arm influence");
  const originalQuaternion = forearm.quaternion.clone();
  const inverseBefore = forearm.matrixWorld.clone().invert();
  try {
    forearm.rotateX(Math.PI / 4);
    updateRuntimeSkin(rig);
    const expectedTransform = forearm.matrixWorld.clone().multiply(inverseBefore);
    for (const { mesh, vertex, before } of forearmSamples) {
      const after = skinnedWorldPosition(mesh, vertex);
      assert.ok(after.distanceTo(before) > 0.005, `${mesh.name} vertex ${vertex} responds to forearm rotation`);
      assert.ok(after.distanceTo(before.clone().applyMatrix4(expectedTransform)) < 1e-5,
        `${mesh.name} vertex ${vertex} follows the forearm's actual transform`);
    }
    for (const { mesh, vertex, before } of torsoSamples) {
      assert.ok(skinnedWorldPosition(mesh, vertex).distanceTo(before) < 1e-7,
        `${mesh.name} torso vertex ${vertex} remains stationary`);
    }
  } finally {
    forearm.quaternion.copy(originalQuaternion);
    updateRuntimeSkin(rig);
  }
});

test("Kevin eyes, brows, and hair are rigidly weighted to the head and follow its rotation", async () => {
  const rig = await loadRig();
  updateRuntimeSkin(rig);
  const head = rig.bones.get("head");
  assert.ok(head, "head joint exists");
  const categories = new Map([
    ["eyes", /\beye\b/i],
    ["irises", /^Iris(?:\.|$)/i],
    ["pupils", /^Pupil(?:\.|$)/i],
    ["brows", /\bbrow\b/i],
    ["hair", /\b(?:hair|temple)\b/i],
  ]);
  const featureMeshes = new Set();
  for (const [category, pattern] of categories) {
    const matches = rig.meshes.filter((mesh) => pattern.test(mesh.userData.name ?? mesh.name));
    assert.ok(matches.length > 0, `identifiable ${category} meshes exist`);
    for (const mesh of matches) featureMeshes.add(mesh);
  }
  const samples = [];
  const indices = new THREE.Vector4();
  const weights = new THREE.Vector4();
  for (const mesh of featureMeshes) {
    assert.ok(mesh.isSkinnedMesh, `${mesh.name} is attached to the runtime skeleton`);
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    for (let vertex = 0; vertex < position.count; vertex++) {
      indices.fromBufferAttribute(skinIndex, vertex);
      weights.fromBufferAttribute(skinWeight, vertex);
      let headWeight = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights.getComponent(slot);
        if (mesh.skeleton.bones[indices.getComponent(slot)] === head) headWeight += weight;
        else assert.equal(weight, 0, `${mesh.name} vertex ${vertex} has no non-head influence`);
      }
      assert.ok(Math.abs(headWeight - 1) < 1e-6, `${mesh.name} vertex ${vertex} is rigidly head-weighted`);
    }
    for (const vertex of new Set([0, Math.floor(position.count / 2), position.count - 1])) {
      samples.push({ mesh, vertex, before: skinnedWorldPosition(mesh, vertex) });
    }
  }
  const originalQuaternion = head.quaternion.clone();
  const inverseBefore = head.matrixWorld.clone().invert();
  try {
    head.rotateY(Math.PI / 6);
    updateRuntimeSkin(rig);
    const expectedTransform = head.matrixWorld.clone().multiply(inverseBefore);
    let movingSamples = 0;
    for (const { mesh, vertex, before } of samples) {
      const after = skinnedWorldPosition(mesh, vertex);
      assert.ok(after.distanceTo(before.clone().applyMatrix4(expectedTransform)) < 1e-5,
        `${mesh.name} vertex ${vertex} follows head rotation without skin deformation`);
      if (after.distanceTo(before) > 1e-4) movingSamples++;
    }
    assert.ok(movingSamples > 0, "the head rotation visibly moves attached feature geometry");
  } finally {
    head.quaternion.copy(originalQuaternion);
    updateRuntimeSkin(rig);
  }
});
