// The 3D studio: renderer, cast, blocking, and the director of photography.
// Exposes the same calls the app uses to drive the show (who is speaking,
// shark statuses, founder walks, handshakes, and camera shots).

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createCharacter } from "./character.js";
import { addStudioLights, createSet, FOUNDER_MARK, seatTransform } from "./set.js";

const HALLWAY_ENTRY = new THREE.Vector3(11.2, 0, 0);
const HALLWAY_EXIT = new THREE.Vector3(13.5, 0, 0);
const SEATED_HEAD_Y = 1.24;
const LOBBY_CAMERA = { pos: [7.0, 1.55, -3.8], target: [1.0, 1.05, 1.2], fov: 38 };
const STANDING_HEAD_Y = 1.66;

// Each shark's resting body language.
const RESTING_POSE = {
  rex: "sit",
  luna: "sitCrossLegs",
  max: "sit",
  vera: "sitCrossLegs",
  wes: "sitSlouch",
};

// Shots are framed for 16:9. On narrower screens (portrait phones) widen the
// vertical field of view so most of the 16:9 width still fits.
function fitFov(fov, aspect) {
  const wide = 16 / 9;

  if (aspect >= wide) {
    return fov;
  }

  const half = THREE.MathUtils.degToRad(fov / 2);
  const horizontal = Math.atan(Math.tan(half) * wide);
  const fitted = 2 * Math.atan((Math.tan(horizontal) * 0.62) / aspect);
  return Math.min(70, Math.max(fov, THREE.MathUtils.radToDeg(fitted)));
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function disposeTree(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
    }
  });
}

function requestedQuality() {
  const requested = new URLSearchParams(window.location.search).get("quality");
  return requested === "low" || requested === "high" ? requested : null;
}

// Software WebGL (no GPU acceleration) gets the light mode automatically.
function isSoftwareRenderer(renderer) {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return /swiftshader|llvmpipe|software|basic render/i.test(String(name));
  } catch {
    return false;
  }
}

export function createStudio({ mount }) {
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  } catch (error) {
    console.warn("WebGL is unavailable; the studio will run without 3D.", error);
    mount.classList.add("no-webgl");
    return createNullStudio(mount);
  }

  const quality = requestedQuality() || (isSoftwareRenderer(renderer) ? "low" : "high");
  // Light mode renders at reduced resolution and frame rate, without shadows.
  const frameInterval = quality === "high" ? 0 : 1 / 12;
  let sinceFrame = Infinity;
  mount.dataset.quality = quality;
  renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio || 1, 2) : 0.6);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = quality === "high";
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050302");
  scene.fog = new THREE.Fog("#070403", 16, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 80);
  const set = createSet({ quality });
  scene.add(set.root);
  addStudioLights(scene, { quality });

  let composer = null;
  let bloom = null;

  if (quality === "high") {
    const target = new THREE.WebGLRenderTarget(16, 16, { samples: 4, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), 0.32, 0.5, 0.93);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const sharks = new Map();
  let sharkOrder = [];
  let founder = null;
  let founderLook = null;
  let speakerId = null;
  let speakerLookAt = null;
  let mood = "lobby";
  const statuses = new Map();
  const shot = { name: "establishing", focus: null, from: new THREE.Vector3(), target: new THREE.Vector3(), drift: new THREE.Vector3(), fov: 34, start: 0 };
  const clock = new THREE.Clock();
  let time = 0;
  const founderMotion = { mode: "offstage", from: new THREE.Vector3(), to: new THREE.Vector3(), start: 0, duration: 0, face: -Math.PI / 2, onArrive: null };
  let handshakeId = null;

  // --- Layout helpers --------------------------------------------------------

  function seatOf(sharkId) {
    return seatTransform(Math.max(0, sharkOrder.indexOf(sharkId)));
  }

  function rightOf(forward) {
    return new THREE.Vector3(-forward.z, 0, forward.x);
  }

  function headOf(id) {
    if (id === "founder") {
      return founder ? founder.headPosition() : FOUNDER_MARK.clone().setY(STANDING_HEAD_Y);
    }

    const character = sharks.get(id);
    return character ? character.headPosition() : seatOf(id).position.clone().setY(SEATED_HEAD_Y);
  }

  function handshakeSpot(sharkId) {
    const { position, forward } = seatOf(sharkId);
    return position.clone().addScaledVector(forward, 1.12);
  }

  // --- Camera -----------------------------------------------------------------

  function computeShot(name, focusId, variant = 0) {
    const side = variant % 2 ? -1 : 1;

    switch (name) {
      case "panel":
        return { pos: [6.2, 1.42, 1.3], target: [0.55, 1.0, -0.12], fov: 36, dolly: 0.45 };
      case "profile":
        return { pos: [3.1, 1.02, 5.7], target: [0.4, 1.0, -0.7], fov: 34, dolly: 0.35 };
      case "pitch-wide":
        return { pos: [-0.7, 2.25, 0.55], target: [5.8, 1.15, -0.45], fov: 40, dolly: 0.35 };
      case "hallway":
        return { pos: [-0.35, 1.8, 0.7], target: [9.5, 1.32, -0.05], fov: 23, dolly: 0.3 };
      case "founder-close":
        return { pos: [3.05, 1.66, -0.62 * side], target: [FOUNDER_MARK.x, 1.56, 0.08], fov: 29, dolly: 0.25 };
      case "shark-close": {
        const { position, forward } = seatOf(focusId);
        const right = rightOf(forward);
        const pos = position.clone().addScaledVector(forward, 1.75).addScaledVector(right, 0.34 * side).setY(1.28);
        const target = position.clone().addScaledVector(forward, 0.05).setY(1.13);
        return { pos: pos.toArray(), target: target.toArray(), fov: 28, dolly: 0.18 };
      }
      case "shark-medium": {
        const { position, forward } = seatOf(focusId);
        const right = rightOf(forward);
        const pos = position.clone().addScaledVector(forward, 2.75).addScaledVector(right, 0.55 * side).setY(1.3);
        const target = position.clone().setY(0.92);
        return { pos: pos.toArray(), target: target.toArray(), fov: 32, dolly: 0.25 };
      }
      case "ots": {
        const { position, forward } = seatOf(focusId);
        const right = rightOf(forward);
        const lean = position.z > 0.01 ? -1 : position.z < -0.01 ? 1 : side;
        const pos = position.clone().addScaledVector(forward, -1.15).addScaledVector(right, 0.5 * lean).setY(1.64);
        return { pos: pos.toArray(), target: [FOUNDER_MARK.x, 1.36, 0], fov: 31, dolly: 0.15 };
      }
      case "handshake": {
        const id = focusId || handshakeId || sharkOrder[0];
        const { position, forward } = seatOf(id);
        const spot = handshakeSpot(id);
        const middle = position.clone().lerp(spot, 0.5);
        const right = rightOf(forward);
        const towardCenter = Math.abs(position.z) < 0.01 ? 1 : position.z > 0 ? -1 : 1;
        const pos = spot.clone().addScaledVector(forward, 1.05).addScaledVector(right, 1.6 * towardCenter).setY(1.48);
        return { pos: pos.toArray(), target: middle.clone().setY(1.28).toArray(), fov: 38, dolly: 0.25 };
      }
      case "establishing":
      default:
        return { pos: [2.8, 3.05, 8.4], target: [2.4, 0.85, -0.2], fov: 38, dolly: 0.7 };
    }
  }

  function setShot(name, focusId = null, variant = 0) {
    const resolved = name === "wide" ? "establishing" : name;
    const spec = computeShot(resolved, focusId, variant);
    shot.name = resolved;
    shot.focus = focusId;
    shot.from.fromArray(spec.pos);
    shot.target.fromArray(spec.target);
    shot.drift.copy(shot.target).sub(shot.from).normalize().multiplyScalar(spec.dolly);
    shot.fov = spec.fov;
    shot.start = time;
    mount.dataset.shot = resolved;
    updateCamera(true);
  }

  function updateCamera(cut = false) {
    if (mood === "lobby") {
      // A slow drift across the panel from the founder's side of the room.
      const sway = Math.sin(time * 0.06);
      camera.position.set(LOBBY_CAMERA.pos[0] + sway * 0.3, LOBBY_CAMERA.pos[1] + Math.sin(time * 0.17) * 0.05, LOBBY_CAMERA.pos[2] + sway * 0.5);
      camera.fov = fitFov(LOBBY_CAMERA.fov, camera.aspect);
      camera.lookAt(LOBBY_CAMERA.target[0], LOBBY_CAMERA.target[1], LOBBY_CAMERA.target[2] + sway * 0.25);
      camera.updateProjectionMatrix();
      return;
    }

    const progress = easeInOut(Math.min(1, (time - shot.start) / 9));
    camera.position.copy(shot.from).addScaledVector(shot.drift, progress);

    const fov = fitFov(shot.fov, camera.aspect);

    if (cut || camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    camera.lookAt(shot.target);
  }

  // --- Cast -------------------------------------------------------------------

  function sharkPoseFor(id) {
    const status = statuses.get(id) || "waiting";

    if (status === "out") {
      return "sitCrossed";
    }

    if (["offer", "team", "countered"].includes(status)) {
      return "sitLean";
    }

    return RESTING_POSE[id] || "sit";
  }

  function refreshLooks() {
    const founderHead = founder && founderMotion.mode !== "offstage" ? headOf("founder") : FOUNDER_MARK.clone().setY(STANDING_HEAD_Y);
    const talker = speakerId && speakerId !== "narrator" ? speakerId : null;

    for (const [id, character] of sharks) {
      if (id === handshakeId) {
        character.setLookTarget(founder ? headOf("founder") : founderHead);
      } else if (talker && talker !== id && talker !== "founder") {
        character.setLookTarget(headOf(talker));
      } else {
        character.setLookTarget(founderHead);
      }
    }

    if (founder) {
      if (founderMotion.mode === "walking" || founderMotion.mode === "exit") {
        founder.setLookTarget(null);
      } else if (handshakeId) {
        founder.setLookTarget(headOf(handshakeId));
      } else if (talker && talker !== "founder") {
        founder.setLookTarget(headOf(talker));
      } else if (speakerLookAt && sharks.has(speakerLookAt)) {
        founder.setLookTarget(headOf(speakerLookAt));
      } else {
        founder.setLookTarget(new THREE.Vector3(0.5, SEATED_HEAD_Y, 0));
      }
    }
  }

  function moveFounder(to, durationMs, mode = "walking", onArrive = null) {
    if (!founder) {
      return;
    }

    founderMotion.from.copy(founder.root.position);
    founderMotion.to.copy(to);
    founderMotion.start = time;
    founderMotion.duration = Math.max(0.01, durationMs / 1000);
    founderMotion.mode = mode;
    founderMotion.onArrive = onArrive;
    founder.setWalking(true);
    mount.dataset.founder = mode;
  }

  function updateFounder() {
    if (!founder || !["walking", "exit", "approach"].includes(founderMotion.mode)) {
      return;
    }

    const progress = Math.min(1, (time - founderMotion.start) / founderMotion.duration);
    founder.root.position.lerpVectors(founderMotion.from, founderMotion.to, easeInOut(progress));
    const heading = founderMotion.to.clone().sub(founderMotion.from);

    if (heading.lengthSq() > 0.0001) {
      const yaw = Math.atan2(heading.x, heading.z);
      founder.root.rotation.y += (yaw - founder.root.rotation.y) * 0.25;
    }

    if (progress >= 1) {
      founder.setWalking(false);
      const arrive = founderMotion.onArrive;
      const mode = founderMotion.mode;
      founderMotion.mode = mode === "exit" ? "offstage" : "standing";
      founderMotion.onArrive = null;
      mount.dataset.founder = mode === "exit" ? "offstage" : mode === "approach" ? "handshake" : "mark";
      arrive?.();
    }
  }

  function faceFounder(yaw) {
    founderMotion.face = yaw;
  }

  // --- Render loop ------------------------------------------------------------

  function resize() {
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    bloom?.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(mount);
  resize();

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    sinceFrame += delta;

    if (sinceFrame < frameInterval) {
      return;
    }

    const dt = Math.min(0.1, sinceFrame === Infinity ? delta : sinceFrame);
    sinceFrame = 0;
    time += dt;
    updateFounder();

    if (founder && founderMotion.mode === "standing" && !handshakeId) {
      founder.root.rotation.y += (founderMotion.face - founder.root.rotation.y) * 0.12;
    }

    refreshLooks();

    for (const character of sharks.values()) {
      character.update(dt, time);
    }

    founder?.update(dt, time);
    set.update(time);
    updateCamera();

    if (composer) {
      composer.render(dt);
    } else {
      renderer.render(scene, camera);
    }
  });

  return {
    setSharks(list) {
      for (const character of sharks.values()) {
        scene.remove(character.root);
        disposeTree(character.root);
      }

      sharks.clear();
      sharkOrder = list.map((shark) => shark.id);

      list.forEach((shark, index) => {
        const { position, yaw } = seatTransform(index);
        const character = createCharacter({ look: shark.look, color: shark.color, seed: index + 1, pose: RESTING_POSE[shark.id] || "sit" });
        character.root.position.copy(position);
        character.root.rotation.y = yaw;
        character.root.userData.seat = { position: position.clone(), yaw };
        scene.add(character.root);
        sharks.set(shark.id, character);
      });
    },
    setPitch(pitch) {
      const look = {
        top: "suit",
        suit: pitch.founder.suit,
        skin: pitch.founder.skin,
        hair: pitch.founder.hair,
        hairStyle: pitch.founder.hairStyle,
        beard: pitch.founder.beard,
        lashes: pitch.founder.lashes,
        brows: "soft",
        mouth: "smile",
      };
      const key = JSON.stringify(look) + pitch.founder.accent;

      if (key !== founderLook) {
        const previous = founder;
        founder = createCharacter({ look, color: pitch.founder.accent, seed: 9, pose: "stand" });

        if (previous) {
          founder.root.position.copy(previous.root.position);
          founder.root.rotation.y = previous.root.rotation.y;
          scene.remove(previous.root);
          disposeTree(previous.root);
        } else {
          founder.root.position.copy(HALLWAY_EXIT);
        }

        scene.add(founder.root);
        founderLook = key;
      }

      set.board.setPitch(pitch);
      mount.dataset.pitch = pitch.id || "custom";
    },
    placeFounder(position) {
      if (!founder) {
        return;
      }

      founder.setWalking(false);
      founder.setHandshake(false);
      founderMotion.mode = position === "mark" ? "standing" : "offstage";
      founder.root.position.copy(position === "mark" ? FOUNDER_MARK : HALLWAY_EXIT);
      founder.root.rotation.y = -Math.PI / 2;
      faceFounder(-Math.PI / 2);
      mount.dataset.founder = position;
    },
    walkTo(position, durationMs = 2000) {
      if (!founder) {
        return;
      }

      if (position === "mark") {
        if (founderMotion.mode === "offstage") {
          founder.root.position.copy(HALLWAY_ENTRY);
        }

        faceFounder(-Math.PI / 2);
        moveFounder(FOUNDER_MARK, durationMs, "walking");
      } else {
        founder.setHandshake(false);
        moveFounder(HALLWAY_EXIT, durationMs * 1.6, "exit");
      }
    },
    handshake(sharkId, durationMs = 1800) {
      const shark = sharks.get(sharkId);

      if (!founder || !shark) {
        return;
      }

      handshakeId = sharkId;
      const { position, forward } = seatOf(sharkId);
      const spot = handshakeSpot(sharkId);
      setShot("handshake", sharkId);
      moveFounder(spot, durationMs, "approach", () => {
        const yaw = Math.atan2(-forward.x, -forward.z);
        founder.root.rotation.y = yaw;
        founder.setHandshake(true);
        shark.setPose("stand");
        shark.setHandshake(true);
        const standSpot = position.clone().addScaledVector(forward, 0.42);
        shark.root.position.copy(standSpot);
      });
    },
    setSpeaker(actorId, { phase = "speaking", lookAt = null } = {}) {
      speakerId = actorId;
      speakerLookAt = lookAt;

      for (const [id, character] of sharks) {
        character.setSpeaking(id === actorId && phase === "speaking");
        character.setThinking(id === actorId && phase === "thinking");
      }

      founder?.setSpeaking(actorId === "founder" && phase === "speaking");
    },
    setSharkStatus(sharkId, status) {
      statuses.set(sharkId, status);
      const character = sharks.get(sharkId);

      if (character && sharkId !== handshakeId) {
        character.setPose(sharkPoseFor(sharkId));
      }
    },
    setShot,
    shotForBeat(beat) {
      const variant = beat.index || 0;

      if (beat.kind === "verdict") {
        return beat.tone === "deal" ? { name: "handshake" } : { name: "pitch-wide" };
      }

      if (beat.speakerId === "narrator") {
        return { name: "establishing" };
      }

      if (beat.kind === "entrance") {
        return { name: "hallway" };
      }

      if (beat.kind === "pitch") {
        return variant % 2 ? { name: "pitch-wide" } : { name: "founder-close", variant };
      }

      if (beat.kind === "question") {
        return { name: "shark-close", focus: beat.speakerId, variant };
      }

      if (beat.kind === "answer") {
        return { name: "ots", focus: beat.targetId, variant };
      }

      if (beat.kind === "offer" || beat.kind === "out") {
        return { name: "shark-medium", focus: beat.speakerId, variant };
      }

      if (beat.speakerId === "founder") {
        return beat.targetId && sharks.has(beat.targetId)
          ? { name: variant % 2 ? "ots" : "founder-close", focus: beat.targetId, variant }
          : { name: "founder-close", variant };
      }

      return { name: "shark-close", focus: beat.speakerId, variant };
    },
    setMood(next) {
      mood = next;
      mount.dataset.mood = next;
    },
    reset() {
      statuses.clear();

      if (handshakeId) {
        const shark = sharks.get(handshakeId);

        if (shark) {
          shark.setHandshake(false);
          shark.root.position.copy(shark.root.userData.seat.position);
        }
      }

      handshakeId = null;

      for (const [id, character] of sharks) {
        character.setPose(RESTING_POSE[id] || "sit");
        character.setSpeaking(false);
        character.setThinking(false);
      }

      founder?.setHandshake(false);
      speakerId = null;
      speakerLookAt = null;
      setShot("establishing");
    },
    destroy() {
      renderer.setAnimationLoop(null);
      observer?.disconnect();
      renderer.dispose();
    },
  };
}

// Same interface, no 3D, for browsers without WebGL.
function createNullStudio(mount) {
  const noop = () => {};
  return {
    setSharks: noop,
    setPitch(pitch) {
      mount.dataset.pitch = pitch.id || "custom";
    },
    placeFounder(position) {
      mount.dataset.founder = position;
    },
    walkTo(position) {
      mount.dataset.founder = position === "mark" ? "mark" : "offstage";
    },
    handshake() {
      mount.dataset.founder = "handshake";
    },
    setSpeaker: noop,
    setSharkStatus: noop,
    setShot(name) {
      mount.dataset.shot = name;
    },
    shotForBeat: () => ({ name: "establishing" }),
    setMood(next) {
      mount.dataset.mood = next;
    },
    reset: noop,
    destroy: noop,
  };
}
