// The Shark Tank set in 3D. The sharks sit in an arc of lounge chairs facing
// the founder's mark on the rug; behind them is the glowing slat wall with
// blue-lit stairs, and behind the founder is the entrance hallway.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  createBoardTexture,
  hallTexture,
  marbleTexture,
  surfaceTexture,
  rugTexture,
  woodTexture,
} from "./textures.js";

export const FOUNDER_MARK = new THREE.Vector3(5.2, 0, 0);
export const HALLWAY_START = new THREE.Vector3(14.5, 0, 0);
const ARC_RADIUS = 5.0;
const SEAT_ANGLES = [30, 15, 0, -15, -30].map((degrees) => (degrees * Math.PI) / 180);

export function seatTransform(index) {
  const angle = SEAT_ANGLES[index];
  const position = new THREE.Vector3(FOUNDER_MARK.x - ARC_RADIUS * Math.cos(angle), 0, ARC_RADIUS * Math.sin(angle));
  const toFounder = FOUNDER_MARK.clone().sub(position);
  const yaw = Math.atan2(toFounder.x, toFounder.z);
  return { position, yaw, forward: toFounder.normalize() };
}

function box(width, height, depth, material, { radius = 0.02, segments = 3 } = {}) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, segments, radius), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function place(mesh, parent, position, rotation = [0, 0, 0]) {
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

// Upholstered wingback chairs: curved walnut frame, rolled arms, piping and
// brass nailheads. All dimensions retain the shared seated rig's hip height.
function loungeChair(materials) {
  const chair = new THREE.Group();
  place(box(0.82, 0.13, 0.72, materials.walnut, { radius: 0.035 }), chair, [0, 0.34, -0.02]);
  place(box(0.7, 0.16, 0.67, materials.leather, { radius: 0.07, segments: 5 }), chair, [0, 0.46, 0.02]);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.39, 0.47, -0.32), new THREE.Vector3(-0.43, 1.05, -0.43),
    new THREE.Vector3(-0.3, 1.24, -0.46), new THREE.Vector3(0, 1.3, -0.47),
    new THREE.Vector3(0.3, 1.24, -0.46), new THREE.Vector3(0.43, 1.05, -0.43), new THREE.Vector3(0.39, 0.47, -0.32),
  ]);
  for (const point of curve.points) point.y = 0.45 + (point.y - 0.45) * 0.76;
  const back = new THREE.Shape();
  back.moveTo(-0.36, 0.43); back.lineTo(-0.4, 1.04);
  back.bezierCurveTo(-0.4, 1.31, 0.4, 1.31, 0.4, 1.04);
  back.lineTo(0.36, 0.43); back.closePath();
  const cushion = new THREE.Mesh(new THREE.ExtrudeGeometry(back, { depth: 0.1, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 4, steps: 1, curveSegments: 24 }), materials.leather);
  cushion.scale.y = 0.76;
  cushion.castShadow = cushion.receiveShadow = true;
  place(cushion, chair, [0, 0.108, -0.44]);
  place(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.036, 10, false), materials.walnut), chair, [0, 0, 0]);
  const trim = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.009, 8, false), materials.piping);
  place(trim, chair, [0, -0.018, 0.044]);
  const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.007, 8, 6), materials.brass, 67);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 67; i++) {
    const point = curve.getPointAt(i / 66); point.z += 0.035; point.y -= 0.024;
    studs.setMatrixAt(i, matrix.makeTranslation(point.x, point.y, point.z));
  }
  chair.add(studs);
  for (const side of [-1, 1]) {
    place(box(0.14, 0.17, 0.65, materials.leather, { radius: 0.068, segments: 5 }), chair, [side * 0.4, 0.67, 0]);
    place(box(0.07, 0.26, 0.08, materials.walnut, { radius: 0.025 }), chair, [side * 0.4, 0.5, 0.22]);
    for (const z of [-0.27, 0.26]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.022, 0.33, 12), materials.walnut);
      leg.castShadow = true;
      place(leg, chair, [side * 0.31, 0.165, z], [z * 0.15, 0, -side * 0.07]);
      place(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.025, 0.035, 12), materials.brass), chair, [side * 0.32, 0.025, z]);
    }
  }
  return chair;
}

function sideTable(materials, quality) {
  // quality is "high" or "low"; only high gets real glass transmission.
  const table = new THREE.Group();
  place(box(0.48, 0.035, 0.38, materials.marble, { radius: 0.01 }), table, [0, 0.5, 0]);

  for (const [x, z] of [[0.2, 0.15], [-0.2, 0.15], [0.2, -0.15], [-0.2, -0.15]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.49, 10), materials.chrome);
    leg.castShadow = true;
    place(leg, table, [x, 0.245, z]);
  }

  const glassMaterial =
    quality === "high"
      ? new THREE.MeshPhysicalMaterial({ color: "#ffffff", transmission: 1, roughness: 0.04, thickness: 0.02, ior: 1.4, transparent: true })
      : new THREE.MeshStandardMaterial({ color: "#dff1ff", transparent: true, opacity: 0.35, roughness: 0.05 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.13, 24, 1, true), glassMaterial);
  place(glass, table, [-0.12, 0.585, 0.05]);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.031, 0.028, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: "#a8d8ff", transparent: true, opacity: 0.4, roughness: 0.05 }),
  );
  place(water, table, [-0.12, 0.558, 0.05]);
  place(box(0.2, 0.014, 0.27, materials.notebook, { radius: 0.004 }), table, [0.08, 0.525, -0.02], [0, 0.2, 0]);
  return table;
}

function slatWall(materials, { width, height, x }) {
  const wall = new THREE.Group();
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 8;
  glowCanvas.height = 256;
  const glowContext = glowCanvas.getContext("2d");
  const gradient = glowContext.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#401806");
  gradient.addColorStop(0.45, "#b47b48");
  gradient.addColorStop(0.75, "#9c6239");
  gradient.addColorStop(1, "#3a1404");
  glowContext.fillStyle = gradient;
  glowContext.fillRect(0, 0, 8, 256);
  const glowMap = new THREE.CanvasTexture(glowCanvas);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: glowMap, emissiveIntensity: 0.32 }),
  );
  place(backing, wall, [x - 0.06, height / 2, 0], [0, Math.PI / 2, 0]);
  const slat = new THREE.BoxGeometry(0.07, 0.112, width);

  for (let y = 0.06; y < height; y += 0.162) {
    const mesh = new THREE.Mesh(slat, materials.slat);
    mesh.receiveShadow = true;
    place(mesh, wall, [x, y, 0]);
  }

  for (const z of [-width / 2 + 0.1, -2.9, 2.9, width / 2 - 0.1]) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, 0.22), materials.darkWood);
    column.receiveShadow = true;
    place(column, wall, [x + 0.05, height / 2, z]);
  }

  return wall;
}

function floatingStairs(materials) {
  const stairs = new THREE.Group();
  const led = new THREE.MeshStandardMaterial({ color: "#0a1f3d", emissive: "#4aa8ff", emissiveIntensity: 0.8 });

  for (let index = 0; index < 9; index += 1) {
    const step = box(0.62, 0.08, 0.36, materials.darkWood, { radius: 0.015 });
    place(step, stairs, [0, 0.5 + index * 0.34, 5.8 - index * 0.38]);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.012, 0.02), led);
    place(strip, stairs, [0.02, 0.455 + index * 0.34, 5.8 - index * 0.38 + 0.17]);
  }

  stairs.position.x = -1.1;
  return stairs;
}

function displayBoard(boardTexture, materials) {
  const board = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.125),
    new THREE.MeshStandardMaterial({ map: boardTexture, roughness: 0.55 }),
  );
  panel.receiveShadow = true;
  place(panel, board, [0, 1.42, 0.03]);
  place(box(1.78, 2.2, 0.05, materials.boardFrame, { radius: 0.01 }), board, [0, 1.42, 0]);

  for (const side of [1, -1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 10), materials.chrome);
    place(leg, board, [side * 0.7, 0.18, -0.02]);
  }

  const samples = new THREE.Group();
  board.add(samples);
  board.userData.setPitch = (pitch) => {
    samples.traverse((node) => { if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); } });
    samples.clear();
    const colors = ["#353d44", "#d1b085", "#e4dfd2", pitch.founder?.accent || "#536b74"];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = -0.57 + col * 0.38, y = 0.68 + row * 0.37;
        const material = new THREE.MeshStandardMaterial({ color: colors[(row + col) % 4], roughness: 0.78 });
        const shelfMaterial = new THREE.MeshStandardMaterial({ color: "#e8e3d9", roughness: 0.6 });
        place(box(0.28, 0.024, 0.22, shelfMaterial, { radius: 0.004 }), samples, [x, y, 0.14]);
        if (pitch.icon === "sock") {
          const sock = new THREE.Shape();
          sock.moveTo(-0.04, 0.26); sock.lineTo(0.04, 0.26); sock.lineTo(0.045, 0.08);
          sock.quadraticCurveTo(0.05, 0.06, 0.11, 0.04); sock.quadraticCurveTo(0.14, 0, 0.09, 0);
          sock.lineTo(-0.045, 0); sock.quadraticCurveTo(-0.07, 0.02, -0.04, 0.09); sock.closePath();
          place(new THREE.Mesh(new THREE.ExtrudeGeometry(sock, { depth: 0.025, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 10 }), material), samples, [x - 0.03, y + 0.02, 0.13]);
        } else if (pitch.icon === "paw") {
          const collar = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.014, 8, 32), material);
          place(collar, samples, [x, y + 0.11, 0.12]);
          place(box(0.045, 0.04, 0.028, new THREE.MeshStandardMaterial({color: "#d4d3cc", metalness: 0.55, roughness: 0.3})), samples, [x, y + 0.04, 0.14]);
        } else if (pitch.icon === "wave") {
          place(new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 12), material), samples, [x, y + 0.1, 0.14]);
        } else {
          place(box(0.14, 0.22, 0.065, material, { radius: 0.012 }), samples, [x, y + 0.13, 0.12]);
        }
      }
    }
    samples.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
  };
  return board;
}

function planter(materials) {
  const plant = new THREE.Group();
  place(box(0.5, 0.55, 0.5, materials.pot, { radius: 0.03 }), plant, [0, 0.275, 0]);
  const blade = new THREE.ConeGeometry(0.018, 1.2, 5);

  for (let index = 0; index < 34; index += 1) {
    const angle = index * 2.39996;
    const radius = 0.06 + (index % 5) * 0.035;
    const mesh = new THREE.Mesh(blade, materials.leaf);
    mesh.castShadow = true;
    place(
      mesh,
      plant,
      [Math.cos(angle) * radius, 1.05 + (index % 3) * 0.08, Math.sin(angle) * radius],
      [Math.sin(angle) * 0.35, 0, Math.cos(angle) * 0.35],
    );
  }

  return plant;
}

function hallway(materials) {
  const hall = new THREE.Group();
  const length = 9;
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#000000",
    emissive: "#ffffff",
    emissiveMap: hallTexture(),
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });

  for (const side of [1, -1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, 2.9), wallMaterial);
    place(wall, hall, [8.6 + length / 2, 1.45, side * 1.1], [0, side === 1 ? Math.PI : 0, 0]);
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(length, 2.2), materials.hallFloor);
  floor.receiveShadow = true;
  place(floor, hall, [8.6 + length / 2, 0.004, 0], [-Math.PI / 2, 0, 0]);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(length, 2.2), materials.darkWood);
  place(ceiling, hall, [8.6 + length / 2, 2.9, 0], [Math.PI / 2, 0, 0]);
  const strip = new THREE.MeshStandardMaterial({ color: "#000", emissive: "#b8d2e6", emissiveIntensity: 0.8 });

  for (let x = 9.2; x < 8.6 + length; x += 1.3) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 1.6), strip), hall, [x, 2.88, 0]);
  }

  const fishMaterial = new THREE.MeshStandardMaterial({ color: "#06182e", roughness: 0.6 });
  const fish = [];

  for (let index = 0; index < 7; index += 1) {
    const body = new THREE.Group();
    const shape = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), fishMaterial);
    shape.scale.set(1.8, 0.55, 0.12);
    body.add(shape);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 3), fishMaterial);
    tail.rotation.z = Math.PI / 2;
    tail.scale.set(1, 1, 0.12);
    tail.position.x = -0.36;
    body.add(tail);
    const side = index % 2 ? 1 : -1;
    body.position.set(9 + ((index * 1.7) % length), 0.8 + (index % 3) * 0.55, side * 1.08);
    body.userData = { speed: 0.25 + (index % 3) * 0.12, side, base: body.position.x };
    hall.add(body);
    fish.push(body);
  }

  const doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.6),
    new THREE.MeshStandardMaterial({ color: "#000", emissive: "#2c5780", emissiveIntensity: 0.5 }),
  );
  place(doorGlow, hall, [8.6 + length - 0.02, 1.3, 0], [0, -Math.PI / 2, 0]);

  return {
    group: hall,
    update(time) {
      for (const body of fish) {
        const { speed, side, base } = body.userData;
        const span = length - 0.6;
        body.position.x = 8.9 + ((base - 8.9 + time * speed) % span);
        body.scale.x = side;
      }
    },
  };
}

function entranceWall(materials) {
  const wall = new THREE.Group();
  const panel = materials.panelWood;

  for (const [z, width] of [[5.55, 8.9], [-5.55, 8.9]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.4, width), panel);
    mesh.receiveShadow = true;
    place(mesh, wall, [8.6, 2.2, z]);
  }

  place(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 2.2), panel), wall, [8.6, 3.65, 0]);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffcf9a", emissiveIntensity: 0.45 });

  for (const z of [1.12, -1.12]) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 0.05), frameMaterial), wall, [8.48, 1.45, z]);
  }

  place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 2.29), frameMaterial), wall, [8.48, 2.9, 0]);

  for (const z of [5.2, -5.2]) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.6, 0.06), new THREE.MeshStandardMaterial({ color: "#000", emissive: "#6b82b6", emissiveIntensity: 0.6 })), wall, [8.47, 2.0, z]);
  }

  return wall;
}

function architecturalDetails(materials, quality) {
  const details = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#79736a", roughness: 0.9, bumpMap: surfaceTexture("stone"), bumpScale: 0.012 });
  const glass = quality === "high"
    ? new THREE.MeshPhysicalMaterial({ color: "#c4d1da", metalness: 0.15, roughness: 0.17, transmission: 0.65, thickness: 0.04 })
    : new THREE.MeshStandardMaterial({ color: "#7e8c96", roughness: 0.3, transparent: true, opacity: 0.4 });
  // Deep jambs, recessed timber panels and brass reveals around the entrance.
  for (const side of [-1, 1]) {
    for (const z of [2.0, 4.1, 6.2, 8.3]) {
      place(box(0.12, 3.8, 0.055, materials.walnut), details, [8.44, 2, side * z]);
      for (const y of [0.45, 2.1, 3.65]) place(box(0.1, 0.045, 1.94, materials.walnut), details, [8.42, y, side * (z + 1)]);
    }
    place(box(0.22, 3.1, 0.14, materials.walnut), details, [8.35, 1.55, side * 1.22]);
    // Side bays: blue glass, stone piers and real timber louvers.
    for (const x of [0.1, 3.4, 6.7]) {
      place(box(0.52, 4.7, 0.5, stone), details, [x, 2.35, side * 7.2]);
      const bay = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.65), new THREE.MeshStandardMaterial({ color: "#142330", emissive: "#102c54", emissiveIntensity: 0.5, metalness: 0.25, roughness: 0.32 }));
      place(bay, details, [x + 1.65, 2.45, side * 7.38], [0, side > 0 ? Math.PI : 0, 0]);
      for (let y = 0.75; y < 4.2; y += 0.18) place(box(2.65, 0.055, 0.09, materials.slat), details, [x + 1.65, y, side * 7.24]);
    }
    // Pendants sit outside every actor's sightline.
    for (const x of [1.6, 5.8]) {
      place(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.4, 6), materials.base), details, [x, 4.05, side * 4.8]);
      place(new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.88), glass), details, [x, 3.35, side * 4.8]);
      place(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: "#ffe6be", emissive: "#ffd9a3", emissiveIntensity: 2 })), details, [x, 3.36, side * 4.8]);
    }
  }
  // A tangible product counter next to the presentation board, like the reference.
  const counter = new THREE.Group();
  place(box(1.65, 0.07, 0.72, materials.marble), counter, [0, 0.86, 0]);
  place(box(1.5, 0.8, 0.58, materials.panelWood), counter, [0, 0.4, 0]);
  for (let x = -0.67; x < 0.7; x += 0.065) place(box(0.022, 0.76, 0.025, materials.walnut), counter, [x, 0.41, 0.3]);
  // Neutral sample packaging avoids implying a specific product for custom pitches.
  for (let i = 0; i < 5; i++) {
    const packaging = new THREE.MeshStandardMaterial({ color: ["#ddd7c9", "#b0aea1", "#35434b"][i % 3], roughness: 0.7 });
    const h = 0.16 + (i % 3) * 0.055;
    place(box(0.14, h, 0.12, packaging, { radius: 0.006 }), counter, [-0.5 + i * 0.25, 0.9 + h / 2, 0]);
    place(box(0.145, 0.025, 0.125, materials.notebook, { radius: 0.003 }), counter, [-0.5 + i * 0.25, 0.9 + h, 0]);
  }
  counter.position.set(5.75, 0, 2.65); counter.rotation.y = -Math.PI / 2; details.add(counter);
  return details;
}

export function createSet({ quality = "high" } = {}) {
  const root = new THREE.Group();
  const floorWood = woodTexture({ base: "#8e603d", seed: 3 });
  floorWood.repeat.set(7, 7);
  const leatherGrain = surfaceTexture("leather");
  const stoneGrain = surfaceTexture("stone");
  const floorGrain = floorWood.clone(); floorGrain.colorSpace = THREE.NoColorSpace;
  const slatGrain = surfaceTexture("wood");
  const slatWood = woodTexture({ base: "#6b482e", seed: 6, planks: false });
  const panelMap = slatWood.clone(); panelMap.rotation = Math.PI / 2; panelMap.repeat.set(1, 2);
  const materials = {
    walnut: new THREE.MeshPhysicalMaterial({ color: "#ba8d66", map: slatWood, roughness: 0.32, clearcoat: quality === "high" ? 0.35 : 0, clearcoatRoughness: 0.25 }),
    leather: new THREE.MeshPhysicalMaterial({ color: "#522124", roughness: 0.43, bumpMap: leatherGrain, bumpScale: 0.003, roughnessMap: leatherGrain, clearcoat: quality === "high" ? 0.18 : 0, clearcoatRoughness: 0.48 }),
    piping: new THREE.MeshStandardMaterial({ color: "#81433b", roughness: 0.55 }),
    brass: new THREE.MeshStandardMaterial({ color: "#b59661", metalness: 0.8, roughness: 0.29 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 1, roughness: 0.22 }),
    base: new THREE.MeshStandardMaterial({ color: "#2a2c31", metalness: 0.6, roughness: 0.35 }),
    marble: new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.18 }),
    notebook: new THREE.MeshStandardMaterial({ color: "#1d2129", roughness: 0.6 }),
    slat: new THREE.MeshStandardMaterial({ color: "#b28a66", map: slatWood, bumpMap: slatGrain, bumpScale: 0.002, roughness: 0.42 }),
    darkWood: new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.7 }),
    panelWood: new THREE.MeshStandardMaterial({ color: "#bfa485", map: panelMap, bumpMap: slatGrain, bumpScale: 0.003, roughness: 0.42 }),
    boardFrame: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
    pot: new THREE.MeshStandardMaterial({ color: "#32312d", bumpMap: stoneGrain, bumpScale: 0.008, roughness: 0.85 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#31512b", roughness: 0.75 }),
    hallFloor: new THREE.MeshStandardMaterial({ color: "#0e1522", roughness: 0.18, metalness: 0.2 }),
  };

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshPhysicalMaterial({ map: floorWood, bumpMap: floorGrain, bumpScale: 0.008, color: "#ffffff", roughness: 0.3, clearcoat: quality === "high" ? 0.4 : 0, clearcoatRoughness: 0.3, transparent: quality === "high", opacity: quality === "high" ? 0.88 : 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  // A restrained, local planar reflection under the varnished timber surface.
  // Low quality avoids the extra scene render entirely.
  if (quality === "high") {
    const reflection = new Reflector(new THREE.PlaneGeometry(40, 40), { textureWidth: 768, textureHeight: 768, color: 0x897c6e, clipBias: 0.003 });
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.y = -0.012;
    root.add(reflection);
  }

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 6.7), new THREE.MeshStandardMaterial({ map: rugTexture(), bumpMap: surfaceTexture("fabric"), bumpScale: 0.004, roughness: 0.97 }));
  rug.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  rug.position.set(FOUNDER_MARK.x - 0.45, 0.009, 0);
  rug.receiveShadow = true;
  root.add(rug);

  root.add(slatWall(materials, { width: 20, height: 4.8, x: -1.5 }));
  root.add(floatingStairs(materials));

  for (const z of [10, -10]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(11, 4.8, 0.2), materials.panelWood);
    side.receiveShadow = true;
    place(side, root, [3.6, 2.4, z]);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(14, 22), new THREE.MeshStandardMaterial({ color: "#0b0806", roughness: 0.9 }));
  place(ceiling, root, [3.6, 4.8, 0], [Math.PI / 2, 0, 0]);

  const seats = [];

  for (let index = 0; index < SEAT_ANGLES.length; index += 1) {
    const { position, yaw } = seatTransform(index);
    const chair = loungeChair(materials);
    chair.position.copy(position);
    chair.rotation.y = yaw;
    root.add(chair);
    seats.push({ position, yaw });
  }

  for (let index = 0; index < SEAT_ANGLES.length - 1; index += 1) {
    const angle = (SEAT_ANGLES[index] + SEAT_ANGLES[index + 1]) / 2;
    const table = sideTable(materials, quality);
    table.position.set(FOUNDER_MARK.x - (ARC_RADIUS - 0.2) * Math.cos(angle), 0, (ARC_RADIUS - 0.2) * Math.sin(angle));
    table.rotation.y = Math.atan2(FOUNDER_MARK.x - table.position.x, -table.position.z);
    root.add(table);
  }

  const board = createBoardTexture();
  const boardMesh = displayBoard(board.texture, materials);
  boardMesh.position.set(6.35, 0, 1.6);
  boardMesh.scale.set(1.3, 1.12, 1);
  boardMesh.rotation.y = Math.atan2(0.4 - 6.75, -0.6 - 1.65);
  root.add(boardMesh);

  // A physical 16:9 display beside the founder; never a screen-space overlay.
  const presentation = new THREE.Group();
  presentation.position.set(6.5, 0, 2.2);
  presentation.rotation.y = Math.atan2(0.4 - 6.5, -0.6 - 2.2);
  const screenMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), screenMaterial);
  place(screen, presentation, [0, 1.95, 0.071]);
  place(box(3.3, 1.9, 0.14, materials.boardFrame, { radius: 0.025 }), presentation, [0, 1.95, 0]);
  for (const side of [-1, 1]) {
    place(box(0.065, 1.08, 0.08, materials.chrome), presentation, [side * 1.05, 0.54, 0]);
    place(box(0.45, 0.045, 0.65, materials.boardFrame), presentation, [side * 1.05, 0.025, 0]);
  }
  presentation.visible = false;
  root.add(presentation);
  let slideTextures = [];

  const plantA = planter(materials);
  plantA.position.set(7.9, 0, -3.5);
  root.add(plantA);
  const plantB = planter(materials);
  plantB.position.set(7.9, 0, 3.4);
  root.add(plantB);

  root.add(entranceWall(materials));
  root.add(architecturalDetails(materials, quality));
  const hall = hallway(materials);
  root.add(hall.group);
  // Merge the stationary architecture by material. Dynamic fish, product props,
  // reflector and instanced nailheads retain their own objects and behavior.
  root.updateMatrixWorld(true);
  const batches = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isReflector || mesh.isInstancedMesh || Array.isArray(mesh.material)) return;
    for (let node = mesh; node && node !== root; node = node.parent) {
      if (node.userData.speed !== undefined || node === boardMesh || node === presentation) return;
    }
    const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  });
  const unused = new Set();
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => {
      let geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
      return geometry;
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach(item => item.dispose());
    if (!geometry) continue;
    const batch = new THREE.Mesh(geometry, meshes[0].material);
    batch.castShadow = meshes[0].castShadow; batch.receiveShadow = meshes[0].receiveShadow;
    for (const mesh of meshes) { mesh.removeFromParent(); unused.add(mesh.geometry); }
    root.add(batch);
  }
  // Geometry shared by a retained object must stay alive.
  root.traverse(node => { if (node.geometry) unused.delete(node.geometry); });
  unused.forEach(geometry => geometry.dispose());

  return {
    root,
    seats,
    board: { setPitch(pitch) { board.setPitch(pitch); boardMesh.userData.setPitch(pitch); } },
    deck: {
      setSlides(canvases = []) {
        slideTextures.forEach(texture => texture.dispose());
        slideTextures = canvases.map(canvas => {
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          return texture;
        });
        screenMaterial.map = slideTextures[0] || null;
        screenMaterial.needsUpdate = true;
        presentation.visible = slideTextures.length > 0;
        boardMesh.visible = !presentation.visible;
      },
      showSlide(index) {
        if (slideTextures[index]) screenMaterial.map = slideTextures[index];
      },
    },
    update(time) {
      hall.update(time);
    },
  };
}

export function addStudioLights(scene, { quality = "high" } = {}) {
  RectAreaLightUniformsLib.init();
  const shadowSize = quality === "high" ? 2048 : 1024;
  // Broad softboxes give upholstered furniture and polished wood real highlights.
  for (const [x, y, z, intensity, tx] of quality === "high" ? [[3, 4.1, 1, 4, 0.5], [4, 3.8, -3, 3, 5.2]] : []) {
    const softbox = new THREE.RectAreaLight("#fff0de", intensity, 3.5, 1.8);
    softbox.position.set(x, y, z); softbox.lookAt(tx, 0.8, 0); scene.add(softbox);
  }
  scene.add(new THREE.HemisphereLight("#f1e8dc", "#29201a", 0.5));

  const panelKey = new THREE.SpotLight("#fff0df", 42, 18, 0.62, 0.7, 1.4);
  panelKey.position.set(3.4, 4.4, 0.4);
  panelKey.target.position.set(0.6, 0.7, 0);
  panelKey.castShadow = true;
  panelKey.shadow.mapSize.set(shadowSize, shadowSize);
  panelKey.shadow.bias = -0.0004;
  panelKey.shadow.normalBias = 0.02;
  scene.add(panelKey, panelKey.target);

  const founderKey = new THREE.SpotLight("#fff1dc", 36, 16, 0.42, 0.6, 1.4);
  founderKey.position.set(2.6, 4.2, 1.8);
  founderKey.target.position.set(FOUNDER_MARK.x, 1.0, 0);
  founderKey.castShadow = true;
  founderKey.shadow.mapSize.set(shadowSize, shadowSize);
  founderKey.shadow.bias = -0.0004;
  founderKey.shadow.normalBias = 0.02;
  scene.add(founderKey, founderKey.target);

  const panelFill = new THREE.SpotLight("#cfe0ff", 16, 14, 0.8, 0.9, 1.6);
  panelFill.position.set(6.8, 3.0, 0);
  panelFill.target.position.set(0.5, 1.0, 0);
  scene.add(panelFill, panelFill.target);

  // Warm rim light from the glowing wall behind the panel.
  for (const z of [2.2, 0, -2.2]) {
    const rim = new THREE.PointLight("#e8ae74", 1.4, 5, 1.8);
    rim.position.set(-0.9, 1.9, z);
    scene.add(rim);
  }

  if (quality === "high") {
    // A soft pool of light on each seat.
    for (const index of [0, 1, 2, 3, 4]) {
      const { position, forward } = seatTransform(index);
      const pool = new THREE.SpotLight("#ffe6c8", 5, 7, 0.34, 0.9, 1.5);
      pool.position.copy(position).addScaledVector(forward, 1.4).setY(4.2);
      pool.target.position.copy(position).setY(0.9);
      scene.add(pool, pool.target);
    }
  }

  const hallBlue = new THREE.PointLight("#4aa8ff", 12, 9, 1.6);
  hallBlue.position.set(10.5, 2.2, 0);
  scene.add(hallBlue);

  // Warm washes on the wood panels either side of the entrance.
  for (const z of [3.2, -3.2]) {
    const wash = new THREE.SpotLight("#ffddb0", 18, 9, 0.5, 0.9, 1.5);
    wash.position.set(5.4, 4.3, z);
    wash.target.position.set(8.5, 1.8, z * 1.15);
    scene.add(wash, wash.target);
  }

  const founderFill = new THREE.PointLight("#9fc8ff", 4, 7, 1.8);
  founderFill.position.set(7.4, 2.0, 1.6);
  scene.add(founderFill);
}
