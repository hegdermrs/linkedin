"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/api";
import { useTenant } from "./TenantContext";

export function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { tenantId, tenants } = useTenant();

  const campaignName =
    tenants.find((t) => t.id === tenantId)?.name ?? "Campaign";

  const links = [
    { href: "/setup", label: "Setup" },
    {
      href: tenantId
        ? `/admin/tenants/${tenantId}/accounts`
        : "/admin/tenants",
      label: "LinkedIn",
    },
    {
      href: tenantId
        ? `/admin/tenants/${tenantId}/playbook`
        : "/admin/tenants",
      label: "Playbook",
    },
    { href: "/settings", label: "Settings" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/prospects", label: "Prospects" },
    { href: "/admin/settings", label: "AI Settings" },
    { href: "/admin/tenants", label: "Clients" },
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
    </nav>
  );
}
