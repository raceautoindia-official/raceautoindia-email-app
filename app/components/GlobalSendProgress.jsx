"use client";

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ProgressBar, Button } from "react-bootstrap";
import Link from "next/link";

function fmtEta(s) {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function variantFor(status) {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "cancelled") return "dark";
  if (status === "paused") return "warning";
  return "primary";
}

// Reads "active job ids" from localStorage and polls them.
// Auto-discovers any newly-queued job written by the send page.
export default function GlobalSendProgress() {
  const [collapsed, setCollapsed] = useState(false);
  const [job, setJob] = useState(null);
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef(null);
  const lastJobIdRef = useRef(null);

  // Watch localStorage for "active" job
  useEffect(() => {
    const refreshFromStorage = () => {
      if (typeof window === "undefined") return;
      const id = localStorage.getItem("md.activeJobId");
      if (id !== lastJobIdRef.current) {
        lastJobIdRef.current = id;
        if (id) {
          setHidden(false);
          fetchOnce(id);
        } else {
          setJob(null);
        }
      }
    };
    refreshFromStorage();
    const onStorage = () => refreshFromStorage();
    window.addEventListener("storage", onStorage);
    const tick = setInterval(refreshFromStorage, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(tick);
    };
  }, []);

  const fetchOnce = async (id) => {
    try {
      const { data } = await axios.get(`/api/admin/email-progress?jobId=${id}`);
      setJob(data);
    } catch {
      setJob(null);
    }
  };

  // Poll while a job is loaded and not terminal
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!job) return;
    const terminal = ["completed", "failed", "cancelled"].includes(job.status);
    if (terminal) return;
    timerRef.current = setInterval(() => fetchOnce(job.jobId), 1500);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.jobId, job?.status]);

  if (!job || hidden) return null;

  const variant = variantFor(job.status);
  const isLive = job.status === "running" || job.status === "queued";

  const cancel = async () => {
    if (!confirm("Cancel this send?")) return;
    await axios.post(`/api/admin/email-jobs/${job.jobId}/cancel`);
    fetchOnce(job.jobId);
  };
  const pause = async () => { await axios.post(`/api/admin/email-jobs/${job.jobId}/pause`); fetchOnce(job.jobId); };
  const resume = async () => { await axios.post(`/api/admin/email-jobs/${job.jobId}/resume`); fetchOnce(job.jobId); };

  if (collapsed) {
    return (
      <div
        className="md-fab-progress collapsed"
        onClick={() => setCollapsed(false)}
        style={{ cursor: "pointer", padding: "10px 16px" }}
      >
        <div className="d-flex align-items-center gap-2">
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: `conic-gradient(var(--md-primary) ${job.percent * 3.6}deg, var(--md-surface-2) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.7rem", fontWeight: 600,
          }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {job.percent}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>Job #{job.jobId}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--md-text-muted)" }}>
              {job.sent}/{job.total} sent
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="md-fab-progress">
      <div className="md-fab-progress-header" onClick={() => setCollapsed(true)}>
        <div className="d-flex align-items-center gap-2">
          {isLive && (
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--md-primary)",
              animation: "pulse 1.5s infinite",
            }} />
          )}
          <strong style={{ fontSize: "0.85rem" }}>
            Job #{job.jobId} · {job.status.toUpperCase()}
          </strong>
        </div>
        <div className="d-flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
            style={{ background: "transparent", border: "none", color: "var(--md-text-muted)", cursor: "pointer" }}
            title="Minimize"
          >−</button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              localStorage.removeItem("md.activeJobId");
              setHidden(true);
            }}
            style={{ background: "transparent", border: "none", color: "var(--md-text-muted)", cursor: "pointer" }}
            title="Close"
          >×</button>
        </div>
      </div>
      <div className="md-fab-progress-body">
        <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: "0.78rem" }}>
          <span className="text-muted text-truncate" style={{ maxWidth: 220 }}>{job.subject}</span>
          <strong>{job.percent}%</strong>
        </div>
        <ProgressBar
          now={job.percent}
          variant={variant}
          striped={isLive}
          animated={isLive}
          style={{ height: 8 }}
        />
        <div className="d-flex justify-content-between mt-2" style={{ fontSize: "0.75rem" }}>
          <span><span className="text-muted">Sent</span> <strong>{job.sent}</strong>/{job.total}</span>
          {job.failed > 0 && (
            <span><span className="text-muted">Failed</span> <strong className="text-danger">{job.failed}</strong></span>
          )}
          <span><span className="text-muted">ETA</span> <strong>{fmtEta(job.etaSeconds)}</strong></span>
        </div>
        <div className="d-flex gap-1 mt-3">
          <Link href={`/emails/email-send?jobId=${job.jobId}`} style={{ flex: 1 }}>
            <Button size="sm" variant="outline-primary" className="w-100">View</Button>
          </Link>
          {job.status === "running" && (
            <Button size="sm" variant="outline-warning" onClick={pause}>Pause</Button>
          )}
          {job.status === "paused" && (
            <Button size="sm" variant="outline-primary" onClick={resume}>Resume</Button>
          )}
          {(job.status === "running" || job.status === "queued" || job.status === "paused") && (
            <Button size="sm" variant="outline-danger" onClick={cancel}>Cancel</Button>
          )}
        </div>
      </div>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
