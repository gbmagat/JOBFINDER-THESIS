import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DATABASE_PATH } from "./db.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_UPLOADS_PATH = path.resolve(moduleDirectory, "../uploads");
export const DEFAULT_BACKUPS_PATH = path.resolve(moduleDirectory, "../backups");

function configuredPath(value, fallback) {
  const configured = String(value ?? "").trim();
  return configured ? path.resolve(configured) : fallback;
}

export function getStorageConfig(environment = process.env) {
  const retentionCount = Number(
    environment.JOBFINDER_BACKUP_RETENTION_COUNT ?? 7,
  );
  if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 100) {
    throw new Error("JOBFINDER_BACKUP_RETENTION_COUNT must be an integer from 1 to 100.");
  }

  return {
    databasePath: configuredPath(
      environment.JOBFINDER_DATABASE_PATH,
      DEFAULT_DATABASE_PATH,
    ),
    uploadsDirectory: configuredPath(
      environment.JOBFINDER_UPLOADS_PATH,
      DEFAULT_UPLOADS_PATH,
    ),
    backupsDirectory: configuredPath(
      environment.JOBFINDER_BACKUPS_PATH,
      DEFAULT_BACKUPS_PATH,
    ),
    retentionCount,
  };
}
