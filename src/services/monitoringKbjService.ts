import { MONITORING_HARIAN_KBJ_CSV_DATA } from '../data/monitoringHarianKbjCsv';
import {
  parseDelimitedText,
  parseGoogleSheetUrl,
  parseNumericCell,
  resolvePublicCsvUrl,
} from './sheetsService';

export const KBJ_LIVE_SPREADSHEET_ID = '1Wqq2Hlfa21ivgNH6My-1SxX338TYNbH7O9uuJ5f9AeA';
export const KBJ_LIVE_DEFAULT_GID = '410640151';
export const KBJ_LIVE_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Wqq2Hlfa21ivgNH6My-1SxX338TYNbH7O9uuJ5f9AeA/edit?gid=410640151#gid=410640151';

export interface KbjLiveTabMeta {
  gid: string;
  name: string;
}

export const KBJ_LIVE_TABS: KbjLiveTabMeta[] = [
  { gid: '998488260', name: 'JAN 2026' },
  { gid: '1511299888', name: 'FEB 2026' },
  { gid: '1093923729', name: 'MAR 2026' },
  { gid: '910582977', name: 'APR 2026' },
  { gid: '1420587398', name: 'MEI 2026' },
  { gid: '1993054747', name: 'JUNI 2026' },
  { gid: '570696065', name: 'JULI 2026' },
  { gid: '588641371', name: 'AGUS 2026' },
  { gid: '1740620273', name: 'SEPT 2026' },
  { gid: '410640151', name: 'OKT 2026' },
  { gid: '2039754835', name: 'NOV 2026' },
];

export type KbjSectionGroup = 'APP' | 'HAR' | 'LAINNYA';

export interface DailyEntry {
  day: number; // 1..31
  masuk: number;
  keluar: number;
}

export interface KbjDailyMaterialItem {
  id: string;
  rowNo: number;
  kode: string;
  nama: string;
  satuan: string;
  section: KbjSectionGroup;
  saldoAwal: number;
  daily: DailyEntry[]; // 31 days
  jumlahMasuk: number;
  jumlahKeluar: number;
  saldoAkhir: number;
  // Derived analytics
  activeDaysMasuk: number;
  activeDaysKeluar: number;
  avgDailyUsage: number;
  maxDailyUsage: number;
  dailyStdDev: number;
  turnoverRate: number;
  movementClass: 'Fast Moving' | 'Medium' | 'Slow / Pasif';
}

export interface KbjDailyLogEvent {
  id: string;
  day: number;
  kode: string;
  nama: string;
  satuan: string;
  section: KbjSectionGroup;
  type: 'masuk' | 'keluar';
  qty: number;
  runningSaldoAfter: number;
}

export interface KbjPeriodDataset {
  id: string;
  gid?: string;
  tabName?: string;
  unitLabel: string;
  up3Label: string;
  reportTitle: string;
  periodLabel: string;
  saldoAwalLabel: string;
  saldoAkhirLabel: string;
  items: KbjDailyMaterialItem[];
  dailyTotals: Array<{
    day: number;
    masuk: number;
    keluar: number;
    cumulativeMasuk: number;
    cumulativeKeluar: number;
    netBalance: number;
  }>;
  dailyLogs: KbjDailyLogEvent[];
}

export interface KbjMonitoringWorkbook {
  periods: KbjPeriodDataset[];
  defaultPeriodId?: string;
  sourceLabel: string;
  fetchedAt: Date;
}

export interface SafetyStockParams {
  leadTimeDays: number;
  zScore: number; // e.g., 1.28 (90%), 1.65 (95%), 2.05 (98%), 2.33 (99%)
  demandMultiplierPct: number; // e.g., 100 = baseline, 130 = +30% lonjakan
}

export interface SafetyStockResult {
  avgDailyUsage: number;
  adjustedDailyUsage: number;
  maxDailyUsage: number;
  dailyStdDev: number;
  safetyStockStat: number; // Z * sigma * sqrt(L)
  safetyStockMinMax: number; // (maxDaily - avgDaily) * L
  recommendedSafetyStock: number;
  reorderPoint: number;
  targetMaxStock: number;
  daysOfSupply: number | null;
  shortfallToRop: number;
  shortfallToSafety: number;
  status: 'aman' | 'siaga-reorder' | 'kritis-safety' | 'kosong' | 'pasif';
  statusLabel: string;
  projectedDailyStock: Array<{
    day: number;
    projectedStock: number;
    safetyStock: number;
    reorderPoint: number;
  }>;
}

function normalizeSection(raw: string): KbjSectionGroup {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  if (compact === 'APP') return 'APP';
  if (compact === 'HAR') return 'HAR';
  return 'LAINNYA';
}

function finalizeItem(
  base: Omit<
    KbjDailyMaterialItem,
    | 'activeDaysMasuk'
    | 'activeDaysKeluar'
    | 'avgDailyUsage'
    | 'maxDailyUsage'
    | 'dailyStdDev'
    | 'turnoverRate'
    | 'movementClass'
  >
): KbjDailyMaterialItem {
  const daysCount = 31;
  let activeDaysMasuk = 0;
  let activeDaysKeluar = 0;
  let maxDailyUsage = 0;

  for (const d of base.daily) {
    if (d.masuk > 0) activeDaysMasuk++;
    if (d.keluar > 0) {
      activeDaysKeluar++;
      if (d.keluar > maxDailyUsage) maxDailyUsage = d.keluar;
    }
  }

  const avgDailyUsage = base.jumlahKeluar / daysCount;
  let varianceSum = 0;
  for (const d of base.daily) {
    const diff = d.keluar - avgDailyUsage;
    varianceSum += diff * diff;
  }
  const dailyStdDev = Math.sqrt(varianceSum / daysCount);

  const avgStock = (base.saldoAwal + base.saldoAkhir) / 2;
  const denom = avgStock > 0 ? avgStock : Math.max(1, base.jumlahMasuk, base.saldoAwal);
  const turnoverRate = base.jumlahKeluar > 0 ? base.jumlahKeluar / denom : 0;

  let movementClass: KbjDailyMaterialItem['movementClass'] = 'Slow / Pasif';
  if (activeDaysKeluar >= 5 || turnoverRate >= 0.8) {
    movementClass = 'Fast Moving';
  } else if (base.jumlahKeluar > 0 || base.jumlahMasuk > 0) {
    movementClass = 'Medium';
  }

  return {
    ...base,
    activeDaysMasuk,
    activeDaysKeluar,
    avgDailyUsage,
    maxDailyUsage,
    dailyStdDev,
    turnoverRate,
    movementClass,
  };
}

export function parseMonitoringKbjCsv(
  csvText: string,
  sourceLabel = 'Lampiran MONITORING_HARIAN_GUDANG_KBJ-BAHAGIA'
): KbjMonitoringWorkbook {
  const rows = parseDelimitedText(csvText);
  const periods: KbjPeriodDataset[] = [];
  const seenPeriodSignatures = new Set<string>();

  let currentUp3 = 'UP3 MAKASAR SELATAN';
  let currentUnit = 'ULP KALEBAJENG';
  let currentTitle = 'DAFTAR PEMAKAIAN MATERIAL GUDANG ULP KALEBAJENG';
  let currentPeriodLabel = 'Periode Harian';
  let inBlock: {
    up3Label: string;
    unitLabel: string;
    reportTitle: string;
    periodLabel: string;
    saldoAwalLabel: string;
    saldoAkhirLabel: string;
    masukStartCol: number;
    totalMasukCol: number;
    totalKeluarCol: number;
    saldoAkhirCol: number;
    saldoAwalCol: number;
    section: KbjSectionGroup;
    items: KbjDailyMaterialItem[];
  } | null = null;

  const commitCurrentBlock = () => {
    if (!inBlock || inBlock.items.length === 0) {
      inBlock = null;
      return;
    }

    const sig = `${inBlock.periodLabel}::${inBlock.items.length}::${inBlock.items
      .slice(0, 5)
      .map((i) => `${i.kode}:${i.saldoAwal}:${i.jumlahKeluar}`)
      .join('|')}`;

    if (seenPeriodSignatures.has(sig)) {
      inBlock = null;
      return;
    }
    seenPeriodSignatures.add(sig);

    const daySumMasuk = new Array<number>(31).fill(0);
    const daySumKeluar = new Array<number>(31).fill(0);
    let totalSaldoAwal = 0;
    const dailyLogs: KbjDailyLogEvent[] = [];

    for (const item of inBlock.items) {
      totalSaldoAwal += item.saldoAwal;
      let running = item.saldoAwal;
      for (const d of item.daily) {
        if (d.masuk > 0) {
          daySumMasuk[d.day - 1] += d.masuk;
          running += d.masuk;
          dailyLogs.push({
            id: `${item.id}-d${d.day}-in`,
            day: d.day,
            kode: item.kode,
            nama: item.nama,
            satuan: item.satuan,
            section: item.section,
            type: 'masuk',
            qty: d.masuk,
            runningSaldoAfter: running,
          });
        }
        if (d.keluar > 0) {
          daySumKeluar[d.day - 1] += d.keluar;
          running -= d.keluar;
          dailyLogs.push({
            id: `${item.id}-d${d.day}-out`,
            day: d.day,
            kode: item.kode,
            nama: item.nama,
            satuan: item.satuan,
            section: item.section,
            type: 'keluar',
            qty: d.keluar,
            runningSaldoAfter: running,
          });
        }
      }
    }

    dailyLogs.sort((a, b) => a.day - b.day || a.nama.localeCompare(b.nama, 'id'));

    let cumMasuk = 0;
    let cumKeluar = 0;
    let runningPortfolio = totalSaldoAwal;
    const dailyTotals = daySumMasuk.map((m, idx) => {
      const k = daySumKeluar[idx];
      cumMasuk += m;
      cumKeluar += k;
      runningPortfolio = runningPortfolio + m - k;
      return {
        day: idx + 1,
        masuk: m,
        keluar: k,
        cumulativeMasuk: cumMasuk,
        cumulativeKeluar: cumKeluar,
        netBalance: runningPortfolio,
      };
    });

    periods.push({
      id: `period-${periods.length + 1}`,
      up3Label: inBlock.up3Label,
      unitLabel: inBlock.unitLabel,
      reportTitle: inBlock.reportTitle,
      periodLabel: inBlock.periodLabel,
      saldoAwalLabel: inBlock.saldoAwalLabel,
      saldoAkhirLabel: inBlock.saldoAkhirLabel,
      items: inBlock.items,
      dailyTotals,
      dailyLogs,
    });

    inBlock = null;
  };

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const nonEmptyCells = row.map((c) => String(c || '').trim()).filter(Boolean);
    if (nonEmptyCells.length === 0) continue;

    const firstText = nonEmptyCells[0];
    const upperJoined = nonEmptyCells.join(' ').toUpperCase();

    if (upperJoined.includes('UP3 ') && nonEmptyCells.length <= 2) {
      currentUp3 = firstText;
      continue;
    }
    if (upperJoined.includes('ULP ') && !upperJoined.includes('DAFTAR PEMAKAIAN')) {
      currentUnit = firstText;
      continue;
    }
    if (upperJoined.includes('DAFTAR PEMAKAIAN MATERIAL')) {
      commitCurrentBlock();
      currentTitle = firstText;
      continue;
    }
    if (upperJoined.startsWith('BULAN ') && nonEmptyCells.length <= 2) {
      currentPeriodLabel = firstText;
      continue;
    }

    // Detect main header row: NO, KODE, NAMA MATERIAL, STN, SALDO AWAL...
    const c0 = String(row[0] || '').trim().toUpperCase();
    const c1 = String(row[1] || '').trim().toUpperCase();
    if (c0 === 'NO' && c1 === 'KODE') {
      commitCurrentBlock();
      const saldoAwalLabel = String(row[4] || 'SALDO AWAL').trim() || 'SALDO AWAL';
      const totalMasukCol = row.findIndex((c) =>
        String(c || '').toUpperCase().includes('JUMLAH MASUK')
      );
      const totalKeluarCol = row.findIndex((c) =>
        String(c || '').toUpperCase().includes('JUMLAH PEMAKAIAN')
      );
      const saldoAkhirCol = row.findIndex((c) =>
        String(c || '').toUpperCase().includes('SALDO AKHIR')
      );
      const saldoAkhirLabel =
        saldoAkhirCol >= 0 ? String(row[saldoAkhirCol] || 'SALDO AKHIR').trim() : 'SALDO AKHIR';

      inBlock = {
        up3Label: currentUp3,
        unitLabel: currentUnit,
        reportTitle: currentTitle,
        periodLabel: currentPeriodLabel,
        saldoAwalLabel,
        saldoAkhirLabel,
        saldoAwalCol: 4,
        masukStartCol: 5,
        totalMasukCol: totalMasukCol >= 0 ? totalMasukCol : 67,
        totalKeluarCol: totalKeluarCol >= 0 ? totalKeluarCol : 68,
        saldoAkhirCol: saldoAkhirCol >= 0 ? saldoAkhirCol : 69,
        section: 'APP',
        items: [],
      };
      continue;
    }

    if (!inBlock) continue;

    // Skip numeric day header rows (1..31) or MASUK/KELUAR subheader rows
    if (
      String(row[5] || '').trim() === '1' ||
      String(row[5] || '').trim().toUpperCase() === 'MASUK'
    ) {
      continue;
    }

    // Section divider (e.g., ", ,  A  P  P" or ", ,HAR")
    const possibleSection = String(row[2] || '').trim();
    if (!c0 && !c1 && possibleSection) {
      const sec = normalizeSection(possibleSection);
      if (sec === 'APP' || sec === 'HAR') {
        inBlock.section = sec;
        continue;
      }
    }

    // Data row: must have KODE & NAMA MATERIAL
    const kode = String(row[1] || '').trim();
    const nama = String(row[2] || '').trim();
    if (!kode && !nama) continue;
    if (!nama || nama.length < 2) continue;

    const rowNo = Math.round(parseNumericCell(row[0])) || inBlock.items.length + 1;
    const satuan = String(row[3] || 'BH').trim() || 'BH';
    const saldoAwal = parseNumericCell(row[inBlock.saldoAwalCol]);

    const daily: DailyEntry[] = [];
    let computedMasuk = 0;
    let computedKeluar = 0;
    for (let d = 0; d < 31; d++) {
      const masukCol = inBlock.masukStartCol + d * 2;
      const keluarCol = masukCol + 1;
      const masuk = parseNumericCell(row[masukCol]);
      const keluar = parseNumericCell(row[keluarCol]);
      computedMasuk += masuk;
      computedKeluar += keluar;
      daily.push({ day: d + 1, masuk, keluar });
    }

    const sheetMasuk = parseNumericCell(row[inBlock.totalMasukCol]);
    const sheetKeluar = parseNumericCell(row[inBlock.totalKeluarCol]);
    const jumlahMasuk = sheetMasuk > 0 ? sheetMasuk : computedMasuk;
    const jumlahKeluar = sheetKeluar > 0 ? sheetKeluar : computedKeluar;

    const rawSaldoAkhir = String(row[inBlock.saldoAkhirCol] || '').trim();
    const saldoAkhir =
      rawSaldoAkhir !== ''
        ? parseNumericCell(rawSaldoAkhir)
        : Math.max(0, saldoAwal + jumlahMasuk - jumlahKeluar);

    inBlock.items.push(
      finalizeItem({
        id: `${inBlock.periodLabel}-${inBlock.section}-${kode || rowNo}-${inBlock.items.length}`,
        rowNo,
        kode: kode || `ITEM-${rowNo}`,
        nama,
        satuan,
        section: inBlock.section,
        saldoAwal,
        daily,
        jumlahMasuk,
        jumlahKeluar,
        saldoAkhir,
      })
    );
  }

  commitCurrentBlock();

  return {
    periods,
    sourceLabel,
    fetchedAt: new Date(),
  };
}

function keepPrimaryPeriods(periods: KbjPeriodDataset[]): KbjPeriodDataset[] {
  const only2026 = periods.filter((p) =>
    p.periodLabel.toUpperCase().includes('2026')
  );
  return only2026.length > 0 ? only2026 : periods;
}

export function getDefaultMonitoringKbjWorkbook(): KbjMonitoringWorkbook {
  const raw = parseMonitoringKbjCsv(
    MONITORING_HARIAN_KBJ_CSV_DATA,
    'Cadangan Offline Lampiran KBJ-Bahagia'
  );
  const periods = keepPrimaryPeriods(raw.periods);
  return {
    ...raw,
    periods,
    defaultPeriodId: periods[0]?.id,
  };
}

export async function fetchKbjLiveWorkbookFromSpreadsheet(
  spreadsheetId: string = KBJ_LIVE_SPREADSHEET_ID,
  preferredGid: string = KBJ_LIVE_DEFAULT_GID
): Promise<KbjMonitoringWorkbook> {
  const results = await Promise.allSettled(
    KBJ_LIVE_TABS.map(async (tab) => {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
        spreadsheetId
      )}/export?format=csv&gid=${encodeURIComponent(tab.gid)}`;
      const res = await fetch(csvUrl, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${tab.name})`);
      }
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error(`HTML response (${tab.name})`);
      }
      const parsed = parseMonitoringKbjCsv(text, tab.name);
      const primary = keepPrimaryPeriods(parsed.periods)[0];
      if (!primary) return null;
      return {
        ...primary,
        id: `gid-${tab.gid}`,
        gid: tab.gid,
        tabName: tab.name,
      } satisfies KbjPeriodDataset;
    })
  );

  const periods: KbjPeriodDataset[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      periods.push(r.value);
    }
  }

  if (periods.length === 0) {
    throw new Error(
      'Gagal memuat tab dari Google Spreadsheet terlampir. Pastikan akses publik CSV aktif.'
    );
  }

  const preferredPeriod =
    periods.find((p) => p.gid === preferredGid) ||
    periods[periods.length - 1] ||
    periods[0];

  return {
    periods,
    defaultPeriodId: preferredPeriod.id,
    sourceLabel: `Google Sheets Live (${spreadsheetId.slice(0, 12)}… · ${
      preferredPeriod.tabName || preferredPeriod.periodLabel
    } gid=${preferredPeriod.gid || preferredGid})`,
    fetchedAt: new Date(),
  };
}

export async function fetchMonitoringKbjFromUrl(
  rawUrl: string
): Promise<KbjMonitoringWorkbook> {
  const parsedUrl = parseGoogleSheetUrl(rawUrl);
  if (parsedUrl.spreadsheetId === KBJ_LIVE_SPREADSHEET_ID) {
    return fetchKbjLiveWorkbookFromSpreadsheet(
      parsedUrl.spreadsheetId,
      parsedUrl.gid !== null ? String(parsedUrl.gid) : KBJ_LIVE_DEFAULT_GID
    );
  }

  const resolved = resolvePublicCsvUrl(rawUrl) || rawUrl.trim();
  const res = await fetch(resolved, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Gagal mengunduh CSV Monitoring Harian (HTTP ${res.status}).`);
  }
  const text = await res.text();
  const parsed = parseMonitoringKbjCsv(text, resolved);
  const periods = keepPrimaryPeriods(parsed.periods);
  if (periods.length === 0) {
    throw new Error(
      'Format CSV dari link belum terbaca sebagai format Monitoring Harian Gudang (kolom NO, KODE, NAMA MATERIAL, MASUK/KELUAR).'
    );
  }
  return {
    ...parsed,
    periods,
    defaultPeriodId: periods[0]?.id,
  };
}

export function computeSafetyStockSimulation(
  item: KbjDailyMaterialItem,
  params: SafetyStockParams
): SafetyStockResult {
  const leadTimeDays = Math.max(1, Math.min(60, params.leadTimeDays));
  const multiplier = Math.max(0.5, params.demandMultiplierPct / 100);

  const avgDailyUsage = item.avgDailyUsage;
  const adjustedDailyUsage = avgDailyUsage * multiplier;
  const maxDailyUsage = item.maxDailyUsage * multiplier;
  const dailyStdDev = item.dailyStdDev * multiplier;

  // Metode Statistik: Z * sigma_daily * sqrt(Lead Time)
  const safetyStockStat =
    adjustedDailyUsage > 0
      ? Math.ceil(params.zScore * dailyStdDev * Math.sqrt(leadTimeDays))
      : 0;

  // Metode Min-Max Empiris: (Max Daily - Avg Daily) * Lead Time * 0.5 (untuk lonjakan harian)
  const safetyStockMinMax =
    adjustedDailyUsage > 0
      ? Math.ceil(Math.max(0, (maxDailyUsage - adjustedDailyUsage) * Math.min(leadTimeDays, 7) * 0.5))
      : 0;

  const recommendedSafetyStock =
    adjustedDailyUsage > 0
      ? Math.max(1, Math.round((safetyStockStat + safetyStockMinMax) / 2))
      : 0;

  const reorderPoint =
    adjustedDailyUsage > 0
      ? Math.ceil(adjustedDailyUsage * leadTimeDays + recommendedSafetyStock)
      : 0;

  const targetMaxStock =
    adjustedDailyUsage > 0
      ? Math.ceil(reorderPoint + adjustedDailyUsage * Math.max(7, leadTimeDays))
      : Math.max(item.saldoAkhir, 5);

  const daysOfSupply =
    adjustedDailyUsage > 0 ? item.saldoAkhir / adjustedDailyUsage : null;

  const shortfallToRop = Math.max(0, reorderPoint - item.saldoAkhir);
  const shortfallToSafety = Math.max(0, recommendedSafetyStock - item.saldoAkhir);

  let status: SafetyStockResult['status'] = 'aman';
  let statusLabel = 'Aman (> ROP)';

  if (item.saldoAkhir === 0 && adjustedDailyUsage > 0) {
    status = 'kosong';
    statusLabel = 'Stok Habis (0)';
  } else if (adjustedDailyUsage === 0) {
    status = 'pasif';
    statusLabel = item.saldoAkhir > 0 ? 'Siap Cadangan (Pasif)' : 'Kosong Non-Aktif';
  } else if (item.saldoAkhir <= recommendedSafetyStock) {
    status = 'kritis-safety';
    statusLabel = 'Kritis (<= Safety Stock)';
  } else if (item.saldoAkhir <= reorderPoint) {
    status = 'siaga-reorder';
    statusLabel = 'Siaga Order (<= ROP)';
  }

  // Proyeksi penurunan stok 30 hari ke depan
  const projectedDailyStock = Array.from({ length: 30 }, (_, idx) => {
    const day = idx + 1;
    const projectedStock = Math.max(
      0,
      Number((item.saldoAkhir - adjustedDailyUsage * day).toFixed(2))
    );
    return {
      day,
      projectedStock,
      safetyStock: recommendedSafetyStock,
      reorderPoint,
    };
  });

  return {
    avgDailyUsage,
    adjustedDailyUsage,
    maxDailyUsage,
    dailyStdDev,
    safetyStockStat,
    safetyStockMinMax,
    recommendedSafetyStock,
    reorderPoint,
    targetMaxStock,
    daysOfSupply,
    shortfallToRop,
    shortfallToSafety,
    status,
    statusLabel,
    projectedDailyStock,
  };
}

export function exportMonitoringKbjToCSV(
  period: KbjPeriodDataset,
  simParams: SafetyStockParams
) {
  const headers = [
    'No',
    'Kelompok',
    'Kode Material',
    'Nama Material',
    'Satuan',
    'Saldo Awal',
    'Jumlah Masuk',
    'Jumlah Keluar (Pemakaian)',
    'Saldo Akhir',
    'Rata-Rata Harian',
    'Puncak Harian',
    'Rasio Perputaran',
    'Klasifikasi',
    'Simulasi Safety Stock',
    'Reorder Point (ROP)',
    'Ketahanan Stok (Hari)',
    'Status Safety Stock',
  ];

  const rows = period.items.map((item) => {
    const sim = computeSafetyStockSimulation(item, simParams);
    return [
      item.rowNo,
      item.section,
      item.kode,
      item.nama,
      item.satuan,
      item.saldoAwal,
      item.jumlahMasuk,
      item.jumlahKeluar,
      item.saldoAkhir,
      item.avgDailyUsage.toFixed(2),
      item.maxDailyUsage,
      item.turnoverRate.toFixed(2),
      item.movementClass,
      sim.recommendedSafetyStock,
      sim.reorderPoint,
      sim.daysOfSupply !== null ? sim.daysOfSupply.toFixed(1) : 'Pasif',
      sim.statusLabel,
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `monitoring-harian-kbj-${period.periodLabel
    .toLowerCase()
    .replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
