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

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
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
      <Nav user={user} />
      {children}
    </TenantProvider>
  );
}
