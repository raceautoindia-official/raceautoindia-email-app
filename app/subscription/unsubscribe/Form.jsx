"use client";

import { useEffect, useState } from "react";

const UnsubscribePage = () => {
  const [email, setEmail] = useState(""); // decoded email
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");

    if (emailParam) {
      const decodedEmail = decodeURIComponent(emailParam);
      setEmail(decodedEmail);
    } else {
      setMessage("Something went wrong. Please try again later.");
      setStatus("error");
    }
  }, []);

  const handleUnsubscribe = async () => {
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch(`/api/admin/unsubscribe/${encodeURIComponent(email)}`, {
        method: "PUT",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("You have successfully unsubscribed.");
        setStatus("success");
      } else {
        setMessage("Something went wrong. Please try again later.");
        setStatus("error");
      }
    } catch (error) {
      setMessage("Something went wrong. Please try again later.");
      setStatus("error");
    }
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Unsubscribe</h2>

      {email && status !== "success" && (
        <p>You are about to unsubscribe <strong>{email}</strong> from our emails.</p>
      )}
      <p>If you no longer want to receive our emails, click below.</p>

      {status !== "success" && (
        <button
          onClick={handleUnsubscribe}
          disabled={status === "loading" || !email}
          style={{
            padding: "0.6rem 1.2rem",
            fontSize: "1rem",
            backgroundColor: "#dc3545",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {status === "loading" ? "Unsubscribing..." : "Click here to unsubscribe"}
        </button>
      )}

      {message && (
        <p style={{ marginTop: "1rem", color: status === "error" ? "red" : "green" }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default UnsubscribePage;
