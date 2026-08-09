import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

const npmCli =
  process.env.npm_execpath ??
  (process.platform === "win32"
    ? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
    : null);
const npmCommand = npmCli ? process.execPath : "npm";

function install(prefix) {
  const args = prefix ? ["install", "--prefix", prefix] : ["install"];
  const commandArgs = npmCli ? [npmCli, ...args] : args;

  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, commandArgs, {
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Dependency installation failed with exit code ${code}.`));
      }
    });
  });
}

for (const prefix of [null, "frontend", "backend"]) {
  await install(prefix);
}
