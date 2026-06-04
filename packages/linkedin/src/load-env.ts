import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Load SESSION_ENCRYPTION_KEY from repo root `.env` when running the login CLI. */
export function loadSessionEncryptionKeyFromEnvFile(): void {
  if (process.env.SESSION_ENCRYPTION_KEY?.trim()) return;

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "SESSION_ENCRYPTION_KEY") continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) process.env.SESSION_ENCRYPTION_KEY = value;
    return;
  }
}
