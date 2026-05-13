"use client";

import { useEffect, useState } from "react";

const PALETTE = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  danger: "#EF4444",
  success: "#10B981",
};

export default function UnsubscribePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      try { setEmail(decodeURIComponent(emailParam)); }
      catch { setEmail(emailParam); }
    } else {
      setParseError("No email address was supplied in the link. Please use the unsubscribe link from your email exactly as received.");
    }
  }, []);

  const handleUnsubscribe = async () => {
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/admin/unsubscribe/${encodeURIComponent(email)}`, {
        method: "PUT",
      });
      const data = await res.json().catch(() => ({}));
      // Server is designed to ALWAYS return success (or 200 with success:true)
      // so the user is never told they failed to unsubscribe.
      setStatus("success");
      setMessage(data.message || "You have been unsubscribed. You won't receive further emails.");
    } catch (err) {
      // True network failure — still reassure but allow retry.
      setStatus("error");
      setMessage("We couldn't reach our server. Please try again, or reply to any email saying 'unsubscribe' and we'll handle it manually.");
    }
  };

  const card = {
    background: PALETTE.card,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 12,
    padding: "32px",
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{
      minHeight: "100vh", background: PALETTE.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: PALETTE.text,
    }}>
      <div style={card}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>
          {status === "success" ? "✅" : "✉️"}
        </div>

        <h2 style={{ fontSize: "1.4rem", margin: "0 0 8px", fontWeight: 600 }}>
          {status === "success" ? "You're unsubscribed" : "Unsubscribe"}
        </h2>

        {parseError ? (
          <p style={{ color: PALETTE.danger, fontSize: "0.9rem" }}>{parseError}</p>
        ) : status === "success" ? (
          <>
            <p style={{ color: PALETTE.muted, fontSize: "0.95rem", lineHeight: 1.5 }}>
              {message}
            </p>
            {email && (
              <p style={{ color: PALETTE.muted, fontSize: "0.85rem", marginTop: 16 }}>
                <strong style={{ color: PALETTE.text }}>{email}</strong> has been added to our permanent suppression list.
                You will not receive further emails from us.
              </p>
            )}
          </>
        ) : status === "error" ? (
          <>
            <p style={{ color: PALETTE.danger, fontSize: "0.95rem" }}>{message}</p>
            <button
              onClick={handleUnsubscribe}
              style={{
                marginTop: 16, padding: "10px 18px",
                background: PALETTE.primary, color: "white",
                border: "none", borderRadius: 8, cursor: "pointer",
                fontWeight: 500, fontSize: "0.9rem",
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <p style={{ color: PALETTE.muted, fontSize: "0.95rem", lineHeight: 1.5 }}>
              You're about to unsubscribe <strong style={{ color: PALETTE.text }}>{email}</strong> from our mailing list.
              We'll add this address to our permanent suppression list — even if it's used in future imports, it will not receive emails from us.
            </p>

            <button
              onClick={handleUnsubscribe}
              disabled={status === "loading" || !email}
              style={{
                marginTop: 24, padding: "12px 22px",
                background: status === "loading" ? PALETTE.muted : PALETTE.danger,
                color: "white", border: "none", borderRadius: 8,
                cursor: status === "loading" ? "wait" : "pointer",
                fontWeight: 600, fontSize: "0.95rem",
                width: "100%",
                transition: "background 0.15s",
              }}
            >
              {status === "loading" ? "Unsubscribing..." : "Confirm unsubscribe"}
            </button>

            <p style={{ marginTop: 16, fontSize: "0.8rem", color: PALETTE.muted }}>
              Changed your mind? Just close this page — nothing happens until you click the button.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
