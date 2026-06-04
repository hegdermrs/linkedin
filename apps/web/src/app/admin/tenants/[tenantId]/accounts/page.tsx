"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { api, type ConnectJob, type LinkedInAccountRow } from "@/lib/api";

const CLI_LOGIN = `cd D:\\Work\\APPS\\Likedin
npx pnpm@9.15.0 --filter @linkedin-agent/linkedin login`;

function AccountsContent() {
  const tenantId = useParams().tenantId as string;
  const [accounts, setAccounts] = useState<LinkedInAccountRow[]>([]);
  const [session, setSession] = useState("");
  const [saved, setSaved] = useState(false);
  const [browserConnectAvailable, setBrowserConnectAvailable] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState("");
  const [connectError, setConnectError] = useState("");

  const refresh = useCallback(async () => {
    setAccounts(await api.accounts(tenantId));
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!accounts[0]) return;
    api
      .connectStatus(tenantId, accounts[0].id)
      .then((r) => setBrowserConnectAvailable(r.browserConnectAvailable))
      .catch(() => setBrowserConnectAvailable(false));
  }, [accounts, tenantId]);

  useEffect(() => {
    if (!connecting || !accounts[0]) return;
    const interval = setInterval(async () => {
      const { job, account } = await api.connectStatus(
        tenantId,
        accounts[0]!.id
      );
      setConnectMessage(job?.message ?? "");
      setConnectError(job?.error ?? "");
      if (job?.status === "done") {
        setConnecting(false);
        await refresh();
      }
      if (job?.status === "error") {
        setConnecting(false);
      }
      if (account?.lastError) {
        setConnectError(account.lastError);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [connecting, accounts, tenantId, refresh]);

  async function connectLinkedIn() {
    if (!accounts[0] || !browserConnectAvailable) return;
    setConnecting(true);
    setConnectMessage("Starting…");
    setConnectError("");
    setSaved(false);
    try {
      const job = await api.startConnect(tenantId, accounts[0].id);
      setConnectMessage(job.message);
      if (job.status === "error") {
        setConnecting(false);
        setConnectError(job.error ?? job.message);
      }
    } catch (e) {
      setConnecting(false);
      setConnectMessage(
        e instanceof Error ? e.message : "Could not start connection"
      );
    }
  }

  async function saveSession(accountId: string) {
    await api.saveSession(tenantId, accountId, session.trim());
    setSaved(true);
    setSession("");
    setConnectError("");
    await refresh();
  }

  const primary = accounts[0];
  const isConnected = Boolean(primary?.isConnected);
  const hosted = !browserConnectAvailable;

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>LinkedIn connection</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        {hosted
          ? "Your app runs on Railway — sign in to LinkedIn on your PC, then paste the session here."
          : "Sign in to LinkedIn once. A browser window opens on this computer."}
      </p>

      {primary && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
            {isConnected ? "Connected" : "Not connected yet"}
          </h2>
          <p style={{ marginBottom: "1rem" }}>
            Status:{" "}
            <span
              className={`badge ${isConnected ? "success" : "warning"}`}
            >
              {isConnected ? "connected" : "not connected"}
            </span>
          </p>
          {(connectError || primary.lastError) && (
            <div className="alert" style={{ marginBottom: "1rem" }}>
              {connectError || primary.lastError}
            </div>
          )}

          {!isConnected && hosted && (
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
                Step 1 — On your computer
              </h3>
              <ol
                style={{
                  paddingLeft: "1.25rem",
                  color: "var(--muted)",
                  marginBottom: "1rem",
                  lineHeight: 1.7,
                }}
              >
                <li>
                  Open PowerShell in the project folder (same{" "}
                  <code>SESSION_ENCRYPTION_KEY</code> as Railway api).
                </li>
                <li>Run:</li>
              </ol>
              <pre
                style={{
                  background: "var(--bg)",
                  padding: "1rem",
                  borderRadius: 8,
                  fontSize: "0.8rem",
                  overflow: "auto",
                  marginBottom: "1rem",
                }}
              >
                {CLI_LOGIN}
              </pre>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                Chrome opens — log in to LinkedIn. Copy the long encrypted text
                from the terminal (or from{" "}
                <code>.sessions/linkedin-session.enc</code>).
              </p>
            </div>
          )}

          {!isConnected && (
            <>
              {!hosted && (
                <>
                  <ol
                    style={{
                      paddingLeft: "1.25rem",
                      color: "var(--muted)",
                      marginBottom: "1.25rem",
                      lineHeight: 1.7,
                    }}
                  >
                    <li>Click the button below.</li>
                    <li>A Chrome window opens — log in to LinkedIn as usual.</li>
                    <li>
                      When you reach your LinkedIn home feed, return here.
                    </li>
                  </ol>
                  <button
                    type="button"
                    onClick={connectLinkedIn}
                    disabled={connecting}
                    style={{ marginBottom: "0.75rem" }}
                  >
                    {connecting ? "Waiting for login…" : "Connect LinkedIn"}
                  </button>
                </>
              )}
              {connectMessage && !hosted && (
                <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                  {connectMessage}
                </p>
              )}
            </>
          )}

          {!isConnected && (
            <div style={{ marginTop: hosted ? 0 : "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
                {hosted ? "Step 2 — Paste session here" : "Or paste session"}
              </h3>
              {saved && (
                <div className="alert success" style={{ marginBottom: "1rem" }}>
                  Session saved. The worker on Railway can now run automation.
                </div>
              )}
              <div className="form-group">
                <label>Encrypted session</label>
                <textarea
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  rows={5}
                  placeholder="Paste the full encrypted blob from the login command…"
                />
              </div>
              <button type="button" onClick={() => saveSession(primary.id)}>
                Save session
              </button>
            </div>
          )}

          {isConnected && (
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              LinkedIn is linked. Continue to Playbook, then add prospects in
              Setup.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default function AdminAccountsPage() {
  return (
    <AuthGuard>
      <AccountsContent />
    </AuthGuard>
  );
}
