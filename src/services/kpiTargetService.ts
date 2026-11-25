import { parseDelimitedText } from './sheetsService';

export const KPI_SPREADSHEET_ID = '11YqAwNjEJiITbtL-KPXOZV5ygdVhT14cbdtwUQb0SB8';

export const KPI_SPREADSHEET_EDIT_URL =
  'https://docs.google.com/spreadsheets/d/11YqAwNjEJiITbtL-KPXOZV5ygdVhT14cbdtwUQb0SB8/edit?gid=0#gid=0';

export type KpiTabId = 'pelanggan-mva' | 'bp' | 'saldo' | 'sheet4';

export interface KpiTabMeta {
  id: KpiTabId;
  gid: string;
  name: string;
  subtitle: string;
}

export const KPI_TABS: KpiTabMeta[] = [
  {
    id: 'pelanggan-mva',
    gid: '0',
    name: 'Delta Pelanggan & Delta MVA',
    subtitle: 'Penambahan Pelanggan (Bobot 4), Daya Tersambung MVA (Bobot 4), Potensi PB & Prognosa',
  },
  {
    id: 'bp',
    gid: '1864590170',
    name: 'Biaya Penyambungan (BP)',
    subtitle: 'Pendapatan Biaya Penyambungan dalam Rp Miliar (Bobot 2)',
  },
  {
    id: 'saldo',
    gid: '2066054738',
    name: 'Saldo Akhir Bulan',
    subtitle: 'Saldo Rata-Rata Akhir Bulan (Rp Juta) & Skenario Prognosa',
  },
  {
    id: 'sheet4',
    gid: '1120348723',
    name: 'Sheet4 (Ringkasan Angka)',
    subtitle: 'Data ringkasan saldo bulanan, kumulatif & persentase pencapaian',
  },
];

export function getKpiTabCsvUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${KPI_SPREADSHEET_ID}/export?format=csv&gid=${encodeURIComponent(
    gid
  )}`;
}

const MONTH_SET = new Set([
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]);

/**
 * Parses Indonesian KPI numbers accurately:
 * - "1.010", "1.588" -> 1010, 1588 (dot as thousands separator)
 * - "0,235", "54,99226", "2,578", "-0,015" -> 0.235, 54.99226, 2.578, -0.015 (comma ALWAYS decimal)
 * - "132,71%" -> 132.71
 * - "-" or "" -> null
 */
export function parseKpiNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') return null;

  let cleaned = trimmed.replace(/rp\.?/gi, '').replace(/%/g, '').replace(/\s+/g, '');
  if (!cleaned || cleaned === '-') return null;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    const intPart = parts[0].replace('-', '');
    if (
      parts.length > 2 ||
      (parts[1] && parts[1].length === 3 && intPart.length >= 1 && intPart.length <= 3)
    ) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface PelangganRow {
  bulan: string;
  isPrognosa: boolean;
  targetKumulatif: number | null;
  targetBulanan: number | null;
  realisasiBulanan: number | null;
  realisasiMutasiN: number | null;
  realisasiKumulatif: number | null;
  persentasePencapaian: number | null;
  target110Kumulatif: number | null;
  selisihTarget100: number | null;
  selisihTarget110: number | null;
}

export interface PotensiPbItem {
  kategori: string;
  jumlah: number;
}

export interface DayaMvaRow {
  bulan: string;
  targetKumulatif: number | null;
  realisasiDayaTersambung: number | null;
  realisasiBulananMva: number | null;
  realisasiPenambahanKumulatif: number | null;
  persentasePencapaian: number | null;
  target110Kumulatif: number | null;
  selisihTarget100: number | null;
  selisihTarget110: number | null;
}

export interface BpRow {
  bulan: string;
  targetKumulatif: number | null;
  targetBulanan: number | null;
  realisasiBulanan: number | null;
  realisasiKumulatif: number | null;
  persentasePencapaian: number | null;
  target110Kumulatif: number | null;
  selisihTarget100: number | null;
  selisihTarget110: number | null;
}

export interface SaldoRow {
  bulan: string;
  isPrognosa: boolean;
  targetKumulatif: number | null;
  targetBulanan: number | null;
  realisasiBulanan: number | null;
  realisasiKumulatif: number | null;
  persentasePencapaian: number | null;
  catatan: string;
}

export interface KpiWorkbookData {
  fetchedAt: Date;
  pelanggan: {
    title: string;
    updatedAt: string;
    aktualRows: PelangganRow[];
    prognosaRows: PelangganRow[];
    potensiPb: PotensiPbItem[];
    potensiPbTotal: number;
    targetHarian: number | null;
    targetHarianSatuan: string;
  };
  mva: {
    title: string;
    updatedAt: string;
    baselineLabel: string;
    baselineValue: number | null;
    rows: DayaMvaRow[];
  };
  bp: {
    title: string;
    updatedAt: string;
    rows: BpRow[];
  };
  saldo: {
    title: string;
    updatedAt: string;
    aktualRows: SaldoRow[];
    prognosaRows: SaldoRow[];
  };
  sheet4Rows: string[][];
}

function parsePelangganRow(row: string[], startCol = 1, isPrognosa = false): PelangganRow {
  return {
    bulan: (row[startCol] || '').trim().toUpperCase(),
    isPrognosa,
    targetKumulatif: parseKpiNumber(row[startCol + 1]),
    targetBulanan: parseKpiNumber(row[startCol + 2]),
    realisasiBulanan: parseKpiNumber(row[startCol + 3]),
    realisasiMutasiN: parseKpiNumber(row[startCol + 4]),
    realisasiKumulatif: parseKpiNumber(row[startCol + 5]),
    persentasePencapaian: parseKpiNumber(row[startCol + 6]),
    target110Kumulatif: parseKpiNumber(row[startCol + 7]),
    selisihTarget100: parseKpiNumber(row[startCol + 8]),
    selisihTarget110: parseKpiNumber(row[startCol + 9]),
  };
}

function parseGid0(rows: string[][]): Pick<KpiWorkbookData, 'pelanggan' | 'mva'> {
  let pelangganTitle = 'JUMLAH PENAMBAHAN PELANGGAN (PELANGGAN) (BOBOT 4)';
  let mvaTitle = 'JUMLAH PENAMBAHAN DAYA TERSAMBUNG (MVA) (BOBOT 4)';
  let pelangganUpdated = '13 November 2026';
  let mvaUpdated = '13 November 2026';

  const aktualRows: PelangganRow[] = [];
  const prognosaRows: PelangganRow[] = [];
  const potensiPb: PotensiPbItem[] = [];
  let potensiPbTotal = 0;
  let targetHarian: number | null = null;
  let targetHarianSatuan = 'pelanggan / hari';

  let baselineLabel = 'DEC 25';
  let baselineValue: number | null = null;
  const mvaRows: DayaMvaRow[] = [];

  let sectionMode: 'top' | 'potensi' | 'prognosa' = 'top';

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const joined = row.join(' ').toUpperCase();

    if ((row[1] || '').toUpperCase().includes('PROGNOSA JUMLAH PENAMBAHAN PELANGGAN')) {
      sectionMode = 'prognosa';
      continue;
    }

    if (joined.includes('JUMLAH PENAMBAHAN PELANGGAN')) {
      const t = row.find((c) => c.toUpperCase().includes('JUMLAH PENAMBAHAN PELANGGAN'));
      if (t) pelangganTitle = t.trim();
      const tMva = row.find((c) => c.toUpperCase().includes('DAYA TERSAMBUNG'));
      if (tMva) mvaTitle = tMva.trim();
      continue;
    }

    if (joined.includes('UPDATED:')) {
      const updatedCols: number[] = [];
      row.forEach((cell, idx) => {
        if (cell.trim().toLowerCase() === 'updated:') updatedCols.push(idx);
      });
      if (updatedCols[0] !== undefined && row[updatedCols[0] + 1]) {
        pelangganUpdated = row[updatedCols[0] + 1].trim();
      }
      if (updatedCols[1] !== undefined && row[updatedCols[1] + 1]) {
        mvaUpdated = row[updatedCols[1] + 1].trim();
      }
      continue;
    }

    if ((row[1] || '').trim().toLowerCase().startsWith('potensi pb')) {
      sectionMode = 'potensi';
      continue;
    }

    // Target harian row
    const thIdx = row.findIndex((c) => c.toUpperCase().includes('TARGET HARIAN'));
    if (thIdx !== -1) {
      targetHarian = parseKpiNumber(row[thIdx + 1]);
      if (row[thIdx + 2]) targetHarianSatuan = row[thIdx + 2].trim();
      continue;
    }

    // Left table: Pelanggan Aktual or Prognosa
    const leftMonth = (row[1] || '').trim().toUpperCase();
    if (MONTH_SET.has(leftMonth)) {
      const isProgRow = (row[0] || '').trim().toUpperCase() === 'PROGNOSA';
      const parsed = parsePelangganRow(row, 1, isProgRow);
      if (sectionMode === 'prognosa') {
        prognosaRows.push(parsed);
      } else {
        aktualRows.push(parsed);
      }
    } else if (sectionMode === 'potensi') {
      const cat = (row[1] || '').trim();
      const val = parseKpiNumber(row[2]);
      if (cat && val !== null) {
        potensiPb.push({ kategori: cat, jumlah: val });
      } else if (!cat && val !== null && val > 0) {
        potensiPbTotal = val;
      }
    }

    // Right table (col 13..21): Daya Tersambung MVA
    const mvaPeriod = (row[13] || '').trim().toUpperCase();
    if (mvaPeriod === 'DEC 25') {
      baselineLabel = 'DEC 25';
      baselineValue = parseKpiNumber(row[15]);
    } else if (MONTH_SET.has(mvaPeriod)) {
      mvaRows.push({
        bulan: mvaPeriod,
        targetKumulatif: parseKpiNumber(row[14]),
        realisasiDayaTersambung: parseKpiNumber(row[15]),
        realisasiBulananMva: parseKpiNumber(row[16]),
        realisasiPenambahanKumulatif: parseKpiNumber(row[17]),
        persentasePencapaian: parseKpiNumber(row[18]),
        target110Kumulatif: parseKpiNumber(row[19]),
        selisihTarget100: parseKpiNumber(row[20]),
        selisihTarget110: parseKpiNumber(row[21]),
      });
    }
  }

  if (potensiPbTotal === 0 && potensiPb.length > 0) {
    potensiPbTotal = potensiPb.reduce((s, x) => s + x.jumlah, 0);
  }

  return {
    pelanggan: {
      title: pelangganTitle,
      updatedAt: pelangganUpdated,
      aktualRows,
      prognosaRows,
      potensiPb,
      potensiPbTotal,
      targetHarian,
      targetHarianSatuan,
    },
    mva: {
      title: mvaTitle,
      updatedAt: mvaUpdated,
      baselineLabel,
      baselineValue,
      rows: mvaRows,
    },
  };
}

function parseBpTab(rows: string[][]): KpiWorkbookData['bp'] {
  let title = 'PENDAPATAN BIAYA PENYAMBUNGAN (RP MILIAR) (BOBOT 2)';
  let updatedAt = '12 Oktober 2026';
  const bpRows: BpRow[] = [];

  for (const row of rows) {
    const joined = row.join(' ').toUpperCase();
    if (joined.includes('BIAYA PENYAMBUNGAN')) {
      const t = row.find((c) => c.toUpperCase().includes('BIAYA PENYAMBUNGAN'));
      if (t) title = t.trim();
      continue;
    }
    const updIdx = row.findIndex((c) => c.trim().toLowerCase() === 'updated:');
    if (updIdx !== -1 && row[updIdx + 1]) {
      updatedAt = row[updIdx + 1].trim();
      continue;
    }

    const bulan = (row[1] || '').trim().toUpperCase();
    if (MONTH_SET.has(bulan)) {
      bpRows.push({
        bulan,
        targetKumulatif: parseKpiNumber(row[2]),
        targetBulanan: parseKpiNumber(row[3]),
        realisasiBulanan: parseKpiNumber(row[4]),
        realisasiKumulatif: parseKpiNumber(row[5]),
        persentasePencapaian: parseKpiNumber(row[6]),
        target110Kumulatif: parseKpiNumber(row[7]),
        selisihTarget100: parseKpiNumber(row[8]),
        selisihTarget110: parseKpiNumber(row[9]),
      });
    }
  }

  return { title, updatedAt, rows: bpRows };
}

function parseSaldoTab(rows: string[][]): KpiWorkbookData['saldo'] {
  let title = 'SALDO RATA-RATA AKHIR BULAN';
  let updatedAt = '13 November 2026';
  const aktualRows: SaldoRow[] = [];
  const prognosaRows: SaldoRow[] = [];

  let inPrognosaBlock = false;

  for (const row of rows) {
    const joined = row.join(' ').toUpperCase();
    if (joined.includes('PROGNOSA SALDO RATA-RATA')) {
      inPrognosaBlock = true;
      continue;
    }
    if (joined.includes('SALDO RATA-RATA AKHIR BULAN')) {
      const t = row.find((c) => c.toUpperCase().includes('SALDO RATA-RATA'));
      if (t) title = t.trim();
      continue;
    }
    const updIdx = row.findIndex((c) => c.trim().toLowerCase() === 'updated:');
    if (updIdx !== -1 && row[updIdx + 1]) {
      updatedAt = row[updIdx + 1].trim();
      continue;
    }

    const bulan = (row[1] || '').trim().toUpperCase();
    if (MONTH_SET.has(bulan)) {
      const parsed: SaldoRow = {
        bulan,
        isPrognosa: (row[0] || '').trim().toUpperCase() === 'PROGNOSA',
        targetKumulatif: parseKpiNumber(row[2]),
        targetBulanan: parseKpiNumber(row[3]),
        realisasiBulanan: parseKpiNumber(row[4]),
        realisasiKumulatif: parseKpiNumber(row[5]),
        persentasePencapaian: parseKpiNumber(row[6]),
        catatan: (row[10] || '').trim(),
      };
      if (inPrognosaBlock) {
        prognosaRows.push(parsed);
      } else {
        aktualRows.push(parsed);
      }
    }
  }

  return { title, updatedAt, aktualRows, prognosaRows };
}

export async function fetchKpiWorkbookData(): Promise<KpiWorkbookData> {
  const [res0, resBp, resSaldo, resSheet4] = await Promise.all([
    fetch(getKpiTabCsvUrl('0'), { cache: 'no-store' }),
    fetch(getKpiTabCsvUrl('1864590170'), { cache: 'no-store' }),
    fetch(getKpiTabCsvUrl('2066054738'), { cache: 'no-store' }),
    fetch(getKpiTabCsvUrl('1120348723'), { cache: 'no-store' }),
  ]);

  if (!res0.ok) {
    throw new Error(
      `Gagal mengunduh spreadsheet KPI (HTTP ${res0.status}). Pastikan akses publik CSV aktif.`
    );
  }

  const [txt0, txtBp, txtSaldo, txtSheet4] = await Promise.all([
    res0.text(),
    resBp.ok ? resBp.text() : Promise.resolve(''),
    resSaldo.ok ? resSaldo.text() : Promise.resolve(''),
    resSheet4.ok ? resSheet4.text() : Promise.resolve(''),
  ]);

  const rows0 = parseDelimitedTextPreservingEmpty(txt0);
  const rowsBp = txtBp ? parseDelimitedTextPreservingEmpty(txtBp) : [];
  const rowsSaldo = txtSaldo ? parseDelimitedTextPreservingEmpty(txtSaldo) : [];
  const rowsSheet4 = txtSheet4 ? parseDelimitedText(txtSheet4) : [];

  const { pelanggan, mva } = parseGid0(rows0);
  const bp = parseBpTab(rowsBp);
  const saldo = parseSaldoTab(rowsSaldo);

  return {
    fetchedAt: new Date(),
    pelanggan,
    mva,
    bp,
    saldo,
    sheet4Rows: rowsSheet4,
  };
}

/**
 * Preserves blank rows/leading empty columns so exact column coordinates (col 1 vs col 13) remain intact.
 */
function parseDelimitedTextPreservingEmpty(text: string): string[][] {
  const rows: string[][] = [];
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
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

export function exportKpiRowsToCSV(
  filenamePrefix: string,
  headers: string[],
  rows: Array<Array<string | number | null>>
) {
  const escape = (val: string | number | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
