import { parseDelimitedText, parseSignedNumericCell } from './sheetsService';

export const REKAP_WORKBOOK_PUB_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_gQNpa7N4Dz2Pk2U3IhlQZpt0g4U-zOYO_Jo4owTFKWCwdP9GwHnVxE92gZxMkQ/pub';

export const REKAP_WORKBOOK_CSV_URL = `${REKAP_WORKBOOK_PUB_URL}?output=csv`;

export type WorkbookGroupId = 'stok' | 'mutasi' | 'meter' | 'lainnya';

export interface WorkbookGroupMeta {
  id: WorkbookGroupId;
  label: string;
  description: string;
}

export interface WorkbookSheetMeta {
  gid: string;
  name: string;
  group: WorkbookGroupId;
  subtitle: string;
  forwardFillFirstColDate?: boolean;
  noHeaderRow?: boolean;
  defaultHeaderLabels?: string[];
  customBlankHeaderLabels?: Record<number, string>;
  primaryQuantityHeader?: RegExp;
}

export interface ParsedWorkbookSheet {
  meta: WorkbookSheetMeta;
  csvUrl: string;
  headers: string[];
  rows: string[][];
  numericColIndices: number[];
  codeColIndices: number[];
  primaryStatLabel: string | null;
  primaryStatValue: number | null;
  fetchedAt: Date;
}

export const WORKBOOK_GROUPS: WorkbookGroupMeta[] = [
  {
    id: 'stok',
    label: 'Stok & Referensi',
    description: 'Master varian material dan referensi saldo stok terhadap AGO',
  },
  {
    id: 'mutasi',
    label: 'Mutasi Barang',
    description: 'Log transaksi material masuk dan material keluar gudang',
  },
  {
    id: 'meter',
    label: 'Meter & Master Harian',
    description: 'Rekap serial meter, daftar meteran, dan kamus nama harian',
  },
  {
    id: 'lainnya',
    label: 'Sheet Tambahan',
    description: 'Lembar kerja cadangan / kosong pada workbook spreadsheet',
  },
];

export const REKAP_WORKBOOK_SHEETS: WorkbookSheetMeta[] = [
  {
    gid: '733005147',
    name: 'Varian Material',
    group: 'stok',
    subtitle: 'Saldo stok per valuation type, fisik unit, yantek, yanbung, retur & minimum',
    primaryQuantityHeader: /^stock\s*siap$/i,
  },
  {
    gid: '1192678235',
    name: 'STOK (referensi)',
    group: 'stok',
    subtitle: 'Perbandingan Stock Awal AGO, Masuk, Keluar, Siap Pakai & Selisih',
    primaryQuantityHeader: /^stock\s*siap\s*pakai$/i,
  },
  {
    gid: '1600935918',
    name: 'MATERIAL MASUK',
    group: 'mutasi',
    subtitle: 'Riwayat penerimaan material masuk beserta petugas penerima & keterangan',
    forwardFillFirstColDate: true,
    primaryQuantityHeader: /^jumlah\s*material\s*masuk$/i,
  },
  {
    gid: '478419117',
    name: 'MATERIAL KELUAR',
    group: 'mutasi',
    subtitle: 'Riwayat pengeluaran material keluar, pekerjaan, serial number & pelanggan',
    forwardFillFirstColDate: true,
    primaryQuantityHeader: /^jumlah\s*material\s*keluar$/i,
  },
  {
    gid: '669234199',
    name: 'Sheet5',
    group: 'meter',
    subtitle: 'Log distribusi nomor meter, petugas penerima, pekerjaan & serial number',
    customBlankHeaderLabels: {
      7: 'Ref Serial Meter',
      8: 'Status Lookup',
    },
  },
  {
    gid: '494934155',
    name: 'Sheet4',
    group: 'meter',
    subtitle: 'Daftar nomor serial meter terdaftar (kolom tunggal)',
    noHeaderRow: true,
    defaultHeaderLabels: ['No Meter / Serial Number'],
  },
  {
    gid: '1788063830',
    name: 'Sheet1 (1)',
    group: 'meter',
    subtitle: 'Daftar referensi Nama Harian material & aksesoris lapangan',
  },
  {
    gid: '38403061',
    name: 'Sheet1',
    group: 'lainnya',
    subtitle: 'Lembar kerja Sheet1 pada workbook',
  },
  {
    gid: '866567887',
    name: 'Sheet2',
    group: 'lainnya',
    subtitle: 'Lembar kerja Sheet2 pada workbook',
  },
  {
    gid: '945505458',
    name: 'Sheet3',
    group: 'lainnya',
    subtitle: 'Lembar kerja Sheet3 pada workbook',
  },
];

export function getWorkbookSheetCsvUrl(gid: string): string {
  return `${REKAP_WORKBOOK_PUB_URL}?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
}

const CODE_OR_DATE_HEADER_PATTERN =
  /^(no\.?|no\.?\s*material|nomor\s*material|no\.?\s*meter|serial(\s*number)?|ref\s*serial\s*meter|tanggal|tgl|nip|sku|kode|valuation\s*type)$/i;

const QUANTITY_HEADER_PATTERN =
  /(stock|stok|jumlah|masuk|keluar|selisih|retur|transit|reservasi|minimum|qty|total|saldo)/i;

export function parseWorkbookCsv(
  meta: WorkbookSheetMeta,
  csvText: string
): ParsedWorkbookSheet {
  const csvUrl = getWorkbookSheetCsvUrl(meta.gid);
  const fetchedAt = new Date();

  if (!csvText.trim()) {
    return {
      meta,
      csvUrl,
      headers: [],
      rows: [],
      numericColIndices: [],
      codeColIndices: [],
      primaryStatLabel: null,
      primaryStatValue: null,
      fetchedAt,
    };
  }

  const parsedRows = parseDelimitedText(csvText);
  if (parsedRows.length === 0) {
    return {
      meta,
      csvUrl,
      headers: [],
      rows: [],
      numericColIndices: [],
      codeColIndices: [],
      primaryStatLabel: null,
      primaryStatValue: null,
      fetchedAt,
    };
  }

  let rawHeaderRow: string[];
  let rawDataRows: string[][];

  if (meta.noHeaderRow) {
    const maxCols = parsedRows.reduce((m, r) => Math.max(m, r.length), 0);
    rawHeaderRow = Array.from({ length: maxCols }, (_, idx) => {
      return meta.defaultHeaderLabels?.[idx] || `Kolom ${idx + 1}`;
    });
    rawDataRows = parsedRows;
  } else {
    let headerIdx = 0;
    const scanLimit = Math.min(parsedRows.length, 6);
    for (let i = 0; i < scanLimit; i++) {
      const nonEmptyCells = parsedRows[i].filter((c) => c.trim().length > 0).length;
      if (nonEmptyCells >= 2 || (parsedRows[i].length === 1 && nonEmptyCells === 1)) {
        headerIdx = i;
        break;
      }
    }
    rawHeaderRow = [...(parsedRows[headerIdx] || [])];
    if (meta.forwardFillFirstColDate && !String(rawHeaderRow[0] || '').trim()) {
      rawHeaderRow[0] = 'Tanggal';
    }
    rawDataRows = parsedRows.slice(headerIdx + 1);
  }

  const maxColCount = Math.max(
    rawHeaderRow.length,
    ...rawDataRows.slice(0, 200).map((r) => r.length),
    ...rawDataRows.slice(-50).map((r) => r.length)
  );

  // Determine active columns (columns that have a non-empty header OR any non-empty cell)
  const activeColIndices: number[] = [];
  for (let c = 0; c < maxColCount; c++) {
    const headerHasText = String(rawHeaderRow[c] || '').trim().length > 0;
    if (headerHasText) {
      activeColIndices.push(c);
      continue;
    }
    const dataHasText = rawDataRows.some(
      (r) => String(r[c] || '').trim().length > 0
    );
    if (dataHasText) {
      activeColIndices.push(c);
    }
  }

  const headers = activeColIndices.map((origIdx, displayIdx) => {
    const label = String(rawHeaderRow[origIdx] || '').trim();
    if (label) return label;
    if (meta.forwardFillFirstColDate && origIdx === 0) return 'Tanggal';
    if (meta.customBlankHeaderLabels?.[origIdx]) {
      return meta.customBlankHeaderLabels[origIdx];
    }
    return `Kolom ${displayIdx + 1}`;
  });

  // Build normalized rows with forward-filled date on column 0 if applicable
  let lastDate = '';
  const rows: string[][] = [];

  for (const rawRow of rawDataRows) {
    const projected = activeColIndices.map((origIdx) =>
      String(rawRow[origIdx] ?? '').trim()
    );

    const hasAnyValue = projected.some((cell) => cell.length > 0);
    if (!hasAnyValue) continue;

    if (meta.forwardFillFirstColDate && projected.length > 0) {
      if (projected[0]) {
        lastDate = projected[0];
      } else if (lastDate) {
        projected[0] = lastDate;
      }
    }

    rows.push(projected);
  }

  // Classify quantity numeric columns vs monospace code/ID/serial columns
  const numericColIndices: number[] = [];
  const codeColIndices: number[] = [];

  headers.forEach((header, idx) => {
    const h = header.trim();
    if (CODE_OR_DATE_HEADER_PATTERN.test(h) || /no\.?\s*meter|serial/i.test(h)) {
      codeColIndices.push(idx);
      return;
    }

    if (QUANTITY_HEADER_PATTERN.test(h)) {
      numericColIndices.push(idx);
      return;
    }

    // Fallback check against sample rows
    const sample = rows
      .slice(0, 30)
      .map((r) => r[idx])
      .filter((v) => v && v.length > 0);
    if (
      sample.length > 0 &&
      sample.every((v) => /^-?\d[\d.,]*$/.test(v)) &&
      sample.every((v) => v.replace(/[^\d]/g, '').length <= 6)
    ) {
      numericColIndices.push(idx);
    }
  });

  // Compute primary quantity KPI if applicable
  let primaryStatLabel: string | null = null;
  let primaryStatValue: number | null = null;

  if (meta.primaryQuantityHeader) {
    const targetIdx = headers.findIndex((h) =>
      meta.primaryQuantityHeader!.test(h.trim())
    );
    if (targetIdx !== -1) {
      primaryStatLabel = `Total ${headers[targetIdx]}`;
      let total = 0;
      for (const r of rows) {
        total += parseSignedNumericCell(r[targetIdx]);
      }
      primaryStatValue = Math.round(total * 100) / 100;
    }
  }

  return {
    meta,
    csvUrl,
    headers,
    rows,
    numericColIndices,
    codeColIndices,
    primaryStatLabel,
    primaryStatValue,
    fetchedAt,
  };
}

export async function fetchWorkbookSheet(
  meta: WorkbookSheetMeta
): Promise<ParsedWorkbookSheet> {
  const url = getWorkbookSheetCsvUrl(meta.gid);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(
      `Gagal mengunduh sheet "${meta.name}" (gid=${meta.gid}, HTTP ${res.status}).`
    );
  }
  const text = await res.text();
  return parseWorkbookCsv(meta, text);
}

export function exportWorkbookSheetToCSV(
  sheet: ParsedWorkbookSheet,
  filteredRows: string[][]
): void {
  const escapeCsv = (val: string) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    sheet.headers.map(escapeCsv).join(','),
    ...filteredRows.map((row) =>
      sheet.headers.map((_, idx) => escapeCsv(row[idx] ?? '')).join(',')
    ),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const slug = sheet.meta.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  anchor.href = url;
  anchor.download = `${slug || 'sheet'}-gid-${sheet.meta.gid}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
