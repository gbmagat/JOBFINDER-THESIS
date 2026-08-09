import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createDatabase } from "./db.js";
import { getDemoAccountConfig, getServerConfig } from "./server-config.js";
import { getStorageConfig } from "./storage-config.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const environmentPath = path.resolve(moduleDirectory, "../.env");
if (existsSync(environmentPath)) loadEnvFile(environmentPath);

const frontendDirectory = path.resolve(moduleDirectory, "../../frontend/dist");
const config = getServerConfig();
const storage = getStorageConfig();
const frontendIndex = path.join(frontendDirectory, "index.html");
if (config.production && !existsSync(frontendIndex)) {
  throw new Error("Production startup requires a built frontend. Run npm run build first.");
}
const demoAccounts = getDemoAccountConfig(config);
const db = createDatabase(storage.databasePath, {
  seedDemo: config.seedDemo,
  demoAccounts,
});
const app = createApp({
  db,
  uploadsDirectory: storage.uploadsDirectory,
  frontendDirectory,
  trustProxy: config.trustProxy,
});
const server = app.listen(config.port, config.host, () => {
  console.log(`JobFinder is running at http://${config.host}:${config.port}`);
});

function stop() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
