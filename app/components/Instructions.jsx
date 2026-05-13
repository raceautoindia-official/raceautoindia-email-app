"use client";

import React, { useState } from "react";

/**
 * <Instructions title="..." defaultOpen={true}>
 *   ...content (JSX)...
 * </Instructions>
 *
 * Renders a collapsible info panel with a left blue accent.
 * Used across pages that benefit from explicit how-to instructions:
 * upload, send (excel mode), categories, suppressions, etc.
 */
export default function Instructions({ title, children, defaultOpen = true, variant = "info" }) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = {
    info:    { border: "var(--md-info)",    bg: "var(--md-info-soft)",    text: "#075985" },
    warning: { border: "var(--md-warning)", bg: "var(--md-warning-soft)", text: "#92400E" },
    success: { border: "var(--md-success)", bg: "var(--md-success-soft)", text: "#065F46" },
  };
  const c = colors[variant] || colors.info;

  return (
    <div
      style={{
        background: c.bg,
        borderLeft: `4px solid ${c.border}`,
        borderRadius: "var(--md-radius)",
        padding: "12px 16px",
        marginBottom: 16,
        color: c.text,
        fontSize: "0.875rem",
      }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", fontWeight: 600,
        }}
        onClick={() => setOpen(!open)}
      >
        <span>
          {variant === "warning" ? "⚠️ " : variant === "success" ? "✅ " : "ℹ️ "}
          {title}
        </span>
        <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>{open ? "Hide" : "Show"}</span>
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}
