"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { api, type AuditRow } from "@/lib/api";

function AuditContent() {
  const tenantId = useParams().tenantId as string;
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    api.audit(tenantId).then(setRows);
  }, [tenantId]);

  return (
    <main className="main">
      <h1 style={{ marginBottom: "1.5rem" }}>Audit log</h1>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.action}</td>
                <td style={{ fontSize: "0.85rem", maxWidth: 400 }}>
                  <code>{JSON.stringify(r.metadata).slice(0, 120)}</code>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted)" }}>
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function AdminAuditPage() {
  return (
    <AuthGuard>
      <AuditContent />
    </AuthGuard>
  );
}
