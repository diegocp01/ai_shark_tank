import { test, expect } from "@playwright/test";

// Tiny valid stand-in isolates viewer interactions from a changing sculpt.
// The actual exported GLB is validated separately in the asset workflow.
function triangleGLB() {
  const positions = new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0, 1.8, 0]);
  const json = JSON.stringify({
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: positions.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-0.2, 0, 0], max: [0.2, 1.8, 0] }],
  });
  const jsonBuffer = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4, " "));
  const binary = Buffer.from(positions.buffer);
  const result = Buffer.alloc(12 + 8 + jsonBuffer.length + 8 + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(jsonBuffer.length, 12); result.writeUInt32LE(0x4e4f534a, 16); jsonBuffer.copy(result, 20);
  const offset = 20 + jsonBuffer.length;
  result.writeUInt32LE(binary.length, offset); result.writeUInt32LE(0x004e4942, offset + 4); binary.copy(result, offset + 8);
  return result;
}

test("isolated viewer loads and supports repeated framing, angles, rotation and reset", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/models/kevin/kevin.glb", (route) => route.fulfill({ contentType: "model/gltf-binary", body: triangleGLB() }));
  await page.goto("/kevin.html");
  await expect(page.locator("body")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#viewport canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kevin", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Full figure", exact: true }).click();
  await expect(page.locator("#viewport")).toHaveAttribute("data-frame", "full");
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.locator("#viewport")).toHaveAttribute("data-angle", "profile");
  await page.getByRole("button", { name: "Auto rotate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Auto rotate", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(page.locator("#viewport")).toHaveAttribute("data-frame", "portrait");
  await expect(page.locator("#viewport")).toHaveAttribute("data-angle", "threequarter");
  await expect(page.getByRole("button", { name: "Auto rotate", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Full figure", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("failed model download shows a recoverable error and retries", async ({ page }) => {
  let requests = 0;
  await page.route("**/models/kevin/kevin.glb", (route) => {
    requests += 1;
    return requests === 1 ? route.fulfill({ status: 404, body: "Not found" }) : route.fulfill({ contentType: "model/gltf-binary", body: triangleGLB() });
  });
  await page.goto("/kevin.html");
  await expect(page.locator("body")).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("button", { name: "Full figure", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reload model", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-state", "ready");
  expect(requests).toBe(2);
});
