import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Deliberately isolated from studio.js: this asset is under likeness review,
// not a replacement for one of the five fictional episode characters.
const viewport = document.querySelector("#viewport");
const status = document.querySelector("#status");
const retry = document.querySelector("#retry");
const buttons = [...document.querySelectorAll(".study-controls button")];
const state = { frame: "portrait", angle: "threequarter", height: 1.8, center: new THREE.Vector3(0, 0.9, 0), loaded: false };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let renderer;
let controls;
let model;
let frameId;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#111316");
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);

function fail(message) {
  document.body.dataset.state = "error";
  status.textContent = message;
  retry.hidden = false;
  buttons.forEach((button) => { button.disabled = true; });
}

function light(color, intensity, position) {
  const lamp = new THREE.DirectionalLight(color, intensity);
  lamp.position.set(...position);
  scene.add(lamp);
  return lamp;
}

function applyView() {
  if (!controls) return;
  const { height, center } = state;
  const portrait = state.frame === "portrait";
  const target = new THREE.Vector3(center.x, portrait ? height * 0.86 : height * 0.53, center.z);
  // Keep both framings inside portrait/mobile viewports without clipping.
  const distance = height * (portrait ? 0.76 : 1.9) * Math.max(1, 0.7 / camera.aspect);
  const angle = { front: 0, threequarter: 0.32, profile: Math.PI / 2 }[state.angle];
  camera.position.set(target.x + Math.sin(angle) * distance, target.y + (portrait ? 0.03 : height * 0.025), target.z + Math.cos(angle) * distance);
  controls.target.copy(target);
  controls.minDistance = height * 0.2;
  controls.maxDistance = height * 5;
  controls.update();
  document.querySelectorAll("[data-frame]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.frame === state.frame)));
  document.querySelectorAll("[data-angle]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.angle === state.angle)));
  viewport.dataset.frame = state.frame;
  viewport.dataset.angle = state.angle;
}

function resize() {
  if (!renderer) return;
  const { width, height } = viewport.getBoundingClientRect();
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function setRotate(enabled) {
  if (!controls) return;
  controls.autoRotate = enabled;
  document.querySelector("#rotate").setAttribute("aria-pressed", String(enabled));
}

async function loadModel() {
  document.body.dataset.state = "loading";
  status.textContent = "Loading Kevin’s model…";
  retry.hidden = true;
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const gltf = await new GLTFLoader().loadAsync("/models/kevin/kevin.glb");
    if (model) scene.remove(model);
    model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) throw new Error("Model has no visible geometry");
    // Ground the imported asset, keeping its authored dimensions intact.
    model.position.y -= box.min.y;
    box.setFromObject(model);
    state.height = box.max.y - box.min.y;
    box.getCenter(state.center);
    let triangles = 0;
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    });
    scene.add(model);
    state.loaded = true;
    applyView();
    document.body.dataset.state = "ready";
    status.textContent = "";
    document.querySelector("#model-info").textContent = `${Math.round(triangles).toLocaleString()} triangles · Blender-authored GLB`;
    buttons.forEach((button) => { button.disabled = false; });
  } catch (error) {
    console.error("Kevin model could not be loaded", error);
    fail("Kevin’s model could not be loaded. Check that the GLB asset is available, then retry.");
  }
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reduceMotion.matches;
  controls.dampingFactor = 0.08;
  controls.autoRotateSpeed = 0.75;
  controls.maxPolarAngle = Math.PI * 0.56;
  scene.add(new THREE.HemisphereLight(0xc8dcf2, 0x29211f, 1.25));
  const key = light(0xffe5cf, 3.4, [2.5, 3.8, 4]);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
  key.shadow.camera.right = key.shadow.camera.top = 2.5;
  key.shadow.normalBias = 0.02;
  light(0xc6d9f5, 1.5, [-3, 2, 2]);
  light(0xffdfc0, 3, [-1.5, 3, -2.5]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.88 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.003;
  floor.receiveShadow = true;
  scene.add(floor);
  scene.fog = new THREE.Fog(0x111316, 6, 18);
  resize();
  applyView();
  const clock = new THREE.Clock();
  function animate() {
    frameId = requestAnimationFrame(animate);
    controls.update(Math.min(clock.getDelta(), 0.1));
    renderer.render(scene, camera);
  }
  animate();
  new ResizeObserver(resize).observe(viewport);
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    cancelAnimationFrame(frameId);
    fail("The graphics context was interrupted. Reload this page to continue reviewing Kevin.");
    retry.textContent = "Reload page";
    retry.onclick = () => location.reload();
  });
  loadModel();
} catch (error) {
  console.error("Kevin viewer could not initialize", error);
  fail("This viewer needs WebGL 2. Enable hardware acceleration or try another browser.");
  retry.textContent = "Reload page";
  retry.onclick = () => location.reload();
}

document.querySelectorAll("[data-frame]").forEach((button) => button.addEventListener("click", () => { state.frame = button.dataset.frame; applyView(); }));
document.querySelectorAll("[data-angle]").forEach((button) => button.addEventListener("click", () => { state.angle = button.dataset.angle; setRotate(false); applyView(); }));
document.querySelector("#rotate").addEventListener("click", () => setRotate(!controls.autoRotate));
document.querySelector("#reset").addEventListener("click", () => {
  state.frame = "portrait";
  state.angle = "threequarter";
  setRotate(false);
  applyView();
});
retry.addEventListener("click", () => { if (renderer && !retry.onclick) loadModel(); });
