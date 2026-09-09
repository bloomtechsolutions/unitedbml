'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { DocumentRegistryRow } from '../../types/database';
import { UploadModal } from './UploadModal';
import {
  deleteDocument,
  openApprovedNote,
  openDocument,
  useApprovedNotes,
  useDocumentRegistry,
  useLinkedEvidence,
} from './useDocuments';

type SubTab = 'library' | 'folders' | 'notes' | 'evidence';

interface FolderItem {
  key: string;
  title: string;
  open: () => void;
}

interface FolderGroup {
  key: string;
  name: string;
  sections: { label: string; items: FolderItem[] }[];
  total: number;
}

export function DocumentsPage() {
  const { isCommitteeUser } = useAuth();
  const { documents, loading, error, reload } = useDocumentRegistry();
  const { items: evidence, loading: evidenceLoading } = useLinkedEvidence();
  const { notes, loading: notesLoading } = useApprovedNotes();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('library');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);

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

  const handleOpen = async (bucket: string, path: string, id: string) => {
    setOpeningId(id);
    const url = await openDocument(bucket, path);
    setOpeningId(null);
    if (url) window.open(url, '_blank');
    else toast('Failed to generate a link for this document.');
  };

  const handleOpenNote = async (expenseRequestId: string) => {
    setOpeningNoteId(expenseRequestId);
    try {
      await openApprovedNote(expenseRequestId);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate the approval note.');
    } finally {
      setOpeningNoteId(null);
    }
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

  // Event Folders: sub-categorized per event — manual uploads grouped by their Category,
  // plus that event's Approved Notes and Procurement/AP evidence rolled into the same folder.
  const folders = useMemo<FolderGroup[]>(() => {
    const map = new Map<string, FolderGroup>();
    const get = (eventId: string | null, eventName: string | null) => {
      const key = eventId ?? 'general';
      const name = eventName ?? 'General / Not linked';
      if (!map.has(key)) map.set(key, { key, name, sections: [], total: 0 });
      return map.get(key)!;
    };
    const section = (group: FolderGroup, label: string) => {
      let s = group.sections.find((x) => x.label === label);
      if (!s) {
        s = { label, items: [] };
        group.sections.push(s);
      }
      return s;
    };

    for (const d of documents) {
      const group = get(d.event_id, d.event_name);
      section(group, d.category).items.push({
        key: d.id,
        title: d.title,
        open: () => void handleOpen(d.storage_bucket, d.storage_path, d.id),
      });
      group.total++;
    }
    for (const n of notes) {
      const group = get(n.eventId, n.eventName);
      section(group, 'Approved Notes').items.push({
        key: n.expenseRequestId,
        title: `Approval Note — ${n.requestNumber ?? n.title ?? 'Expense'}`,
        open: () => void handleOpenNote(n.expenseRequestId),
      });
      group.total++;
    }
    for (const e of evidence) {
      const group = get(e.eventId, e.eventName);
      section(group, e.category === 'PROCUREMENT' ? 'Procurement' : 'Bills & Receipts').items.push({
        key: e.key,
        title: e.title,
        open: () => e.bucket && e.path && void handleOpen(e.bucket, e.path, e.key),
      });
      group.total++;
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, notes, evidence]);

  if (!isCommitteeUser) return <div>Committee access required.</div>;

  if (loading) return <div>Loading documents…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load documents: {error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Documents</h2>
          <p>A private library for club documents, approval notes, plus Procurement and AP evidence already stored elsewhere.</p>
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
          <div className="lbl">Approved Notes</div>
          <strong>{notes.length}</strong>
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
        <button className={`tab ${subTab === 'notes' ? 'active' : ''}`} onClick={() => setSubTab('notes')}>
          Approved Notes
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
            <div key={folder.key} className="event-card" style={{ padding: 16, cursor: 'default' }}>
              <h3 style={{ margin: '0 0 6px' }}>{folder.name}</h3>
              <small style={{ color: 'var(--muted)' }}>{folder.total} document(s)</small>
              <div style={{ marginTop: 10 }}>
                {folder.sections.map((section) => (
                  <div key={section.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', margin: '6px 0 4px' }}>
                      {section.label}
                    </div>
                    {section.items.map((item) => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                        <span>{item.title}</span>
                        <button className="btn ghost" onClick={item.open}>
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!folders.length && <div style={{ color: 'var(--muted)' }}>No documents uploaded yet.</div>}
        </div>
      )}

      {subTab === 'notes' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Generated on demand from each approved Expense Request — not stored, always reflects the current
            approval record.
          </p>
          {notesLoading ? (
            <div>Loading…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Event</th>
                  <th>Approved</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.expenseRequestId}>
                    <td>{n.title || n.requestNumber}</td>
                    <td>{n.eventName || 'General'}</td>
                    <td>{n.approvedAt ? new Date(n.approvedAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <button
                        className="btn ghost"
                        disabled={openingNoteId === n.expenseRequestId}
                        onClick={() => void handleOpenNote(n.expenseRequestId)}
                      >
                        {openingNoteId === n.expenseRequestId ? 'Generating…' : 'Generate & Open'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!notes.length && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No approved expense requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
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
