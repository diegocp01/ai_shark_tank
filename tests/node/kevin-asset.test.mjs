import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import request from "supertest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createApp } from "../../server.js";

test("Kevin GLB parses in the runtime loader with finite geometry and human-scale bounds", async () => {
  const bytes = await readFile(new URL("../../public/models/kevin/kevin.glb", import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "GLB magic");
  assert.equal(bytes.readUInt32LE(4), 2, "glTF 2");
  assert.equal(bytes.readUInt32LE(8), bytes.length, "declared length");
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), "");
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(size.y > 1.5 && size.y < 2.1, `human height: ${size.y}`);
  assert.ok(size.x > 0.2 && size.x < 1.5, `human width: ${size.x}`);
  assert.ok(size.z > 0.1 && size.z < 1, `human depth: ${size.z}`);
  let triangles = 0;
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const positions = node.geometry.attributes.position;
    assert.ok(positions.count > 0, `${node.name} has positions`);
    for (const coordinate of positions.array) assert.ok(Number.isFinite(coordinate), `${node.name} finite coordinate`);
    triangles += (node.geometry.index?.count ?? positions.count) / 3;
  });
  assert.ok(triangles > 1000, "non-placeholder detailed geometry");
  assert.ok(triangles < 500000, "bounded real-time geometry budget");
});

test("Kevin review and asset routes are separate from the existing cast", async () => {
  const app = createApp();
  await request(app).get("/kevin.html").expect(200).expect(/Character development/);
  await request(app).get("/js/kevin-viewer.js").expect(200).expect(/GLTFLoader/);
  await request(app).get("/models/kevin/kevin.glb").expect(200);
  const response = await request(app).get("/api/config").expect(200);
  assert.deepEqual(response.body.sharks.map((shark) => shark.id), ["rex", "luna", "max", "vera", "wes"]);
});
