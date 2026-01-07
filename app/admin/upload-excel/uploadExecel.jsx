"use client";

import axios from "axios";
import Link from "next/link";
import React, { useState } from "react";
import { Form, Button, Alert, Container, Spinner } from "react-bootstrap";

const ExcelUpload = () => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const allowedTypes = [
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];

    if (selectedFile) {
      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setError(null);
        setSuccess(null);
      } else {
        setFile(null);
        setError("Unsupported file type. Please upload an Excel (.xls or .xlsx) file.");
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a valid Excel file before uploading.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("/api/admin/emails", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess(
        `Upload successful. Inserted: ${res.data.inserted}, Skipped: ${res.data.skipped}`
      );
      setFile(null);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error || "An error occurred while uploading."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Bulk Email Sender</h3>
        <Link href="/">
          <Button variant="secondary">← Back to Home</Button>
        </Link>
      </div>
      <h4>Upload Excel File</h4>
      <Form onSubmit={handleUpload} className="mt-3">
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Label>Select Excel File (.xls, .xlsx)</Form.Label>
          <Form.Control
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
          />
        </Form.Group>

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {file && (
          <Alert variant="info">Selected file: {file.name}</Alert>
        )}

        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Uploading...
            </>
          ) : (
            "Upload"
          )}
        </Button>
      </Form>
    </Container>
  );
};

export default ExcelUpload;
