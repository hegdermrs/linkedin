"use client";

import { useEffect, useState } from "react";
import { api, type SessionUser } from "@/lib/api";
import { Nav } from "./Nav";
import { TenantProvider } from "./TenantContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .me()
      .then((r) => {
        setUser(r.user);
        setError("");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not reach the API");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="main">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main">
        <div className="alert">{error}</div>
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
          On Railway: set <code>API_URL</code> on the <strong>web</strong>{" "}
          service and ensure <strong>api</strong> is Online, then redeploy web.
        </p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <TenantProvider user={user}>
      <Nav user={user} />
      {children}
    </TenantProvider>
  );
}
