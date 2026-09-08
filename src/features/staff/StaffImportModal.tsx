'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { downloadTextFile, parseStaffCsv, staffCsvTemplate } from './csv';
import type { StaffImportRow } from './types';
import { upsertStaffRows } from './useStaff';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}

export function StaffImportModal({ open, onClose, onImported }: Props) {
  const [rows, setRows] = useState<StaffImportRow[]>([]);
  const [rejected, setRejected] = useState(0);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    const text = await file.text();
    const parsed = parseStaffCsv(text);
    const valid = parsed.filter((r) => r.uid.trim() && r.name.trim());
    setRows(valid);
    setRejected(parsed.length - valid.length);
  };

  const handleImport = async () => {
    if (!rows.length) {
      setError('No valid rows to import.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const result = await upsertStaffRows(rows);
      await onImported();
      setRows([]);
      setRejected(0);
      onClose();
      alert(`Import complete: ${result.affected} record(s) saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Bulk Import Staff (CSV)" wide>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
        Columns: UID, Name, Job Title, Division, Department, Unit. Header names are matched
        case-insensitively with common aliases. Rows missing UID or Name are rejected.
      </p>
      <button className="btn ghost" onClick={() => downloadTextFile('staff-master-template.csv', staffCsvTemplate())}>
        Download Template
      </button>

      <div className="field full" style={{ marginTop: 16 }}>
        <label>CSV File</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {rows.length > 0 && (
        <>
          <p style={{ fontSize: 13, marginTop: 12 }}>
            <b>{rows.length}</b> valid row(s), <b>{rejected}</b> rejected.
          </p>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Job Title</th>
                  <th>Division</th>
                  <th>Department</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 30).map((r, i) => (
                  <tr key={i}>
                    <td>{r.uid}</td>
                    <td>{r.name}</td>
                    <td>{r.jobTitle}</td>
                    <td>{r.division}</td>
                    <td>{r.department}</td>
                    <td>{r.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={importing}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void handleImport()} disabled={importing || !rows.length}>
          {importing ? 'Importing…' : `Import ${rows.length} Record(s)`}
        </button>
      </div>
    </Modal>
  );
}
