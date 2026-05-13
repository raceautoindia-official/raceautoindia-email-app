"use client";

import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import axios from "axios";
import CategoryChips from "./CategoryChips";

export default function CategoryPicker({
  show,
  onHide,
  email,
  initial = [],
  categories,
  onSaved,
  title,
}) {
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (show) {
      setSelected(new Set((initial || []).map((c) => c.id)));
      setError("");
      setSearch("");
    }
  }, [show, initial]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.put(
        `/api/admin/emails/${encodeURIComponent(email)}/categories`,
        { category_ids: Array.from(selected) }
      );
      onSaved?.(Array.from(selected));
      onHide?.();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const filteredCats = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title || `Categories — ${email}`}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Control
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        {filteredCats.length === 0 ? (
          <p className="text-muted">No categories. Create one in Categories page.</p>
        ) : (
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            {filteredCats.map((c) => (
              <Form.Check
                key={c.id}
                id={`cat-pick-${c.id}`}
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                label={
                  <span className="d-inline-flex align-items-center gap-2">
                    <span
                      style={{
                        background: c.color || "#6c757d",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    />
                    {c.name}
                  </span>
                }
                className="mb-1"
              />
            ))}
          </div>
        )}
        {selected.size > 0 && (
          <div className="mt-3">
            <small className="text-muted d-block mb-1">Selected:</small>
            <CategoryChips
              categories={categories.filter((c) => selected.has(c.id))}
            />
          </div>
        )}
        {error && <div className="text-danger mt-2">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Save"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
