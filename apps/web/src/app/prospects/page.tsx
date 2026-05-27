"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { TenantSelector, useTenant } from "@/components/TenantContext";
import { api, type ProspectRow } from "@/lib/api";

function ProspectsContent() {
  const { tenantId } = useTenant();
  const [prospects, setProspects] = useState<ProspectRow[]>([]);

  useEffect(() => {
    api.prospects(tenantId).then(setProspects).catch(console.error);
  }, [tenantId]);

  return (
    <main className="main">
      <h1 style={{ marginBottom: "1.5rem" }}>Prospects</h1>
      <TenantSelector />
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Stage</th>
              <th>Last message</th>
              <th>Profile</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr key={p.id}>
                <td>
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || "—"}
                </td>
                <td>
                  <span className="badge">{p.stage}</span>
                </td>
                <td style={{ maxWidth: 280, fontSize: "0.9rem" }}>
                  {p.messages[0]?.text?.slice(0, 80) ?? "—"}
                </td>
                <td>
                  <a href={p.linkedinUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                </td>
              </tr>
            ))}
            {prospects.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)" }}>
                  No prospects yet — upload a CSV in Setup.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function ProspectsPage() {
  return (
    <AuthGuard>
      <ProspectsContent />
    </AuthGuard>
  );
}
