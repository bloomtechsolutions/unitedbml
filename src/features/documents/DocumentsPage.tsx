'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { DocumentRegistryRow } from '../../types/database';
import { UploadModal } from './UploadModal';
import { deleteDocument, openDocument, useDocumentRegistry, useLinkedEvidence } from './useDocuments';

type SubTab = 'library' | 'folders' | 'evidence';

export function DocumentsPage() {
  const { isCommitteeUser } = useAuth();
  const { documents, loading, error, reload } = useDocumentRegistry();
  const { items: evidence, loading: evidenceLoading } = useLinkedEvidence();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('library');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(documents.map((d) => d.category))).sort(), [documents]);

  const filtered = documents.filter((d) => {
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.event_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || d.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const folders = useMemo(() => {
    const map = new Map<string, { name: string; docs: DocumentRegistryRow[] }>();
    for (const d of documents) {
      const key = d.event_id ?? 'general';
      const name = d.event_name ?? 'General / Not linked';
      if (!map.has(key)) map.set(key, { name, docs: [] });
      map.get(key)!.docs.push(d);
    }
    return Array.from(map.values()).sort((a, b) => b.docs.length - a.docs.length);
  }, [documents]);

  if (!isCommitteeUser) return <div>Committee access required.</div>;

  const handleOpen = async (bucket: string, path: string, id: string) => {
    setOpeningId(id);
    const url = await openDocument(bucket, path);
    setOpeningId(null);
    if (url) window.open(url, '_blank');
    else toast('Failed to generate a link for this document.');
  };

  const handleDelete = async (doc: DocumentRegistryRow) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(doc);
      await reload();
      toast('Document deleted');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete document.');
    }
  };

  if (loading) return <div>Loading documents…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load documents: {error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Documents</h2>
          <p>A private library for club documents, plus Procurement and AP evidence already stored elsewhere.</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setUploadOpen(true)}>
            + Upload Document
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="lbl">Total Documents</div>
          <strong>{documents.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Event Folders</div>
          <strong>{folders.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Categories</div>
          <strong>{categories.length}</strong>
        </div>
        <div className="kpi">
          <div className="lbl">Linked Evidence</div>
          <strong>{evidence.length}</strong>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${subTab === 'library' ? 'active' : ''}`} onClick={() => setSubTab('library')}>
          Library
        </button>
        <button className={`tab ${subTab === 'folders' ? 'active' : ''}`} onClick={() => setSubTab('folders')}>
          Event Folders
        </button>
        <button className={`tab ${subTab === 'evidence' ? 'active' : ''}`} onClick={() => setSubTab('evidence')}>
          Procurement & AP Evidence
        </button>
      </div>

      {subTab === 'library' && (
        <>
          <div className="toolbar">
            <div className="filters">
              <input placeholder="Search title, file, event…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Event</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>
                    <span className="pill plan">{d.category}</span>
                  </td>
                  <td>{d.event_name || '—'}</td>
                  <td>{d.uploaded_by_name || '—'}</td>
                  <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn ghost"
                      disabled={openingId === d.id}
                      onClick={() => void handleOpen(d.storage_bucket, d.storage_path, d.id)}
                    >
                      Open
                    </button>
                    <button className="btn danger" onClick={() => void handleDelete(d)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No documents match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {subTab === 'folders' && (
        <div className="event-grid">
          {folders.map((folder) => (
            <div key={folder.name} className="event-card" style={{ padding: 16, cursor: 'default' }}>
              <h3 style={{ margin: '0 0 6px' }}>{folder.name}</h3>
              <small style={{ color: 'var(--muted)' }}>{folder.docs.length} document(s)</small>
              <div style={{ marginTop: 10 }}>
                {folder.docs.map((d) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                    <span>{d.title}</span>
                    <button className="btn ghost" onClick={() => void handleOpen(d.storage_bucket, d.storage_path, d.id)}>
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!folders.length && <div style={{ color: 'var(--muted)' }}>No documents uploaded yet.</div>}
        </div>
      )}

      {subTab === 'evidence' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Read-only — these files live in the Reimbursements module's storage and are surfaced here for
            convenience, not copied. Delete them from Reimbursements if needed.
          </p>
          {evidenceLoading ? (
            <div>Loading…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Event</th>
                  <th>File</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.key}>
                    <td>{e.title}</td>
                    <td>{e.category}</td>
                    <td>{e.eventName || '—'}</td>
                    <td>{e.fileName}</td>
                    <td>
                      <button
                        className="btn ghost"
                        disabled={openingId === e.key}
                        onClick={() => e.bucket && e.path && void handleOpen(e.bucket, e.path, e.key)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!evidence.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No Procurement or AP evidence files yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={reload} />
    </div>
  );
}
