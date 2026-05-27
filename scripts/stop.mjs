#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function runCommand(commandLine) {
  return new Promise((resolve) => {
    const proc = spawn(commandLine, [], {
      cwd: root,
      stdio: "inherit",
      shell: true,
      windowsHide: true,
    });
    proc.on("exit", () => resolve());
  });
}

console.log("Stopping Docker containers…");
await runCommand("docker compose down");
console.log("Done. Close any terminal still running the app (Ctrl+C).");
