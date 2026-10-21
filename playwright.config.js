import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The real server runs the deterministic scripted engine, so e2e tests hit it
// directly. Stats go to a temp file so test runs never touch data/.
const PORT = Number(process.env.E2E_PORT || 5055);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  // Software WebGL is CPU-bound; a few workers keep runs fast without starving each other.
  workers: 3,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node server.js",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      AI_SHARK_TANK_STATS_PATH: path.join(os.tmpdir(), `ai-shark-tank-e2e-${PORT}.json`),
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Software WebGL so the 3D studio renders in headless runs.
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
  ],
});
