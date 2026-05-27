import { prisma } from "@linkedin-agent/db";
import {
  PlaybookConfigSchema,
  type PlaybookConfig,
} from "@linkedin-agent/shared";

export async function getPublishedPlaybook(
  campaignId: string
): Promise<PlaybookConfig | null> {
  const version = await prisma.playbookVersion.findFirst({
    where: { campaignId, status: "published" },
    orderBy: { version: "desc" },
  });
  if (!version) return null;
  return PlaybookConfigSchema.parse(version.config);
}

export async function getAgencySettings() {
  return prisma.agencySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}
