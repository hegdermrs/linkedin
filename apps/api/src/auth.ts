import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { prisma, UserRole } from "@linkedin-agent/db";
import { loadSession, removeSession, saveSession } from "./session-store.js";

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

export async function createSession(user: SessionUser): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await saveSession(token, user);
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await removeSession(token);
}

/** SameSite=None is required for cross-origin API calls; Lax works when web proxies /auth to api. */
export function sessionCookieOptions(request: FastifyRequest): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "none";
  maxAge: number;
} {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd;
  const webUrl = process.env.WEB_URL?.replace(/\/$/, "");
  const origin =
    typeof request.headers.origin === "string"
      ? request.headers.origin.replace(/\/$/, "")
      : undefined;
  const forwardedHost = request.headers["x-forwarded-host"];
  const webHost = webUrl
    ? (() => {
        try {
          return new URL(webUrl).host;
        } catch {
          return null;
        }
      })()
    : null;
  const proxied =
    typeof forwardedHost === "string" &&
    webHost &&
    forwardedHost.split(",")[0]?.trim() === webHost;
  const sameSite =
    proxied || (origin && webUrl && origin === webUrl)
      ? "lax"
      : isProd
        ? "none"
        : "lax";
  return {
    path: "/",
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function clearSessionCookieOptions(
  request: FastifyRequest
): Pick<
  ReturnType<typeof sessionCookieOptions>,
  "path" | "secure" | "sameSite"
> {
  const { path, secure, sameSite } = sessionCookieOptions(request);
  return { path, secure, sameSite };
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

export async function requireAuth(
  request: FastifyRequest
): Promise<SessionUser> {
  const token = request.cookies.session;
  const user = await loadSession(token);
  if (!user) {
    throw {
      statusCode: 401,
      message:
        "Unauthorized — sign in again (sessions are stored in Redis after api restarts).",
    };
  }
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
