"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { api, type AgencySettings } from "@/lib/api";

function AdminSettingsContent() {
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.adminSettings().then(setSettings);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    await api.updateAdminSettings(settings);
    setSaved(true);
  }

  if (!settings) {
    return (
      <main className="main">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>AI settings</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Global LLM model and base prompt applied to every campaign.
      </p>
      <div className="card" style={{ maxWidth: 640 }}>
        {saved && <div className="alert success">Saved.</div>}
        <form onSubmit={save}>
          <div className="form-group">
            <label>Global base prompt (agency layer)</label>
            <textarea
              rows={6}
              value={settings.basePrompt}
              onChange={(e) =>
                setSettings({ ...settings, basePrompt: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>LLM provider</label>
            <select
              value={settings.llmProvider}
              onChange={(e) => {
                const llmProvider = e.target.value;
                const llmModel =
                  llmProvider === "deepseek"
                    ? "deepseek-chat"
                    : llmProvider === "openai"
                      ? "gpt-4o-mini"
                      : settings.llmModel;
                setSettings({ ...settings, llmProvider, llmModel });
              }}
            >
              <option value="deepseek">DeepSeek (recommended)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div className="form-group">
            <label>Model</label>
            <input
              value={settings.llmModel}
              placeholder="deepseek-chat"
              onChange={(e) =>
                setSettings({ ...settings, llmModel: e.target.value })
              }
            />
            {settings.llmProvider === "deepseek" && (
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.35rem" }}>
                Common: deepseek-chat, deepseek-reasoner
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Temperature</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={settings.temperature}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  temperature: parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label>Max tokens</label>
            <input
              type="number"
              value={settings.maxTokens}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxTokens: parseInt(e.target.value, 10),
                })
              }
            />
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Set <code>DEEPSEEK_API_KEY</code> on API and worker (Railway/local). OpenAI key is optional fallback.
          </p>
          <button type="submit">Save</button>
        </form>
      </div>
    </main>
  );
}

export default function AdminSettingsPage() {
  return (
    <AuthGuard>
      <AdminSettingsContent />
    </AuthGuard>
  );
}
