import type { ReportColumn, ReportRow } from './types';

function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Legacy exports via SheetJS (xlsx@0.18.5), which has unpatched high-severity advisories with no
 * fix available (same call made for Staff Master's bulk import) — this exports CSV instead, which
 * opens in Excel/Sheets identically for tabular data without the dependency risk.
 */
export function exportReportCsv(title: string, columns: ReportColumn[], rows: ReportRow[]) {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
