import { PrismaClient, UserRole } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { JIM_AGENCY_BASE_PROMPT } from "../../agent/src/jim-base-prompt.js";
import { JIM_ATHLETES_PLAYBOOK } from "../../agent/src/playbooks/jim-athletes.js";
import { JIM_WRESTLERS_PLAYBOOK } from "../../agent/src/playbooks/jim-wrestlers.js";

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
      basePrompt: JIM_AGENCY_BASE_PROMPT,
      llmProvider: "deepseek",
      llmModel: "deepseek-chat",
    },
    update: {
      basePrompt: JIM_AGENCY_BASE_PROMPT,
      llmProvider: "deepseek",
      llmModel: "deepseek-chat",
    },
  });

  const adminUsername = process.env.AGENCY_ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.AGENCY_ADMIN_PASSWORD ?? "changeme";
  const adminEmail = process.env.AGENCY_ADMIN_EMAIL ?? null;

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: adminUsername },
        ...(adminEmail ? [{ email: adminEmail }] : []),
      ],
    },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        username: adminUsername,
        email: adminEmail ?? existingAdmin.email,
        passwordHash: hashPassword(adminPassword),
        role: UserRole.agency_admin,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        username: adminUsername,
        email: adminEmail,
        passwordHash: hashPassword(adminPassword),
        name: "Agency Admin",
        role: UserRole.agency_admin,
      },
    });
  }

  await prisma.playbookTemplate.upsert({
    where: { niche: "jim-wrestlers" },
    create: {
      name: "Jim Harshaw — Former Wrestlers",
      niche: "jim-wrestlers",
      config: JIM_WRESTLERS_PLAYBOOK as object,
    },
    update: { name: "Jim Harshaw — Former Wrestlers", config: JIM_WRESTLERS_PLAYBOOK as object },
  });

  await prisma.playbookTemplate.upsert({
    where: { niche: "jim-athletes" },
    create: {
      name: "Jim Harshaw — College Athletes",
      niche: "jim-athletes",
      config: JIM_ATHLETES_PLAYBOOK as object,
    },
    update: { name: "Jim Harshaw — College Athletes", config: JIM_ATHLETES_PLAYBOOK as object },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "jim-harshaw" },
    create: { name: "Jim Harshaw", slug: "jim-harshaw" },
    update: { name: "Jim Harshaw" },
  });

  await prisma.user.deleteMany({ where: { email: "coach@demo.com" } });

  let wrestlerCampaign = await prisma.campaign.findFirst({
    where: { tenantId: tenant.id, niche: "jim-wrestlers" },
  });
  if (!wrestlerCampaign) {
    wrestlerCampaign = await prisma.campaign.create({
      data: {
        tenantId: tenant.id,
        name: "Reveal Your Path — Wrestlers",
        niche: "jim-wrestlers",
      },
    });
  }

  const publishedW = await prisma.playbookVersion.findFirst({
    where: { campaignId: wrestlerCampaign.id, status: "published" },
  });
  if (!publishedW) {
    await prisma.playbookVersion.create({
      data: {
        campaignId: wrestlerCampaign.id,
        version: 1,
        status: "published",
        label: "Jim wrestlers voice",
        config: JIM_WRESTLERS_PLAYBOOK as object,
        publishedAt: new Date(),
      },
    });
  } else {
    await prisma.playbookVersion.update({
      where: { id: publishedW.id },
      data: { config: JIM_WRESTLERS_PLAYBOOK as object },
    });
  }

  let athleteCampaign = await prisma.campaign.findFirst({
    where: { tenantId: tenant.id, niche: "jim-athletes" },
  });
  if (!athleteCampaign) {
    athleteCampaign = await prisma.campaign.create({
      data: {
        tenantId: tenant.id,
        name: "Reveal Your Path — All Athletes",
        niche: "jim-athletes",
      },
    });
  }

  if (
    !(await prisma.playbookVersion.findFirst({
      where: { campaignId: athleteCampaign.id, status: "published" },
    }))
  ) {
    await prisma.playbookVersion.create({
      data: {
        campaignId: athleteCampaign.id,
        version: 1,
        status: "published",
        label: "Jim athletes voice",
        config: JIM_ATHLETES_PLAYBOOK as object,
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
        label: "Jim LinkedIn",
        status: "disconnected",
      },
    });
  }

  await prisma.linkedInAccount.updateMany({
    where: { sessionEncrypted: null, status: "active" },
    data: { status: "disconnected" },
  });

  console.log("Seed complete:");
  console.log(`  Admin login: ${adminUsername} / ${adminPassword}`);
  console.log(`  Client tenant: jim-harshaw (wrestlers + athletes campaigns)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
