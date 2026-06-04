import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { decryptSession, encryptSession } from "./session.js";
import { humanDelay } from "./rate-limiter.js";
import {
  assertReadyForAutomation,
  clickConnect,
  collectDiagnostics,
  detectRelationship,
  LinkedInAutomationError,
  openProfilePage,
  type ProfileDiagnostics,
  type ProfileRelationship,
} from "./profile-page.js";

export interface ScrapedProfile {
  firstName?: string;
  lastName?: string;
  headline?: string;
  about?: string;
  experience?: string;
  education?: string;
  location?: string;
}

export interface ThreadMessage {
  text: string;
  direction: "inbound" | "outbound";
  sentAt?: string;
}

export interface UnreadConversation {
  threadId: string;
  profileUrl: string;
  preview: string;
}

export { LinkedInAutomationError, type ProfileDiagnostics };

export class LinkedInClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(
    private sessionEncrypted: string | null,
    private headless = true
  ) {}

  async init(): Promise<void> {
    this.browser = await chromium.launch({ headless: this.headless });
    if (this.sessionEncrypted) {
      const state = decryptSession(this.sessionEncrypted);
      this.context = await this.browser.newContext({
        storageState: JSON.parse(state),
        viewport: { width: 1280, height: 900 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
    } else {
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
    }
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = null;
    this.browser = null;
  }

  async exportSession(): Promise<string> {
    if (!this.context) throw new Error("Context not initialized");
    const state = await this.context.storageState();
    return encryptSession(JSON.stringify(state));
  }

  private async page(): Promise<Page> {
    if (!this.context) throw new Error("Context not initialized");
    const pages = this.context.pages();
    if (pages.length > 0) return pages[0]!;
    return this.context.newPage();
  }

  async loginInteractive(): Promise<string> {
    await this.init();
    const p = await this.page();
    await p.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
    });
    console.log("Log in to LinkedIn in the browser window. Waiting up to 5 minutes...");
    await p.waitForURL(/linkedin\.com\/feed/, { timeout: 300_000 });
    return this.exportSession();
  }

  async detectSecurityChallenge(): Promise<boolean> {
    const p = await this.page();
    const url = p.url();
    return (
      url.includes("checkpoint") ||
      url.includes("challenge") ||
      (await p.locator("#captcha-internal").count()) > 0
    );
  }

  normalizeProfileUrl(url: string): string {
    try {
      const u = new URL(url);
      u.search = "";
      u.hash = "";
      return u.toString().replace(/\/$/, "");
    } catch {
      return url;
    }
  }

  async scrapeProfile(profileUrl: string): Promise<ScrapedProfile> {
    const p = await this.page();
    const url = this.normalizeProfileUrl(profileUrl);
    const d = await openProfilePage(p, url);
    await assertReadyForAutomation(d);

    const getText = async (selectors: string[]) => {
      for (const sel of selectors) {
        const el = p.locator(sel).first();
        if ((await el.count()) > 0) {
          const t = await el.textContent();
          if (t?.trim()) return t.trim();
        }
      }
      return undefined;
    };

    const fullName = await getText([
      "h1.text-heading-xlarge",
      "h1.inline",
      ".pv-text-details__left-panel h1",
    ]);

    let firstName: string | undefined;
    let lastName: string | undefined;
    if (fullName) {
      const parts = fullName.split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || undefined;
    }

    const headline = await getText([
      ".text-body-medium",
      ".pv-text-details__left-panel .text-body-medium",
    ]);

    const about = await getText([
      "#about ~ div .inline-show-more-text",
      "section[data-section='summary'] .pv-about__summary-text",
      "#about + div span[aria-hidden='true']",
    ]);

    const experience = await getText([
      "#experience",
      "section:has(#experience)",
    ]);

    const education = await getText([
      "#education",
      "section:has(#education)",
    ]);

    return {
      firstName,
      lastName,
      headline,
      about: about ?? (await p.locator("main").textContent())?.slice(0, 2000),
      experience,
      education,
    };
  }

  async getConnectionStatus(
    profileUrl: string
  ): Promise<"none" | "pending" | "connected"> {
    const p = await this.page();
    const { relationship } = await detectRelationship(
      p,
      this.normalizeProfileUrl(profileUrl)
    );
    if (relationship === "unknown") return "none";
    return relationship;
  }

  async sendConnectionRequest(
    profileUrl: string,
    note?: string
  ): Promise<void> {
    const p = await this.page();
    const url = this.normalizeProfileUrl(profileUrl);
    const d = await openProfilePage(p, url);
    await assertReadyForAutomation(d);

    if (d.relationship === "connected") {
      throw new LinkedInAutomationError(
        "ALREADY_CONNECTED",
        "Profile shows 1st-degree connection.",
        d
      );
    }
    if (d.relationship === "pending") {
      throw new LinkedInAutomationError(
        "CONNECT_ALREADY_PENDING",
        "Invitation already pending.",
        d
      );
    }

    await clickConnect(p, d);
    await p.waitForTimeout(1500);

    if (note) {
      const addNote = p.getByRole("button", { name: /Add a note/i });
      if ((await addNote.count()) > 0) {
        await addNote.click();
        await p.waitForTimeout(500);
        const textarea = p.locator('textarea[name="message"]');
        await textarea.fill(note.slice(0, 300));
      }
    }

    const sendBtn = p.getByRole("button", { name: /Send( invitation)?/i });
    if ((await sendBtn.count()) === 0) {
      const diag = await collectDiagnostics(p);
      throw new LinkedInAutomationError(
        "SEND_INVITE_NOT_FOUND",
        "Connect dialog opened but Send button not found.",
        diag
      );
    }
    await sendBtn.first().click();
    await humanDelay(3, 8);
  }

  async sendMessage(profileUrl: string, text: string): Promise<void> {
    const p = await this.page();
    const d = await openProfilePage(p, this.normalizeProfileUrl(profileUrl));
    await assertReadyForAutomation(d);

    if (d.relationship !== "connected") {
      throw new LinkedInAutomationError(
        "NOT_CONNECTED",
        `Cannot message — not 1st-degree. ${d.visibleActions.join("; ")}`,
        d
      );
    }

    const messageBtn = p
      .locator('button[aria-label*="Message" i]')
      .filter({ hasNot: p.locator("[aria-label*='InMail' i]") })
      .first();
    const messageRole = p.getByRole("button", { name: /^Message$/i }).first();
    const btn =
      (await messageBtn.count()) > 0
        ? messageBtn
        : (await messageRole.count()) > 0
          ? messageRole
          : null;
    if (!btn) {
      throw new LinkedInAutomationError(
        "MESSAGE_BUTTON_NOT_FOUND",
        "Message button not found on profile.",
        d
      );
    }
    await btn.click();
    await p.waitForTimeout(2000);

    const compose = p
      .locator(
        'div.msg-form__contenteditable, div[role="textbox"][contenteditable="true"]'
      )
      .first();
    await compose.click();
    await compose.fill(text);
    await humanDelay(1, 3);

    const send = p.getByRole("button", { name: /^Send$/i }).last();
    await send.click();
    await humanDelay(3, 8);
  }

  async listUnreadConversations(): Promise<UnreadConversation[]> {
    const p = await this.page();
    await p.goto("https://www.linkedin.com/messaging/", {
      waitUntil: "domcontentloaded",
    });
    await humanDelay(2, 4);

    const items = p.locator(".msg-conversation-listitem");
    const count = Math.min(await items.count(), 20);
    const results: UnreadConversation[] = [];

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const preview = (await item.textContent()) ?? "";
      const link = item.locator("a").first();
      const href = (await link.getAttribute("href")) ?? "";
      if (preview.toLowerCase().includes("unread") || preview.includes("●")) {
        results.push({
          threadId: href || `thread-${i}`,
          profileUrl: href.startsWith("http")
            ? href
            : `https://www.linkedin.com${href}`,
          preview: preview.slice(0, 200),
        });
      }
    }

    return results;
  }

  async getThreadMessages(profileUrl: string): Promise<ThreadMessage[]> {
    const p = await this.page();
    await p.goto("https://www.linkedin.com/messaging/", {
      waitUntil: "domcontentloaded",
    });
    await humanDelay(2, 3);

    const convo = p.locator(".msg-conversation-listitem").filter({
      hasText: new RegExp(profileUrl.split("/in/")[1]?.split("/")[0] ?? "", "i"),
    });
    if ((await convo.count()) > 0) {
      await convo.first().click();
      await p.waitForTimeout(2000);
    }

    const bubbles = p.locator(".msg-s-message-list__event");
    const n = await bubbles.count();
    const messages: ThreadMessage[] = [];

    for (let i = 0; i < n; i++) {
      const bubble = bubbles.nth(i);
      const text = (await bubble.textContent())?.trim() ?? "";
      const isOutbound =
        (await bubble.locator(".msg-s-message-group--self").count()) > 0 ||
        (await bubble.locator("[data-self]").count()) > 0;
      if (text) {
        messages.push({
          text,
          direction: isOutbound ? "outbound" : "inbound",
        });
      }
    }

    return messages;
  }
}
