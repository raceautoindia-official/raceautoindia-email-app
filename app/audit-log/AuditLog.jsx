"use client";

import React, { useEffect, useState } from "react";
import { Container, Card, Table, Badge, Spinner, Pagination, Form } from "react-bootstrap";
import axios from "axios";
import { PageHeader, EmptyState } from "@/app/components/AppNav";

const PER_PAGE = 50;

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PER_PAGE));
        params.set("offset", String((page - 1) * PER_PAGE));
        if (filter) params.set("action", filter);
        const { data } = await axios.get(`/api/admin/audit-log?${params}`);
        setRows(data.rows || []);
        setTotal(data.total || 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, filter]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <Container fluid>
      <PageHeader
        title="Audit Log"
        subtitle="Every administrative action recorded by the system"
      />

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Form.Control
            placeholder="Filter by action (e.g. bulk:unsubscribe, mark_inactive)"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          />
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon="🗂️" title="No audit entries yet" hint="Admin actions will appear here." />
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><small className="text-muted">{new Date(r.created_at).toLocaleString()}</small></td>
                    <td>{r.actor || <span className="text-muted">system</span>}</td>
                    <td><Badge bg="dark"><code style={{ background: "transparent", color: "white" }}>{r.action}</code></Badge></td>
                    <td>
                      {r.target_type ? (
                        <small><span className="text-muted">{r.target_type}</span>{r.target_id ? `:${r.target_id}` : ""}</small>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {r.payload ? (
                        <code className="small text-truncate d-inline-block" style={{ maxWidth: 320 }} title={JSON.stringify(r.payload)}>
                          {JSON.stringify(r.payload)}
                        </code>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-3">
          <Pagination>
            <Pagination.Prev disabled={page === 1} onClick={() => setPage(page - 1)} />
            <Pagination.Item active>{page}</Pagination.Item>
            <Pagination.Next disabled={page === totalPages} onClick={() => setPage(page + 1)} />
          </Pagination>
        </div>
      )}
    </Container>
  );
}
