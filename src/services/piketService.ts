import { parseDelimitedText } from './sheetsService';

export const PIKET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQyhc3GJMo8yzDtUPFnQrWlzb7SOCBZFAys7bR25OeONW8VhUZvr5D2zNu90hboAg/pub?gid=418796009&single=true&output=csv';

export interface PiketDayColumn {
  colIndex: number;
  dayName: string;
  dayNumber: number;
  isWeekend: boolean;
}

export interface PiketScheduleRow {
  rowNo: string;
  nip: string;
  name: string;
  category: string;
  assignedDays: number[];
  totalShifts: number;
}

export interface PiketSheetData {
  title: string;
  unit: string;
  formCode: string;
  periodLabel: string;
  days: PiketDayColumn[];
  rows: PiketScheduleRow[];
  notes: string[];
  fetchedAt: Date;
}

export async function fetchPiketSheetData(
  url: string = PIKET_CSV_URL
): Promise<PiketSheetData> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Gagal memuat data Sheet PIKET (HTTP ${res.status}).`);
  }

  const text = await res.text();
  const matrix = parseDelimitedText(text);
  if (matrix.length < 6) {
    throw new Error('Format data pada Sheet PIKET tidak lengkap atau kosong.');
  }

  const firstNonEmpty = (row: string[] | undefined) =>
    (row || []).map((c) => String(c || '').trim()).find((c) => c.length > 0) || '';

  let title = 'JADWAL RENCANA PENUGASAN PIKET/SHIFT/KATEGORI P21B KHUSUS';
  let unit = 'ULP SINJAI';
  let formCode = 'Form C1.A';
  let periodLabel = 'Oktober 2026';

  // Find header row starting with No, NIP, Nama
  let headerRowIdx = matrix.findIndex((r) => {
    const c0 = String(r[0] || '').trim().toLowerCase();
    const c1 = String(r[1] || '').trim().toLowerCase();
    const c2 = String(r[2] || '').trim().toLowerCase();
    return c0 === 'no' && c1 === 'nip' && c2 === 'nama';
  });

  if (headerRowIdx === -1) {
    headerRowIdx = 3;
  }

  if (headerRowIdx >= 1) {
    const t0 = firstNonEmpty(matrix[0]);
    if (t0) title = t0;
  }
  if (headerRowIdx >= 2) {
    const t1 = firstNonEmpty(matrix[1]);
    if (t1) unit = t1;
  }
  if (headerRowIdx >= 3) {
    const t2 = firstNonEmpty(matrix[2]);
    if (t2) formCode = t2;
  }

  const headerRow = matrix[headerRowIdx] || [];
  const periodCell = String(headerRow[4] || '').trim();
  if (periodCell) periodLabel = periodCell;

  const dayNamesRow = matrix[headerRowIdx + 1] || [];
  const dayNumbersRow = matrix[headerRowIdx + 2] || [];

  const days: PiketDayColumn[] = [];
  for (let col = 4; col < Math.max(dayNamesRow.length, dayNumbersRow.length); col++) {
    const dayNumRaw = String(dayNumbersRow[col] || '').trim();
    const dayNameRaw = String(dayNamesRow[col] || '').trim();
    const dayNumber = Number(dayNumRaw);
    if (!dayNumRaw || !Number.isFinite(dayNumber) || dayNumber <= 0) continue;

    const lowerDay = dayNameRaw.toLowerCase();
    days.push({
      colIndex: col,
      dayName: dayNameRaw || `H${dayNumber}`,
      dayNumber,
      isWeekend: lowerDay === 'sabtu' || lowerDay === 'minggu',
    });
  }

  const rows: PiketScheduleRow[] = [];
  const notes: string[] = [];
  let readingNotes = false;

  for (let r = headerRowIdx + 3; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const joinedNonEmpty = row
      .map((c) => String(c || '').trim())
      .filter(Boolean)
      .join(' ');
    if (!joinedNonEmpty) continue;

    if (joinedNonEmpty.toUpperCase().includes('CATATAN WAJIB DIBACA')) {
      readingNotes = true;
      continue;
    }

    if (readingNotes) {
      notes.push(joinedNonEmpty.replace(/^-\s*/, '').trim());
      continue;
    }

    const rowNo = String(row[0] || '').trim();
    const nip = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    const category = String(row[3] || '').trim();

    if (!name && !nip) continue;

    const assignedDays: number[] = [];
    for (const d of days) {
      const cell = String(row[d.colIndex] || '').trim();
      if (cell.length > 0 && cell !== '-' && cell !== '0') {
        assignedDays.push(d.dayNumber);
      }
    }

    rows.push({
      rowNo: rowNo || String(rows.length + 1),
      nip: nip || '—',
      name,
      category: category || 'PIKET',
      assignedDays,
      totalShifts: assignedDays.length,
    });
  }

  return {
    title,
    unit,
    formCode,
    periodLabel,
    days,
    rows,
    notes,
    fetchedAt: new Date(),
  };
}

export function exportPiketToCSV(data: PiketSheetData): void {
  const headerTop = ['No', 'NIP', 'Nama', 'Kategori Pekerjaan', ...data.days.map((d) => `${d.dayName} ${d.dayNumber}`), 'Total Hari'];
  const rows = data.rows.map((r) => {
    const set = new Set(r.assignedDays);
    return [
      r.rowNo,
      r.nip,
      r.name,
      r.category,
      ...data.days.map((d) => (set.has(d.dayNumber) ? '√' : '')),
      r.totalShifts,
    ];
  });

  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    '\uFEFF' + [headerTop, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jadwal-piket-gid-418796009.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
