import type { ReportFilters, ReportRow } from './types';

export function applyReportFilters(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  return rows.filter((row) => {
    if (filters.from && row._date && row._date < filters.from) return false;
    if (filters.to && row._date && row._date > filters.to) return false;
    if (filters.eventId && row._eventId !== filters.eventId) return false;
    if (filters.status && row._status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matches = Object.values(row).some((v) => typeof v === 'string' && v.toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });
}
