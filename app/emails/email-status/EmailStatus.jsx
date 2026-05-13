'use client';

import React, { useState, useEffect, useCallback } from "react";
import { Table, Spinner, Button, Form, Row, Col, Badge, Card } from "react-bootstrap";
import { PageHeader } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";
import Instructions from "@/app/components/Instructions";

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function startOfMonthIso() {
  const d = new Date();
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: "Today",      from: () => todayIso(),         to: () => todayIso() },
  { label: "Yesterday",  from: () => daysAgoIso(1),      to: () => daysAgoIso(1) },
  { label: "Last 7d",    from: () => daysAgoIso(6),      to: () => todayIso() },
  { label: "Last 30d",   from: () => daysAgoIso(29),     to: () => todayIso() },
  { label: "This month", from: () => startOfMonthIso(),  to: () => todayIso() },
];

export default function EmailTrackingPage() {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [statusCounts, setStatusCounts] = useState({});
  const [selectedBouncedEmails, setSelectedBouncedEmails] = useState([]);
  const [busy, setBusy] = useState(false);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Insights data
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Per-campaign / job filter
  const [jobFilter, setJobFilter] = useState("All"); // "All" | "untagged" | jobId
  const [campaignFilter, setCampaignFilter] = useState("All"); // "All" | "untagged" | campaignId
  const [jobsInRange, setJobsInRange] = useState([]);
  const [campaignsInRange, setCampaignsInRange] = useState([]);
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [untaggedCampaignCount, setUntaggedCampaignCount] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(false);

  const fetchJobsInRange = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setJobsLoading(true);
    try {
      const jurl = new URL("/api/admin/email-jobs/in-range", window.location.origin);
      jurl.searchParams.set("from", fromDate);
      jurl.searchParams.set("to", toDate);
      const curl = new URL("/api/admin/campaigns/in-range", window.location.origin);
      curl.searchParams.set("from", fromDate);
      curl.searchParams.set("to", toDate);
      const [jres, cres] = await Promise.all([fetch(jurl.toString()), fetch(curl.toString())]);
      const jdata = await jres.json();
      const cdata = await cres.json();
      setJobsInRange(jdata.jobs || []);
      setUntaggedCount(jdata.untaggedCount || 0);
      setCampaignsInRange(cdata.campaigns || []);
      setUntaggedCampaignCount(cdata.untaggedCount || 0);
    } catch (e) {
      console.error("jobs/campaigns in range failed", e);
      setJobsInRange([]);
      setCampaignsInRange([]);
    } finally {
      setJobsLoading(false);
    }
  }, [fromDate, toDate]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/email-status", window.location.origin);
      url.searchParams.set("from", fromDate);
      url.searchParams.set("to", toDate);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("status", statusFilter);
      if (search) url.searchParams.set("q", search);
      if (jobFilter && jobFilter !== "All") url.searchParams.set("jobId", jobFilter);
      if (campaignFilter && campaignFilter !== "All") url.searchParams.set("campaignId", campaignFilter);
      const res = await fetch(url.toString());
      const data = await res.json();
      setRecords(data.records || []);
      setTotalPages(Math.ceil((data.total || 0) / limit));
      setStatusCounts(data.counts || {});
    } catch (err) {
      console.error("Failed to fetch email records:", err);
      setRecords([]);
      setStatusCounts({});
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, page, limit, statusFilter, search, jobFilter, campaignFilter]);

  const fetchInsights = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setInsightsLoading(true);
    try {
      const url = new URL("/api/admin/email-status/insights", window.location.origin);
      url.searchParams.set("from", fromDate);
      url.searchParams.set("to", toDate);
      if (jobFilter && jobFilter !== "All") url.searchParams.set("jobId", jobFilter);
      if (campaignFilter && campaignFilter !== "All") url.searchParams.set("campaignId", campaignFilter);
      const res = await fetch(url.toString());
      setInsights(await res.json());
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }, [fromDate, toDate, jobFilter, campaignFilter]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  // Auto-refresh: poll every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchRecords();
      fetchInsights();
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchRecords, fetchInsights]);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchJobsInRange();
      fetchRecords();
    }
  }, [fetchJobsInRange, fetchRecords, fromDate, toDate]);

  // reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, jobFilter, campaignFilter, fromDate, toDate]);

  const statusColor = (status) => {
    switch (status) {
      case "Click": return "success";
      case "Open": return "info";
      case "Delivery": return "primary";
      case "Sent": return "secondary";
      case "Bounce": return "danger";
      case "Complaint": return "warning";
      default: return "secondary";
    }
  };

  const toggleEmailSelection = (email) => {
    setSelectedBouncedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const markBucketInactive = async (status) => {
    if (!fromDate || !toDate) return alert("Pick From and To dates first.");
    if (!confirm(`Mark all "${status}" emails between ${fromDate} and ${toDate} as inactive (and add to suppression)?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mark-inactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromDate, to: toDate, status, suppress: true }),
      });
      const data = await res.json();
      toast.success(data.message || `Affected: ${data.affected}`);
      fetchRecords();
    } catch (e) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const markSelectedInactive = async () => {
    if (!selectedBouncedEmails.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mark-inactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: selectedBouncedEmails, status: "Bounce", suppress: true }),
      });
      const data = await res.json();
      toast.success(data.message || `Affected: ${data.affected}`);
      setSelectedBouncedEmails([]);
      fetchRecords();
    } catch (e) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const downloadExcel = () => {
    if (!fromDate || !toDate) return alert("Please select From and To dates first.");
    const url = new URL("/api/admin/email-status/excel", window.location.origin);
    url.searchParams.set("from", fromDate);
    url.searchParams.set("to", toDate);
    url.searchParams.set("status", statusFilter);
    if (search) url.searchParams.set("q", search);
    if (jobFilter && jobFilter !== "All") url.searchParams.set("jobId", jobFilter);
    if (campaignFilter && campaignFilter !== "All") url.searchParams.set("campaignId", campaignFilter);
    window.open(url.toString(), "_blank");
  };

  const deliveredCount =
    (statusCounts.Delivery || 0) +
    (statusCounts.Open || 0) +
    (statusCounts.Click || 0) +
    (statusCounts.Complaint || 0);

  const selectedJob =
    jobFilter !== "All" && jobFilter !== "untagged"
      ? jobsInRange.find((j) => String(j.id) === String(jobFilter))
      : null;

  const fmtJobLabel = (j) => {
    const when = j.created_at ? new Date(j.created_at).toLocaleString() : "";
    const sub = (j.subject || "(no subject)").slice(0, 60);
    return `#${j.id} · ${sub}${j.subject?.length > 60 ? "…" : ""} · ${when} · ${j.event_count} evt`;
  };

  return (
    <div>
      <PageHeader
        title="Email Tracking"
        subtitle="Per-event delivery, opens, clicks, bounces and complaints"
      />

      <Instructions title="How filters compose" defaultOpen={false}>
        <ul className="mb-0 small">
          <li><strong>Date range</strong> is required and bounds every other filter.</li>
          <li><strong>Campaign</strong> groups all sends that share a campaign tag (set on the Send page).</li>
          <li><strong>Send job</strong> drills into one specific send. Combine with Campaign to scope to one send inside one campaign.</li>
          <li><strong>Status</strong> filters by the most recent event SES recorded for each message
            (<code>Sent</code> → <code>Delivery</code> → <code>Open</code> → <code>Click</code>; <code>Bounce</code>/<code>Complaint</code> override).</li>
          <li><strong>Mark all bounced/complaints inactive</strong> applies to the date range — it does NOT respect the email-search box.</li>
        </ul>
      </Instructions>

      {/* Quick date presets + auto-refresh toggle */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex gap-1 flex-wrap">
          {DATE_PRESETS.map((p) => {
            const active = fromDate === p.from() && toDate === p.to();
            return (
              <Button
                key={p.label}
                size="sm"
                variant={active ? "primary" : "outline-secondary"}
                onClick={() => { setFromDate(p.from()); setToDate(p.to()); setPage(1); }}
              >
                {p.label}
              </Button>
            );
          })}
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Form.Check
            type="switch"
            id="auto-refresh"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            label={<span className="small"><span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
              background: autoRefresh ? "var(--md-success)" : "var(--md-text-subtle)",
              marginRight: 6,
              animation: autoRefresh ? "pulse 1.5s infinite" : "none",
            }} />Auto-refresh (30s)</span>}
          />
          <Button size="sm" variant="outline-secondary" onClick={() => { fetchRecords(); fetchInsights(); }}>
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Top KPI tiles */}
      <Row className="g-3 mb-3">
        <Col md={3} sm={6}>
          <div className="md-stat"><div>
            <div className="md-stat-label">Sent</div>
            <div className="md-stat-value">{((statusCounts.Sent || 0) + (statusCounts.Delivery || 0) + (statusCounts.Open || 0) + (statusCounts.Click || 0)).toLocaleString()}</div>
            <div className="md-stat-trend">total events</div>
          </div></div>
        </Col>
        <Col md={3} sm={6}>
          <div className="md-stat"><div>
            <div className="md-stat-label">Open rate</div>
            <div className="md-stat-value" style={{ color: "var(--md-info)" }}>
              {(() => {
                const sent = (statusCounts.Sent || 0) + (statusCounts.Delivery || 0) + (statusCounts.Open || 0) + (statusCounts.Click || 0);
                const opens = (statusCounts.Open || 0) + (statusCounts.Click || 0);
                return sent > 0 ? `${Math.round((opens / sent) * 100)}%` : "—";
              })()}
            </div>
            <div className="md-stat-trend">{(statusCounts.Open || 0).toLocaleString()} opens</div>
          </div></div>
        </Col>
        <Col md={3} sm={6}>
          <div className="md-stat"><div>
            <div className="md-stat-label">Click rate</div>
            <div className="md-stat-value" style={{ color: "var(--md-success)" }}>
              {(() => {
                const sent = (statusCounts.Sent || 0) + (statusCounts.Delivery || 0) + (statusCounts.Open || 0) + (statusCounts.Click || 0);
                return sent > 0 ? `${Math.round(((statusCounts.Click || 0) / sent) * 100)}%` : "—";
              })()}
            </div>
            <div className="md-stat-trend">{(statusCounts.Click || 0).toLocaleString()} clicks</div>
          </div></div>
        </Col>
        <Col md={3} sm={6}>
          <div className="md-stat"><div>
            <div className="md-stat-label">Bounce rate</div>
            <div className="md-stat-value" style={{ color: (statusCounts.Bounce || 0) > 0 ? "var(--md-danger)" : "var(--md-text-muted)" }}>
              {(() => {
                const sent = (statusCounts.Sent || 0) + (statusCounts.Delivery || 0) + (statusCounts.Open || 0) + (statusCounts.Click || 0);
                return sent > 0 ? `${Math.round(((statusCounts.Bounce || 0) / sent) * 100)}%` : "—";
              })()}
            </div>
            <div className="md-stat-trend">{(statusCounts.Bounce || 0).toLocaleString()} bounces · {(statusCounts.Complaint || 0).toLocaleString()} complaints</div>
          </div></div>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mb-3"><Card.Body>
      <Row className="mb-2 g-2">
        <Col md={2}>
          <Form.Label>From</Form.Label>
          <Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Col>
        <Col md={2}>
          <Form.Label>To</Form.Label>
          <Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Col>
        <Col md={2}>
          <Form.Label>Status</Form.Label>
          <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="Sent">Sent</option>
            <option value="Delivery">Delivered</option>
            <option value="Open">Opened</option>
            <option value="Click">Clicked</option>
            <option value="Bounce">Bounced</option>
            <option value="Complaint">Complaints</option>
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Label>Search email</Form.Label>
          <Form.Control type="text" value={search}
            placeholder="filter by email..."
            onChange={(e) => setSearch(e.target.value)} />
        </Col>
        <Col md={3} className="d-flex align-items-end">
          <Button variant="primary" onClick={fetchRecords} disabled={!fromDate || !toDate}>Filter</Button>
          <Button variant="success" className="ms-2" onClick={downloadExcel} disabled={!fromDate || !toDate}>Download</Button>
        </Col>
      </Row>

      {/* Campaign filter — groups multiple sends under one campaign */}
      <Row className="mb-2 g-2 align-items-end">
        <Col md={9}>
          <Form.Label className="d-flex justify-content-between">
            <span>📁 Filter by campaign (groups one or many sends)</span>
            {jobsLoading && <Spinner size="sm" />}
          </Form.Label>
          <Form.Select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
          >
            <option value="All">All campaigns ({campaignsInRange.length} active in range)</option>
            {untaggedCampaignCount > 0 && (
              <option value="untagged">
                — Events not tagged to any campaign ({untaggedCampaignCount}) —
              </option>
            )}
            {campaignsInRange.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} · {c.name} · {c.job_count} send(s) · {c.event_count} evt
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3} className="text-md-end">
          <Button size="sm" variant="outline-secondary" onClick={() => setCampaignFilter("All")}>
            Reset campaign filter
          </Button>
        </Col>
      </Row>

      {/* Per-send (job) filter — drills down inside a campaign or across all */}
      <Row className="mb-3 g-2 align-items-end">
        <Col md={9}>
          <Form.Label>📨 Filter by individual send job</Form.Label>
          <Form.Select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="All">All sends ({jobsInRange.length} sends in range)</option>
            {untaggedCount > 0 && (
              <option value="untagged">
                — Untagged / pre-job-tracking events ({untaggedCount}) —
              </option>
            )}
            {jobsInRange.map((j) => (
              <option key={j.id} value={j.id}>
                {fmtJobLabel(j)}
              </option>
            ))}
          </Form.Select>
          {selectedJob && (
            <small className="text-muted d-block mt-1">
              Source: <code>{selectedJob.source}</code> · Total queued: <strong>{selectedJob.total}</strong> ·
              Sent: <strong>{selectedJob.sent}</strong> ·
              Failed: <strong>{selectedJob.failed}</strong> ·
              Status: <Badge bg="info">{selectedJob.job_status}</Badge>
            </small>
          )}
        </Col>
        <Col md={3} className="text-md-end">
          <Button size="sm" variant="outline-secondary" onClick={() => setJobFilter("All")}>
            Reset send filter
          </Button>
        </Col>
      </Row>
      </Card.Body></Card>

      {/* Summary */}
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap gap-3">
          <Badge bg="dark" className="fs-6">Events on page: <strong>{records.length}</strong></Badge>
          <Badge bg="secondary" className="fs-6">Unique emails (page): <strong>{new Set(records.map(r => r.email)).size}</strong></Badge>
          <Badge bg="secondary" className="fs-6">Sent: <strong>{statusCounts.Sent || 0}</strong></Badge>
          <Badge bg="primary" className="fs-6">Delivered: <strong>{deliveredCount}</strong></Badge>
          <Badge bg="primary" className="fs-6">Delivered (not opened): <strong>{statusCounts.Delivery || 0}</strong></Badge>
          <Badge bg="info" className="fs-6">Opened: <strong>{statusCounts.Open || 0}</strong></Badge>
          <Badge bg="success" className="fs-6">Clicked: <strong>{statusCounts.Click || 0}</strong></Badge>
          <Badge bg="danger" className="fs-6">Bounced: <strong>{statusCounts.Bounce || 0}</strong></Badge>
          <Badge bg="warning" className="fs-6">Complaints: <strong>{statusCounts.Complaint || 0}</strong></Badge>
        </div>
      </div>

      {/* INSIGHTS — top links, domains, recipients */}
      {insights && (
        <Row className="g-3 mb-3">
          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h6>🔗 Top clicked links</h6>
              {insightsLoading ? <Spinner size="sm" /> :
                insights.topLinks.length === 0 ? (
                  <p className="text-muted small mb-0">No clicks in this range yet.</p>
                ) : (
                  <Table size="sm" className="mb-0 small">
                    <thead><tr><th>Link</th><th style={{ width: 80 }}>Clicks</th><th style={{ width: 90 }}>Unique</th></tr></thead>
                    <tbody>
                      {insights.topLinks.map((l, i) => (
                        <tr key={i}>
                          <td className="text-truncate" style={{ maxWidth: 360 }}>
                            <a href={l.link} target="_blank" rel="noreferrer" title={l.link}>{l.link}</a>
                          </td>
                          <td><strong>{l.clicks}</strong></td>
                          <td>{l.unique_clickers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
            </Card.Body></Card>
          </Col>
          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h6>🌐 By recipient domain</h6>
              {insightsLoading ? <Spinner size="sm" /> :
                insights.domains.length === 0 ? (
                  <p className="text-muted small mb-0">No data.</p>
                ) : (
                  <Table size="sm" className="mb-0 small">
                    <thead>
                      <tr>
                        <th>Domain</th><th>Sent</th>
                        <th>Open%</th><th>Click%</th><th>Bounce%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.domains.slice(0, 8).map((d, i) => {
                        const total = d.sent + d.delivered + d.opened + d.clicked;
                        const op = total ? Math.round(((d.opened + d.clicked) / total) * 100) : 0;
                        const cp = total ? Math.round((d.clicked / total) * 100) : 0;
                        const bp = total ? Math.round((d.bounced / total) * 100) : 0;
                        return (
                          <tr key={i}>
                            <td><code>@{d.domain}</code></td>
                            <td>{total}</td>
                            <td><span className="text-info">{op}%</span></td>
                            <td><span className="text-success">{cp}%</span></td>
                            <td><span className={bp > 5 ? "text-danger" : "text-muted"}>{bp}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
            </Card.Body></Card>
          </Col>

          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h6>🏆 Most engaged recipients</h6>
              {insightsLoading ? <Spinner size="sm" /> :
                insights.topRecipients.length === 0 ? (
                  <p className="text-muted small mb-0">No engagement yet.</p>
                ) : (
                  <Table size="sm" className="mb-0 small">
                    <thead><tr><th>Email</th><th>Opens</th><th>Clicks</th></tr></thead>
                    <tbody>
                      {insights.topRecipients.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          <td>{r.email}</td>
                          <td><span className="text-info">{r.opens}</span></td>
                          <td><strong className="text-success">{r.clicks}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
            </Card.Body></Card>
          </Col>

          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h6>⏰ Opens by hour of day</h6>
              {insightsLoading ? <Spinner size="sm" /> :
                insights.hourly.length === 0 ? (
                  <p className="text-muted small mb-0">No opens yet.</p>
                ) : (
                  <div className="d-flex align-items-end gap-1" style={{ height: 80 }}>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const row = insights.hourly.find((x) => x.hour === h);
                      const max = Math.max(...insights.hourly.map((x) => x.opens), 1);
                      const v = row?.opens || 0;
                      const pct = (v / max) * 100;
                      return (
                        <div key={h} title={`${h}:00 — ${v} opens`} style={{ flex: 1, textAlign: "center" }}>
                          <div style={{
                            height: `${pct}%`, background: v > 0 ? "var(--md-info)" : "var(--md-surface-2)",
                            borderRadius: 2, transition: "all 0.2s",
                          }} />
                          <div style={{ fontSize: "0.65rem", color: "var(--md-text-subtle)" }}>{h}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </Card.Body></Card>
          </Col>
        </Row>
      )}

      <div className="mb-3 d-flex gap-2 flex-wrap">
        <Button variant="warning" disabled={busy || !fromDate || !toDate}
          onClick={() => markBucketInactive("Bounce")}>Mark all bounced inactive (range)</Button>
        <Button variant="warning" disabled={busy || !fromDate || !toDate}
          onClick={() => markBucketInactive("Complaint")}>Mark all complaints inactive (range)</Button>
        <Button variant="danger" disabled={busy || !selectedBouncedEmails.length}
          onClick={markSelectedInactive}>Mark selected inactive ({selectedBouncedEmails.length})</Button>
      </div>

      {loading ? (
        <div className="text-center"><Spinner animation="border" /></div>
      ) : (
        <>
          <Table striped bordered hover responsive size="sm">
            <thead>
              <tr>
                <th>#</th><th>Email</th><th>Status</th><th>Job</th>
                <th>Link</th><th>IP</th><th>User Agent</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec, idx) => {
                const isBounced = rec.status === "Bounce" || rec.status === "Complaint";
                const isChecked = selectedBouncedEmails.includes(rec.email);
                return (
                  <tr key={`${rec.messageId}-${idx}`}>
                    <td>
                      {isBounced && (
                        <Form.Check
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEmailSelection(rec.email)}
                        />
                      )}{" "}
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td>{rec.email}</td>
                    <td><span className={`badge bg-${statusColor(rec.status)}`}>{rec.status}</span></td>
                    <td>
                      {rec.job_id ? (
                        <Button size="sm" variant="link" className="p-0"
                          onClick={() => setJobFilter(String(rec.job_id))}>
                          #{rec.job_id}
                        </Button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 200, overflowWrap: "break-word" }}>{rec.link || "-"}</td>
                    <td>{rec.ip || "-"}</td>
                    <td style={{ maxWidth: 200, overflowWrap: "break-word" }}>{rec.userAgent || "-"}</td>
                    <td>{new Date(rec.eventTime).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <div className="d-flex justify-content-between align-items-center">
            <Button variant="outline-secondary" onClick={() => setPage(page - 1)} disabled={page <= 1}>← Prev</Button>
            <span>Page {page} of {totalPages}</span>
            <Button variant="outline-secondary" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Next →</Button>
          </div>
        </>
      )}
    </div>
  );
}
