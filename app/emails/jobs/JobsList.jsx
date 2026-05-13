"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Container, Card, Table, Button, Form, Spinner, ProgressBar, Pagination, Badge,
} from "react-bootstrap";
import Link from "next/link";
import axios from "axios";
import { PageHeader, StatusBadge, EmptyState } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";

const STATUSES = ["", "queued", "running", "paused", "completed", "failed", "cancelled"];
const PER_PAGE = 25;

export default function JobsList() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PER_PAGE));
      params.set("offset", String((page - 1) * PER_PAGE));
      if (statusFilter) params.set("status", statusFilter);
      const { data } = await axios.get(`/api/admin/email-jobs?${params}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const action = async (id, verb) => {
    try {
      await axios.post(`/api/admin/email-jobs/${id}/${verb}`);
      toast.success(`Job #${id} ${verb}`);
      fetchJobs();
    } catch (e) {
      toast.error(`${verb} failed`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <Container fluid>
      <PageHeader
        title="Job History"
        subtitle={`${total} send job${total === 1 ? "" : "s"}`}
        actions={
          <Link href="/emails/email-send"><Button variant="primary">📤 New Send</Button></Link>
        }
      />

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <Form.Label className="mb-0 me-2">Filter status:</Form.Label>
            {STATUSES.map((s) => (
              <Button
                key={s || "all"}
                size="sm"
                variant={statusFilter === s ? "primary" : "outline-secondary"}
                onClick={() => setStatusFilter(s)}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
              </Button>
            ))}
          </div>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No send jobs yet"
              hint="Run your first campaign to see job history here."
              action={<Link href="/emails/email-send"><Button variant="primary">Start a send</Button></Link>}
            />
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th>Subject</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th style={{ minWidth: 200 }}>Progress</th>
                  <th>Failed</th>
                  <th>Rate</th>
                  <th>Started</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const done = (j.sent || 0) + (j.failed || 0) + (j.skipped || 0);
                  const pct = j.total > 0 ? Math.round((done / j.total) * 100) : 0;
                  return (
                    <tr key={j.id}>
                      <td><strong>#{j.id}</strong></td>
                      <td>
                        <Link href={`/emails/email-send?jobId=${j.id}`}>
                          {j.subject || <em>(no subject)</em>}
                        </Link>
                      </td>
                      <td><Badge bg="light" text="dark">{j.source}</Badge></td>
                      <td><StatusBadge status={j.status} /></td>
                      <td>
                        <ProgressBar
                          now={pct}
                          label={`${pct}%`}
                          variant={j.status === "completed" ? "success" : j.status === "failed" ? "danger" : "primary"}
                          striped={j.status === "running"}
                          animated={j.status === "running"}
                        />
                        <small className="text-muted">{j.sent}/{j.total} sent</small>
                      </td>
                      <td>
                        {j.failed > 0 ? <span className="text-danger">{j.failed}</span> : <span className="text-muted">0</span>}
                      </td>
                      <td>{j.rate_limit}/s</td>
                      <td>
                        <small className="text-muted">
                          {j.started_at ? new Date(j.started_at).toLocaleString() : "—"}
                        </small>
                      </td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          <Link href={`/emails/email-send?jobId=${j.id}`}>
                            <Button size="sm" variant="outline-primary">View</Button>
                          </Link>
                          <Link href={`/emails/email-status?jobId=${j.id}&from=${(j.created_at || "").slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`}>
                            <Button size="sm" variant="outline-info">Track</Button>
                          </Link>
                          {(j.status === "running") && (
                            <Button size="sm" variant="outline-warning" onClick={() => action(j.id, "pause")}>Pause</Button>
                          )}
                          {(j.status === "paused") && (
                            <Button size="sm" variant="outline-primary" onClick={() => action(j.id, "resume")}>Resume</Button>
                          )}
                          {(j.status === "running" || j.status === "queued" || j.status === "paused") && (
                            <Button size="sm" variant="outline-danger" onClick={() => action(j.id, "cancel")}>Cancel</Button>
                          )}
                          {j.failed > 0 && (j.status === "completed" || j.status === "failed") && (
                            <Button size="sm" variant="outline-success" onClick={() => action(j.id, "retry-failed")}>
                              Retry failed
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-3">
          <Pagination>
            <Pagination.First disabled={page === 1} onClick={() => setPage(1)} />
            <Pagination.Prev disabled={page === 1} onClick={() => setPage(page - 1)} />
            <Pagination.Item active>{page}</Pagination.Item>
            <Pagination.Next disabled={page === totalPages} onClick={() => setPage(page + 1)} />
            <Pagination.Last disabled={page === totalPages} onClick={() => setPage(totalPages)} />
          </Pagination>
        </div>
      )}
    </Container>
  );
}
