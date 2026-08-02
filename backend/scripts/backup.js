import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { createBackup } from "../src/backup.js";
import { getStorageConfig } from "../src/storage-config.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const environmentPath = path.resolve(moduleDirectory, "../.env");
if (existsSync(environmentPath)) loadEnvFile(environmentPath);

const result = await createBackup(getStorageConfig());
console.log(`Backup created: ${result.directory}`);
console.log(`Uploaded files included: ${result.manifest.uploads.length}`);
if (result.removed.length) {
  console.log(`Expired backups removed: ${result.removed.length}`);
}
