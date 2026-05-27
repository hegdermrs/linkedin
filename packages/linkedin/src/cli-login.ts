import { writeFileSync } from "node:fs";
import { LinkedInClient } from "./client.js";

const outPath = process.argv[2] ?? ".sessions/linkedin-session.enc";

async function main() {
  const client = new LinkedInClient(null, false);
  try {
    const encrypted = await client.loginInteractive();
    writeFileSync(outPath, encrypted, "utf8");
    console.log(`Session saved to ${outPath}`);
    console.log("Paste this value into LinkedInAccount.sessionEncrypted via API or admin.");
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
