"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { PlaybookEditor } from "@/components/PlaybookEditor";
import { api } from "@/lib/api";
import type { PlaybookConfig } from "@linkedin-agent/shared";
import { PlaybookConfigSchema } from "@linkedin-agent/shared";

function PlaybookPageContent() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [config, setConfig] = useState<PlaybookConfig | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.playbook(tenantId).then((r) => {
      const raw =
        r.draft?.config ?? r.published?.config ?? {};
      setConfig(PlaybookConfigSchema.parse(raw));
    });
  }, [tenantId]);

  if (!config) {
    return (
      <main className="main">
        <p style={{ color: "var(--muted)" }}>Loading playbook…</p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>Playbook</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Step 2 in Setup — prompts and guardrails for each stage of the
        conversation. Publish when ready.
      </p>
      <div className="card" style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await api.applyPlaybookTemplate(tenantId, "jim-wrestlers");
            const r = await api.playbook(tenantId);
            setConfig(
              PlaybookConfigSchema.parse(
                r.draft?.config ?? r.published?.config ?? {}
              )
            );
            setBusy(false);
          }}
        >
          Load Jim — Wrestlers template
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await api.applyPlaybookTemplate(tenantId, "jim-athletes");
            const r = await api.playbook(tenantId);
            setConfig(
              PlaybookConfigSchema.parse(
                r.draft?.config ?? r.published?.config ?? {}
              )
            );
            setBusy(false);
          }}
        >
          Load Jim — Athletes template
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setInsights(null);
            try {
              const r = await api.analyzeConversations(tenantId);
              setInsights(
                `${r.summary}\n\nSuggestions:\n${r.suggestedChanges.map((s) => `• ${s}`).join("\n")}`
              );
            } catch (e) {
              setInsights(e instanceof Error ? e.message : "Analysis failed");
            }
            setBusy(false);
          }}
        >
          Analyze past conversations (AI)
        </button>
      </div>
      {insights && (
        <pre
          className="card"
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {insights}
        </pre>
      )}
      <PlaybookEditor
        initial={config}
        onSave={async (c) => {
          await api.savePlaybookDraft(tenantId, c);
        }}
        onPublish={async () => {
          await api.publishPlaybook(tenantId);
        }}
        onPreview={(c) => api.previewPlaybook(tenantId, c)}
      />
      <p style={{ marginTop: "1.5rem", fontSize: "0.9rem", color: "var(--muted)" }}>
        Jim voice is enforced via agency AI settings + playbook templates.{" "}
        <Link href="/admin/templates">View templates</Link>
      </p>
    </main>
  );
}

export default function AdminPlaybookPage() {
  return (
    <AuthGuard>
      <PlaybookPageContent />
    </AuthGuard>
  );
}
