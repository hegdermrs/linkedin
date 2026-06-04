"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("changeme");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.login(username, password);
      router.refresh();
      router.push("/setup");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(
        msg.includes("User.username") || msg.includes("does not exist")
          ? "Database needs a schema update. In Railway → api → Shell run: cd /app/packages/db && npx prisma db push --accept-data-loss && cd /app && pnpm --filter @linkedin-agent/db seed — then restart api."
          : msg === "Invalid credentials"
            ? "Invalid credentials — use AGENCY_ADMIN_USERNAME and AGENCY_ADMIN_PASSWORD from Railway (api service), then run seed in api Shell."
            : msg
      );
    }
  }

  return (
    <div className="login-page card">
      <h1 style={{ marginBottom: "0.5rem" }}>Sign in</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Agency admin
      </p>
      {error && <div className="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" style={{ width: "100%" }}>
          Sign in
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--muted)" }}>
        Default: admin / changeme (after seed)
      </p>
    </div>
  );
}
