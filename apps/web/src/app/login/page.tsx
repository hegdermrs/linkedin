"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("changeme");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { user } = await api.login(email, password);
      router.push("/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
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
        Default: admin@example.com / changeme
      </p>
    </div>
  );
}
