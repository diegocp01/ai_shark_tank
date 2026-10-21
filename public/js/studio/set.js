// The Shark Tank set in 3D. The sharks sit in an arc of lounge chairs facing
// the founder's mark on the rug; behind them is the glowing slat wall with
// blue-lit stairs, and behind the founder is the entrance hallway.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  createBoardTexture,
  hallTexture,
  marbleTexture,
  rugTexture,
  signTexture,
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

function loungeChair(materials) {
  const chair = new THREE.Group();
  place(box(0.8, 0.1, 0.7, materials.walnut, { radius: 0.04 }), chair, [0, 0.38, -0.02]);
  place(box(0.68, 0.12, 0.62, materials.leather, { radius: 0.055, segments: 4 }), chair, [0, 0.49, 0.01]);
  const back = new THREE.Group();
  place(box(0.8, 0.9, 0.09, materials.walnut, { radius: 0.045 }), back, [0, 0.45, 0]);
  place(box(0.68, 0.4, 0.11, materials.leather, { radius: 0.05, segments: 4 }), back, [0, 0.24, 0.07]);
  place(box(0.68, 0.4, 0.11, materials.leather, { radius: 0.05, segments: 4 }), back, [0, 0.66, 0.07]);
  place(back, chair, [0, 0.42, -0.37], [-0.17, 0, 0]);

  for (const side of [1, -1]) {
    place(box(0.1, 0.05, 0.54, materials.walnut, { radius: 0.022 }), chair, [side * 0.38, 0.64, -0.02]);
    place(box(0.09, 0.036, 0.48, materials.leather, { radius: 0.016 }), chair, [side * 0.38, 0.678, -0.02]);
    place(box(0.06, 0.22, 0.06, materials.walnut, { radius: 0.02 }), chair, [side * 0.38, 0.52, -0.24]);
  }

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 20), materials.chrome);
  stem.castShadow = true;
  place(stem, chair, [0, 0.2, -0.02]);

  for (let index = 0; index < 5; index += 1) {
    const foot = box(0.05, 0.03, 0.36, materials.base, { radius: 0.012 });
    const pivot = new THREE.Group();
    pivot.rotation.y = (index / 5) * Math.PI * 2;
    place(foot, pivot, [0, 0.035, 0.18]);
    place(pivot, chair, [0, 0, -0.02]);
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
  gradient.addColorStop(0.45, "#ff9a48");
  gradient.addColorStop(0.75, "#ff7a2c");
  gradient.addColorStop(1, "#3a1404");
  glowContext.fillStyle = gradient;
  glowContext.fillRect(0, 0, 8, 256);
  const glowMap = new THREE.CanvasTexture(glowCanvas);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: glowMap, emissiveIntensity: 1.5 }),
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
  const led = new THREE.MeshStandardMaterial({ color: "#0a1f3d", emissive: "#4aa8ff", emissiveIntensity: 3 });

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
    emissiveIntensity: 1.25,
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
  const strip = new THREE.MeshStandardMaterial({ color: "#000", emissive: "#dff2ff", emissiveIntensity: 2.4 });

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
    new THREE.MeshStandardMaterial({ color: "#000", emissive: "#9fd6ff", emissiveIntensity: 1.2 }),
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
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffcf9a", emissiveIntensity: 1.6 });

  for (const z of [1.12, -1.12]) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 0.05), frameMaterial), wall, [8.48, 1.45, z]);
  }

  place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 2.29), frameMaterial), wall, [8.48, 2.9, 0]);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.7),
    new THREE.MeshStandardMaterial({ map: signTexture(), emissive: "#ffffff", emissiveMap: signTexture(), emissiveIntensity: 1.4, transparent: true }),
  );
  place(sign, wall, [8.47, 3.45, 0], [0, -Math.PI / 2, 0]);

  for (const z of [5.2, -5.2]) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.6, 0.06), new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ff4f8b", emissiveIntensity: 2 })), wall, [8.47, 2.0, z]);
  }

  return wall;
}

export function createSet({ quality = "high" } = {}) {
  const root = new THREE.Group();
  const floorWood = woodTexture({ base: "#4a2e1c", seed: 3 });
  floorWood.repeat.set(9, 9);
  const slatWood = woodTexture({ base: "#3d2415", seed: 6, planks: false });
  const materials = {
    walnut: new THREE.MeshStandardMaterial({ color: "#8a5532", map: slatWood, roughness: 0.42 }),
    leather: new THREE.MeshStandardMaterial({ color: "#d8c8ae", roughness: 0.48 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 1, roughness: 0.22 }),
    base: new THREE.MeshStandardMaterial({ color: "#2a2c31", metalness: 0.6, roughness: 0.35 }),
    marble: new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.18 }),
    notebook: new THREE.MeshStandardMaterial({ color: "#1d2129", roughness: 0.6 }),
    slat: new THREE.MeshStandardMaterial({ color: "#6b4126", map: slatWood, roughness: 0.6 }),
    darkWood: new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.7 }),
    panelWood: new THREE.MeshStandardMaterial({ color: "#5a3820", map: slatWood, roughness: 0.65 }),
    boardFrame: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
    pot: new THREE.MeshStandardMaterial({ color: "#2b2f36", roughness: 0.5 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#4f8a3f", roughness: 0.75 }),
    hallFloor: new THREE.MeshStandardMaterial({ color: "#0e1522", roughness: 0.18, metalness: 0.2 }),
  };

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: floorWood, color: "#ffffff", roughness: 0.34, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.7), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.92 }));
  rug.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  rug.position.set(FOUNDER_MARK.x + 0.15, 0.006, 0);
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
  boardMesh.position.set(6.75, 0, 1.65);
  boardMesh.rotation.y = Math.atan2(0.4 - 6.75, -0.6 - 1.65);
  root.add(boardMesh);

  const plantA = planter(materials);
  plantA.position.set(7.9, 0, -3.5);
  root.add(plantA);
  const plantB = planter(materials);
  plantB.position.set(7.9, 0, 3.4);
  root.add(plantB);

  root.add(entranceWall(materials));
  const hall = hallway(materials);
  root.add(hall.group);

  return {
    root,
    seats,
    board,
    update(time) {
      hall.update(time);
    },
  };
}

export function addStudioLights(scene, { quality = "high" } = {}) {
  const shadowSize = quality === "high" ? 2048 : 1024;
  scene.add(new THREE.HemisphereLight("#ffe1c2", "#120c0a", 0.22));

  const panelKey = new THREE.SpotLight("#ffe0bd", 38, 18, 0.62, 0.7, 1.4);
  panelKey.position.set(3.4, 6.2, 0.4);
  panelKey.target.position.set(0.6, 0.7, 0);
  panelKey.castShadow = true;
  panelKey.shadow.mapSize.set(shadowSize, shadowSize);
  panelKey.shadow.bias = -0.0004;
  panelKey.shadow.normalBias = 0.02;
  scene.add(panelKey, panelKey.target);

  const founderKey = new THREE.SpotLight("#fff1dc", 36, 16, 0.42, 0.6, 1.4);
  founderKey.position.set(2.6, 5.6, 1.8);
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
    const rim = new THREE.PointLight("#ff8a3c", 3.2, 5, 1.8);
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
    const wash = new THREE.SpotLight("#ffb978", 14, 9, 0.5, 0.9, 1.5);
    wash.position.set(5.4, 4.3, z);
    wash.target.position.set(8.5, 1.8, z * 1.15);
    scene.add(wash, wash.target);
  }

  const founderFill = new THREE.PointLight("#9fc8ff", 4, 7, 1.8);
  founderFill.position.set(7.4, 2.0, 1.6);
  scene.add(founderFill);
}
