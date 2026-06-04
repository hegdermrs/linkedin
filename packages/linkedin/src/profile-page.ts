import type { Page } from "playwright";
import { humanDelay } from "./rate-limiter.js";

export type ProfileRelationship = "none" | "pending" | "connected" | "unknown";

export class LinkedInAutomationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly diagnostics: ProfileDiagnostics
  ) {
    super(message);
    this.name = "LinkedInAutomationError";
  }
}

export interface ProfileDiagnostics {
  url: string;
  loggedIn: boolean;
  securityChallenge: boolean;
  relationship: ProfileRelationship;
  visibleActions: string[];
}

const VIEWPORT = { width: 1280, height: 900 };

export async function openProfilePage(
  p: Page,
  profileUrl: string
): Promise<ProfileDiagnostics> {
  await p.setViewportSize(VIEWPORT);
  await p.goto(profileUrl, { waitUntil: "load", timeout: 60_000 });
  await p.waitForSelector("main", { timeout: 20_000 }).catch(() => {});
  await humanDelay(2, 4);

  return collectDiagnostics(p);
}

export async function collectDiagnostics(p: Page): Promise<ProfileDiagnostics> {
  const url = p.url();
  const securityChallenge =
    url.includes("checkpoint") ||
    url.includes("challenge") ||
    (await p.locator("#captcha-internal").count()) > 0;

  const authwall =
    url.includes("authwall") ||
    url.includes("/login") ||
    (await p.getByRole("heading", { name: /sign in|join linkedin/i }).count()) >
      0;

  const loggedIn =
    !authwall &&
    !securityChallenge &&
    ((await p.locator("#global-nav").count()) > 0 ||
      (await p.locator('nav[aria-label*="Primary" i]').count()) > 0 ||
      url.includes("/in/"));

  const visibleActions = await listProfileActionLabels(p);
  const relationship = inferRelationship(visibleActions);

  return {
    url,
    loggedIn,
    securityChallenge,
    relationship,
    visibleActions,
  };
}

async function listProfileActionLabels(p: Page): Promise<string[]> {
  const labels = new Set<string>();

  const scope = p.locator(
    "main .ph5, main .pv-top-card, main section.artdeco-card, main"
  ).first();

  const buttons = scope.locator('button, [role="button"]');
  const count = Math.min(await buttons.count(), 40);

  for (let i = 0; i < count; i++) {
    const el = buttons.nth(i);
    const aria = (await el.getAttribute("aria-label"))?.trim();
    const text = (await el.innerText())?.trim().replace(/\s+/g, " ");
    if (aria) labels.add(aria);
    if (text && text.length < 80) labels.add(text);
  }

  const degree = await scope
    .getByText(/\d+(st|nd|rd|th)\s+degree/i)
    .first()
    .textContent()
    .catch(() => null);
  if (degree?.trim()) labels.add(degree.trim());

  return [...labels];
}

function inferRelationship(actions: string[]): ProfileRelationship {
  const lower = actions.map((a) => a.toLowerCase());

  if (lower.some((a) => a.includes("pending"))) return "pending";

  const hasFirstDegree = lower.some(
    (a) => a.includes("1st") && a.includes("degree")
  );
  const hasMessage = lower.some(
    (a) =>
      a === "message" ||
      (a.includes("message") &&
        !a.includes("inmail") &&
        !a.includes("send a message to"))
  );
  const hasConnect = lower.some(
    (a) =>
      a === "connect" ||
      (a.includes("invite") && a.includes("connect")) ||
      (a.includes("connect") && !a.includes("disconnect"))
  );

  if (hasFirstDegree && hasMessage && !hasConnect) return "connected";
  if (hasMessage && hasFirstDegree) return "connected";

  if (hasConnect) return "none";

  if (lower.some((a) => a === "follow" || a.includes("follow"))) {
    return "none";
  }

  if (lower.some((a) => a.includes("more"))) return "unknown";

  return "unknown";
}

function formatDiagnostics(d: ProfileDiagnostics): string {
  return `url=${d.url} loggedIn=${d.loggedIn} actions=[${d.visibleActions.slice(0, 12).join("; ")}]`;
}

export async function assertReadyForAutomation(
  d: ProfileDiagnostics
): Promise<void> {
  if (d.securityChallenge) {
    throw new LinkedInAutomationError(
      "SECURITY_CHALLENGE",
      "LinkedIn security checkpoint — log in manually and refresh session.",
      d
    );
  }
  if (!d.loggedIn) {
    throw new LinkedInAutomationError(
      "NOT_LOGGED_IN",
      "LinkedIn session expired or authwall — re-run login CLI and paste a new session.",
      d
    );
  }
}

/** Click Connect using direct button, More menu, or in-page scan. */
export async function clickConnect(
  p: Page,
  d: ProfileDiagnostics
): Promise<void> {
  const scope = p.locator("main").first();

  const direct = scope.locator(
    'button[aria-label*="Invite" i][aria-label*="connect" i], button[aria-label*="to connect" i]'
  );
  if ((await direct.count()) > 0) {
    await direct.first().click({ timeout: 5000 });
    return;
  }

  const byRole = scope.getByRole("button", { name: /^Connect$/i });
  if ((await byRole.count()) > 0) {
    await byRole.first().click({ timeout: 5000 });
    return;
  }

  const byText = scope.locator("button").filter({ hasText: /^Connect$/i });
  if ((await byText.count()) > 0) {
    await byText.first().click({ timeout: 5000 });
    return;
  }

  const moreBtn = scope
    .locator(
      'button[aria-label="More actions"], button[aria-label*="More actions" i], button[aria-label*="More" i]'
    )
    .filter({ hasNot: p.locator("[aria-label*='Messaging' i]") })
    .first();

  if ((await moreBtn.count()) > 0) {
    await moreBtn.click({ timeout: 5000 });
    await p.waitForTimeout(600);

    const menuConnect = p
      .locator(
        '[role="menuitem"], [role="button"], div.artdeco-dropdown__item, li'
      )
      .filter({ hasText: /^Connect$/i })
      .first();
    if ((await menuConnect.count()) > 0) {
      await menuConnect.click({ timeout: 5000 });
      return;
    }

    const menuAria = p.locator(
      '[aria-label*="Invite" i][aria-label*="connect" i], [aria-label*="to connect" i]'
    );
    if ((await menuAria.count()) > 0) {
      await menuAria.first().click({ timeout: 5000 });
      return;
    }
  }

  throw new LinkedInAutomationError(
    "CONNECT_NOT_FOUND",
    `Connect not found on profile. ${formatDiagnostics(d)}. If you see Follow/More only, Connect is in the More menu — automation could not open it.`,
    d
  );
}

export async function detectRelationship(
  p: Page,
  profileUrl: string
): Promise<{ relationship: ProfileRelationship; diagnostics: ProfileDiagnostics }> {
  const d = await openProfilePage(p, profileUrl);
  await assertReadyForAutomation(d);
  return { relationship: d.relationship, diagnostics: d };
}
