"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getClientToken, setClientToken } from "../../lib/adminClient";
import { isTokenExpired } from "../../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getClientToken();
    if (token && !isTokenExpired(token)) {
      router.replace("/");
      return;
    }
    if (token) {
      setClientToken(null);
    }
  }, [router]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/public/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const text = await response.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            (response.status === 502
              ? "Cannot reach backend API. Start `npm run dev:api` and retry."
              : "Login failed.")
        );
      }
      if (payload?.user?.role !== "ADMIN") {
        throw new Error("Only ADMIN users can access this dashboard.");
      }
      if (!payload?.token || isTokenExpired(payload.token)) {
        throw new Error("Session expired. Please sign in again.");
      }

      setClientToken(payload.token || null);
      router.push("/");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      const looksLikeNetworkIssue = /failed to fetch|networkerror|load failed/i.test(message);
      setError(
        looksLikeNetworkIssue
          ? "Cannot reach admin server. Make sure `npm run dev:admin` and `npm run dev:api` are running."
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form className="card" style={{ maxWidth: 420, width: "100%" }} onSubmit={signIn}>
        <h1 className="title" style={{ fontSize: 28, marginBottom: 6 }}>
          Admin login
        </h1>
        <p className="subtitle" style={{ marginBottom: 18 }}>
          Use your admin credentials to continue.
        </p>
        <div className="list">
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn" style={{ width: "100%" }} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
        <p className="subtitle" style={{ marginTop: 18 }}>
          New gym? <Link href="/register">Create your admin space</Link>
        </p>
      </form>
    </main>
  );
}
