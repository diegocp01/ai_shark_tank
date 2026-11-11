// Drives a rigged GLB character (Blender armature with the bone names below)
// from the procedural joint rig in character.js. The procedural joints stay
// invisible and keep doing all the animation (poses, walking, gestures, gaze);
// every frame each bone copies its joint's orientation. Because the Blender rest
// pose stands with arms slightly out, each limb gets a rest correction so that
// "joint at zero" means the limb hangs straight down, as it does procedurally.

import * as THREE from "three";
import { surfaceTexture } from "./textures.js";

// Bone -> procedural joint. Bones that share a joint keep their rest offset.
const BONE_TO_JOINT = {
  pelvis: "pelvis",
  spine: "spine",
  chest: "spine",
  neck: "neck",
  head: "head",
  jaw: "head",
  "upperarm.L": "shoulderL",
  "forearm.L": "elbowL",
  "hand.L": "elbowL",
  "upperarm.R": "shoulderR",
  "forearm.R": "elbowR",
  "hand.R": "elbowR",
  "thigh.L": "hipL",
  "shin.L": "kneeL",
  "foot.L": "kneeL",
  "thigh.R": "hipR",
  "shin.R": "kneeR",
  "foot.R": "kneeR",
};

// Limb bones that should hang straight down when their joint is at rest,
// with the child bone that marks the limb's far end.
const STRAIGHTEN = {
  "upperarm.L": "forearm.L",
  "forearm.L": "hand.L",
  "upperarm.R": "forearm.R",
  "forearm.R": "hand.R",
  "thigh.L": "shin.L",
  "shin.L": "foot.L",
  "thigh.R": "shin.R",
  "shin.R": "foot.R",
};
const INHERIT_CORRECTION = { "hand.L": "forearm.L", "hand.R": "forearm.R", "foot.L": "shin.L", "foot.R": "shin.R" };

const PROCEDURAL_STAND_PELVIS_Y = 0.93;
const DOWN = new THREE.Vector3(0, -1, 0);

function findBone(model, name) {
  let found = null;

  // Exporters turn "upperarm.L" into "upperarmL" or "upperarm_L"; accept all.
  const wanted = name.replace(/[._]/g, "").toLowerCase();
  model.traverse((node) => {
    if (!found && node.isBone && node.name.replace(/[._]/g, "").toLowerCase() === wanted) {
      found = node;
    }
  });
  return found;
}

export function hasRig(model) {
  return Boolean(findBone(model, "pelvis") && findBone(model, "head") && findBone(model, "upperarm.L"));
}

// Scale skin to the studio's tone, keeping the model's painted variation.
function matchSkinTone(model, tone) {
  const target = new THREE.Color(tone);

  model.traverse((node) => {
    // Skin meshes: Kevin's "...Skin_|_<tone>" and "..._anatomical_head", Lori's
    // "..._anatomical_face" and "..._warm_peach_skin". Every Kevin part is prefixed
    // "Kevin_skin_", so match case-sensitively.
    if (!node.isMesh || !/Skin_\|_|anatomical_(head|face)|_skin$/.test(node.name)) {
      return;
    }

    const colors = node.geometry.attributes.color;

    if (colors && node.material.vertexColors) {
      const average = new THREE.Color(0, 0, 0);

      for (let index = 0; index < colors.count; index += 1) {
        average.r += colors.getX(index) / colors.count;
        average.g += colors.getY(index) / colors.count;
        average.b += colors.getZ(index) / colors.count;
      }

      node.material.color.setRGB(target.r / average.r, target.g / average.g, target.b / average.b);
    } else {
      node.material.color.copy(target);
    }
  });
}

// Fair the lower neck of the authored female head meshes into their existing
// torso join. The previous short cylindrical fit ended in a shelf below the jaw.
// Work only below the jaw and behind the chin; preserve all facial vertices and
// expression deltas. No third-party geometry is copied into the character.
function fairNeckJoin(mesh, geometry, root, skull) {
  if (!/Lori|Barbara/i.test(mesh.name) || !mesh.morphTargetDictionary) return;
  const positions = geometry.attributes.position;
  const localToActor = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const actorToLocal = localToActor.clone().invert();
  const p = new THREE.Vector3();
  const centerZ = 0.008; // Authored collar centre, in metres / glTF +Z forward.
  const changed = [];
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i).applyMatrix4(localToActor);
    const blend = 1 - THREE.MathUtils.smoothstep(p.y, skull.y + 0.025, skull.y + 0.075);
    // The front of the jaw/chin remains the original likeness.
    const preserveChin = THREE.MathUtils.smoothstep(p.z - centerZ, 0.035, 0.065);
    const amount = blend * (1 - preserveChin);
    if (p.y < skull.y - 0.025 || amount <= 0) continue;
    const angle = Math.atan2(p.x, p.z - centerZ);
    const neckX = 0.041 * Math.sin(angle), neckZ = centerZ + 0.039 * Math.cos(angle);
    p.x = THREE.MathUtils.lerp(p.x, neckX, amount);
    p.z = THREE.MathUtils.lerp(p.z, neckZ, amount);
    p.applyMatrix4(actorToLocal);
    positions.setXYZ(i, p.x, p.y, p.z);
    changed.push(i);
  }
  if (!changed.length) return;
  const originalNormals = geometry.attributes.normal.clone();
  geometry.computeVertexNormals();
  const repairedNormals = geometry.attributes.normal;
  geometry.setAttribute("normal", originalNormals);
  for (const i of changed) originalNormals.setXYZ(i, repairedNormals.getX(i), repairedNormals.getY(i), repairedNormals.getZ(i));
  mesh.userData.neckJoinFaired = changed.length;
}

// The authored faces and torso necks overlap, but their original weights were
// assigned independently. Use the same bind-space blend on every skin surface
// at the join, so a head turn cannot peel one surface away from the other.
// Facial geometry, expression deltas, bone positions and inverse binds stay intact.
function alignNeckWeights(model, root) {
  const neck = findBone(model, "neck"), head = findBone(model, "head"), chest = findBone(model, "chest");
  if (!neck || !head || !chest) return;
  root.updateMatrixWorld(true);
  const base = root.worldToLocal(neck.getWorldPosition(new THREE.Vector3()));
  const skull = root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  const length = skull.y - base.y;
  if (length < 0.04 || length > 0.18) return;
  const upper = skull.y + 0.035;
  const p = new THREE.Vector3();
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh || mesh.userData.neckWeightsAligned) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Clothes, pearls, hair and rigid facial features retain their authored rig.
    if (!materials.every(material => /skin|anatomy/i.test(material.name) && !/crease/i.test(material.name))) return;
    const bones = mesh.skeleton.bones;
    const ids = [bones.indexOf(chest), bones.indexOf(neck), bones.indexOf(head)];
    if (ids.some(id => id < 0)) return;
    const geometry = mesh.geometry.clone(); // Loaded skins share geometry across actors.
    fairNeckJoin(mesh, geometry, root, skull);
    const positions = geometry.attributes.position, weights = geometry.attributes.skinWeight, indices = geometry.attributes.skinIndex;
    let changed = 0;
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      root.worldToLocal(p);
      if (p.y < base.y || p.y > upper || Math.abs(p.x - base.x) > 0.10 || Math.abs(p.z - base.z) > 0.11) continue;
      const headWeight = THREE.MathUtils.smoothstep(p.y, base.y + length * 0.6, upper);
      const neckWeight = (1 - headWeight) * THREE.MathUtils.smoothstep(p.y, base.y, base.y + length * 0.6);
      indices.setXYZW(i, ids[0], ids[1], ids[2], 0);
      weights.setXYZW(i, 1 - headWeight - neckWeight, neckWeight, headWeight, 0);
      changed++;
    }
    if (changed) {
      mesh.geometry = geometry;
      mesh.userData.neckWeightsAligned = changed;
    } else geometry.dispose();
  });
}

export function createRetarget(model, { root, joints, skinTone = null }) {
  alignNeckWeights(model, root);
  const pores = surfaceTexture("skin");
  const weave = surfaceTexture("fabric");
  model.traverse(node => {
    if (!node.isMesh) return;
    // SkeletonUtils preserves material references; keep each actor's finish local.
    const finish = source => {
      const material = source.clone();
      if (/skin|anatomy/i.test(material.name) && !/crease/i.test(material.name)) {
        material.bumpMap = pores; material.bumpScale = 0.00016; material.roughness = 0.54;
      } else if (/suit|shirt|jeans|dress|fabric|cotton/i.test(material.name)) {
        material.bumpMap = weave; material.bumpScale = 0.0006; material.roughness = Math.max(material.roughness, 0.72);
      }
      return material;
    };
    node.material = Array.isArray(node.material) ? node.material.map(finish) : finish(node.material);
  });
  if (skinTone) {
    matchSkinTone(model, skinTone);
  }

  const rootInverse = new THREE.Quaternion();
  const scratch = new THREE.Quaternion();
  const bones = [];

  root.updateMatrixWorld(true);
  rootInverse.copy(root.getWorldQuaternion(new THREE.Quaternion())).invert();

  for (const [name, jointName] of Object.entries(BONE_TO_JOINT)) {
    const bone = findBone(model, name);

    if (bone && joints[jointName]) {
      bones.push({ name, bone, joint: joints[jointName], restWorld: rootInverse.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion())), correction: new THREE.Quaternion() });
    }
  }

  const byName = Object.fromEntries(bones.map((entry) => [entry.name, entry]));
  const head = new THREE.Vector3();
  const tail = new THREE.Vector3();

  for (const [name, childName] of Object.entries(STRAIGHTEN)) {
    const entry = byName[name];
    const child = byName[childName];

    if (entry && child) {
      entry.bone.getWorldPosition(head);
      child.bone.getWorldPosition(tail);
      const direction = tail.sub(head).applyQuaternion(rootInverse).normalize();
      entry.correction.setFromUnitVectors(direction, DOWN);
    }
  }

  for (const [name, parentName] of Object.entries(INHERIT_CORRECTION)) {
    if (byName[name] && byName[parentName]) {
      byName[name].correction.copy(byName[parentName].correction);
    }
  }

  // Parents before children, so each bone's parent orientation is final.
  const order = bones.slice().sort((a, b) => depth(a.bone) - depth(b.bone));
  const pelvis = byName.pelvis;
  const pelvisRest = pelvis ? root.worldToLocal(pelvis.bone.getWorldPosition(new THREE.Vector3())) : null;
  const pelvisTarget = new THREE.Vector3();
  const desired = new Map();

  function depth(node) {
    let count = 0;

    for (let parent = node.parent; parent; parent = parent.parent) {
      count += 1;
    }

    return count;
  }

  const morphMeshes = [];
  model.traverse((node) => {
    // Full-strength fabric sheen from Blender reads as gray satin under the
    // studio's lights; keep a soft velvet edge in the fabric's own color.
    if (node.isMesh && node.material.sheen > 0.35) {
      node.material.sheen = 0.35;
      node.material.sheenRoughness = Math.max(node.material.sheenRoughness ?? 0, 0.8);
      node.material.sheenColor?.copy(node.material.color).lerp(new THREE.Color(1, 1, 1), 0.08);
    }

    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;

      if (node.morphTargetDictionary) {
        morphMeshes.push(node);
      }
    }
  });

  function setMorph(name, value) {
    for (const mesh of morphMeshes) {
      const index = mesh.morphTargetDictionary[name];

      if (index !== undefined) {
        mesh.morphTargetInfluences[index] = value;
      }
    }
  }

  let mouth = 0;
  let eyelids = 0;
  const expression = { smile: 0, frown: 0, targetSmile: 0, targetFrown: 0 };

  return {
    setExpression(name) {
      expression.targetSmile = name === "smile" ? 1 : 0;
      expression.targetFrown = name === "frown" ? 1 : 0;
    },
    update({ time, dt, speaking, blinking, procPelvisY }) {
      root.updateMatrixWorld(true);
      rootInverse.copy(root.getWorldQuaternion(scratch)).invert();
      desired.clear();

      for (const entry of order) {
        const jointWorld = rootInverse.clone().multiply(entry.joint.getWorldQuaternion(new THREE.Quaternion()));
        const world = jointWorld.multiply(entry.correction).multiply(entry.restWorld);
        desired.set(entry.bone, world);
        const parent = entry.bone.parent;
        const parentWorld = desired.get(parent) || rootInverse.clone().multiply(parent.getWorldQuaternion(new THREE.Quaternion()));
        entry.bone.quaternion.copy(parentWorld.clone().invert().multiply(world));
      }

      if (pelvis) {
        // Sitting lowers the hips by as much as it lowers the procedural pelvis.
        pelvisTarget.copy(pelvisRest).setY(pelvisRest.y + procPelvisY - PROCEDURAL_STAND_PELVIS_Y);
        root.localToWorld(pelvisTarget);
        pelvis.bone.position.copy(pelvis.bone.parent.worldToLocal(pelvisTarget));
      }

      const talk = speaking ? 0.25 + 0.75 * Math.abs(Math.sin(time * 10.5 + Math.sin(time * 3.3) * 2.2)) : 0;
      mouth += (talk * 0.38 - mouth) * (1 - Math.exp(-dt * 22));
      eyelids += ((blinking ? 1 : 0) - eyelids) * (1 - Math.exp(-dt * (blinking ? 55 : 22)));
      setMorph("mouthOpen", mouth);
      setMorph("blink", eyelids);
      const blend = 1 - Math.exp(-dt * 4);
      expression.smile += (expression.targetSmile - expression.smile) * blend;
      expression.frown += (expression.targetFrown - expression.frown) * blend;
      setMorph("smile", expression.smile * 0.4);
      setMorph("frown", expression.frown * 0.4);
    },
  };
}
