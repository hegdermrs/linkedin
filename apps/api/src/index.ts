import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { prisma, UserRole, PlaybookVersionStatus } from "@linkedin-agent/db";
import {
  PlaybookConfigSchema,
  ProfileSummarySchema,
} from "@linkedin-agent/shared";
import { DEFAULT_WRESTLER_PLAYBOOK } from "@linkedin-agent/agent";
import { previewReply, resolveLlmConfig } from "@linkedin-agent/agent";
import {
  authenticate,
  createSession,
  destroySession,
  requireAuth,
  requireAgencyAdmin,
  resolveTenantId,
  hashPassword,
} from "./auth.js";
import { enqueueJob, enqueueOrchestrateAll } from "./queue.js";
import { importProspectsCsv } from "./services/csv-import.js";
import { getAgencySettings, getPublishedPlaybook } from "./services/playbook.js";
import {
  getConnectJob,
  startBrowserConnect,
} from "./services/linkedin-connect.js";

const app = Fastify({ logger: true });
const PORT = parseInt(
  process.env.PORT ?? process.env.API_PORT ?? "3001",
  10
);

await app.register(cors, {
  origin: process.env.WEB_URL ?? "http://localhost:3000",
  credentials: true,
});
await app.register(cookie);
await app.register(multipart);

app.setErrorHandler((error, _request, reply) => {
  const err = error as { statusCode?: number; message?: string };
  const statusCode = err.statusCode ?? 500;
  const message =
    error instanceof Error
      ? error.message
      : typeof err.message === "string"
        ? err.message
        : "Internal error";
  reply.status(statusCode).send({ error: message });
});

app.get("/health", async () => ({ ok: true }));

app.post("/auth/login", async (request, reply) => {
  const body = request.body as { email?: string; password?: string };
  const user = await authenticate(body.email ?? "", body.password ?? "");
  if (!user) return reply.status(401).send({ error: "Invalid credentials" });
  const token = createSession(user);
  reply.setCookie("session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId } };
});

app.post("/auth/logout", async (request, reply) => {
  const token = request.cookies.session;
  if (token) destroySession(token);
  reply.clearCookie("session", { path: "/" });
  return { ok: true };
});

app.get("/auth/me", async (request) => {
  const user = requireAuth(request);
  const effectiveTenantId = await resolveTenantId(user);
  const tenants =
    user.role === UserRole.agency_admin
      ? await prisma.tenant.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        })
      : undefined;
  return { user, effectiveTenantId, tenants };
});

app.get("/admin/tenants", async (request) => {
  const user = requireAuth(request);
  requireAgencyAdmin(user);
  return prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { prospects: true, linkedInAccounts: true } },
      campaigns: { take: 1 },
    },
  });
});

app.post("/admin/tenants", async (request) => {
  const user = requireAuth(request);
  requireAgencyAdmin(user);
  const body = request.body as { name: string; slug: string };
  const tenant = await prisma.tenant.create({
    data: { name: body.name, slug: body.slug },
  });
  const campaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "Default Campaign",
      niche: "wrestlers",
    },
  });
  await prisma.playbookVersion.create({
    data: {
      campaignId: campaign.id,
      version: 1,
      status: PlaybookVersionStatus.published,
      label: "Initial",
      config: DEFAULT_WRESTLER_PLAYBOOK as object,
      publishedAt: new Date(),
    },
  });
  await prisma.linkedInAccount.create({
    data: { tenantId: tenant.id, label: "Primary LinkedIn" },
  });
  return tenant;
});

app.get("/admin/templates", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  return prisma.playbookTemplate.findMany();
});

app.get("/admin/settings", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const s = await getAgencySettings();
  return {
    basePrompt: s.basePrompt,
    llmProvider: s.llmProvider,
    llmModel: s.llmModel,
    temperature: s.temperature,
    maxTokens: s.maxTokens,
  };
});

app.put("/admin/settings", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const body = request.body as Record<string, unknown>;
  return prisma.agencySettings.update({
    where: { id: "singleton" },
    data: {
      basePrompt: body.basePrompt as string | undefined,
      llmProvider: body.llmProvider as string | undefined,
      llmModel: body.llmModel as string | undefined,
      temperature: body.temperature as number | undefined,
      maxTokens: body.maxTokens as number | undefined,
    },
  });
});

app.get("/admin/tenants/:tenantId/playbook", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const { tenantId } = request.params as { tenantId: string };
  const campaign = await prisma.campaign.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  if (!campaign) throw { statusCode: 404, message: "Campaign not found" };
  const draft = await prisma.playbookVersion.findFirst({
    where: { campaignId: campaign.id, status: "draft" },
    orderBy: { version: "desc" },
  });
  const published = await prisma.playbookVersion.findFirst({
    where: { campaignId: campaign.id, status: "published" },
    orderBy: { version: "desc" },
  });
  return { campaignId: campaign.id, draft, published };
});

app.put("/admin/tenants/:tenantId/playbook/draft", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const { tenantId } = request.params as { tenantId: string };
  const body = request.body as { config: unknown; label?: string };
  const config = PlaybookConfigSchema.parse(body.config);
  const campaign = await prisma.campaign.findFirstOrThrow({
    where: { tenantId },
  });
  const latest = await prisma.playbookVersion.findFirst({
    where: { campaignId: campaign.id },
    orderBy: { version: "desc" },
  });
  const draft = await prisma.playbookVersion.findFirst({
    where: { campaignId: campaign.id, status: "draft" },
  });
  if (draft) {
    return prisma.playbookVersion.update({
      where: { id: draft.id },
      data: { config: config as object, label: body.label },
    });
  }
  return prisma.playbookVersion.create({
    data: {
      campaignId: campaign.id,
      version: (latest?.version ?? 0) + 1,
      status: "draft",
      label: body.label ?? `Draft v${(latest?.version ?? 0) + 1}`,
      config: config as object,
    },
  });
});

app.post("/admin/tenants/:tenantId/playbook/publish", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const { tenantId } = request.params as { tenantId: string };
  const campaign = await prisma.campaign.findFirstOrThrow({
    where: { tenantId },
  });
  const draft = await prisma.playbookVersion.findFirstOrThrow({
    where: { campaignId: campaign.id, status: "draft" },
    orderBy: { version: "desc" },
  });
  return prisma.playbookVersion.update({
    where: { id: draft.id },
    data: { status: "published", publishedAt: new Date() },
  });
});

app.post("/admin/tenants/:tenantId/playbook/preview", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const body = request.body as { config?: unknown };
  const config = PlaybookConfigSchema.parse(
    body.config ?? DEFAULT_WRESTLER_PLAYBOOK
  );
  const agency = await getAgencySettings();
  const reply = await previewReply(
    resolveLlmConfig(agency),
    agency.basePrompt,
    config,
    ProfileSummarySchema.parse({
      hooks: ["wrestled at Penn State", "team captain"],
      tone: "casual",
      doNotMention: [],
      suggestedOpener: "Hey Alex, fellow wrestler here!",
      wrestlingAngle: "D1 wrestling experience",
    })
  );
  return reply;
});

app.get("/admin/tenants/:tenantId/accounts", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const { tenantId } = request.params as { tenantId: string };
  const accounts = await prisma.linkedInAccount.findMany({
    where: { tenantId },
  });
  return accounts.map((a) => ({
    ...a,
    isConnected: Boolean(a.sessionEncrypted),
  }));
});

app.put("/admin/tenants/:tenantId/accounts/:accountId/session", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const { accountId } = request.params as { accountId: string };
  const body = request.body as { sessionEncrypted: string };
  return prisma.linkedInAccount.update({
    where: { id: accountId },
    data: { sessionEncrypted: body.sessionEncrypted, status: "active", lastError: null },
  });
});

app.post(
  "/admin/tenants/:tenantId/accounts/:accountId/connect",
  async (request) => {
    requireAgencyAdmin(requireAuth(request));
    const { tenantId, accountId } = request.params as {
      tenantId: string;
      accountId: string;
    };
    const account = await prisma.linkedInAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw { statusCode: 404, message: "Account not found" };
    const job = startBrowserConnect(accountId);
    return job;
  }
);

app.get(
  "/admin/tenants/:tenantId/accounts/:accountId/connect",
  async (request) => {
    requireAgencyAdmin(requireAuth(request));
    const { accountId } = request.params as { accountId: string };
    const job = getConnectJob(accountId);
    const account = await prisma.linkedInAccount.findUnique({
      where: { id: accountId },
      select: { status: true, lastError: true },
    });
    return { job, account };
  }
);

app.get("/admin/tenants/:tenantId/audit", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  const { tenantId } = request.params as { tenantId: string };
  return prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
});

app.get("/dashboard/metrics", async (request) => {
  const user = requireAuth(request);
  const q = request.query as { tenantId?: string; campaignId?: string };
  const tenantId = await resolveTenantId(user, q.tenantId);

  const where = { tenantId, ...(q.campaignId ? { campaignId: q.campaignId } : {}) };

  const [
    total,
    connectSent,
    connected,
    conversing,
    callBooked,
    optedOut,
    account,
  ] = await Promise.all([
    prisma.prospect.count({ where: { tenantId } }),
    prisma.prospect.count({ where: { tenantId, stage: "connect_sent" } }),
    prisma.prospect.count({
      where: {
        tenantId,
        stage: { in: ["connected", "intro_sent", "conversing", "call_offered"] },
      },
    }),
    prisma.prospect.count({ where: { tenantId, stage: "conversing" } }),
    prisma.prospect.count({ where: { tenantId, stage: "call_booked" } }),
    prisma.prospect.count({ where: { tenantId, stage: "opted_out" } }),
    prisma.linkedInAccount.findFirst({ where: { tenantId } }),
  ]);

  const metrics = await prisma.metricDaily.findMany({
    where,
    orderBy: { date: "desc" },
    take: 30,
  });

  const acceptanceRate =
    connectSent > 0 ? Math.round((connected / (connectSent + connected)) * 100) : 0;

  return {
    total,
    connectSent,
    connected,
    conversing,
    callBooked,
    optedOut,
    acceptanceRate,
    accountStatus: account?.sessionEncrypted
      ? (account.status ?? "active")
      : "disconnected",
    linkedInConnected: Boolean(account?.sessionEncrypted),
    accountLabel: account?.label,
    lastError: account?.lastError,
    dailyMetrics: metrics,
    isPaused: (await prisma.tenant.findUnique({ where: { id: tenantId } }))?.isPaused,
  };
});

app.get("/prospects", async (request) => {
  const user = requireAuth(request);
  const q = request.query as { tenantId?: string; stage?: string; limit?: string };
  const tenantId = await resolveTenantId(user, q.tenantId);
  return prisma.prospect.findMany({
    where: {
      tenantId,
      ...(q.stage ? { stage: q.stage as never } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: parseInt(q.limit ?? "50", 10),
    include: {
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
      campaign: { select: { name: true, niche: true } },
    },
  });
});

app.get("/prospects/:id", async (request) => {
  const user = requireAuth(request);
  const { id } = request.params as { id: string };
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id },
    include: { messages: { orderBy: { sentAt: "asc" } }, campaign: true },
  });
  if (
    user.role !== UserRole.agency_admin &&
    prospect.tenantId !== user.tenantId
  ) {
    throw { statusCode: 403, message: "Forbidden" };
  }
  return prospect;
});

app.post("/campaigns/:campaignId/import", async (request) => {
  const user = requireAuth(request);
  const { campaignId } = request.params as { campaignId: string };
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
  });
  if (
    user.role !== UserRole.agency_admin &&
    campaign.tenantId !== user.tenantId
  ) {
    throw { statusCode: 403, message: "Forbidden" };
  }
  const data = await request.file();
  if (!data) throw { statusCode: 400, message: "CSV file required" };
  const buffer = await data.toBuffer();
  const account = await prisma.linkedInAccount.findFirst({
    where: { tenantId: campaign.tenantId },
  });
  const result = await importProspectsCsv(
    campaign.tenantId,
    campaignId,
    account?.id ?? null,
    buffer.toString("utf8")
  );
  await enqueueJob("orchestrate_tenant", { tenantId: campaign.tenantId });
  return result;
});

app.get("/campaigns", async (request) => {
  const user = requireAuth(request);
  const q = request.query as { tenantId?: string };
  const tenantId = await resolveTenantId(user, q.tenantId);
  return prisma.campaign.findMany({ where: { tenantId } });
});

app.post("/tenant/pause", async (request) => {
  const user = requireAuth(request);
  const body = request.body as { paused: boolean; tenantId?: string };
  const tenantId = await resolveTenantId(user, body.tenantId);
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { isPaused: body.paused },
  });
});

app.put("/tenant/settings", async (request) => {
  const user = requireAuth(request);
  const body = request.body as {
    calendlyUrl?: string;
    timezone?: string;
    tenantId?: string;
  };
  const tenantId = await resolveTenantId(user, body.tenantId);
  const campaign = await prisma.campaign.findFirstOrThrow({
    where: { tenantId },
  });
  const published = await prisma.playbookVersion.findFirst({
    where: { campaignId: campaign.id, status: "published" },
    orderBy: { version: "desc" },
  });
  if (!published) throw { statusCode: 404, message: "No published playbook" };
  const config = PlaybookConfigSchema.parse(published.config);
  if (body.calendlyUrl !== undefined) {
    config.stages.call_offered.calendlyUrl = body.calendlyUrl;
  }
  await prisma.playbookVersion.update({
    where: { id: published.id },
    data: { config: config as object },
  });
  if (body.timezone) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { timezone: body.timezone },
    });
  }
  return { ok: true };
});

app.post("/orchestrate", async (request) => {
  const user = requireAuth(request);
  const body = request.body as { tenantId?: string };
  const tenantId = await resolveTenantId(user, body.tenantId);
  await enqueueJob("orchestrate_tenant", { tenantId });
  return { queued: true };
});

app.post("/webhooks/calendly", async (request) => {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (secret) {
    const sig = request.headers["calendly-webhook-signature"];
    if (sig !== secret) {
      throw { statusCode: 401, message: "Invalid webhook signature" };
    }
  }
  const payload = request.body as {
    event?: string;
    payload?: {
      email?: string;
      name?: string;
      scheduled_event?: { uri?: string };
    };
  };
  if (payload.event !== "invitee.created") return { ok: true };

  const email = payload.payload?.email;
  const name = payload.payload?.name ?? "";
  const [firstName] = name.split(" ");

  const prospect = email
    ? await prisma.prospect.findFirst({
        where: {
          OR: [
            { firstName: { contains: firstName, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  if (prospect) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        stage: "call_booked",
        calendlyBookedAt: new Date(),
        nextActionAt: new Date("2099-01-01"),
      },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: prospect.tenantId,
        action: "call_booked",
        entity: "prospect",
        entityId: prospect.id,
        metadata: payload,
      },
    });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.metricDaily.upsert({
      where: {
        tenantId_campaignId_date: {
          tenantId: prospect.tenantId,
          campaignId: prospect.campaignId,
          date: today,
        },
      },
      create: {
        tenantId: prospect.tenantId,
        campaignId: prospect.campaignId,
        date: today,
        callsBooked: 1,
      },
      update: { callsBooked: { increment: 1 } },
    });
  }

  return { ok: true };
});

app.post("/admin/cron/trigger-all", async (request) => {
  requireAgencyAdmin(requireAuth(request));
  await enqueueOrchestrateAll();
  return { ok: true };
});

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`API listening on http://localhost:${PORT}`);
});
