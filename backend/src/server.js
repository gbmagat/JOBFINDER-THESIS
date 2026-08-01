import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createDatabase, DEFAULT_DATABASE_PATH } from "./db.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.JOBFINDER_DATABASE_PATH
  ? path.resolve(process.env.JOBFINDER_DATABASE_PATH)
  : DEFAULT_DATABASE_PATH;
const uploadsDirectory = process.env.JOBFINDER_UPLOADS_PATH
  ? path.resolve(process.env.JOBFINDER_UPLOADS_PATH)
  : path.resolve(moduleDirectory, "../uploads");
const frontendDirectory = path.resolve(moduleDirectory, "../../frontend/dist");
const port = Number(process.env.PORT) || 4000;
const seedDemo = /^(1|true|yes)$/i.test(
  String(process.env.JOBFINDER_SEED_DEMO ?? ""),
);
const db = createDatabase(databasePath, { seedDemo });
const app = createApp({ db, uploadsDirectory, frontendDirectory });
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`JobFinder API is running at http://127.0.0.1:${port}`);
});

function stop() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
