import {
  DivisionBreakdown,
  FIELD_LIMITS,
  MATERIAL_CATEGORIES,
  MaterialCategory,
} from '../types/inventory';
import { MaterialFormInput } from './inventoryService';

export const PUBLISHED_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQyhc3GJMo8yzDtUPFnQrWlzb7SOCBZFAys7bR25OeONW8VhUZvr5D2zNu90hboAg/pub?output=csv';

export const CONFIGURED_SPREADSHEET_ID = '1Nd_V6zvnVZ-JHBXwD1px4LcP5ltJJ5fd';

export interface SheetPreset {
  id: string;
  label: string;
  mode: 'csv' | 'oauth';
  gid?: number;
  url: string;
}

export const SHEET_PRESETS: SheetPreset[] = [
  {
    id: 'published-sinjai-csv',
    label: 'Gd Ry Sinjai (CSV Live)',
    mode: 'csv',
    url: PUBLISHED_SHEET_CSV_URL,
  },
  {
    id: 'sheet1-418796009',
    label: 'Sheet1 (OAuth gid: 418796009)',
    mode: 'oauth',
    gid: 418796009,
    url: 'https://docs.google.com/spreadsheets/d/1Nd_V6zvnVZ-JHBXwD1px4LcP5ltJJ5fd/edit?gid=418796009#gid=418796009',
  },
  {
    id: 'tab-517228494',
    label: 'Tab Utama (OAuth gid: 517228494)',
    mode: 'oauth',
    gid: 517228494,
    url: 'https://docs.google.com/spreadsheets/d/1Nd_V6zvnVZ-JHBXwD1px4LcP5ltJJ5fd/edit?gid=517228494#gid=517228494',
  },
  {
    id: 'kpi-pelanggan-mva-csv',
    label: 'KPI Pelanggan & Daya MVA (CSV Live gid: 0)',
    mode: 'csv',
    gid: 0,
    url: 'https://docs.google.com/spreadsheets/d/11YqAwNjEJiITbtL-KPXOZV5ygdVhT14cbdtwUQb0SB8/export?format=csv&gid=0',
  },
];

export const DEFAULT_SPREADSHEET_URL = PUBLISHED_SHEET_CSV_URL;

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: SheetTabInfo[];
}

export interface ColumnMapping {
  rowNumCol: number;
  zoneCol: number;
  skuCol: number;
  nameCol: number;
  unitCol: number;
  categoryCol: number;
  awalDistCol: number;
  awalAgaCol: number;
  awalTeCol: number;
  awalTotalCol: number;
  masukDistCol: number;
  masukAgaCol: number;
  masukTeCol: number;
  masukTotalCol: number;
  keluarDistCol: number;
  keluarAgaCol: number;
  keluarTeCol: number;
  keluarTotalCol: number;
  akhirDistCol: number;
  akhirAgaCol: number;
  akhirTeCol: number;
  akhirTotalCol: number;
  notesCol: number;
  minCol: number;
  critCol: number;
  maxCol: number;
  priceCol: number;
  supplierCol: number;
}

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

export async function fetchPublishedCsvValues(url: string): Promise<string[][]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Gagal mengunduh CSV spreadsheet (HTTP ${res.status}).`);
  }
  const text = await res.text();
  const rows = parseDelimitedText(text);
  if (rows.length < 2) {
    throw new Error('Isi spreadsheet CSV kosong atau tidak memiliki data tabel.');
  }
  return rows;
}

export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=properties.title,sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `HTTP ${res.status}`;

    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    if (res.status === 403) {
      throw new Error(
        'Akses ditolak (403). Pastikan akun Google Anda memiliki izin lihat pada spreadsheet ini dan izin Google Sheets telah diberikan.'
      );
    }
    if (res.status === 404) {
      throw new Error(
        'Spreadsheet tidak ditemukan (404). Periksa kembali ID atau link Google Sheets Anda.'
      );
    }
    if (
      msg.toLowerCase().includes('not supported for this document') ||
      res.status === 400
    ) {
      throw new Error(
        'File ini kemungkinan masih berformat Excel (.xlsx) di Google Drive. Gunakan link publikasi CSV atau pilih "File → Simpan sebagai Google Spreadsheet" (Save as Google Sheets).'
      );
    }
    throw new Error(`Gagal memuat metadata spreadsheet: ${msg}`);
  }

  const data = await res.json();
  const sheets: SheetTabInfo[] = Array.isArray(data.sheets)
    ? data.sheets.map(
        (s: {
          properties?: {
            sheetId?: number;
            title?: string;
            gridProperties?: { rowCount?: number; columnCount?: number };
          };
        }) => ({
          sheetId: s.properties?.sheetId ?? 0,
          title: s.properties?.title ?? 'Sheet1',
          rowCount: s.properties?.gridProperties?.rowCount,
          columnCount: s.properties?.gridProperties?.columnCount,
        })
      )
    : [];

  return {
    spreadsheetId,
    title: data?.properties?.title || 'Spreadsheet Material',
    sheets,
  };
}

export async function fetchSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<string[][]> {
  const escapedTitle = `'${sheetTitle.replace(/'/g, "''")}'`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(escapedTitle)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Gagal membaca isi tab "${sheetTitle}": ${body?.error?.message || `HTTP ${res.status}`}`
    );
  }

  const data = await res.json();
  return Array.isArray(data.values) ? data.values : [];
}

const HEADER_KEYWORDS = [
  'no',
  'gudang',
  'no material',
  'nama material',
  'satuan',
  'stok awal',
  'material masuk',
  'material keluar',
  'stok akhir',
  'keterangan',
  'nama',
  'material',
  'barang',
  'uraian',
  'item',
  'sku',
  'kode',
  'normalisasi',
  'stok',
  'saldo',
  'sisa',
  'qty',
  'jumlah',
  'unit',
];

const SUBHEADER_TOKENS = new Set(['dist', 'aga', 'te', 'total']);

export function detectHeaderAndRows(values: string[][]): {
  headerRowIndex: number;
  headers: string[];
  rawRows: string[][];
} {
  if (values.length === 0) {
    return { headerRowIndex: 0, headers: [], rawRows: [] };
  }

  let bestRowIdx = 0;
  let bestScore = -1;

  const limit = Math.min(values.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = values[i] || [];
    const nonEmpty = row.filter((c) => String(c || '').trim().length > 0);
    if (nonEmpty.length < 2) continue;

    let score = 0;
    for (const cell of nonEmpty) {
      const lower = String(cell).toLowerCase().trim();
      if (HEADER_KEYWORDS.some((kw) => lower === kw || lower.includes(kw))) {
        score += 3;
      } else if (/^[a-zA-Z\s/()._-]+$/.test(lower)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIdx = i;
    }
  }

  const rawHeaderRow = values[bestRowIdx] || [];
  const nextRow = values[bestRowIdx + 1] || [];
  const hasMergedSubheader = nextRow.some((cell) =>
    SUBHEADER_TOKENS.has(String(cell || '').trim().toLowerCase())
  );

  const maxCols = Math.max(
    rawHeaderRow.length,
    hasMergedSubheader ? nextRow.length : 0,
    ...values.slice(bestRowIdx + 1, bestRowIdx + 20).map((r) => r.length),
    0
  );

  const headers: string[] = [];
  let activeParentHeader = '';

  for (let c = 0; c < maxCols; c++) {
    const topLabel = String(rawHeaderRow[c] || '').trim();
    const subLabel = hasMergedSubheader ? String(nextRow[c] || '').trim() : '';

    if (topLabel) {
      activeParentHeader = topLabel;
    }

    if (hasMergedSubheader && subLabel) {
      const parent = activeParentHeader || `Kolom ${c + 1}`;
      headers.push(`${parent} ${subLabel}`.trim());
    } else {
      headers.push(topLabel || `Kolom ${c + 1}`);
    }
  }

  const dataStartIndex = hasMergedSubheader ? bestRowIdx + 2 : bestRowIdx + 1;
  const rawRows = values
    .slice(dataStartIndex)
    .filter((r) => r.some((cell) => String(cell || '').trim().length > 0));

  return { headerRowIndex: bestRowIdx, headers, rawRows };
}

function findColumnIndex(
  headers: string[],
  patterns: RegExp[],
  excludeIndices: number[] = []
): number {
  for (const regex of patterns) {
    const idx = headers.findIndex(
      (h, i) => !excludeIndices.includes(i) && regex.test(h.toLowerCase().trim())
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const used: number[] = [];

  const rowNumCol = findColumnIndex(headers, [/^no\.?$/], used);
  if (rowNumCol !== -1) used.push(rowNumCol);

  const zoneCol = findColumnIndex(
    headers,
    [/^(gudang|lokasi|zona|warehouse)$/, /(gudang|lokasi|zona|rak|penyimpanan)/],
    used
  );
  if (zoneCol !== -1) used.push(zoneCol);

  const skuCol = findColumnIndex(
    headers,
    [
      /^(no\.?\s*material|kode\s*material|sku|kode|normalisasi)$/,
      /(no\.?\s*material|kode\s*(barang|material)|sku|normalisasi)/,
    ],
    used
  );
  if (skuCol !== -1) used.push(skuCol);

  const nameCol = findColumnIndex(
    headers,
    [
      /^(nama\s*material|nama\s*barang|material|uraian)$/,
      /(nama\s*(material|barang|item)|uraian|deskripsi|spesifikasi)/,
      /(material|barang|item)/,
    ],
    used
  );
  if (nameCol !== -1) used.push(nameCol);

  const unitCol = findColumnIndex(
    headers,
    [/^(satuan|sat|unit|uom)$/, /(satuan|unit)/],
    used
  );
  if (unitCol !== -1) used.push(unitCol);

  // STOK AWAL breakdown
  const awalDistCol = findColumnIndex(headers, [/stok\s*awal.*dist/], used);
  if (awalDistCol !== -1) used.push(awalDistCol);
  const awalAgaCol = findColumnIndex(headers, [/stok\s*awal.*aga/], used);
  if (awalAgaCol !== -1) used.push(awalAgaCol);
  const awalTeCol = findColumnIndex(headers, [/stok\s*awal.*\bte\b/], used);
  if (awalTeCol !== -1) used.push(awalTeCol);
  const awalTotalCol = findColumnIndex(
    headers,
    [/stok\s*awal.*total/, /^(stok\s*awal|saldo\s*awal)$/],
    used
  );
  if (awalTotalCol !== -1) used.push(awalTotalCol);

  // MATERIAL MASUK breakdown
  const masukDistCol = findColumnIndex(headers, [/(material\s*)?masuk.*dist/], used);
  if (masukDistCol !== -1) used.push(masukDistCol);
  const masukAgaCol = findColumnIndex(headers, [/(material\s*)?masuk.*aga/], used);
  if (masukAgaCol !== -1) used.push(masukAgaCol);
  const masukTeCol = findColumnIndex(headers, [/(material\s*)?masuk.*\bte\b/], used);
  if (masukTeCol !== -1) used.push(masukTeCol);
  const masukTotalCol = findColumnIndex(
    headers,
    [/(material\s*)?masuk.*total/, /^(material\s*masuk|masuk|terima)$/],
    used
  );
  if (masukTotalCol !== -1) used.push(masukTotalCol);

  // MATERIAL KELUAR breakdown
  const keluarDistCol = findColumnIndex(headers, [/(material\s*)?keluar.*dist/], used);
  if (keluarDistCol !== -1) used.push(keluarDistCol);
  const keluarAgaCol = findColumnIndex(headers, [/(material\s*)?keluar.*aga/], used);
  if (keluarAgaCol !== -1) used.push(keluarAgaCol);
  const keluarTeCol = findColumnIndex(headers, [/(material\s*)?keluar.*\bte\b/], used);
  if (keluarTeCol !== -1) used.push(keluarTeCol);
  const keluarTotalCol = findColumnIndex(
    headers,
    [/(material\s*)?keluar.*total/, /^(material\s*keluar|keluar|pakai)$/],
    used
  );
  if (keluarTotalCol !== -1) used.push(keluarTotalCol);

  // STOK AKHIR breakdown
  const akhirDistCol = findColumnIndex(headers, [/stok\s*akhir.*dist/], used);
  if (akhirDistCol !== -1) used.push(akhirDistCol);
  const akhirAgaCol = findColumnIndex(headers, [/stok\s*akhir.*aga/], used);
  if (akhirAgaCol !== -1) used.push(akhirAgaCol);
  const akhirTeCol = findColumnIndex(headers, [/stok\s*akhir.*\bte\b/], used);
  if (akhirTeCol !== -1) used.push(akhirTeCol);
  const akhirTotalCol = findColumnIndex(
    headers,
    [
      /stok\s*akhir.*total/,
      /^(stok\s*akhir|saldo\s*akhir|sisa\s*stok|stok|stock|saldo|qty|jumlah|ready)$/,
      /(stok\s*(akhir|sekarang|tersedia|saat\s*ini)|sisa|saldo|qty|jumlah)/,
    ],
    used
  );
  if (akhirTotalCol !== -1) used.push(akhirTotalCol);

  const notesCol = findColumnIndex(
    headers,
    [/^(keterangan|catatan|notes|ket)$/, /(keterangan|catatan)/],
    used
  );
  if (notesCol !== -1) used.push(notesCol);

  const minCol = findColumnIndex(
    headers,
    [/(batas\s*min|min\s*stok|minimum|safety\s*stock)/, /^min$/],
    used
  );
  if (minCol !== -1) used.push(minCol);

  const critCol = findColumnIndex(headers, [/(batas\s*kritis|kritis|critical)/], used);
  if (critCol !== -1) used.push(critCol);

  const maxCol = findColumnIndex(
    headers,
    [/(kapasitas|max\s*stok|maksimum|maximum)/, /^max$/],
    used
  );
  if (maxCol !== -1) used.push(maxCol);

  const priceCol = findColumnIndex(
    headers,
    [/(harga\s*satuan|unit\s*price|harga|price)/],
    used
  );
  if (priceCol !== -1) used.push(priceCol);

  const categoryCol = findColumnIndex(
    headers,
    [/(kategori|category|kelompok)/],
    used
  );
  if (categoryCol !== -1) used.push(categoryCol);

  const supplierCol = findColumnIndex(
    headers,
    [/(pemasok|supplier|vendor|distributor)/],
    used
  );

  let resolvedNameCol = nameCol;
  if (resolvedNameCol === -1 && headers.length > 0) {
    resolvedNameCol = headers.findIndex((h) => !/^(no|no\.|#)$/i.test(h.trim()));
    if (resolvedNameCol === -1) resolvedNameCol = 0;
  }

  return {
    rowNumCol,
    zoneCol,
    skuCol,
    nameCol: resolvedNameCol,
    unitCol,
    categoryCol,
    awalDistCol,
    awalAgaCol,
    awalTeCol,
    awalTotalCol,
    masukDistCol,
    masukAgaCol,
    masukTeCol,
    masukTotalCol,
    keluarDistCol,
    keluarAgaCol,
    keluarTeCol,
    keluarTotalCol,
    akhirDistCol,
    akhirAgaCol,
    akhirTeCol,
    akhirTotalCol,
    notesCol,
    minCol,
    critCol,
    maxCol,
    priceCol,
    supplierCol,
  };
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
  return Math.max(-FIELD_LIMITS.maxStock, Math.min(FIELD_LIMITS.maxStock, num));
}

export function parseNumericCell(raw: string | undefined): number {
  return Math.max(0, parseSignedNumericCell(raw));
}

export function inferCategory(rawCategory: string, name: string): MaterialCategory {
  for (const cat of MATERIAL_CATEGORIES) {
    if (rawCategory.trim().toLowerCase() === cat.toLowerCase()) {
      return cat;
    }
  }

  const prefix = name.split(';')[0].trim().toUpperCase();
  const combined = `${rawCategory} ${prefix} ${name}`.toUpperCase();

  if (prefix === 'MTR' || prefix === 'MTR ACC' || /\b(KWH|METER|AMR|MODEM)\b/.test(combined)) {
    return 'kWh Meter & AMR';
  }
  if (
    prefix === 'MCB' ||
    prefix === 'FUSE' ||
    prefix === 'CUT OUT ACC' ||
    prefix === 'LA' ||
    /\b(MCB|MCCB|FUSE|CUT\s*OUT|ARRESTER|RELAY)\b/.test(combined)
  ) {
    return 'MCB, Fuse & Proteksi';
  }
  if (
    prefix.startsWith('CABLE') ||
    prefix.startsWith('COND') ||
    /\b(CABLE|KABEL|NFA2X|AAAC|CONDUCTOR|JOINT\s*SLEEVE|CABLE\s*SHOE|WEDGE\s*CLAMP)\b/.test(combined)
  ) {
    return 'Kabel & Konduktor';
  }
  if (
    prefix.startsWith('BOX') ||
    prefix === 'LVSB' ||
    prefix === 'PANEL ACC' ||
    prefix === 'CUB' ||
    /\b(BOX|LVSB|PANEL|CUBICLE|PHBTR)\b/.test(combined)
  ) {
    return 'Box, Panel & LVSB';
  }
  if (
    prefix === 'CONN' ||
    prefix === 'CLAMP' ||
    prefix === 'ISOLATOR' ||
    prefix === 'POLE ACC' ||
    prefix === 'CT' ||
    prefix === 'PT' ||
    prefix === 'TRF DIS' ||
    /\b(ISOLATOR|CONN|CLAMP|POLE|TIANG|TRAFO|TRF|CURRENT\s*TRANS|POTENTIAL\s*TRANS)\b/.test(combined)
  ) {
    return 'Tiang, Isolator & Konektor';
  }

  return 'Peralatan & Aksesoris';
}

function readBreakdown(
  row: string[],
  distIdx: number,
  agaIdx: number,
  teIdx: number,
  totalIdx: number,
  allowNegativeSub: boolean
): DivisionBreakdown {
  const parser = allowNegativeSub ? parseSignedNumericCell : parseNumericCell;
  const dist = distIdx >= 0 ? parser(row[distIdx]) : 0;
  const aga = agaIdx >= 0 ? parser(row[agaIdx]) : 0;
  const te = teIdx >= 0 ? parser(row[teIdx]) : 0;
  const hasExplicitTotal = totalIdx >= 0 && String(row[totalIdx] || '').trim() !== '';
  const total = hasExplicitTotal
    ? parseSignedNumericCell(row[totalIdx])
    : dist + aga + te;
  return { dist, aga, te, total };
}

export function mapSheetRowsToMaterials(
  rawRows: string[][],
  mapping: ColumnMapping,
  sheetTitle: string
): MaterialFormInput[] {
  const items: MaterialFormInput[] = [];
  const usedSkus = new Set<string>();

  const tabPrefix =
    sheetTitle
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4) || 'GS';

  rawRows.forEach((row, index) => {
    const rawName = mapping.nameCol >= 0 ? String(row[mapping.nameCol] || '').trim() : '';
    if (!rawName || rawName.length < 2) return;
    if (/^(total|jumlah|grand total|subtotal)$/i.test(rawName)) return;

    const rawRowNum =
      mapping.rowNumCol >= 0 ? parseNumericCell(row[mapping.rowNumCol]) : index + 1;
    const rowNumber = rawRowNum > 0 ? Math.round(rawRowNum) : index + 1;

    const rawSku = mapping.skuCol >= 0 ? String(row[mapping.skuCol] || '').trim() : '';
    let cleanSku = rawSku
      .replace(/[^a-zA-Z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, FIELD_LIMITS.skuMax);

    if (cleanSku.length < 2) {
      cleanSku = `MAT-${tabPrefix}-${String(rowNumber).padStart(4, '0')}`;
    }

    let uniqueSku = cleanSku;
    let suffix = 1;
    while (usedSkus.has(uniqueSku.toUpperCase())) {
      uniqueSku = `${cleanSku.slice(0, 27)}-${suffix++}`;
    }
    usedSkus.add(uniqueSku.toUpperCase());

    const stokAwal = readBreakdown(
      row,
      mapping.awalDistCol,
      mapping.awalAgaCol,
      mapping.awalTeCol,
      mapping.awalTotalCol,
      false
    );
    const materialMasuk = readBreakdown(
      row,
      mapping.masukDistCol,
      mapping.masukAgaCol,
      mapping.masukTeCol,
      mapping.masukTotalCol,
      false
    );
    const materialKeluar = readBreakdown(
      row,
      mapping.keluarDistCol,
      mapping.keluarAgaCol,
      mapping.keluarTeCol,
      mapping.keluarTotalCol,
      false
    );
    const stokAkhir = readBreakdown(
      row,
      mapping.akhirDistCol,
      mapping.akhirAgaCol,
      mapping.akhirTeCol,
      mapping.akhirTotalCol,
      true
    );

    const currentStock = Math.min(
      FIELD_LIMITS.maxStock,
      Math.max(0, stokAkhir.total)
    );

    const hasActivity =
      stokAwal.total !== 0 ||
      materialMasuk.total !== 0 ||
      materialKeluar.total !== 0 ||
      stokAkhir.total !== 0;

    const peak = Math.max(
      stokAwal.total,
      materialMasuk.total,
      materialKeluar.total,
      currentStock
    );

    let minThreshold = 0;
    let criticalThreshold = 0;

    if (mapping.minCol >= 0 && String(row[mapping.minCol] || '').trim() !== '') {
      minThreshold = Math.min(FIELD_LIMITS.maxStock, parseNumericCell(row[mapping.minCol]));
      criticalThreshold =
        mapping.critCol >= 0 && String(row[mapping.critCol] || '').trim() !== ''
          ? Math.min(minThreshold, parseNumericCell(row[mapping.critCol]))
          : Math.max(0, Math.round(minThreshold * 0.4));
    } else if (hasActivity) {
      if (materialKeluar.total > 0 || currentStock === 0) {
        minThreshold = Math.max(1, Math.round(peak * 0.25));
        criticalThreshold = Math.max(0, Math.round(minThreshold * 0.4));
      } else {
        // Active reserve item with no outflow yet stays safe unless stock drops
        minThreshold = currentStock > 4 ? Math.max(1, Math.floor(currentStock * 0.3)) : 0;
        criticalThreshold = Math.max(0, Math.floor(minThreshold * 0.5));
      }
    }

    const rawMax =
      mapping.maxCol >= 0 && String(row[mapping.maxCol] || '').trim() !== ''
        ? parseNumericCell(row[mapping.maxCol])
        : Math.max(peak * 1.25, minThreshold * 3, 100);
    const maxCapacity = Math.min(
      FIELD_LIMITS.maxStock,
      Math.max(1, currentStock, Math.round(rawMax))
    );

    const unitPrice =
      mapping.priceCol >= 0
        ? Math.min(FIELD_LIMITS.maxUnitPrice, parseNumericCell(row[mapping.priceCol]))
        : 0;

    const rawUnit = mapping.unitCol >= 0 ? String(row[mapping.unitCol] || '').trim() : '';
    const unit = (rawUnit || 'BH').slice(0, FIELD_LIMITS.unitMax);

    const rawCat =
      mapping.categoryCol >= 0 ? String(row[mapping.categoryCol] || '').trim() : '';
    const category = inferCategory(rawCat, rawName);

    const rawSupplier =
      mapping.supplierCol >= 0 ? String(row[mapping.supplierCol] || '').trim() : '';
    const supplierName = (
      rawSupplier.length >= 2 ? rawSupplier : 'Gudang Logistik PLN'
    ).slice(0, FIELD_LIMITS.supplierMax);

    const rawZone = mapping.zoneCol >= 0 ? String(row[mapping.zoneCol] || '').trim() : '';
    const warehouseZone = (rawZone || sheetTitle || 'Gd Ry Sinjai').slice(
      0,
      FIELD_LIMITS.zoneMax
    );

    const rawNotes = mapping.notesCol >= 0 ? String(row[mapping.notesCol] || '').trim() : '';
    const notes = rawNotes.slice(0, FIELD_LIMITS.notesMax);

    items.push({
      rowNumber,
      sku: uniqueSku,
      name: rawName.slice(0, FIELD_LIMITS.materialNameMax),
      category,
      unit,
      currentStock,
      stokAwal,
      materialMasuk,
      materialKeluar,
      stokAkhir,
      minThreshold,
      criticalThreshold,
      maxCapacity,
      unitPrice,
      supplierName,
      warehouseZone,
      notes,
    });
  });

  return items;
}

export async function fetchMaterialsFromPublishedCsv(
  url: string = PUBLISHED_SHEET_CSV_URL
): Promise<MaterialFormInput[]> {
  const values = await fetchPublishedCsvValues(url);
  const detected = detectHeaderAndRows(values);
  const mapping = autoMapColumns(detected.headers);
  return mapSheetRowsToMaterials(detected.rawRows, mapping, 'Gd Ry Sinjai');
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

export async function fetchCombinedSheetTabs(
  spreadsheetId: string,
  tabs: SheetTabInfo[],
  accessToken: string
): Promise<{
  materials: MaterialFormInput[];
  tabSummaries: Array<{ title: string; sheetId: number; count: number }>;
}> {
  const combined: MaterialFormInput[] = [];
  const usedSkus = new Set<string>();
  const tabSummaries: Array<{ title: string; sheetId: number; count: number }> = [];

  for (const tab of tabs) {
    const values = await fetchSheetValues(spreadsheetId, tab.title, accessToken);
    const detected = detectHeaderAndRows(values);
    if (detected.rawRows.length === 0) {
      tabSummaries.push({ title: tab.title, sheetId: tab.sheetId, count: 0 });
      continue;
    }
    const autoMap = autoMapColumns(detected.headers);
    const items = mapSheetRowsToMaterials(detected.rawRows, autoMap, tab.title);
    let addedForTab = 0;

    for (const item of items) {
      let uniqueSku = item.sku;
      let suffix = 1;
      while (usedSkus.has(uniqueSku.toUpperCase())) {
        uniqueSku = `${item.sku.slice(0, 27)}-${suffix++}`;
      }
      usedSkus.add(uniqueSku.toUpperCase());
      combined.push({ ...item, sku: uniqueSku });
      addedForTab++;
    }

    tabSummaries.push({
      title: tab.title,
      sheetId: tab.sheetId,
      count: addedForTab,
    });
  }

  return { materials: combined, tabSummaries };
}
