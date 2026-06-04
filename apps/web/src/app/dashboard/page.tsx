"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import Link from "next/link";
import { TenantSelector, useTenant } from "@/components/TenantContext";
import { api, type MetricsResponse } from "@/lib/api";

function DashboardContent() {
  const { tenantId } = useTenant();
  const linkedInHref = `/admin/tenants/${tenantId}/accounts`;
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setMetrics(await api.metrics(tenantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  async function togglePause() {
    if (!metrics) return;
    await api.pause(!metrics.isPaused, tenantId);
    await load();
  }

  return (
    <main className="main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>Dashboard</h1>
        <button
          type="button"
          className={metrics?.isPaused ? "" : "danger"}
          onClick={togglePause}
        >
          {metrics?.isPaused ? "Resume campaign" : "Pause campaign"}
        </button>
      </div>

      <TenantSelector />
      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Metrics after setup is complete — pause or resume outreach here.
      </p>
      {error && <div className="alert">{error}</div>}

      {metrics?.lastError && (
        <div className="alert" style={{ marginBottom: "1rem" }}>
          Last automation error: {metrics.lastError}
        </div>
      )}
      {metrics && !metrics.linkedInConnected && (
        <div className="alert">
          LinkedIn is not connected yet — complete step 1 on the{" "}
          <Link href={linkedInHref}>LinkedIn</Link> page.
        </div>
      )}

      {metrics?.accountStatus === "needs_human" && (
        <div className="alert">
          LinkedIn needs attention — please re-authenticate in Setup.
          {metrics.lastError && ` (${metrics.lastError})`}
        </div>
      )}

      {metrics && (
        <>
          <div className="grid-metrics" style={{ marginBottom: "1.5rem" }}>
            <div className="card">
              <div className="metric-value">{metrics.total}</div>
              <div className="metric-label">Total prospects</div>
            </div>
            <div className="card">
              <div className="metric-value">{metrics.connectSent}</div>
              <div className="metric-label">Requests sent</div>
            </div>
            <div className="card">
              <div className="metric-value">{metrics.acceptanceRate}%</div>
              <div className="metric-label">Acceptance rate</div>
            </div>
            <div className="card">
              <div className="metric-value">{metrics.conversing}</div>
              <div className="metric-label">In conversation</div>
            </div>
            <div className="card">
              <div className="metric-value">{metrics.callBooked}</div>
              <div className="metric-label">Calls booked</div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Account health</h2>
            <p>
              Status:{" "}
              <span className={`badge ${metrics.accountStatus === "active" ? "success" : "warning"}`}>
                {metrics.accountStatus}
              </span>
              {metrics.accountLabel && ` — ${metrics.accountLabel}`}
            </p>
          </div>
        </>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
