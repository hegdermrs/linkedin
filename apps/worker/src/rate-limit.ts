import { prisma } from "@linkedin-agent/db";
import {
  canPerformAction,
  incrementCounter,
  resetCountersIfNeeded,
  type RateLimitAction,
} from "@linkedin-agent/linkedin";
import type { PlaybookConfig } from "@linkedin-agent/shared";

export async function checkRateLimit(
  linkedInAccountId: string,
  playbook: PlaybookConfig,
  action: RateLimitAction
): Promise<{ allowed: boolean; reason?: string }> {
  const account = await prisma.linkedInAccount.findUniqueOrThrow({
    where: { id: linkedInAccountId },
  });

  const counters = resetCountersIfNeeded({
    dailyConnections: account.dailyConnections,
    dailyMessages: account.dailyMessages,
    dailyProfileViews: account.dailyProfileViews,
    countersResetAt: account.countersResetAt,
  });

  const limits = {
    maxDailyConnections: playbook.guardrails.maxDailyConnections,
    maxDailyMessages: playbook.guardrails.maxDailyMessages,
    maxDailyProfileViews: playbook.guardrails.maxDailyProfileViews,
  };

  const result = canPerformAction(counters, limits, action);
  if (!result.allowed) {
    await prisma.linkedInAccount.update({
      where: { id: linkedInAccountId },
      data: { status: "rate_limited", lastError: result.reason },
    });
  }

  return result;
}

export async function recordRateLimitAction(
  linkedInAccountId: string,
  action: RateLimitAction
): Promise<void> {
  const account = await prisma.linkedInAccount.findUniqueOrThrow({
    where: { id: linkedInAccountId },
  });

  const counters = resetCountersIfNeeded({
    dailyConnections: account.dailyConnections,
    dailyMessages: account.dailyMessages,
    dailyProfileViews: account.dailyProfileViews,
    countersResetAt: account.countersResetAt,
  });

  const updated = incrementCounter(counters, action);

  await prisma.linkedInAccount.update({
    where: { id: linkedInAccountId },
    data: {
      dailyConnections: updated.dailyConnections,
      dailyMessages: updated.dailyMessages,
      dailyProfileViews: updated.dailyProfileViews,
      countersResetAt: updated.countersResetAt,
      status: "active",
    },
  });
}
