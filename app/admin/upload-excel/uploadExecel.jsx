"use client";

import axios from "axios";
import React, { useState, useEffect } from "react";
import { Form, Button, Alert, Container, Spinner, Table, Row, Col, Badge } from "react-bootstrap";
import { PageHeader } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";
import Instructions from "@/app/components/Instructions";

const STEPS = ["Upload file", "Map columns", "Validate", "Done"];

const ALLOWED_EXT = /\.(xlsx|xls|csv)$/i;

const FIELD_REFS = [
  { name: "email",       required: true,  format: "valid email address",                               example: "jane@example.com" },
  { name: "first_name",  required: false, format: "text",                                              example: "Jane" },
  { name: "last_name",   required: false, format: "text",                                              example: "Doe" },
  { name: "categories",  required: false, format: "comma-separated category names OR numeric ids",     example: "newsletter, promotions" },
];

export default function ExcelUpload() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({ email: "", categories: "", first_name: "", last_name: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [strictCategories, setStrictCategories] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);

  // Load category list up-front so we can show it on the first instruction screen
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get("/api/admin/categories");
        setAvailableCategories(data || []);
      } catch {}
    })();
  }, []);

  const accept = (f) => {
    if (!f) return;
    if (!ALLOWED_EXT.test(f.name)) { toast.error("Use .xlsx / .xls / .csv"); return; }
    setFile(f);
    setError(null); setResult(null); setParsed(null);
  };

  const goPreview = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await axios.post("/api/admin/emails/preview-upload", fd);
      setParsed(data);
      setMapping({
        email: data.detected.email || "",
        categories: data.detected.categories || "",
        first_name: data.detected.first_name || "",
        last_name: data.detected.last_name || "",
      });
      setStep(1);
    } catch (e) {
      const msg = e.response?.data?.error || "Could not parse file";
      setError(msg); toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // Re-validate against the live mapping (so when user changes column mapping
  // the validation table updates without needing to re-upload).
  const revalidate = async () => {
    if (!file) return;
    if (!mapping.email) { toast.error("Pick the email column first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      const { data } = await axios.post("/api/admin/emails/preview-upload", fd);
      setParsed(data);
      setStep(2);
    } catch (e) {
      toast.error("Validation failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!mapping.email) { toast.error("Pick the email column first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("strict_categories", String(strictCategories));
      const { data } = await axios.post("/api/admin/emails", fd);
      setResult(data);
      toast.success(`Imported · Inserted ${data.inserted} · Updated ${data.updated}`);
      setStep(3);
    } catch (e) {
      const msg = e.response?.data?.error || "Upload failed";
      setError(msg); toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0); setFile(null); setParsed(null); setResult(null); setError(null);
    setMapping({ email: "", categories: "", first_name: "", last_name: "" });
  };

  const downloadErrorReport = () => {
    if (!result?.rejectedRows?.length) return;
    const header = "row,email,reason\n";
    const csv = result.rejectedRows
      .map((r) => `${r.row},"${r.email || ""}","${(r.reason || "").replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "import_errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container fluid>
      <PageHeader
        title="Import Subscribers"
        subtitle="Bulk upload via a 4-step wizard with column mapping, validation and reporting"
        actions={
          <a href="/api/admin/emails/template" download>
            <Button variant="outline-secondary">⬇ Download sample template</Button>
          </a>
        }
      />

      {/* Stepper */}
      <div className="md-card mb-3"><div className="md-card-body">
        <div className="d-flex justify-content-between align-items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="d-flex align-items-center gap-2">
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: i <= step ? "var(--md-primary)" : "var(--md-surface-2)",
                  color: i <= step ? "white" : "var(--md-text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 600, fontSize: "0.85rem",
                }}>{i + 1}</div>
                <span style={{ fontSize: "0.875rem", fontWeight: i === step ? 600 : 400, color: i === step ? "var(--md-text)" : "var(--md-text-muted)" }}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? "var(--md-primary)" : "var(--md-surface-2)", margin: "0 12px" }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div></div>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

      {/* ───────── Step 0: file picker + instructions ───────── */}
      {step === 0 && (
        <>
          <Instructions title="What this tool accepts">
            <p className="mb-2">
              Upload an <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> file.
              The first sheet is read; the first row must contain column headers.
            </p>

            <div className="table-responsive">
              <Table size="sm" bordered className="mb-2 small" style={{ background: "white" }}>
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Required</th>
                    <th>Format</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_REFS.map((f) => (
                    <tr key={f.name}>
                      <td><code>{f.name}</code></td>
                      <td>{f.required ? <Badge bg="danger">Required</Badge> : <Badge bg="secondary">Optional</Badge>}</td>
                      <td>{f.format}</td>
                      <td><code>{f.example}</code></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <p className="mb-2"><strong>Column header naming is flexible</strong> — you'll get to map columns in step 2.
              Auto-detected aliases: <code>email</code>, <code>Email Address</code>, <code>e-mail</code>;
              <code>categories</code>, <code>tags</code>, <code>category</code>, <code>category_id</code>;
              <code>first_name</code>, <code>firstname</code>, <code>first name</code>.
            </p>

            <p className="mb-1"><strong>Categories column rules</strong>:</p>
            <ul className="mb-0 small">
              <li>Multiple categories per row: separate with comma, semicolon, or pipe (<code>news, promo</code>).</li>
              <li>You can use category <strong>names</strong> (case-insensitive) <em>or</em> numeric <strong>ids</strong>.</li>
              <li>The category MUST already exist in the system. Unknown categories are flagged in step 3.</li>
            </ul>
          </Instructions>

          {availableCategories.length > 0 ? (
            <Instructions title={`Available categories in this account (${availableCategories.length})`} variant="success" defaultOpen={false}>
              <div className="d-flex flex-wrap gap-2">
                {availableCategories.map((c) => (
                  <span key={c.id}
                    className="d-inline-flex align-items-center gap-2"
                    style={{ background: "white", padding: "3px 10px", borderRadius: 12, border: `1px solid ${c.color}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                    <strong>{c.name}</strong>
                    <span className="text-muted small">id={c.id}</span>
                  </span>
                ))}
              </div>
              <small className="text-muted d-block mt-2">
                Use any of these names (or their id) in the <code>categories</code> column. New categories?{" "}
                <a href="/emails/category">Create them first</a>.
              </small>
            </Instructions>
          ) : (
            <Instructions title="No categories defined yet" variant="warning" defaultOpen={true}>
              <p className="mb-1">
                You can still import subscribers, but the <code>categories</code> column will be ignored
                because there is nothing to link to. <a href="/emails/category">Create categories first →</a>
              </p>
            </Instructions>
          )}

          <div className="md-card"><div className="md-card-body">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files?.[0]); }}
              style={{
                border: `2px dashed ${dragOver ? "var(--md-primary)" : "var(--md-border-strong)"}`,
                background: dragOver ? "var(--md-primary-soft)" : "var(--md-surface-2)",
                padding: "3rem 2rem", textAlign: "center", borderRadius: 12,
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "3rem", opacity: 0.3 }}>📤</div>
              <h5>Drop a file here or browse</h5>
              <p className="text-muted small mb-3">.xlsx · .xls · .csv up to ~10MB</p>
              <Form.Control
                type="file"
                accept=".xls,.xlsx,.csv"
                onChange={(e) => accept(e.target.files?.[0])}
                style={{ maxWidth: 360, margin: "0 auto" }}
              />
            </div>

            {file && (
              <Alert variant="info" className="mt-3">
                <strong>{file.name}</strong> · {Math.round(file.size / 1024)} KB
              </Alert>
            )}

            <div className="text-end mt-3">
              <Button variant="primary" disabled={!file || busy} onClick={goPreview}>
                {busy ? <Spinner size="sm" /> : "Continue →"}
              </Button>
            </div>
          </div></div>
        </>
      )}

      {/* ───────── Step 1: column mapping ───────── */}
      {step === 1 && parsed && (
        <>
          <Instructions title="Map your spreadsheet columns to system fields">
            <p className="mb-2">
              We auto-detected your columns based on common header names. Adjust if needed.
              The <strong>email</strong> field is required.
            </p>
            <ul className="small mb-0">
              <li>Set a column to <em>— ignore —</em> to skip it.</li>
              <li>Pick the <code>categories</code> column only if your sheet has one. We will validate every value against your existing categories in the next step.</li>
            </ul>
          </Instructions>

          <div className="md-card"><div className="md-card-body">
            <Row className="g-3 mb-3">
              <Col md={3}>
                <div className="md-stat"><div>
                  <div className="md-stat-label">Sheet</div>
                  <div className="md-stat-value" style={{ fontSize: "1.1rem" }}>{parsed.sheetName}</div>
                </div></div>
              </Col>
              <Col md={3}>
                <div className="md-stat"><div>
                  <div className="md-stat-label">Rows</div>
                  <div className="md-stat-value" style={{ fontSize: "1.5rem" }}>{parsed.totalRows}</div>
                </div></div>
              </Col>
              <Col md={3}>
                <div className="md-stat"><div>
                  <div className="md-stat-label">Headers</div>
                  <div className="md-stat-value" style={{ fontSize: "1.5rem" }}>{parsed.headers.length}</div>
                </div></div>
              </Col>
              <Col md={3}>
                <div className="md-stat"><div>
                  <div className="md-stat-label">Categories on file</div>
                  <div className="md-stat-value" style={{ fontSize: "1.5rem" }}>{parsed.availableCategories?.length || 0}</div>
                </div></div>
              </Col>
            </Row>

            <h6 className="mb-2">Map your columns</h6>
            <Row className="g-3">
              {[
                { key: "email", label: "Email *", required: true, hint: "Required. The recipient address." },
                { key: "categories", label: "Categories", required: false, hint: "Comma-separated names or ids that already exist in the system." },
                { key: "first_name", label: "First name", required: false, hint: "Used for personalization tags later." },
                { key: "last_name", label: "Last name", required: false, hint: "Used for personalization tags later." },
              ].map((f) => (
                <Col md={6} key={f.key}>
                  <Form.Label>
                    {f.label}
                    {f.required && <span className="text-danger ms-1">*</span>}
                  </Form.Label>
                  <Form.Select
                    value={mapping[f.key]}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  >
                    <option value="">— ignore —</option>
                    {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Form.Select>
                  <small className="text-muted">{f.hint}</small>
                </Col>
              ))}
            </Row>

            <div className="d-flex justify-content-between mt-4">
              <Button variant="outline-secondary" onClick={() => setStep(0)}>← Back</Button>
              <Button variant="primary" disabled={!mapping.email || busy} onClick={revalidate}>
                {busy ? <Spinner size="sm" /> : "Validate →"}
              </Button>
            </div>
          </div></div>
        </>
      )}

      {/* ───────── Step 2: validation report ───────── */}
      {step === 2 && parsed && (
        <>
          {/* Quality summary */}
          <Row className="g-3 mb-3">
            <Col md={3}><div className="md-stat"><div>
              <div className="md-stat-label">Importable rows</div>
              <div className="md-stat-value" style={{ color: "var(--md-success)" }}>{parsed.quality.valid}</div>
            </div></div></Col>
            <Col md={3}><div className="md-stat"><div>
              <div className="md-stat-label">Invalid emails</div>
              <div className="md-stat-value" style={{ color: parsed.quality.invalidEmail ? "var(--md-danger)" : "var(--md-text-muted)" }}>{parsed.quality.invalidEmail}</div>
            </div></div></Col>
            <Col md={3}><div className="md-stat"><div>
              <div className="md-stat-label">Duplicates</div>
              <div className="md-stat-value" style={{ color: parsed.quality.duplicate ? "var(--md-warning)" : "var(--md-text-muted)" }}>{parsed.quality.duplicate}</div>
            </div></div></Col>
            <Col md={3}><div className="md-stat"><div>
              <div className="md-stat-label">Unknown category refs</div>
              <div className="md-stat-value" style={{ color: parsed.unknownCategoryRefs?.length ? "var(--md-warning)" : "var(--md-text-muted)" }}>{parsed.unknownCategoryRefs?.length || 0}</div>
            </div></div></Col>
          </Row>

          {parsed.unknownCategoryRefs?.length > 0 && (
            <Instructions title={`${parsed.unknownCategoryRefs.length} unknown categor${parsed.unknownCategoryRefs.length > 1 ? "ies" : "y"} found`} variant="warning">
              <p className="mb-2">
                These category values in your file don't exist in the system. They were typed in {parsed.quality.rowsWithUnknownCategories} row(s):
              </p>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {parsed.unknownCategoryRefs.slice(0, 30).map(({ ref, count }) => (
                  <span key={ref} className="badge bg-warning text-dark" style={{ fontWeight: 500 }}>
                    {ref} <span className="text-muted">×{count}</span>
                  </span>
                ))}
              </div>
              <p className="small mb-2"><strong>You can either:</strong></p>
              <ul className="small mb-2">
                <li>Fix the spelling in your spreadsheet (download our <a href="/api/admin/emails/template">sample template</a> to see exact names), or</li>
                <li>Toggle <strong>Strict category mode</strong> below to <em>reject</em> rows with unknown categories, or</li>
                <li>Leave it — those rows will import but their unknown categories will be ignored.</li>
              </ul>
              <Form.Check
                type="switch"
                id="strict-cats"
                label={<><strong>Strict category mode</strong> — reject rows with unknown categories</>}
                checked={strictCategories}
                onChange={(e) => setStrictCategories(e.target.checked)}
              />
            </Instructions>
          )}

          {parsed.rowErrors.length > 0 && (
            <div className="md-card mb-3"><div className="md-card-body">
              <h6 className="mb-3">
                Per-row issues ({parsed.rowErrors.length}{parsed.rowErrorsTruncated ? "+" : ""})
              </h6>
              <div style={{ maxHeight: 280, overflow: "auto" }}>
                <Table size="sm" bordered className="small mb-0">
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 80 }}>Row</th>
                      <th>Email</th>
                      <th>Issue(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rowErrors.map((r, i) => (
                      <tr key={i}>
                        <td>{r.row}</td>
                        <td>{r.email || <em className="text-muted">missing</em>}</td>
                        <td>
                          {r.errors.map((e, j) => (
                            <div key={j} className={
                              e.type.startsWith("email") ? "text-danger" :
                              e.type === "duplicate" ? "text-warning" : "text-secondary"
                            }>
                              {e.msg}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {parsed.rowErrorsTruncated && (
                <small className="text-muted">Showing first 200 issues. Fix your sheet and re-validate to see the rest.</small>
              )}
            </div></div>
          )}

          {/* Preview top of file */}
          <div className="md-card mb-3"><div className="md-card-body">
            <h6>Preview · first 20 rows (mapped fields highlighted)</h6>
            <div className="table-responsive">
              <Table size="sm" bordered className="small mb-0">
                <thead>
                  <tr>
                    {parsed.headers.map((h) => {
                      const mapped = Object.entries(mapping).find(([, v]) => v === h);
                      return (
                        <th key={h} style={mapped ? { background: "var(--md-primary-soft)", color: "var(--md-primary-text)" } : undefined}>
                          {h}
                          {mapped && <div style={{ fontSize: "0.7rem" }}>→ {mapped[0]}</div>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {parsed.preview.map((r, i) => (
                    <tr key={i}>
                      {parsed.headers.map((h) => <td key={h}>{String(r[h] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div></div>

          <div className="d-flex justify-content-between">
            <Button variant="outline-secondary" onClick={() => setStep(1)}>← Back</Button>
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={revalidate} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "🔄 Re-validate"}
              </Button>
              <Button
                variant="primary"
                disabled={busy || parsed.quality.valid === 0}
                onClick={commit}
              >
                {busy ? <Spinner size="sm" /> :
                 strictCategories ? `Import (strict) — ${Math.max(0, parsed.quality.valid - parsed.quality.rowsWithUnknownCategories)}` :
                 `Import ${parsed.quality.valid} subscribers`}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ───────── Step 3: done ───────── */}
      {step === 3 && result && (
        <div className="md-card"><div className="md-card-body text-center py-5">
          <div style={{ fontSize: "3rem" }}>✅</div>
          <h4>Import complete</h4>
          <Row className="g-2 mt-3" style={{ maxWidth: 720, margin: "0 auto" }}>
            <Col><div className="md-stat"><div><div className="md-stat-label">Inserted</div><div className="md-stat-value" style={{ color: "var(--md-success)" }}>{result.inserted}</div></div></div></Col>
            <Col><div className="md-stat"><div><div className="md-stat-label">Updated</div><div className="md-stat-value">{result.updated}</div></div></div></Col>
            <Col><div className="md-stat"><div><div className="md-stat-label">Cat. links</div><div className="md-stat-value">{result.categoryLinks ?? 0}</div></div></div></Col>
            <Col><div className="md-stat"><div><div className="md-stat-label">Skipped</div><div className="md-stat-value text-muted" style={{ fontSize: "1.5rem" }}>{result.skipped ?? 0}</div></div></div></Col>
          </Row>

          {result.rowsWithDroppedCats > 0 && (
            <Alert variant="warning" className="mt-3 text-start">
              <strong>{result.rowsWithDroppedCats}</strong> row(s) imported with unknown categories silently dropped (non-strict mode).
              Re-import with strict mode to reject them instead.
            </Alert>
          )}

          {result.rejectedTotal > 0 && (
            <Alert variant="danger" className="mt-3 text-start">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>{result.rejectedTotal} row(s) were rejected</strong>
                <Button size="sm" variant="outline-secondary" onClick={downloadErrorReport}>⬇ Download error report (CSV)</Button>
              </div>
              <div style={{ maxHeight: 200, overflow: "auto" }}>
                <Table size="sm" bordered className="small mb-0">
                  <thead><tr><th>Row</th><th>Email</th><th>Reason</th></tr></thead>
                  <tbody>
                    {result.rejectedRows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td>{r.row}</td>
                        <td>{r.email || <em className="text-muted">missing</em>}</td>
                        <td>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {result.rejectedRowsTruncated && (
                <small className="text-muted">Showing first 20 — download the CSV for the full list.</small>
              )}
            </Alert>
          )}

          <div className="d-flex gap-2 justify-content-center mt-4">
            <Button variant="outline-secondary" onClick={reset}>Import another file</Button>
            <Button variant="primary" onClick={() => location.assign("/emails")}>View subscribers →</Button>
          </div>
        </div></div>
      )}
    </Container>
  );
}
