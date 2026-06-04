"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, type SessionUser } from "@/lib/api";
import { useTenant } from "./TenantContext";

export function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenantId, tenants } = useTenant();

  async function logout() {
    try {
      await api.logout();
    } catch {
      // Still redirect if session already cleared or API unreachable
    }
    router.push("/login");
  }

  const campaignName =
    tenants.find((t) => t.id === tenantId)?.name ?? "Campaign";

  // Setup-first order for agency admin
  const links = [
    { href: "/setup", label: "Setup" },
    {
      href: `/admin/tenants/${tenantId}/accounts`,
      label: "LinkedIn",
    },
    {
      href: `/admin/tenants/${tenantId}/playbook`,
      label: "Playbook",
    },
    { href: "/settings", label: "Settings" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/prospects", label: "Prospects" },
    { href: "/admin/settings", label: "AI Settings" },
  ];

  return (
    <nav className="nav">
      <span className="nav-brand">
        LinkedIn Outreach
        {tenants.length <= 1 && (
          <span
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 400,
              color: "var(--muted)",
            }}
          >
            {campaignName}
          </span>
        )}
      </span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            fontWeight: pathname.startsWith(l.href) ? 600 : 400,
            color: pathname.startsWith(l.href) ? "var(--text)" : "var(--muted)",
          }}
        >
          {l.label}
        </Link>
      ))}
      <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        {user.username}
      </span>
      <button type="button" className="secondary" onClick={logout}>
        Log out
      </button>
    </nav>
  );
}
