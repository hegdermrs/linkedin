import { prisma } from "@linkedin-agent/db";
import { LinkedInClient } from "@linkedin-agent/linkedin";
import {
  BROWSER_CONNECT_UNAVAILABLE,
  isBrowserConnectAvailable,
} from "./browser-connect-env.js";

export type ConnectJobStatus = "idle" | "opening" | "waiting_login" | "done" | "error";

export interface ConnectJob {
  accountId: string;
  status: ConnectJobStatus;
  message: string;
  error?: string;
  startedAt: number;
}

const jobs = new Map<string, ConnectJob>();

export function getConnectJob(accountId: string): ConnectJob | null {
  return jobs.get(accountId) ?? null;
}

export function startBrowserConnect(accountId: string): ConnectJob {
  const existing = jobs.get(accountId);
  if (existing?.status === "opening" || existing?.status === "waiting_login") {
    return existing;
  }

  if (!isBrowserConnectAvailable()) {
    const job: ConnectJob = {
      accountId,
      status: "error",
      message: BROWSER_CONNECT_UNAVAILABLE,
      error: BROWSER_CONNECT_UNAVAILABLE,
      startedAt: Date.now(),
    };
    jobs.set(accountId, job);
    return job;
  }

  const job: ConnectJob = {
    accountId,
    status: "opening",
    message: "Opening a browser window…",
    startedAt: Date.now(),
  };
  jobs.set(accountId, job);

  void (async () => {
    const client = new LinkedInClient(null, false);
    try {
      job.status = "waiting_login";
      job.message =
        "Log in to LinkedIn in the browser window that opened. Complete any verification steps, then wait until you see your feed.";

      const encrypted = await client.loginInteractive();

      await prisma.linkedInAccount.update({
        where: { id: accountId },
        data: {
          sessionEncrypted: encrypted,
          status: "active",
          lastError: null,
        },
      });

      job.status = "done";
      job.message = "LinkedIn connected successfully.";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      job.status = "error";
      job.error = msg;
      job.message = "Connection failed. Try again or use advanced paste below.";

      await prisma.linkedInAccount.update({
        where: { id: accountId },
        data: { status: "needs_human", lastError: msg },
      });
    } finally {
      await client.close();
    }
  })();

  return job;
}
