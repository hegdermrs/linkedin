"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { api, type ConnectJob, type LinkedInAccountRow } from "@/lib/api";

function AccountsContent() {
  const tenantId = useParams().tenantId as string;
  const [accounts, setAccounts] = useState<LinkedInAccountRow[]>([]);
  const [session, setSession] = useState("");
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState("");

  const refresh = useCallback(async () => {
    setAccounts(await api.accounts(tenantId));
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!connecting || !accounts[0]) return;
    const interval = setInterval(async () => {
      const { job, account } = await api.connectStatus(
        tenantId,
        accounts[0]!.id
      );
      setConnectMessage(job?.message ?? "");
      if (job?.status === "done") {
        setConnecting(false);
        await refresh();
      }
      if (job?.status === "error") {
        setConnecting(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [connecting, accounts, tenantId, refresh]);

  async function connectLinkedIn() {
    if (!accounts[0]) return;
    setConnecting(true);
    setConnectMessage("Starting…");
    setSaved(false);
    try {
      const job = await api.startConnect(tenantId, accounts[0].id);
      setConnectMessage(job.message);
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
    await refresh();
  }

  const primary = accounts[0];
  const isConnected = Boolean(primary?.isConnected);

  return (
    <main className="main">
      <h1 style={{ marginBottom: "0.5rem" }}>LinkedIn connection</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Step 1 — sign in to LinkedIn once. A browser window opens on the computer
        where this app is running (your PC or server). No terminal commands
        needed.
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
          {primary.lastError && (
            <div className="alert" style={{ marginBottom: "1rem" }}>
              {primary.lastError}
            </div>
          )}

          {!isConnected && (
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
                  When you reach your LinkedIn home feed, return here. This page
                  updates automatically.
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
              {connectMessage && (
                <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                  {connectMessage}
                </p>
              )}
            </>
          )}

          {isConnected && (
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              LinkedIn is linked. Continue to Playbook, then upload your prospect
              list in Setup.
            </p>
          )}
        </div>
      )}

      <div className="card">
        <button
          type="button"
          className="secondary"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ marginBottom: showAdvanced ? "1rem" : 0 }}
        >
          {showAdvanced ? "Hide" : "Show"} advanced (technical team only)
        </button>
        {showAdvanced && (
          <>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
              For developers hosting the app remotely: run the login CLI on the
              server, then paste the encrypted session blob here.
            </p>
            {saved && <div className="alert success">Session saved.</div>}
            <div className="form-group">
              <label>Encrypted session (paste)</label>
              <textarea
                value={session}
                onChange={(e) => setSession(e.target.value)}
                rows={4}
              />
            </div>
            {primary && (
              <button type="button" onClick={() => saveSession(primary.id)}>
                Save session
              </button>
            )}
          </>
        )}
      </div>
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
