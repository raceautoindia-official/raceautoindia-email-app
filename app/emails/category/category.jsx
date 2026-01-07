'use client'
// pages/categories.js
import { useState, useEffect } from 'react'

export default function CategoriesPage() {
  const [cats, setCats] = useState([])
  const [form, setForm] = useState({
    id: 0,
    name: '',
    slug: '',
    is_active: true,
    description: '',
  })
  const [mode, setMode] = useState('create') // 'create' or 'edit'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch all categories
  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      setCats(data)
    } catch (e) {
      setError('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Submit create or update
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const url =
        mode === 'create'
          ? '/api/admin/categories'
          : `/api/admin/categories/${form.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
      // reset form
      setForm({ id: 0, name: '', slug: '', is_active: true, description: '' })
      setMode('create')
    } catch (e) {
      setError(e.message || 'Save failed')
    }
  }

  // Prepare to edit
  const startEdit = (cat) => {
    setForm(cat)
    setMode('edit')
    setError('')
  }

  // Cancel edit
  const cancelEdit = () => {
    setForm({ id: 0, name: '', slug: '', is_active: true, description: '' })
    setMode('create')
    setError('')
  }

  // Delete
  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return
    try {
      await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      setCats(cats.filter((c) => c.id !== id))
    } catch {
      setError('Delete failed')
    }
  }

  return (
    <div className="container py-4">
      <h1>Categories</h1>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="row g-2">
          <div className="col-md-3">
            <input
              name="name"
              className="form-control"
              placeholder="Name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-3">
            <input
              name="slug"
              className="form-control"
              placeholder="Slug"
              value={form.slug}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-2 d-flex align-items-center">
            <div className="form-check">
              <input
                name="is_active"
                type="checkbox"
                className="form-check-input"
                id="catActive"
                checked={form.is_active}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="catActive">
                Active
              </label>
            </div>
          </div>
          <div className="col-md-4">
            <input
              name="description"
              className="form-control"
              placeholder="Description"
              value={form.description}
              onChange={handleChange}
            />
          </div>
        </div>
        <div className="mt-2">
          <button type="submit" className="btn btn-primary">
            {mode === 'create' ? 'Create' : 'Update'}
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              className="btn btn-secondary ms-2"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Category Id</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Active</th>
              <th>Description</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat.id}>
                <td>{cat.id}</td>
                <td>{cat.name}</td>
                <td>{cat.slug}</td>
                <td>
                  {cat.is_active ? (
                    <span className="badge bg-success">Yes</span>
                  ) : (
                    <span className="badge bg-danger">No</span>
                  )}
                </td>
                <td>{cat.description}</td>
                {cat.id !== 1 && (<td>
                  <button
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={() => startEdit(cat)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(cat.id)}
                  >
                    Delete
                  </button>
                </td>)}
              </tr>
            ))}
            {cats.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center">
                  No categories yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
