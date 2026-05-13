"use client";

import React, { useEffect, useState } from "react";
import { Container, Row, Col, Button, ProgressBar, Spinner, Table, Badge } from "react-bootstrap";
import Link from "next/link";
import axios from "axios";
import { StatCard, StatusBadge, PageHeader, EmptyState } from "./components/AppNav";

function todayIso() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
function daysAgoIso(n) { const d = new Date(); d.setDate(d.getDate()-n); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }

export default function Home() {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [eventCounts, setEventCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, j, e, c, h] = await Promise.all([
          axios.get("/api/admin/emails/stats"),
          axios.get("/api/admin/email-jobs?limit=8"),
          axios.get(`/api/admin/email-status?from=${daysAgoIso(7)}&to=${todayIso()}&page=1&limit=1`),
          axios.get("/api/admin/campaigns?with_stats=1&limit=6"),
          axios.get("/api/health").catch(() => null),
        ]);
        setStats(s.data);
        setJobs(j.data.rows || []);
        setEventCounts(e.data.counts || {});
        setCampaigns(c.data || []);
        setHealth(h?.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <Container className="py-5 text-center"><Spinner /></Container>;
  }

  const overall = stats?.overall || { total: 0, active: 0, inactive: 0 };
  const sentTotal = (eventCounts.Sent || 0) + (eventCounts.Delivery || 0) + (eventCounts.Open || 0) + (eventCounts.Click || 0);
  const delivered = (eventCounts.Delivery || 0) + (eventCounts.Open || 0) + (eventCounts.Click || 0);
  const opens = eventCounts.Open || 0;
  const clicks = eventCounts.Click || 0;
  const bounces = eventCounts.Bounce || 0;
  const complaints = eventCounts.Complaint || 0;

  const deliveryRate = sentTotal > 0 ? Math.round((delivered / sentTotal) * 100) : 0;
  const openRate = sentTotal > 0 ? Math.round(((opens + clicks) / sentTotal) * 100) : 0;
  const clickRate = sentTotal > 0 ? Math.round((clicks / sentTotal) * 100) : 0;
  const bounceRate = sentTotal > 0 ? Math.round((bounces / sentTotal) * 100) : 0;

  return (
    <Container fluid>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back. Here's what's happening across your email program."
        actions={
          <>
            <Link href="/emails/email-send"><Button variant="primary">✉️ New Send</Button></Link>
            <Link href="/admin/upload-excel"><Button variant="outline-primary">⬆️ Import</Button></Link>
          </>
        }
      />


      {/* KPI cards */}
      <Row className="g-3 mb-4">
        <Col md={3} sm={6}><StatCard label="Subscribers" value={overall.total.toLocaleString()} icon="👥" hint={`${overall.active.toLocaleString()} active`} /></Col>
        <Col md={3} sm={6}><StatCard label="Suppressions" value={(stats?.suppressions || 0).toLocaleString()} icon="🚫" /></Col>
        <Col md={3} sm={6}><StatCard label="Categories" value={stats?.categories?.length || 0} icon="🏷️" /></Col>
        <Col md={3} sm={6}><StatCard label="Sends (7d)" value={sentTotal.toLocaleString()} icon="📨" /></Col>
      </Row>

      {/* Funnel (7 days) */}
      <Row className="g-3 mb-4">
        <Col md={8}>
          <div className="md-card"><div className="md-card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="mb-0">Last 7 days · Engagement funnel</h6>
                <small className="text-muted">{daysAgoIso(7)} → {todayIso()}</small>
              </div>
              <Link href="/emails/email-status" className="small">View tracking →</Link>
            </div>

            {sentTotal === 0 ? (
              <EmptyState icon="📭" title="No activity yet" hint="Send your first email to see analytics." action={<Link href="/emails/email-send"><Button variant="primary">Compose</Button></Link>} />
            ) : (
              <>
                <Row className="g-2 mb-3">
                  <Col><Stat name="Delivery" pct={deliveryRate} color="var(--md-info)" raw={delivered} /></Col>
                  <Col><Stat name="Open" pct={openRate} color="var(--md-primary)" raw={opens + clicks} /></Col>
                  <Col><Stat name="Click" pct={clickRate} color="var(--md-success)" raw={clicks} /></Col>
                  <Col><Stat name="Bounce" pct={bounceRate} color="var(--md-danger)" raw={bounces} /></Col>
                </Row>

                <div className="d-flex flex-wrap gap-2 small text-muted">
                  <span>Sent: <strong className="text-dark">{eventCounts.Sent || 0}</strong></span>
                  <span>· Delivered: <strong className="text-dark">{eventCounts.Delivery || 0}</strong></span>
                  <span>· Opened: <strong className="text-dark">{opens}</strong></span>
                  <span>· Clicked: <strong className="text-dark">{clicks}</strong></span>
                  <span>· Bounced: <strong className="text-dark">{bounces}</strong></span>
                  <span>· Complaints: <strong className="text-dark">{complaints}</strong></span>
                </div>
              </>
            )}
          </div></div>
        </Col>

        <Col md={4}>
          <div className="md-card h-100"><div className="md-card-body">
            <h6>System health</h6>
            <div className="mt-3">
              <Row className="g-2">
                <Col><div className="d-flex justify-content-between align-items-center mb-2"><span className="small">Database</span>{health?.db ? <Badge bg="success">OK</Badge> : <Badge bg="danger">DOWN</Badge>}</div></Col>
              </Row>
              <Row className="g-2">
                <Col><div className="d-flex justify-content-between align-items-center mb-2"><span className="small">API</span>{health?.ok ? <Badge bg="success">OK</Badge> : <Badge bg="warning">CHECK</Badge>}</div></Col>
              </Row>
              <Row className="g-2">
                <Col><div className="d-flex justify-content-between align-items-center mb-2"><span className="small">Worker</span><Badge bg="info">running</Badge></div></Col>
              </Row>
              <hr />
              <small className="text-muted">Last check {health?.time ? new Date(health.time).toLocaleTimeString() : "—"}</small>
            </div>
          </div></div>
        </Col>
      </Row>

      {/* Categories + Campaigns */}
      <Row className="g-3 mb-4">
        <Col md={6}>
          <div className="md-card h-100"><div className="md-card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Subscribers by category</h6>
              <Link href="/emails/category" className="small">Manage →</Link>
            </div>
            {(stats?.categories || []).length === 0 ? (
              <p className="text-muted small">No categories yet.</p>
            ) : (
              stats.categories.slice(0, 6).map((c) => {
                const pct = overall.total > 0 ? Math.round((c.total / overall.total) * 100) : 0;
                return (
                  <div key={c.id} className="mb-2">
                    <div className="d-flex justify-content-between small mb-1">
                      <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.color, marginRight: 6 }} />{c.name}</span>
                      <span className="text-muted">{c.total} · {pct}%</span>
                    </div>
                    <ProgressBar now={pct} style={{ height: 6 }}><ProgressBar now={pct} style={{ background: c.color }} /></ProgressBar>
                  </div>
                );
              })
            )}
          </div></div>
        </Col>

        <Col md={6}>
          <div className="md-card h-100"><div className="md-card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Top campaigns</h6>
              <Link href="/emails/campaigns" className="small">View all →</Link>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-muted small">No campaigns yet.</p>
            ) : (
              campaigns.slice(0, 5).map((c) => (
                <div key={c.id} className="d-flex justify-content-between align-items-center py-2" style={{ borderBottom: "1px solid var(--md-border)" }}>
                  <div className="text-truncate me-2">
                    <Link href={`/emails/email-status?campaignId=${c.id}&from=${(c.created_at || "").slice(0, 10)}&to=${todayIso()}`} className="fw-semibold">{c.name}</Link>
                    <div className="small text-muted text-truncate">{c.subject}</div>
                  </div>
                  <div className="text-end">
                    <div className="small"><strong>{c.total_sent}</strong> sent</div>
                    <small className="text-muted">{c.job_count} send{c.job_count !== 1 ? "s" : ""}</small>
                  </div>
                </div>
              ))
            )}
          </div></div>
        </Col>
      </Row>

      {/* Recent jobs */}
      <div className="md-card mb-4"><div className="md-card-body p-0">
        <div className="md-card-header" style={{ borderBottom: "1px solid var(--md-border)" }}>
          <span>Recent send jobs</span>
          <Link href="/emails/jobs" className="small">View all →</Link>
        </div>
        {jobs.length === 0 ? (
          <EmptyState icon="📋" title="No send jobs yet" />
        ) : (
          <Table hover responsive className="mb-0">
            <thead>
              <tr><th>#</th><th>Subject</th><th>Source</th><th>Status</th><th>Progress</th><th>Started</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const done = (j.sent || 0) + (j.failed || 0) + (j.skipped || 0);
                const pct = j.total > 0 ? Math.round((done / j.total) * 100) : 0;
                return (
                  <tr key={j.id}>
                    <td>#{j.id}</td>
                    <td className="text-truncate" style={{ maxWidth: 320 }}>
                      <Link href={`/emails/email-send?jobId=${j.id}`}>{j.subject}</Link>
                    </td>
                    <td><Badge bg="light" text="dark">{j.source}</Badge></td>
                    <td><StatusBadge status={j.status} /></td>
                    <td style={{ minWidth: 200 }}>
                      <ProgressBar now={pct} label={`${pct}%`} style={{ height: 14 }} />
                      <small className="text-muted">{j.sent}/{j.total}</small>
                    </td>
                    <td><small className="text-muted">{j.started_at ? new Date(j.started_at).toLocaleString() : "—"}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div></div>
    </Container>
  );
}

function Stat({ name, pct, color, raw }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--md-surface-2)", borderRadius: 8 }}>
      <div className="d-flex justify-content-between mb-1">
        <span className="small text-muted">{name}</span>
        <strong style={{ color }}>{pct}%</strong>
      </div>
      <ProgressBar now={pct} style={{ height: 4, background: "white" }}>
        <ProgressBar now={pct} style={{ background: color }} />
      </ProgressBar>
      <small className="text-muted">{(raw || 0).toLocaleString()}</small>
    </div>
  );
}
