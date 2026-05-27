export interface RateLimitCounters {
  dailyConnections: number;
  dailyMessages: number;
  dailyProfileViews: number;
  countersResetAt: Date;
}

export interface RateLimits {
  maxDailyConnections: number;
  maxDailyMessages: number;
  maxDailyProfileViews: number;
}

export type RateLimitAction = "connection" | "message" | "profile_view";

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function resetCountersIfNeeded(
  counters: RateLimitCounters,
  now = new Date()
): RateLimitCounters {
  if (isSameDay(counters.countersResetAt, now)) return counters;
  return {
    dailyConnections: 0,
    dailyMessages: 0,
    dailyProfileViews: 0,
    countersResetAt: now,
  };
}

export function canPerformAction(
  counters: RateLimitCounters,
  limits: RateLimits,
  action: RateLimitAction
): { allowed: boolean; reason?: string } {
  const c = resetCountersIfNeeded(counters);
  switch (action) {
    case "connection":
      if (c.dailyConnections >= limits.maxDailyConnections) {
        return { allowed: false, reason: "Daily connection limit reached" };
      }
      break;
    case "message":
      if (c.dailyMessages >= limits.maxDailyMessages) {
        return { allowed: false, reason: "Daily message limit reached" };
      }
      break;
    case "profile_view":
      if (c.dailyProfileViews >= limits.maxDailyProfileViews) {
        return { allowed: false, reason: "Daily profile view limit reached" };
      }
      break;
  }
  return { allowed: true };
}

export function incrementCounter(
  counters: RateLimitCounters,
  action: RateLimitAction
): RateLimitCounters {
  const c = resetCountersIfNeeded(counters);
  switch (action) {
    case "connection":
      return { ...c, dailyConnections: c.dailyConnections + 1 };
    case "message":
      return { ...c, dailyMessages: c.dailyMessages + 1 };
    case "profile_view":
      return { ...c, dailyProfileViews: c.dailyProfileViews + 1 };
  }
}

export function randomDelayMs(minSec = 30, maxSec = 120): number {
  const min = minSec * 1000;
  const max = maxSec * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function humanDelay(minSec = 30, maxSec = 120): Promise<void> {
  await new Promise((r) => setTimeout(r, randomDelayMs(minSec, maxSec)));
}
