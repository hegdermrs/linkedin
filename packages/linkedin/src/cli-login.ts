import { writeFileSync } from "node:fs";
import { LinkedInClient } from "./client.js";

const outPath = process.argv[2] ?? ".sessions/linkedin-session.enc";

async function main() {
  const client = new LinkedInClient(null, false);
  try {
    const encrypted = await client.loginInteractive();
    writeFileSync(outPath, encrypted, "utf8");
    console.log(`Session saved to ${outPath}`);
    console.log("\n--- Copy everything below into LinkedIn → paste session ---\n");
    console.log(encrypted);
    console.log("\n--- end session ---\n");
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
