"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("email_auth") === "true") {
      router.replace(next);
    }
  }, [router, next]);

  const handleLogin = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    if (username === "admin" && password === "secret123") {
      sessionStorage.setItem("email_auth", "true");
      router.replace(next);
    } else {
      setError("Invalid credentials");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #EEF2FF 0%, #F8FAFC 100%)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          padding: "2.5rem 2rem",
          borderRadius: 12,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#4F46E5",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#0F172A" }}>MailDeck</div>
        </div>
        <h2 style={{ margin: "0 0 4px 0", fontSize: "1.5rem", color: "#0F172A" }}>Admin Login</h2>
        <p style={{ margin: "0 0 1.5rem 0", color: "#64748B", fontSize: "0.9rem" }}>
          Sign in to continue to your email console.
        </p>

        <form onSubmit={handleLogin}>
          {error && (
            <div
              style={{
                background: "#FEE2E2",
                color: "#991B1B",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.85rem",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <label style={{ display: "block", fontSize: "0.85rem", color: "#334155", marginBottom: 4 }}>
            Username
          </label>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 14,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              fontSize: "0.95rem",
              outline: "none",
            }}
          />

          <label style={{ display: "block", fontSize: "0.85rem", color: "#334155", marginBottom: 4 }}>
            Password
          </label>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 18,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              fontSize: "0.95rem",
              outline: "none",
            }}
          />

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "11px",
              background: submitting ? "#818CF8" : "#4F46E5",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
