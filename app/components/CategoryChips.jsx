"use client";

import React from "react";

function readableText(hex) {
  if (!hex || hex.length < 4) return "#fff";
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  if (Number.isNaN(r)) return "#fff";
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#212529" : "#fff";
}

export default function CategoryChips({
  categories = [],
  onRemove,
  onClick,
  size = "sm",
  empty = "Uncategorized",
}) {
  if (!categories || !categories.length) {
    return <span className="text-muted small">{empty}</span>;
  }
  return (
    <div className="d-flex flex-wrap gap-1">
      {categories.map((c) => {
        const fg = readableText(c.color);
        const padding = size === "sm" ? "1px 8px" : "3px 10px";
        const fontSize = size === "sm" ? "0.78rem" : "0.9rem";
        return (
          <span
            key={c.id}
            onClick={onClick ? () => onClick(c) : undefined}
            style={{
              backgroundColor: c.color || "#6c757d",
              color: fg,
              padding,
              borderRadius: 12,
              fontSize,
              lineHeight: 1.3,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: onClick ? "pointer" : "default",
              userSelect: "none",
            }}
            title={c.name}
          >
            {c.name}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(c);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: fg,
                  padding: 0,
                  marginLeft: 2,
                  cursor: "pointer",
                  fontSize: "0.85em",
                }}
                aria-label={`Remove ${c.name}`}
              >
                ×
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
