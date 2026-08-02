import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import Database from "better-sqlite3";
import {
  createBackup,
  listBackupDirectories,
  verifyBackup,
} from "../src/backup.js";
import { createDatabase } from "../src/db.js";
import { getStorageConfig } from "../src/storage-config.js";

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), "jobfinder-storage-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("storage configuration accepts persistent paths and validates retention", () => {
  const root = temporaryDirectory();
  const config = getStorageConfig({
    JOBFINDER_DATABASE_PATH: path.join(root, "jobfinder.db"),
    JOBFINDER_UPLOADS_PATH: path.join(root, "uploads"),
    JOBFINDER_BACKUPS_PATH: path.join(root, "backups"),
    JOBFINDER_BACKUP_RETENTION_COUNT: "3",
  });
  assert.equal(config.databasePath, path.join(root, "jobfinder.db"));
  assert.equal(config.uploadsDirectory, path.join(root, "uploads"));
  assert.equal(config.backupsDirectory, path.join(root, "backups"));
  assert.equal(config.retentionCount, 3);
  assert.throws(
    () => getStorageConfig({ JOBFINDER_BACKUP_RETENTION_COUNT: "0" }),
    /RETENTION_COUNT/,
  );
});

test("a live WAL database and uploaded files produce a verified backup", async () => {
  const root = temporaryDirectory();
  const databasePath = path.join(root, "live", "jobfinder.db");
  const uploadsDirectory = path.join(root, "live", "uploads");
  const backupsDirectory = path.join(root, "backups");
  mkdirSync(uploadsDirectory, { recursive: true });
  writeFileSync(path.join(uploadsDirectory, "resume.pdf"), "%PDF-1.4\nresume\n");

  const live = createDatabase(databasePath, {
    seedDemo: true,
    demoAccounts: {
      employerEmail: "backup-employer@example.com",
      jobSeekerEmail: "backup-seeker@example.com",
      password: "backup-password-123",
    },
  });
  assert.equal(live.pragma("journal_mode", { simple: true }), "wal");
  assert.equal(live.pragma("synchronous", { simple: true }), 2);

  try {
    const created = await createBackup({
      databasePath,
      uploadsDirectory,
      backupsDirectory,
      retentionCount: 2,
      now: new Date("2026-08-02T10:00:00.000Z"),
    });
    const verified = verifyBackup(created.directory);
    assert.equal(verified.manifest.uploads.length, 1);

    const restored = new Database(verified.databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      assert.equal(restored.pragma("integrity_check", { simple: true }), "ok");
      assert.equal(restored.prepare("SELECT COUNT(*) AS count FROM jobs").get().count, 3);
    } finally {
      restored.close();
    }
  } finally {
    live.close();
  }
});

test("backup retention removes only older completed backup directories", async () => {
  const root = temporaryDirectory();
  const databasePath = path.join(root, "jobfinder.db");
  const uploadsDirectory = path.join(root, "uploads");
  const backupsDirectory = path.join(root, "backups");
  mkdirSync(uploadsDirectory);
  const db = createDatabase(databasePath);
  db.close();

  for (const hour of [1, 2, 3]) {
    await createBackup({
      databasePath,
      uploadsDirectory,
      backupsDirectory,
      retentionCount: 2,
      now: new Date(`2026-08-02T0${hour}:00:00.000Z`),
    });
  }

  const backups = listBackupDirectories(backupsDirectory);
  assert.equal(backups.length, 2);
  assert.match(path.basename(backups[0]), /T03-00-00-000Z$/);
  assert.match(path.basename(backups[1]), /T02-00-00-000Z$/);
});

test("backup verification detects a changed uploaded file", async () => {
  const root = temporaryDirectory();
  const databasePath = path.join(root, "jobfinder.db");
  const uploadsDirectory = path.join(root, "uploads");
  const backupsDirectory = path.join(root, "backups");
  mkdirSync(uploadsDirectory);
  writeFileSync(path.join(uploadsDirectory, "resume.pdf"), "%PDF-1.4\noriginal\n");
  const db = createDatabase(databasePath);
  db.close();

  const created = await createBackup({
    databasePath,
    uploadsDirectory,
    backupsDirectory,
  });
  writeFileSync(
    path.join(created.directory, "uploads", "resume.pdf"),
    "%PDF-1.4\nchanged\n",
  );
  assert.throws(() => verifyBackup(created.directory), /upload checksums/);
});
