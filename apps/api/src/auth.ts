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

const sessions = new Map<string, SessionUser>();

export function createSession(user: SessionUser): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, user);
  return token;
}

export function getSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  return sessions.get(token) ?? null;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export async function authenticate(
  login: string,
  password: string
): Promise<SessionUser | null> {
  const id = login.trim();
  if (!id) return null;

  const user = id.includes("@")
    ? await prisma.user.findFirst({ where: { email: id } })
    : await prisma.user.findFirst({ where: { username: id } });

  if (!user?.username || !verifyPassword(password, user.passwordHash)) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };
}

export function requireAuth(request: FastifyRequest): SessionUser {
  const token = request.cookies.session;
  const user = getSession(token);
  if (!user) throw { statusCode: 401, message: "Unauthorized" };
  return user;
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
