import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const dockerignore = readFileSync(
  path.join(projectDirectory, ".dockerignore"),
  "utf8",
);
const dockerfile = readFileSync(path.join(projectDirectory, "Dockerfile"), "utf8");
const ignoredEntries = new Set(
  dockerignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);

for (const requiredEntry of [
  "frontend/.env*",
  "backend/.env*",
  "backend/data",
  "backend/uploads",
  "backend/backups",
]) {
  if (!ignoredEntries.has(requiredEntry)) {
    throw new Error(`Docker build context must ignore ${requiredEntry}.`);
  }
}

if (/^COPY\s+backend\s+\.\/backend\s*$/im.test(dockerfile)) {
  throw new Error("Dockerfile must not copy the entire backend directory.");
}
for (const requiredCopy of [
  "COPY backend/src ./backend/src",
  "COPY backend/scripts ./backend/scripts",
]) {
  if (!dockerfile.includes(requiredCopy)) {
    throw new Error(`Dockerfile is missing: ${requiredCopy}`);
  }
}

console.log("Docker context and runtime copy safety check passed.");
