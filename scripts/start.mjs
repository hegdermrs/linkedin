#!/usr/bin/env node
/**
 * One-command start: Docker → wait for DB/Redis → API + Worker + Web
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PNPM = "npx pnpm@9.15.0";

/** Run a shell command (reliable on Windows). */
function runCommand(commandLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(commandLine, [], {
      cwd: root,
      stdio: "inherit",
      shell: true,
      windowsHide: true,
      env: process.env,
    });
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${commandLine}`))
    );
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${host}:${port}`));
        return;
      }
      const socket = net.createConnection({ port, host }, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        setTimeout(attempt, 1000);
      });
    };
    attempt();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!existsSync(join(root, "node_modules"))) {
    console.log("Installing dependencies…");
    await runCommand(`${PNPM} install`);
  }

  if (!existsSync(join(root, ".env"))) {
    copyFileSync(join(root, ".env.example"), join(root, ".env"));
    console.log("Created .env — set OPENAI_API_KEY when you use AI features.");
  }

  if (!existsSync(join(root, "packages", "db", ".env"))) {
    copyFileSync(join(root, ".env"), join(root, "packages", "db", ".env"));
  }

  console.log("\n▶ Starting Docker (Postgres + Redis)…");
  await runCommand("docker compose up -d");

  console.log("▶ Waiting for database ports…");
  await sleep(2000);
  await Promise.all([waitForPort(5432), waitForPort(6379)]);

  console.log("▶ Syncing database schema…");
  await runCommand(`${PNPM} db:push`);

  const playwrightMarker = join(root, ".playwright-chromium-ready");
  if (!existsSync(playwrightMarker)) {
    console.log(
      "\n▶ Installing Chromium for LinkedIn (one-time download, ~150MB)…"
    );
    await runCommand(`${PNPM} playwright:install`);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(playwrightMarker, new Date().toISOString());
  }

  console.log("\n▶ Starting app (API :3001, Web :3000, Worker)…");
  console.log("  Open http://localhost:3000");
  console.log("  Login: admin / changeme");
  console.log("  Press Ctrl+C to stop all services.\n");

  await runCommand(`${PNPM} dev:all`);
}

main().catch((err) => {
  console.error("\nStart failed:", err.message);
  console.error("Ensure Docker Desktop is running, then try again.");
  process.exit(1);
});
