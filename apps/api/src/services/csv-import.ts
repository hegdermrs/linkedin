import { parse } from "csv-parse/sync";
import { prisma, ProspectStage } from "@linkedin-agent/db";

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!u.startsWith("http")) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const found = Object.entries(row).find(
      ([col]) => col.toLowerCase().replace(/\s/g, "") === k.toLowerCase()
    );
    if (found?.[1]?.trim()) return found[1].trim();
  }
  return undefined;
}

export async function importProspectsCsv(
  tenantId: string,
  campaignId: string,
  linkedInAccountId: string | null,
  csvContent: string
): Promise<{ imported: number; skipped: number }> {
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const url = pick(row, [
      "linkedinurl",
      "linkedinprofileurl",
      "profileurl",
      "url",
      "linkedin",
    ]);
    if (!url) {
      skipped++;
      continue;
    }

    const linkedinUrl = normalizeUrl(url);
    const firstName = pick(row, ["firstname", "first", "first name"]);
    const lastName = pick(row, ["lastname", "last", "last name"]);
    const headline = pick(row, ["headline", "title"]);
    const company = pick(row, ["company", "organization"]);
    const school = pick(row, ["school", "education", "college"]);

    try {
      await prisma.prospect.upsert({
        where: { tenantId_linkedinUrl: { tenantId, linkedinUrl } },
        create: {
          tenantId,
          campaignId,
          linkedInAccountId,
          linkedinUrl,
          firstName,
          lastName,
          headline,
          company,
          school,
          rawImport: row,
          stage: ProspectStage.imported,
          nextActionAt: new Date(),
        },
        update: {
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          headline: headline ?? undefined,
          company: company ?? undefined,
          school: school ?? undefined,
        },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped };
}
