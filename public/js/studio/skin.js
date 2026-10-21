// Drives a rigged GLB character (Blender armature with the bone names below)
// from the procedural joint rig in character.js. The procedural joints stay
// invisible and keep doing all the animation (poses, walking, gestures, gaze);
// every frame each bone copies its joint's orientation. Because the Blender rest
// pose stands with arms slightly out, each limb gets a rest correction so that
// "joint at zero" means the limb hangs straight down, as it does procedurally.

import * as THREE from "three";

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
    // Skin meshes are named "...Skin_|_<tone>" (hands) or "..._anatomical_head" (face);
    // every skinned part is prefixed "Kevin_skin_", so match case-sensitively.
    if (!node.isMesh || !/Skin_\|_|anatomical_head/.test(node.name)) {
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

export function createRetarget(model, { root, joints, skinTone = null }) {
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
      setMorph("mouthOpen", talk * 0.85);
      setMorph("blink", blinking ? 1 : 0);
      const blend = 1 - Math.exp(-dt * 4);
      expression.smile += (expression.targetSmile - expression.smile) * blend;
      expression.frown += (expression.targetFrown - expression.frown) * blend;
      setMorph("smile", expression.smile * 0.8);
      setMorph("frown", expression.frown * 0.7);
    },
  };
}
