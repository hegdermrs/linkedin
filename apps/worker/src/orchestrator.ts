import {
  prisma,
  ProspectStage,
  MessageDirection,
} from "@linkedin-agent/db";
import {
  PlaybookConfigSchema,
  ProfileSummarySchema,
  type PlaybookConfig,
} from "@linkedin-agent/shared";
import {
  generateReply,
  summarizeProfile,
  isWithinBusinessHours,
  resolveLlmConfig,
} from "@linkedin-agent/agent";
import { enqueueJob } from "./queue.js";
import { checkRateLimit, recordRateLimitAction } from "./rate-limit.js";

async function getLlmConfig() {
  const agency = await prisma.agencySettings.findUniqueOrThrow({
    where: { id: "singleton" },
  });
  return resolveLlmConfig(agency);
}

async function getPlaybook(campaignId: string): Promise<PlaybookConfig> {
  const version = await prisma.playbookVersion.findFirstOrThrow({
    where: { campaignId, status: "published" },
    orderBy: { version: "desc" },
  });
  return PlaybookConfigSchema.parse(version.config);
}

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

export async function orchestrateTenant(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || tenant.isPaused) return;

  const account = await prisma.linkedInAccount.findFirst({
    where: { tenantId, status: { in: ["active", "rate_limited"] } },
  });
  if (!account?.sessionEncrypted) return;

  const prospects = await prisma.prospect.findMany({
    where: {
      tenantId,
      nextActionAt: { lte: new Date() },
      stage: {
        notIn: ["connect_ignored", "opted_out", "call_booked"],
      },
    },
    take: 20,
    orderBy: { nextActionAt: "asc" },
    include: { campaign: true, messages: { orderBy: { sentAt: "asc" } } },
  });

  for (const prospect of prospects) {
    const playbook = await getPlaybook(prospect.campaignId);
    if (!isWithinBusinessHours(playbook, tenant.timezone)) continue;

    switch (prospect.stage) {
      case ProspectStage.imported:
        await enqueueJob("analyze_profile", {
          tenantId,
          prospectId: prospect.id,
          linkedInAccountId: account.id,
        });
        break;
      case ProspectStage.profile_analyzed:
        await enqueueJob("send_connect", {
          tenantId,
          prospectId: prospect.id,
          linkedInAccountId: account.id,
        });
        break;
      case ProspectStage.connect_sent:
        await enqueueJob("check_connection", {
          tenantId,
          prospectId: prospect.id,
          linkedInAccountId: account.id,
        });
        break;
      case ProspectStage.connected:
        await enqueueJob("send_message", {
          tenantId,
          prospectId: prospect.id,
          linkedInAccountId: account.id,
        });
        break;
      case ProspectStage.intro_sent:
      case ProspectStage.conversing:
      case ProspectStage.call_offered:
        await enqueueJob("poll_inbox", {
          tenantId,
          prospectId: prospect.id,
          linkedInAccountId: account.id,
        });
        break;
      default:
        break;
    }
  }

  await enqueueJob("poll_inbox", {
    tenantId,
    linkedInAccountId: account.id,
  });
}

export async function processAnalyzeProfile(
  prospectId: string,
  linkedInAccountId: string
): Promise<void> {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
    include: { campaign: true },
  });
  const playbook = await getPlaybook(prospect.campaignId);
  const agency = await prisma.agencySettings.findUniqueOrThrow({
    where: { id: "singleton" },
  });

  const { LinkedInClient } = await import("@linkedin-agent/linkedin");
  const account = await prisma.linkedInAccount.findUniqueOrThrow({
    where: { id: linkedInAccountId },
  });

  const client = new LinkedInClient(account.sessionEncrypted);
  try {
    const rate = await checkRateLimit(linkedInAccountId, playbook, "profile_view");
    if (!rate.allowed) return;

    await client.init();
    const scraped = await client.scrapeProfile(prospect.linkedinUrl);
    const llm = await getLlmConfig();
    const summary = await summarizeProfile(
      llm,
      agency.basePrompt,
      playbook,
      scraped
    );

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        stage: ProspectStage.profile_analyzed,
        profileSummary: summary,
        profileFetchedAt: new Date(),
        firstName: scraped.firstName ?? prospect.firstName,
        lastName: scraped.lastName ?? prospect.lastName,
        headline: scraped.headline ?? prospect.headline,
        school: prospect.school,
        nextActionAt: new Date(),
      },
    });

    await audit(prospect.tenantId, "profile_analyzed", prospectId, { summary });
    await recordRateLimitAction(linkedInAccountId, "profile_view");
  } catch (e) {
    await handleLinkedInError(linkedInAccountId, e);
  } finally {
    await client.close();
  }
}

export async function processSendConnect(
  prospectId: string,
  linkedInAccountId: string
): Promise<void> {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
  });
  const playbook = await getPlaybook(prospect.campaignId);
  const agency = await prisma.agencySettings.findUniqueOrThrow({
    where: { id: "singleton" },
  });
  const summary = prospect.profileSummary
    ? ProfileSummarySchema.safeParse(prospect.profileSummary).data
    : null;

  const llm = await getLlmConfig();
  const reply = await generateReply(llm, {
    agencyBasePrompt: agency.basePrompt,
    playbook,
    stage: "profile_analyzed",
    profileSummary: summary,
    messages: [],
    prospect,
    outboundCount: prospect.outboundCount,
    hasCalendlyInThread: false,
  });

  if (reply.guardrailBlocked || !reply.messageText) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { nextActionAt: hoursFromNow(playbook.guardrails.minDelayHours) },
    });
    return;
  }

  const idempotencyKey = `connect-${prospectId}`;
  const existing = await prisma.message.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return;

  const { LinkedInClient } = await import("@linkedin-agent/linkedin");
  const account = await prisma.linkedInAccount.findUniqueOrThrow({
    where: { id: linkedInAccountId },
  });
  const client = new LinkedInClient(account.sessionEncrypted);

  try {
    const rate = await checkRateLimit(linkedInAccountId, playbook, "connection");
    if (!rate.allowed) return;

    await client.init();
    await client.sendConnectionRequest(prospect.linkedinUrl, reply.messageText);

    await prisma.$transaction([
      prisma.message.create({
        data: {
          prospectId,
          direction: MessageDirection.outbound,
          text: reply.messageText,
          idempotencyKey,
          aiReasoning: reply.reasoning,
        },
      }),
      prisma.prospect.update({
        where: { id: prospectId },
        data: {
          stage: ProspectStage.connect_sent,
          outboundCount: { increment: 1 },
          nextActionAt: hoursFromNow(48),
        },
      }),
    ]);

    await incrementMetric(prospect.tenantId, prospect.campaignId, "connectsSent");
    await recordRateLimitAction(linkedInAccountId, "connection");
    await audit(prospect.tenantId, "connect_sent", prospectId, { reply });
  } catch (e) {
    await handleLinkedInError(linkedInAccountId, e);
  } finally {
    await client.close();
  }
}

export async function processCheckConnection(
  prospectId: string,
  linkedInAccountId: string
): Promise<void> {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
  });
  const playbook = await getPlaybook(prospect.campaignId);
  const { LinkedInClient } = await import("@linkedin-agent/linkedin");
  const account = await prisma.linkedInAccount.findUniqueOrThrow({
    where: { id: linkedInAccountId },
  });
  const client = new LinkedInClient(account.sessionEncrypted);

  try {
    await client.init();
    const status = await client.getConnectionStatus(prospect.linkedinUrl);

    if (status === "connected") {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          stage: ProspectStage.connected,
          nextActionAt: new Date(),
        },
      });
      await incrementMetric(
        prospect.tenantId,
        prospect.campaignId,
        "connectsAccepted"
      );
    } else if (status === "pending") {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { nextActionAt: hoursFromNow(24) },
      });
    } else {
      const created = prospect.createdAt;
      const days = (Date.now() - created.getTime()) / (86400000);
      if (days > 14) {
        await prisma.prospect.update({
          where: { id: prospectId },
          data: { stage: ProspectStage.connect_ignored },
        });
      } else {
        await prisma.prospect.update({
          where: { id: prospectId },
          data: { nextActionAt: hoursFromNow(48) },
        });
      }
    }
  } catch (e) {
    await handleLinkedInError(linkedInAccountId, e);
  } finally {
    await client.close();
  }
}

export async function processSendMessage(
  prospectId: string,
  linkedInAccountId: string,
  messageText?: string
): Promise<void> {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  const playbook = await getPlaybook(prospect.campaignId);
  const agency = await prisma.agencySettings.findUniqueOrThrow({
    where: { id: "singleton" },
  });

  let text = messageText;
  let nextStage = prospect.stage;
  let reasoning = "";

  if (!text) {
    const summary = prospect.profileSummary
      ? ProfileSummarySchema.safeParse(prospect.profileSummary).data
      : null;
    const calendlyUrl = playbook.stages.call_offered.calendlyUrl ?? "";
    const hasCalendlyInThread = prospect.messages.some(
      (m) => m.direction === "outbound" && m.text.includes(calendlyUrl) && calendlyUrl
    );

    const llm = await getLlmConfig();
    const reply = await generateReply(llm, {
      agencyBasePrompt: agency.basePrompt,
      playbook,
      stage: prospect.stage as never,
      profileSummary: summary,
      messages: prospect.messages.map((m) => ({
        direction: m.direction,
        text: m.text,
        sentAt: m.sentAt.toISOString(),
      })),
      prospect,
      outboundCount: prospect.outboundCount,
      hasCalendlyInThread,
    });

    if (reply.guardrailBlocked || reply.nextStage === "opted_out") {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          stage:
            reply.nextStage === "opted_out"
              ? ProspectStage.opted_out
              : prospect.stage,
          nextActionAt: hoursFromNow(playbook.guardrails.maxDelayHours),
        },
      });
      return;
    }

    text = reply.messageText;
    nextStage = reply.nextStage as ProspectStage;
    reasoning = reply.reasoning;
  }

  if (!text) return;

  const idempotencyKey = `msg-${prospectId}-${prospect.outboundCount + 1}`;
  const existing = await prisma.message.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return;

  const { LinkedInClient } = await import("@linkedin-agent/linkedin");
  const account = await prisma.linkedInAccount.findUniqueOrThrow({
    where: { id: linkedInAccountId },
  });
  const client = new LinkedInClient(account.sessionEncrypted);

  try {
    const rate = await checkRateLimit(linkedInAccountId, playbook, "message");
    if (!rate.allowed) return;

    await client.init();
    await client.sendMessage(prospect.linkedinUrl, text);

    const stageAfter =
      prospect.stage === ProspectStage.connected
        ? ProspectStage.intro_sent
        : (nextStage as ProspectStage);

    await prisma.$transaction([
      prisma.message.create({
        data: {
          prospectId,
          direction: MessageDirection.outbound,
          text,
          idempotencyKey,
          aiReasoning: reasoning || undefined,
        },
      }),
      prisma.prospect.update({
        where: { id: prospectId },
        data: {
          stage: stageAfter,
          outboundCount: { increment: 1 },
          nextActionAt: hoursFromNow(playbook.guardrails.minDelayHours),
        },
      }),
    ]);

    if (stageAfter === ProspectStage.intro_sent) {
      await incrementMetric(prospect.tenantId, prospect.campaignId, "introsSent");
    }
    if (stageAfter === ProspectStage.call_offered) {
      await incrementMetric(prospect.tenantId, prospect.campaignId, "callsOffered");
    }

    await recordRateLimitAction(linkedInAccountId, "message");
    await audit(prospect.tenantId, "message_sent", prospectId, { stageAfter });
  } catch (e) {
    await handleLinkedInError(linkedInAccountId, e);
  } finally {
    await client.close();
  }
}

export async function processPollInbox(
  tenantId: string,
  linkedInAccountId: string,
  prospectId?: string
): Promise<void> {
  const account = await prisma.linkedInAccount.findUniqueOrThrow({
    where: { id: linkedInAccountId },
  });
  const { LinkedInClient } = await import("@linkedin-agent/linkedin");
  const client = new LinkedInClient(account.sessionEncrypted);

  try {
    await client.init();

    if (prospectId) {
      const prospect = await prisma.prospect.findUniqueOrThrow({
        where: { id: prospectId },
        include: { messages: true },
      });
      const thread = await client.getThreadMessages(prospect.linkedinUrl);
      const known = new Set(prospect.messages.map((m) => m.text));

      for (const msg of thread) {
        if (msg.direction === "inbound" && !known.has(msg.text)) {
          await prisma.message.create({
            data: {
              prospectId,
              direction: MessageDirection.inbound,
              text: msg.text,
            },
          });
          await prisma.prospect.update({
            where: { id: prospectId },
            data: {
              stage: ProspectStage.conversing,
              lastInboundAt: new Date(),
              nextActionAt: new Date(),
            },
          });
          await incrementMetric(
            prospect.tenantId,
            prospect.campaignId,
            "repliesReceived"
          );
          await enqueueJob("send_message", {
            tenantId,
            prospectId,
            linkedInAccountId,
          });
        }
      }
      return;
    }

    const unread = await client.listUnreadConversations();
    for (const convo of unread) {
      const prospect = await prisma.prospect.findFirst({
        where: {
          tenantId,
          linkedinUrl: { contains: convo.profileUrl.split("/in/")[1]?.split("/")[0] ?? "___" },
        },
      });
      if (prospect) {
        await enqueueJob("poll_inbox", {
          tenantId,
          prospectId: prospect.id,
          linkedInAccountId,
        });
      }
    }
  } catch (e) {
    await handleLinkedInError(linkedInAccountId, e);
  } finally {
    await client.close();
  }
}

async function handleLinkedInError(
  linkedInAccountId: string,
  error: unknown
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  const status =
    msg.includes("SECURITY_CHALLENGE") || msg.includes("captcha")
      ? "needs_human"
      : msg.includes("limit")
        ? "rate_limited"
        : "active";

  await prisma.linkedInAccount.update({
    where: { id: linkedInAccountId },
    data: { status, lastError: msg },
  });
}

async function incrementMetric(
  tenantId: string,
  campaignId: string,
  field:
    | "connectsSent"
    | "connectsAccepted"
    | "introsSent"
    | "repliesReceived"
    | "callsOffered"
    | "profileViews"
): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.metricDaily.upsert({
    where: {
      tenantId_campaignId_date: { tenantId, campaignId, date: today },
    },
    create: { tenantId, campaignId, date: today, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

async function audit(
  tenantId: string,
  action: string,
  entityId: string,
  metadata: unknown
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId,
      action,
      entity: "prospect",
      entityId,
      metadata: metadata as object,
    },
  });
}
