"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { TenantSelector, useTenant } from "@/components/TenantContext";
import { api, type Campaign } from "@/lib/api";

function SetupContent() {
  const { tenantId } = useTenant();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [urlText, setUrlText] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.campaigns(tenantId).then(setCampaigns).catch(console.error);
  }, [tenantId]);

  async function afterImport(r: { imported: number; skipped: number }) {
    setResult(`Imported ${r.imported} prospects (${r.skipped} skipped).`);
    try {
      await api.orchestrate(tenantId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Orchestrate failed";
      setResult(
        (prev) =>
          `${prev} Outreach queue: ${msg.includes("Unauthorized") ? "sign in again, then open Dashboard and resume." : msg}`
      );
    }
  }

  async function importCsv() {
    if (!file || !campaigns[0]) return;
    setError("");
    setResult("");
    setImporting(true);
    try {
      await afterImport(await api.importCsv(campaigns[0].id, file));
    } catch (e) {
      setError(formatImportError(e));
    } finally {
      setImporting(false);
    }
  }

  function formatImportError(e: unknown): string {
    const msg = e instanceof Error ? e.message : "Import failed";
    if (msg.includes("Unauthorized")) {
      return "Session expired — log out and sign in again, then retry. (Api must have REDIS_URL set on Railway.)";
    }
    return msg;
  }

  async function importUrls() {
    if (!urlText.trim() || !campaigns[0]) return;
    setError("");
    setResult("");
    setImporting(true);
    try {
      await afterImport(await api.importUrls(campaigns[0].id, urlText));
      setUrlText("");
    } catch (e) {
      setError(formatImportError(e));
    } finally {
      setImporting(false);
    }
  }

  const linkedInHref = `/admin/tenants/${tenantId}/accounts`;
  const playbookHref = `/admin/tenants/${tenantId}/playbook`;

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>Setup</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Complete these steps in order before checking the dashboard.
      </p>
      <TenantSelector />

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
          Getting started
        </h2>
        <ol style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
          <li>
            <Link href={linkedInHref}>Connect LinkedIn</Link> — on Railway,
            run the login command on your PC and paste the session; locally you
            can use the browser button.
          </li>
          <li>
            <Link href={playbookHref}>Configure playbook</Link> — messages,
            tone, and guardrails for this campaign.
          </li>
          <li>
            <Link href="/settings">Campaign settings</Link> — Calendly link and
            business hours timezone.
          </li>
          <li>
            <strong>Add prospects</strong> (below) — paste LinkedIn URLs or
            upload a CSV.
          </li>
          <li>
            <Link href="/dashboard">Start on dashboard</Link> — review metrics
            and pause/resume when ready.
          </li>
        </ol>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
          Step 4a — Paste LinkedIn profile URLs
        </h2>
        {error && <div className="alert">{error}</div>}
        {result && <div className="alert success">{result}</div>}
        <div className="form-group">
          <label>One URL per line, or separated by commas</label>
          <textarea
            rows={8}
            placeholder={
              "https://www.linkedin.com/in/jane-doe\nhttps://www.linkedin.com/in/john-smith\n\nor: url1, url2, url3"
            }
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            style={{ fontFamily: "monospace", fontSize: "0.9rem" }}
          />
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.35rem" }}>
            Each entry must be a LinkedIn <code>/in/...</code> profile link.
          </p>
        </div>
        <button
          type="button"
          onClick={importUrls}
          disabled={!urlText.trim() || importing || !campaigns[0]}
        >
          {importing ? "Importing…" : "Add URLs and start outreach"}
        </button>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
          Step 4b — Or upload CSV
        </h2>
        <div className="form-group">
          <label>CSV file (must include a LinkedIn profile URL column)</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          onClick={importCsv}
          disabled={!file || importing || !campaigns[0]}
        >
          {importing ? "Importing…" : "Upload CSV and start outreach"}
        </button>
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <AuthGuard>
      <SetupContent />
    </AuthGuard>
  );
}
