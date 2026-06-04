"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, type SessionUser } from "@/lib/api";

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface TenantContextValue {
  user: SessionUser;
  tenantId: string;
  tenants: TenantOption[];
  setTenantId: (id: string) => void;
  isAgencyAdmin: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

const STORAGE_KEY = "selectedTenantId";

export function TenantProvider({
  user,
  children,
  authDisabled = false,
}: {
  user: SessionUser;
  children: React.ReactNode;
  authDisabled?: boolean;
}) {
  const [tenantId, setTenantIdState] = useState<string>("");
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  useEffect(() => {
    api.me().then((r) => {
      const list = r.tenants ?? [];
      setTenants(list);
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const pick =
        (stored && list.some((t) => t.id === stored) ? stored : null) ??
        r.effectiveTenantId ??
        user.tenantId ??
        list[0]?.id ??
        "";
      setTenantIdState(pick);
    });
  }, [user.tenantId]);

  const setTenantId = useCallback((id: string) => {
    setTenantIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  if (!tenantId) {
    if (tenants.length === 0 && user.role === "agency_admin") {
      return (
        <TenantContext.Provider
          value={{
            user,
            tenantId: "",
            tenants,
            setTenantId,
            isAgencyAdmin: true,
          }}
        >
          <div className="main">
            <div className="alert" style={{ marginBottom: "1rem" }}>
              No clients yet.{" "}
              <a href="/admin/tenants">Create a client</a> (name + slug), then
              return here.{" "}
              {authDisabled
                ? "Login is disabled on the api service."
                : null}
            </div>
          </div>
          {children}
        </TenantContext.Provider>
      );
    }
    return (
      <div className="main">
        <p style={{ color: "var(--muted)" }}>Loading client context…</p>
      </div>
    );
  }

  return (
    <TenantContext.Provider
      value={{
        user,
        tenantId,
        tenants,
        setTenantId,
        isAgencyAdmin: user.role === "agency_admin",
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

export function TenantSelector() {
  const { tenants, tenantId, setTenantId, isAgencyAdmin } = useTenant();
  if (!isAgencyAdmin || tenants.length <= 1) return null;

  return (
    <div className="form-group" style={{ marginBottom: "1rem", maxWidth: 320 }}>
      <label>Campaign</label>
      <select
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
