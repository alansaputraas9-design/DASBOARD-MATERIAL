import { fetchPublicGoogleSheetCsv } from './sheetsService';

export const WAREHOUSE_SPREADSHEET_ID = '1Wqq2Hlfa21ivgNH6My-1SxX338TYNbH7O9uuJ5f9AeA';

export const WAREHOUSE_SPREADSHEET_EDIT_URL =
  'https://docs.google.com/spreadsheets/d/1Wqq2Hlfa21ivgNH6My-1SxX338TYNbH7O9uuJ5f9AeA/edit?gid=410640151#gid=410640151';

export interface SheetMonthTab {
  id: string;
  gid: string;
  label: string;
  shortLabel: string;
  order: number;
}

export const WAREHOUSE_MONTH_TABS: SheetMonthTab[] = [
  { id: 'jan-2026', gid: '998488260', label: 'JAN 2026', shortLabel: 'JAN', order: 1 },
  { id: 'feb-2026', gid: '1511299888', label: 'FEB 2026', shortLabel: 'FEB', order: 2 },
  { id: 'mar-2026', gid: '1093923729', label: 'MAR 2026', shortLabel: 'MAR', order: 3 },
  { id: 'apr-2026', gid: '910582977', label: 'APR 2026', shortLabel: 'APR', order: 4 },
  { id: 'mei-2026', gid: '1420587398', label: 'MEI 2026', shortLabel: 'MEI', order: 5 },
  { id: 'juni-2026', gid: '1993054747', label: 'JUNI 2026', shortLabel: 'JUN', order: 6 },
  { id: 'juli-2026', gid: '570696065', label: 'JULI 2026', shortLabel: 'JUL', order: 7 },
  { id: 'agus-2026', gid: '588641371', label: 'AGUS 2026', shortLabel: 'AGU', order: 8 },
  { id: 'sept-2026', gid: '1740620273', label: 'SEPT 2026', shortLabel: 'SEP', order: 9 },
  { id: 'okt-2026', gid: '410640151', label: 'OKT 2026', shortLabel: 'OKT', order: 10 },
  { id: 'nov-2026', gid: '2039754835', label: 'NOV 2026', shortLabel: 'NOV', order: 11 },
];

export type MaterialGroup = 'APP' | 'HAR' | 'LAINNYA';
export type MovementClass = 'Fast Moving' | 'Slow Moving' | 'Non-Moving';

export interface DailyFlowPoint {
  day: number;
  masuk: number;
  keluar: number;
}

export interface WarehouseMaterialItem {
  id: string;
  no: number;
  kode: string;
  nama: string;
  satuan: string;
  group: MaterialGroup;
  saldoAwal: number;
  jumlahMasuk: number;
  jumlahKeluar: number;
  saldoAkhir: number;
  daily: DailyFlowPoint[];
  activeDaysMasuk: number;
  activeDaysKeluar: number;
  avgDailyUsage: number;
  maxDailyUsage: number;
  stdDevDailyUsage: number;
  turnoverRate: number;
  movementClass: MovementClass;
}

export interface DailyTransactionLog {
  id: string;
  day: number;
  group: MaterialGroup;
  kode: string;
  nama: string;
  satuan: string;
  type: 'masuk' | 'keluar';
  qty: number;
  runningSaldoAfter: number;
}

export interface WarehousePeriodData {
  tab: SheetMonthTab;
  up3Label: string;
  unitLabel: string;
  titleLabel: string;
  periodLabel: string;
  saldoAwalLabel: string;
  saldoAkhirLabel: string;
  items: WarehouseMaterialItem[];
  dailyLogs: DailyTransactionLog[];
  fetchedAt: Date;
}

export interface SafetyStockParams {
  leadTimeDays: number;
  zScore: number;
  demandMultiplierPct: number;
}

export interface SafetyStockResult {
  adjustedDailyUsage: number;
  maxDailyUsage: number;
  safetyStockStat: number;
  safetyStockMinMax: number;
  recommendedSafetyStock: number;
  reorderPoint: number;
  targetMaxStock: number;
  daysOfSupply: number | null;
  shortfallToRop: number;
  status: 'aman' | 'siaga-reorder' | 'kritis-safety' | 'kosong' | 'pasif';
  statusLabel: string;
  projectedDailyStock: Array<{
    day: number;
    projectedStock: number;
    reorderPoint: number;
    safetyStock: number;
  }>;
}

export function getWarehouseCsvUrl(
  gid: string,
  spreadsheetId: string = WAREHOUSE_SPREADSHEET_ID
): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

export function parseGoogleSheetLink(inputUrl: string): {
  spreadsheetId: string | null;
  gid: string | null;
} {
  const trimmed = inputUrl.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  return {
    spreadsheetId: idMatch ? idMatch[1] : null,
    gid: gidMatch ? gidMatch[1] : null,
  };
}

function parseCsvPreservingEmpty(text: string): string[][] {
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

function parseNumericCell(raw: string | undefined): number {
  if (!raw) return 0;
  let cleaned = String(raw).trim();
  if (!cleaned || cleaned === '-' || cleaned === '—') return 0;
  cleaned = cleaned.replace(/[^\d.,-]/g, '');
  if (!cleaned || cleaned === '-') return 0;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1] && parts[1].length === 3 && parts[0].length <= 3) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts[1] && parts[1].length === 3 && parts[0].length <= 3)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function detectSectionGroup(row: string[]): MaterialGroup | null {
  const joined = row
    .slice(0, 5)
    .join(' ')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (joined === 'APP') return 'APP';
  if (joined === 'HAR') return 'HAR';
  return null;
}

export function parseWarehousePeriodCsv(
  csvText: string,
  tab: SheetMonthTab
): WarehousePeriodData {
  const rows = parseCsvPreservingEmpty(csvText);

  let up3Label = 'UP3 MAKASSAR SELATAN';
  let unitLabel = 'ULP KALEBAJENG';
  let titleLabel = 'DAFTAR PEMAKAIAN MATERIAL GUDANG ULP KALEBAJENG';
  let periodLabel = tab.label;
  let saldoAwalLabel = 'SALDO AWAL';
  let saldoAkhirLabel = `SALDO AKHIR ${tab.label}`;

  let headerIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r] || [];
    const c0 = (row[0] || '').trim().toUpperCase();
    const c1 = (row[1] || '').trim().toUpperCase();
    const c2 = (row[2] || '').trim().toUpperCase();

    if (c0 === 'NO' && c1 === 'KODE' && c2.includes('NAMA')) {
      headerIdx = r;
      if (row[4]) saldoAwalLabel = row[4].trim();
      break;
    }

    if (c0.includes('UP3')) up3Label = (row[0] || '').trim();
    if (c0.includes('ULP')) unitLabel = (row[0] || '').trim();
    if (c0.includes('DAFTAR PEMAKAIAN')) titleLabel = (row[0] || '').trim();
    if (c0.startsWith('BULAN ')) periodLabel = (row[0] || '').trim();
  }

  if (headerIdx === -1) {
    return {
      tab,
      up3Label,
      unitLabel,
      titleLabel,
      periodLabel,
      saldoAwalLabel,
      saldoAkhirLabel,
      items: [],
      dailyLogs: [],
      fetchedAt: new Date(),
    };
  }

  const headerRow = rows[headerIdx] || [];
  let totalMasukCol = headerRow.findIndex((c) =>
    c.toUpperCase().includes('JUMLAH MASUK')
  );
  let totalKeluarCol = headerRow.findIndex((c) =>
    c.toUpperCase().includes('JUMLAH PEMAKAIAN')
  );
  let saldoAkhirCol = headerRow.findIndex((c) =>
    c.toUpperCase().includes('SALDO AKHIR')
  );

  if (totalMasukCol === -1) totalMasukCol = 67;
  if (totalKeluarCol === -1) totalKeluarCol = 68;
  if (saldoAkhirCol === -1) saldoAkhirCol = 69;

  if (headerRow[saldoAkhirCol]) {
    saldoAkhirLabel = headerRow[saldoAkhirCol].trim();
  }

  const dayColsStart = 5; // Day 1 Masuk=5, Keluar=6 ... Day 31 Masuk=65, Keluar=66

  const items: WarehouseMaterialItem[] = [];
  const dailyLogs: DailyTransactionLog[] = [];
  let currentGroup: MaterialGroup = 'APP';

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const col0 = (row[0] || '').trim();
    const col0Upper = col0.toUpperCase();

    // Stop immediately if we hit an older duplicated template block lower down the sheet
    if (
      col0Upper.includes('PT.PLN') ||
      col0Upper.includes('WILAYAH SULSELRABAR') ||
      col0Upper.includes('DAFTAR PEMAKAIAN MATERIAL') ||
      (col0Upper === 'NO' && (row[1] || '').trim().toUpperCase() === 'KODE')
    ) {
      break;
    }

    const sec = detectSectionGroup(row);
    if (sec) {
      currentGroup = sec;
      continue;
    }

    const kode = (row[1] || '').trim();
    const nama = (row[2] || '').trim();
    const satuan = (row[3] || '').trim() || 'BH';

    // Skip empty placeholder rows (e.g., rows with NO=27..37 but blank KODE & NAMA)
    if (!kode || !nama) {
      continue;
    }

    const no = Number(col0) || items.length + 1;
    const saldoAwal = parseNumericCell(row[4]);

    const daily: DailyFlowPoint[] = [];
    let sumMasukFromDays = 0;
    let sumKeluarFromDays = 0;
    let activeDaysMasuk = 0;
    let activeDaysKeluar = 0;
    let maxDailyUsage = 0;
    let runningSaldo = saldoAwal;

    for (let d = 0; d < 31; d++) {
      const mCol = dayColsStart + d * 2;
      const kCol = mCol + 1;
      const masuk = parseNumericCell(row[mCol]);
      const keluar = parseNumericCell(row[kCol]);
      daily.push({ day: d + 1, masuk, keluar });

      sumMasukFromDays += masuk;
      sumKeluarFromDays += keluar;
      if (masuk > 0) activeDaysMasuk++;
      if (keluar > 0) activeDaysKeluar++;
      if (keluar > maxDailyUsage) maxDailyUsage = keluar;

      if (masuk > 0) {
        runningSaldo += masuk;
        dailyLogs.push({
          id: `${tab.id}-${kode}-${r}-d${d + 1}-m`,
          day: d + 1,
          group: currentGroup,
          kode,
          nama,
          satuan,
          type: 'masuk',
          qty: masuk,
          runningSaldoAfter: runningSaldo,
        });
      }

      if (keluar > 0) {
        runningSaldo -= keluar;
        dailyLogs.push({
          id: `${tab.id}-${kode}-${r}-d${d + 1}-k`,
          day: d + 1,
          group: currentGroup,
          kode,
          nama,
          satuan,
          type: 'keluar',
          qty: keluar,
          runningSaldoAfter: runningSaldo,
        });
      }
    }

    const sheetMasuk = parseNumericCell(row[totalMasukCol]);
    const sheetKeluar = parseNumericCell(row[totalKeluarCol]);
    const jumlahMasuk = sheetMasuk > 0 || sumMasukFromDays === 0 ? sheetMasuk : sumMasukFromDays;
    const jumlahKeluar = sheetKeluar > 0 || sumKeluarFromDays === 0 ? sheetKeluar : sumKeluarFromDays;

    const rawSaldoAkhir = row[saldoAkhirCol];
    const saldoAkhir =
      rawSaldoAkhir !== undefined && rawSaldoAkhir.trim() !== ''
        ? parseNumericCell(rawSaldoAkhir)
        : Math.max(0, saldoAwal + jumlahMasuk - jumlahKeluar);

    const avgDailyUsage = jumlahKeluar / 31;
    const variance =
      daily.reduce((acc, pt) => acc + Math.pow(pt.keluar - avgDailyUsage, 2), 0) / 31;
    const stdDevDailyUsage = Math.sqrt(variance);

    const avgStock = Math.max(1, (saldoAwal + saldoAkhir) / 2);
    const turnoverRate = jumlahKeluar > 0 ? jumlahKeluar / avgStock : 0;

    let movementClass: MovementClass = 'Non-Moving';
    if (jumlahKeluar >= 10 || activeDaysKeluar >= 3 || turnoverRate >= 0.4) {
      movementClass = 'Fast Moving';
    } else if (jumlahKeluar > 0 || jumlahMasuk > 0) {
      movementClass = 'Slow Moving';
    }

    items.push({
      id: `${tab.id}-${currentGroup}-${kode}-${r}`,
      no,
      kode,
      nama,
      satuan,
      group: currentGroup,
      saldoAwal,
      jumlahMasuk,
      jumlahKeluar,
      saldoAkhir,
      daily,
      activeDaysMasuk,
      activeDaysKeluar,
      avgDailyUsage,
      maxDailyUsage,
      stdDevDailyUsage,
      turnoverRate,
      movementClass,
    });
  }

  dailyLogs.sort((a, b) => a.day - b.day || (a.type === 'masuk' ? -1 : 1));

  return {
    tab,
    up3Label,
    unitLabel,
    titleLabel,
    periodLabel,
    saldoAwalLabel,
    saldoAkhirLabel,
    items,
    dailyLogs,
    fetchedAt: new Date(),
  };
}

export async function fetchWarehouseMonthTab(
  tabOrUrl: SheetMonthTab | string
): Promise<WarehousePeriodData> {
  let targetTab: SheetMonthTab;
  let spreadsheetId = WAREHOUSE_SPREADSHEET_ID;

  if (typeof tabOrUrl === 'string') {
    const parsed = parseGoogleSheetLink(tabOrUrl);
    if (parsed.spreadsheetId) spreadsheetId = parsed.spreadsheetId;
    const gid = parsed.gid || '410640151';
    const matched = WAREHOUSE_MONTH_TABS.find((t) => t.gid === gid);
    targetTab = matched || {
      id: `gid-${gid}`,
      gid,
      label: `Sheet gid=${gid}`,
      shortLabel: gid,
      order: 99,
    };
  } else {
    targetTab = tabOrUrl;
  }

  const csvText = await fetchPublicGoogleSheetCsv(
    spreadsheetId,
    targetTab.gid,
    targetTab.label
  );

  return parseWarehousePeriodCsv(csvText, targetTab);
}

export function computeSafetyStockSimulation(
  item: WarehouseMaterialItem,
  params: SafetyStockParams
): SafetyStockResult {
  const factor = Math.max(0.1, params.demandMultiplierPct / 100);
  const adjustedDailyUsage = item.avgDailyUsage * factor;
  const maxDailyUsage = item.maxDailyUsage * factor;
  const adjustedStd = item.stdDevDailyUsage * factor;
  const leadTime = Math.max(1, params.leadTimeDays);

  const safetyStockStat = Math.ceil(
    params.zScore * adjustedStd * Math.sqrt(leadTime)
  );
  const safetyStockMinMax = Math.ceil(
    Math.max(0, (maxDailyUsage - adjustedDailyUsage) * leadTime * 0.5)
  );
  const recommendedSafetyStock =
    item.jumlahKeluar > 0
      ? Math.max(1, Math.max(safetyStockStat, safetyStockMinMax))
      : 0;

  const reorderPoint =
    item.jumlahKeluar > 0
      ? Math.ceil(adjustedDailyUsage * leadTime + recommendedSafetyStock)
      : 0;

  const targetMaxStock =
    item.jumlahKeluar > 0
      ? Math.ceil(reorderPoint + adjustedDailyUsage * 14)
      : item.saldoAkhir;

  const daysOfSupply =
    adjustedDailyUsage > 0 ? item.saldoAkhir / adjustedDailyUsage : null;

  const shortfallToRop = Math.max(0, reorderPoint - item.saldoAkhir);

  let status: SafetyStockResult['status'] = 'pasif';
  let statusLabel = 'Pasif / Non-Moving';

  if (item.jumlahKeluar > 0) {
    if (item.saldoAkhir <= 0) {
      status = 'kosong';
      statusLabel = 'Stok Habis (0)';
    } else if (item.saldoAkhir <= recommendedSafetyStock) {
      status = 'kritis-safety';
      statusLabel = 'Kritis (< Safety Stock)';
    } else if (item.saldoAkhir <= reorderPoint) {
      status = 'siaga-reorder';
      statusLabel = 'Siaga Reorder (ROP)';
    } else {
      status = 'aman';
      statusLabel = 'Aman di Atas ROP';
    }
  }

  const projectedDailyStock = Array.from({ length: 31 }, (_, idx) => {
    const projected = Math.max(0, item.saldoAkhir - adjustedDailyUsage * idx);
    return {
      day: idx,
      projectedStock: Number(projected.toFixed(1)),
      reorderPoint,
      safetyStock: recommendedSafetyStock,
    };
  });

  return {
    adjustedDailyUsage,
    maxDailyUsage,
    safetyStockStat,
    safetyStockMinMax,
    recommendedSafetyStock,
    reorderPoint,
    targetMaxStock,
    daysOfSupply,
    shortfallToRop,
    status,
    statusLabel,
    projectedDailyStock,
  };
}

export function exportPeriodToCSV(
  period: WarehousePeriodData,
  simParams: SafetyStockParams
) {
  const escape = (v: string | number | null | undefined) => {
    const str = v === null || v === undefined ? '' : String(v);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = [
    'Periode',
    'Kelompok',
    'No',
    'Kode Material',
    'Nama Material',
    'Satuan',
    period.saldoAwalLabel,
    'Jumlah Masuk',
    'Jumlah Keluar',
    period.saldoAkhirLabel,
    'Rasio Perputaran (x)',
    'Klasifikasi Pergerakan',
    'Safety Stock',
    'Reorder Point (ROP)',
    'Saran Order',
    'Status Safety Stok',
  ];

  const rows = period.items.map((item) => {
    const sim = computeSafetyStockSimulation(item, simParams);
    return [
      period.periodLabel,
      item.group,
      item.no,
      item.kode,
      item.nama,
      item.satuan,
      item.saldoAwal,
      item.jumlahMasuk,
      item.jumlahKeluar,
      item.saldoAkhir,
      Number(item.turnoverRate.toFixed(2)),
      item.movementClass,
      sim.recommendedSafetyStock,
      sim.reorderPoint,
      sim.shortfallToRop,
      sim.statusLabel,
    ];
  });

  const csv = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `material-kalebajeng-${period.tab.id}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
