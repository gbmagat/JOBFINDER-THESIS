import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const protectedPaths = [
  "ONTOLOGY_BASED_OPPORTUNITY_RECOMMENDATION (3).docx",
  "create_jobfinder_google_forms.gs",
  "backend/.env",
  "frontend/.env.production",
  "backend/data/jobfinder.db",
  "backend/data/jobfinder.db-wal",
  "backend/uploads/resume.pdf",
  "backend/backups/jobfinder-test/manifest.json",
  "database.bak",
  "database.dump.gz",
  "backup.sql.gz",
  ".secrets/token.txt",
  "private-key.pem",
  "server.key",
  "certificate.p12",
  "auth-key.p8",
  "private.ppk",
  "server.crt",
  "id_ecdsa",
  "service-account.json",
  "client-credentials.json",
  "client_secret.json",
  "client_secret_example.json",
  "firebase-adminsdk-test.json",
  "credentials.csv",
  "vault.kdbx",
  ".npmrc",
];
const visibleSourcePaths = [
  "frontend/src/config.env.ts",
  "frontend/src/uploads/index.ts",
  "docs/credentials.schema.json",
  "backend/src/schema.db-helper.ts",
];

for (const filename of protectedPaths) {
  const result = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--no-index", filename],
    { cwd: projectDirectory },
  );
  if (result.status !== 0) {
    throw new Error(`Repository privacy rules must ignore ${filename}.`);
  }
}

for (const filename of visibleSourcePaths) {
  const result = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--no-index", filename],
    { cwd: projectDirectory },
  );
  if (result.status === 0) {
    throw new Error(`Repository privacy rules must not ignore ${filename}.`);
  }
}

function isSensitive(filename) {
  const normalized = filename.split(path.sep).join("/").toLowerCase();
  const base = path.posix.basename(normalized);
  const isEnvironmentExample =
    base === ".env.example" ||
    (base.startsWith(".env.") && base.endsWith(".example"));
  if (
    !isEnvironmentExample &&
    (base === ".env" || base.startsWith(".env.") || base.endsWith(".env"))
  ) {
    return true;
  }
  if (/\.(?:db|sqlite|sqlite3)(?:$|-(?:shm|wal|journal)$)/.test(base)) {
    return true;
  }
  if (/^(?:backend\/)?(?:uploads|backups)\//.test(normalized)) return true;
  if (/(?:^|\/)\.secrets\//.test(normalized)) return true;
  if (/\.(?:bak|backup|dump|dump\.gz|sql\.gz)$/.test(base)) return true;
  if (
    /\.(?:pem|key|p12|pfx|p8|ppk|pkcs8|der|crt|cer|jks|keystore|kdbx)$/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/^id_(?:rsa|ed25519|dsa|ecdsa)/.test(base)) return true;
  if (
    /^(?:credentials(?:[-_].+)?|.+[-_]credentials)\.(?:json|csv)$/.test(base)
  ) {
    return true;
  }
  if (/^client[-_]secret.*\.json$/.test(base)) return true;
  if (
    /^(?:service[-_]account(?:[-_].+)?|.+[-_]service[-_]account)\.json$/.test(
      base,
    )
  ) {
    return true;
  }
  if (/firebase-adminsdk.*\.json$/.test(base)) return true;
  if (/^(?:secrets?(?:[-_].+)?|.+[-_]secrets?)\.json$/.test(base)) return true;
  if ([".npmrc", ".netrc", ".pypirc"].includes(base)) return true;
  if (/^ontology_based_opportunity_recommendation.*\.docx$/.test(base)) return true;
  return base === "create_jobfinder_google_forms.gs";
}

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: projectDirectory,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const exposedFiles = trackedFiles.filter(isSensitive);
if (exposedFiles.length) {
  throw new Error(`Sensitive paths are tracked:\n${exposedFiles.join("\n")}`);
}

console.log("Repository privacy and tracked-file safety check passed.");
