import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.SESSION_ENCRYPTION_KEY ?? "dev-key-change-in-production!!";
  return scryptSync(secret, "linkedin-agent-salt", 32);
}

export function encryptSession(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSession(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

/** Normalize paste from terminal / file (strip whitespace). */
export function normalizeSessionBlob(input: string): string {
  return input.trim().replace(/\s+/g, "");
}

/**
 * Ensures blob decrypts with current SESSION_ENCRYPTION_KEY and is valid JSON.
 * Throws a clear error if the Railway key does not match the PC used for login.
 */
export function assertValidEncryptedSession(input: string): string {
  const blob = normalizeSessionBlob(input);
  if (!blob) {
    throw new Error("Session blob is empty.");
  }
  try {
    const plain = decryptSession(blob);
    JSON.parse(plain);
    return blob;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("authenticate") ||
      msg.includes("Unsupported state")
    ) {
      throw new Error(
        "SESSION_ENCRYPTION_KEY mismatch — the login command on your PC must use the same key as Railway api and worker. Set one key everywhere, run login again, and paste the new blob."
      );
    }
    if (msg.includes("Invalid") || msg.includes("base64")) {
      throw new Error(
        "Invalid session paste — copy the full encrypted string from the login command (one long line)."
      );
    }
    throw new Error(`Invalid session: ${msg}`);
  }
}

export function canDecryptSession(input: string | null | undefined): boolean {
  if (!input) return false;
  try {
    assertValidEncryptedSession(input);
    return true;
  } catch {
    return false;
  }
}
