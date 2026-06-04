import { parse } from "csv-parse/sync";
import { prisma, ProspectStage } from "@linkedin-agent/db";

export function normalizeLinkedInUrl(url: string): string {
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

/** Comma, semicolon, or newline separated LinkedIn profile URLs. */
export function parseLinkedInUrlsFromText(text: string): string[] {
  const parts = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const urls: string[] = [];
  for (let part of parts) {
    if (!/linkedin\.com/i.test(part) && /^[a-zA-Z0-9_-]+\/?$/.test(part)) {
      part = `https://www.linkedin.com/in/${part.replace(/\/$/, "")}`;
    }
    if (!/linkedin\.com\/in\//i.test(part)) continue;
    urls.push(normalizeLinkedInUrl(part));
  }
  return [...new Set(urls)];
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

async function upsertProspect(
  tenantId: string,
  campaignId: string,
  linkedInAccountId: string | null,
  linkedinUrl: string,
  fields: {
    firstName?: string | null;
    lastName?: string | null;
    headline?: string | null;
    company?: string | null;
    school?: string | null;
    rawImport?: object;
  }
): Promise<boolean> {
  try {
    await prisma.prospect.upsert({
      where: { tenantId_linkedinUrl: { tenantId, linkedinUrl } },
      create: {
        tenantId,
        campaignId,
        linkedInAccountId,
        linkedinUrl,
        firstName: fields.firstName,
        lastName: fields.lastName,
        headline: fields.headline,
        company: fields.company,
        school: fields.school,
        rawImport: fields.rawImport ?? {},
        stage: ProspectStage.imported,
        nextActionAt: new Date(),
      },
      update: {
        firstName: fields.firstName ?? undefined,
        lastName: fields.lastName ?? undefined,
        headline: fields.headline ?? undefined,
        company: fields.company ?? undefined,
        school: fields.school ?? undefined,
        nextActionAt: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function importProspectsFromUrls(
  tenantId: string,
  campaignId: string,
  linkedInAccountId: string | null,
  text: string
): Promise<{ imported: number; skipped: number }> {
  const urls = parseLinkedInUrlsFromText(text);
  if (urls.length === 0) {
    throw new Error(
      "No valid LinkedIn profile URLs found. Use links like https://www.linkedin.com/in/username"
    );
  }

  let imported = 0;
  let skipped = 0;

  for (const linkedinUrl of urls) {
    const ok = await upsertProspect(tenantId, campaignId, linkedInAccountId, linkedinUrl, {
      rawImport: { source: "paste", linkedinUrl },
    });
    if (ok) imported++;
    else skipped++;
  }

  return { imported, skipped };
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

    const linkedinUrl = normalizeLinkedInUrl(url);
    const ok = await upsertProspect(tenantId, campaignId, linkedInAccountId, linkedinUrl, {
      firstName: pick(row, ["firstname", "first", "first name"]),
      lastName: pick(row, ["lastname", "last", "last name"]),
      headline: pick(row, ["headline", "title"]),
      company: pick(row, ["company", "organization"]),
      school: pick(row, ["school", "education", "college"]),
      rawImport: row,
    });
    if (ok) imported++;
    else skipped++;
  }

  return { imported, skipped };
}
