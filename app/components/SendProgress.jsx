"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, ProgressBar, Button, Badge, Modal, Table, Spinner } from "react-bootstrap";
import axios from "axios";

function fmtEta(s) {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function statusVariant(status) {
  switch (status) {
    case "running":
      return "primary";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "cancelled":
      return "secondary";
    case "paused":
      return "warning";
    default:
      return "info";
  }
}

export default function SendProgress({ jobId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFailures, setShowFailures] = useState(false);
  const [failures, setFailures] = useState([]);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const timerRef = useRef(null);

  const fetchProgress = async () => {
    try {
      const { data } = await axios.get(`/api/admin/email-progress?jobId=${jobId}`);
      setData(data);
    } catch (err) {
      console.error("progress fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    fetchProgress();
    timerRef.current = setInterval(fetchProgress, 1500);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (!data) return;
    const terminal = ["completed", "failed", "cancelled"].includes(data.status);
    if (terminal && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (data.status === "completed" && typeof window !== "undefined") {
        try {
          if (Notification?.permission === "granted") {
            new Notification("Send completed", {
              body: `${data.sent}/${data.total} delivered.`,
            });
          }
        } catch {}
      }
    }
  }, [data]);

  const cancel = async () => {
    if (!confirm("Cancel this send job?")) return;
    await axios.post(`/api/admin/email-jobs/${jobId}/cancel`);
    fetchProgress();
  };
  const pause = async () => {
    await axios.post(`/api/admin/email-jobs/${jobId}/pause`);
    fetchProgress();
  };
  const resume = async () => {
    await axios.post(`/api/admin/email-jobs/${jobId}/resume`);
    fetchProgress();
  };
  const retryFailed = async () => {
    await axios.post(`/api/admin/email-jobs/${jobId}/retry-failed`);
    fetchProgress();
  };

  const loadFailures = async () => {
    setFailuresLoading(true);
    try {
      const { data } = await axios.get(`/api/admin/email-jobs/${jobId}/failures?limit=200`);
      setFailures(data.rows || []);
    } finally {
      setFailuresLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-3">
        <Card.Body>
          <Spinner size="sm" /> Loading job…
        </Card.Body>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="mb-3">
        <Card.Body>Job not found.</Card.Body>
      </Card>
    );
  }

  const variant = statusVariant(data.status);
  const isRunning = data.status === "running" || data.status === "queued";
  const isPaused = data.status === "paused";
  const isTerminal = ["completed", "failed", "cancelled"].includes(data.status);

  return (
    <>
      <Card className="mb-3 shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h6 className="mb-1">
                Job #{data.jobId}{" "}
                <Badge bg={variant} className="text-uppercase">
                  {data.status}
                </Badge>
              </h6>
              <small className="text-muted">
                {data.subject} · source: <code>{data.source}</code>
              </small>
            </div>
            <div className="d-flex gap-1">
              {isRunning && (
                <Button size="sm" variant="warning" onClick={pause}>
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button size="sm" variant="primary" onClick={resume}>
                  Resume
                </Button>
              )}
              {(isRunning || isPaused) && (
                <Button size="sm" variant="danger" onClick={cancel}>
                  Cancel
                </Button>
              )}
              {(data.failed > 0 && isTerminal) && (
                <Button size="sm" variant="outline-primary" onClick={retryFailed}>
                  Retry failed
                </Button>
              )}
              {data.failed > 0 && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => {
                    setShowFailures(true);
                    loadFailures();
                  }}
                >
                  View failures ({data.failed})
                </Button>
              )}
              {onClose && (
                <Button size="sm" variant="outline-dark" onClick={onClose}>
                  ×
                </Button>
              )}
            </div>
          </div>

          <ProgressBar
            now={data.percent}
            label={`${data.percent}%`}
            variant={variant}
            animated={isRunning}
            striped={isRunning}
            style={{ height: 22 }}
          />

          <div className="d-flex flex-wrap gap-3 mt-2 small">
            <span>
              <strong>Sent:</strong> {data.sent}/{data.total}
            </span>
            <span>
              <strong>Failed:</strong>{" "}
              <span className={data.failed > 0 ? "text-danger" : ""}>{data.failed}</span>
            </span>
            <span>
              <strong>Skipped:</strong> {data.skipped}
            </span>
            <span>
              <strong>Rate:</strong> {data.rateLimit}/s
            </span>
            <span>
              <strong>ETA:</strong> {fmtEta(data.etaSeconds)}
            </span>
            {data.startedAt && (
              <span>
                <strong>Started:</strong> {new Date(data.startedAt).toLocaleString()}
              </span>
            )}
          </div>

          {data.lastError && (
            <div className="text-danger small mt-2">
              <strong>Last error:</strong> {data.lastError}
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showFailures} onHide={() => setShowFailures(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Failed recipients</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflow: "auto" }}>
          {failuresLoading ? (
            <Spinner />
          ) : (
            <Table size="sm" striped bordered>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Attempts</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f, i) => (
                  <tr key={i}>
                    <td>{f.email}</td>
                    <td>{f.attempts}</td>
                    <td className="small">{f.error}</td>
                  </tr>
                ))}
                {failures.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted">
                      No failures
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={retryFailed}>
            Retry all
          </Button>
          <Button variant="secondary" onClick={() => setShowFailures(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
