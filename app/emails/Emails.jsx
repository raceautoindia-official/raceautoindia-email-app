'use client';

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table, Badge, OverlayTrigger, Tooltip, Spinner, Pagination,
  Form, Row, Col, Button, Modal,
} from "react-bootstrap";
import axios from "axios";
import { FaSort, FaSortUp, FaSortDown, FaPlus } from "react-icons/fa";
import Link from "next/link";
import CategoryChips from "@/app/components/CategoryChips";
import CategoryPicker from "@/app/components/CategoryPicker";
import SubscriberDrawer from "@/app/components/SubscriberDrawer";
import { PageHeader, SkeletonRows } from "@/app/components/AppNav";
import { useToast } from "@/app/components/Toast";
import Instructions from "@/app/components/Instructions";

const ITEMS_PER_PAGE = 25;
const LAST_EVENT_OPTIONS = ["All", "Delivery", "Open", "Click", "Bounce", "Complaint", "Never"];
const SUBSCRIBE_OPTIONS = [
  { value: "", label: "All states" },
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
];

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function EmailSubscriptionTable() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounced(searchTerm, 300);
  const [selectedCatIds, setSelectedCatIds] = useState([]); // multi
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [subscribeFilter, setSubscribeFilter] = useState("");
  const [lastEventFilter, setLastEventFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("id_desc");

  // selection
  const [selected, setSelected] = useState(new Set());
  const [allMatchingMode, setAllMatchingMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkCatModal, setShowBulkCatModal] = useState(null); // 'add' | 'remove' | null
  const [bulkCatIds, setBulkCatIds] = useState([]);

  // per-row category picker
  const [pickerEmail, setPickerEmail] = useState(null);
  const [pickerInitial, setPickerInitial] = useState([]);

  // subscriber drawer
  const [drawerEmail, setDrawerEmail] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/admin/categories");
      setCategories(res.data || []);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(ITEMS_PER_PAGE));
    p.set("sort", sortOrder);
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (showUncategorized) p.set("category_id", "uncategorized");
    else if (selectedCatIds.length) p.set("category_ids", selectedCatIds.join(","));
    if (subscribeFilter) p.set("subscribe", subscribeFilter);
    if (lastEventFilter && lastEventFilter !== "All") p.set("last_event", lastEventFilter);
    return p;
  }, [page, sortOrder, debouncedSearch, selectedCatIds, showUncategorized, subscribeFilter, lastEventFilter]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const { data } = await axios.get(`/api/admin/emails?${params.toString()}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch:", err);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCatIds, showUncategorized, subscribeFilter, lastEventFilter, sortOrder]);

  useEffect(() => {
    setSelected(new Set());
    setAllMatchingMode(false);
  }, [page, debouncedSearch, selectedCatIds, showUncategorized, subscribeFilter, lastEventFilter]);

  const toggleStatus = async (email) => {
    try {
      const res = await axios.put(`/api/admin/emails/${encodeURIComponent(email)}`);
      const { subscribe: newSub } = res.data;
      setRows((prev) => prev.map((s) => (s.email === email ? { ...s, subscribe: newSub } : s)));
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const handleSortToggle = () => {
    setSortOrder((prev) =>
      prev === "subscribe_asc" ? "subscribe_desc" :
      prev === "subscribe_desc" ? "id_desc" : "subscribe_asc"
    );
  };

  // selection
  const toggleRow = (email) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
    setAllMatchingMode(false);
  };
  const allOnPageSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.email)),
    [rows, selected]
  );
  const togglePageAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.email));
      else rows.forEach((r) => next.add(r.email));
      return next;
    });
    setAllMatchingMode(false);
  };
  const selectAllMatching = () => setAllMatchingMode(true);
  const clearSelection = () => {
    setSelected(new Set());
    setAllMatchingMode(false);
  };
  const selectionCount = allMatchingMode ? total : selected.size;

  const runBulk = async (action, payload) => {
    if (selectionCount === 0) return;
    if (!confirm(`Apply "${action}" to ${selectionCount} subscriber(s)?`)) return;
    setBulkLoading(true);
    try {
      const body = { action, payload };
      if (allMatchingMode) {
        const params = buildParams();
        body.filter = {
          q: params.get("q") || undefined,
          category_id: params.get("category_id") || undefined,
          category_ids: params.get("category_ids") ? params.get("category_ids").split(",").map(Number) : undefined,
          subscribe: params.get("subscribe") || undefined,
          last_event: params.get("last_event") || undefined,
        };
      } else {
        body.emails = Array.from(selected);
      }
      const { data } = await axios.post(`/api/admin/emails/bulk`, body);
      toast.success(`Applied "${action}" to ${data.affected} of ${data.requested ?? selectionCount}`);
      clearSelection();
      fetchCategories();
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const exportSelected = () => {
    if (selectionCount === 0) return;
    const list = allMatchingMode ? null : Array.from(selected);
    const params = new URLSearchParams();
    if (list) params.set("emails", list.join(","));
    else {
      const p = buildParams();
      ["q", "category_id", "category_ids", "subscribe", "last_event"].forEach((k) => {
        const v = p.get(k);
        if (v) params.set(k, v);
      });
    }
    window.open(`/api/admin/emails/export?${params.toString()}`, "_blank");
  };

  const renderPagination = () => {
    const items = [];
    const maxShow = 5;
    let start = Math.max(1, page - Math.floor(maxShow / 2));
    let end = Math.min(totalPages, start + maxShow - 1);
    if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
    if (start > 1) {
      items.push(<Pagination.First key="first" onClick={() => setPage(1)} />);
      items.push(<Pagination.Prev key="prev" onClick={() => setPage(page - 1)} />);
    }
    for (let num = start; num <= end; num++) {
      items.push(
        <Pagination.Item key={num} active={num === page} onClick={() => setPage(num)}>
          {num}
        </Pagination.Item>
      );
    }
    if (end < totalPages) {
      items.push(<Pagination.Next key="next" onClick={() => setPage(page + 1)} />);
      items.push(<Pagination.Last key="last" onClick={() => setPage(totalPages)} />);
    }
    return <Pagination>{items}</Pagination>;
  };

  const toggleCatChip = (id) => {
    setShowUncategorized(false);
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <PageHeader
        title="Email Subscribers"
        subtitle={`${total} matching · click any chip to filter`}
        actions={
          <>
            <Link href="/admin/upload-excel"><Button variant="outline-primary">⬆ Upload</Button></Link>
            <Link href="/emails/category"><Button variant="outline-primary">🏷 Manage Categories</Button></Link>
            <Link href="/emails/email-send"><Button variant="primary">📤 New Send</Button></Link>
          </>
        }
      />

      <Instructions title="How to use this page" defaultOpen={false}>
        <ul className="mb-0 small">
          <li><strong>Click an email</strong> in the table to open the side drawer with full event timeline and edit profile / categories.</li>
          <li><strong>Click any category chip</strong> in the filter row to scope the table; click again to remove.</li>
          <li><strong>+ icon next to chips</strong> on a row opens the multi-category editor for that subscriber.</li>
          <li><strong>Bulk actions</strong> appear when you tick rows. "Select all matching filter" applies the action server-side, even across pages.</li>
          <li><strong>Suppress</strong> permanently blocks an address from future sends; remove from <a href="/emails/suppressions">Suppressions</a> to restore.</li>
        </ul>
      </Instructions>

      {/* Filter Panel */}
      <Row className="mb-2 g-2">
        <Col md={3}>
          <Form.Control
            type="text"
            placeholder="Search email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Select value={subscribeFilter} onChange={(e) => setSubscribeFilter(e.target.value)}>
            {SUBSCRIBE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>{o.label}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Select value={lastEventFilter} onChange={(e) => setLastEventFilter(e.target.value)}>
            {LAST_EVENT_OPTIONS.map((s) => (
              <option key={s} value={s}>Last event: {s}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3} className="text-md-end">
          <Badge bg="info" className="me-2">Total: {total}</Badge>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => {
              setSearchTerm("");
              setSelectedCatIds([]);
              setShowUncategorized(false);
              setSubscribeFilter("");
              setLastEventFilter("All");
              setSortOrder("id_desc");
            }}
          >
            Reset
          </Button>
        </Col>
      </Row>

      {/* Category chip filter row */}
      <div className="mb-3 d-flex gap-2 align-items-center flex-wrap">
        <small className="text-muted me-1">Filter by category:</small>
        <span
          onClick={() => {
            setSelectedCatIds([]);
            setShowUncategorized(false);
          }}
          style={{
            padding: "2px 10px",
            borderRadius: 12,
            background: !selectedCatIds.length && !showUncategorized ? "#0d6efd" : "#e9ecef",
            color: !selectedCatIds.length && !showUncategorized ? "#fff" : "#212529",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          All
        </span>
        {categories.map((c) => {
          const active = selectedCatIds.includes(c.id);
          return (
            <span
              key={c.id}
              onClick={() => toggleCatChip(c.id)}
              style={{
                padding: "2px 10px",
                borderRadius: 12,
                background: active ? c.color || "#6c757d" : "#fff",
                color: active ? "#fff" : "#212529",
                border: `1px solid ${c.color || "#6c757d"}`,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              {c.name}
            </span>
          );
        })}
        <span
          onClick={() => {
            setShowUncategorized(!showUncategorized);
            setSelectedCatIds([]);
          }}
          style={{
            padding: "2px 10px",
            borderRadius: 12,
            background: showUncategorized ? "#6c757d" : "#fff",
            color: showUncategorized ? "#fff" : "#6c757d",
            border: "1px dashed #6c757d",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Uncategorized
        </span>
      </div>

      {/* Bulk action bar */}
      {selectionCount > 0 && (
        <div className="alert alert-primary d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong>{selectionCount}</strong> selected
            {!allMatchingMode && total > selected.size && (
              <Button variant="link" size="sm" onClick={selectAllMatching}>
                Select all {total} matching
              </Button>
            )}
            {allMatchingMode && (
              <Button variant="link" size="sm" onClick={clearSelection}>Clear</Button>
            )}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="warning" disabled={bulkLoading}
              onClick={() => runBulk("unsubscribe")}>Unsubscribe</Button>
            <Button size="sm" variant="success" disabled={bulkLoading}
              onClick={() => runBulk("resubscribe")}>Resubscribe</Button>
            <Button size="sm" variant="dark" disabled={bulkLoading}
              onClick={() => { setBulkCatIds([]); setShowBulkCatModal('add'); }}>
              + Add categories
            </Button>
            <Button size="sm" variant="outline-dark" disabled={bulkLoading}
              onClick={() => { setBulkCatIds([]); setShowBulkCatModal('remove'); }}>
              − Remove categories
            </Button>
            <Button size="sm" variant="outline-danger" disabled={bulkLoading}
              onClick={() => runBulk("suppress", { reason: "manual" })}>Suppress</Button>
            <Button size="sm" variant="danger" disabled={bulkLoading}
              onClick={() => runBulk("delete")}>Delete</Button>
            <Button size="sm" variant="outline-primary" disabled={bulkLoading}
              onClick={exportSelected}>Export</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="md-card"><div className="md-card-body"><SkeletonRows rows={8} cols={5} /></div></div>
      ) : (
        <Table bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th style={{ width: 36 }}>
                <Form.Check checked={allOnPageSelected} onChange={togglePageAll} />
              </th>
              <th style={{ width: 60 }}>S.No</th>
              <th>Email</th>
              <th>Categories</th>
              <th>Last event</th>
              <th style={{ cursor: "pointer", width: 110 }} onClick={handleSortToggle}>
                <OverlayTrigger placement="top" overlay={<Tooltip>Sort by status</Tooltip>}>
                  <span className="d-inline-flex align-items-center gap-1">
                    Subscribe{" "}
                    {sortOrder === "subscribe_asc" && <FaSortDown />}
                    {sortOrder === "subscribe_desc" && <FaSortUp />}
                    {sortOrder !== "subscribe_asc" && sortOrder !== "subscribe_desc" && <FaSort />}
                  </span>
                </OverlayTrigger>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center">No matching subscribers found.</td></tr>
            ) : (
              rows.map((s, idx) => {
                const isActive = s.subscribe === 1;
                const badgeColor = isActive ? "success" : "secondary";
                return (
                  <tr key={s.email}>
                    <td>
                      <Form.Check
                        checked={selected.has(s.email) || allMatchingMode}
                        onChange={() => toggleRow(s.email)}
                        disabled={allMatchingMode}
                      />
                    </td>
                    <td>{(page - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                    <td>
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); setDrawerEmail(s.email); }}
                        style={{ color: "var(--md-text)", fontWeight: 500 }}
                      >
                        {s.email}
                      </a>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <CategoryChips categories={s.categories} />
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          style={{ padding: "0px 6px", lineHeight: 1.4 }}
                          onClick={() => {
                            setPickerEmail(s.email);
                            setPickerInitial(s.categories || []);
                          }}
                          title="Edit categories"
                        >
                          <FaPlus size={10} />
                        </Button>
                      </div>
                    </td>
                    <td>
                      {s.last_event_status ? (
                        <Badge bg="info">{s.last_event_status}</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <Badge
                        bg={badgeColor}
                        style={{ cursor: "pointer", fontSize: "0.9rem" }}
                        onClick={() => toggleStatus(s.email)}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="d-flex justify-content-center">{renderPagination()}</div>
      )}

      <CategoryPicker
        show={!!pickerEmail}
        onHide={() => setPickerEmail(null)}
        email={pickerEmail || ""}
        initial={pickerInitial}
        categories={categories}
        onSaved={() => {
          setPickerEmail(null);
          fetchRows();
          fetchCategories();
        }}
      />

      {drawerEmail && (
        <SubscriberDrawer
          email={drawerEmail}
          categories={categories}
          onClose={() => setDrawerEmail(null)}
          onChanged={() => fetchRows()}
        />
      )}

      <Modal show={!!showBulkCatModal} onHide={() => setShowBulkCatModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {showBulkCatModal === "add"
              ? `Add categories to ${selectionCount} subscriber(s)`
              : `Remove categories from ${selectionCount} subscriber(s)`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {categories.length === 0 ? (
            <p className="text-muted">No categories. Create one in Categories page.</p>
          ) : (
            categories.map((c) => (
              <Form.Check
                key={c.id}
                id={`bulk-cat-${c.id}`}
                type="checkbox"
                checked={bulkCatIds.includes(c.id)}
                onChange={(e) => {
                  if (e.target.checked) setBulkCatIds([...bulkCatIds, c.id]);
                  else setBulkCatIds(bulkCatIds.filter((x) => x !== c.id));
                }}
                label={
                  <span className="d-inline-flex align-items-center gap-2">
                    <span style={{
                      background: c.color, width: 12, height: 12,
                      borderRadius: "50%", display: "inline-block",
                    }} />
                    {c.name}
                  </span>
                }
                className="mb-1"
              />
            ))
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkCatModal(null)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!bulkCatIds.length}
            onClick={async () => {
              const action = showBulkCatModal === "add" ? "add_categories" : "remove_categories";
              setShowBulkCatModal(null);
              await runBulk(action, { category_ids: bulkCatIds });
            }}
          >
            Apply
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
