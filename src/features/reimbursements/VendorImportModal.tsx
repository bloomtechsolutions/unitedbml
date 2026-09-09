'use client';

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { downloadTextFile, parseVendorCsv, vendorCsvTemplate, type VendorImportRow } from './vendorCsv';
import { upsertVendorRows } from './useReimbursements';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}

export function VendorImportModal({ open, onClose, onImported }: Props) {
  const [rows, setRows] = useState<VendorImportRow[]>([]);
  const [rejected, setRejected] = useState(0);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    const text = await file.text();
    const parsed = parseVendorCsv(text);
    const valid = parsed.filter((r) => r.vendorAccount.trim() && r.name.trim());
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
      const result = await upsertVendorRows(rows);
      await onImported();
      setRows([]);
      setRejected(0);
      onClose();
      alert(`Import complete: ${result.affected} vendor(s) saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Bulk Import Vendors (CSV / Excel)" wide>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
        Save your Excel sheet as CSV first (File → Save As → CSV). Columns: Vendor Account, Name, Worker ID,
        Status. Header names are matched case-insensitively. Rows missing Vendor Account or Name are rejected.
        Existing vendor accounts are updated in place.
      </p>
      <button className="btn ghost" onClick={() => downloadTextFile('vendor-master-template.csv', vendorCsvTemplate())}>
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
                  <th>Vendor Account</th>
                  <th>Name</th>
                  <th>Worker ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 30).map((r, i) => (
                  <tr key={i}>
                    <td>{r.vendorAccount}</td>
                    <td>{r.name}</td>
                    <td>{r.workerId}</td>
                    <td>{r.status}</td>
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
