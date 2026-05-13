"use client";

import React, { useEffect, useState } from "react";
import { Button, Form, Spinner, Badge, Tab, Tabs } from "react-bootstrap";
import axios from "axios";
import { useToast } from "./Toast";
import CategoryChips from "./CategoryChips";
import CategoryPicker from "./CategoryPicker";

const STATUS_COLOR = {
  Sent: "secondary",
  Delivery: "primary",
  Open: "info",
  Click: "success",
  Bounce: "danger",
  Complaint: "warning",
};

export default function SubscriberDrawer({ email, categories, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showPicker, setShowPicker] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/admin/emails/${encodeURIComponent(email)}/timeline`);
      setData(data);
      setForm({
        first_name: data.subscriber.first_name || "",
        last_name: data.subscriber.last_name || "",
        notes: data.subscriber.notes || "",
        subscribe: data.subscriber.subscribe === 1,
      });
    } catch (e) {
      toast.error("Failed to load subscriber");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [email]);

  const save = async () => {
    try {
      await axios.patch(`/api/admin/emails/${encodeURIComponent(email)}/timeline`, form);
      toast.success("Saved");
      setEditing(false);
      load();
      onChanged?.();
    } catch (e) {
      toast.error("Save failed");
    }
  };

  const sendSingle = async () => {
    const subject = prompt("Subject:");
    if (!subject) return;
    const message = prompt("HTML body:");
    if (!message) return;
    try {
      const { data } = await axios.post("/api/admin/email-send/test-email", {
        recipient: email, subject, message,
      });
      if (data.success) toast.success(`Sent to ${email}`);
      else toast.error(data.error || "Failed");
    } catch (e) {
      toast.error("Failed");
    }
  };

  if (loading) {
    return (
      <>
        <div className="md-drawer-backdrop" onClick={onClose} />
        <div className="md-drawer">
          <div className="md-drawer-header">
            <strong>{email}</strong>
            <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
          </div>
          <div className="md-drawer-body text-center"><Spinner /></div>
        </div>
      </>
    );
  }

  if (!data) return null;
  const s = data.subscriber;
  const c = data.counts;
  const openRate = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0;
  const clickRate = c.opened > 0 ? Math.round((c.clicked / c.opened) * 100) : 0;

  return (
    <>
      <div className="md-drawer-backdrop" onClick={onClose} />
      <div className="md-drawer">
        <div className="md-drawer-header">
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--md-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subscriber</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{email}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--md-text-muted)" }}
            title="Close"
          >×</button>
        </div>

        <div className="md-drawer-body">
          {/* Status + actions */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Badge bg={s.subscribe === 1 ? "success" : "secondary"}>
              {s.subscribe === 1 ? "Active" : "Inactive"}
            </Badge>
            {data.suppressed && (
              <Badge bg="danger" title={data.suppressed.reason}>Suppressed</Badge>
            )}
            <span className="text-muted small">
              Created {new Date(s.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Engagement stats */}
          <div className="row g-2 mb-3">
            <div className="col-4"><div className="md-stat"><div><div className="md-stat-label">Sent</div><div className="md-stat-value" style={{ fontSize: "1.3rem" }}>{c.sent}</div></div></div></div>
            <div className="col-4"><div className="md-stat"><div><div className="md-stat-label">Open rate</div><div className="md-stat-value" style={{ fontSize: "1.3rem", color: "var(--md-info)" }}>{openRate}%</div></div></div></div>
            <div className="col-4"><div className="md-stat"><div><div className="md-stat-label">Click rate</div><div className="md-stat-value" style={{ fontSize: "1.3rem", color: "var(--md-success)" }}>{clickRate}%</div></div></div></div>
          </div>

          <Tabs defaultActiveKey="profile" className="mb-3">
            <Tab eventKey="profile" title="Profile">
              <div className="mt-3">
                <div className="d-flex justify-content-between mb-3">
                  <strong>Categories</strong>
                  <Button size="sm" variant="outline-secondary" onClick={() => setShowPicker(true)}>Edit</Button>
                </div>
                <CategoryChips categories={data.categories} empty="No categories assigned" />

                <hr />

                <div className="d-flex justify-content-between mb-3">
                  <strong>Profile fields</strong>
                  {!editing ? (
                    <Button size="sm" variant="outline-secondary" onClick={() => setEditing(true)}>Edit</Button>
                  ) : (
                    <div className="d-flex gap-1">
                      <Button size="sm" variant="primary" onClick={save}>Save</Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">First name</Form.Label>
                      <Form.Control value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">Last name</Form.Label>
                      <Form.Control value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">Notes</Form.Label>
                      <Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Form.Group>
                    <Form.Check
                      type="switch" label="Subscribed"
                      checked={form.subscribe}
                      onChange={(e) => setForm({ ...form, subscribe: e.target.checked })}
                    />
                  </>
                ) : (
                  <dl className="row small mb-0">
                    <dt className="col-4 text-muted">First name</dt><dd className="col-8">{s.first_name || "—"}</dd>
                    <dt className="col-4 text-muted">Last name</dt><dd className="col-8">{s.last_name || "—"}</dd>
                    <dt className="col-4 text-muted">Last sent</dt><dd className="col-8">{s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : "—"}</dd>
                    <dt className="col-4 text-muted">Last event</dt>
                    <dd className="col-8">{s.last_event_status ? <Badge bg="info">{s.last_event_status}</Badge> : "—"}{s.last_event_at && <span className="text-muted ms-2">{new Date(s.last_event_at).toLocaleDateString()}</span>}</dd>
                    <dt className="col-4 text-muted">Notes</dt><dd className="col-8">{s.notes || "—"}</dd>
                  </dl>
                )}
              </div>
            </Tab>

            <Tab eventKey="timeline" title={`Timeline (${data.events.length})`}>
              <div className="mt-3">
                {data.events.length === 0 ? (
                  <div className="text-muted text-center py-4">No events yet.</div>
                ) : (
                  <div style={{ borderLeft: "2px solid var(--md-border)", paddingLeft: 16 }}>
                    {data.events.map((ev, i) => (
                      <div key={i} className="mb-3 position-relative">
                        <div style={{
                          position: "absolute", left: -22, top: 4,
                          width: 12, height: 12, borderRadius: "50%",
                          background: `var(--md-${STATUS_COLOR[ev.status] || "secondary"})`,
                          border: "2px solid white",
                          boxShadow: "0 0 0 1px var(--md-border)",
                        }} />
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <Badge bg={STATUS_COLOR[ev.status] || "secondary"}>{ev.status}</Badge>
                            {ev.subject && <span className="ms-2 small">{ev.subject}</span>}
                          </div>
                          <small className="text-muted">{new Date(ev.eventTime).toLocaleString()}</small>
                        </div>
                        {ev.link && <div className="small mt-1 text-muted text-truncate"><strong>Link:</strong> {ev.link}</div>}
                        {ev.job_id && <div className="small text-muted">Job <a href={`/emails/email-send?jobId=${ev.job_id}`}>#{ev.job_id}</a></div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </div>

        <div className="md-drawer-footer">
          <Button variant="outline-secondary" onClick={sendSingle}>📤 Send single email</Button>
          <Button variant="outline-secondary" onClick={onClose}>Close</Button>
        </div>
      </div>

      <CategoryPicker
        show={showPicker}
        onHide={() => setShowPicker(false)}
        email={email}
        initial={data.categories}
        categories={categories}
        onSaved={() => {
          setShowPicker(false);
          load();
          onChanged?.();
        }}
      />
    </>
  );
}
