/**
 * Browser calls /api/proxy/* (Node route handler → Fastify). Do not use
 * NEXT_PUBLIC_API_URL in the browser (breaks cookies in Chrome).
 */
function getApiBase(): string {
  if (typeof window !== "undefined") return "/api/proxy";
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return process.env.API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export interface SessionUser {
  id: string;
  username: string;
  email: string | null;
  role: "agency_admin" | "client_owner" | "client_viewer";
  tenantId: string | null;
}

function buildHeaders(options: RequestInit): HeadersInit {
  const headers = new Headers(options.headers);
  if (options.body instanceof FormData) {
    return headers;
  }
  const hasBody =
    options.body !== undefined &&
    options.body !== null &&
    options.body !== "";
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiBase = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      ...options,
      credentials: "include",
      headers: buildHeaders(options),
    });
  } catch (e) {
    const hint =
      "Cannot reach the API. On Railway: set API_URL (and optional API_FALLBACK_URL) on the **web** service, ensure **api** is Online, redeploy **web**, then try again.";
    if (e instanceof TypeError && e.message === "Failed to fetch") {
      throw new Error(hint);
    }
    throw new Error(e instanceof Error ? e.message : hint);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = res.statusText;
    if (text) {
      try {
        const err = JSON.parse(text) as { error?: string };
        message = err.error ?? message;
      } catch {
        message = text;
      }
    }
    throw new Error(message || "Request failed");
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export const api = {
  login: (username: string, password: string) =>
    fetchApi<{ user: SessionUser; authDisabled?: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    fetchApi<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: "{}",
    }),
  authStatus: () => fetchApi<{ authDisabled: boolean }>("/auth/status"),
  me: () =>
    fetchApi<{
      user: SessionUser;
      effectiveTenantId: string;
      tenants?: { id: string; name: string; slug: string }[];
      authDisabled?: boolean;
    }>("/auth/me"),
  metrics: (tenantId?: string) =>
    fetchApi<MetricsResponse>(
      `/dashboard/metrics${tenantId ? `?tenantId=${tenantId}` : ""}`
    ),
  prospects: (tenantId?: string) =>
    fetchApi<ProspectRow[]>(
      `/prospects${tenantId ? `?tenantId=${tenantId}` : ""}`
    ),
  campaigns: (tenantId?: string) =>
    fetchApi<Campaign[]>(
      `/campaigns${tenantId ? `?tenantId=${tenantId}` : ""}`
    ),
  pause: (paused: boolean, tenantId?: string) =>
    fetchApi<unknown>("/tenant/pause", {
      method: "POST",
      body: JSON.stringify({ paused, tenantId }),
    }),
  settings: (data: { calendlyUrl?: string; timezone?: string; tenantId?: string }) =>
    fetchApi<{ ok: boolean }>("/tenant/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  importCsv: (campaignId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetchApi<{ imported: number; skipped: number }>(
      `/campaigns/${campaignId}/import`,
      { method: "POST", body: form }
    );
  },
  importUrls: (campaignId: string, urls: string) =>
    fetchApi<{ imported: number; skipped: number }>(
      `/campaigns/${campaignId}/import-urls`,
      {
        method: "POST",
        body: JSON.stringify({ urls }),
      }
    ),
  orchestrate: (tenantId?: string) =>
    fetchApi<{ queued: boolean }>("/orchestrate", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    }),
  tenants: () => fetchApi<TenantRow[]>("/admin/tenants"),
  createTenant: (name: string, slug: string) =>
    fetchApi<TenantRow>("/admin/tenants", {
      method: "POST",
      body: JSON.stringify({ name, slug }),
    }),
  playbook: (tenantId: string) =>
    fetchApi<PlaybookResponse>(`/admin/tenants/${tenantId}/playbook`),
  savePlaybookDraft: (tenantId: string, config: unknown, label?: string) =>
    fetchApi<unknown>(`/admin/tenants/${tenantId}/playbook/draft`, {
      method: "PUT",
      body: JSON.stringify({ config, label }),
    }),
  publishPlaybook: (tenantId: string) =>
    fetchApi<unknown>(`/admin/tenants/${tenantId}/playbook/publish`, {
      method: "POST",
      body: "{}",
    }),
  applyPlaybookTemplate: (tenantId: string, niche: string) =>
    fetchApi<unknown>(`/admin/tenants/${tenantId}/playbook/apply-template`, {
      method: "POST",
      body: JSON.stringify({ niche }),
    }),
  analyzeConversations: (tenantId: string) =>
    fetchApi<{
      summary: string;
      suggestedChanges: string[];
      strengths: string[];
      risks: string[];
    }>(`/admin/tenants/${tenantId}/playbook/analyze-conversations`, {
      method: "POST",
      body: "{}",
    }),
  previewPlaybook: (tenantId: string, config: unknown) =>
    fetchApi<{ messageText: string; nextStage: string; reasoning: string }>(
      `/admin/tenants/${tenantId}/playbook/preview`,
      { method: "POST", body: JSON.stringify({ config }) }
    ),
  adminSettings: () => fetchApi<AgencySettings>("/admin/settings"),
  updateAdminSettings: (data: Partial<AgencySettings>) =>
    fetchApi<AgencySettings>("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  linkedInAccounts: (tenantId: string) =>
    fetchApi<{
      sessionKeyFingerprint: string;
      accounts: LinkedInAccountRow[];
    }>(`/admin/tenants/${tenantId}/accounts`),
  saveSession: (tenantId: string, accountId: string, sessionEncrypted: string) =>
    fetchApi<unknown>(
      `/admin/tenants/${tenantId}/accounts/${accountId}/session`,
      {
        method: "PUT",
        body: JSON.stringify({ sessionEncrypted }),
      }
    ),
  startConnect: (tenantId: string, accountId: string) =>
    fetchApi<ConnectJob & { browserConnectAvailable?: boolean }>(
      `/admin/tenants/${tenantId}/accounts/${accountId}/connect`,
      { method: "POST", body: "{}" }
    ),
  connectStatus: (tenantId: string, accountId: string) =>
    fetchApi<{
      job: ConnectJob | null;
      account: { status: string; lastError: string | null } | null;
      browserConnectAvailable: boolean;
    }>(`/admin/tenants/${tenantId}/accounts/${accountId}/connect`),
  audit: (tenantId: string) =>
    fetchApi<AuditRow[]>(`/admin/tenants/${tenantId}/audit`),
  templates: () => fetchApi<TemplateRow[]>("/admin/templates"),
};

export interface MetricsResponse {
  total: number;
  connectSent: number;
  connected: number;
  conversing: number;
  callBooked: number;
  optedOut: number;
  acceptanceRate: number;
  accountStatus: string;
  linkedInConnected?: boolean;
  accountLabel?: string;
  lastError?: string | null;
  isPaused?: boolean;
  dailyMetrics: { date: string; connectsSent: number; callsBooked: number }[];
}

export interface ProspectRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  linkedinUrl: string;
  stage: string;
  headline: string | null;
  messages: { text: string; direction: string }[];
  campaign: { name: string; niche: string };
}

export interface Campaign {
  id: string;
  name: string;
  niche: string;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  isPaused: boolean;
  _count: { prospects: number; linkedInAccounts: number };
}

export interface PlaybookResponse {
  campaignId: string;
  draft: { id: string; config: unknown; label: string | null } | null;
  published: { id: string; config: unknown; label: string | null } | null;
}

export interface AgencySettings {
  basePrompt: string;
  llmProvider: string;
  llmModel: string;
  temperature: number;
  maxTokens: number;
}

export interface LinkedInAccountRow {
  id: string;
  label: string;
  status: string;
  lastError: string | null;
  isConnected: boolean;
  hasSessionBlob?: boolean;
}

export interface ConnectJob {
  accountId: string;
  status: string;
  message: string;
  error?: string;
}

export interface AuditRow {
  id: string;
  action: string;
  createdAt: string;
  metadata: unknown;
}

export interface TemplateRow {
  id: string;
  name: string;
  niche: string;
}
