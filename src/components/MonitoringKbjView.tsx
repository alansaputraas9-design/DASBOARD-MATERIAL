import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Link2,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeSafetyStockSimulation,
  exportMonitoringKbjToCSV,
  fetchKbjLiveWorkbookFromSpreadsheet,
  fetchMonitoringKbjFromUrl,
  getDefaultMonitoringKbjWorkbook,
  KBJ_LIVE_DEFAULT_GID,
  KBJ_LIVE_SPREADSHEET_ID,
  KBJ_LIVE_SPREADSHEET_URL,
  KbjDailyMaterialItem,
  KbjMonitoringWorkbook,
  KbjSectionGroup,
  parseMonitoringKbjCsv,
  SafetyStockParams,
} from '../services/monitoringKbjService';
import {
  DonutChart,
  GroupedBarChart,
  HorizontalBarChart,
  MultiLineChart,
  VerticalBarChart,
} from './Charts';

export type KbjSubSection = 'all' | 'charts' | 'detail' | 'search' | 'safety';
type TurnoverChartMetric = 'turnover' | 'keluar' | 'masuk';
type SearchMovementFilter = 'all' | 'active' | 'fast' | 'alert';
type LogTypeFilter = 'all' | 'masuk' | 'keluar';

function formatIdNum(val: number, maxDecimals = 2): string {
  return val.toLocaleString('id-ID', { maximumFractionDigits: maxDecimals });
}

function getSafetyBadgeClasses(
  status: 'aman' | 'siaga-reorder' | 'kritis-safety' | 'kosong' | 'pasif'
): string {
  switch (status) {
    case 'kosong':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'kritis-safety':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'siaga-reorder':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'aman':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pasif':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function MonitoringKbjView({
  initialSection = 'all',
}: {
  initialSection?: KbjSubSection;
}) {
  const defaultWorkbook = useMemo(() => getDefaultMonitoringKbjWorkbook(), []);
  const [workbook, setWorkbook] = useState<KbjMonitoringWorkbook>(defaultWorkbook);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    defaultWorkbook.periods[0]?.id || ''
  );

  useEffect(() => {
    if (initialSection === 'all') return;
    const idMap: Record<Exclude<KbjSubSection, 'all'>, string> = {
      charts: 'section-charts',
      search: 'section-search',
      detail: 'section-detail',
      safety: 'section-safety',
    };
    const el = document.getElementById(idMap[initialSection]);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialSection]);

  // External link / live spreadsheet sync / CSV upload state
  const [linkInput, setLinkInput] = useState(KBJ_LIVE_SPREADSHEET_URL);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const syncLiveSpreadsheet = useCallback(async (showToast = false) => {
    setLoadingLink(true);
    if (showToast) setLinkMessage(null);
    try {
      const liveWb = await fetchKbjLiveWorkbookFromSpreadsheet(
        KBJ_LIVE_SPREADSHEET_ID,
        KBJ_LIVE_DEFAULT_GID
      );
      setWorkbook(liveWb);
      setSelectedPeriodId(
        liveWb.defaultPeriodId || liveWb.periods[0]?.id || ''
      );
      setSelectedItemId(null);
      if (showToast) {
        setLinkMessage({
          type: 'success',
          text: `Berhasil menyinkronkan ${liveWb.periods.length} bulan (JAN–NOV 2026) dari Google Spreadsheet terlampir.`,
        });
      }
    } catch (err) {
      setLinkMessage({
        type: 'error',
        text:
          err instanceof Error
            ? `${err.message} Menampilkan cadangan offline.`
            : 'Gagal memuat spreadsheet live.',
      });
    } finally {
      setLoadingLink(false);
    }
  }, []);

  useEffect(() => {
    syncLiveSpreadsheet(false);
  }, [syncLiveSpreadsheet]);

  // Chart options
  const [chartSectionFilter, setChartSectionFilter] = useState<'ALL' | 'APP' | 'HAR'>('ALL');
  const [turnoverMetric, setTurnoverMetric] = useState<TurnoverChartMetric>('turnover');

  // Search & Item detail state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSection, setSearchSection] = useState<'ALL' | KbjSectionGroup>('ALL');
  const [searchMovement, setSearchMovement] = useState<SearchMovementFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showAllDaysInItemDetail, setShowAllDaysInItemDetail] = useState(false);

  // Daily Masuk/Keluar transaction log filters
  const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>('all');
  const [logDayFilter, setLogDayFilter] = useState<number | 'ALL'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Safety stock simulation parameters
  const [simParams, setSimParams] = useState<SafetyStockParams>({
    leadTimeDays: 7,
    zScore: 1.65,
    demandMultiplierPct: 100,
  });

  const activePeriod = useMemo(
    () =>
      workbook.periods.find((p) => p.id === selectedPeriodId) ||
      workbook.periods[0] ||
      null,
    [workbook.periods, selectedPeriodId]
  );

  // Pick a sensible default active item whenever period changes or selectedItemId is missing
  const selectedItem = useMemo<KbjDailyMaterialItem | null>(() => {
    if (!activePeriod || activePeriod.items.length === 0) return null;
    if (selectedItemId) {
      const found = activePeriod.items.find((i) => i.id === selectedItemId);
      if (found) return found;
    }
    const topActive = [...activePeriod.items]
      .filter((i) => i.jumlahKeluar > 0)
      .sort((a, b) => b.activeDaysKeluar - a.activeDaysKeluar || b.jumlahKeluar - a.jumlahKeluar);
    return topActive[0] || activePeriod.items[0];
  }, [activePeriod, selectedItemId]);

  const safetyResultsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeSafetyStockSimulation>>();
    if (!activePeriod) return map;
    for (const item of activePeriod.items) {
      map.set(item.id, computeSafetyStockSimulation(item, simParams));
    }
    return map;
  }, [activePeriod, simParams]);

  const portfolioSummary = useMemo(() => {
    if (!activePeriod) {
      return {
        totalItems: 0,
        appCount: 0,
        harCount: 0,
        activeCount: 0,
        totalAwal: 0,
        totalMasuk: 0,
        totalKeluar: 0,
        totalAkhir: 0,
        alertSafetyCount: 0,
        fastMovingCount: 0,
      };
    }

    let appCount = 0;
    let harCount = 0;
    let activeCount = 0;
    let totalAwal = 0;
    let totalMasuk = 0;
    let totalKeluar = 0;
    let totalAkhir = 0;
    let alertSafetyCount = 0;
    let fastMovingCount = 0;

    for (const item of activePeriod.items) {
      if (item.section === 'APP') appCount++;
      if (item.section === 'HAR') harCount++;
      if (item.jumlahMasuk > 0 || item.jumlahKeluar > 0) activeCount++;
      if (item.movementClass === 'Fast Moving') fastMovingCount++;
      totalAwal += item.saldoAwal;
      totalMasuk += item.jumlahMasuk;
      totalKeluar += item.jumlahKeluar;
      totalAkhir += item.saldoAkhir;

      const sim = safetyResultsMap.get(item.id);
      if (
        sim &&
        (sim.status === 'kosong' ||
          sim.status === 'kritis-safety' ||
          sim.status === 'siaga-reorder')
      ) {
        alertSafetyCount++;
      }
    }

    return {
      totalItems: activePeriod.items.length,
      appCount,
      harCount,
      activeCount,
      totalAwal,
      totalMasuk,
      totalKeluar,
      totalAkhir,
      alertSafetyCount,
      fastMovingCount,
    };
  }, [activePeriod, safetyResultsMap]);

  // Daily chart points (Days 1..31) filtered by APP / HAR / ALL
  const dailyFlowStats = useMemo(() => {
    if (!activePeriod) return [];
    const filteredItems =
      chartSectionFilter === 'ALL'
        ? activePeriod.items
        : activePeriod.items.filter((i) => i.section === chartSectionFilter);

    const startBalance = filteredItems.reduce((s, i) => s + i.saldoAwal, 0);
    let cumMasuk = 0;
    let cumKeluar = 0;
    let runningBalance = startBalance;

    return Array.from({ length: 31 }, (_, idx) => {
      const day = idx + 1;
      let masuk = 0;
      let keluar = 0;
      for (const item of filteredItems) {
        const entry = item.daily[idx];
        if (entry) {
          masuk += entry.masuk;
          keluar += entry.keluar;
        }
      }
      cumMasuk += masuk;
      cumKeluar += keluar;
      runningBalance = runningBalance + masuk - keluar;

      return {
        day,
        label: `Tgl ${day}`,
        masuk,
        keluar,
        cumMasuk,
        cumKeluar,
        runningBalance,
      };
    });
  }, [activePeriod, chartSectionFilter]);

  const dailyComparisonBars = useMemo(
    () =>
      dailyFlowStats.map((d) => ({
        label: String(d.day),
        value: d.masuk,
        secondaryValue: d.keluar,
      })),
    [dailyFlowStats]
  );

  // Cross-month comparison across all tabs in workbook (JAN..NOV 2026)
  const monthlySummarySeries = useMemo(() => {
    return workbook.periods.map((p) => {
      const pool =
        chartSectionFilter === 'ALL'
          ? p.items
          : p.items.filter((i) => i.section === chartSectionFilter);
      const awal = pool.reduce((s, i) => s + i.saldoAwal, 0);
      const masuk = pool.reduce((s, i) => s + i.jumlahMasuk, 0);
      const keluar = pool.reduce((s, i) => s + i.jumlahKeluar, 0);
      const akhir = pool.reduce((s, i) => s + i.saldoAkhir, 0);
      const shortLabel = (
        p.tabName ||
        p.periodLabel.replace(/^BULAN\s+/i, '')
      )
        .replace(/\s*2026/i, '')
        .trim();
      return {
        id: p.id,
        label: shortLabel,
        awal,
        masuk,
        keluar,
        akhir,
      };
    });
  }, [workbook.periods, chartSectionFilter]);

  const monthlyComparisonBars = useMemo(
    () =>
      monthlySummarySeries.map((m) => ({
        label: m.label,
        value: m.masuk,
        secondaryValue: m.keluar,
      })),
    [monthlySummarySeries]
  );

  const monthlyBalanceLines = useMemo(
    () =>
      monthlySummarySeries.map((m) => ({
        label: m.label,
        values: {
          saldoAkhir: m.akhir,
          masuk: m.masuk,
          keluar: m.keluar,
        },
      })),
    [monthlySummarySeries]
  );

  const turnoverCumulativeLines = useMemo(
    () =>
      dailyFlowStats.map((d) => ({
        label: String(d.day),
        values: {
          cumMasuk: d.cumMasuk,
          cumKeluar: d.cumKeluar,
          runningBalance: d.runningBalance,
        },
      })),
    [dailyFlowStats]
  );

  const topMaterialComparisonData = useMemo(() => {
    if (!activePeriod) return [];
    const pool =
      chartSectionFilter === 'ALL'
        ? activePeriod.items
        : activePeriod.items.filter((i) => i.section === chartSectionFilter);

    return [...pool]
      .filter((i) => i.jumlahMasuk > 0 || i.jumlahKeluar > 0)
      .sort(
        (a, b) =>
          b.jumlahKeluar + b.jumlahMasuk - (a.jumlahKeluar + a.jumlahMasuk)
      )
      .slice(0, 7)
      .map((item) => ({
        category: item.nama.split(';')[0].slice(0, 14),
        subLabel: item.kode,
        values: {
          awal: item.saldoAwal,
          masuk: item.jumlahMasuk,
          keluar: item.jumlahKeluar,
          akhir: item.saldoAkhir,
        },
      }));
  }, [activePeriod, chartSectionFilter]);

  const turnoverRankingData = useMemo(() => {
    if (!activePeriod) return [];
    const pool =
      chartSectionFilter === 'ALL'
        ? activePeriod.items
        : activePeriod.items.filter((i) => i.section === chartSectionFilter);

    const active = pool.filter((i) => i.jumlahMasuk > 0 || i.jumlahKeluar > 0);
    const sorted = [...active].sort((a, b) => {
      if (turnoverMetric === 'turnover') return b.turnoverRate - a.turnoverRate;
      if (turnoverMetric === 'keluar') return b.jumlahKeluar - a.jumlahKeluar;
      return b.jumlahMasuk - a.jumlahMasuk;
    });

    return sorted.slice(0, 10).map((item) => ({
      label: item.nama,
      subLabel: `${item.section} · ${item.movementClass}`,
      value:
        turnoverMetric === 'turnover'
          ? Number(item.turnoverRate.toFixed(2))
          : turnoverMetric === 'keluar'
          ? item.jumlahKeluar
          : item.jumlahMasuk,
      unit: turnoverMetric === 'turnover' ? 'x' : item.satuan,
      color:
        turnoverMetric === 'masuk'
          ? '#059669'
          : item.movementClass === 'Fast Moving'
          ? '#0284c7'
          : '#d97706',
    }));
  }, [activePeriod, chartSectionFilter, turnoverMetric]);

  const groupComparisonDonut = useMemo(() => {
    if (!activePeriod) return [];
    const appKeluar = activePeriod.items
      .filter((i) => i.section === 'APP')
      .reduce((s, i) => s + i.jumlahKeluar, 0);
    const harKeluar = activePeriod.items
      .filter((i) => i.section === 'HAR')
      .reduce((s, i) => s + i.jumlahKeluar, 0);
    const lainnyaKeluar = activePeriod.items
      .filter((i) => i.section === 'LAINNYA')
      .reduce((s, i) => s + i.jumlahKeluar, 0);

    return [
      { label: 'Kelompok APP (Keluar)', value: appKeluar, color: '#0284c7' },
      { label: 'Kelompok HAR (Keluar)', value: harKeluar, color: '#d97706' },
      ...(lainnyaKeluar > 0
        ? [{ label: 'Lainnya (Keluar)', value: lainnyaKeluar, color: '#64748b' }]
        : []),
    ];
  }, [activePeriod]);

  // Searchable catalog
  const filteredItems = useMemo(() => {
    if (!activePeriod) return [];
    const q = searchQuery.trim().toLowerCase();

    return activePeriod.items.filter((item) => {
      if (searchSection !== 'ALL' && item.section !== searchSection) return false;
      if (searchMovement === 'active' && item.jumlahMasuk === 0 && item.jumlahKeluar === 0) {
        return false;
      }
      if (searchMovement === 'fast' && item.movementClass !== 'Fast Moving') {
        return false;
      }
      if (searchMovement === 'alert') {
        const sim = safetyResultsMap.get(item.id);
        if (
          !sim ||
          (sim.status !== 'kosong' &&
            sim.status !== 'kritis-safety' &&
            sim.status !== 'siaga-reorder')
        ) {
          return false;
        }
      }

      if (!q) return true;
      return (
        item.nama.toLowerCase().includes(q) ||
        item.kode.toLowerCase().includes(q) ||
        item.satuan.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
      );
    });
  }, [activePeriod, searchQuery, searchSection, searchMovement, safetyResultsMap]);

  // Daily Masuk & Keluar transaction ledger
  const filteredDailyLogs = useMemo(() => {
    if (!activePeriod) return [];
    const q = logSearchQuery.trim().toLowerCase();
    return activePeriod.dailyLogs.filter((ev) => {
      if (logTypeFilter !== 'all' && ev.type !== logTypeFilter) return false;
      if (logDayFilter !== 'ALL' && ev.day !== logDayFilter) return false;
      if (!q) return true;
      return (
        ev.nama.toLowerCase().includes(q) ||
        ev.kode.toLowerCase().includes(q) ||
        ev.section.toLowerCase().includes(q)
      );
    });
  }, [activePeriod, logTypeFilter, logDayFilter, logSearchQuery]);

  // Selected item daily timeline
  const selectedItemDailyChart = useMemo(() => {
    if (!selectedItem) return [];
    return selectedItem.daily.map((d) => ({
      label: String(d.day),
      value: d.masuk,
      secondaryValue: d.keluar,
    }));
  }, [selectedItem]);

  const selectedItemDaysBreakdown = useMemo(() => {
    if (!selectedItem) return [];
    let running = selectedItem.saldoAwal;
    const rows = selectedItem.daily.map((d) => {
      running = running + d.masuk - d.keluar;
      return {
        day: d.day,
        masuk: d.masuk,
        keluar: d.keluar,
        saldoAfter: running,
      };
    });
    if (showAllDaysInItemDetail) return rows;
    const nonZero = rows.filter((r) => r.masuk > 0 || r.keluar > 0);
    return nonZero.length > 0 ? nonZero : rows.slice(0, 10);
  }, [selectedItem, showAllDaysInItemDetail]);

  // Selected item safety stock simulation
  const selectedSafetySim = useMemo(() => {
    if (!selectedItem) return null;
    return computeSafetyStockSimulation(selectedItem, simParams);
  }, [selectedItem, simParams]);

  const safetyProjectionLines = useMemo(() => {
    if (!selectedSafetySim) return [];
    return selectedSafetySim.projectedDailyStock.map((pt) => ({
      label: `H+${pt.day}`,
      values: {
        projectedStock: pt.projectedStock,
        reorderPoint: pt.reorderPoint,
        safetyStock: pt.safetyStock,
      },
    }));
  }, [selectedSafetySim]);

  // Safety stock portfolio table sorted by urgency
  const safetyPortfolioRows = useMemo(() => {
    if (!activePeriod) return [];
    const priority: Record<string, number> = {
      kosong: 0,
      'kritis-safety': 1,
      'siaga-reorder': 2,
      aman: 3,
      pasif: 4,
    };

    return activePeriod.items
      .filter((item) => item.jumlahKeluar > 0 || item.jumlahMasuk > 0)
      .map((item) => ({
        item,
        sim: safetyResultsMap.get(item.id) || computeSafetyStockSimulation(item, simParams),
      }))
      .sort(
        (a, b) =>
          (priority[a.sim.status] ?? 9) - (priority[b.sim.status] ?? 9) ||
          b.item.jumlahKeluar - a.item.jumlahKeluar
      );
  }, [activePeriod, safetyResultsMap, simParams]);

  async function handleLoadFromLink() {
    const trimmed = linkInput.trim();
    if (!trimmed) {
      setLinkMessage({
        type: 'error',
        text: 'Tempelkan link Google Sheets atau URL CSV terlebih dahulu.',
      });
      return;
    }

    setLoadingLink(true);
    setLinkMessage(null);
    try {
      const loaded = await fetchMonitoringKbjFromUrl(trimmed);
      setWorkbook(loaded);
      setSelectedPeriodId(
        loaded.defaultPeriodId || loaded.periods[0]?.id || ''
      );
      setSelectedItemId(null);
      setLinkMessage({
        type: 'success',
        text: `Berhasil memuat ${loaded.periods.length} periode dan ${loaded.periods.reduce(
          (s, p) => s + p.items.length,
          0
        )} baris material dari link.`,
      });
    } catch (err) {
      setLinkMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat link CSV.',
      });
    } finally {
      setLoadingLink(false);
    }
  }

  function handleUploadCsvFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseMonitoringKbjCsv(text, `Upload: ${file.name}`);
      if (parsed.periods.length === 0) {
        setLinkMessage({
          type: 'error',
          text: 'Format CSV yang diunggah belum sesuai format Monitoring Harian KBJ (NO, KODE, NAMA MATERIAL).',
        });
        return;
      }
      setWorkbook(parsed);
      setSelectedPeriodId(parsed.periods[0]?.id || '');
      setSelectedItemId(null);
      setLinkMessage({
        type: 'success',
        text: `File "${file.name}" dimuat (${parsed.periods.length} periode).`,
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleResetToAttached() {
    setLinkInput(KBJ_LIVE_SPREADSHEET_URL);
    syncLiveSpreadsheet(true);
  }

  function scrollToSection(sectionId: string) {
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSelectItemAndJump(item: KbjDailyMaterialItem, targetSectionId?: string) {
    setSelectedItemId(item.id);
    if (targetSectionId) {
      scrollToSection(targetSectionId);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Link / CSV Source Bar */}
      <section className="bg-white border border-sky-200/85 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-sky-700 uppercase tracking-wider">
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              <span>
                {activePeriod?.up3Label || 'UP3 MAKASAR SELATAN'} ·{' '}
                {activePeriod?.unitLabel || 'ULP KALEBAJENG'}
              </span>
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 font-display">
              Monitoring Harian Gudang KBJ-Bahagia (Masuk, Keluar &amp; Safety Stok)
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Sumber aktif: <strong className="text-slate-800">{workbook.sourceLabel}</strong> · Pemantauan harian tanggal 1–31 kelompok APP &amp; HAR.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={KBJ_LIVE_SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Spreadsheet</span>
            </a>

            <button
              type="button"
              disabled={loadingLink}
              onClick={() => syncLiveSpreadsheet(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLink ? 'animate-spin' : ''}`} />
              <span>{loadingLink ? 'Menyinkronkan...' : 'Muat Ulang Live'}</span>
            </button>

            {activePeriod && (
              <button
                type="button"
                onClick={() => exportMonitoringKbjToCSV(activePeriod, simParams)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-amber-300/90 hover:bg-amber-400 border border-amber-400 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Monthly Tab Switcher (JAN 2026 – NOV 2026) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {workbook.periods.map((period) => {
            const active = period.id === activePeriod?.id;
            return (
              <button
                key={period.id}
                type="button"
                onClick={() => {
                  setSelectedPeriodId(period.id);
                  setSelectedItemId(null);
                  setLogDayFilter('ALL');
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  active
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-sky-50/70 text-slate-700 border-sky-200 hover:bg-sky-100/80'
                }`}
              >
                {period.tabName || period.periodLabel} ({period.items.length})
              </button>
            );
          })}
        </div>

        {/* Link Input + Upload CSV + Reset */}
        <div className="pt-3 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center gap-2.5">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Tempel link Google Sheets atau URL CSV publik untuk muat data terbaru..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              disabled={loadingLink}
              onClick={handleLoadFromLink}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 transition-colors shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLink ? 'animate-spin' : ''}`} />
              <span>{loadingLink ? 'Memuat Link...' : 'Muat dari Link'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleUploadCsvFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-sky-700" />
              <span>Unggah CSV</span>
            </button>
            <button
              type="button"
              onClick={handleResetToAttached}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Spreadsheet Live</span>
            </button>
          </div>
        </div>

        {linkMessage && (
          <div
            className={`px-3.5 py-2 rounded-lg border text-xs flex items-center gap-2 ${
              linkMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {linkMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{linkMessage.text}</span>
          </div>
        )}

        {/* Quick Section Jump Bar (1 Unified Menu) */}
        <div className="pt-2 flex flex-wrap items-center gap-1.5">
          {[
            { target: 'section-charts', label: 'Grafik Perbandingan & Perputaran' },
            { target: 'section-search', label: 'Pencarian Material per Item' },
            { target: 'section-detail', label: 'Detail Masuk & Keluar' },
            { target: 'section-safety', label: 'Simulasi Safety Stok' },
          ].map((item) => (
            <button
              key={item.target}
              type="button"
              onClick={() => scrollToSection(item.target)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-sky-50/70 text-sky-900 border-sky-200 hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 6-Card KPI Summary Strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Total Item Material
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {portfolioSummary.totalItems}
          </div>
          <div className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
            APP {portfolioSummary.appCount} · HAR {portfolioSummary.harCount}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            {activePeriod?.saldoAwalLabel || 'Saldo Awal'}
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatIdNum(portfolioSummary.totalAwal, 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Total unit awal periode
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wide flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Material Masuk</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            +{formatIdNum(portfolioSummary.totalMasuk, 0)}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Penerimaan hari 1–31
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-amber-800 uppercase tracking-wide flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Material Keluar</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-700">
            -{formatIdNum(portfolioSummary.totalKeluar, 0)}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {portfolioSummary.fastMovingCount} item Fast Moving
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-sky-800 uppercase tracking-wide flex items-center gap-1">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>{activePeriod?.saldoAkhirLabel || 'Saldo Akhir'}</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-sky-700">
            {formatIdNum(portfolioSummary.totalAkhir, 0)}
          </div>
          <div className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
            {portfolioSummary.activeCount} item bermutasi
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollToSection('section-safety')}
          className="text-left bg-white border border-rose-200 hover:border-rose-400 rounded-xl p-4 shadow-2xs transition-colors"
        >
          <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wide flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Siaga Safety Stok</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-rose-600">
            {portfolioSummary.alertSafetyCount}
          </div>
          <div className="mt-1 text-xs text-rose-700 font-medium">
            Item perlu reorder / kritis →
          </div>
        </button>
      </section>

      {/* SECTION 1: GRAFIK PERBANDINGAN & GRAFIK PERPUTARAN */}
      <section id="section-charts" className="space-y-4 scroll-mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <span>Grafik Perbandingan &amp; Perputaran Material Keluar Masuk</span>
              </h2>
              <p className="text-xs text-slate-500">
                Visualisasi tren harian tanggal 1–31, kurva perputaran kumulatif, dan peringkat perputaran material.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {(['ALL', 'APP', 'HAR'] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setChartSectionFilter(sec)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    chartSectionFilter === sec
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                  }`}
                >
                  {sec === 'ALL' ? 'Semua (APP + HAR)' : `Kelompok ${sec}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Daily Comparison: Masuk vs Keluar Day 1..31 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Grafik Perbandingan Masuk vs Keluar Harian (Tgl 1–31)
                </h3>
                <p className="text-xs text-slate-500">
                  Volume material masuk dibandingkan pemakaian keluar setiap tanggal.
                </p>
              </div>
              <VerticalBarChart
                data={dailyComparisonBars}
                primaryLabel="Material Masuk"
                secondaryLabel="Material Keluar"
                primaryColor="#059669"
                secondaryColor="#d97706"
                height={230}
                unit="unit"
                ariaLabel="Grafik perbandingan harian material masuk dan keluar tanggal 1 sampai 31"
              />
            </div>

            {/* Turnover Curve: Cumulative Masuk vs Cumulative Keluar vs Running Balance */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                  <span>Grafik Perputaran &amp; Arus Kumulatif Harian (Tgl 1–31)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Akumulasi perputaran masuk, keluar, dan kurva saldo gudang harian.
                </p>
              </div>
              <MultiLineChart
                data={turnoverCumulativeLines}
                series={[
                  { key: 'cumMasuk', label: 'Kumulatif Masuk', color: '#059669' },
                  { key: 'cumKeluar', label: 'Kumulatif Keluar', color: '#d97706' },
                  {
                    key: 'runningBalance',
                    label: 'Saldo Berjalan',
                    color: '#0284c7',
                    dashed: true,
                  },
                ]}
                height={230}
                unit="unit"
                decimals={0}
                ariaLabel="Grafik perputaran kumulatif material masuk dan keluar"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Top Material Grouped Comparison */}
            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Perbandingan Saldo Awal, Masuk, Keluar &amp; Saldo Akhir (Top Material Aktif)
                </h3>
                <p className="text-xs text-slate-500">
                  Perbandingan komposisi stok untuk 7 material dengan volume mutasi tertinggi.
                </p>
              </div>
              <GroupedBarChart
                data={topMaterialComparisonData}
                series={[
                  { key: 'awal', label: 'Saldo Awal', color: '#64748b' },
                  { key: 'masuk', label: 'Masuk', color: '#059669' },
                  { key: 'keluar', label: 'Keluar', color: '#d97706' },
                  { key: 'akhir', label: 'Saldo Akhir', color: '#0284c7' },
                ]}
                height={250}
                unitLabel="unit"
                ariaLabel="Grafik perbandingan top material aktif"
              />
            </div>

            {/* APP vs HAR Donut Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Proporsi Pemakaian per Kelompok
                </h3>
                <p className="text-xs text-slate-500">
                  Distribusi volume keluar antara kelompok APP dan HAR.
                </p>
              </div>
              <DonutChart
                segments={groupComparisonDonut}
                centerTitle="Total Keluar"
                centerValue={formatIdNum(portfolioSummary.totalKeluar, 0)}
                ariaLabel="Proporsi pemakaian material APP dan HAR"
              />
            </div>
          </div>

          {/* Turnover Rate Ranking */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-sky-600" />
                  <span>Peringkat Perputaran Material (Turnover Rate)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Rasio perputaran = Jumlah Keluar ÷ Rata-rata Stok (semakin tinggi berarti semakin cepat habis/berputar).
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'turnover' as const, label: 'Rasio Perputaran (x)' },
                  { id: 'keluar' as const, label: 'Volume Keluar' },
                  { id: 'masuk' as const, label: 'Volume Masuk' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTurnoverMetric(m.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      turnoverMetric === m.id
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <HorizontalBarChart
              data={turnoverRankingData}
              emptyText="Belum ada material bermutasi pada kelompok yang dipilih."
            />
          </div>

          {monthlySummarySeries.length > 1 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Perbandingan Material Masuk vs Keluar Antar Bulan (JAN–NOV 2026)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rekap total penerimaan dan pemakaian material per bulan dari seluruh tab spreadsheet.
                  </p>
                </div>
                <VerticalBarChart
                  data={monthlyComparisonBars}
                  primaryLabel="Total Masuk"
                  secondaryLabel="Total Keluar"
                  primaryColor="#059669"
                  secondaryColor="#d97706"
                  height={220}
                  unit="unit"
                  ariaLabel="Grafik perbandingan material masuk dan keluar antar bulan 2026"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-sky-600" />
                    <span>Tren Saldo Akhir &amp; Mutasi Bulanan (JAN–NOV 2026)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kurva pergerakan saldo akhir gudang terhadap arus masuk dan keluar setiap bulan.
                  </p>
                </div>
                <MultiLineChart
                  data={monthlyBalanceLines}
                  series={[
                    { key: 'masuk', label: 'Masuk Bulanan', color: '#059669' },
                    { key: 'keluar', label: 'Keluar Bulanan', color: '#d97706' },
                    {
                      key: 'saldoAkhir',
                      label: 'Saldo Akhir Bulan',
                      color: '#0284c7',
                      dashed: true,
                    },
                  ]}
                  height={220}
                  unit="unit"
                  decimals={0}
                  ariaLabel="Grafik tren saldo akhir dan mutasi bulanan 2026"
                />
              </div>
            </div>
          )}
        </section>

      {/* SECTION 2: DAFTAR PENCARIAN MATERIAL PER ITEM + DETAIL HARIAN ITEM */}
      <section id="section-search" className="grid grid-cols-1 xl:grid-cols-12 gap-4 scroll-mt-4">
          {/* Left: Searchable Item Catalog */}
          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-sky-600" />
                  <span>Daftar Pencarian Material per Item</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Cari kode, nama material, atau satuan. Klik baris item untuk lihat rincian harian 1–31 &amp; simulasi safety stok.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-sky-700">
                {filteredItems.length} / {activePeriod?.items.length || 0} item
              </span>
            </div>

            {/* Search & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode (mis. 3250099), MCB, NFA2X, kWH..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  aria-label="Filter kelompok material"
                  value={searchSection}
                  onChange={(e) =>
                    setSearchSection(e.target.value as 'ALL' | KbjSectionGroup)
                  }
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value="ALL">Semua Kelompok</option>
                  <option value="APP">Kelompok APP</option>
                  <option value="HAR">Kelompok HAR</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  aria-label="Filter status pergerakan"
                  value={searchMovement}
                  onChange={(e) =>
                    setSearchMovement(e.target.value as SearchMovementFilter)
                  }
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value="all">Semua Kondisi</option>
                  <option value="active">Hanya Bermutasi</option>
                  <option value="fast">Fast Moving</option>
                  <option value="alert">Siaga Safety Stok</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[520px] border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Kode / Kel.</th>
                    <th className="py-2.5 px-3 font-semibold">Nama Material</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right">Awal</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right text-emerald-700">
                      Masuk
                    </th>
                    <th className="py-2.5 px-2.5 font-semibold text-right text-amber-700">
                      Keluar
                    </th>
                    <th className="py-2.5 px-2.5 font-semibold text-right text-sky-700">
                      Akhir
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Status Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-xs text-slate-500"
                      >
                        Tidak ada material yang cocok dengan pencarian Anda.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const sim = safetyResultsMap.get(item.id);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => handleSelectItemAndJump(item)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-sky-50/90'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-slate-800">
                              {item.kode}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {item.section} · {item.satuan}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 min-w-[190px]">
                            <div className="font-medium text-slate-900 leading-snug">
                              {item.nama}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                              Putaran {item.turnoverRate.toFixed(2)}x · {item.movementClass}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-600">
                            {formatIdNum(item.saldoAwal, 0)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                            {item.jumlahMasuk > 0
                              ? `+${formatIdNum(item.jumlahMasuk, 0)}`
                              : '0'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-amber-700">
                            {item.jumlahKeluar > 0
                              ? `-${formatIdNum(item.jumlahKeluar, 0)}`
                              : '0'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatIdNum(item.saldoAkhir, 0)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {sim && (
                              <span
                                className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${getSafetyBadgeClasses(
                                  sim.status
                                )}`}
                              >
                                {sim.statusLabel}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Selected Item Daily Detail (Tgl 1-31) */}
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            {selectedItem ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-sky-700 font-semibold">
                      {selectedItem.section} · KODE {selectedItem.kode} ({selectedItem.satuan})
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                      {selectedItem.nama}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollToSection('section-safety')}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Simulasi Safety</span>
                  </button>
                </div>

                {/* Item Summary Numbers */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Awal</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-800">
                      {formatIdNum(selectedItem.saldoAwal, 0)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                    <div className="text-[10px] text-emerald-700 uppercase">Masuk</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                      +{formatIdNum(selectedItem.jumlahMasuk, 0)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200">
                    <div className="text-[10px] text-amber-800 uppercase">Keluar</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-amber-700">
                      -{formatIdNum(selectedItem.jumlahKeluar, 0)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-sky-50/80 border border-sky-200">
                    <div className="text-[10px] text-sky-800 uppercase">Akhir</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-sky-800">
                      {formatIdNum(selectedItem.saldoAkhir, 0)}
                    </div>
                  </div>
                </div>

                {/* Item Daily 1-31 Bar Chart */}
                <div className="pt-1">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Pergerakan Harian Tanggal 1–31 Item Terpilih
                  </div>
                  <VerticalBarChart
                    data={selectedItemDailyChart}
                    primaryLabel="Masuk"
                    secondaryLabel="Keluar"
                    primaryColor="#059669"
                    secondaryColor="#d97706"
                    height={175}
                    unit={selectedItem.satuan}
                    ariaLabel={`Grafik harian item ${selectedItem.nama}`}
                  />
                </div>

                {/* Daily Log Rows for Selected Item */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Rincian Tanggal Aktif ({selectedItem.activeDaysMasuk} masuk /{' '}
                      {selectedItem.activeDaysKeluar} keluar)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllDaysInItemDetail((v) => !v)}
                      className="text-xs font-medium text-sky-700 hover:underline"
                    >
                      {showAllDaysInItemDetail ? 'Hanya Tgl Bermutasi' : 'Tampilkan 31 Hari'}
                    </button>
                  </div>

                  <div className="max-h-[210px] overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="py-2 px-2.5 font-semibold">Tgl</th>
                          <th className="py-2 px-2.5 font-semibold text-right text-emerald-700">
                            Masuk
                          </th>
                          <th className="py-2 px-2.5 font-semibold text-right text-amber-700">
                            Keluar
                          </th>
                          <th className="py-2 px-2.5 font-semibold text-right text-sky-700">
                            Saldo Berjalan
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                        {selectedItemDaysBreakdown.map((row) => (
                          <tr key={row.day}>
                            <td className="py-1.5 px-2.5 text-slate-700 font-semibold">
                              Tanggal {row.day}
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-emerald-700">
                              {row.masuk > 0 ? `+${formatIdNum(row.masuk, 0)}` : '—'}
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-amber-700">
                              {row.keluar > 0 ? `-${formatIdNum(row.keluar, 0)}` : '—'}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-semibold text-slate-900">
                              {formatIdNum(row.saldoAfter, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                Pilih item material dari daftar untuk melihat rincian harian.
              </div>
            )}
          </div>
        </section>

      {/* SECTION 3: DETAIL MATERIAL KELUAR DAN MASUK (LOG HARIAN) */}
      <section id="section-detail" className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 scroll-mt-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-sky-600" />
                <span>Detail Transaksi Material Keluar &amp; Masuk (Tgl 1–31)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Rekaman seluruh mutasi harian masuk dan keluar per tanggal beserta saldo setelah transaksi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Cari item di log..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <select
                aria-label="Filter tipe transaksi harian"
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value as LogTypeFilter)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">Semua (Masuk &amp; Keluar)</option>
                <option value="masuk">Hanya Material Masuk</option>
                <option value="keluar">Hanya Material Keluar</option>
              </select>

              <select
                aria-label="Filter tanggal transaksi"
                value={logDayFilter}
                onChange={(e) =>
                  setLogDayFilter(
                    e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                  )
                }
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="ALL">Semua Tanggal (1–31)</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tanggal {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                  <th className="py-2.5 px-3 font-semibold">Kelompok</th>
                  <th className="py-2.5 px-3 font-semibold">Kode</th>
                  <th className="py-2.5 px-3 font-semibold">Nama Material</th>
                  <th className="py-2.5 px-3 font-semibold">Arah Mutasi</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Volume</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Saldo Setelah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDailyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      Tidak ada transaksi masuk/keluar pada filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredDailyLogs.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                        Tanggal {ev.day}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">{ev.section}</td>
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                        {ev.kode}
                      </td>
                      <td className="py-2 px-3 text-slate-900 font-medium">{ev.nama}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {ev.type === 'masuk' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                            <ArrowDownLeft className="w-3 h-3" />
                            Masuk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                            <ArrowUpRight className="w-3 h-3" />
                            Keluar
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          ev.type === 'masuk' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {ev.type === 'masuk' ? '+' : '-'}
                        {formatIdNum(ev.qty, 0)} {ev.satuan}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                        {formatIdNum(ev.runningSaldoAfter, 0)} {ev.satuan}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      {/* SECTION 4: SIMULASI SAFETY STOK INTERAKTIF */}
      <section id="section-safety" className="space-y-4 scroll-mt-4">
          <div className="bg-white border border-sky-200 rounded-xl p-5 shadow-2xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                  <span>Simulasi Safety Stok &amp; Reorder Point (ROP)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menghitung cadangan pengaman (Safety Stock = kombinasi statistik Z · σ · √L dan lonjakan harian) serta proyeksi ketahanan stok 30 hari.
                </p>
              </div>

              {/* Quick Demand Scenario Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'Normal (100%)', pct: 100 },
                  { label: 'Pasang Baru (+30%)', pct: 130 },
                  { label: 'Siaga Gangguan (+50%)', pct: 150 },
                ].map((preset) => (
                  <button
                    key={preset.pct}
                    type="button"
                    onClick={() =>
                      setSimParams((prev) => ({
                        ...prev,
                        demandMultiplierPct: preset.pct,
                      }))
                    }
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      simParams.demandMultiplierPct === preset.pct
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-sky-50/70 text-slate-700 border-sky-200 hover:bg-sky-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulator Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 rounded-xl bg-sky-50/50 border border-sky-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Material yang Disimulasikan
                </label>
                <select
                  aria-label="Pilih material untuk simulasi safety stok"
                  value={selectedItem?.id || ''}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  {activePeriod?.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.section}] {item.kode} — {item.nama} (Akhir: {item.saldoAkhir})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span>Lead Time Pengadaan</span>
                  <span className="font-mono tabular-nums text-sky-700">
                    {simParams.leadTimeDays} hari
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={simParams.leadTimeDays}
                  onChange={(e) =>
                    setSimParams((prev) => ({
                      ...prev,
                      leadTimeDays: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                  <span>1 hr</span>
                  <span>15 hr</span>
                  <span>30 hr</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tingkat Layanan (Service Level Z)
                </label>
                <select
                  aria-label="Tingkat layanan safety stok"
                  value={simParams.zScore}
                  onChange={(e) =>
                    setSimParams((prev) => ({
                      ...prev,
                      zScore: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value={1.28}>90% (Z = 1,28 · Standar)</option>
                  <option value={1.65}>95% (Z = 1,65 · Rekomendasi PLN)</option>
                  <option value={2.05}>98% (Z = 2,05 · Siaga Tinggi)</option>
                  <option value={2.33}>99% (Z = 2,33 · Anti-Kosong)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span>Skenario Kebutuhan</span>
                  <span className="font-mono tabular-nums text-amber-700">
                    {simParams.demandMultiplierPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={200}
                  step={5}
                  value={simParams.demandMultiplierPct}
                  onChange={(e) =>
                    setSimParams((prev) => ({
                      ...prev,
                      demandMultiplierPct: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                  <span>70%</span>
                  <span>100% (Normal)</span>
                  <span>200%</span>
                </div>
              </div>
            </div>

            {selectedItem && selectedSafetySim && (
              <>
                {/* Selected Item Simulation KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Stok Aktual Saat Ini</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                      {formatIdNum(selectedItem.saldoAkhir, 0)}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {selectedItem.satuan}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Pemakaian Simulasi/Hr</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                      {formatIdNum(selectedSafetySim.adjustedDailyUsage, 2)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Puncak: {formatIdNum(selectedSafetySim.maxDailyUsage, 0)}/hr
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200">
                    <div className="text-[11px] font-semibold text-rose-700">
                      Safety Stock
                    </div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-700">
                      {formatIdNum(selectedSafetySim.recommendedSafetyStock, 0)}{' '}
                      <span className="text-xs font-normal">{selectedItem.satuan}</span>
                    </div>
                    <div className="text-[10px] text-rose-600 font-mono">
                      Stat: {selectedSafetySim.safetyStockStat} · MinMax:{' '}
                      {selectedSafetySim.safetyStockMinMax}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                    <div className="text-[11px] font-semibold text-amber-800">
                      Reorder Point (ROP)
                    </div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-800">
                      {formatIdNum(selectedSafetySim.reorderPoint, 0)}{' '}
                      <span className="text-xs font-normal">{selectedItem.satuan}</span>
                    </div>
                    <div className="text-[10px] text-amber-700 font-mono">
                      Target Max: {formatIdNum(selectedSafetySim.targetMaxStock, 0)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
                    <div className="text-[11px] font-semibold text-sky-800">
                      Ketahanan Stok
                    </div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-sky-800">
                      {selectedSafetySim.daysOfSupply !== null
                        ? `${selectedSafetySim.daysOfSupply.toFixed(1)} hr`
                        : 'Pasif'}
                    </div>
                    <div className="text-[10px] text-sky-700 font-mono">
                      Lead time: {simParams.leadTimeDays} hr
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] text-slate-500">Status &amp; Saran Order</div>
                    <div className="mt-1">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-bold border rounded ${getSafetyBadgeClasses(
                          selectedSafetySim.status
                        )}`}
                      >
                        {selectedSafetySim.statusLabel}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-700">
                      {selectedSafetySim.shortfallToRop > 0
                        ? `Order min: +${formatIdNum(selectedSafetySim.shortfallToRop, 0)} ${selectedItem.satuan}`
                        : 'Belum perlu order'}
                    </div>
                  </div>
                </div>

                {/* 30-Day Depletion Simulation Chart */}
                <div className="pt-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Simulasi Proyeksi Penurunan Stok 30 Hari ke Depan ({selectedItem.nama})
                    </h3>
                    <span className="text-xs font-mono text-slate-500">
                      Jika tidak ada penerimaan baru selama 30 hari
                    </span>
                  </div>
                  <MultiLineChart
                    data={safetyProjectionLines}
                    series={[
                      {
                        key: 'projectedStock',
                        label: 'Proyeksi Sisa Stok',
                        color: '#0284c7',
                      },
                      {
                        key: 'reorderPoint',
                        label: 'Ambang Reorder Point (ROP)',
                        color: '#d97706',
                        dashed: true,
                      },
                      {
                        key: 'safetyStock',
                        label: 'Batas Safety Stock',
                        color: '#dc2626',
                        dashed: true,
                      },
                    ]}
                    height={230}
                    unit={selectedItem.satuan}
                    decimals={1}
                    ariaLabel="Grafik simulasi proyeksi penurunan stok 30 hari"
                  />
                </div>
              </>
            )}
          </div>

          {/* All Active Materials Safety Stock Recommendation Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Matriks Rekomendasi Safety Stok Seluruh Material Bermutasi
                </h3>
                <p className="text-xs text-slate-500">
                  Diurutkan otomatis dari kondisi paling kritis. Klik baris untuk mensimulasikan item tersebut.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                {safetyPortfolioRows.length} material aktif
              </span>
            </div>

            <div className="overflow-x-auto max-h-[420px] border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Kode / Kel.</th>
                    <th className="py-2.5 px-3 font-semibold">Nama Material</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right">Saldo Akhir</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right">Rata²/Hari</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right text-rose-700">
                      Safety Stock
                    </th>
                    <th className="py-2.5 px-2.5 font-semibold text-right text-amber-800">
                      ROP
                    </th>
                    <th className="py-2.5 px-2.5 font-semibold text-right">Ketahanan</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right text-sky-700">
                      Saran Order
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {safetyPortfolioRows.map(({ item, sim }) => {
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50/90' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{item.kode}</span>{' '}
                          <span className="text-slate-400">· {item.section}</span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {item.nama}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatIdNum(item.saldoAkhir, 0)} {item.satuan}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-600">
                          {formatIdNum(sim.adjustedDailyUsage, 2)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-rose-700">
                          {formatIdNum(sim.recommendedSafetyStock, 0)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-amber-800">
                          {formatIdNum(sim.reorderPoint, 0)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-700">
                          {sim.daysOfSupply !== null ? `${sim.daysOfSupply.toFixed(1)} hr` : 'Pasif'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-sky-700">
                          {sim.shortfallToRop > 0
                            ? `+${formatIdNum(sim.shortfallToRop, 0)}`
                            : '0'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${getSafetyBadgeClasses(
                              sim.status
                            )}`}
                          >
                            {sim.statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
    </div>
  );
}
