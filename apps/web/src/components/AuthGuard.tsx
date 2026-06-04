"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type SessionUser } from "@/lib/api";
import { Nav } from "./Nav";
import { TenantProvider } from "./TenantContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((r) => {
        setUser(r.user);
        setAuthDisabled(Boolean(r.authDisabled));
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="main">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <TenantProvider user={user}>
      {authDisabled && (
        <div
          className="alert"
          style={{ margin: "0 0 0", borderRadius: 0, textAlign: "center" }}
        >
          Login is off (DISABLE_AUTH on api). Turn it off before going public.
        </div>
      )}
      <Nav user={user} authDisabled={authDisabled} />
      {children}
    </TenantProvider>
  );
}
