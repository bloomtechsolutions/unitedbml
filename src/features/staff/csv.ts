import type { StaffImportRow } from './types';

/** Mirrors the legacy smCell() header-alias matcher: tolerant of slightly-varied column names. */
const HEADER_ALIASES: Record<keyof StaffImportRow, string[]> = {
  uid: ['uid', 'staff id', 'id'],
  name: ['name', 'full name', 'staff name'],
  jobTitle: ['job title', 'title', 'designation'],
  division: ['division'],
  department: ['department', 'dept'],
  unit: ['unit', 'branch'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function parseStaffCsv(text: string): StaffImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  const columnFor = (field: keyof StaffImportRow): number => {
    const aliases = HEADER_ALIASES[field];
    return headers.findIndex((h) => aliases.includes(h));
  };
  const indexes: Record<keyof StaffImportRow, number> = {
    uid: columnFor('uid'),
    name: columnFor('name'),
    jobTitle: columnFor('jobTitle'),
    division: columnFor('division'),
    department: columnFor('department'),
    unit: columnFor('unit'),
  };

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');
    return {
      uid: get(indexes.uid),
      name: get(indexes.name),
      jobTitle: get(indexes.jobTitle),
      division: get(indexes.division),
      department: get(indexes.department),
      unit: get(indexes.unit),
    };
  });
}

export function staffCsvTemplate(): string {
  return 'UID,Name,Job Title,Division,Department,Unit\nSTF001,Jane Doe,Officer,Operations,Finance,Male Office\n';
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
