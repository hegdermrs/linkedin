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
        Clone from a niche template:{" "}
        <Link href="/admin/templates">message templates</Link>
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
