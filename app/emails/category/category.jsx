'use client';

import { useEffect, useState } from "react";
import {
  Table, Button, Badge, Form, Modal, Spinner, Card,
} from "react-bootstrap";
import axios from "axios";
import { PageHeader } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";
import Instructions from "@/app/components/Instructions";

const PRESET_COLORS = [
  "#0d6efd", "#6610f2", "#6f42c1", "#d63384", "#dc3545",
  "#fd7e14", "#ffc107", "#198754", "#20c997", "#0dcaf0",
  "#6c757d", "#212529",
];

const slugify = (s) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const blank = { id: 0, name: "", slug: "", is_active: true, description: "", color: PRESET_COLORS[0] };

export default function CategoriesPage() {
  const toast = useToast();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [mode, setMode] = useState("create");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/admin/categories?with_counts=1");
      setCats(data || []);
    } catch (e) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ ...blank, color: PRESET_COLORS[cats.length % PRESET_COLORS.length] });
    setMode("create");
    setShowForm(true);
  };

  const openEdit = (c) => {
    setForm({
      id: c.id,
      name: c.name || "",
      slug: c.slug || "",
      is_active: Boolean(c.is_active),
      description: c.description || "",
      color: c.color || PRESET_COLORS[0],
    });
    setMode("edit");
    setShowForm(true);
  };

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === "checkbox" ? checked : value };
      if (name === "name" && (mode === "create" || !f.slug)) next.slug = slugify(value);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = mode === "create" ? "/api/admin/categories" : `/api/admin/categories/${form.id}`;
      const method = mode === "create" ? "post" : "put";
      await axios[method](url, form);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cat) => {
    const total = Number(cat.total) || 0;
    const msg = total > 0
      ? `"${cat.name}" has ${total} subscriber link(s). Deleting will unlink them. Continue?`
      : `Delete "${cat.name}"?`;
    if (!confirm(msg)) return;
    try {
      await axios.delete(`/api/admin/categories/${cat.id}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Delete failed");
    }
  };

  const move = async (id, dir) => {
    const idx = cats.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) return;
    const reordered = [...cats];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setCats(reordered);
    try {
      await axios.post("/api/admin/categories/reorder", {
        order: reordered.map((c, i) => ({ id: c.id, position: i + 1 })),
      });
    } catch {
      load();
    }
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={`${cats.length} categor${cats.length === 1 ? "y" : "ies"} · drag with ↑ ↓ to reorder`}
        actions={<Button variant="primary" onClick={openCreate}>+ New category</Button>}
      />

      <Instructions title="How categories work" defaultOpen={false}>
        <ul className="mb-0 small">
          <li>A subscriber can belong to <strong>multiple</strong> categories.</li>
          <li><strong>Name</strong> is what's shown in the UI; <strong>slug</strong> is the URL-safe id (auto-generated, edit if needed).</li>
          <li><strong>Color</strong> is used as the chip background in subscriber tables and the dashboard.</li>
          <li>To bulk-assign categories during import, add a <code>categories</code> column to your Excel with comma-separated names or ids — they must already exist here.</li>
          <li>Deleting a category soft-deletes it and unlinks all subscribers from it; subscribers themselves are not removed.</li>
        </ul>
      </Instructions>

      {loading ? (
        <Spinner />
      ) : cats.length === 0 ? (
        <Card>
          <Card.Body className="text-center text-muted">
            <p>No categories yet.</p>
            <Button variant="primary" onClick={openCreate}>Create your first category</Button>
          </Card.Body>
        </Card>
      ) : (
        <Table bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th style={{ width: 100 }}>Order</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Active</th>
              <th>Total</th>
              <th>Active subs</th>
              <th>Inactive</th>
              <th>Description</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c, idx) => (
              <tr key={c.id}>
                <td>
                  <Button size="sm" variant="outline-secondary" disabled={idx === 0}
                    onClick={() => move(c.id, "up")}>↑</Button>
                  <Button size="sm" variant="outline-secondary" className="ms-1"
                    disabled={idx === cats.length - 1} onClick={() => move(c.id, "down")}>↓</Button>
                </td>
                <td>
                  <span style={{
                    display: "inline-block", width: 12, height: 12, borderRadius: "50%",
                    background: c.color, marginRight: 8, verticalAlign: "middle",
                  }} />
                  <strong>{c.name}</strong>
                </td>
                <td><code className="small">{c.slug}</code></td>
                <td>
                  {c.is_active ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>}
                </td>
                <td>{c.total ?? 0}</td>
                <td><span className="text-success">{c.active ?? 0}</span></td>
                <td><span className="text-muted">{c.inactive ?? 0}</span></td>
                <td>{c.description}</td>
                <td>
                  <Button size="sm" variant="outline-primary" onClick={() => openEdit(c)}>Edit</Button>{" "}
                  <Button size="sm" variant="outline-danger" onClick={() => remove(c)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={showForm} onHide={() => setShowForm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{mode === "create" ? "New category" : `Edit "${form.name}"`}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                name="name"
                value={form.name}
                onChange={change}
                required
                placeholder="e.g. Newsletter"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Slug</Form.Label>
              <Form.Control name="slug" value={form.slug} onChange={change} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Color</Form.Label>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((col) => (
                  <span
                    key={col}
                    onClick={() => setForm({ ...form, color: col })}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", background: col,
                      cursor: "pointer",
                      border: form.color === col ? "3px solid #212529" : "1px solid #dee2e6",
                    }}
                  />
                ))}
              </div>
              <Form.Control
                type="color"
                name="color"
                value={form.color}
                onChange={change}
                style={{ width: 80, height: 38 }}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                name="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={change}
                label="Active"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="description"
                value={form.description || ""}
                onChange={change}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : mode === "create" ? "Create" : "Update"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
