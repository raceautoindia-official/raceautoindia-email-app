'use client';

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Button,
  Form,
  Alert,
  Spinner,
  Card,
  Modal,
  Tab,
  Tabs,
  Badge,
} from "react-bootstrap";
import axios from "axios";
import Link from "next/link";
import { PageHeader } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";
import Instructions from "@/app/components/Instructions";

const STATIC_PASSWORD =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ADMIN_PASSWORD) ||
  "raceauto@123";

const BulkEmailSender = () => {
  const toast = useToast();
  // Email content
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [rateLimit, setRateLimit] = useState(10);

  // Campaign
  const [campaigns, setCampaigns] = useState([]);
  const [campaignMode, setCampaignMode] = useState("new"); // "new" | "existing" | "none"
  const [campaignId, setCampaignId] = useState("");
  const [campaignName, setCampaignName] = useState("");

  // Sender identities
  const [senders, setSenders] = useState([]);
  const [senderId, setSenderId] = useState("");

  // Test email
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState("");

  // Send state
  const [sendMode, setSendMode] = useState("bulk");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);

  // Stats / categories
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]); // multi

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Excel
  const [excelFile, setExcelFile] = useState(null);
  const [excelError, setExcelError] = useState(null);

  // Monitor
  const [monitorEmail, setMonitorEmail] = useState("");
  const [monitorEvery, setMonitorEvery] = useState(0);

  // Schedule (datetime-local string, optional)
  const [scheduleAt, setScheduleAt] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState("subscribers");

  // Precount
  const [precount, setPrecount] = useState(null);
  const [precountLoading, setPrecountLoading] = useState(false);

  // Restore last job
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const jid = url.searchParams.get("jobId") || localStorage.getItem("lastJobId");
      if (jid) setActiveJobId(Number(jid));
      if (Notification?.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (activeJobId && typeof window !== "undefined") {
      localStorage.setItem("lastJobId", String(activeJobId));
      // Drive the floating progress widget
      localStorage.setItem("md.activeJobId", String(activeJobId));
      const url = new URL(window.location.href);
      url.searchParams.set("jobId", String(activeJobId));
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeJobId]);

  const refreshCampaigns = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/admin/campaigns");
      setCampaigns(data || []);
    } catch (e) {
      console.error("campaigns fetch failed", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: cats } = await axios.get("/api/admin/categories");
        setCategories(cats);
        setSelectedCategoryIds(cats[0]?.id ? [cats[0].id] : []);
      } catch {
        console.error("Failed to fetch categories");
      } finally {
        setCatLoading(false);
      }
      try {
        const { data } = await axios.get("/api/admin/emails/stats");
        setStats(data);
      } catch {}
      try {
        const { data } = await axios.get("/api/admin/senders");
        setSenders(data.rows || []);
        const def = (data.rows || []).find((s) => s.is_default);
        if (def) setSenderId(String(def.id));
      } catch {}
      refreshCampaigns();
    })();
  }, [refreshCampaigns]);

  // current source given the active tab
  const currentSource = activeTab === "subscribers" ? "all" : activeTab === "category" ? "category" : "excel";

  // precount
  const fetchPrecount = useCallback(async () => {
    if (currentSource === "excel") {
      setPrecount(null); // count is local until backend parses; show after queue
      return;
    }
    setPrecountLoading(true);
    try {
      const filter =
        currentSource === "category"
          ? { category_ids: selectedCategoryIds }
          : {};
      const { data } = await axios.post("/api/admin/email-send/precount", {
        source: currentSource,
        filter,
      });
      setPrecount(data);
    } catch (e) {
      setPrecount(null);
    } finally {
      setPrecountLoading(false);
    }
  }, [currentSource, selectedCategoryIds]);

  useEffect(() => {
    fetchPrecount();
  }, [fetchPrecount]);

  const overall = stats?.overall || { total: 0, active: 0, inactive: 0 };

  const toggleCategoryId = (id) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const allCategoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const selectAllCategories = () => setSelectedCategoryIds(allCategoryIds);
  const clearCategories = () => setSelectedCategoryIds([]);

  const handleSend = (mode) => {
    setSendMode(mode);
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const onCampaignPicked = async (id) => {
    setCampaignId(id);
    if (!id) return;
    try {
      const { data } = await axios.get(`/api/admin/campaigns/${id}`);
      // pre-fill subject/html if user wants to load this campaign as the template
      if (data?.subject && !subject) setSubject(data.subject);
      if (data?.html_body && !htmlContent) setHtmlContent(data.html_body);
    } catch {}
  };

  const buildCampaignFields = () => {
    if (campaignMode === "existing" && campaignId) {
      return { campaign_id: Number(campaignId) };
    }
    if (campaignMode === "new" && campaignName.trim()) {
      return { campaign_name: campaignName.trim() };
    }
    return {};
  };

  const confirmPasswordAndSend = async () => {
    if (passwordInput !== STATIC_PASSWORD) {
      setPasswordError("Incorrect password");
      return;
    }
    setShowPasswordModal(false);
    setLoading(true);
    setError("");

    try {
      let res;
      const monitor = monitorEmail
        ? { monitor_email: monitorEmail, monitor_every: Number(monitorEvery) || 100 }
        : {};
      const campaignFields = buildCampaignFields();

      // datetime-local is in local time. Send as "YYYY-MM-DD HH:MM:SS" so the
      // DB compares against NOW() in the same timezone the user picked.
      const scheduleField = scheduleAt
        ? { scheduleAt: scheduleAt.replace("T", " ") + ":00" }
        : {};

      if (sendMode === "excel") {
        if (!excelFile) {
          setError("No file selected");
          setLoading(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", excelFile);
        fd.append("subject", subject);
        fd.append("message", htmlContent);
        fd.append("rateLimit", String(rateLimit));
        fd.append("source", "excel");
        if (monitor.monitor_email) fd.append("monitor_email", monitor.monitor_email);
        if (monitor.monitor_every) fd.append("monitor_every", String(monitor.monitor_every));
        if (campaignFields.campaign_id) fd.append("campaign_id", String(campaignFields.campaign_id));
        if (campaignFields.campaign_name) fd.append("campaign_name", campaignFields.campaign_name);
        if (scheduleField.scheduleAt) fd.append("scheduleAt", scheduleField.scheduleAt);
        if (senderId) fd.append("sender_id", String(senderId));
        res = await axios.post("/api/admin/email-send", fd);
      } else {
        const payload = {
          subject,
          message: htmlContent,
          rateLimit,
          source: sendMode === "bulk" ? "all" : "category",
          filter:
            sendMode === "category"
              ? { category_ids: selectedCategoryIds }
              : {},
          ...monitor,
          ...campaignFields,
          ...scheduleField,
          ...(senderId ? { sender_id: Number(senderId) } : {}),
        };
        res = await axios.post("/api/admin/email-send", payload);
      }

      if (res.data.success) {
        setActiveJobId(res.data.jobId);
        toast.success(`Job #${res.data.jobId} queued (${res.data.total} recipient${res.data.total !== 1 ? "s" : ""})`);
        setSubject("");
        setHtmlContent("");
        setExcelFile(null);
        if (res.data.campaignId) refreshCampaigns();
      } else {
        const msg = res.data.error || "Failed to start send.";
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmailSend = async () => {
    if (!testEmail || !subject || !htmlContent) return;
    setTestLoading(true);
    setTestSent(false);
    setTestError("");
    try {
      const res = await axios.post("/api/admin/email-send/test-email", {
        recipient: testEmail,
        subject,
        message: htmlContent,
      });
      if (res.data.success) {
        setTestSent(true);
        toast.success(`Test email sent to ${testEmail}`);
        setTestEmail("");
      } else {
        const msg = res.data.error || "Failed to send test email.";
        setTestError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong.";
      setTestError(msg);
      toast.error(msg);
    } finally {
      setTestLoading(false);
    }
  };

  const handleExcelTabSend = () => {
    setSendMode("excel");
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const canSend =
    !!subject &&
    !!htmlContent &&
    !loading &&
    (currentSource !== "category" || selectedCategoryIds.length > 0) &&
    (currentSource !== "excel" || !!excelFile);

  return (
    <Container fluid>
      <PageHeader
        title="Send Email"
        subtitle="Compose and queue a bulk send. Live progress shows below once queued."
        actions={
          <>
            <Link href="/emails/jobs"><Button variant="outline-secondary">📋 Job History</Button></Link>
            <Link href="/emails/email-status"><Button variant="outline-info">📊 Tracking</Button></Link>
          </>
        }
      />

      {/* Inline progress now shown by the floating widget at bottom-right.
          The widget reads localStorage("md.activeJobId") set above. */}

      <Instructions title="How sending works in MailDeck" defaultOpen={false}>
        <ul className="mb-2 small">
          <li><strong>Pick an audience</strong> via the tabs below: All Subscribers, an uploaded Excel list, or one or more Categories.</li>
          <li><strong>Merge tags</strong> available in the HTML body:
            <ul>
              <li><code>{"{{visible_email}}"}</code> — replaced by the recipient address.</li>
              <li><code>{"{{unsubscribe_link}}"}</code> — required for compliance; the worker will substitute a per-recipient URL.</li>
            </ul>
          </li>
          <li><strong>Rate limit</strong> controls SES throughput; stay within your daily quota.</li>
          <li><strong>Monitor email</strong> — if set, you receive a copy every Nth send (useful for QA).</li>
          <li><strong>Schedule for later</strong> — leave empty to send now, or pick a future time and the worker will pick it up.</li>
          <li><strong>Suppressed addresses</strong> (hard bounces, complaints, unsubscribes) are <em>always</em> skipped — even if present in your file.</li>
        </ul>
      </Instructions>

      {/* Sender identity selector */}
      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={5}>
              <Form.Label>📨 Send from</Form.Label>
              <Form.Select value={senderId} onChange={(e) => setSenderId(e.target.value)}>
                {senders.length === 0 && <option value="">— Use environment default —</option>}
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    "{s.display_name}" &lt;{s.email}&gt;
                    {s.is_default ? " (default)" : ""}
                    {s.ses_verified ? " ✓ verified" : " ✗ NOT VERIFIED"}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={5}>
              {senderId && senders.find(s => String(s.id) === String(senderId) && !s.ses_verified) && (
                <div className="text-danger small">
                  ⚠ This identity isn't verified in SES — sends will fail. Verify it in <a href="/settings">Settings → Sender identities</a>.
                </div>
              )}
              {senderId && senders.find(s => String(s.id) === String(senderId) && s.ses_verified) && (
                <div className="text-success small">
                  ✓ SES-verified identity. Recipient sees the From name and address above.
                </div>
              )}
            </Col>
            <Col md={2} className="text-md-end">
              <a href="/settings"><Button size="sm" variant="outline-secondary">Manage</Button></a>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Campaign selector */}
      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Form.Label>Campaign</Form.Label>
              <Form.Select value={campaignMode} onChange={(e) => setCampaignMode(e.target.value)}>
                <option value="new">➕ New campaign</option>
                <option value="existing">📁 Existing campaign</option>
                <option value="none">— No campaign tag —</option>
              </Form.Select>
            </Col>
            {campaignMode === "new" && (
              <Col md={6}>
                <Form.Label>New campaign name</Form.Label>
                <Form.Control
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. May Newsletter 2026"
                />
              </Col>
            )}
            {campaignMode === "existing" && (
              <Col md={6}>
                <Form.Label>Pick campaign</Form.Label>
                <Form.Select value={campaignId} onChange={(e) => onCampaignPicked(e.target.value)}>
                  <option value="">— select —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} · {c.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            )}
            <Col md={3} className="text-md-end">
              <small className="text-muted">
                Tag a send to view all events for that campaign on the tracking page.
              </small>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="subscribers" title="📬 Send to All Subscribers">
          <Card className="mb-3">
            <Card.Body>
              <h5>All Subscribers</h5>
              {!stats ? (
                <Spinner />
              ) : (
                <>
                  <p>✅ Subscribed: <strong>{overall.active}</strong></p>
                  <p>❌ Unsubscribed: <strong>{overall.inactive}</strong></p>
                  <p>📧 Total: <strong>{overall.total}</strong></p>
                  {stats.suppressions > 0 && (
                    <p>🚫 Suppressed: <strong>{stats.suppressions}</strong></p>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="excel" title="📑 Send via Excel">
          <Card className="mb-3">
            <Card.Body>
              <Instructions title="Send to a list from Excel — what to upload" defaultOpen={true}>
                <ul className="mb-2 small">
                  <li>File: <code>.xlsx</code> or <code>.xls</code>; first sheet is read.</li>
                  <li><strong>Required column:</strong> <code>email</code> (or <code>Email</code>, <code>Email Address</code>).</li>
                  <li>Categories or extra fields in the file are <em>ignored</em> — this tab only uses the email column.</li>
                  <li>Suppressed addresses (bounces, complaints, manual unsubscribes) are skipped automatically.</li>
                  <li>To also store these emails as subscribers (with categories), use{" "}
                    <a href="/admin/upload-excel">Import Subscribers</a> first, then send via the
                    <em> Subscribers</em> or <em>Category</em> tabs.</li>
                </ul>
              </Instructions>

              <Instructions title="What happens if a recipient unsubscribes?" variant="success" defaultOpen={false}>
                <p className="mb-2 small">
                  Excel-only addresses (not in your Subscribers list) <strong>can still unsubscribe successfully</strong>. Here's the flow:
                </p>
                <ol className="small mb-2">
                  <li>Recipient clicks the <code>{"{{unsubscribe_link}}"}</code> in the email.</li>
                  <li>Our endpoint adds the address to the <strong>global suppression list</strong> (works even if the email isn't in any subscribers list — suppressions are tracked in their own table).</li>
                  <li>If the address didn't exist as a subscriber, we <strong>auto-create</strong> it as <em>Inactive</em> with a note explaining how it got there — so you can see the unsubscribe in the Subscribers UI.</li>
                  <li>Every future send (Excel, Bulk, or Category) checks against the suppression list <em>before</em> calling SES — so this address will never receive another email, even if you import the same Excel again next month.</li>
                  <li>The unsubscribe is logged in the <a href="/audit-log">Audit Log</a> with timestamp and IP.</li>
                </ol>
                <p className="mb-0 small">
                  <strong>Bottom line:</strong> there is no "stuck unsubscribe" — the suppression list is the source of truth, not the subscribers list.
                </p>
              </Instructions>

              <Form.Group className="mb-3">
                <Form.Label>Upload Excel File</Form.Label>
                <Form.Control
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setExcelFile(e.target.files[0])}
                />
              </Form.Group>
              {excelError && <Alert variant="danger">{excelError}</Alert>}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="category" title="📂 Send by Category">
          <Card className="mb-3">
            <Card.Body>
              {catLoading ? (
                <Spinner />
              ) : categories.length === 0 ? (
                <Alert variant="warning">
                  No categories yet. <Link href="/emails/category">Create one</Link>.
                </Alert>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>Pick one or more categories ({selectedCategoryIds.length} selected)</strong>
                    <div>
                      <Button size="sm" variant="outline-primary" className="me-2" onClick={selectAllCategories}>
                        Select all
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={clearCategories}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <Row>
                    {categories.map((c) => {
                      const counts =
                        stats?.categories?.find((x) => x.id === c.id) ||
                        { total: 0, active: 0, inactive: 0 };
                      return (
                        <Col md={4} key={c.id} className="mb-2">
                          <Card
                            border={selectedCategoryIds.includes(c.id) ? "primary" : "light"}
                            className="h-100"
                            style={{ cursor: "pointer" }}
                            onClick={() => toggleCategoryId(c.id)}
                          >
                            <Card.Body className="py-2">
                              <Form.Check
                                type="checkbox"
                                checked={selectedCategoryIds.includes(c.id)}
                                onChange={() => toggleCategoryId(c.id)}
                                label={<strong>{c.name}</strong>}
                              />
                              <div className="small text-muted ms-4">
                                <Badge bg="success" className="me-1">Active: {counts.active}</Badge>
                                <Badge bg="secondary">Total: {counts.total}</Badge>
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Live recipient precount */}
      <Alert variant="light" className="border d-flex justify-content-between align-items-center flex-wrap">
        <div>
          {precountLoading ? (
            <><Spinner size="sm" /> Calculating recipients…</>
          ) : precount ? (
            <>
              📋 <strong>{precount.eligible}</strong> eligible recipient{precount.eligible !== 1 && "s"}
              {precount.duplicatesRemoved > 0 && <> · {precount.duplicatesRemoved} duplicate{precount.duplicatesRemoved !== 1 && "s"} skipped</>}
              {precount.suppressed > 0 && <> · {precount.suppressed} suppressed</>}
            </>
          ) : currentSource === "excel" ? (
            <>📋 Upload an Excel file — recipient count will be shown after queuing.</>
          ) : (
            <>—</>
          )}
        </div>
        <Button size="sm" variant="outline-secondary" onClick={fetchPrecount} disabled={precountLoading}>
          Refresh
        </Button>
      </Alert>

      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>Email Subject</Form.Label>
                <Form.Control
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>HTML Content</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                />
                {htmlContent && !htmlContent.includes("{{unsubscribe_link}}") && (
                  <small className="text-warning">
                    ⚠ Missing <code>{"{{unsubscribe_link}}"}</code> — required for compliance.
                  </small>
                )}
              </Form.Group>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Emails / second</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={50}
                      value={rateLimit}
                      onChange={(e) => setRateLimit(+e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={5}>
                  <Form.Group className="mb-3">
                    <Form.Label>Monitor email (optional)</Form.Label>
                    <Form.Control
                      type="email"
                      value={monitorEmail}
                      onChange={(e) => setMonitorEmail(e.target.value)}
                      placeholder="qa@yourcompany.com"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Every</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={monitorEvery}
                      onChange={(e) => setMonitorEvery(+e.target.value)}
                      placeholder="0"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label className="d-flex justify-content-between align-items-center">
                  <span>📅 Schedule for later (optional)</span>
                  {scheduleAt && (
                    <Button size="sm" variant="link" className="p-0" onClick={() => setScheduleAt("")}>Clear</Button>
                  )}
                </Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={scheduleAt}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
                {scheduleAt && (
                  <small className="text-muted">
                    Will queue at {new Date(scheduleAt).toLocaleString()}. Worker picks it up automatically.
                  </small>
                )}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Test Email Address</Form.Label>
                <Form.Control
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="e.g. you@domain.com"
                />
              </Form.Group>

              <div className="d-flex gap-2 flex-wrap">
                {activeTab === "subscribers" && (
                  <Button
                    variant="primary"
                    disabled={!canSend}
                    onClick={() => handleSend("bulk")}
                  >
                    {loading ? <Spinner size="sm" /> : `${scheduleAt ? "Schedule" : "Queue"} Bulk Send (${precount?.eligible ?? 0})`}
                  </Button>
                )}
                {activeTab === "category" && (
                  <Button
                    variant="warning"
                    disabled={!canSend}
                    onClick={() => handleSend("category")}
                  >
                    {loading ? <Spinner size="sm" /> : `${scheduleAt ? "Schedule" : "Queue"} Category Send (${precount?.eligible ?? 0})`}
                  </Button>
                )}
                {activeTab === "excel" && (
                  <Button
                    variant="success"
                    disabled={!canSend}
                    onClick={handleExcelTabSend}
                  >
                    {loading ? <Spinner size="sm" /> : `${scheduleAt ? "Schedule" : "Queue"} Excel Send`}
                  </Button>
                )}

                <Button
                  variant="outline-info"
                  disabled={!subject || !htmlContent || !testEmail || testLoading}
                  onClick={handleTestEmailSend}
                >
                  {testLoading ? <Spinner size="sm" /> : "Send Test Email"}
                </Button>
              </div>

              {error && <Alert variant="danger" className="mt-3">❌ {error}</Alert>}
              {testSent && <Alert variant="info" className="mt-3">Test email sent successfully!</Alert>}
              {testError && <Alert variant="danger" className="mt-3">❌ {testError}</Alert>}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <h6 className="text-muted mb-2">Email Preview</h6>
          <div
            style={{
              height: "600px",
              overflow: "auto",
              border: "1px solid #ccc",
              background: "#f9f9f9",
              padding: "0.5rem",
            }}
          >
            <div
              style={{
                width: "700px",
                margin: "0 auto",
                padding: "1rem",
                background: "#fff",
                boxShadow: "0 0 3px rgba(0,0,0,0.1)",
              }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </Col>
      </Row>

      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Admin Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Enter Password</Form.Label>
            <Form.Control
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPasswordAndSend();
              }}
            />
            {passwordError && <div className="text-danger mt-2">{passwordError}</div>}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={confirmPasswordAndSend}>Confirm & Queue</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BulkEmailSender;
