'use client'
import React, { useEffect, useState } from "react";
import {
  Table,
  Badge,
  OverlayTrigger,
  Tooltip,
  Spinner,
  Pagination,
  Form,
  Row,
  Col,
  Button,
} from "react-bootstrap";
import axios from "axios";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import Link from "next/link";

const ITEMS_PER_PAGE = 20;

export default function EmailSubscriptionTable() {
  const [subscribers, setSubscribers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState("none");

  // Fetch subscribers
  const fetchSubscribers = async () => {
    try {
      const response = await axios.get("/api/admin/emails");
      const data = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data.data)
        ? response.data.data
        : [];
      setSubscribers(data);
    } catch (err) {
      console.error("Failed to fetch subscribers:", err);
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/admin/categories");
      setCategories(res.data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSubscribers();
  }, []);

  // Toggle subscribe status via PUT /api/admin/emails/[email]
  const toggleStatus = async (email) => {
    try {
      const res = await axios.put(
        `/api/admin/emails/${encodeURIComponent(email)}`
      );
      const { subscribe: newSub } = res.data;
      setSubscribers((prev) =>
        prev.map((s) =>
          s.email === email ? { ...s, subscribe: newSub } : s
        )
      );
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  // Update category via same PUT endpoint with { category_id }
  const updateCategory = async (email, newCatId) => {
    try {
      const res = await axios.put(
        `/api/admin/emails/${encodeURIComponent(email)}`,
        { category_id: newCatId }
      );
      const { category_id } = res.data;
      setSubscribers((prev) =>
        prev.map((s) =>
          s.email === email ? { ...s, category_id } : s
        )
      );
    } catch (err) {
      console.error("Category update failed:", err);
      // Optionally show a toast or alert here
    }
  };

  // Sort toggle
  const handleSortToggle = () => {
    setSortOrder((prev) =>
      prev === "none" ? "asc" : prev === "asc" ? "desc" : "none"
    );
  };

  // Category filter change
  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1);
  };

  // Apply filters, search, sort
  const filtered = subscribers
    .filter((s) =>
      selectedCategory === "all"
        ? true
        : s.category_id === parseInt(selectedCategory, 10)
    )
    .filter((s) =>
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === "asc") return a.subscribe - b.subscribe;
      if (sortOrder === "desc") return b.subscribe - a.subscribe;
      return 0;
    });

  const indexOfLast = currentPage * ITEMS_PER_PAGE;
  const indexOfFirst = indexOfLast - ITEMS_PER_PAGE;
  const currentItems = filtered.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const activeCount = filtered.filter((s) => s.subscribe === 1).length;
  const inactiveCount = filtered.filter((s) => s.subscribe === 0).length;

  const renderPagination = () => {
    const items = [];
    const maxShow = 5;
    let start = Math.max(1, currentPage - Math.floor(maxShow / 2));
    let end = Math.min(totalPages, start + maxShow - 1);
    if (end - start < maxShow - 1) {
      start = Math.max(1, end - maxShow + 1);
    }
    if (start > 1) {
      items.push(
        <Pagination.First
          key="first"
          onClick={() => setCurrentPage(1)}
        />
      );
      items.push(
        <Pagination.Prev
          key="prev"
          onClick={() => setCurrentPage(currentPage - 1)}
        />
      );
    }
    for (let num = start; num <= end; num++) {
      items.push(
        <Pagination.Item
          key={num}
          active={num === currentPage}
          onClick={() => setCurrentPage(num)}
        >
          {num}
        </Pagination.Item>
      );
    }
    if (end < totalPages) {
      items.push(
        <Pagination.Next
          key="next"
          onClick={() => setCurrentPage(currentPage + 1)}
        />
      );
      items.push(
        <Pagination.Last
          key="last"
          onClick={() => setCurrentPage(totalPages)}
        />
      );
    }
    return <Pagination>{items}</Pagination>;
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading subscribers...</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Bulk Email Sender</h3>
        <Link href="/">
          <Button variant="secondary">← Back to Home</Button>
        </Link>
      </div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Email Subscribers</h4>
        <Link href="/admin/upload-excel">
          <Button variant="primary">Upload Emails</Button>
        </Link>
        <Link href="/emails/category">
          <Button variant="primary">Create Categories</Button>
        </Link>
      </div>

      {/* Filters */}
      <Row className="mb-3 align-items-center">
        <Col md={4}>
          <Form.Control
            type="text"
            placeholder="Search email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </Col>
        <Col md={4}>
          <Form.Select
            value={selectedCategory}
            onChange={handleCategoryChange}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4} className="text-md-end mt-2 mt-md-0">
          <Badge bg="success" className="me-2">
            Active: {activeCount}
          </Badge>
          <Badge bg="secondary">
            Inactive: {inactiveCount}
          </Badge>
        </Col>
      </Row>

      {/* Table */}
      <Table bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th>S.No</th>
            <th>Email</th>
            <th>Category</th>
            <th
              style={{ cursor: "pointer" }}
              onClick={handleSortToggle}
            >
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip>
                    Sort by status:{" "}
                    {sortOrder === "none"
                      ? "Active first"
                      : sortOrder === "asc"
                      ? "Inactive first"
                      : "No sort"}
                  </Tooltip>
                }
              >
                <span className="d-inline-flex align-items-center gap-1">
                  Subscribe{" "}
                  {sortOrder === "asc" && <FaSortDown />}
                  {sortOrder === "desc" && <FaSortUp />}
                  {sortOrder === "none" && <FaSort />}
                </span>
              </OverlayTrigger>
            </th>
          </tr>
        </thead>
        <tbody>
          {currentItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center">
                No matching subscribers found.
              </td>
            </tr>
          ) : (
            currentItems.map((subscriber, idx) => {
              const isActive = subscriber.subscribe === 1;
              const badgeColor = isActive ? "success" : "secondary";
              const hoverMsg = isActive
                ? "Click to deactivate"
                : "Click to activate";

              return (
                <tr key={subscriber.email}>
                  <td>{indexOfFirst + idx + 1}</td>
                  <td>{subscriber.email}</td>
                  <td>
                    <Form.Select
                      size="sm"
                      value={subscriber.category_id}
                      onChange={(e) =>
                        updateCategory(
                          subscriber.email,
                          parseInt(e.target.value, 10)
                        )
                      }
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </Form.Select>
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{hoverMsg}</Tooltip>}
                    >
                      <Badge
                        bg={badgeColor}
                        style={{
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                        onClick={() =>
                          toggleStatus(subscriber.email)
                        }
                      >
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </OverlayTrigger>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center">
          {renderPagination()}
        </div>
      )}
    </div>
  );
}
