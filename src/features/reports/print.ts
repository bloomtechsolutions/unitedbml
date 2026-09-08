import type { ReportColumn, ReportRow } from './types';

function formatCell(value: unknown, type: ReportColumn['type']): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money') return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 });
  if (type === 'number') return String(value);
  return String(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * A shared print-popup helper — the legacy build duplicated this "open a window, write a styled
 * HTML doc, print" pattern independently in Meetings, Finance's EXCO report, Reimbursements'
 * report tab, and this Reports hub. Consolidated here as the one implementation.
 */
export function printReport(title: string, columns: ReportColumn[], rows: ReportRow[]) {
  const w = window.open('', '_blank');
  if (!w) return;
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td class="${c.type === 'money' || c.type === 'number' ? 'num' : ''}">${escapeHtml(formatCell(row[c.key], c.type))}</td>`).join('')}</tr>`)
    .join('');
  w.document.write(
    `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
      @page{size:A4 landscape;margin:14mm}
      body{font-family:Arial,sans-serif;color:#17233d;font-size:11px}
      h1{font-size:18px;border-bottom:3px solid #ef476f;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f4f6fb;text-transform:uppercase;font-size:9px}
      td.num{text-align:right;font-variant-numeric:tabular-nums}
    </style></head><body><h1>${escapeHtml(title)}</h1><p>${rows.length} row(s) · generated ${new Date().toLocaleString()}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
  );
  w.document.close();
  setTimeout(() => w.print(), 250);
}
