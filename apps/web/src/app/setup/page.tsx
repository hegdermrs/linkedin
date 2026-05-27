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
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.campaigns(tenantId).then(setCampaigns).catch(console.error);
  }, [tenantId]);

  async function importCsv() {
    if (!file || !campaigns[0]) return;
    setError("");
    setResult("");
    try {
      const r = await api.importCsv(campaigns[0].id, file);
      setResult(`Imported ${r.imported} prospects (${r.skipped} skipped).`);
      await api.orchestrate(tenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
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
            <Link href={linkedInHref}>Connect LinkedIn</Link> — click the
            button, sign in when the browser opens (takes about a minute).
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
            <strong>Upload prospects</strong> (below) — Sales Navigator CSV
            with LinkedIn profile URLs.
          </li>
          <li>
            <Link href="/dashboard">Start on dashboard</Link> — review metrics
            and pause/resume when ready.
          </li>
        </ol>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
          Step 4 — Upload prospect list
        </h2>
        {error && <div className="alert">{error}</div>}
        {result && <div className="alert success">{result}</div>}
        <div className="form-group">
          <label>CSV file (must include a LinkedIn profile URL column)</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button type="button" onClick={importCsv} disabled={!file}>
          Upload and start outreach
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
