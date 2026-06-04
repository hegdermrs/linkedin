import { Redis } from "ioredis";
import type { SessionUser } from "./auth.js";

const SESSION_PREFIX = "session:";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7;

const memory = new Map<string, SessionUser>();

let redis: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redis) {
    redis = new Redis(url, { maxRetriesPerRequest: 3 });
    redis.on("error", (err) => {
      console.error("[session-store] Redis error:", err.message);
    });
  }
  return redis;
}

export async function saveSession(
  token: string,
  user: SessionUser
): Promise<void> {
  memory.set(token, user);
  const r = getRedis();
  if (r) {
    await r.set(
      `${SESSION_PREFIX}${token}`,
      JSON.stringify(user),
      "EX",
      SESSION_TTL_SEC
    );
  }
}

export async function loadSession(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;

  const cached = memory.get(token);
  if (cached) return cached;

  const r = getRedis();
  if (!r) return null;

  try {
    const raw = await r.get(`${SESSION_PREFIX}${token}`);
    if (!raw) return null;
    const user = JSON.parse(raw) as SessionUser;
    memory.set(token, user);
    return user;
  } catch (err) {
    console.error("[session-store] load failed:", err);
    return null;
  }
}

export async function removeSession(token: string): Promise<void> {
  memory.delete(token);
  const r = getRedis();
  if (r) {
    await r.del(`${SESSION_PREFIX}${token}`);
  }
}
