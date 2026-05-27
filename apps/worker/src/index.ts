import { Worker } from "bullmq";
import { getRedisConnection } from "@linkedin-agent/shared";
import type { QueueJobName, QueueJobPayload } from "@linkedin-agent/shared";
import {
  orchestrateTenant,
  processAnalyzeProfile,
  processSendConnect,
  processCheckConnection,
  processSendMessage,
  processPollInbox,
} from "./orchestrator.js";

const worker = new Worker<QueueJobPayload, void, QueueJobName>(
  "outreach",
  async (job) => {
    const { tenantId, prospectId, linkedInAccountId, messageText } = job.data;

    switch (job.name) {
      case "orchestrate_tenant":
        await orchestrateTenant(tenantId);
        break;
      case "analyze_profile":
        if (!prospectId || !linkedInAccountId) throw new Error("Missing ids");
        await processAnalyzeProfile(prospectId, linkedInAccountId);
        break;
      case "send_connect":
        if (!prospectId || !linkedInAccountId) throw new Error("Missing ids");
        await processSendConnect(prospectId, linkedInAccountId);
        break;
      case "check_connection":
        if (!prospectId || !linkedInAccountId) throw new Error("Missing ids");
        await processCheckConnection(prospectId, linkedInAccountId);
        break;
      case "send_message":
        if (!prospectId || !linkedInAccountId) throw new Error("Missing ids");
        await processSendMessage(
          prospectId,
          linkedInAccountId,
          messageText
        );
        break;
      case "poll_inbox":
        if (!linkedInAccountId) throw new Error("Missing account");
        await processPollInbox(tenantId, linkedInAccountId, prospectId);
        break;
      default:
        console.warn(`Unknown job: ${job.name}`);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
    limiter: { max: 10, duration: 60_000 },
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.name} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.name} failed:`, err.message);
});

console.log("Worker started — listening on outreach queue");

setInterval(
  async () => {
    const { prisma } = await import("@linkedin-agent/db");
    const tenants = await prisma.tenant.findMany({
      where: { isPaused: false },
      select: { id: true },
    });
    const { enqueueJob } = await import("./queue.js");
    for (const t of tenants) {
      await enqueueJob("orchestrate_tenant", { tenantId: t.id });
    }
  },
  10 * 60 * 1000
);
