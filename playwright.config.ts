import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "line",
  outputDir: path.join(os.tmpdir(), "jobfinder-playwright-results"),
  use: {
    baseURL,
    browserName: "chromium",
    channel: "msedge",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
