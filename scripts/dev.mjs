import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const processes = [
  spawn(npmCommand, ["--prefix", "backend", "run", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      JOBFINDER_SEED_DEMO: process.env.JOBFINDER_SEED_DEMO ?? "true",
    },
  }),
  spawn(npmCommand, ["--prefix", "frontend", "run", "dev"], {
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
