import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

const npmCli =
  process.env.npm_execpath ??
  (process.platform === "win32"
    ? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
    : null);
const npmCommand = npmCli ? process.execPath : "npm";
const npmArgs = (args) => (npmCli ? [npmCli, ...args] : args);
const processes = [
  spawn(npmCommand, npmArgs(["--prefix", "backend", "run", "dev"]), {
    stdio: "inherit",
    env: {
      ...process.env,
      JOBFINDER_SEED_DEMO: process.env.JOBFINDER_SEED_DEMO ?? "true",
    },
  }),
  spawn(npmCommand, npmArgs(["--prefix", "frontend", "run", "dev"]), {
    stdio: "inherit",
  }),
];

function stop() {
  for (const child of processes) {
    child.kill();
  }
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exitCode = code;
    }
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
