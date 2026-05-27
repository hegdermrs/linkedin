"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { api, type TenantRow } from "@/lib/api";
import { useState } from "react";

function TenantsContent() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [checked, setChecked] = useState(false);

  async function load() {
    const list = await api.tenants();
    setTenants(list);
    setChecked(true);
    if (list.length === 1) {
      router.replace(`/admin/tenants/${list[0]!.id}/playbook`);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.createTenant(name, slug);
    setName("");
    setSlug("");
    await load();
  }

  if (!checked) {
    return (
      <main className="main">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>Campaigns</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Add a separate campaign when you run outreach for a new niche or
        LinkedIn account.
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>New campaign</h2>
        <form
          onSubmit={create}
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
        >
          <input
            placeholder="Name (e.g. Wrestlers Q2)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: 1, minWidth: 140 }}
          />
          <input
            placeholder="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            style={{ flex: 1, minWidth: 140 }}
          />
          <button type="submit">Create</button>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prospects</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t._count.prospects}</td>
                <td>
                  <Link href={`/admin/tenants/${t.id}/playbook`}>Playbook</Link>
                  {" · "}
                  <Link href={`/admin/tenants/${t.id}/accounts`}>LinkedIn</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function AdminTenantsPage() {
  return (
    <AuthGuard>
      <TenantsContent />
    </AuthGuard>
  );
}
