import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { LinkedInClient } from "./client.js";
import { loadSessionEncryptionKeyFromEnvFile } from "./load-env.js";
import { sessionKeyFingerprint } from "./session.js";

const outPath = resolve(process.argv[2] ?? ".sessions/linkedin-session.enc");

async function main() {
  loadSessionEncryptionKeyFromEnvFile();
  const fp = sessionKeyFingerprint();
  console.log(`Session key fingerprint: ${fp}`);
  console.log(
    "(Railway api + worker SESSION_ENCRYPTION_KEY must produce the same fingerprint.)\n"
  );

  const client = new LinkedInClient(null, false);
  try {
    const encrypted = await client.loginInteractive();
    console.log("\n--- Copy everything below into LinkedIn → paste session ---\n");
    console.log(encrypted);
    console.log("\n--- end session ---\n");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, encrypted, "utf8");
    console.log(`Session saved to ${outPath}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
