"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const NAV_ACTIONS = [
  { id: "nav-dashboard", label: "Go to Dashboard", group: "Navigate", run: (r) => r.push("/") },
  { id: "nav-subs",      label: "Manage Subscribers", group: "Navigate", run: (r) => r.push("/emails") },
  { id: "nav-cats",      label: "Manage Categories", group: "Navigate", run: (r) => r.push("/emails/category") },
  { id: "nav-supp",      label: "View Suppressions", group: "Navigate", run: (r) => r.push("/emails/suppressions") },
  { id: "nav-camp",      label: "View Campaigns", group: "Navigate", run: (r) => r.push("/emails/campaigns") },
  { id: "nav-jobs",      label: "View Job History", group: "Navigate", run: (r) => r.push("/emails/jobs") },
  { id: "nav-track",     label: "Open Tracking", group: "Navigate", run: (r) => r.push("/emails/email-status") },
  { id: "nav-upload",    label: "Import Subscribers", group: "Navigate", run: (r) => r.push("/admin/upload-excel") },
  { id: "nav-settings",  label: "Open Settings", group: "Navigate", run: (r) => r.push("/settings") },
  { id: "nav-audit",     label: "Open Audit Log", group: "Navigate", run: (r) => r.push("/audit-log") },
  { id: "act-send",      label: "Compose New Send", group: "Actions", run: (r) => r.push("/emails/email-send") },
  { id: "act-newcat",    label: "Create New Category", group: "Actions", run: (r) => r.push("/emails/category?new=1") },
];

export default function CommandPalette({ onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search subscribers when typing
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`/api/admin/emails?q=${encodeURIComponent(query)}&limit=5&page=1`);
        const subs = (data.rows || []).map((r) => ({
          id: `sub-${r.id}`,
          label: r.email,
          group: "Subscribers",
          run: () => router.push(`/emails?q=${encodeURIComponent(r.email)}`),
        }));
        setSearchResults(subs);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [query, router]);

  const filtered = [...NAV_ACTIONS, ...searchResults].filter((a) =>
    !query.trim() ? true : a.label.toLowerCase().includes(query.toLowerCase())
  );

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selected];
      if (item) {
        item.run(router);
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="md-cmdk-backdrop" onClick={onClose}>
      <div className="md-cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="md-cmdk-input"
          placeholder="Type a command, search subscribers, navigate…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
          onKeyDown={onKey}
        />
        <div className="md-cmdk-list">
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--md-text-muted)" }}>
              No results.
            </div>
          ) : (
            filtered.map((it, i) => (
              <div
                key={it.id}
                className={`md-cmdk-item ${i === selected ? "selected" : ""}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => { it.run(router); onClose(); }}
              >
                <span className="label">{it.label}</span>
                <span className="group">{it.group}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
