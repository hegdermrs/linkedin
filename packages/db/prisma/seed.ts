import { PrismaClient, UserRole } from "@prisma/client";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { DEFAULT_WRESTLER_PLAYBOOK } from "../../agent/src/default-playbook.js";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  await prisma.agencySettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      basePrompt:
        "You are a helpful LinkedIn outreach assistant. Be authentic, concise, and respectful. Never be pushy.",
      llmProvider: "openai",
      llmModel: "gpt-4o-mini",
    },
    update: {},
  });

  const adminEmail = process.env.AGENCY_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.AGENCY_ADMIN_PASSWORD ?? "changeme";

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      name: "Agency Admin",
      role: UserRole.agency_admin,
    },
    update: {},
  });

  await prisma.playbookTemplate.upsert({
    where: { niche: "wrestlers" },
    create: {
      name: "College Wrestlers",
      niche: "wrestlers",
      config: DEFAULT_WRESTLER_PLAYBOOK as object,
    },
    update: { config: DEFAULT_WRESTLER_PLAYBOOK as object },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-coach" },
    create: { name: "Demo Coach", slug: "demo-coach" },
    update: {},
  });

  // Remove legacy demo coach login (admin-only setup)
  await prisma.user.deleteMany({ where: { email: "coach@demo.com" } });

  let campaign = await prisma.campaign.findFirst({
    where: { tenantId: tenant.id, niche: "wrestlers" },
  });

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        tenantId: tenant.id,
        name: "Wrestler Outreach",
        niche: "wrestlers",
      },
    });
  }

  const existingVersion = await prisma.playbookVersion.findFirst({
    where: { campaignId: campaign.id, status: "published" },
  });

  if (!existingVersion) {
    await prisma.playbookVersion.create({
      data: {
        campaignId: campaign.id,
        version: 1,
        status: "published",
        label: "Initial wrestler playbook",
        config: DEFAULT_WRESTLER_PLAYBOOK as object,
        publishedAt: new Date(),
      },
    });
  }

  const existingAccount = await prisma.linkedInAccount.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!existingAccount) {
    await prisma.linkedInAccount.create({
      data: {
        tenantId: tenant.id,
        label: "Primary LinkedIn",
        status: "disconnected",
      },
    });
  }

  await prisma.linkedInAccount.updateMany({
    where: { sessionEncrypted: null, status: "active" },
    data: { status: "disconnected" },
  });

  console.log("Seed complete:");
  console.log(`  Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`  Sample client tenant: demo-coach (no separate login — use admin + client picker)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
