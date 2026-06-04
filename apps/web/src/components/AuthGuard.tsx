"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type SessionUser } from "@/lib/api";
import { Nav } from "./Nav";
import { TenantProvider } from "./TenantContext";

async function loadSessionUser(): Promise<{
  user: SessionUser;
  authDisabled: boolean;
}> {
  try {
    const r = await api.me();
    return { user: r.user, authDisabled: Boolean(r.authDisabled) };
  } catch {
    const status = await api.authStatus().catch(() => null);
    if (!status?.authDisabled) throw new Error("Not signed in");
    const login = await api.login("", "");
    return {
      user: login.user,
      authDisabled: true,
    };
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSessionUser()
      .then(({ user: u, authDisabled: off }) => {
        setUser(u);
        setAuthDisabled(off);
        setError("");
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Could not load session";
        setError(msg);
        if (!msg.includes("Cannot reach the API")) {
          router.push("/login");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="main">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (error && error.includes("Cannot reach the API")) {
    return (
      <div className="main">
        <div className="alert">{error}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <TenantProvider user={user} authDisabled={authDisabled}>
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
