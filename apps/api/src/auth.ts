import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { prisma, UserRole } from "@linkedin-agent/db";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
  } catch {
    return false;
  }
}

export interface SessionUser {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  tenantId: string | null;
}

let cachedAppUser: SessionUser | null = null;

/** Open app — no login. Uses first agency admin from DB (seed). */
export async function getAppUser(): Promise<SessionUser> {
  if (cachedAppUser) return cachedAppUser;

  const admin = await prisma.user.findFirst({
    where: { role: UserRole.agency_admin },
    orderBy: { createdAt: "asc" },
  });

  if (admin) {
    cachedAppUser = {
      id: admin.id,
      username: admin.username ?? process.env.AGENCY_ADMIN_USERNAME ?? "admin",
      email: admin.email,
      role: admin.role,
      tenantId: admin.tenantId,
    };
    return cachedAppUser;
  }

  cachedAppUser = {
    id: "app-admin",
    username: process.env.AGENCY_ADMIN_USERNAME ?? "admin",
    email: null,
    role: UserRole.agency_admin,
    tenantId: null,
  };
  return cachedAppUser;
}

export async function requireAuth(
  _request: FastifyRequest
): Promise<SessionUser> {
  return getAppUser();
}

export function requireAgencyAdmin(user: SessionUser): void {
  if (user.role !== UserRole.agency_admin) {
    throw { statusCode: 403, message: "Agency admin required" };
  }
}

export async function resolveTenantId(
  user: SessionUser,
  queryTenantId?: string
): Promise<string> {
  if (user.role === UserRole.agency_admin) {
    if (queryTenantId) return queryTenantId;
    const first = await prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!first) {
      throw {
        statusCode: 404,
        message: "No clients yet — create one under Admin → Clients",
      };
    }
    return first.id;
  }
  if (!user.tenantId) {
    throw {
      statusCode: 403,
      message:
        "No tenant assigned to your account — contact your agency admin",
    };
  }
  return user.tenantId;
}

export async function resolveEffectiveTenantId(
  user: SessionUser,
  queryTenantId?: string
): Promise<string | null> {
  try {
    return await resolveTenantId(user, queryTenantId);
  } catch (err) {
    if (user.role === UserRole.agency_admin) return null;
    throw err;
  }
}
