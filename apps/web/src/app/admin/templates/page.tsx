"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { useTenant } from "@/components/TenantContext";
import { api, type TemplateRow } from "@/lib/api";

function TemplatesContent() {
  const { tenantId } = useTenant();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  useEffect(() => {
    api.templates().then(setTemplates);
  }, []);

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>Message templates</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Starting playbooks by niche (e.g. wrestlers). Copy ideas into your{" "}
        <Link href={`/admin/tenants/${tenantId}/playbook`}>playbook</Link>.
      </p>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Niche</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <span className="badge">{t.niche}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          Add another campaign from Setup when you need a second niche or
          LinkedIn account.
        </p>
      </div>
    </main>
  );
}

export default function AdminTemplatesPage() {
  return (
    <AuthGuard>
      <TemplatesContent />
    </AuthGuard>
  );
}
