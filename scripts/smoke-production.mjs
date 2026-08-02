import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const frontendIndex = path.join(projectDirectory, "frontend", "dist", "index.html");

if (!existsSync(frontendIndex)) {
  throw new Error("Production smoke test requires a built frontend. Run npm run build first.");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      const port = typeof address === "object" && address ? address.port : null;
      listener.close((error) => {
        if (error) reject(error);
        else if (port) resolve(port);
        else reject(new Error("Could not reserve a smoke-test port."));
      });
    });
  });
}

const smokeDirectory = await mkdtemp(path.join(tmpdir(), "jobfinder-production-"));
const port = await availablePort();
let output = "";
let spawnError = null;
const server = spawn(process.execPath, ["backend/src/server.js"], {
  cwd: projectDirectory,
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    JOBFINDER_TRUST_PROXY: "false",
    JOBFINDER_SEED_DEMO: "false",
    JOBFINDER_DATABASE_PATH: path.join(smokeDirectory, "jobfinder.db"),
    JOBFINDER_UPLOADS_PATH: path.join(smokeDirectory, "uploads"),
    JOBFINDER_BACKUPS_PATH: path.join(smokeDirectory, "backups"),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

server.stdout.on("data", (data) => {
  output += data.toString();
});
server.stderr.on("data", (data) => {
  output += data.toString();
});
server.on("error", (error) => {
  spawnError = error;
});

try {
  let health = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null) {
      throw new Error(`Production server exited early.\n${output}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) health = await response.json();
      if (health?.status === "ok") break;
    } catch {
      await delay(100);
    }
  }
  if (health?.status !== "ok") {
    throw new Error(`Production health check did not become ready.\n${output}`);
  }

  const home = await fetch(`http://127.0.0.1:${port}/`, {
    signal: AbortSignal.timeout(2_000),
  });
  if (!home.ok || !String(home.headers.get("content-type")).includes("text/html")) {
    throw new Error("Production server did not serve the built frontend.");
  }
  console.log("Production startup, health endpoint, and frontend smoke test passed.");
} finally {
  if (server.exitCode === null) {
    server.kill();
    await Promise.race([once(server, "exit"), delay(2_000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(smokeDirectory, { recursive: true, force: true });
}
