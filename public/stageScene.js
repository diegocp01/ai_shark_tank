import * as THREE from "/vendor/three.module.js";

const DEFAULT_FOUNDER_LOOK = {
  top: { type: "blazer", color: "midnight_navy", hex: "#24324f" },
  bottom: { type: "tailored_trousers", color: "sand", hex: "#bca486" },
};

const SHARK_WARDROBE = {
  rex: {
    top: { type: "blazer", color: "oxblood", hex: "#6b2c39" },
    bottom: { type: "tailored_trousers", color: "jet_black", hex: "#191b20" },
  },
  luna: {
    top: { type: "turtleneck", color: "forest_green", hex: "#31564c" },
    bottom: { type: "wide_leg_trousers", color: "soft_ivory", hex: "#ebe3d5" },
  },
  max: {
    top: { type: "blazer", color: "charcoal", hex: "#444a57" },
    bottom: { type: "tailored_trousers", color: "midnight_navy", hex: "#24324f" },
  },
  vera: {
    top: { type: "bomber", color: "plum", hex: "#674366" },
    bottom: { type: "wide_leg_trousers", color: "jet_black", hex: "#191b20" },
  },
  wes: {
    top: { type: "hoodie", color: "electric_blue", hex: "#4167b5" },
    bottom: { type: "jeans", color: "warm_taupe", hex: "#8f7a6a" },
  },
};

const CAMERA_BASE = {
  radius: 16.6,
  azimuth: -0.96,
  polar: 1.14,
};

const AUTO_CAMERA_AZIMUTH_MIN = CAMERA_BASE.azimuth - 0.24;
const AUTO_CAMERA_AZIMUTH_MAX = CAMERA_BASE.azimuth + 0.4;

const BASE_CAMERA_TARGET = new THREE.Vector3(-0.45, 1.55, 0.7);
const FOUNDER_MARK = new THREE.Vector3(4.45, 0, 1.75);
const HALL_AXIS_X = FOUNDER_MARK.x;
const SHARK_FOCUS = new THREE.Vector3(-2.1, 0, 0.9);
const SHARK_CAMERA_TARGET = new THREE.Vector3(-1.9, 1.5, 1.1);
const FOUNDER_CAMERA_TARGET = new THREE.Vector3(2.5, 1.68, 1.55);
const SHARK_BANK_CENTER = new THREE.Vector3(-3.8, 0, 0.9);
const SHARK_ARC_START = Math.PI + -0.82;
const SHARK_ARC_STEP = 0.42;
const SHARK_DECK_SCALE_X = 0.78;
const SHARK_DESK_X_RADIUS = 3.6;
const SHARK_DESK_Z_RADIUS = 4.95;
const SHARK_SEAT_X_RADIUS = 3.3;
const SHARK_SEAT_Z_RADIUS = 4.68;
const CORRIDOR_REAR_Z = -8.1;
const CORRIDOR_FRONT_Z = -1.55;
const CORRIDOR_CENTER_Z = (CORRIDOR_REAR_Z + CORRIDOR_FRONT_Z) / 2;
const CORRIDOR_LENGTH = Math.abs(CORRIDOR_FRONT_Z - CORRIDOR_REAR_Z);
const CORRIDOR_HALF_WIDTH = 2.7;
const WATER_CHANNEL_HALF_WIDTH = 1.86;
const AQUARIUM_HALF_WIDTH = 2.56;
const AQUARIUM_ZS = [-5.35, -3.15];
const STUDIO_REAR_Z = -9.35;
const STUDIO_LEFT_X = -13.2;
const STUDIO_RIGHT_X = 12.65;
const STUDIO_FRONT_Z = 10.4;
const STUDIO_CEILING_Y = 6.85;
const CITY_WINDOW_X = -7.55;
const CITY_WINDOW_Y = 5.15;
const CITY_WINDOW_Z = -5.72;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let next = angle % twoPi;

  if (next > Math.PI) {
    next -= twoPi;
  } else if (next < -Math.PI) {
    next += twoPi;
  }

  return next;
}

function alignAngleToReference(angle, reference) {
  const twoPi = Math.PI * 2;
  const offsetTurns = Math.round((reference - angle) / twoPi);
  return angle + offsetTurns * twoPi;
}

function lerpAngle(current, target, t) {
  const alignedTarget = alignAngleToReference(target, current);
  return current + (alignedTarget - current) * t;
}

function yawToward(from, target) {
  return Math.atan2(target.x - from.x, target.z - from.z);
}

function orientUprightToward(object, from, target) {
  object.rotation.set(0, yawToward(from, target), 0);
}

function hexColor(input, fallback = "#8f7a6a") {
  return new THREE.Color(input || fallback);
}

function createCanvasTexture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  draw(context, canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createWoodTexture() {
  const texture = createCanvasTexture((ctx, canvas) => {
    ctx.fillStyle = "#5a341f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 90; i += 1) {
      const y = (i / 90) * canvas.height;
      ctx.fillStyle = i % 2 === 0 ? "rgba(188, 130, 83, 0.2)" : "rgba(84, 47, 27, 0.15)";
      ctx.fillRect(0, y, canvas.width, canvas.height / 120);
    }

    for (let i = 0; i < 2400; i += 1) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = `rgba(18, 10, 6, ${alpha})`;
      ctx.fillRect(x, y, Math.random() * 18 + 2, 1);
    }
  });

  texture.repeat.set(6, 6);
  return texture;
}

function createSlatTexture() {
  const texture = createCanvasTexture((ctx, canvas) => {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "#2d170d");
    gradient.addColorStop(0.5, "#704023");
    gradient.addColorStop(1, "#2a160f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 32; i += 1) {
      const x = (canvas.width / 32) * i;
      ctx.fillStyle = "rgba(15, 7, 4, 0.52)";
      ctx.fillRect(x, 0, 6, canvas.height);
      ctx.fillStyle = "rgba(255, 199, 145, 0.06)";
      ctx.fillRect(x + 6, 0, 2, canvas.height);
    }
  });

  texture.repeat.set(3, 2);
  return texture;
}

function createCityTexture() {
  const texture = createCanvasTexture((ctx, canvas) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#08122e");
    gradient.addColorStop(0.6, "#12224a");
    gradient.addColorStop(1, "#070a14");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 120; i += 1) {
      const width = Math.random() * 32 + 10;
      const height = Math.random() * 300 + 80;
      const x = Math.random() * canvas.width;
      const y = canvas.height - height;
      ctx.fillStyle = `rgba(10, 10, 18, ${Math.random() * 0.5 + 0.4})`;
      ctx.fillRect(x, y, width, height);

      for (let row = 0; row < height / 12; row += 1) {
        for (let col = 0; col < width / 10; col += 1) {
          if (Math.random() > 0.74) {
            ctx.fillStyle = Math.random() > 0.2 ? "rgba(255, 211, 119, 0.86)" : "rgba(163, 204, 255, 0.72)";
            ctx.fillRect(x + col * 8 + 2, y + row * 10 + 2, 4, 5);
          }
        }
      }
    }
  });

  return texture;
}

function createWaterTexture() {
  const texture = createCanvasTexture((ctx, canvas) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1d56ff");
    gradient.addColorStop(0.45, "#0d1e71");
    gradient.addColorStop(1, "#040918");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 160; i += 1) {
      ctx.fillStyle = `rgba(132, 209, 255, ${Math.random() * 0.16})`;
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 30 + 8;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return texture;
}

function createMaterial(color, overrides = {}) {
  return new THREE.MeshStandardMaterial({
    color: hexColor(color),
    roughness: 0.78,
    metalness: 0.08,
    ...overrides,
  });
}

function createRoundedDesk(width, height, depth, color) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth, 10, 1, 10),
    createMaterial(color, { roughness: 0.74 }),
  );
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.96, 0.05, depth * 0.92, 10, 1, 10),
    createMaterial("#7c7470", { metalness: 0.16, roughness: 0.44 }),
  );
  top.position.y = height / 2 + 0.04;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  return group;
}

function createSpotDisc(radius, color, opacity = 0.34) {
  const material = new THREE.MeshBasicMaterial({
    color: hexColor(color),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), material);
  disc.rotation.x = -Math.PI / 2;
  return disc;
}

function createChair(colorHex) {
  const chair = new THREE.Group();
  const shellMaterial = createMaterial("#e6ddd0", { roughness: 0.66 });
  const trimMaterial = createMaterial(colorHex || "#7b2e36", { roughness: 0.7 });
  const metalMaterial = createMaterial("#4f5155", { metalness: 0.35, roughness: 0.34 });
  const cushionMaterial = createMaterial("#f4ede2", { roughness: 0.7 });

  const seatShell = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 1.18), shellMaterial);
  seatShell.position.y = 0.9;
  seatShell.castShadow = true;
  seatShell.receiveShadow = true;
  chair.add(seatShell);

  const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.12, 0.92), cushionMaterial);
  seatCushion.position.set(0, 1.02, 0);
  seatCushion.castShadow = true;
  chair.add(seatCushion);

  const backShell = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.45, 0.22), shellMaterial);
  backShell.position.set(0, 1.62, -0.46);
  backShell.castShadow = true;
  chair.add(backShell);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.16, 0.08), trimMaterial);
  trim.position.set(0, 1.6, -0.32);
  trim.castShadow = true;
  chair.add(trim);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.84), shellMaterial);
  leftArm.position.set(0.73, 1.18, -0.02);
  leftArm.castShadow = true;
  chair.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = -0.73;
  chair.add(rightArm);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.95, 18), metalMaterial);
  base.position.y = 0.46;
  chair.add(base);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, 0.08, 18), metalMaterial);
  foot.position.y = 0.04;
  chair.add(foot);

  return chair;
}

function createFish(colorHex, scale = 1) {
  const fish = new THREE.Group();
  const bodyMaterial = createMaterial(colorHex, {
    roughness: 0.38,
    metalness: 0.08,
    emissive: hexColor(colorHex).multiplyScalar(0.08),
  });
  const finMaterial = createMaterial("#f2f0e9", {
    roughness: 0.52,
    transparent: true,
    opacity: 0.84,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 14, 14), bodyMaterial);
  body.scale.set(0.78, 0.88, 1.48);
  body.castShadow = true;
  fish.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 0.2 * scale, 3), bodyMaterial);
  tail.position.z = -0.2 * scale;
  tail.rotation.x = Math.PI / 2;
  tail.castShadow = true;
  fish.add(tail);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.12 * scale, 3), finMaterial);
  dorsal.position.set(0, 0.11 * scale, 0);
  dorsal.rotation.z = Math.PI;
  fish.add(dorsal);

  const leftFin = new THREE.Mesh(new THREE.ConeGeometry(0.035 * scale, 0.1 * scale, 3), finMaterial);
  leftFin.position.set(0.06 * scale, 0, 0.02 * scale);
  leftFin.rotation.z = -Math.PI / 2;
  fish.add(leftFin);

  const rightFin = leftFin.clone();
  rightFin.position.x = -0.06 * scale;
  rightFin.rotation.z = Math.PI / 2;
  fish.add(rightFin);

  return {
    group: fish,
    tail,
    dorsal,
  };
}

function createAquariumPanel({ x, y, z, depth = 3.5, glow = 0.72 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const frameMaterial = createMaterial("#2a1d19", { roughness: 0.62, metalness: 0.18 });
  const trimMaterial = createMaterial("#7d5a3b", { roughness: 0.48, metalness: 0.22 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: hexColor("#8bd0ff"),
    roughness: 0.12,
    metalness: 0,
    transmission: 0.18,
    transparent: true,
    opacity: 0.26,
    ior: 1.16,
    thickness: 0.4,
  });
  const waterMaterial = createMaterial("#1e4fd5", {
    emissive: hexColor("#245fff"),
    emissiveIntensity: glow,
    transparent: true,
    opacity: 0.84,
    roughness: 0.22,
  });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.92, depth + 0.36), frameMaterial);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const innerBezel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.76, depth + 0.18), trimMaterial);
  group.add(innerBezel);

  const water = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.6, depth - 0.12), waterMaterial);
  group.add(water);

  const glassFront = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.64, depth - 0.08), glassMaterial);
  glassFront.position.x = 0.02;
  group.add(glassFront);

  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.16, depth - 0.28),
    createMaterial("#b8a280", { roughness: 0.92 }),
  );
  sand.position.y = -0.68;
  group.add(sand);

  const coralColors = ["#ef7f4e", "#f2d26c", "#5cc0b4"];
  for (let index = 0; index < 4; index += 1) {
    const coral = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.04, 0.24 + index * 0.04, 8),
      createMaterial(coralColors[index % coralColors.length], {
        emissive: hexColor(coralColors[index % coralColors.length]).multiplyScalar(0.04),
      }),
    );
    coral.position.set(
      -0.01 + (index % 2) * 0.018,
      -0.54 + (index % 3) * 0.06,
      -depth * 0.18 + index * (depth * 0.12),
    );
    coral.rotation.z = (index - 1.5) * 0.14;
    group.add(coral);
  }

  for (let index = 0; index < 4; index += 1) {
    const seaweed = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.48 + index * 0.04, 0.06),
      createMaterial("#3e7b66", { roughness: 0.88 }),
    );
    seaweed.position.set(
      0,
      -0.43 + index * 0.05,
      depth * 0.18 - index * (depth * 0.11),
    );
    seaweed.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.18;
    group.add(seaweed);
  }

  const fishPalette = ["#f19a38", "#ffd868", "#80d8ff", "#f6f0e5"];
  const fish = [];

  for (let index = 0; index < 5; index += 1) {
    const fishModel = createFish(fishPalette[index % fishPalette.length], 0.9 + (index % 2) * 0.12);
    const swimRoot = new THREE.Group();
    swimRoot.add(fishModel.group);
    swimRoot.position.set(0.008 * (index % 2 === 0 ? 1 : -1), -0.12 + index * 0.13, -1 + index * 0.52);
    group.add(swimRoot);
    fish.push({
      root: swimRoot,
      tail: fishModel.tail,
      dorsal: fishModel.dorsal,
      phase: index * 1.17 + depth * 0.08,
      speed: 0.58 + index * 0.06,
      yOffset: -0.16 + index * 0.11,
      yAmplitude: 0.08 + (index % 3) * 0.025,
      zAmplitude: depth * (0.18 + (index % 2) * 0.05),
      xAmplitude: 0.018 + (index % 2) * 0.012,
    });
  }

  return { group, fish };
}

function createOutfitDetails(look, clothingGroups, seated) {
  const { topGroup, bottomGroup } = clothingGroups;
  const topColor = look.top.hex || "#24324f";
  const bottomColor = look.bottom.hex || "#8f7a6a";
  const topMaterial = createMaterial(topColor, {
    emissive: hexColor(topColor).multiplyScalar(0.02),
  });
  const bottomMaterial = createMaterial(bottomColor);
  const contrastMaterial = createMaterial("#efe4d5", { roughness: 0.74 });

  topGroup.clear();
  bottomGroup.clear();

  let torsoRadius = 0.45;
  let torsoLength = seated ? 0.42 : 0.56;
  let sleeveRadius = 0.12;
  let sleeveLength = seated ? 0.62 : 0.72;
  let shoulderWidth = 1.18;
  let waistWidth = 0.82;
  let pelvisWidth = 0.96;

  if (look.top.type === "hoodie") {
    torsoRadius = 0.54;
    sleeveRadius = 0.14;
    shoulderWidth = 1.26;
    waistWidth = 0.9;
  } else if (look.top.type === "bomber") {
    torsoRadius = 0.5;
    torsoLength = seated ? 0.38 : 0.5;
    shoulderWidth = 1.2;
    waistWidth = 0.88;
  } else if (look.top.type === "turtleneck") {
    torsoRadius = 0.43;
    shoulderWidth = 1.08;
    waistWidth = 0.78;
  } else if (look.top.type === "knit_polo") {
    torsoRadius = 0.44;
    shoulderWidth = 1.1;
    waistWidth = 0.8;
  }

  const torsoShell = new THREE.Mesh(
    new THREE.CapsuleGeometry(torsoRadius, torsoLength, 8, 18),
    topMaterial,
  );
  torsoShell.scale.set(shoulderWidth, 1, 0.82);
  torsoShell.position.y = 0;
  torsoShell.castShadow = true;
  topGroup.add(torsoShell);

  const chestShell = new THREE.Mesh(
    new THREE.CapsuleGeometry(torsoRadius * 0.93, torsoLength * 0.72, 8, 16),
    topMaterial,
  );
  chestShell.scale.set(shoulderWidth * 0.97, 1, 0.84);
  chestShell.position.set(0, seated ? 0.12 : 0.16, 0.03);
  chestShell.castShadow = true;
  topGroup.add(chestShell);

  const waistShell = new THREE.Mesh(
    new THREE.CapsuleGeometry(torsoRadius * 0.72, seated ? 0.18 : 0.24, 8, 14),
    topMaterial,
  );
  waistShell.scale.set(waistWidth * 0.94, 1, 0.78);
  waistShell.position.set(0, seated ? -0.18 : -0.24, 0.02);
  waistShell.castShadow = true;
  topGroup.add(waistShell);

  const shoulderYoke = new THREE.Mesh(
    new THREE.BoxGeometry(shoulderWidth * 0.9, 0.18, 0.58),
    topMaterial,
  );
  shoulderYoke.position.set(0, 0.28, 0.02);
  shoulderYoke.castShadow = true;
  topGroup.add(shoulderYoke);

  const waistBreak = new THREE.Mesh(
    new THREE.BoxGeometry(waistWidth, 0.12, 0.34),
    createMaterial("#13161b", { roughness: 0.68 }),
  );
  waistBreak.position.set(0, seated ? -0.34 : -0.44, 0.04);
  topGroup.add(waistBreak);

  const leftSleeveShell = new THREE.Mesh(
    new THREE.CylinderGeometry(sleeveRadius * 0.92, sleeveRadius, sleeveLength, 12),
    topMaterial,
  );
  leftSleeveShell.position.set(0.66, -0.06, 0);
  leftSleeveShell.rotation.z = -0.62;
  leftSleeveShell.castShadow = true;
  topGroup.add(leftSleeveShell);

  const rightSleeveShell = leftSleeveShell.clone();
  rightSleeveShell.position.x = -0.62;
  rightSleeveShell.rotation.z = 0.62;
  topGroup.add(rightSleeveShell);

  if (look.top.type === "blazer") {
    const leftFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.18), topMaterial);
    leftFront.position.set(0.17, -0.02, 0.34);
    leftFront.rotation.z = 0.08;
    leftFront.castShadow = true;
    topGroup.add(leftFront);

    const rightFront = leftFront.clone();
    rightFront.position.x = -0.17;
    rightFront.rotation.z = -0.08;
    topGroup.add(rightFront);

    const leftLapel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.56, 0.12), contrastMaterial);
    leftLapel.position.set(0.08, 0.04, 0.4);
    leftLapel.rotation.z = 0.34;
    topGroup.add(leftLapel);

    const rightLapel = leftLapel.clone();
    rightLapel.position.x = -0.08;
    rightLapel.rotation.z = -0.34;
    topGroup.add(rightLapel);
  } else if (look.top.type === "hoodie") {
    const hood = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.12, 12, 28, Math.PI),
      topMaterial,
    );
    hood.position.set(0, 0.48, -0.18);
    hood.rotation.x = Math.PI / 2;
    topGroup.add(hood);

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.08), createMaterial("#101317"));
    pocket.position.set(0, -0.2, 0.42);
    topGroup.add(pocket);
  } else if (look.top.type === "turtleneck") {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.28, 18), topMaterial);
    collar.position.set(0, 0.48, 0);
    topGroup.add(collar);
  } else if (look.top.type === "knit_polo") {
    const collarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), contrastMaterial);
    collarLeft.position.set(0.08, 0.33, 0.36);
    collarLeft.rotation.z = 0.46;
    topGroup.add(collarLeft);

    const collarRight = collarLeft.clone();
    collarRight.position.x = -0.08;
    collarRight.rotation.z = -0.46;
    topGroup.add(collarRight);

    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.08), contrastMaterial);
    placket.position.set(0, 0.14, 0.38);
    topGroup.add(placket);
  } else if (look.top.type === "bomber") {
    const hem = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.1, 0.54), createMaterial("#18191d"));
    hem.position.set(0, -0.4, 0);
    topGroup.add(hem);
  }

  const waistband = new THREE.Mesh(
    new THREE.BoxGeometry(waistWidth * 0.96, seated ? 0.12 : 0.14, 0.42),
    bottomMaterial,
  );
  waistband.position.set(0, seated ? 0.2 : 0.02, 0);
  bottomGroup.add(waistband);

  const pelvisShell = new THREE.Mesh(
    new THREE.BoxGeometry(pelvisWidth, seated ? 0.34 : 0.4, 0.5),
    bottomMaterial,
  );
  pelvisShell.position.set(0, seated ? 0.02 : -0.12, 0);
  pelvisShell.castShadow = true;
  bottomGroup.add(pelvisShell);

  let upperLegScale = 1;
  let lowerLegScale = 1;

  if (look.bottom.type === "wide_leg_trousers") {
    upperLegScale = 1.14;
    lowerLegScale = 1.24;
  } else if (look.bottom.type === "jeans") {
    upperLegScale = 0.96;
    lowerLegScale = 0.9;
  } else if (look.bottom.type === "chinos") {
    upperLegScale = 1;
    lowerLegScale = 0.96;
  } else {
    upperLegScale = 1.04;
    lowerLegScale = 0.98;
  }

  return {
    topMaterial,
    bottomMaterial,
    upperLegScale,
    lowerLegScale,
  };
}

function createFigure({
  id,
  seated = false,
  accent = "#d4b184",
  look = DEFAULT_FOUNDER_LOOK,
}) {
  const root = new THREE.Group();
  root.name = `${id}-figure`;
  const skinMaterial = createMaterial("#0f1115", { roughness: 0.95 });
  const shoeMaterial = createMaterial("#111215");

  const topPivot = new THREE.Group();
  const baseTopY = seated ? 1.45 : 1.52;
  topPivot.position.y = baseTopY;
  root.add(topPivot);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, seated ? 0.48 : 0.68, 8, 18),
    skinMaterial,
  );
  torso.scale.set(1.08, 1, 0.78);
  torso.castShadow = true;
  topPivot.add(torso);

  const trapezoid = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.18, 0.42), skinMaterial);
  trapezoid.position.set(0, seated ? 0.34 : 0.38, 0);
  trapezoid.castShadow = true;
  topPivot.add(trapezoid);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 16), skinMaterial);
  neck.position.y = seated ? 0.58 : 0.68;
  neck.castShadow = true;
  topPivot.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), skinMaterial);
  head.position.y = seated ? 0.94 : 1.12;
  head.castShadow = true;
  topPivot.add(head);

  const topClothingGroup = new THREE.Group();
  topPivot.add(topClothingGroup);

  const leftUpperArmPivot = new THREE.Group();
  leftUpperArmPivot.position.set(0.5, seated ? 0.3 : 0.34, 0);
  topPivot.add(leftUpperArmPivot);
  const rightUpperArmPivot = leftUpperArmPivot.clone();
  rightUpperArmPivot.position.x = -0.46;
  topPivot.add(rightUpperArmPivot);

  const armGeometry = new THREE.CylinderGeometry(0.116, 0.094, 0.5, 12);
  const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
  leftArm.position.y = -0.28;
  leftArm.castShadow = true;
  leftUpperArmPivot.add(leftArm);
  const rightArm = leftArm.clone();
  rightUpperArmPivot.add(rightArm);

  const leftLowerArmPivot = new THREE.Group();
  leftLowerArmPivot.position.set(0, -0.53, 0.02);
  leftUpperArmPivot.add(leftLowerArmPivot);
  const rightLowerArmPivot = leftLowerArmPivot.clone();
  rightUpperArmPivot.add(rightLowerArmPivot);

  const forearmGeometry = new THREE.CylinderGeometry(0.088, 0.068, 0.46, 12);
  const leftForearm = new THREE.Mesh(forearmGeometry, skinMaterial);
  leftForearm.position.y = -0.22;
  leftForearm.castShadow = true;
  leftLowerArmPivot.add(leftForearm);
  const rightForearm = leftForearm.clone();
  rightLowerArmPivot.add(rightForearm);

  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.18), skinMaterial);
  leftHand.position.set(0, -0.46, 0.03);
  leftHand.castShadow = true;
  leftLowerArmPivot.add(leftHand);
  const rightHand = leftHand.clone();
  rightLowerArmPivot.add(rightHand);

  const hipPivot = new THREE.Group();
  hipPivot.position.set(0, seated ? 0.95 : 0.74, 0);
  root.add(hipPivot);

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 18), skinMaterial);
  pelvis.scale.set(1.18, 0.8, 0.92);
  pelvis.castShadow = true;
  hipPivot.add(pelvis);

  const hipShell = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.27, seated ? 0.26 : 0.34, 6, 14),
    skinMaterial,
  );
  hipShell.scale.set(1.18, 1, 0.88);
  hipShell.position.set(0, seated ? -0.06 : -0.1, 0.02);
  hipShell.castShadow = true;
  hipPivot.add(hipShell);

  const bottomClothingGroup = new THREE.Group();
  hipPivot.add(bottomClothingGroup);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0.2, 0, 0);
  hipPivot.add(leftLegPivot);
  const rightLegPivot = leftLegPivot.clone();
  rightLegPivot.position.x = -0.18;
  hipPivot.add(rightLegPivot);

  const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.124, 0.74, 12), skinMaterial);
  upperLeg.position.y = seated ? 0.28 : -0.42;
  upperLeg.castShadow = true;
  leftLegPivot.add(upperLeg);
  const rightUpperLeg = upperLeg.clone();
  rightLegPivot.add(rightUpperLeg);

  const leftKnee = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), skinMaterial);
  leftKnee.position.set(0, seated ? -0.1 : -0.9, 0.03);
  leftKnee.castShadow = true;
  leftLegPivot.add(leftKnee);
  const rightKnee = leftKnee.clone();
  rightLegPivot.add(rightKnee);

  const leftLowerLegPivot = new THREE.Group();
  leftLowerLegPivot.position.set(0, seated ? 0.48 : -0.86, seated ? 0.36 : 0);
  leftLegPivot.add(leftLowerLegPivot);
  const rightLowerLegPivot = leftLowerLegPivot.clone();
  rightLegPivot.add(rightLowerLegPivot);

  const lowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.68, 12), skinMaterial);
  lowerLeg.position.y = seated ? -0.23 : -0.36;
  lowerLeg.castShadow = true;
  leftLowerLegPivot.add(lowerLeg);
  const rightLowerLeg = lowerLeg.clone();
  rightLowerLegPivot.add(rightLowerLeg);

  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.44), shoeMaterial);
  leftFoot.position.set(0, seated ? -0.68 : -0.76, seated ? 0.12 : 0.06);
  leftFoot.castShadow = true;
  leftLowerLegPivot.add(leftFoot);
  const rightFoot = leftFoot.clone();
  rightLowerLegPivot.add(rightFoot);

  const bubbleAnchor = new THREE.Object3D();
  bubbleAnchor.position.set(0, seated ? 2.48 : 3.1, 0.22);
  root.add(bubbleAnchor);

  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(0, seated ? 0.14 : 0.02, 0);
  root.add(labelAnchor);

  const glowDisc = createSpotDisc(seated ? 0.9 : 0.78, accent, 0.22);
  glowDisc.position.y = 0.01;
  root.add(glowDisc);

  let poseBlend = seated ? 0 : 1;
  const motion = {
    mode: seated ? "seated" : "idle",
    walkProgress: 0,
    emphasis: 0,
  };
  const hipBaseY = seated ? 0.95 : 0.74;
  const lowerLegPivotBaseY = seated ? 0.48 : -0.82;
  const lowerLegPivotBaseZ = seated ? 0.36 : 0;
  const footBaseY = seated ? -0.69 : -0.78;
  const footBaseZ = seated ? 0.12 : 0.06;

  function applyLook(nextLook) {
    const details = createOutfitDetails(
      nextLook,
      {
        topGroup: topClothingGroup,
        bottomGroup: bottomClothingGroup,
      },
      seated,
    );

    torso.material = details.topMaterial;
    leftArm.material = details.topMaterial;
    rightArm.material = details.topMaterial;
    leftForearm.material = details.topMaterial;
    rightForearm.material = details.topMaterial;
    upperLeg.material = details.bottomMaterial;
    rightUpperLeg.material = details.bottomMaterial;
    lowerLeg.material = details.bottomMaterial;
    rightLowerLeg.material = details.bottomMaterial;

    upperLeg.scale.x = details.upperLegScale;
    upperLeg.scale.z = details.upperLegScale;
    rightUpperLeg.scale.x = details.upperLegScale;
    rightUpperLeg.scale.z = details.upperLegScale;
    lowerLeg.scale.x = details.lowerLegScale;
    lowerLeg.scale.z = details.lowerLegScale;
    rightLowerLeg.scale.x = details.lowerLegScale;
    rightLowerLeg.scale.z = details.lowerLegScale;
  }

  function setPoseBlend(nextBlend) {
    poseBlend = clamp(nextBlend, 0, 1);

    hipPivot.position.y = hipBaseY;
    hipPivot.position.x = 0;
    topPivot.position.y = baseTopY;
    topPivot.rotation.z = 0;
    leftLowerArmPivot.rotation.z = 0;
    rightLowerArmPivot.rotation.z = 0;
    leftFoot.rotation.x = 0;
    rightFoot.rotation.x = 0;
    leftLowerLegPivot.position.y = lowerLegPivotBaseY;
    rightLowerLegPivot.position.y = lowerLegPivotBaseY;
    leftLowerLegPivot.position.z = lowerLegPivotBaseZ;
    rightLowerLegPivot.position.z = lowerLegPivotBaseZ;
    leftFoot.position.y = footBaseY;
    rightFoot.position.y = footBaseY;
    leftFoot.position.z = footBaseZ;
    rightFoot.position.z = footBaseZ;
    hipPivot.rotation.x = lerp(-0.18, 0, poseBlend);
    topPivot.rotation.x = lerp(-0.16, 0.05, poseBlend);
    leftUpperArmPivot.rotation.z = lerp(0.26, 0.16, poseBlend);
    rightUpperArmPivot.rotation.z = lerp(-0.26, -0.16, poseBlend);
    leftUpperArmPivot.rotation.x = lerp(0.68, 0.04, poseBlend);
    rightUpperArmPivot.rotation.x = lerp(0.68, 0.04, poseBlend);
    leftLowerArmPivot.rotation.x = lerp(-0.92, -0.16, poseBlend);
    rightLowerArmPivot.rotation.x = lerp(-0.92, -0.16, poseBlend);
    leftLegPivot.rotation.x = lerp(-1.18, 0, poseBlend);
    rightLegPivot.rotation.x = lerp(-1.18, 0, poseBlend);
    leftLowerLegPivot.rotation.x = lerp(1.18, 0.02, poseBlend);
    rightLowerLegPivot.rotation.x = lerp(1.18, 0.02, poseBlend);
  }

  function setMotion(mode, options = {}) {
    motion.mode = mode;
    motion.emphasis = options.emphasis ?? motion.emphasis;
    motion.whisperSide = options.whisperSide ?? motion.whisperSide ?? 1;

    if (mode === "seated" || mode === "seated_present" || mode === "seated_think" || mode === "whisper") {
      setPoseBlend(0);
    } else {
      setPoseBlend(1);
    }
  }

  function setWalkProgress(progress) {
    motion.walkProgress = progress;
  }

  function applySeatedMotion(elapsed, active) {
    const settle = Math.sin(elapsed * 0.9 + root.position.x * 0.3) * (active ? 0.018 : 0.01);
    topPivot.position.y = baseTopY + Math.sin(elapsed * 1.15 + root.position.z) * 0.01;
    hipPivot.position.x = 0;
    topPivot.rotation.x = -0.08 + settle * 0.4;
    topPivot.rotation.z = settle * 0.12;
    leftUpperArmPivot.rotation.z = 0.24 + settle * 0.4;
    rightUpperArmPivot.rotation.z = -0.22 - settle * 0.4;
    leftUpperArmPivot.rotation.x = 0.62 + settle * 0.2;
    rightUpperArmPivot.rotation.x = 0.6 - settle * 0.2;
    leftLowerArmPivot.rotation.x = -0.9;
    rightLowerArmPivot.rotation.x = -0.9;
    leftLegPivot.rotation.x = -1.12 + settle * 0.1;
    rightLegPivot.rotation.x = -1.14 - settle * 0.1;
    leftLowerLegPivot.rotation.x = 1.12;
    rightLowerLegPivot.rotation.x = 1.14;
  }

  function applyIdleMotion(elapsed, active) {
    const breathe = Math.sin(elapsed * 1.45 + root.position.x * 0.12) * (active ? 0.024 : 0.014);
    topPivot.position.y = baseTopY + breathe;
    hipPivot.position.y = hipBaseY + Math.abs(breathe) * 0.12;
    hipPivot.position.x = 0;
    topPivot.rotation.x = 0.035 + breathe * 0.12;
    topPivot.rotation.z = Math.sin(elapsed * 0.8 + root.position.z) * 0.01;
    leftUpperArmPivot.rotation.x = 0.06 + Math.sin(elapsed * 0.9) * 0.015;
    rightUpperArmPivot.rotation.x = 0.06 - Math.sin(elapsed * 0.9) * 0.015;
    leftUpperArmPivot.rotation.z = 0.14;
    rightUpperArmPivot.rotation.z = -0.14;
    leftLowerArmPivot.rotation.x = -0.14;
    rightLowerArmPivot.rotation.x = -0.14;
    leftLegPivot.rotation.x = Math.sin(elapsed * 0.5) * 0.01;
    rightLegPivot.rotation.x = -Math.sin(elapsed * 0.5) * 0.01;
    leftLowerLegPivot.rotation.x = 0.05;
    rightLowerLegPivot.rotation.x = 0.05;
  }

  function applyPresentationMotion(elapsed, active) {
    const gestureWave = Math.sin(elapsed * 1.45 + motion.emphasis) * (active ? 0.1 : 0.04);
    const breathe = Math.sin(elapsed * 1.45) * 0.022;
    topPivot.position.y = baseTopY + breathe;
    hipPivot.position.y = hipBaseY + Math.abs(breathe) * 0.12;
    hipPivot.position.x = -0.04;
    topPivot.rotation.x = 0.05 + breathe * 0.16;
    topPivot.rotation.z = -0.04 + gestureWave * 0.05;
    leftUpperArmPivot.rotation.z = 0.14;
    rightUpperArmPivot.rotation.z = -0.2 - gestureWave * 0.04;
    leftUpperArmPivot.rotation.x = 0.02;
    rightUpperArmPivot.rotation.x = 0.14 + gestureWave * 0.55;
    leftLowerArmPivot.rotation.x = -0.12;
    rightLowerArmPivot.rotation.x = -0.16 - gestureWave * 0.36;
    leftLegPivot.rotation.x = 0.04;
    rightLegPivot.rotation.x = -0.02;
    leftLowerLegPivot.rotation.x = 0.05;
    rightLowerLegPivot.rotation.x = 0.05;
  }

  function applyStandingThinkingMotion(elapsed, active) {
    const sway = Math.sin(elapsed * 1.05 + motion.emphasis) * (active ? 0.032 : 0.016);
    const nod = Math.sin(elapsed * 0.72 + motion.emphasis * 0.5) * 0.05;
    topPivot.position.y = baseTopY + Math.sin(elapsed * 1.18) * 0.018;
    hipPivot.position.y = hipBaseY + Math.abs(sway) * 0.08;
    hipPivot.position.x = 0.06;
    topPivot.rotation.x = 0.12 + nod;
    topPivot.rotation.z = 0.07 + sway * 0.42;
    leftUpperArmPivot.rotation.z = 0.18;
    rightUpperArmPivot.rotation.z = -0.12;
    leftUpperArmPivot.rotation.x = 0.12;
    rightUpperArmPivot.rotation.x = 0.82 + sway * 0.4;
    leftLowerArmPivot.rotation.x = -0.24;
    rightLowerArmPivot.rotation.x = -1.18 + nod * 0.32;
    leftLegPivot.rotation.x = 0.05;
    rightLegPivot.rotation.x = -0.07;
    leftLowerLegPivot.rotation.x = 0.08;
    rightLowerLegPivot.rotation.x = 0.03;
    leftFoot.rotation.x = 0.02;
    rightFoot.rotation.x = -0.04;
  }

  function applySeatedPresentationMotion(elapsed, active) {
    const emphasis = active ? 0.1 : 0.04;
    const pulse = Math.sin(elapsed * 1.32 + motion.emphasis) * emphasis;
    topPivot.position.y = baseTopY + Math.sin(elapsed * 1.1 + root.position.z) * 0.012;
    topPivot.rotation.x = -0.12 + pulse * 0.28;
    topPivot.rotation.z = -0.04 + pulse * 0.12;
    hipPivot.position.x = -0.06;
    leftUpperArmPivot.rotation.z = 0.18;
    rightUpperArmPivot.rotation.z = -0.16 - pulse * 0.24;
    leftUpperArmPivot.rotation.x = 0.54;
    rightUpperArmPivot.rotation.x = 0.48 + pulse * 0.34;
    leftLowerArmPivot.rotation.x = -0.98;
    rightLowerArmPivot.rotation.x = -0.76 - pulse * 0.26;
    leftLegPivot.rotation.x = -1.08;
    rightLegPivot.rotation.x = -1.16;
    leftLowerLegPivot.rotation.x = 1.08;
    rightLowerLegPivot.rotation.x = 1.16;
  }

  function applySeatedThinkingMotion(elapsed, active) {
    const settle = Math.sin(elapsed * 0.84 + motion.emphasis) * (active ? 0.03 : 0.014);
    const nod = Math.sin(elapsed * 0.58 + motion.emphasis * 0.3) * 0.045;
    topPivot.position.y = baseTopY + Math.sin(elapsed * 0.92 + root.position.z * 0.1) * 0.01;
    topPivot.rotation.x = -0.2 + nod;
    topPivot.rotation.z = 0.08 + settle * 0.32;
    hipPivot.position.x = 0.08;
    leftUpperArmPivot.rotation.z = 0.26 + settle * 0.14;
    rightUpperArmPivot.rotation.z = -0.08;
    leftUpperArmPivot.rotation.x = 0.74;
    rightUpperArmPivot.rotation.x = 0.9 + settle * 0.18;
    leftLowerArmPivot.rotation.x = -1.02;
    rightLowerArmPivot.rotation.x = -1.22 + nod * 0.3;
    leftLegPivot.rotation.x = -1.16;
    rightLegPivot.rotation.x = -1.08;
    leftLowerLegPivot.rotation.x = 1.12;
    rightLowerLegPivot.rotation.x = 1.04;
    leftFoot.rotation.x = 0.08;
    rightFoot.rotation.x = -0.02;
  }

  function applyWhisperMotion(elapsed) {
    const side = motion.whisperSide || 1;
    const whisper = Math.sin(elapsed * 2.2 + root.position.x) * 0.03;
    topPivot.position.y = baseTopY + Math.sin(elapsed * 1.34 + root.position.z) * 0.008;
    topPivot.rotation.x = -0.14 + whisper * 0.12;
    topPivot.rotation.z = side * (0.12 + whisper * 0.35);
    hipPivot.position.x = side * 0.08;
    leftUpperArmPivot.rotation.z = 0.24;
    rightUpperArmPivot.rotation.z = -0.22;
    leftUpperArmPivot.rotation.x = 0.58 + (side < 0 ? whisper * 0.4 : 0);
    rightUpperArmPivot.rotation.x = 0.58 + (side > 0 ? whisper * 0.4 : 0);
    leftLowerArmPivot.rotation.x = -0.94;
    rightLowerArmPivot.rotation.x = -0.94;
    leftLegPivot.rotation.x = -1.12;
    rightLegPivot.rotation.x = -1.12;
    leftLowerLegPivot.rotation.x = 1.12;
    rightLowerLegPivot.rotation.x = 1.12;
  }

  function applyWalkMotion() {
    const gait = motion.walkProgress * Math.PI * 2;
    const stride = Math.sin(gait);
    const liftLeft = Math.max(0, -stride);
    const liftRight = Math.max(0, stride);
    const doubleTime = Math.sin(gait * 2);
    topPivot.position.y = baseTopY + Math.abs(doubleTime) * 0.05;
    hipPivot.position.y = hipBaseY + Math.abs(doubleTime) * 0.04;
    hipPivot.position.x = 0;
    topPivot.rotation.x = 0.12 + Math.cos(gait) * 0.06;
    topPivot.rotation.z = stride * 0.07;
    leftUpperArmPivot.rotation.z = 0.16 + stride * 0.08;
    rightUpperArmPivot.rotation.z = -0.16 - stride * 0.08;
    leftUpperArmPivot.rotation.x = -0.34 - stride * 0.74;
    rightUpperArmPivot.rotation.x = -0.34 + stride * 0.74;
    leftLowerArmPivot.rotation.x = -0.42 + Math.max(0, stride) * 0.22;
    rightLowerArmPivot.rotation.x = -0.42 + Math.max(0, -stride) * 0.22;
    leftLegPivot.rotation.x = stride * 0.96;
    rightLegPivot.rotation.x = -stride * 0.96;
    leftLowerLegPivot.rotation.x = 0.12 + liftLeft * 1.12;
    rightLowerLegPivot.rotation.x = 0.12 + liftRight * 1.12;
    leftLowerLegPivot.position.z = lowerLegPivotBaseZ + liftLeft * 0.09;
    rightLowerLegPivot.position.z = lowerLegPivotBaseZ + liftRight * 0.09;
    leftFoot.rotation.x = -liftLeft * 0.34 + Math.max(0, stride) * 0.22;
    rightFoot.rotation.x = -liftRight * 0.34 + Math.max(0, -stride) * 0.22;
    leftFoot.position.y = footBaseY + liftLeft * 0.12;
    rightFoot.position.y = footBaseY + liftRight * 0.12;
  }

  applyLook(look);
  setPoseBlend(poseBlend);
  setMotion(seated ? "seated" : "idle");

  return {
    id,
    root,
    topPivot,
    leftUpperArmPivot,
    rightUpperArmPivot,
    leftLegPivot,
    rightLegPivot,
    bubbleAnchor,
    labelAnchor,
    glowDisc,
    homePosition: root.position.clone(),
    homeRotationY: root.rotation.y,
    applyLook,
    setPoseBlend,
    setMotion,
    setWalkProgress,
    setActive(active, color) {
      glowDisc.material.color = hexColor(color || accent);
      glowDisc.material.opacity = active ? 0.42 : 0.16;
      glowDisc.scale.setScalar(active ? 1.18 : 1);
    },
    tick(elapsed, active) {
      if (motion.mode === "walk") {
        applyWalkMotion();
        return;
      }

      if (motion.mode === "seated_present") {
        applySeatedPresentationMotion(elapsed, active);
        return;
      }

      if (motion.mode === "seated_think") {
        applySeatedThinkingMotion(elapsed, active);
        return;
      }

      if (motion.mode === "whisper") {
        applyWhisperMotion(elapsed);
        return;
      }

      if (motion.mode === "think") {
        applyStandingThinkingMotion(elapsed, active);
        return;
      }

      if (poseBlend < 0.5 || motion.mode === "seated") {
        applySeatedMotion(elapsed, active);
        return;
      }

      if (motion.mode === "present") {
        applyPresentationMotion(elapsed, active);
        return;
      }

      applyIdleMotion(elapsed, active);
    },
  };
}

export class SharkTankStage {
  constructor({ mount, onLayout } = {}) {
    this.mount = mount;
    this.onLayout = onLayout || (() => {});
    this.pointer = { x: 0, y: 0 };
    this.dragState = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      startAzimuth: CAMERA_BASE.azimuth,
      startPolar: CAMERA_BASE.polar,
    };
    this.baseCameraTarget = BASE_CAMERA_TARGET.clone();
    this.cameraTarget = this.baseCameraTarget.clone();
    this.cameraTargetGoal = this.baseCameraTarget.clone();
    this.cameraState = {
      radius: CAMERA_BASE.radius,
      targetRadius: CAMERA_BASE.radius,
      azimuth: CAMERA_BASE.azimuth,
      targetAzimuth: CAMERA_BASE.azimuth,
      polar: CAMERA_BASE.polar,
      targetPolar: CAMERA_BASE.polar,
    };
    this.cameraOverrideUntil = 0;
    this.clock = new THREE.Clock();
    this.activeSpeakerId = null;
    this.activeSpeakerPhase = "idle";
    this.founderWalk = {
      active: false,
      startedAt: 0,
      duration: 1.8,
      progress: 1,
    };
    this.handshakeState = {
      active: false,
      sharkId: null,
      startedAt: 0,
      duration: 2.6,
    };
    this.founderPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(HALL_AXIS_X, 0, CORRIDOR_REAR_Z + 1.05),
      new THREE.Vector3(HALL_AXIS_X, 0, -5.05),
      new THREE.Vector3(HALL_AXIS_X, 0, CORRIDOR_FRONT_Z + 0.18),
      new THREE.Vector3(HALL_AXIS_X, 0, 0.42),
      FOUNDER_MARK.clone(),
    ]);
    this.founderPathLength = this.founderPath.getLength();
    this.actors = new Map();
    this.aquariumFish = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#172945");
    this.scene.fog = new THREE.Fog("#22314a", 18, 52);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.34;
    this.renderer.domElement.classList.add("studio-canvas");
    this.mount.append(this.renderer.domElement);

    this.buildEnvironment();
    this.createFounder();
    this.attachEvents();
    this.handleResize();
    this.animate = this.animate.bind(this);
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  hasManualCameraOverride() {
    return performance.now() < this.cameraOverrideUntil;
  }

  holdManualCamera(ms = 7000) {
    this.cameraOverrideUntil = performance.now() + ms;
  }

  setAutoCameraAzimuthGoal(nextAzimuth) {
    this.cameraState.targetAzimuth = clamp(nextAzimuth, AUTO_CAMERA_AZIMUTH_MIN, AUTO_CAMERA_AZIMUTH_MAX);
  }

  buildEnvironment() {
    const woodTexture = createWoodTexture();
    const slatTexture = createSlatTexture();
    const cityTexture = createCityTexture();
    const waterTexture = createWaterTexture();
    const shellMaterial = createMaterial("#211c18", { roughness: 0.9 });
    const stoneMaterial = createMaterial("#8a725c", { roughness: 0.88, metalness: 0.04 });
    const warmStoneMaterial = createMaterial("#a5825f", { roughness: 0.8, metalness: 0.08 });
    const slatMaterial = new THREE.MeshStandardMaterial({
      map: slatTexture,
      color: hexColor("#6b4328"),
      roughness: 0.82,
      metalness: 0.04,
    });
    const coveLightMaterial = new THREE.MeshBasicMaterial({
      color: "#edc08a",
      transparent: true,
      opacity: 0.82,
    });
    const centerX = (STUDIO_LEFT_X + STUDIO_RIGHT_X) / 2;
    const studioDepth = STUDIO_FRONT_Z - STUDIO_REAR_Z;
    const corridorWidth = CORRIDOR_HALF_WIDTH * 2;

    const addCoveStrip = (width, depth, position) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.08, depth),
        coveLightMaterial,
      );
      strip.position.copy(position);
      this.scene.add(strip);
      return strip;
    };

    const addLightBox = ({ width, height, x, y, z, color = "#dbe6ff", glow = "#6b8dff", rotationY = 0 }) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.22, height + 0.22, 0.18),
        createMaterial("#2e241f", { roughness: 0.7, metalness: 0.12 }),
      );
      frame.position.set(x, y, z);
      frame.rotation.y = rotationY;
      frame.castShadow = true;
      this.scene.add(frame);

      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
          color,
          emissive: hexColor(glow),
          emissiveIntensity: 0.4,
        }),
      );
      panel.position.set(x, y, z + Math.cos(rotationY) * 0.1);
      panel.rotation.y = rotationY;
      this.scene.add(panel);
    };

    const addStoneColumn = ({ x, z, height = 5.5, width = 0.74 }) => {
      const column = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.52),
        stoneMaterial,
      );
      column.position.set(x, height / 2, z);
      column.castShadow = true;
      column.receiveShadow = true;
      this.scene.add(column);

      const uplight = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.06, 0.08, 0.18),
        new THREE.MeshBasicMaterial({
          color: "#f0c38f",
          transparent: true,
          opacity: 0.82,
        }),
      );
      uplight.position.set(x, 0.22, z + 0.16);
      this.scene.add(uplight);
    };

    const addWallSconce = ({ x, y, z, height = 1.22, rotationY = 0 }) => {
      const sconceFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, height, 0.1),
        createMaterial("#4a3426", { roughness: 0.6, metalness: 0.12 }),
      );
      sconceFrame.position.set(x, y, z);
      sconceFrame.rotation.y = rotationY;
      this.scene.add(sconceFrame);

      const sconceGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, height * 0.72, 0.04),
        new THREE.MeshBasicMaterial({
          color: "#ffd89b",
          transparent: true,
          opacity: 0.66,
        }),
      );
      sconceGlow.position.set(x, y, z + 0.06);
      sconceGlow.rotation.y = rotationY;
      this.scene.add(sconceGlow);

      const sconceLight = new THREE.PointLight("#ffd8a8", 0.74, 4.8, 2);
      sconceLight.position.set(x, y, z + 0.26);
      this.scene.add(sconceLight);
    };

    const ambient = new THREE.HemisphereLight("#fff0dc", "#24354a", 1.02);
    this.scene.add(ambient);

    const keyLight = new THREE.SpotLight("#ffe0bf", 4.8, 46, 0.38, 0.52);
    keyLight.position.set(7.3, 11.8, 7.4);
    keyLight.target.position.set(FOUNDER_MARK.x, 0.8, 1.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(keyLight, keyLight.target);

    const sharkLight = new THREE.SpotLight("#f8c89a", 4.1, 36, 0.46, 0.62);
    sharkLight.position.set(-7.6, 9.6, 8.4);
    sharkLight.target.position.set(-5.2, 1.2, 0.8);
    sharkLight.castShadow = true;
    sharkLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(sharkLight, sharkLight.target);

    const frontFill = new THREE.DirectionalLight("#fff0da", 1.14);
    frontFill.position.set(3.2, 6.4, 10.6);
    this.scene.add(frontFill);

    const rimLight = new THREE.DirectionalLight("#c3d3ff", 1.08);
    rimLight.position.set(-12, 7, -8);
    this.scene.add(rimLight);

    const hallwayLight = new THREE.SpotLight("#ebd0ae", 2.2, 30, 0.34, 0.44);
    hallwayLight.position.set(HALL_AXIS_X, 6.8, -4.9);
    hallwayLight.target.position.set(HALL_AXIS_X, 0.1, -4.4);
    this.scene.add(hallwayLight, hallwayLight.target);

    const stageWash = new THREE.PointLight("#ffe0bf", 3.1, 28, 2);
    stageWash.position.set(0.4, 6.2, 1.2);
    this.scene.add(stageWash);

    const founderFill = new THREE.SpotLight("#ffe2c2", 3.4, 30, 0.46, 0.58);
    founderFill.position.set(6.6, 8.2, 5.8);
    founderFill.target.position.set(FOUNDER_MARK.x, 1.2, FOUNDER_MARK.z);
    this.scene.add(founderFill, founderFill.target);

    const aquaLeft = new THREE.PointLight("#4f73ff", 6.2, 17, 2);
    aquaLeft.position.set(HALL_AXIS_X, 3.2, AQUARIUM_ZS[0]);
    const aquaRight = aquaLeft.clone();
    aquaRight.position.set(HALL_AXIS_X, 3.2, AQUARIUM_ZS[1]);
    this.scene.add(aquaLeft, aquaRight);

    const rearShell = new THREE.Mesh(
      new THREE.BoxGeometry(STUDIO_RIGHT_X - STUDIO_LEFT_X, 7.6, 0.8),
      shellMaterial,
    );
    rearShell.position.set(centerX, 3.8, STUDIO_REAR_Z);
    rearShell.receiveShadow = true;
    this.scene.add(rearShell);

    const leftShell = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 7.6, studioDepth),
      shellMaterial,
    );
    leftShell.position.set(STUDIO_LEFT_X, 3.8, (STUDIO_FRONT_Z + STUDIO_REAR_Z) / 2);
    leftShell.receiveShadow = true;
    this.scene.add(leftShell);

    const rightShell = leftShell.clone();
    rightShell.position.x = STUDIO_RIGHT_X;
    this.scene.add(rightShell);

    const rearGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 10),
      new THREE.MeshBasicMaterial({
        color: "#2a406e",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    rearGlow.position.set(centerX, 4.4, STUDIO_REAR_Z + 0.08);
    this.scene.add(rearGlow);

    const rearShelf = new THREE.Mesh(
      new THREE.BoxGeometry(15.8, 0.44, 1.18),
      createMaterial("#2c211c", { roughness: 0.9 }),
    );
    rearShelf.position.set(-4.9, 1.08, -3.92);
    rearShelf.receiveShadow = true;
    this.scene.add(rearShelf);

    for (let index = 0; index < 4; index += 1) {
      const accentBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.88 + index * 0.08, 0.12, 0.2),
        createMaterial(index % 2 === 0 ? "#aa845f" : "#20324d", {
          emissive: index % 2 === 0 ? "#7d4f33" : "#2d4ea0",
          emissiveIntensity: 0.12,
        }),
      );
      accentBlock.position.set(-7.2 + index * 2.3, 1.34 + (index % 2) * 0.1, -3.86);
      accentBlock.castShadow = true;
      this.scene.add(accentBlock);
    }

    const leftStageWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 5.6, 9.8),
      slatMaterial,
    );
    leftStageWall.position.set(-10.8, 2.82, 0.2);
    leftStageWall.rotation.y = 0.08;
    leftStageWall.receiveShadow = true;
    this.scene.add(leftStageWall);

    const founderSideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 5.7, 6.6),
      slatMaterial,
    );
    founderSideWall.position.set(10.28, 2.88, 0.55);
    founderSideWall.rotation.y = -0.1;
    founderSideWall.receiveShadow = true;
    this.scene.add(founderSideWall);

    const founderDisplay = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.7),
      new THREE.MeshStandardMaterial({
        color: "#dbe4ff",
        emissive: hexColor("#365cff"),
        emissiveIntensity: 0.42,
      }),
    );
    founderDisplay.position.set(10.06, 3.6, 1.9);
    founderDisplay.rotation.y = -Math.PI / 2 + 0.1;
    this.scene.add(founderDisplay);

    const founderDisplayFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.15, 3.2),
      warmStoneMaterial,
    );
    founderDisplayFrame.position.set(10.18, 3.56, 1.9);
    founderDisplayFrame.rotation.y = -0.1;
    this.scene.add(founderDisplayFrame);

    addWallSconce({ x: 9.72, y: 4.95, z: -0.28, rotationY: -0.08 });
    addWallSconce({ x: 9.72, y: 3.55, z: 2.55, rotationY: -0.08 });
    addWallSconce({ x: -10.2, y: 4.92, z: -0.6, rotationY: 0.08 });
    addWallSconce({ x: -10.2, y: 3.48, z: 2.2, rotationY: 0.08 });

    const founderBackPanel = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 4.4, 0.22),
      slatMaterial,
    );
    founderBackPanel.position.set(5.6, 2.36, -5.0);
    founderBackPanel.receiveShadow = true;
    this.scene.add(founderBackPanel);

    addLightBox({ width: 1.6, height: 0.54, x: 3.48, y: 5.0, z: -4.84, color: "#eef3ff", glow: "#7a9fff" });
    addLightBox({ width: 1.88, height: 0.62, x: 5.62, y: 5.02, z: -4.84, color: "#eef3ff", glow: "#7a9fff" });
    addLightBox({ width: 1.54, height: 0.54, x: 7.72, y: 5.0, z: -4.84, color: "#eef3ff", glow: "#7a9fff" });
    addLightBox({ width: 2.4, height: 1.12, x: 5.64, y: 3.38, z: -4.82, color: "#f5f7ff", glow: "#446dff" });

    addStoneColumn({ x: 2.08, z: -4.74 });
    addStoneColumn({ x: 8.88, z: -4.74 });
    addStoneColumn({ x: -12.0, z: -5.0, height: 5.9, width: 0.84 });
    addStoneColumn({ x: -2.05, z: -5.0, height: 5.9, width: 0.84 });

    const sharkLoungePlatform = new THREE.Mesh(
      new THREE.BoxGeometry(6.9, 0.3, 2.7),
      createMaterial("#402717", { roughness: 0.9 }),
    );
    sharkLoungePlatform.position.set(-8.7, 0.16, 4.82);
    sharkLoungePlatform.receiveShadow = true;
    this.scene.add(sharkLoungePlatform);

    const sharkLoungeStep = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 0.14, 1.02),
      createMaterial("#745138", { roughness: 0.88 }),
    );
    sharkLoungeStep.position.set(-8.45, 0.08, 3.34);
    sharkLoungeStep.receiveShadow = true;
    this.scene.add(sharkLoungeStep);

    const sharkLoungeRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.1, 5.8),
      createMaterial("#4a3325", { roughness: 0.76, metalness: 0.1 }),
    );
    sharkLoungeRail.position.set(-5.55, 1.06, 1.18);
    sharkLoungeRail.rotation.y = 0.08;
    sharkLoungeRail.receiveShadow = true;
    this.scene.add(sharkLoungeRail);

    const sharkBench = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.42, 0.92),
      createMaterial("#60422e", { roughness: 0.84 }),
    );
    sharkBench.position.set(-5.25, 1.26, -3.98);
    sharkBench.receiveShadow = true;
    this.scene.add(sharkBench);

    addCoveStrip(
      STUDIO_RIGHT_X - STUDIO_LEFT_X - 1.4,
      0.16,
      new THREE.Vector3(centerX, STUDIO_CEILING_Y - 0.36, STUDIO_REAR_Z + 0.28),
    );
    addCoveStrip(
      0.16,
      studioDepth - 2.2,
      new THREE.Vector3(STUDIO_LEFT_X + 0.32, STUDIO_CEILING_Y - 0.42, (STUDIO_FRONT_Z + STUDIO_REAR_Z) / 2),
    );
    addCoveStrip(
      0.16,
      studioDepth - 2.2,
      new THREE.Vector3(STUDIO_RIGHT_X - 0.32, STUDIO_CEILING_Y - 0.42, (STUDIO_FRONT_Z + STUDIO_REAR_Z) / 2),
    );

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 24),
      new THREE.MeshStandardMaterial({
        map: woodTexture,
        color: hexColor("#9b6742"),
        roughness: 0.74,
        metalness: 0.05,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const founderRug = new THREE.Mesh(
      new THREE.CircleGeometry(2.32, 48),
      new THREE.MeshStandardMaterial({
        color: "#d4c6b4",
        roughness: 0.95,
      }),
    );
    founderRug.rotation.x = -Math.PI / 2;
    founderRug.position.set(FOUNDER_MARK.x, 0.01, FOUNDER_MARK.z);
    founderRug.receiveShadow = true;
    this.scene.add(founderRug);

    const founderPresentationCarpet = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 4.4),
      new THREE.MeshStandardMaterial({
        color: "#d1c1ad",
        roughness: 0.96,
      }),
    );
    founderPresentationCarpet.rotation.x = -Math.PI / 2;
    founderPresentationCarpet.position.set(FOUNDER_MARK.x - 0.42, 0.009, FOUNDER_MARK.z + 0.08);
    founderPresentationCarpet.receiveShadow = true;
    this.scene.add(founderPresentationCarpet);

    const sharkDeck = new THREE.Mesh(
      new THREE.RingGeometry(4.15, 6.2, 96, 1, Math.PI * 0.58, Math.PI * 0.9),
      new THREE.MeshStandardMaterial({
        color: "#3d2417",
        roughness: 0.88,
      }),
    );
    sharkDeck.rotation.x = -Math.PI / 2;
    sharkDeck.position.set(SHARK_BANK_CENTER.x, 0.18, SHARK_BANK_CENTER.z);
    sharkDeck.scale.x = SHARK_DECK_SCALE_X;
    sharkDeck.receiveShadow = true;
    this.scene.add(sharkDeck);

    const deckInset = new THREE.Mesh(
      new THREE.RingGeometry(4.45, 5.78, 96, 1, Math.PI * 0.58, Math.PI * 0.9),
      new THREE.MeshStandardMaterial({
        color: "#6d472f",
        roughness: 0.88,
      }),
    );
    deckInset.rotation.x = -Math.PI / 2;
    deckInset.position.set(SHARK_BANK_CENTER.x, 0.22, SHARK_BANK_CENTER.z);
    deckInset.scale.x = SHARK_DECK_SCALE_X;
    this.scene.add(deckInset);

    const deckEdge = new THREE.Mesh(
      new THREE.RingGeometry(5.98, 6.24, 96, 1, Math.PI * 0.58, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({
        color: "#b87d48",
        transparent: true,
        opacity: 0.62,
      }),
    );
    deckEdge.rotation.x = -Math.PI / 2;
    deckEdge.position.set(SHARK_BANK_CENTER.x, 0.24, SHARK_BANK_CENTER.z);
    deckEdge.scale.x = SHARK_DECK_SCALE_X;
    this.scene.add(deckEdge);

    const cityWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(11.2, 4.4),
      new THREE.MeshStandardMaterial({
        map: cityTexture,
        emissive: hexColor("#2c4bff"),
        emissiveIntensity: 0.34,
      }),
    );
    cityWindow.position.set(CITY_WINDOW_X, CITY_WINDOW_Y, CITY_WINDOW_Z);
    this.scene.add(cityWindow);

    const cityWindowFrameTop = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 0.44, 0.36),
      stoneMaterial,
    );
    cityWindowFrameTop.position.set(CITY_WINDOW_X, CITY_WINDOW_Y + 2.28, CITY_WINDOW_Z + 0.16);
    this.scene.add(cityWindowFrameTop);

    const cityWindowFrameBottom = cityWindowFrameTop.clone();
    cityWindowFrameBottom.position.y = CITY_WINDOW_Y - 2.28;
    this.scene.add(cityWindowFrameBottom);

    const cityWindowFrameLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 5.0, 0.36),
      stoneMaterial,
    );
    cityWindowFrameLeft.position.set(CITY_WINDOW_X - 5.45, CITY_WINDOW_Y, CITY_WINDOW_Z + 0.16);
    const cityWindowFrameRight = cityWindowFrameLeft.clone();
    cityWindowFrameRight.position.x = CITY_WINDOW_X + 5.45;
    this.scene.add(cityWindowFrameLeft, cityWindowFrameRight);

    const cityBalcony = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.28, 1.18),
      createMaterial("#33231c", { roughness: 0.84 }),
    );
    cityBalcony.position.set(-7.35, 1.14, -4.18);
    cityBalcony.receiveShadow = true;
    this.scene.add(cityBalcony);

    const cityBench = new THREE.Mesh(
      new THREE.BoxGeometry(5.1, 0.34, 0.86),
      createMaterial("#4d3424", { roughness: 0.82 }),
    );
    cityBench.position.set(-6.15, 1.52, -3.92);
    cityBench.receiveShadow = true;
    this.scene.add(cityBench);

    const rearSlatWall = new THREE.Mesh(
      new THREE.BoxGeometry(12.5, 5.1, 0.22),
      slatMaterial,
    );
    rearSlatWall.position.set(-4.8, 2.7, -4.95);
    rearSlatWall.receiveShadow = true;
    this.scene.add(rearSlatWall);

    const rearStoneBand = new THREE.Mesh(
      new THREE.BoxGeometry(14.8, 1.08, 0.5),
      stoneMaterial,
    );
    rearStoneBand.position.set(-4.8, 0.66, -4.68);
    rearStoneBand.receiveShadow = true;
    this.scene.add(rearStoneBand);

    const rearLeftSlatInset = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 2.72, 0.18),
      slatMaterial,
    );
    rearLeftSlatInset.position.set(-0.1, 2.05, -4.9);
    rearLeftSlatInset.receiveShadow = true;
    this.scene.add(rearLeftSlatInset);

    for (let index = 0; index < 5; index += 1) {
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.22, 18),
        createMaterial("#18191d", { metalness: 0.3, roughness: 0.36 }),
      );
      can.position.set(-0.85 + index * 1.1, STUDIO_CEILING_Y - 0.3, -3.92);
      this.scene.add(can);

      const lamp = new THREE.PointLight("#ffd6a7", 0.62, 5.6, 2);
      lamp.position.set(can.position.x, STUDIO_CEILING_Y - 0.6, -3.92);
      this.scene.add(lamp);
    }

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 5.8, CORRIDOR_LENGTH),
      slatMaterial,
    );
    rightWall.position.set(HALL_AXIS_X + CORRIDOR_HALF_WIDTH, 2.9, CORRIDOR_CENTER_Z);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const leftHallWall = rightWall.clone();
    leftHallWall.position.set(HALL_AXIS_X - CORRIDOR_HALF_WIDTH, 2.9, CORRIDOR_CENTER_Z);
    this.scene.add(leftHallWall);

    const corridorTrimMaterial = createMaterial("#8e6b46", { roughness: 0.46, metalness: 0.22 });
    const corridorFrontLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 4.4, 0.24),
      corridorTrimMaterial,
    );
    corridorFrontLeft.position.set(HALL_AXIS_X - CORRIDOR_HALF_WIDTH, 2.22, CORRIDOR_FRONT_Z - 0.05);
    corridorFrontLeft.castShadow = true;
    this.scene.add(corridorFrontLeft);

    const corridorFrontRight = corridorFrontLeft.clone();
    corridorFrontRight.position.x = HALL_AXIS_X + CORRIDOR_HALF_WIDTH;
    this.scene.add(corridorFrontRight);

    const corridorFrontHeader = new THREE.Mesh(
      new THREE.BoxGeometry(CORRIDOR_HALF_WIDTH * 2 + 0.24, 0.22, 0.24),
      corridorTrimMaterial,
    );
    corridorFrontHeader.position.set(HALL_AXIS_X, 4.34, CORRIDOR_FRONT_Z - 0.05);
    corridorFrontHeader.castShadow = true;
    this.scene.add(corridorFrontHeader);

    const corridorThreshold = new THREE.Mesh(
      new THREE.BoxGeometry(CORRIDOR_HALF_WIDTH * 2 + 0.18, 0.05, 0.52),
      createMaterial("#3e2718", { roughness: 0.72, metalness: 0.1 }),
    );
    corridorThreshold.position.set(HALL_AXIS_X, 0.03, CORRIDOR_FRONT_Z - 0.16);
    corridorThreshold.receiveShadow = true;
    this.scene.add(corridorThreshold);

    const hallBack = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 6.4, 0.42),
      stoneMaterial,
    );
    hallBack.position.set(HALL_AXIS_X, 3.15, CORRIDOR_REAR_Z);
    this.scene.add(hallBack);

    const hallDoorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.6, 0.2),
      new THREE.MeshStandardMaterial({
        color: "#211a16",
        roughness: 0.72,
      }),
    );
    hallDoorFrame.position.set(HALL_AXIS_X, 1.82, CORRIDOR_REAR_Z + 0.2);
    this.scene.add(hallDoorFrame);

    const hallDoorLeft = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 3.2, 0.1),
      new THREE.MeshStandardMaterial({
        color: "#171418",
        roughness: 0.55,
      }),
    );
    hallDoorLeft.position.set(HALL_AXIS_X - 0.66, 1.75, CORRIDOR_REAR_Z + 0.3);
    const hallDoorRight = hallDoorLeft.clone();
    hallDoorRight.position.x = HALL_AXIS_X + 0.66;
    this.scene.add(hallDoorLeft, hallDoorRight);

    const aquariums = [
      { x: HALL_AXIS_X - AQUARIUM_HALF_WIDTH, y: 3.25, z: AQUARIUM_ZS[0], glow: 0.72 },
      { x: HALL_AXIS_X + AQUARIUM_HALF_WIDTH, y: 3.25, z: AQUARIUM_ZS[0], glow: 0.72 },
      { x: HALL_AXIS_X - AQUARIUM_HALF_WIDTH, y: 3.25, z: AQUARIUM_ZS[1], glow: 0.64 },
      { x: HALL_AXIS_X + AQUARIUM_HALF_WIDTH, y: 3.25, z: AQUARIUM_ZS[1], glow: 0.64 },
    ];
    this.aquariumFish = [];

    aquariums.forEach((aquariumConfig) => {
      const aquarium = createAquariumPanel(aquariumConfig);
      this.scene.add(aquarium.group);
      this.aquariumFish.push(...aquarium.fish);
    });

    const hallRunner = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, CORRIDOR_LENGTH),
      new THREE.MeshStandardMaterial({
        color: "#9a8a74",
        roughness: 0.96,
      }),
    );
    hallRunner.rotation.x = -Math.PI / 2;
    hallRunner.position.set(HALL_AXIS_X, 0.012, CORRIDOR_CENTER_Z);
    hallRunner.receiveShadow = true;
    this.scene.add(hallRunner);

    const waterChannelFrameMaterial = createMaterial("#3f281a", { roughness: 0.7, metalness: 0.12 });

    const leftWaterChannel = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.06, CORRIDOR_LENGTH),
      new THREE.MeshStandardMaterial({
        map: waterTexture,
        emissive: hexColor("#2c4eff"),
        emissiveIntensity: 0.58,
        transparent: true,
        opacity: 0.94,
      }),
    );
    leftWaterChannel.position.set(HALL_AXIS_X - WATER_CHANNEL_HALF_WIDTH, 0.05, CORRIDOR_CENTER_Z);
    const rightWaterChannel = leftWaterChannel.clone();
    rightWaterChannel.position.x = HALL_AXIS_X + WATER_CHANNEL_HALF_WIDTH;
    this.scene.add(leftWaterChannel, rightWaterChannel);

    const leftChannelFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.1, CORRIDOR_LENGTH + 0.18),
      waterChannelFrameMaterial,
    );
    leftChannelFrame.position.set(HALL_AXIS_X - WATER_CHANNEL_HALF_WIDTH, 0.025, CORRIDOR_CENTER_Z);
    const rightChannelFrame = leftChannelFrame.clone();
    rightChannelFrame.position.x = HALL_AXIS_X + WATER_CHANNEL_HALF_WIDTH;
    this.scene.add(leftChannelFrame, rightChannelFrame);

    const founderSpot = createSpotDisc(2.1, "#f2d3aa", 0.1);
    founderSpot.position.set(FOUNDER_MARK.x, 0.02, FOUNDER_MARK.z);
    this.scene.add(founderSpot);

    const demoStandMaterial = createMaterial("#7a756d", { roughness: 0.56, metalness: 0.16 });
    const demoScreenMaterial = new THREE.MeshStandardMaterial({
      color: "#eef4ff",
      emissive: hexColor("#7aa1ff"),
      emissiveIntensity: 0.3,
    });
    [
      { x: 2.68, z: 0.15, rotationY: 0.18 },
      { x: 2.92, z: 3.0, rotationY: -0.24 },
      { x: 7.18, z: 0.38, rotationY: -0.28 },
    ].forEach((config) => {
      const stand = new THREE.Group();

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.48), demoStandMaterial);
      legs.position.y = 0.04;
      stand.add(legs);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.28, 0.08), demoStandMaterial);
      post.position.y = 0.66;
      stand.add(post);

      const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.76, 0.08), createMaterial("#3a2c24"));
      screenFrame.position.y = 1.32;
      stand.add(screenFrame);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.56), demoScreenMaterial);
      screen.position.set(0, 1.32, 0.05);
      stand.add(screen);

      stand.position.set(config.x, 0, config.z);
      stand.rotation.y = config.rotationY;
      this.scene.add(stand);
    });

    for (let index = 0; index < 5; index += 1) {
      const angle = SHARK_ARC_START + index * SHARK_ARC_STEP;
      const x = SHARK_BANK_CENTER.x + Math.cos(angle) * SHARK_DESK_X_RADIUS;
      const z = SHARK_BANK_CENTER.z + Math.sin(angle) * SHARK_DESK_Z_RADIUS;
      const arcPoint = new THREE.Vector3(x, 0.58, z);
      const towardFounder = new THREE.Vector3()
        .subVectors(FOUNDER_MARK, arcPoint)
        .setY(0)
        .normalize();
      const desk = createRoundedDesk(1.85, 0.18, 1.08, index === 2 ? "#6b4a30" : "#563523");
      desk.position.set(
        arcPoint.x + towardFounder.x * 1.08,
        arcPoint.y,
        arcPoint.z + towardFounder.z * 1.08,
      );
      desk.rotation.y = yawToward(desk.position, FOUNDER_MARK);
      this.scene.add(desk);

      const propCluster = new THREE.Group();
      const tablet = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.04, 0.38),
        createMaterial(index % 2 === 0 ? "#20242e" : "#1a1d24", { roughness: 0.42, metalness: 0.24 }),
      );
      tablet.position.set(0.16, 0.13, -0.09);
      tablet.rotation.y = 0.22;
      propCluster.add(tablet);

      const mug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.14, 18),
        createMaterial(index % 2 === 0 ? "#f2ede6" : "#dbc8b3", { roughness: 0.7 }),
      );
      mug.position.set(-0.34, 0.1, 0.18);
      propCluster.add(mug);

      const notes = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.02, 0.2),
        createMaterial("#d8c8ad", { roughness: 0.95 }),
      );
      notes.position.set(0.4, 0.098, 0.2);
      notes.rotation.y = -0.14;
      propCluster.add(notes);

      propCluster.position.copy(desk.position);
      propCluster.position.y += 0.22;
      propCluster.rotation.y = desk.rotation.y;
      this.scene.add(propCluster);
    }

    for (let index = 0; index < 2; index += 1) {
      const planter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.44, 1.25, 22),
        createMaterial("#2b1d1a", { metalness: 0.24, roughness: 0.48 }),
      );
      planter.position.set(HALL_AXIS_X - 1.85 + index * 3.7, 0.64, -5.95);
      planter.castShadow = true;
      this.scene.add(planter);

      const plant = new THREE.Group();
      for (let leafIndex = 0; leafIndex < 6; leafIndex += 1) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.9, 0.28),
          createMaterial("#456b57", { roughness: 0.88 }),
        );
        leaf.position.set(
          Math.sin(leafIndex * 1.1) * 0.12,
          1.3 + leafIndex * 0.03,
          Math.cos(leafIndex * 1.4) * 0.1,
        );
        leaf.rotation.z = (leafIndex - 2) * 0.18;
        leaf.rotation.x = (leafIndex % 2 === 0 ? 1 : -1) * 0.22;
        plant.add(leaf);
      }
      plant.position.copy(planter.position);
      this.scene.add(plant);
    }

    const floorTrim = new THREE.Mesh(
      new THREE.RingGeometry(4.55, 4.72, 96, 1, Math.PI * 0.58, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({
        color: "#be8a56",
        transparent: true,
        opacity: 0.4,
      }),
    );
    floorTrim.rotation.x = -Math.PI / 2;
    floorTrim.position.set(SHARK_BANK_CENTER.x, 0.02, SHARK_BANK_CENTER.z);
    floorTrim.scale.x = SHARK_DECK_SCALE_X;
    this.scene.add(floorTrim);
  }

  createFounder() {
    const founder = createFigure({
      id: "entrepreneur",
      seated: false,
      accent: "#f0cb98",
      look: DEFAULT_FOUNDER_LOOK,
    });

    founder.root.position.copy(this.founderPath.getPoint(0));
    founder.homePosition = FOUNDER_MARK.clone();
    founder.homeRotationY = yawToward(founder.homePosition, SHARK_FOCUS);
    founder.setMotion("idle");
    this.scene.add(founder.root);
    this.actors.set("entrepreneur", {
      ...founder,
      kind: "founder",
      accent: "#f0cb98",
      decision: null,
    });
  }

  setSharks(sharks) {
    for (const [actorId, actor] of Array.from(this.actors.entries())) {
      if (actorId !== "entrepreneur") {
        if (actor.chair) {
          this.scene.remove(actor.chair);
        }

        this.scene.remove(actor.root);
        this.actors.delete(actorId);
      }
    }

    sharks.forEach((shark, index) => {
      const angle = SHARK_ARC_START + index * SHARK_ARC_STEP;
      const x = SHARK_BANK_CENTER.x + Math.cos(angle) * SHARK_SEAT_X_RADIUS;
      const z = SHARK_BANK_CENTER.z + Math.sin(angle) * SHARK_SEAT_Z_RADIUS;
      const arcPoint = new THREE.Vector3(x, 0, z);
      const towardFounder = new THREE.Vector3()
        .subVectors(FOUNDER_MARK, arcPoint)
        .setY(0)
        .normalize();
      const chairPosition = arcPoint.clone().addScaledVector(towardFounder, -0.34);
      chairPosition.y = 0.04;
      const figurePosition = arcPoint.clone().addScaledVector(towardFounder, -0.08);
      const facingY = yawToward(figurePosition, FOUNDER_MARK);
      const chair = createChair(shark.color);
      chair.position.copy(chairPosition);
      chair.rotation.y = facingY;
      chair.scale.setScalar(0.94);
      this.scene.add(chair);

      const figure = createFigure({
        id: shark.id,
        seated: true,
        accent: shark.color,
        look: SHARK_WARDROBE[shark.id] || DEFAULT_FOUNDER_LOOK,
      });
      figure.root.position.copy(figurePosition);
      figure.root.rotation.y = facingY;
      const lateralOffset = (index - (sharks.length - 1) / 2) * 0.26;
      figure.bubbleAnchor.position.x = lateralOffset;
      figure.bubbleAnchor.position.y = 2.64 + Math.abs(index - 2) * 0.08;
      figure.labelAnchor.position.x = lateralOffset * 0.5;
      figure.labelAnchor.position.y = 0.46 + Math.abs(index - 2) * 0.07;
      figure.homePosition = figure.root.position.clone();
      figure.homeRotationY = figure.root.rotation.y;
      figure.setPoseBlend(0);
      figure.setMotion("seated");
      this.scene.add(figure.root);

      this.actors.set(shark.id, {
        ...figure,
        chair,
        kind: "shark",
        seatIndex: index,
        accent: shark.color,
        decision: null,
      });
    });
  }

  setFounderLook(look) {
    const founder = this.actors.get("entrepreneur");

    if (founder) {
      founder.applyLook(look || DEFAULT_FOUNDER_LOOK);
    }
  }

  cueFounderEntrance(durationMs = 1800) {
    this.cameraOverrideUntil = 0;
    this.founderWalk.startedAt = this.clock.getElapsedTime();
    this.founderWalk.duration = Math.max(2.2, durationMs / 1000, this.founderPathLength / 3.2);
    this.founderWalk.progress = 0;
    this.founderWalk.active = true;
    this.handshakeState.active = false;
    this.cameraTargetGoal.copy(this.baseCameraTarget);
    this.setAutoCameraAzimuthGoal(CAMERA_BASE.azimuth);
    this.cameraState.targetPolar = CAMERA_BASE.polar;
    this.cameraState.targetRadius = CAMERA_BASE.radius;

    const founder = this.actors.get("entrepreneur");

    if (founder) {
      founder.root.position.copy(this.founderPath.getPoint(0));
      founder.root.rotation.set(0, yawToward(
        this.founderPath.getPoint(0),
        this.founderPath.getPoint(0.08),
      ), 0);
      founder.setMotion("walk");
      founder.setWalkProgress(0);
      founder.setPoseBlend(1);
    }
  }

  focusCameraOnActor(actorId, phase = "speaking") {
    if (this.dragState.active || this.hasManualCameraOverride() || this.founderWalk.active || this.handshakeState.active) {
      return;
    }

    if (!actorId) {
      this.cameraTargetGoal.copy(this.baseCameraTarget);
      this.setAutoCameraAzimuthGoal(CAMERA_BASE.azimuth);
      this.cameraState.targetPolar = CAMERA_BASE.polar;
      this.cameraState.targetRadius = CAMERA_BASE.radius;
      return;
    }

    const actor = this.actors.get(actorId);

    if (!actor) {
      return;
    }

    if (actor.kind === "founder") {
      const target = FOUNDER_CAMERA_TARGET.clone();
      target.x += phase === "thinking" ? 0.16 : 0;
      target.z += phase === "thinking" ? -0.08 : 0.04;
      this.cameraTargetGoal.copy(target);
      this.cameraState.targetRadius = phase === "thinking" ? 13.9 : 14.5;
      this.setAutoCameraAzimuthGoal(CAMERA_BASE.azimuth + 0.08);
      this.cameraState.targetPolar = 0.98;
      return;
    }

    const seatOffset = actor.seatIndex - 2;
    const target = SHARK_CAMERA_TARGET.clone();
    target.x += seatOffset * 0.34;
    target.z += seatOffset * 0.22;
    this.cameraTargetGoal.copy(target);
    this.cameraState.targetRadius = phase === "thinking" ? 13.1 : 13.8;
    this.setAutoCameraAzimuthGoal(CAMERA_BASE.azimuth - 0.06 + seatOffset * 0.035);
    this.cameraState.targetPolar = 1.01;
  }

  setActiveSpeaker(actorId, phase = "speaking") {
    this.activeSpeakerId = actorId || null;
    this.activeSpeakerPhase = actorId ? phase : "idle";

    const founder = this.actors.get("entrepreneur");

    if (founder && !this.founderWalk.active && !this.handshakeState.active) {
      founder.setMotion(
        actorId === "entrepreneur"
          ? phase === "thinking"
            ? "think"
            : "present"
          : "idle",
        {
          emphasis: actorId === "entrepreneur" ? 1 : 0,
        },
      );
    }

    this.syncActorPerformanceModes();
    this.focusCameraOnActor(actorId, phase);
  }

  syncActorPerformanceModes() {
    const whisperCandidates = [];

    if (this.activeSpeakerPhase === "thinking" && this.activeSpeakerId) {
      for (const [actorId, actor] of this.actors) {
        if (actor.kind !== "shark" || actorId === this.activeSpeakerId || actor.decision !== "OUT") {
          continue;
        }

        whisperCandidates.push(actor);
      }
    }

    const whisperPair = whisperCandidates.slice(0, 2);

    for (const [actorId, actor] of this.actors) {
      if (actor.kind === "founder") {
        if (this.founderWalk.active || this.handshakeState.active) {
          continue;
        }

        actor.setMotion(
          actorId === this.activeSpeakerId
            ? this.activeSpeakerPhase === "thinking"
              ? "think"
              : "present"
            : "idle",
          {
            emphasis: actorId === this.activeSpeakerId ? 1 : 0,
          },
        );
        continue;
      }

      if (this.handshakeState.active && actorId === this.handshakeState.sharkId) {
        continue;
      }

      if (actorId === this.activeSpeakerId) {
        actor.setMotion(
          this.activeSpeakerPhase === "thinking" ? "seated_think" : "seated_present",
          { emphasis: 0.8 },
        );
        continue;
      }

      const whisperIndex = whisperPair.findIndex((candidate) => candidate.id === actorId);

      if (whisperIndex !== -1) {
        actor.setMotion("whisper", {
          whisperSide: whisperIndex === 0 ? -1 : 1,
        });
        continue;
      }

      actor.setMotion("seated");
    }
  }

  setDecision(actorId, decision) {
    const actor = this.actors.get(actorId);

    if (actor) {
      actor.decision = decision || null;
      this.syncActorPerformanceModes();
    }
  }

  playHandshake(sharkId) {
    this.cameraOverrideUntil = 0;
    const shark = this.actors.get(sharkId);
    const founder = this.actors.get("entrepreneur");

    if (!shark || !founder) {
      return;
    }

    this.handshakeState = {
      active: true,
      sharkId,
      startedAt: this.clock.getElapsedTime(),
      duration: 2.9,
    };
    shark.setMotion("present", { emphasis: 0.5 });
    founder.setMotion("present", { emphasis: 1.2 });
    this.cameraTargetGoal.set(1.7, 1.62, 0.84);
    this.cameraState.targetRadius = 15.2;
    this.setAutoCameraAzimuthGoal(-0.42);
    this.cameraState.targetPolar = 1.08;
  }

  resetPerformance() {
    this.cameraOverrideUntil = 0;
    this.activeSpeakerId = null;
    this.activeSpeakerPhase = "idle";
    this.founderWalk.active = false;
    this.founderWalk.progress = 1;
    this.handshakeState.active = false;
    this.cameraTargetGoal.copy(this.baseCameraTarget);
    this.setAutoCameraAzimuthGoal(CAMERA_BASE.azimuth);
    this.cameraState.targetPolar = CAMERA_BASE.polar;
    this.cameraState.targetRadius = CAMERA_BASE.radius;

    for (const [actorId, actor] of this.actors) {
      actor.decision = null;
      actor.setActive(false, actor.accent);

      if (actorId === "entrepreneur") {
        actor.root.position.copy(this.founderPath.getPoint(0));
        actor.root.rotation.set(0, -0.6, 0);
        actor.setMotion("idle");
        actor.setWalkProgress(0);
        actor.setPoseBlend(1);
      } else {
        actor.root.position.copy(actor.homePosition);
        actor.root.rotation.set(0, actor.homeRotationY, 0);
        actor.setMotion("seated");
        actor.setPoseBlend(0);
      }
    }
  }

  collectLayout() {
    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;
    const layout = {};

    for (const [actorId, actor] of this.actors) {
      layout[actorId] = {
        bubble: this.projectAnchor(actor.bubbleAnchor, width, height),
        tag: this.projectAnchor(actor.labelAnchor, width, height),
      };
    }

    return layout;
  }

  projectAnchor(anchor, width, height) {
    const projected = anchor.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const visible = projected.z > -1 && projected.z < 1;

    return {
      visible,
      x: ((projected.x + 1) / 2) * width,
      y: ((-projected.y + 1) / 2) * height,
    };
  }

  updateCamera() {
    this.cameraTarget.lerp(this.cameraTargetGoal, 0.06);
    this.cameraState.azimuth = lerpAngle(this.cameraState.azimuth, this.cameraState.targetAzimuth, 0.09);
    this.cameraState.polar = lerp(this.cameraState.polar, this.cameraState.targetPolar, 0.05);
    this.cameraState.radius = lerp(this.cameraState.radius, this.cameraState.targetRadius, 0.07);

    const offset = new THREE.Vector3().setFromSphericalCoords(
      this.cameraState.radius,
      this.cameraState.polar,
      this.cameraState.azimuth,
    );
    this.camera.position.copy(this.cameraTarget).add(offset);
    this.camera.lookAt(this.cameraTarget);
  }

  updateFounderWalk(elapsed) {
    const founder = this.actors.get("entrepreneur");

    if (!founder) {
      return;
    }

    if (!this.founderWalk.active) {
      return;
    }

    const rawProgress = (elapsed - this.founderWalk.startedAt) / this.founderWalk.duration;
    const progress = clamp(rawProgress, 0, 1);
    const eased = easeInOutCubic(progress);
    const point = this.founderPath.getPoint(eased);
    const lookAhead = this.founderPath.getPoint(clamp(eased + 0.02, 0, 1));
    const strideProgress = (this.founderPathLength * eased) / 1.42;

    founder.root.position.copy(point);
    orientUprightToward(founder.root, point, lookAhead);
    founder.setWalkProgress(strideProgress);
    this.founderWalk.progress = progress;

    if (progress >= 1) {
      this.founderWalk.active = false;
      founder.root.rotation.set(0, founder.homeRotationY, 0);
      founder.homePosition = founder.root.position.clone();
      founder.homeRotationY = founder.root.rotation.y;
      founder.setMotion(
        this.activeSpeakerId === "entrepreneur"
          ? this.activeSpeakerPhase === "thinking"
            ? "think"
            : "present"
          : "idle",
        {
          emphasis: this.activeSpeakerId === "entrepreneur" ? 1 : 0,
        },
      );
      this.focusCameraOnActor(this.activeSpeakerId, this.activeSpeakerPhase);
    }
  }

  updateHandshake(elapsed) {
    if (!this.handshakeState.active) {
      return;
    }

    const founder = this.actors.get("entrepreneur");
    const shark = this.actors.get(this.handshakeState.sharkId);

    if (!founder || !shark) {
      this.handshakeState.active = false;
      return;
    }

    const rawProgress = (elapsed - this.handshakeState.startedAt) / this.handshakeState.duration;
    const progress = clamp(rawProgress, 0, 1);
    const standProgress = clamp(progress / 0.38, 0, 1);
    const walkProgress = clamp((progress - 0.28) / 0.72, 0, 1);
    const easedWalk = easeInOutCubic(walkProgress);
    const handshakeTarget = founder.root.position.clone().add(new THREE.Vector3(-1.08, 0, -0.16));

    shark.setPoseBlend(standProgress);
    shark.root.position.lerpVectors(shark.homePosition, handshakeTarget, easedWalk);
    orientUprightToward(shark.root, shark.root.position, founder.root.position);

    founder.leftUpperArmPivot.rotation.z = 0.22;
    founder.rightUpperArmPivot.rotation.z = -0.04;
    founder.rightUpperArmPivot.rotation.x = 0.56;
    orientUprightToward(founder.root, founder.root.position, shark.root.position);

    if (progress >= 1) {
      this.handshakeState.active = false;
    }
  }

  updateAquariums(elapsed) {
    for (const fish of this.aquariumFish) {
      const swim = elapsed * fish.speed + fish.phase;
      const wave = Math.sin(swim);
      const sway = Math.cos(swim * 0.74);
      fish.root.position.z = wave * fish.zAmplitude;
      fish.root.position.y = fish.yOffset + Math.sin(swim * 1.4) * fish.yAmplitude;
      fish.root.position.x = Math.sin(swim * 1.8) * fish.xAmplitude;
      fish.root.rotation.y = sway >= 0 ? 0 : Math.PI;
      fish.tail.rotation.y = Math.sin(swim * 10.8) * 0.56;
      fish.dorsal.rotation.x = Math.sin(swim * 2.3) * 0.08;
    }
  }

  updateActors(elapsed) {
    for (const [actorId, actor] of this.actors) {
      const isActive = actorId === this.activeSpeakerId;
      let glowColor = actor.accent;

      if (actor.decision === "OUT") {
        glowColor = "#d85b5b";
      } else if (actor.decision === "INVEST") {
        glowColor = "#d4b184";
      }

      actor.setActive(isActive, glowColor);
      actor.tick(elapsed, isActive);
    }
  }

  animate() {
    const elapsed = this.clock.getElapsedTime();

    this.updateFounderWalk(elapsed);
    this.updateActors(elapsed);
    this.updateAquariums(elapsed);
    this.updateHandshake(elapsed);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.onLayout(this.collectLayout());
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  handleResize() {
    const width = this.mount.clientWidth || window.innerWidth;
    const height = this.mount.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  attachEvents() {
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = (event) => {
      if (event.button != null && event.button !== 0) {
        return;
      }

      this.holdManualCamera();
      this.dragState.active = true;
      this.dragState.pointerId = event.pointerId ?? null;
      this.dragState.startX = event.clientX;
      this.dragState.startY = event.clientY;
      this.dragState.startAzimuth = this.cameraState.azimuth;
      this.dragState.startPolar = this.cameraState.polar;
      this.dragState.lastX = event.clientX;
      this.dragState.lastY = event.clientY;
      this.cameraTargetGoal.copy(this.cameraTarget);
      this.cameraState.targetAzimuth = this.cameraState.azimuth;
      this.cameraState.targetPolar = this.cameraState.polar;
      this.cameraState.targetRadius = this.cameraState.radius;
      this.mount.classList.add("is-dragging");
      this.mount.setPointerCapture?.(event.pointerId);
    };
    this.handlePointerMove = (event) => {
      if (!this.dragState.active) {
        return;
      }

      if (this.dragState.pointerId != null && event.pointerId !== this.dragState.pointerId) {
        return;
      }

      const rect = this.mount.getBoundingClientRect();
      const deltaX = (event.clientX - this.dragState.lastX) / Math.max(rect.width, 1);
      const deltaY = (event.clientY - this.dragState.lastY) / Math.max(rect.height, 1);

      this.holdManualCamera();
      this.cameraState.targetAzimuth -= deltaX * 0.42;
      this.cameraState.targetPolar = clamp(this.cameraState.targetPolar + deltaY * 0.42, 0.94, 1.26);
      this.dragState.lastX = event.clientX;
      this.dragState.lastY = event.clientY;
    };
    this.handlePointerUp = (event) => {
      if (this.dragState.pointerId != null && event.pointerId !== this.dragState.pointerId) {
        return;
      }

      this.dragState.active = false;
      this.dragState.pointerId = null;
      this.mount.classList.remove("is-dragging");
      this.mount.releasePointerCapture?.(event.pointerId);
    };
    this.handlePointerCancel = (event) => {
      if (this.dragState.pointerId != null && event.pointerId !== this.dragState.pointerId) {
        return;
      }

      this.dragState.active = false;
      this.dragState.pointerId = null;
      this.mount.classList.remove("is-dragging");
    };
    this.handleWheel = (event) => {
      event.preventDefault();
      this.cameraState.targetRadius = clamp(
        this.cameraState.targetRadius + event.deltaY * 0.004,
        14.8,
        18.6,
      );
    };

    window.addEventListener("resize", this.handleResize);
    this.mount.addEventListener("pointerdown", this.handlePointerDown);
    this.mount.addEventListener("pointermove", this.handlePointerMove);
    this.mount.addEventListener("pointerup", this.handlePointerUp);
    this.mount.addEventListener("pointercancel", this.handlePointerCancel);
    this.mount.addEventListener("wheel", this.handleWheel, { passive: false });
  }

  destroy() {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.handleResize);
    this.mount.removeEventListener("pointerdown", this.handlePointerDown);
    this.mount.removeEventListener("pointermove", this.handlePointerMove);
    this.mount.removeEventListener("pointerup", this.handlePointerUp);
    this.mount.removeEventListener("pointercancel", this.handlePointerCancel);
    this.mount.removeEventListener("wheel", this.handleWheel);
    this.renderer.dispose();
    this.mount.innerHTML = "";
  }
}
