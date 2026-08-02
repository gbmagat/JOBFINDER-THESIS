import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createDatabase, DEFAULT_DATABASE_PATH } from "./db.js";
import { getServerConfig } from "./server-config.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const environmentPath = path.resolve(moduleDirectory, "../.env");
if (existsSync(environmentPath)) loadEnvFile(environmentPath);

const databasePath = process.env.JOBFINDER_DATABASE_PATH
  ? path.resolve(process.env.JOBFINDER_DATABASE_PATH)
  : DEFAULT_DATABASE_PATH;
const uploadsDirectory = process.env.JOBFINDER_UPLOADS_PATH
  ? path.resolve(process.env.JOBFINDER_UPLOADS_PATH)
  : path.resolve(moduleDirectory, "../uploads");
const frontendDirectory = path.resolve(moduleDirectory, "../../frontend/dist");
const config = getServerConfig();
const frontendIndex = path.join(frontendDirectory, "index.html");
if (config.production && !existsSync(frontendIndex)) {
  throw new Error("Production startup requires a built frontend. Run npm run build first.");
}
const demoAccounts = {
  employerEmail: process.env.JOBFINDER_DEMO_EMPLOYER_EMAIL,
  jobSeekerEmail: process.env.JOBFINDER_DEMO_JOB_SEEKER_EMAIL,
  password: process.env.JOBFINDER_DEMO_PASSWORD,
};
const db = createDatabase(databasePath, {
  seedDemo: config.seedDemo,
  demoAccounts,
});
const app = createApp({
  db,
  uploadsDirectory,
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
