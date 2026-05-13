"use client";

import React, { useEffect, useState } from "react";
import {
  Container, Card, Table, Button, Form, Modal, Spinner, Badge, Row, Col,
} from "react-bootstrap";
import Link from "next/link";
import axios from "axios";
import { PageHeader, EmptyState } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";

const blank = { id: 0, name: "", subject: "", html_body: "" };

export default function CampaignsList() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [mode, setMode] = useState("create");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("with_stats", "1");
      if (search) params.set("q", search);
      const { data } = await axios.get(`/api/admin/campaigns?${params}`);
      setRows(data || []);
    } catch (e) {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => { setForm(blank); setMode("create"); setShow(true); };
  const openEdit = (c) => {
    setForm({ id: c.id, name: c.name, subject: c.subject, html_body: c.html_body || "" });
    setMode("edit");
    setShow(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "create") {
        await axios.post(`/api/admin/campaigns`, form);
        toast.success("Campaign created");
      } else {
        await axios.put(`/api/admin/campaigns/${form.id}`, form);
        toast.success("Campaign updated");
      }
      setShow(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    const total = Number(c.job_count) || 0;
    if (!confirm(total
      ? `"${c.name}" has ${total} send job(s). Deleting will keep the jobs but un-link them.`
      : `Delete campaign "${c.name}"?`)) return;
    try {
      await axios.delete(`/api/admin/campaigns/${c.id}`);
      toast.success("Campaign deleted");
      load();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  return (
    <Container fluid>
      <PageHeader
        title="Campaigns"
        subtitle="Group multiple sends into a campaign for combined tracking"
        actions={<Button variant="primary" onClick={openCreate}>+ New campaign</Button>}
      />

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Form.Control
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="📁"
              title="No campaigns yet"
              hint="Create one, or pick 'New campaign' on the send page to auto-create."
              action={<Button variant="primary" onClick={openCreate}>+ Create campaign</Button>}
            />
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Sends</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Created</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="text-truncate" style={{ maxWidth: 280 }} title={c.subject}>{c.subject}</td>
                    <td><Badge bg="primary">{c.job_count || 0}</Badge></td>
                    <td>{c.total_recipients || 0}</td>
                    <td className="text-success">{c.total_sent || 0}</td>
                    <td className={c.total_failed > 0 ? "text-danger" : "text-muted"}>{c.total_failed || 0}</td>
                    <td><small className="text-muted">{new Date(c.created_at).toLocaleDateString()}</small></td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <Link href={`/emails/email-send?campaign_id=${c.id}`}>
                          <Button size="sm" variant="outline-primary">📤 Send</Button>
                        </Link>
                        <Link href={`/emails/email-status?campaignId=${c.id}&from=${(c.created_at || "").slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`}>
                          <Button size="sm" variant="outline-info">📊 Track</Button>
                        </Link>
                        <Button size="sm" variant="outline-secondary" onClick={() => openEdit(c)}>Edit</Button>
                        <Button size="sm" variant="outline-danger" onClick={() => remove(c)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{mode === "create" ? "New campaign" : `Edit "${form.name}"`}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. May Newsletter 2026"
                />
              </Col>
              <Col md={6}>
                <Form.Label>Default subject</Form.Label>
                <Form.Control
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Your monthly digest"
                />
              </Col>
              <Col md={12}>
                <Form.Label>Default HTML body (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={form.html_body || ""}
                  onChange={(e) => setForm({ ...form, html_body: e.target.value })}
                  placeholder="<html>...</html>"
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : mode === "create" ? "Create" : "Save"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}
