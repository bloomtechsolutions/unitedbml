export interface VendorImportRow {
  vendorAccount: string;
  name: string;
  workerId: string;
  status: string;
}

const HEADER_ALIASES: Record<keyof VendorImportRow, string[]> = {
  vendorAccount: ['vendor account', 'account', 'vendor id', 'vendor code'],
  name: ['name', 'vendor name'],
  workerId: ['worker id', 'staff uid', 'uid'],
  status: ['status'],
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

export function parseVendorCsv(text: string): VendorImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  const columnFor = (field: keyof VendorImportRow): number => {
    const aliases = HEADER_ALIASES[field];
    return headers.findIndex((h) => aliases.includes(h));
  };
  const indexes: Record<keyof VendorImportRow, number> = {
    vendorAccount: columnFor('vendorAccount'),
    name: columnFor('name'),
    workerId: columnFor('workerId'),
    status: columnFor('status'),
  };

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');
    return {
      vendorAccount: get(indexes.vendorAccount),
      name: get(indexes.name),
      workerId: get(indexes.workerId),
      status: get(indexes.status) || 'Active',
    };
  });
}

export function vendorCsvTemplate(): string {
  return 'Vendor Account,Name,Worker ID,Status\nV01111,Mohamed Shaig Ahmed,1892,Active\n';
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
