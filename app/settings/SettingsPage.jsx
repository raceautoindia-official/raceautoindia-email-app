"use client";

import React, { useEffect, useState } from "react";
import {
  Container, Form, Button, Row, Col, Spinner, Badge, Tabs, Tab, Table, Modal, Alert,
} from "react-bootstrap";
import axios from "axios";
import { PageHeader, EmptyState } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";
import Instructions from "@/app/components/Instructions";

function StatusBadge({ status }) {
  if (status === "Success") return <Badge bg="success">verified ✓</Badge>;
  if (status === "Pending") return <Badge bg="warning">pending — check inbox</Badge>;
  if (status === "Failed")  return <Badge bg="danger">failed</Badge>;
  return <Badge bg="secondary">not in SES</Badge>;
}

export default function SettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState({});
  const [health, setHealth] = useState(null);
  const [sesInfo, setSesInfo] = useState(null);
  const [s3Info, setS3Info] = useState(null);

  // Senders
  const [senders, setSenders] = useState([]);
  const [sesIdentities, setSesIdentities] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSender, setNewSender] = useState({ email: "", display_name: "", reply_to: "" });
  const [adding, setAdding] = useState(false);

  // Domain wizard
  const [showDomainWizard, setShowDomainWizard] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [domainResult, setDomainResult] = useState(null);
  const [domainBusy, setDomainBusy] = useState(false);

  // Per-sender SES status (refreshed via Re-check)
  const [sesStatus, setSesStatus] = useState({}); // { senderId: { status, ... } }

  const load = async () => {
    setLoading(true);
    try {
      const [a, b, c, info, s3] = await Promise.all([
        axios.get("/api/admin/settings"),
        axios.get("/api/health").catch(() => null),
        axios.get("/api/admin/senders?with_ses=1"),
        axios.get("/api/admin/ses-info").catch(() => ({ data: null })),
        axios.get("/api/admin/s3-info").catch(() => ({ data: null })),
      ]);
      setS(a.data || {});
      setHealth(b?.data || null);
      setSenders(c.data.rows || []);
      setSesIdentities(c.data.sesIdentities || []);
      setSesInfo(info.data || null);
      setS3Info(s3?.data || null);
    } catch (e) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const setField = (key, value) => setS((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try { await axios.put("/api/admin/settings", s); toast.success("Settings saved"); }
    catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  // ----- Sender actions -----
  const addSender = async (e) => {
    e?.preventDefault?.();
    setAdding(true);
    try {
      const { data } = await axios.post("/api/admin/senders", newSender);
      toast[data.ses_verified ? "success" : "warning"](
        data.ses_verified
          ? "Sender added · already verified ✓"
          : "Sender added · NOT verified yet — click 'Send verification email' on the row."
      );
      setNewSender({ email: "", display_name: "", reply_to: "" });
      setShowAdd(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed");
    } finally { setAdding(false); }
  };

  const setDefault = async (id) => {
    try { await axios.patch(`/api/admin/senders/${id}`, { set_default: true }); toast.success("Default sender updated"); load(); }
    catch { toast.error("Failed"); }
  };

  const recheckVerified = async (id) => {
    try {
      const { data } = await axios.post(`/api/admin/senders/verify`, { id });
      setSesStatus((prev) => ({ ...prev, [id]: data }));
      if (data.verified) toast.success("Verified ✓");
      else if (data.status === "Pending") toast.warning("Still pending — recipient must click the SES link");
      else toast.warning(`SES status: ${data.status} (region: ${data.region})`);
      load();
    } catch (e) { toast.error("Verification check failed"); }
  };

  const sendVerificationEmail = async (sender) => {
    if (!confirm(`Send AWS SES verification email to ${sender.email}? Check the inbox (and spam folder) after.`)) return;
    try {
      const { data } = await axios.post(`/api/admin/senders/request-verification`, { id: sender.id, kind: "email" });
      toast.success(data.message || "Verification email sent");
      setSesStatus((prev) => ({ ...prev, [sender.id]: { status: "Pending" } }));
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not request verification");
    }
  };

  const startDomainWizard = (sender) => {
    setDomainInput(sender ? sender.email.split("@")[1] : "");
    setDomainResult(null);
    setShowDomainWizard(true);
  };

  const requestDomain = async () => {
    setDomainBusy(true);
    setDomainResult(null);
    try {
      const { data } = await axios.post(`/api/admin/senders/request-verification`, { target: domainInput, kind: "domain" });
      setDomainResult(data);
      toast.success("DNS records generated — add them at your DNS provider");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed");
    } finally { setDomainBusy(false); }
  };

  const removeSender = async (id) => {
    if (!confirm("Deactivate this sender?")) return;
    try { await axios.delete(`/api/admin/senders/${id}`); toast.success("Removed"); load(); }
    catch { toast.error("Failed"); }
  };

  if (loading) return <Container><Spinner /></Container>;

  return (
    <Container fluid>
      <PageHeader
        title="Settings"
        subtitle="Defaults, sender identities, integrations, and system health"
        actions={<Button variant="primary" onClick={save} disabled={saving}>{saving ? <Spinner size="sm" /> : "Save changes"}</Button>}
      />

      <Tabs defaultActiveKey="senders" className="mb-3">
        {/* ========== SENDER IDENTITIES ========== */}
        <Tab eventKey="senders" title={`📨 Sender identities (${senders.length})`}>

          {/* SES account banner */}
          {sesInfo && !sesInfo.error && (
            <div className="md-card mb-3"><div className="md-card-body">
              <Row className="g-3 align-items-center">
                <Col md={3}>
                  <div className="md-stat-label">SES Region</div>
                  <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>
                    <code>{sesInfo.region}</code>
                  </div>
                  <small className="text-muted">Identities only count in this region</small>
                </Col>
                <Col md={3}>
                  <div className="md-stat-label">Account sending</div>
                  <div>{sesInfo.sendingEnabled
                    ? <Badge bg="success">enabled</Badge>
                    : <Badge bg="danger">paused</Badge>}</div>
                </Col>
                <Col md={3}>
                  <div className="md-stat-label">Daily quota</div>
                  <div style={{ fontWeight: 600 }}>
                    {sesInfo.sentLast24h?.toLocaleString?.() ?? "?"} / {sesInfo.max24Hour?.toLocaleString?.() ?? "?"}
                  </div>
                  <small className="text-muted">Max rate: {sesInfo.maxSendRate}/s</small>
                </Col>
                <Col md={3}>
                  <div className="md-stat-label">Mode</div>
                  <div>
                    {sesInfo.likelySandbox
                      ? <Badge bg="warning">SANDBOX</Badge>
                      : <Badge bg="success">production</Badge>}
                  </div>
                </Col>
              </Row>

              {sesInfo.likelySandbox && (
                <Alert variant="warning" className="mt-3 mb-0 small">
                  <strong>SES is in Sandbox mode.</strong> In sandbox, you can ONLY send to recipients
                  that are themselves verified in SES — even if your From address is verified.
                  To send to anyone, request production access in AWS Console → SES → Account dashboard.
                </Alert>
              )}
            </div></div>
          )}

          <Instructions title="How to verify a sender — step by step" defaultOpen={true}>
            <p className="mb-2"><strong>Why "not verified"?</strong> SES rejects any send whose From address (or domain) hasn't been confirmed. The address you see below has not been registered in this SES account/region yet.</p>
            <p className="mb-2"><strong>Two ways to verify:</strong></p>
            <ol className="small mb-2">
              <li>
                <strong>Single email (fastest):</strong> click <em>"📧 Send verification email"</em> on the sender row.
                AWS will email a confirmation link. Click it from that inbox, then return here and click
                <em>"Re-check"</em> — the badge turns green.
              </li>
              <li>
                <strong>Whole domain (recommended for production):</strong> click <em>"+ Verify a domain"</em>.
                We'll generate one TXT and three CNAME records — paste them into your DNS provider.
                When DNS propagates (5–30 minutes typically), all addresses on that domain become valid From addresses.
              </li>
            </ol>
            <p className="mb-1 small">
              <strong>Inbox empty after sending verification?</strong> Check spam, check that the address can actually
              receive mail, and verify your AWS region matches: <code>{sesInfo?.region || "(loading)"}</code>.
              The verification email comes from <code>no-reply-aws@amazon.com</code>.
            </p>
          </Instructions>

          <div className="d-flex justify-content-end gap-2 mb-2">
            <Button variant="outline-primary" onClick={() => startDomainWizard(null)}>+ Verify a domain</Button>
            <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add sender</Button>
          </div>

          {senders.length === 0 ? (
            <EmptyState
              icon="📨"
              title="No sender identities yet"
              hint="Add the From email you want to send from."
              action={<Button variant="primary" onClick={() => setShowAdd(true)}>Add first sender</Button>}
            />
          ) : (
            <div className="md-card"><div className="md-card-body p-0">
              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>SES status</th>
                    <th>Status</th>
                    <th style={{ width: 380 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {senders.map((sender) => {
                    const liveStatus = sesStatus[sender.id];
                    const status = liveStatus?.status ||
                      (sender.ses_verified ? "Success" : "NotFound");
                    const verifiedHere = status === "Success";
                    return (
                      <tr key={sender.id}>
                        <td>
                          <strong>{sender.display_name}</strong>
                          <div className="text-muted small">&lt;{sender.email}&gt;</div>
                          {sender.reply_to && sender.reply_to !== sender.email && (
                            <div className="small">↩ Reply-To: {sender.reply_to}</div>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={status} />
                          {liveStatus?.domainStatus === "Success" && status === "Success" && (
                            <div className="small text-success mt-1">via domain @{liveStatus.domain}</div>
                          )}
                          {sender.ses_verified_at && verifiedHere && (
                            <div className="small text-muted">{new Date(sender.ses_verified_at).toLocaleDateString()}</div>
                          )}
                        </td>
                        <td>
                          {sender.is_default && <Badge bg="primary" className="me-1">default</Badge>}
                          {!sender.is_active && <Badge bg="secondary">inactive</Badge>}
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap">
                            {!verifiedHere && (
                              <>
                                <Button size="sm" variant="primary" onClick={() => sendVerificationEmail(sender)}>
                                  📧 Send verification email
                                </Button>
                                <Button size="sm" variant="outline-primary" onClick={() => startDomainWizard(sender)}>
                                  🌐 Verify domain
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="outline-secondary" onClick={() => recheckVerified(sender.id)}>
                              🔄 Re-check
                            </Button>
                            {!sender.is_default && (
                              <Button size="sm" variant="outline-secondary" onClick={() => setDefault(sender.id)}>
                                Set default
                              </Button>
                            )}
                            <Button size="sm" variant="outline-danger" onClick={() => removeSender(sender.id)}>
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div></div>
          )}

          {sesIdentities && sesIdentities.length > 0 && (
            <Instructions title={`Already verified in SES (${sesIdentities.length}) — region ${sesInfo?.region}`} variant="success" defaultOpen={false}>
              <p className="mb-2 small">These addresses are confirmed verified in your AWS SES account in this region:</p>
              <div className="d-flex flex-wrap gap-1">
                {sesIdentities.map((email) => (
                  <code key={email} style={{ background: "white", padding: "3px 8px", borderRadius: 4 }}>{email}</code>
                ))}
              </div>
            </Instructions>
          )}
        </Tab>

        {/* ========== DEFAULTS ========== */}
        <Tab eventKey="defaults" title="Send defaults">
          <div className="md-card mt-3"><div className="md-card-body">
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Sender display name (legacy fallback)</Form.Label>
                <Form.Control value={s.sender_name || ""} onChange={(e) => setField("sender_name", e.target.value)} />
                <small className="text-muted">Only used if no Sender Identity is set.</small>
              </Col>
              <Col md={3}>
                <Form.Label>Default rate (emails/sec)</Form.Label>
                <Form.Control type="number" min={1} max={50} value={s.default_rate_limit || 10} onChange={(e) => setField("default_rate_limit", e.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label>Default monitor email</Form.Label>
                <Form.Control type="email" value={s.default_monitor_email || ""} onChange={(e) => setField("default_monitor_email", e.target.value)} placeholder="qa@yourcompany.com" />
              </Col>
              <Col md={3}>
                <Form.Label>Monitor every N emails</Form.Label>
                <Form.Control type="number" min={0} value={s.default_monitor_every || 1000} onChange={(e) => setField("default_monitor_every", e.target.value)} />
              </Col>
            </Row>
          </div></div>
        </Tab>

        <Tab eventKey="branding" title="Branding & links">
          <div className="md-card mt-3"><div className="md-card-body">
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Public base URL</Form.Label>
                <Form.Control value={s.public_base_url || ""} onChange={(e) => setField("public_base_url", e.target.value)} placeholder="https://newsletter.example.com" />
                <small className="text-muted">Used for unsubscribe links.</small>
              </Col>
              <Col md={12}>
                <Form.Label>Footer (appended to all sends if non-empty)</Form.Label>
                <Form.Control as="textarea" rows={3} value={s.html_footer || ""} onChange={(e) => setField("html_footer", e.target.value)} />
              </Col>
            </Row>
          </div></div>
        </Tab>

        <Tab eventKey="system" title="System">
          <div className="md-card mt-3"><div className="md-card-body">
            <Row className="g-3">
              <Col md={4}><div className="md-stat"><div>
                <div className="md-stat-label">Database</div>
                <div className="md-stat-value" style={{ fontSize: "1.3rem" }}>
                  {health?.db ? <Badge bg="success">OK</Badge> : <Badge bg="danger">DOWN</Badge>}
                </div>
              </div></div></Col>
              <Col md={4}><div className="md-stat"><div>
                <div className="md-stat-label">API</div>
                <div className="md-stat-value" style={{ fontSize: "1.3rem" }}>
                  {health?.ok ? <Badge bg="success">OK</Badge> : <Badge bg="warning">CHECK</Badge>}
                </div>
              </div></div></Col>
              <Col md={4}><div className="md-stat"><div>
                <div className="md-stat-label">SES</div>
                <div className="md-stat-value" style={{ fontSize: "1.3rem" }}>
                  {sesInfo?.sendingEnabled ? <Badge bg="success">OK ({sesInfo.region})</Badge> :
                   sesInfo?.error ? <Badge bg="warning">CHECK</Badge> :
                   <Badge bg="secondary">—</Badge>}
                </div>
              </div></div></Col>
            </Row>

            <hr />

            <h6 className="mb-3">📦 S3 storage</h6>
            {!s3Info?.configured ? (
              <Alert variant="warning" className="small mb-0">
                S3 is not configured. Set <code>AWS_S3_BUCKET</code> in <code>.env</code> to enable image uploads,
                attachments, and report archives. {s3Info?.error && <span>· {s3Info.error}</span>}
              </Alert>
            ) : s3Info.ok ? (
              <Row className="g-3">
                <Col md={4}><div className="md-stat"><div>
                  <div className="md-stat-label">Bucket</div>
                  <div style={{ fontWeight: 600 }}><code>{s3Info.bucket}</code></div>
                </div></div></Col>
                <Col md={4}><div className="md-stat"><div>
                  <div className="md-stat-label">Region</div>
                  <div style={{ fontWeight: 600 }}><code>{s3Info.region}</code></div>
                </div></div></Col>
                <Col md={4}><div className="md-stat"><div>
                  <div className="md-stat-label">Status</div>
                  <div className="md-stat-value" style={{ fontSize: "1.3rem" }}><Badge bg="success">accessible</Badge></div>
                </div></div></Col>
              </Row>
            ) : (
              <Alert variant="warning" className="small">
                <strong>S3 not reachable</strong> for bucket <code>{s3Info.bucket}</code>.
                {s3Info.authError && <> The IAM user/role may not have permission — attach <code>MailDeckSesS3Policy</code>.</>}
                <br /><span className="text-muted">Error: <code>{s3Info.error}</code></span>
              </Alert>
            )}
          </div></div>
        </Tab>
      </Tabs>

      {/* Add sender modal */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton><Modal.Title>Add sender identity</Modal.Title></Modal.Header>
        <Form onSubmit={addSender}>
          <Modal.Body>
            <Alert variant="info" className="small mb-3">
              Adding a sender doesn't verify it — you'll click <strong>"📧 Send verification email"</strong>
              on the row after saving. AWS will then email a confirmation link to that address.
            </Alert>
            <Form.Group className="mb-2">
              <Form.Label>From email *</Form.Label>
              <Form.Control type="email" required value={newSender.email} onChange={(e) => setNewSender({ ...newSender, email: e.target.value })} placeholder="newsletter@yourcompany.com" />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Display name *</Form.Label>
              <Form.Control required value={newSender.display_name} onChange={(e) => setNewSender({ ...newSender, display_name: e.target.value })} placeholder="Race Auto India" />
            </Form.Group>
            <Form.Group>
              <Form.Label>Reply-To (optional)</Form.Label>
              <Form.Control type="email" value={newSender.reply_to} onChange={(e) => setNewSender({ ...newSender, reply_to: e.target.value })} placeholder="support@yourcompany.com" />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={adding}>
              {adding ? <Spinner size="sm" /> : "Add sender"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Domain wizard modal */}
      <Modal show={showDomainWizard} onHide={() => setShowDomainWizard(false)} centered size="lg">
        <Modal.Header closeButton><Modal.Title>Verify a domain in SES</Modal.Title></Modal.Header>
        <Modal.Body>
          {!domainResult ? (
            <>
              <Alert variant="info" className="small">
                Domain verification covers <strong>any</strong> address on the domain.
                You'll add 1 TXT record and 3 CNAME records to your DNS provider.
                When DNS propagates (5–30 min), all <code>@{domainInput || "example.com"}</code> addresses become valid From addresses.
              </Alert>
              <Form.Group>
                <Form.Label>Domain *</Form.Label>
                <Form.Control
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value.trim().toLowerCase())}
                  placeholder="raceautoindia.com"
                />
                <small className="text-muted">No <code>www.</code>, no <code>https://</code> — just the domain.</small>
              </Form.Group>
            </>
          ) : (
            <>
              <Alert variant="success" className="small">
                ✅ SES is now waiting for these DNS records. Add them in your DNS provider exactly as shown.
                After DNS propagates, click <strong>"Re-check"</strong> on the sender row to refresh status.
              </Alert>

              <h6 className="mt-3">1. TXT record (domain verification)</h6>
              <Table size="sm" bordered className="small">
                <thead><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
                <tbody>
                  <tr>
                    <td><Badge bg="dark">TXT</Badge></td>
                    <td><code>{domainResult.txtRecord.name}</code></td>
                    <td><code style={{ wordBreak: "break-all" }}>{domainResult.txtRecord.value}</code></td>
                  </tr>
                </tbody>
              </Table>

              <h6 className="mt-3">2. CNAME records (DKIM signing)</h6>
              <Table size="sm" bordered className="small">
                <thead><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
                <tbody>
                  {domainResult.cnameRecords.map((r, i) => (
                    <tr key={i}>
                      <td><Badge bg="dark">CNAME</Badge></td>
                      <td><code style={{ wordBreak: "break-all" }}>{r.name}</code></td>
                      <td><code style={{ wordBreak: "break-all" }}>{r.value}</code></td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Alert variant="warning" className="small mt-3 mb-0">
                <strong>Optional but recommended:</strong> also add SPF (<code>v=spf1 include:amazonses.com ~all</code>)
                and DMARC (<code>v=DMARC1; p=none; rua=mailto:dmarc@{domainInput}</code>) records to improve deliverability.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDomainWizard(false)}>Close</Button>
          {!domainResult && (
            <Button variant="primary" disabled={domainBusy || !domainInput} onClick={requestDomain}>
              {domainBusy ? <Spinner size="sm" /> : "Generate DNS records"}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
