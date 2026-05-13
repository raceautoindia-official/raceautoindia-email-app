"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Container, Card, Table, Button, Form, Modal, Spinner, Badge, Pagination, Row, Col,
} from "react-bootstrap";
import axios from "axios";
import { PageHeader, EmptyState } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";
import Instructions from "@/app/components/Instructions";

const REASON_VARIANT = {
  bounce: "danger",
  complaint: "warning",
  unsubscribe: "secondary",
  manual: "dark",
};
const PER_PAGE = 50;

export default function SuppressionsList() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkReason, setBulkReason] = useState("manual");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PER_PAGE));
      if (reason !== "all") params.set("reason", reason);
      if (q) params.set("q", q);
      const { data } = await axios.get(`/api/admin/suppressions?${params}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error("Failed to load suppressions");
    } finally {
      setLoading(false);
    }
  }, [page, reason, q, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { setPage(1); }, [reason, q]);

  const remove = async (email) => {
    if (!confirm(`Remove ${email} from suppression list? They will be eligible to receive emails again.`)) return;
    try {
      await axios.delete(`/api/admin/suppressions?email=${encodeURIComponent(email)}`);
      toast.success(`Removed ${email}`);
      load();
    } catch (e) {
      toast.error("Failed");
    }
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const entries = bulkText
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
        .map((email) => ({ email, reason: bulkReason }));
      if (!entries.length) {
        toast.warning("No valid emails to add");
        return;
      }
      const { data } = await axios.post(`/api/admin/suppressions`, { entries });
      toast.success(`Added ${data.added} suppression(s)`);
      setBulkText("");
      setShowAdd(false);
      load();
    } catch (e) {
      toast.error("Add failed");
    } finally {
      setAdding(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <Container fluid>
      <PageHeader
        title="Suppressions"
        subtitle={`${total} address${total === 1 ? "" : "es"} blocked from receiving email`}
        actions={<Button variant="primary" onClick={() => setShowAdd(true)}>+ Add to suppression</Button>}
      />

      <Instructions title="Automation status — how addresses end up here" variant="success" defaultOpen={true}>
        <p className="mb-2 small">
          The suppression list is fully automated. You don't need to manage it manually unless you want to.
        </p>
        <Table size="sm" bordered className="mb-2 small" style={{ background: "white" }}>
          <thead>
            <tr><th>Trigger</th><th>What gets recorded</th><th>Source label</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Hard bounce</strong></td>
              <td>SES SNS callback marks the address as <code>Permanent</code> bounce. Auto-suppressed and unsubscribed.</td>
              <td><Badge bg="danger">bounce</Badge></td>
            </tr>
            <tr>
              <td><strong>Spam complaint</strong></td>
              <td>Recipient hits "Mark as spam". Auto-suppressed and unsubscribed.</td>
              <td><Badge bg="warning">complaint</Badge></td>
            </tr>
            <tr>
              <td><strong>Unsubscribe link click</strong></td>
              <td>Recipient clicks <code>{"{{unsubscribe_link}}"}</code>. Auto-suppressed and unsubscribed.</td>
              <td><Badge bg="secondary">unsubscribe</Badge></td>
            </tr>
            <tr>
              <td><strong>Bulk "Mark inactive"</strong></td>
              <td>Admin uses Tracking page → Mark all bounced/complaints inactive. Adds with original reason.</td>
              <td><Badge bg="danger">bounce</Badge> / <Badge bg="warning">complaint</Badge></td>
            </tr>
            <tr>
              <td><strong>Admin paste</strong></td>
              <td>Manually pasted via the "+ Add to suppression" button on this page.</td>
              <td><Badge bg="dark">manual</Badge></td>
            </tr>
          </tbody>
        </Table>
        <p className="mb-1 small">
          Every send goes through this list <strong>before</strong> SES is called — suppressed addresses are never charged or delivered to.
        </p>
      </Instructions>

      <Instructions title="What removing does" defaultOpen={false}>
        <p className="mb-0 small">
          Removing takes the address off the suppression list <em>but does not resubscribe them</em>.
          To re-enable mail to that recipient: remove them here, then flip them to Active in the Subscribers page.
          Be careful — re-mailing a hard-bounced address damages your SES reputation.
        </p>
      </Instructions>

      <Instructions title="Excel-only sends — does unsubscribe still work?" variant="success" defaultOpen={false}>
        <p className="mb-2 small">
          <strong>Yes.</strong> The suppression list is independent of the subscribers table.
          When a recipient unsubscribes — whether they were imported as a subscriber or only existed
          in an Excel file you sent to — they're added here directly.
        </p>
        <p className="mb-0 small">
          For Excel-only addresses we also auto-create a row in the Subscribers list (status: Inactive,
          category: General) with a note explaining how it got there, so you have visibility into the
          unsubscribe history.
        </p>
      </Instructions>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={6}>
              <Form.Control placeholder="Search email..." value={q} onChange={(e) => setQ(e.target.value)} />
            </Col>
            <Col md={6} className="d-flex gap-2">
              {["all", "bounce", "complaint", "unsubscribe", "manual"].map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={reason === r ? "primary" : "outline-secondary"}
                  onClick={() => setReason(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Button>
              ))}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="✅"
              title="Suppression list is empty"
              hint="Hard bounces and complaints from SES will appear here automatically."
            />
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Email</th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th>Notes</th>
                  <th>Added</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td><code>{r.email}</code></td>
                    <td><Badge bg={REASON_VARIANT[r.reason] || "secondary"}>{r.reason}</Badge></td>
                    <td><small className="text-muted">{r.source || "—"}</small></td>
                    <td><small>{r.notes || "—"}</small></td>
                    <td><small className="text-muted">{new Date(r.created_at).toLocaleString()}</small></td>
                    <td>
                      <Button size="sm" variant="outline-danger" onClick={() => remove(r.email)}>
                        Remove
                      </Button>
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

      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add to suppression list</Modal.Title>
        </Modal.Header>
        <Form onSubmit={submitAdd}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Reason</Form.Label>
              <Form.Select value={bulkReason} onChange={(e) => setBulkReason(e.target.value)}>
                <option value="manual">Manual</option>
                <option value="unsubscribe">Unsubscribe</option>
                <option value="bounce">Bounce</option>
                <option value="complaint">Complaint</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Emails (one per line, comma or semicolon-separated)</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="user@example.com&#10;another@example.com"
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={adding}>
              {adding ? <Spinner size="sm" /> : "Add"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}
