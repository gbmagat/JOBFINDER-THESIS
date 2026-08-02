import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { listBackupDirectories, verifyBackup } from "../src/backup.js";
import { getStorageConfig } from "../src/storage-config.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const environmentPath = path.resolve(moduleDirectory, "../.env");
if (existsSync(environmentPath)) loadEnvFile(environmentPath);

const storage = getStorageConfig();
const backupDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : listBackupDirectories(storage.backupsDirectory)[0];
if (!backupDirectory) throw new Error("No completed JobFinder backup was found.");

const result = verifyBackup(backupDirectory);
console.log(`Backup verified: ${backupDirectory}`);
console.log(`Created: ${result.manifest.createdAt}`);
console.log(`Uploaded files verified: ${result.manifest.uploads.length}`);
