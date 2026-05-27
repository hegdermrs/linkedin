"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { TenantSelector, useTenant } from "@/components/TenantContext";
import { api } from "@/lib/api";

function SettingsContent() {
  const { tenantId } = useTenant();
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api.settings({ calendlyUrl, timezone, tenantId });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>Campaign settings</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Calendly and timezone for the active campaign (step 3 in Setup).
      </p>
      <TenantSelector />
      <div className="card" style={{ maxWidth: 480 }}>
        {saved && <div className="alert success">Saved.</div>}
        <form onSubmit={save}>
          <div className="form-group">
            <label>Calendly link (for call offers)</label>
            <input
              type="url"
              value={calendlyUrl}
              onChange={(e) => setCalendlyUrl(e.target.value)}
              placeholder="https://calendly.com/your-link"
            />
          </div>
          <div className="form-group">
            <label>Timezone (business hours)</label>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          <button type="submit">Save</button>
        </form>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
