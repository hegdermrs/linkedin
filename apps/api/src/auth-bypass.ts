import { prisma, UserRole } from "@linkedin-agent/db";
import type { SessionUser } from "./auth.js";

/** Temporary: set DISABLE_AUTH=true on api (and redeploy). Re-enable login for production. */
export function isAuthDisabled(): boolean {
  return process.env.DISABLE_AUTH === "true";
}

let cachedBypassUser: SessionUser | null = null;

export async function getBypassUser(): Promise<SessionUser> {
  if (cachedBypassUser) return cachedBypassUser;

  const admin = await prisma.user.findFirst({
    where: { role: UserRole.agency_admin },
    orderBy: { createdAt: "asc" },
  });

  if (admin?.username) {
    cachedBypassUser = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      tenantId: admin.tenantId,
    };
    return cachedBypassUser;
  }

  cachedBypassUser = {
    id: "bypass-admin",
    username: process.env.AGENCY_ADMIN_USERNAME ?? "admin",
    email: null,
    role: UserRole.agency_admin,
    tenantId: null,
  };
  return cachedBypassUser;
}
