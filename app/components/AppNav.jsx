"use client";

import React from "react";
import { Badge } from "react-bootstrap";

export function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div className="md-page-header">
      <div>
        {breadcrumbs && (
          <div style={{ fontSize: "0.75rem", color: "var(--md-text-muted)", marginBottom: 4 }}>
            {breadcrumbs}
          </div>
        )}
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = "📭", title, hint, action }) {
  return (
    <div className="md-empty">
      <div className="icon">{icon}</div>
      <h5>{title}</h5>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

export function StatCard({ label, value, color, icon, hint, trend }) {
  return (
    <div className="md-stat">
      <div>
        <div className="md-stat-label">{label}</div>
        <div className="md-stat-value" style={color ? { color: `var(--md-${color})` } : undefined}>{value}</div>
        {hint && <div className="md-stat-trend">{hint}</div>}
        {trend && <div className={`md-stat-trend ${trend.dir}`}>{trend.label}</div>}
      </div>
      {icon && <div className="md-stat-icon">{icon}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    queued: "secondary",
    running: "primary",
    paused: "warning",
    completed: "success",
    failed: "danger",
    cancelled: "dark",
    draft: "secondary",
    active: "success",
    archived: "dark",
  };
  return (
    <Badge bg={map[status] || "secondary"} className="text-uppercase" style={{ letterSpacing: "0.04em" }}>
      {status}
    </Badge>
  );
}

export function Skeleton({ width = "100%", height = 14, style = {} }) {
  return <div className="md-skeleton" style={{ width, height, ...style }} />;
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="d-flex gap-3 my-2">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
