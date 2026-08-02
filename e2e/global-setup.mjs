import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createApp } from "../backend/src/app.js";
import { createDatabase } from "../backend/src/db.js";

const projectRoot = path.resolve(process.cwd());
const dataDirectory = path.join(projectRoot, "backend", "data");
const uploadsRoot = path.join(projectRoot, "backend", "uploads");
const databasePath = path.join(dataDirectory, "jobfinder-e2e.db");
const uploadsDirectory = path.join(uploadsRoot, "e2e");
const frontendDirectory = path.join(projectRoot, "frontend", "dist");

function clearTestStorage() {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    const file = `${databasePath}${suffix}`;
    if (existsSync(file)) rmSync(file, { force: true });
  }
  if (existsSync(uploadsDirectory)) {
    rmSync(uploadsDirectory, { recursive: true, force: true });
  }
}

async function closeServer(server) {
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export default async function globalSetup() {
  if (
    !databasePath.startsWith(`${dataDirectory}${path.sep}`) ||
    !uploadsDirectory.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    throw new Error("E2E storage must remain inside the isolated test paths.");
  }

  clearTestStorage();

  const db = createDatabase(databasePath, {
    seedDemo: true,
    demoAccounts: {
      employerEmail: "qa-employer@example.test",
      jobSeekerEmail: "qa-seeker@example.test",
      pesoLguEmail: "qa-lgu@example.test",
      password: "qa-test-password-2026",
    },
  });

  const futureDeadline = new Date();
  futureDeadline.setUTCDate(futureDeadline.getUTCDate() + 30);
  db.prepare("UPDATE jobs SET closing_at = ? WHERE status = 'active'").run(
    futureDeadline.toISOString(),
  );

  const app = createApp({ db, uploadsDirectory, frontendDirectory });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(4173, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });

  return async () => {
    await closeServer(server);
    db.close();
    clearTestStorage();
  };
}
