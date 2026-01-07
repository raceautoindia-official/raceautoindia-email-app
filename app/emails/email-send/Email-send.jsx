'use client';

import React, { useState, useEffect } from "react";
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

const BulkEmailSender = () => {
  // Email content
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [rateLimit, setRateLimit] = useState(10);

  // Test‐email state
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState("");

  // Send state
  const [sendMode, setSendMode] = useState("bulk"); // 'bulk' | 'category'
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Subscribers & categories
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const STATIC_PASSWORD = "raceauto@123";

  // Excel upload
  const [excelFile, setExcelFile] = useState(null);
  const [excelSendStatus, setExcelSendStatus] = useState(null);
  const [excelError, setExcelError] = useState(null);
  const [excelLoading, setExcelLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState("subscribers");

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: cats } = await axios.get("/api/admin/categories");
        setCategories(cats);
        setSelectedCategory(cats[0]?.id || null);
      } catch {
        console.error("Failed to fetch categories");
      } finally {
        setCatLoading(false);
      }

      try {
        const { data: subs } = await axios.get("/api/admin/emails");
        setSubscribers(Array.isArray(subs) ? subs : subs.data || []);
      } catch {
        console.error("Failed to fetch subscribers");
      } finally {
        setLoadingSubs(false);
      }
    })();
  }, []);

  // Count by category
  const countForCategory = (catId) => {
    const list = subscribers.filter((s) => s.category_id === catId);
    return {
      total: list.length,
      active: list.filter((s) => s.subscribe === 1).length,
      inactive: list.filter((s) => s.subscribe === 0).length,
    };
  };

  // Bulk/category send
  const handleSend = (mode) => {
    setSendMode(mode);
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const confirmPasswordAndSend = async () => {
    if (passwordInput !== STATIC_PASSWORD) {
      setPasswordError("Incorrect password");
      return;
    }
    setShowPasswordModal(false);
    setLoading(true);
    setError("");
    setSent(false);

    try {
      const payload = { subject, message: htmlContent, rateLimit };
      const url = sendMode === "bulk"
        ? "/api/admin/email-send"
        : "/api/admin/email-send/category";

      const res = await axios.post(url,
        sendMode === "bulk"
          ? payload
          : { ...payload, category_id: selectedCategory }
      );

      if (res.data.success) {
        setSent(true);
        setSubject("");
        setHtmlContent("");
      } else {
        setError(res.data.error || "Failed to send emails.");
      }
    } catch (err) {
      console.error("Send error:", err);
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Test‐email send
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
        setTestEmail("");
      } else {
        setTestError(res.data.error || "Failed to send test email.");
      }
    } catch (err) {
      console.error("Test email error:", err);
      setTestError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setTestLoading(false);
    }
  };

  // Excel upload
  const handleExcelUpload = async () => {
    if (!excelFile || !subject || !htmlContent) return;
    setExcelLoading(true);
    setExcelSendStatus(null);
    setExcelError(null);

    try {
      const formData = new FormData();
      formData.append("file", excelFile);
      formData.append("subject", subject);
      formData.append("message", htmlContent);
      formData.append("rateLimit", rateLimit.toString());

      const res = await axios.post("/api/admin/email-send/excel", formData);
      if (res.data.success) {
        setExcelSendStatus(res.data.message);
        setExcelFile(null);
      } else {
        setExcelError(res.data.error || "Failed to send Excel emails.");
      }
    } catch (err) {
      console.error("Excel send error:", err);
      setExcelError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setExcelLoading(false);
    }
  };

  // Summary counts
  const subCount = subscribers.filter((s) => s.subscribe === 1).length;
  const unsubCount = subscribers.filter((s) => s.subscribe === 0).length;

  return (
    <Container className="mt-5">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>📤 Bulk Email Sender</h3>
        <div className="d-flex gap-2">
          <Link href="/emails/email-status">
            <Button variant="info">📊 Track Email Status</Button>
          </Link>
          <Link href="/emails">
            <Button variant="secondary">👥 Manage Subscribers</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="subscribers" title="📬 Send to Subscribers">
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Body>
                  <h5>All Subscribers</h5>
                  {loadingSubs ? (
                    <Spinner />
                  ) : (
                    <>
                      <p>✅ Subscribed: <strong>{subCount}</strong></p>
                      <p>❌ Unsubscribed: <strong>{unsubCount}</strong></p>
                      <p>📧 Total: <strong>{subscribers.length}</strong></p>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="excel" title="📑 Send via Excel">
          <Card className="mb-4">
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>Upload Excel File</Form.Label>
                <Form.Control
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setExcelFile(e.target.files[0])}
                />
                <Form.Text className="text-muted">
                  ⚠️ Needs a column named <b>email</b>.
                </Form.Text>
              </Form.Group>
              <Button
                variant="success"
                onClick={handleExcelUpload}
                disabled={!excelFile || !subject || !htmlContent || excelLoading}
              >
                {excelLoading ? "Sending..." : "Send from Excel"}
              </Button>
              {excelSendStatus && (
                <Alert variant="success" className="mt-3">
                  ✅ {excelSendStatus}
                </Alert>
              )}
              {excelError && (
                <Alert variant="danger" className="mt-3">
                  ❌ {excelError}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="category" title="📂 Send by Category">
          <Card className="mb-4">
            <Card.Body>
              {catLoading ? (
                <Spinner />
              ) : (
                <>
                  <Form.Group as={Row} className="align-items-center">
                    <Form.Label column sm="3">Category</Form.Label>
                    <Col sm="9">
                      <Form.Select
                        value={selectedCategory || ""}
                        onChange={(e) => setSelectedCategory(+e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Form.Group>

                  {selectedCategory != null && (
                    <Row className="mt-3">
                      {(() => {
                        const { total, active, inactive } =
                          countForCategory(selectedCategory);
                        return (
                          <>
                            <Col><Badge bg="primary">Total: {total}</Badge></Col>
                            <Col><Badge bg="success">Active: {active}</Badge></Col>
                            <Col><Badge bg="secondary">Inactive: {inactive}</Badge></Col>
                          </>
                        );
                      })()}
                    </Row>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Form & Test Email */}
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
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Emails per second</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(+e.target.value)}
                />
              </Form.Group>

              {/* Test Email */}
              <Form.Group className="mb-3">
                <Form.Label>Test Email Address</Form.Label>
                <Form.Control
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="e.g. you@domain.com"
                />
              </Form.Group>

              <div className="d-flex gap-2">
                {/* Bulk/Category Send */}
                {activeTab === "subscribers" && (
                  <Button
                    variant="primary"
                    disabled={!subject || !htmlContent || loading}
                    onClick={() => handleSend("bulk")}
                  >
                    {loading ? <Spinner size="sm" /> : "Send Bulk Email"}
                  </Button>
                )}
                {activeTab === "category" && (
                  <Button
                    variant="warning"
                    disabled={!subject || !htmlContent || loading || selectedCategory == null}
                    onClick={() => handleSend("category")}
                  >
                    {loading ? <Spinner size="sm" /> : "Send to Category"}
                  </Button>
                )}

                {/* Test Email Button */}
                <Button
                  variant="outline-info"
                  disabled={!subject || !htmlContent || !testEmail || testLoading}
                  onClick={handleTestEmailSend}
                >
                  {testLoading ? <Spinner size="sm" /> : "Send Test Email"}
                </Button>
              </div>

              {/* Feedback */}
              {sent && (
                <Alert variant="success" className="mt-3">
                  ✅ Emails sent successfully!
                </Alert>
              )}
              {error && (
                <Alert variant="danger" className="mt-3">
                  ❌ {error}
                </Alert>
              )}
              {testSent && (
                <Alert variant="info" className="mt-3">
                  Test email sent successfully!
                </Alert>
              )}
              {testError && (
                <Alert variant="danger" className="mt-3">
                  ❌ {testError}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Preview */}
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

      {/* Password Modal */}
      <Modal
        show={showPasswordModal}
        onHide={() => setShowPasswordModal(false)}
        centered
      >
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
            />
            {passwordError && (
              <div className="text-danger mt-2">{passwordError}</div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmPasswordAndSend}>
            Confirm & Send
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BulkEmailSender;
