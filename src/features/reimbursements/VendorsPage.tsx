'use client';

import { useMemo, useState } from 'react';
import { PageInfoPanel } from '../../components/PageInfoPanel';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import type { VendorMasterRow } from '../../types/database';
import { VendorFormModal } from './VendorFormModal';
import { VendorImportModal } from './VendorImportModal';
import { deleteVendor, useVendorMaster } from './useReimbursements';

const VENDOR_MANAGER_ROLES = ['treasurer', 'president', 'chairperson', 'vice chairperson', 'vice_chairperson', 'secretary'];

function canManageVendors(role: string | undefined): boolean {
  return !!role && VENDOR_MANAGER_ROLES.includes(role.trim().toLowerCase());
}

const VENDORS_INFO = [
  {
    q: 'What are Vendors?',
    a: 'The payee directory AP bills are raised against — account details, the linked worker/staff ID, and status. Only Treasurer, President, Chairperson, Vice Chairperson or Secretary can add, edit or remove vendor records.',
  },
  {
    q: 'Where do I use a vendor?',
    a: "When submitting an AP bill (Reimbursements → AP Submissions, or from My Space if you're an assigned Reimbursement Manager), search for the vendor by name, account or worker ID and select it — its Vendor ID and User ID fill in automatically.",
  },
  {
    q: 'How do I add many vendors at once?',
    a: 'Use Bulk Import (CSV/Excel) — download the template, fill it in, and upload it. Rows missing a Vendor Account or Name are skipped and reported.',
  },
];

export function VendorsPage() {
  const { profile } = useAuth();
  const { vendors, loading, reload } = useVendorMaster();
  const toast = useToast();

  const [tab, setTab] = useState<'vendors' | 'info'>('vendors');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VendorMasterRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const canManage = canManageVendors(profile?.role);

  const filtered = useMemo(
    () =>
      vendors.filter((v) => {
        const q = search.toLowerCase();
        return !q || v.name.toLowerCase().includes(q) || v.vendor_account.toLowerCase().includes(q) || (v.worker_id || '').toLowerCase().includes(q);
      }),
    [vendors, search]
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Vendors</h2>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${tab === 'vendors' ? 'active' : ''}`} onClick={() => setTab('vendors')}>
          Vendors ({vendors.length})
        </button>
        <button className={`tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>
          Info
        </button>
      </div>

      {tab === 'info' && <PageInfoPanel sections={VENDORS_INFO} />}

      {tab === 'vendors' && (
        <div>
          <div className="toolbar">
            <div className="filters">
              <input placeholder="Search vendor, account, worker ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {canManage && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={() => setImportOpen(true)}>
                  Bulk Import (CSV/Excel)
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  + Add Vendor
                </button>
              </div>
            )}
          </div>
          {!canManage && (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Vendors are the staff/payees used when submitting AP bills. Only Treasurer, President, Chairperson, Vice
              Chairperson or Secretary can add or edit vendors.
            </p>
          )}
          {loading ? (
            <div>Loading vendors…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Vendor Account</th>
                    <th>Name</th>
                    <th>Worker ID</th>
                    <th>Status</th>
                    {canManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.vendor_account}>
                      <td>{v.vendor_account}</td>
                      <td>{v.name}</td>
                      <td>{v.worker_id || '—'}</td>
                      <td>
                        <span className={`pill ${v.status === 'Inactive' ? 'cancel' : 'open'}`}>{v.status}</span>
                      </td>
                      {canManage && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn ghost"
                            onClick={() => {
                              setEditing(v);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn danger"
                            onClick={() => {
                              if (!confirm(`Remove vendor "${v.name}"?`)) return;
                              void deleteVendor(v.vendor_account).then(reload);
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No vendors match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <VendorFormModal
        open={formOpen}
        vendor={editing}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          await reload();
          toast('Vendor saved');
        }}
      />
      <VendorImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          await reload();
          toast('Vendors imported');
        }}
      />
    </div>
  );
}
