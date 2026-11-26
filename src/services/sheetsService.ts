export function isPublishedCsvUrl(inputUrl: string): boolean {
  const trimmed = inputUrl.trim().toLowerCase();
  return (
    trimmed.includes('/pub?') ||
    trimmed.includes('output=csv') ||
    trimmed.includes('/export?format=csv')
  );
}

export function parseGoogleSheetUrl(inputUrl: string): {
  spreadsheetId: string | null;
  gid: number | null;
} {
  const trimmed = inputUrl.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  const directIdMatch =
    !idMatch && !isPublishedCsvUrl(trimmed) && /^[a-zA-Z0-9-_]{20,60}$/.test(trimmed)
      ? trimmed
      : null;

  return {
    spreadsheetId: idMatch ? idMatch[1] : directIdMatch,
    gid: gidMatch ? Number(gidMatch[1]) : null,
  };
}

export function resolvePublicCsvUrl(inputUrl: string): string | null {
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;
  if (isPublishedCsvUrl(trimmed)) {
    return trimmed;
  }
  const { spreadsheetId, gid } = parseGoogleSheetUrl(trimmed);
  if (spreadsheetId) {
    const gidParam = gid !== null ? `&gid=${gid}` : '';
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId
    )}/export?format=csv${gidParam}`;
  }
  return null;
}

export async function fetchPublicGoogleSheetCsv(
  spreadsheetId: string,
  gid: string,
  label: string
): Promise<string> {
  const ts = Date.now();
  const proxyUrl = `/api/sheet-csv?id=${encodeURIComponent(
    spreadsheetId
  )}&gid=${encodeURIComponent(gid)}&_ts=${ts}`;

  try {
    const proxyRes = await fetch(proxyUrl, { cache: 'no-store' });
    const proxyCt = (proxyRes.headers.get('content-type') || '').toLowerCase();
    if (proxyRes.ok && !proxyCt.includes('text/html') && !proxyCt.includes('application/json')) {
      const text = await proxyRes.text();
      const trimmed = text.trim();
      if (trimmed && !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html')) {
        return text;
      }
    }
  } catch {
    // Fallback to direct anonymous Google Sheets export when proxy is unavailable (e.g. Vite dev)
  }

  const directUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/export?format=csv&gid=${encodeURIComponent(gid)}&_ts=${ts}`;

  const directRes = await fetch(directUrl, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow',
  });

  if (!directRes.ok) {
    throw new Error(
      `Gagal mengunduh data ${label} (HTTP ${directRes.status}). Pastikan akses spreadsheet publik ("Siapa saja yang memiliki link").`
    );
  }

  const csvText = await directRes.text();
  const trimmed = csvText.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    throw new Error(
      `Spreadsheet ${label} mengembalikan halaman login/HTML. Pastikan tautan dibagikan publik tanpa perlu login Google.`
    );
  }

  return csvText;
}

export function parseSignedNumericCell(raw: string | undefined): number {
  if (!raw) return 0;
  let cleaned = String(raw).trim();
  if (!cleaned) return 0;

  cleaned = cleaned.replace(/rp\.?/gi, '').replace(/[^\d.,-]/g, '');
  if (!cleaned || cleaned === '-') return 0;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    const intDigits = parts[0].replace('-', '');
    if (
      parts.length === 2 &&
      parts[1] &&
      parts[1].length === 3 &&
      intDigits.length >= 1 &&
      intDigits.length <= 3
    ) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    const intDigits = parts[0].replace('-', '');
    if (
      parts.length > 2 ||
      (parts[1] && parts[1].length === 3 && intDigits.length >= 1 && intDigits.length <= 3)
    ) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.max(-1_000_000_000, Math.min(1_000_000_000, num));
}

export function parseNumericCell(raw: string | undefined): number {
  return Math.max(0, parseSignedNumericCell(raw));
}

export function parseDelimitedText(text: string): string[][] {
  const rows: string[][] = [];
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const delimiter =
    tabCount > commaCount && tabCount > semiCount
      ? '\t'
      : semiCount > commaCount
      ? ';'
      : ',';

  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}
