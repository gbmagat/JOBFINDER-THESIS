import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const BACKUP_NAME = /^jobfinder-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?$/;

function sha256(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function copyUploads(source, destination) {
  mkdirSync(destination, { recursive: true });
  if (!existsSync(source)) return;

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyUploads(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      copyFileSync(sourcePath, destinationPath);
    }
  }
}

function uploadRecords(directory, relativeDirectory = "") {
  if (!existsSync(directory)) return [];
  const records = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const relativeName = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      records.push(...uploadRecords(filename, relativeName));
    } else if (entry.isFile()) {
      records.push({
        file: relativeName.split(path.sep).join("/"),
        sizeBytes: statSync(filename).size,
        sha256: sha256(filename),
      });
    }
  }
  return records.sort((left, right) => left.file.localeCompare(right.file));
}

function verifyDatabase(filename) {
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  try {
    const result = db.pragma("integrity_check", { simple: true });
    if (result !== "ok") throw new Error(`Backup database integrity check failed: ${result}`);
  } finally {
    db.close();
  }
}

export function listBackupDirectories(backupsDirectory) {
  if (!existsSync(backupsDirectory)) return [];
  return readdirSync(backupsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BACKUP_NAME.test(entry.name))
    .map((entry) => path.join(path.resolve(backupsDirectory), entry.name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
}

export function verifyBackup(backupDirectory) {
  const resolvedBackup = path.resolve(backupDirectory);
  const manifestPath = path.join(resolvedBackup, "manifest.json");
  const databasePath = path.join(resolvedBackup, "jobfinder.db");
  const uploadsDirectory = path.join(resolvedBackup, "uploads");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (manifest.version !== 1) throw new Error("Unsupported backup manifest version.");
  verifyDatabase(databasePath);

  const database = {
    file: "jobfinder.db",
    sizeBytes: statSync(databasePath).size,
    sha256: sha256(databasePath),
  };
  const uploads = uploadRecords(uploadsDirectory);
  if (JSON.stringify(database) !== JSON.stringify(manifest.database)) {
    throw new Error("Backup database checksum does not match its manifest.");
  }
  if (JSON.stringify(uploads) !== JSON.stringify(manifest.uploads)) {
    throw new Error("Backup upload checksums do not match their manifest.");
  }

  return { manifest, databasePath, uploadsDirectory };
}

function removeExpiredBackups(backupsDirectory, retentionCount) {
  const resolvedRoot = path.resolve(backupsDirectory);
  const expired = listBackupDirectories(resolvedRoot).slice(retentionCount);
  for (const directory of expired) {
    if (path.dirname(directory) !== resolvedRoot) {
      throw new Error("Refusing to remove a backup outside the configured directory.");
    }
    rmSync(directory, { recursive: true, force: true });
  }
  return expired;
}

function availableBackupPath(backupsDirectory, date) {
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const baseName = `jobfinder-${timestamp}`;
  let candidate = path.join(backupsDirectory, baseName);
  let suffix = 1;
  while (existsSync(candidate)) {
    candidate = path.join(backupsDirectory, `${baseName}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

export async function createBackup({
  databasePath,
  uploadsDirectory,
  backupsDirectory,
  retentionCount = 7,
  now = new Date(),
}) {
  const resolvedBackups = path.resolve(backupsDirectory);
  mkdirSync(resolvedBackups, { recursive: true });
  const finalDirectory = availableBackupPath(resolvedBackups, now);
  const stagingDirectory = path.join(
    resolvedBackups,
    `.${path.basename(finalDirectory)}-${randomUUID()}.tmp`,
  );
  mkdirSync(stagingDirectory);

  try {
    const backupDatabasePath = path.join(stagingDirectory, "jobfinder.db");
    const backupUploadsPath = path.join(stagingDirectory, "uploads");
    const source = new Database(path.resolve(databasePath), { fileMustExist: true });
    try {
      await source.backup(backupDatabasePath);
    } finally {
      source.close();
    }

    copyUploads(path.resolve(uploadsDirectory), backupUploadsPath);
    verifyDatabase(backupDatabasePath);
    const manifest = {
      version: 1,
      createdAt: now.toISOString(),
      database: {
        file: "jobfinder.db",
        sizeBytes: statSync(backupDatabasePath).size,
        sha256: sha256(backupDatabasePath),
      },
      uploads: uploadRecords(backupUploadsPath),
    };
    writeFileSync(
      path.join(stagingDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    verifyBackup(stagingDirectory);
    renameSync(stagingDirectory, finalDirectory);
    const removed = removeExpiredBackups(resolvedBackups, retentionCount);
    return { directory: finalDirectory, manifest, removed };
  } catch (error) {
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}
