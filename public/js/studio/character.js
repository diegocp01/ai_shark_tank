// Procedural, rigged 3D people for the studio. Each character is a joint
// hierarchy (pelvis > spine > neck > head, shoulders > elbows, hips > knees)
// built from smooth primitives, so it can sit, stand, walk, gesture, and look
// at whoever is talking. Units are meters; characters face +z.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRetarget } from "./skin.js";
import { outfitTexture, shadeHex } from "./textures.js";

const HEAD_R = 0.122;
// Hair and beard pieces are spheres of HEAD_R scaled to the sculpted head.
const HEAD_SCALE = [0.86, 1.15, 0.97];
const HEAD_DEPTH = 1.1;
const HEAD_WIDTH = 0.94;

// Side profile of the skull (radius, height): cranium, temples, cheekbones,
// jaw, and chin. Revolved and squashed into a head shape.
const HEAD_PROFILE = [
  [0.0, -0.13], [0.03, -0.127], [0.05, -0.116], [0.066, -0.095], [0.079, -0.068], [0.09, -0.036],
  [0.098, 0.0], [0.102, 0.042], [0.1, 0.078], [0.09, 0.106], [0.071, 0.125], [0.041, 0.137], [0.0, 0.142],
];

function headRadiusAt(y) {
  for (let index = 1; index < HEAD_PROFILE.length; index += 1) {
    const [r1, y1] = HEAD_PROFILE[index - 1];
    const [r2, y2] = HEAD_PROFILE[index];

    if (y <= y2) {
      return r1 + ((y - y1) / (y2 - y1)) * (r2 - r1);
    }
  }

  return 0;
}

// Where the face surface is, in head space, at a given height and side offset.
function faceZ(y, x = 0) {
  const radius = headRadiusAt(y);
  const across = x / HEAD_WIDTH;
  return HEAD_DEPTH * Math.sqrt(Math.max(0, radius * radius - across * across));
}

function sculptedGeometry({ from = -0.13, to = 0.142, grow = 1, phiStart = 0, phiLength = Math.PI * 2 } = {}) {
  const curve = new THREE.SplineCurve(HEAD_PROFILE.map(([radius, y]) => new THREE.Vector2(radius * grow, y * (grow > 1 ? 1.01 : 1))));
  const points = curve.getPoints(48).filter((point) => point.y >= from - 0.0001 && point.y <= to + 0.0001);
  return new THREE.LatheGeometry(points, 56, phiStart, phiLength);
}

const POSES = {
  stand: {
    pelvisY: 0.93,
    spine: [0, 0, 0],
    neck: [0, 0, 0],
    shoulderL: [0.05, 0, 0.1],
    elbowL: [-0.22, 0, 0],
    shoulderR: [0.05, 0, -0.1],
    elbowR: [-0.22, 0, 0],
    hipL: [0, 0, 0.03],
    kneeL: [0, 0, 0],
    hipR: [0, 0, -0.03],
    kneeR: [0, 0, 0],
  },
  sit: {
    pelvisY: 0.55,
    spine: [-0.12, 0, 0],
    neck: [0.06, 0, 0],
    shoulderL: [-0.12, 0, 0.26],
    elbowL: [-1.32, 0.1, 0],
    shoulderR: [-0.12, 0, -0.26],
    elbowR: [-1.32, -0.1, 0],
    hipL: [-1.42, 0.06, 0],
    kneeL: [1.42, 0, 0],
    hipR: [-1.42, -0.06, 0],
    kneeR: [1.42, 0, 0],
  },
  // Leaning in, hands together: interested.
  sitLean: {
    pelvisY: 0.55,
    spine: [0.14, 0, 0],
    neck: [-0.1, 0, 0],
    shoulderL: [-0.62, 0, 0.1],
    elbowL: [-1.05, -0.6, 0],
    shoulderR: [-0.62, 0, -0.1],
    elbowR: [-1.05, 0.6, 0],
    hipL: [-1.42, 0.09, 0],
    kneeL: [1.42, 0, 0],
    hipR: [-1.42, -0.09, 0],
    kneeR: [1.42, 0, 0],
  },
  // Sitting back with arms crossed: out.
  sitCrossed: {
    pelvisY: 0.55,
    spine: [-0.2, 0, 0],
    neck: [0.12, 0, 0],
    shoulderL: [-0.38, 0, 0.16],
    elbowL: [-1.7, -1.05, 0],
    shoulderR: [-0.38, 0, -0.16],
    elbowR: [-1.7, 1.05, 0],
    hipL: [-1.42, 0.06, 0],
    kneeL: [1.42, 0, 0],
    hipR: [-1.42, -0.06, 0],
    kneeR: [1.42, 0, 0],
  },
  // Slouched, legs wide: the wildcard's resting pose.
  sitSlouch: {
    pelvisY: 0.54,
    spine: [-0.24, 0, 0],
    neck: [0.16, 0, 0],
    shoulderL: [-0.08, 0, 0.3],
    elbowL: [-1.25, 0.15, 0],
    shoulderR: [-0.08, 0, -0.3],
    elbowR: [-1.25, -0.15, 0],
    hipL: [-1.36, 0.24, 0],
    kneeL: [1.36, 0, 0],
    hipR: [-1.36, -0.24, 0],
    kneeR: [1.36, 0, 0],
  },
  // Legs crossed at the knee.
  sitCrossLegs: {
    pelvisY: 0.56,
    spine: [-0.1, 0, 0],
    neck: [0.06, 0, 0],
    shoulderL: [-0.3, 0, 0.2],
    elbowL: [-1.15, -0.45, 0],
    shoulderR: [-0.3, 0, -0.2],
    elbowR: [-1.15, 0.45, 0],
    hipL: [-1.72, -0.36, 0],
    kneeL: [1.32, 0, 0],
    hipR: [-1.42, 0.04, 0],
    kneeR: [1.42, 0, 0],
  },
};

function addMesh(parent, geo, material, { position, rotation, scale, shadow = true } = {}) {
  const mesh = new THREE.Mesh(geo, material);

  if (position) {
    mesh.position.set(position[0], position[1], position[2]);
  }

  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  if (scale !== undefined) {
    const value = Array.isArray(scale) ? scale : [scale, scale, scale];
    mesh.scale.set(value[0], value[1], value[2]);
  }

  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function group(parent, position = [0, 0, 0]) {
  const node = new THREE.Group();
  node.position.set(position[0], position[1], position[2]);
  parent.add(node);
  return node;
}

function standard(color, roughness = 0.7, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Jacket body from the hem (below the waist) up to the collar, sampled evenly
// in height so the painted outfit texture maps without stretching.
function torsoGeometry() {
  const points = [];
  const bottom = -0.13;
  const top = 0.5;

  for (let index = 0; index <= 30; index += 1) {
    const y = bottom + (index / 30) * (top - bottom);
    let radius;

    if (y < 0.02) {
      radius = 0.158 + 0.016 * smoothstep(0.02, bottom, y);
    } else if (y < 0.38) {
      radius = 0.158 + 0.05 * smoothstep(0.02, 0.38, y);
    } else {
      const t = (y - 0.38) / 0.12;
      radius = 0.208 * Math.sqrt(Math.max(0, 1 - t ** 2.4)) + 0.052 * t * t;
    }

    points.push(new THREE.Vector2(radius, y));
  }

  return new THREE.LatheGeometry(points, 56, Math.PI, Math.PI * 2);
}

function taperedLimb(parent, material, { top, bottom, length, joint = true }) {
  const limb = addMesh(parent, new THREE.CylinderGeometry(top, bottom, length, 22, 1, true), material, { position: [0, -length / 2, 0] });

  if (joint) {
    addMesh(parent, new THREE.SphereGeometry(top, 22, 16), material);
  }

  addMesh(parent, new THREE.SphereGeometry(bottom, 22, 16), material, { position: [0, -length, 0] });
  return limb;
}

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A cap of hair hugging the skull, tilted back so the hairline sits high at
// the front and low at the nape.
// Hair grown from the skull's own profile, so it always hugs the head. The
// hairline sits at `front` on the forehead, `side` above the ears, and
// `back` at the nape; vertices below it slide up onto the hairline.
function hairCap(head, material, { grow = 1.07, front = 0.078, side = 0.018, back = -0.07 } = {}) {
  const geo = sculptedGeometry({ from: Math.min(front, side, back) - 0.012, grow });
  const position = geo.attributes.position;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const facing = (1 + Math.cos(Math.atan2(x, z))) / 2;
    const cut = facing >= 0.5 ? side + (front - side) * (facing - 0.5) * 2 : back + (side - back) * facing * 2;

    if (y < cut) {
      const radius = headRadiusAt(cut) * grow;
      const length = Math.hypot(x, z) || 1;
      position.setXYZ(index, (x / length) * radius, cut, (z / length) * radius);
    }
  }

  position.needsUpdate = true;
  geo.computeVertexNormals();
  return addMesh(head, geo, material, { scale: [HEAD_WIDTH, 1, HEAD_DEPTH] });
}

function curlCluster(head, material, { shell = 1.16, count = 52, minRadius = 0.03, maxRadius = 0.042, cover = 1.75, tilt = 0.5, seed = 4 }) {
  const random = seededRandom(seed);
  const parts = [];
  const axis = new THREE.Vector3(0, Math.cos(tilt), -Math.sin(tilt));
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < count * 3 && parts.length < count; index += 1) {
    const y = 1 - (index / (count * 3 - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * index;
    const direction = new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring);

    if (direction.angleTo(axis) > cover) {
      continue;
    }

    const radius = minRadius + random() * (maxRadius - minRadius);
    const sphere = new THREE.SphereGeometry(radius, 14, 10);
    sphere.translate(
      direction.x * HEAD_R * shell * HEAD_SCALE[0],
      direction.y * HEAD_R * shell * HEAD_SCALE[1] + 0.006,
      direction.z * HEAD_R * shell * HEAD_SCALE[2] - 0.008,
    );
    parts.push(sphere);
  }

  return addMesh(head, mergeGeometries(parts), material);
}

function buildHair(head, look, material) {
  switch (look.hairStyle) {
    case "bald":
      // A close-cropped band around the back and sides; bare crown.
      addMesh(head, sculptedGeometry({ from: -0.055, to: 0.045, grow: 1.022, phiStart: Math.PI / 2 - 0.55, phiLength: Math.PI + 1.1 }), material, {
        scale: [HEAD_WIDTH, 1, HEAD_DEPTH],
      });
      break;
    case "shaved":
      hairCap(head, material, { grow: 1.012, front: 0.09, side: 0.03, back: -0.05 });
      break;
    case "feathered": {
      // Short, full, layered: lots of crown volume with flicked-out sides.
      hairCap(head, material, { grow: 1.13, front: 0.07, side: -0.01, back: -0.07 });
      addMesh(head, new THREE.SphereGeometry(0.1, 28, 20), material, { position: [0, 0.1, -0.012], scale: [1.12, 0.62, 1.1] });

      for (const side of [1, -1]) {
        addMesh(head, new THREE.SphereGeometry(0.05, 20, 14), material, {
          position: [side * 0.098, -0.03, -0.01],
          rotation: [0, 0, side * -0.5],
          scale: [0.7, 1.15, 1.25],
        });
      }

      addMesh(head, new THREE.SphereGeometry(0.07, 24, 16), material, {
        position: [0.03, 0.09, 0.07],
        rotation: [0.6, 0, -0.42],
        scale: [1.4, 0.42, 0.85],
      });
      break;
    }
    case "sidepart":
      hairCap(head, material, { grow: 1.08, front: 0.08, side: 0.016, back: -0.07 });
      addMesh(head, new THREE.SphereGeometry(0.072, 24, 16), material, {
        position: [0.03, 0.098, 0.03],
        rotation: [0.2, 0, -0.32],
        scale: [1.15, 0.5, 1.05],
      });
      break;
    case "buzz":
      hairCap(head, material, { grow: 1.03, front: 0.088, side: 0.022, back: -0.06 });
      break;
    case "slick":
      hairCap(head, material, { grow: 1.07, front: 0.092, side: 0.02, back: -0.07 });
      addMesh(head, new THREE.SphereGeometry(0.08, 24, 16), material, {
        position: [0, 0.092, -0.01],
        scale: [1, 0.55, 1.25],
      });
      break;
    case "bun":
      hairCap(head, material, { grow: 1.06, front: 0.09, side: 0.022, back: -0.06 });
      addMesh(head, new THREE.SphereGeometry(0.064, 24, 18), material, { position: [0, 0.1, -0.105] });
      break;
    case "bob": {
      hairCap(head, material, { grow: 1.09, front: 0.076, side: -0.02, back: -0.09 });
      const shell = new THREE.SphereGeometry(HEAD_R * 1.22, 48, 28, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0.32, 1.52);
      addMesh(head, shell, material, { position: [0, -0.005, -0.006], scale: HEAD_SCALE });
      addMesh(head, new THREE.SphereGeometry(0.07, 24, 16), material, {
        position: [-0.02, 0.088, 0.074],
        rotation: [0.62, 0, 0.3],
        scale: [1.45, 0.4, 0.8],
      });
      break;
    }
    case "long-wavy":
    case "long-straight": {
      const wavy = look.hairStyle === "long-wavy";
      hairCap(head, material, { grow: 1.09, front: 0.084, side: 0.0, back: -0.1 });
      addMesh(head, new THREE.CapsuleGeometry(0.115, wavy ? 0.26 : 0.3, 8, 20), material, {
        position: [0, -0.13, -0.07],
        scale: [1.18, 1, 0.58],
      });

      for (const side of [1, -1]) {
        addMesh(head, new THREE.CapsuleGeometry(0.04, 0.22, 6, 14), material, {
          position: [side * 0.106, -0.085, 0.03],
          rotation: [0.12, 0, side * (wavy ? 0.12 : 0.05)],
        });

        if (wavy) {
          addMesh(head, new THREE.SphereGeometry(0.046, 16, 12), material, { position: [side * 0.115, -0.2, 0.01] });
        }
      }

      addMesh(head, new THREE.SphereGeometry(0.068, 24, 16), material, {
        position: [0.03, 0.082, 0.07],
        rotation: [0.4, 0, -0.35],
        scale: [1.3, 0.42, 0.8],
      });
      break;
    }
    case "curly":
      hairCap(head, material, { grow: 1.08, front: 0.074, side: 0.004, back: -0.06 });
      curlCluster(head, material, { shell: 1.1, count: 60, minRadius: 0.026, maxRadius: 0.036, cover: 1.68, tilt: 0.5, seed: 4 });
      break;
    case "curly-short":
      hairCap(head, material, { grow: 1.05, front: 0.08, side: 0.014, back: -0.06 });
      curlCluster(head, material, { shell: 1.07, count: 70, minRadius: 0.019, maxRadius: 0.026, cover: 1.62, tilt: 0.52, seed: 8 });
      break;
    case "short":
    default:
      hairCap(head, material, { grow: 1.075, front: 0.08, side: 0.016, back: -0.07 });
      addMesh(head, new THREE.SphereGeometry(0.075, 28, 18), material, {
        position: [0.012, 0.088, 0.058],
        rotation: [0.55, 0, -0.18],
        scale: [1.25, 0.46, 0.95],
      });
      break;
  }
}

function buildFace(head, look, materials) {
  const { skin } = materials;

  addMesh(head, sculptedGeometry(), skin, { scale: [HEAD_WIDTH, 1, HEAD_DEPTH] });

  for (const side of [1, -1]) {
    const ear = group(head, [side * 0.093, -0.004, -0.004]);
    addMesh(ear, new THREE.SphereGeometry(0.028, 18, 14), materials.skinShade, { scale: [0.42, 1, 0.72] });
    addMesh(ear, new THREE.TorusGeometry(0.014, 0.0045, 6, 16), materials.skinShade, {
      position: [side * 0.006, 0.002, 0.004],
      rotation: [0, Math.PI / 2, 0],
      scale: [1, 1.4, 1],
    });
    addMesh(head, new THREE.SphereGeometry(0.019, 16, 12), materials.blush, {
      position: [side * 0.056, -0.032, faceZ(-0.032, side * 0.056) - 0.003],
      scale: [1.4, 0.8, 0.35],
      shadow: false,
    });
  }

  // Nose: bridge, tip, and nostril wings.
  addMesh(head, new THREE.CapsuleGeometry(0.0075, 0.03, 6, 12), materials.nose, {
    position: [0, -0.006, faceZ(-0.006) + 0.002],
    rotation: [0.28, 0, 0],
  });
  addMesh(head, new THREE.SphereGeometry(0.0125, 18, 14), materials.nose, {
    position: [0, -0.03, faceZ(-0.03) + 0.008],
    scale: [1.05, 0.9, 0.95],
  });

  for (const side of [1, -1]) {
    addMesh(head, new THREE.SphereGeometry(0.0078, 12, 10), materials.nose, {
      position: [side * 0.0118, -0.034, faceZ(-0.034, side * 0.0118) + 0.003],
      scale: [1, 0.8, 0.9],
    });
  }

  if (look.beard) {
    const beardMaterial = look.beard === "stubble" ? materials.stubble : materials.hair;
    addMesh(head, sculptedGeometry({ from: -0.13, to: -0.03, grow: 1.05, phiStart: -1.8, phiLength: 3.6 }), beardMaterial, {
      scale: [HEAD_WIDTH, 1, HEAD_DEPTH],
      shadow: false,
    });
    addMesh(head, new THREE.CapsuleGeometry(0.0082, 0.034, 6, 12), beardMaterial, {
      position: [0, -0.05, faceZ(-0.05) + 0.004],
      rotation: [0, 0, Math.PI / 2],
      shadow: false,
    });
  }

  const eyes = [];
  const lids = [];

  for (const side of [1, -1]) {
    const eye = group(head, [side * 0.039, 0.014, faceZ(0.014, side * 0.039) - 0.0165]);
    addMesh(eye, new THREE.SphereGeometry(0.0205, 24, 18), materials.eyeWhite, { shadow: false });
    const iris = group(eye);
    addMesh(iris, new THREE.SphereGeometry(0.0112, 20, 14), materials.iris, {
      position: [0, 0, 0.0168],
      scale: [1, 1, 0.42],
      shadow: false,
    });
    addMesh(iris, new THREE.SphereGeometry(0.0058, 16, 10), materials.pupil, {
      position: [0, 0, 0.0198],
      scale: [1, 1, 0.4],
      shadow: false,
    });
    addMesh(iris, new THREE.SphereGeometry(0.0024, 10, 8), materials.catchlight, {
      position: [0.0035, 0.0042, 0.0212],
      shadow: false,
    });
    const lid = addMesh(eye, new THREE.SphereGeometry(0.0216, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), materials.lid, {
      rotation: [-0.62, 0, 0],
      shadow: false,
    });
    eyes.push(iris);
    lids.push(lid);
  }

  const brows = [];
  const browShapes = {
    stern: [0.34, -0.005],
    soft: [-0.08, 0.004],
    flat: [0, 0],
    arched: [-0.24, 0.008],
    raised: [-0.16, 0.012],
  };
  const [tilt, lift] = browShapes[look.brows] || browShapes.soft;

  for (const side of [1, -1]) {
    const browY = 0.054 + lift * (side === 1 || look.brows !== "raised" ? 1 : -0.6);
    const brow = addMesh(head, new THREE.CapsuleGeometry(0.0068, 0.032, 6, 12), materials.brow, {
      position: [side * 0.04, browY, faceZ(browY, side * 0.04) + 0.003],
      rotation: [0, side * 0.42, Math.PI / 2 + side * tilt],
      shadow: false,
    });
    brow.userData.baseY = brow.position.y;
    brows.push(brow);
  }

  const mouth = group(head, [0, -0.07, faceZ(-0.07) + (look.beard ? 0.009 : 0.004)]);
  const idle = group(mouth);
  const mouthMaterial = materials.mouth;

  switch (look.mouth) {
    case "frown":
      addMesh(idle, new THREE.TorusGeometry(0.02, 0.0042, 8, 24, Math.PI), mouthMaterial, { position: [0, -0.012, 0], shadow: false });
      break;
    case "neutral":
      addMesh(idle, new THREE.CapsuleGeometry(0.0045, 0.03, 6, 12), look.beard ? materials.lips : mouthMaterial, {
        rotation: [0, 0, Math.PI / 2],
        shadow: false,
      });
      break;
    case "grin":
      addMesh(idle, new THREE.CircleGeometry(0.027, 28, Math.PI, Math.PI), mouthMaterial, { position: [0, 0.008, 0.002], shadow: false });
      addMesh(idle, new THREE.CircleGeometry(0.024, 28, Math.PI, Math.PI), materials.teeth, {
        position: [0, 0.008, 0.0035],
        scale: [1, 0.38, 1],
        shadow: false,
      });
      break;
    case "lipstick":
      addMesh(idle, new THREE.CapsuleGeometry(0.0068, 0.024, 6, 12), materials.lips, {
        position: [0, 0.004, 0],
        rotation: [0, 0, Math.PI / 2],
        shadow: false,
      });
      addMesh(idle, new THREE.CapsuleGeometry(0.0078, 0.02, 6, 12), materials.lips, {
        position: [0, -0.007, 0],
        rotation: [0, 0, Math.PI / 2],
        shadow: false,
      });
      break;
    case "smile":
    default:
      addMesh(idle, new THREE.TorusGeometry(0.021, 0.0042, 8, 24, Math.PI), mouthMaterial, {
        position: [0, 0.012, 0],
        rotation: [0, 0, Math.PI],
        shadow: false,
      });
      break;
  }

  const talk = addMesh(mouth, new THREE.SphereGeometry(0.017, 20, 14), materials.mouthInside, {
    scale: [1.3, 0.6, 0.45],
    shadow: false,
  });
  talk.visible = false;

  if (look.glasses) {
    for (const side of [1, -1]) {
      const round = look.glasses === "round";
      addMesh(head, new THREE.TorusGeometry(round ? 0.025 : 0.026, round ? 0.0042 : 0.0034, 8, 32), materials.frame, {
        position: [side * 0.04, 0.013, faceZ(0.013, side * 0.04) + 0.012],
        scale: round ? [1.04, 0.98, 1] : [1.18, 0.86, 1],
        shadow: false,
      });
      addMesh(head, new THREE.BoxGeometry(0.004, 0.004, 0.1), materials.frame, {
        position: [side * 0.088, 0.016, 0.052],
        rotation: [0, side * 0.1, 0],
        shadow: false,
      });
    }

    addMesh(head, new THREE.CylinderGeometry(0.0026, 0.0026, 0.02, 8), materials.frame, {
      position: [0, 0.016, faceZ(0.016) + 0.012],
      rotation: [0, 0, Math.PI / 2],
      shadow: false,
    });
  }

  if (look.earrings === "hoop") {
    for (const side of [1, -1]) {
      addMesh(head, new THREE.TorusGeometry(0.015, 0.0024, 8, 24), materials.gold, {
        position: [side * 0.096, -0.04, 0.0],
        rotation: [0, Math.PI / 2, 0],
        shadow: false,
      });
    }
  } else if (look.earrings === "pearl") {
    for (const side of [1, -1]) {
      addMesh(head, new THREE.SphereGeometry(0.008, 12, 10), materials.pearl, {
        position: [side * 0.096, -0.03, 0.004],
        shadow: false,
      });
    }
  }

  if (look.shades) {
    for (const side of [1, -1]) {
      addMesh(head, new THREE.SphereGeometry(0.028, 20, 14), materials.shades, {
        position: [side * 0.036, 0.13, 0.048],
        rotation: [-0.95, 0, 0],
        scale: [1.25, 0.75, 0.32],
        shadow: false,
      });
    }

    addMesh(head, new THREE.BoxGeometry(0.028, 0.004, 0.006), materials.frame, { position: [0, 0.134, 0.058], rotation: [-0.95, 0, 0] });
  }

  return { eyes, lids, brows, idleMouth: idle, talkMouth: talk };
}

function buildHand(parent, skin, side) {
  const hand = group(parent);
  addMesh(hand, new RoundedBoxGeometry(0.068, 0.078, 0.03, 3, 0.012), skin, { position: [0, -0.04, 0.002] });

  for (let index = 0; index < 4; index += 1) {
    addMesh(hand, new THREE.CapsuleGeometry(0.0085, 0.036, 4, 10), skin, {
      position: [(index - 1.5) * 0.0165, -0.095, 0.006],
      rotation: [0.28, 0, 0],
    });
  }

  addMesh(hand, new THREE.CapsuleGeometry(0.01, 0.034, 4, 10), skin, {
    position: [side * 0.036, -0.045, 0.014],
    rotation: [0.5, 0, side * 0.75],
  });
  return hand;
}

function buildArm(shoulder, materials, side) {
  addMesh(shoulder, new THREE.SphereGeometry(0.06, 24, 18), materials.sleeve, { position: [side * 0.004, -0.004, 0], scale: [1, 0.85, 1] });
  taperedLimb(shoulder, materials.sleeve, { top: 0.058, bottom: 0.05, length: 0.27 });
  const elbow = group(shoulder, [0, -0.27, 0]);
  elbow.rotation.order = "YXZ";
  taperedLimb(elbow, materials.sleeve, { top: 0.05, bottom: 0.044, length: 0.235, joint: false });
  const hand = buildHand(group(elbow, [0, -0.25, 0]), materials.skin, side);
  return { elbow, hand };
}

function buildLeg(hip, materials) {
  taperedLimb(hip, materials.trousers, { top: 0.084, bottom: 0.066, length: 0.42 });
  const knee = group(hip, [0, -0.42, 0]);
  taperedLimb(knee, materials.shin, { top: 0.064, bottom: 0.05, length: 0.4, joint: false });
  const foot = group(knee, [0, -0.41, 0]);

  if (materials.heel) {
    addMesh(foot, new THREE.SphereGeometry(0.04, 18, 12), materials.shoe, { position: [0, -0.02, 0.05], scale: [0.85, 0.6, 1.7] });
    addMesh(foot, new THREE.CylinderGeometry(0.007, 0.005, 0.06, 8), materials.shoe, { position: [0, -0.03, -0.02] });
  } else {
    addMesh(foot, new THREE.SphereGeometry(0.052, 20, 14), materials.shoe, { position: [0, -0.018, 0.06], scale: [1.0, 0.62, 1.9] });
    addMesh(foot, new RoundedBoxGeometry(0.1, 0.022, 0.27, 2, 0.008), materials.sole, { position: [0, -0.046, 0.045] });
  }

  return { knee };
}

export function createCharacter({ look: rawLook, color = "#39e0c8", seed = 1, pose = "stand" }) {
  const look = {
    top: "suit",
    suit: "#24324f",
    skin: "#e3aa83",
    hair: "#2a1e18",
    hairStyle: "short",
    brows: "soft",
    mouth: "smile",
    ...rawLook,
  };
  const random = seededRandom(seed * 977 + 13);
  const dress = look.top === "blazer" || look.top === "dress";
  const materials = {
    skin: standard(look.skin, 0.6, { emissive: shadeHex(look.skin, -0.55), emissiveIntensity: 0.06 }),
    skinShade: standard(shadeHex(look.skin, -0.08), 0.6),
    lid: look.lashes ? standard("#22161a", 0.5) : standard(shadeHex(look.skin, -0.06), 0.6),
    blush: standard("#ff7f7a", 0.9, { transparent: true, opacity: 0.08, depthWrite: false }),
    nose: standard(shadeHex(look.skin, -0.04), 0.6, { emissive: shadeHex(look.skin, -0.55), emissiveIntensity: 0.1 }),
    hair: standard(look.hair, look.hairStyle === "slick" ? 0.32 : 0.62),
    stubble: standard(shadeHex(look.hair, -0.45), 0.95, { transparent: true, opacity: 0.2, depthWrite: false }),
    brow: standard(shadeHex(look.hair, new THREE.Color(look.hair).getHSL({}).l > 0.5 ? -0.55 : -0.15), 0.8),
    eyeWhite: standard("#f6f3ee", 0.22),
    iris: standard("#3d2616", 0.3),
    pupil: standard("#080506", 0.18),
    catchlight: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    mouth: standard("#6b2229", 0.55),
    mouthInside: standard("#3a1015", 0.6),
    teeth: standard("#fbf8f2", 0.3),
    lips: standard(look.lipstick || shadeHex(look.skin, -0.25), 0.4),
    frame: standard("#121317", 0.3),
    gold: new THREE.MeshStandardMaterial({ color: "#e2b54b", metalness: 1, roughness: 0.28 }),
    pearl: standard("#fbf6ee", 0.2),
    shades: new THREE.MeshStandardMaterial({ color: "#14254d", metalness: 0.4, roughness: 0.12 }),
    jacket: new THREE.MeshStandardMaterial({ map: outfitTexture(look, color), roughness: 0.78 }),
    sleeve: standard(look.suit, 0.8),
    cuff: standard(look.top === "turtleneck" || look.top === "dress" ? look.suit : "#e9ecf0", 0.7),
    collar: standard(look.top === "turtleneck" ? shadeHex(look.suit, 0.12) : "#f1f3f6", 0.65),
    trousers: standard(dress ? look.suit : look.trousers || shadeHex(look.suit, -0.28), 0.82),
    shin: standard(dress ? look.skin : look.trousers ? shadeHex(look.trousers, -0.06) : shadeHex(look.suit, -0.32), dress ? 0.58 : 0.82),
    shoe: standard(dress ? shadeHex(look.suit, -0.35) : "#1c130e", 0.28),
    sole: standard("#0c0908", 0.6),
    heel: dress,
  };

  const root = new THREE.Group();
  const pelvis = group(root, [0, POSES[pose].pelvisY, 0]);
  addMesh(pelvis, new THREE.CapsuleGeometry(0.11, 0.13, 8, 18), materials.trousers, {
    position: [0, -0.02, -0.01],
    rotation: [0, 0, Math.PI / 2],
    scale: [1, 1, 0.82],
  });

  const spine = group(pelvis, [0, 0.03, 0]);
  addMesh(spine, torsoGeometry(), materials.jacket, { scale: [1.14, 1, 0.72] });

  if (look.top === "turtleneck") {
    addMesh(spine, new THREE.TorusGeometry(0.056, 0.03, 12, 28), materials.collar, {
      position: [0, 0.49, 0],
      rotation: [Math.PI / 2, 0, 0],
      scale: [1.1, 1, 1.5],
    });
  } else if (look.top !== "open-collar" && look.top !== "dress") {
    addMesh(spine, new THREE.CylinderGeometry(0.052, 0.066, 0.06, 24, 1, true), materials.collar, { position: [0, 0.5, 0.004] });
  }

  const neck = group(spine, [0, 0.47, 0]);
  addMesh(neck, new THREE.CylinderGeometry(0.047, 0.054, 0.12, 20), materials.skinShade, { position: [0, 0.05, 0.004] });
  const head = group(neck, [0, 0.19, 0.014]);
  head.scale.setScalar(1.02);
  const face = buildFace(head, look, materials);
  buildHair(head, look, look.hairStyle === "shaved" ? materials.stubble : materials.hair);

  const limbs = {};

  for (const [name, side] of [["L", 1], ["R", -1]]) {
    const shoulder = group(spine, [side * 0.2, 0.42, -0.006]);
    const arm = buildArm(shoulder, materials, side);
    limbs[`shoulder${name}`] = shoulder;
    limbs[`elbow${name}`] = arm.elbow;

    const hip = group(pelvis, [side * 0.094, -0.04, 0]);
    hip.rotation.order = "YXZ";
    const leg = buildLeg(hip, materials);
    limbs[`hip${name}`] = hip;
    limbs[`knee${name}`] = leg.knee;
  }

  const joints = { spine, neck, ...limbs };
  let skin = null;
  const current = {};
  let target = POSES[pose];

  for (const [name, value] of Object.entries(target)) {
    current[name] = Array.isArray(value) ? [...value] : value;
  }

  const state = {
    speaking: false,
    thinking: false,
    walking: false,
    walkPhase: 0,
    gesture: 0.7 + random() * 0.4,
    phase: random() * Math.PI * 2,
    nextBlink: 1 + random() * 3,
    blinkUntil: 0,
    lookTarget: null,
    headYaw: 0,
    headPitch: 0,
    handshake: 0,
    reach: 0,
  };
  const scratch = new THREE.Vector3();
  const scratchQuat = new THREE.Quaternion();
  const lidOpen = look.brows === "stern" ? -0.34 : -0.62;

  function apply(name, values, extra = [0, 0, 0]) {
    joints[name].rotation.set(values[0] + extra[0], values[1] + extra[1], values[2] + extra[2]);
  }

  return {
    root,
    head,
    look,
    get pose() {
      return target;
    },
    setPose(name) {
      target = POSES[name] || POSES.stand;
    },
    setSpeaking(on) {
      state.speaking = on;
    },
    setThinking(on) {
      state.thinking = on;
    },
    setWalking(on) {
      state.walking = on;
    },
    setHandshake(on) {
      state.handshake = on ? 1 : 0;
    },
    setLookTarget(vector) {
      state.lookTarget = vector ? vector.clone() : null;
    },
    setExpression(name) {
      skin?.setExpression(name);
    },
    // Swap the procedural body for a rigged model driven by the same joints.
    attachSkin(model) {
      root.updateMatrixWorld(true);
      const procedural = [];
      root.traverse((node) => node.isMesh && procedural.push(node));
      // Bind with the joints at rest so the model's rest pose lines up.
      const saved = Object.entries({ pelvis, head, ...joints }).map(([name, node]) => [node, node.rotation.clone()]);
      saved.forEach(([node]) => node.rotation.set(0, 0, 0));
      root.add(model);
      skin = createRetarget(model, { root, joints: { pelvis, head, ...joints }, skinTone: look.skin });
      saved.forEach(([node, rotation]) => node.rotation.copy(rotation));
      procedural.forEach((mesh) => {
        mesh.visible = false;
      });
    },
    headPosition(out = new THREE.Vector3()) {
      return head.getWorldPosition(out);
    },
    update(dt, time) {
      const blend = 1 - Math.exp(-dt * 6);

      for (const [name, value] of Object.entries(target)) {
        if (Array.isArray(value)) {
          for (let axis = 0; axis < 3; axis += 1) {
            current[name][axis] += (value[axis] - current[name][axis]) * blend;
          }
        } else {
          current[name] += (value - current[name]) * blend;
        }
      }

      state.reach += (state.handshake - state.reach) * blend;
      const t = time + state.phase;
      const talking = state.speaking ? 1 : 0;
      const gesture = talking * state.gesture * (0.5 + 0.5 * Math.sin(t * 2.3));
      const gestureL = talking * state.gesture * (0.5 + 0.5 * Math.sin(t * 1.7 + 1.3)) * 0.6;
      const breath = Math.sin(t * 1.6) * 0.012;

      let walkHip = 0;
      let walkKnee = 0;
      let walkArm = 0;
      let bob = 0;

      if (state.walking) {
        state.walkPhase += dt * 7.4;
        walkHip = Math.sin(state.walkPhase) * 0.42;
        walkKnee = Math.max(0, Math.sin(state.walkPhase + 1.1)) * 0.75;
        walkArm = Math.sin(state.walkPhase) * 0.32;
        bob = Math.abs(Math.cos(state.walkPhase)) * 0.025;
      }

      pelvis.position.y = current.pelvisY + bob;
      apply("spine", current.spine, [breath + (state.walking ? 0.04 : 0), 0, 0]);
      apply("neck", current.neck);
      apply("hipL", current.hipL, [walkHip, 0, 0]);
      apply("kneeL", current.kneeL, [walkKnee, 0, 0]);
      apply("hipR", current.hipR, [-walkHip, 0, 0]);
      apply("kneeR", current.kneeR, [state.walking ? Math.max(0, Math.sin(state.walkPhase + 1.1 + Math.PI)) * 0.75 : 0, 0, 0]);

      // Right arm: talk gestures, hand-to-chin while thinking, or a handshake reach.
      const think = state.thinking ? 1 : 0;
      const reach = state.reach;
      const right = [
        current.shoulderR[0] - gesture * 0.42 - walkArm,
        current.shoulderR[1],
        current.shoulderR[2],
      ];
      const rightElbow = [current.elbowR[0] - gesture * 0.5, current.elbowR[1], current.elbowR[2]];
      const thinkShoulder = [-1.2, 0, -0.22];
      const thinkElbow = [-2.4, 0.5, 0];
      const reachShoulder = [-1.2, 0.1, -0.05];
      const reachElbow = [-0.32, 0, 0];

      for (let axis = 0; axis < 3; axis += 1) {
        right[axis] += (thinkShoulder[axis] - right[axis]) * think * 0.92;
        rightElbow[axis] += (thinkElbow[axis] - rightElbow[axis]) * think * 0.92;
        right[axis] += (reachShoulder[axis] - right[axis]) * reach;
        rightElbow[axis] += (reachElbow[axis] - rightElbow[axis]) * reach;
      }

      joints.shoulderR.rotation.set(right[0], right[1], right[2]);
      joints.elbowR.rotation.set(rightElbow[0], rightElbow[1], rightElbow[2]);
      apply("shoulderL", current.shoulderL, [-gestureL * 0.32 + walkArm, 0, 0]);
      apply("elbowL", current.elbowL, [-gestureL * 0.4, 0, 0]);

      // Gaze: the head turns toward the look target, the eyes go a bit further.
      let yaw = 0;
      let pitch = 0;

      if (state.lookTarget) {
        head.getWorldPosition(scratch);
        const direction = state.lookTarget.clone().sub(scratch);
        root.getWorldQuaternion(scratchQuat);
        direction.applyQuaternion(scratchQuat.invert());
        yaw = Math.atan2(direction.x, direction.z);
        pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
      }

      yaw = Math.max(-1.1, Math.min(1.1, yaw));
      pitch = Math.max(-0.45, Math.min(0.45, pitch));
      state.headYaw += (yaw * 0.78 - state.headYaw) * (1 - Math.exp(-dt * 5));
      state.headPitch += (pitch * 0.6 - state.headPitch) * (1 - Math.exp(-dt * 5));
      const nod = talking * Math.sin(t * 6.3) * 0.03;
      head.rotation.set(-state.headPitch - nod - think * 0.12, state.headYaw, think * 0.12 + Math.sin(t * 0.7) * 0.02);

      for (const eye of face.eyes) {
        eye.rotation.set(-(pitch - state.headPitch) * 0.7 - think * 0.35, (yaw - state.headYaw) * 0.6, 0);
      }

      // Blinks.
      if (time > state.nextBlink) {
        state.blinkUntil = time + 0.13;
        state.nextBlink = time + 2.4 + random() * 3.6;
      }

      const lidAngle = time < state.blinkUntil ? 1.05 : lidOpen;

      for (const lid of face.lids) {
        lid.rotation.x += (lidAngle - lid.rotation.x) * (time < state.blinkUntil ? 0.7 : 0.35);
      }

      face.idleMouth.visible = !state.speaking;
      face.talkMouth.visible = state.speaking;

      if (state.speaking) {
        face.talkMouth.scale.y = 0.28 + 0.85 * Math.abs(Math.sin(t * 10.5 + Math.sin(t * 3.3) * 2.2));
      }

      for (const brow of face.brows) {
        brow.position.y = brow.userData.baseY + talking * 0.0028 * Math.max(0, Math.sin(t * 4.1)) + think * 0.004;
      }

      skin?.update({ time: t, dt, speaking: state.speaking, blinking: time < state.blinkUntil, procPelvisY: pelvis.position.y });
    },
  };
}

export { POSES };
