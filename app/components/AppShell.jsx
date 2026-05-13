"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CommandPalette from "./CommandPalette";

const NAV = [
  { section: "Overview", items: [
    { href: "/", label: "Dashboard", icon: "📊", exact: true },
  ]},
  { section: "Audience", items: [
    { href: "/emails", label: "Subscribers", icon: "👥" },
    { href: "/emails/category", label: "Categories", icon: "🏷️" },
    { href: "/emails/suppressions", label: "Suppressions", icon: "🚫" },
    { href: "/admin/upload-excel", label: "Import", icon: "⬆️" },
  ]},
  { section: "Campaigns", items: [
    { href: "/emails/email-send", label: "New Send", icon: "✉️" },
    { href: "/emails/campaigns", label: "Campaigns", icon: "📁" },
    { href: "/emails/jobs", label: "Job History", icon: "📋" },
  ]},
  { section: "Analytics", items: [
    { href: "/emails/email-status", label: "Tracking", icon: "📈" },
  ]},
  { section: "System", items: [
    { href: "/settings", label: "Settings", icon: "⚙️" },
    { href: "/audit-log", label: "Audit Log", icon: "🗂️" },
  ]},
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const isActive = (item) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  // restore collapse state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("md.sidebar.collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("md.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  };

  // Cmd+K command palette
  const onKey = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setCmdkOpen(true);
    } else if (e.key === "Escape") {
      setCmdkOpen(false);
    }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className={`md-shell ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Sidebar */}
      <aside className="md-sidebar">
        <div className="md-sidebar-brand">
          <div className="logo">M</div>
          <span className="md-sidebar-brand-text">MailDeck</span>
        </div>

        <nav className="md-nav">
          {NAV.map((sec) => (
            <div key={sec.section} className="md-nav-section">
              <div className="md-nav-section-title">{sec.section}</div>
              {sec.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`md-nav-item ${isActive(it) ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? it.label : undefined}
                >
                  <span className="icon">{it.icon}</span>
                  <span className="md-nav-item-label">{it.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="md-sidebar-footer">
          <div className="md-avatar">A</div>
          <div className="md-sidebar-footer-info" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Admin</div>
            <div style={{ fontSize: "0.7rem", color: "var(--md-text-muted)" }} className="text-truncate">
              raceautoindia.com
            </div>
          </div>
          <button
            onClick={toggleCollapsed}
            title="Collapse sidebar"
            style={{
              background: "transparent", border: "1px solid var(--md-border)",
              borderRadius: 6, padding: "4px 8px", cursor: "pointer",
              color: "var(--md-text-muted)",
            }}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="md-main">
        <div className="md-topbar">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            style={{
              background: "transparent", border: "1px solid var(--md-border)",
              borderRadius: 6, padding: "6px 10px", cursor: "pointer",
              color: "var(--md-text-muted)",
              display: "none",
            }}
            className="d-md-none d-inline-flex"
          >☰</button>

          <div className="search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search anything... (Ctrl+K)"
              onFocus={() => setCmdkOpen(true)}
              readOnly
            />
            <span className="kbd">⌘K</span>
          </div>

          <div className="ms-auto d-flex gap-2 align-items-center">
            <button
              onClick={() => router.push("/emails/email-send")}
              style={{
                background: "var(--md-primary)", color: "white",
                border: "none", borderRadius: 6, padding: "6px 14px",
                cursor: "pointer", fontWeight: 500, fontSize: "0.875rem",
              }}
            >
              ✉️ New Send
            </button>
          </div>
        </div>

        <div className="md-content">{children}</div>
      </div>

      {cmdkOpen && <CommandPalette onClose={() => setCmdkOpen(false)} />}
    </div>
  );
}
