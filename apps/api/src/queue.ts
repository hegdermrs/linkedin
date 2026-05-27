import { Queue } from "bullmq";
import { getRedisConnection } from "@linkedin-agent/shared";
import type { QueueJobName, QueueJobPayload } from "@linkedin-agent/shared";

export const outreachQueue = new Queue<QueueJobPayload, void, QueueJobName>(
  "outreach",
  { connection: getRedisConnection() }
);

export async function enqueueJob(
  name: QueueJobName,
  data: QueueJobPayload,
  opts?: { delay?: number }
): Promise<void> {
  await outreachQueue.add(name, data, {
    delay: opts?.delay,
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

export async function enqueueOrchestrateAll(): Promise<void> {
  const { prisma } = await import("@linkedin-agent/db");
  const tenants = await prisma.tenant.findMany({
    where: { isPaused: false },
    select: { id: true },
  });
  for (const t of tenants) {
    await enqueueJob("orchestrate_tenant", { tenantId: t.id });
  }
}
