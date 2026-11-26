import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Download,
  ExternalLink,
  Link2,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeSafetyStockSimulation,
  exportPeriodToCSV,
  fetchWarehouseMonthTab,
  MaterialGroup,
  SafetyStockParams,
  WAREHOUSE_MONTH_TABS,
  WAREHOUSE_SPREADSHEET_EDIT_URL,
  WarehouseMaterialItem,
  WarehousePeriodData,
} from '../services/warehouseSheetService';
import {
  DonutChart,
  GroupedBarChart,
  HorizontalBarChart,
  MultiLineChart,
  VerticalBarChart,
} from './Charts';

type GroupFilter = 'ALL' | 'APP' | 'HAR';
type TurnoverMetric = 'turnover' | 'keluar' | 'masuk';
type SearchMovementFilter = 'all' | 'active' | 'fast' | 'alert';
type LogTypeFilter = 'all' | 'masuk' | 'keluar';

function formatIdNum(val: number, maxDecimals = 2): string {
  return val.toLocaleString('id-ID', { maximumFractionDigits: maxDecimals });
}

function getSafetyStatusClasses(
  status: 'aman' | 'siaga-reorder' | 'kritis-safety' | 'kosong' | 'pasif'
): string {
  switch (status) {
    case 'kosong':
      return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800';
    case 'kritis-safety':
      return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800';
    case 'siaga-reorder':
      return 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800';
    case 'aman':
      return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800';
    case 'pasif':
    default:
      return 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  }
}

interface WarehouseDashboardProps {
  initialSection?: string;
}

export function WarehouseDashboard({ initialSection }: WarehouseDashboardProps = {}) {
  // Default to OKT2026 (gid=410640151) from the user's spreadsheet link
  const [selectedGid, setSelectedGid] = useState<string>('410640151');
  const [periodsByGid, setPeriodsByGid] = useState<
    Record<string, WarehousePeriodData>
  >({});
  const [loadingPrimary, setLoadingPrimary] = useState<boolean>(true);
  const [loadingYearly, setLoadingYearly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Optional custom link loader
  const [customLink, setCustomLink] = useState('');
  const [linkStatus, setLinkStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Chart & filter states
  const [chartGroupFilter, setChartGroupFilter] = useState<GroupFilter>('ALL');
  const [turnoverMetric, setTurnoverMetric] =
    useState<TurnoverMetric>('turnover');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchGroup, setSearchGroup] = useState<'ALL' | MaterialGroup>('ALL');
  const [searchMovement, setSearchMovement] =
    useState<SearchMovementFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showAllDays, setShowAllDays] = useState(false);

  const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>('all');
  const [logDayFilter, setLogDayFilter] = useState<number | 'ALL'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const [simParams, setSimParams] = useState<SafetyStockParams>({
    leadTimeDays: 7,
    zScore: 1.65,
    demandMultiplierPct: 100,
  });

  const loadMonth = useCallback(async (gidOrUrl: string) => {
    setLoadingPrimary(true);
    setError(null);
    try {
      const matchedTab = WAREHOUSE_MONTH_TABS.find((t) => t.gid === gidOrUrl);
      const parsed = await fetchWarehouseMonthTab(matchedTab || gidOrUrl);
      setPeriodsByGid((prev) => ({
        ...prev,
        [parsed.tab.gid]: parsed,
      }));
      setSelectedGid(parsed.tab.gid);
      setSelectedItemId(null);
      return parsed;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data dari Google Spreadsheet.'
      );
      return null;
    } finally {
      setLoadingPrimary(false);
    }
  }, []);

  const loadAllMonthsInBackground = useCallback(async () => {
    setLoadingYearly(true);
    try {
      const results = await Promise.allSettled(
        WAREHOUSE_MONTH_TABS.map((tab) => fetchWarehouseMonthTab(tab))
      );
      const nextMap: Record<string, WarehousePeriodData> = {};
      for (const res of results) {
        if (res.status === 'fulfilled') {
          nextMap[res.value.tab.gid] = res.value;
        }
      }
      setPeriodsByGid((prev) => ({ ...prev, ...nextMap }));
    } finally {
      setLoadingYearly(false);
    }
  }, []);

  useEffect(() => {
    loadMonth('410640151').then(() => {
      loadAllMonthsInBackground();
    });
  }, [loadMonth, loadAllMonthsInBackground]);

  const activePeriod: WarehousePeriodData | null =
    periodsByGid[selectedGid] || null;

  useEffect(() => {
    if (!initialSection || !activePeriod) return;
    const timer = window.setTimeout(() => {
      document.getElementById(initialSection)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [initialSection, activePeriod]);

  function handleSelectMonthTab(gid: string) {
    setSelectedGid(gid);
    setSelectedItemId(null);
    setLogDayFilter('ALL');
    if (!periodsByGid[gid]) {
      loadMonth(gid);
    }
  }

  async function handleLoadCustomLink() {
    const trimmed = customLink.trim();
    if (!trimmed) {
      setLinkStatus({
        type: 'error',
        text: 'Tempelkan URL Google Spreadsheet terlebih dahulu.',
      });
      return;
    }
    setLinkStatus(null);
    const loaded = await loadMonth(trimmed);
    if (loaded) {
      setLinkStatus({
        type: 'success',
        text: `Berhasil menyinkronkan ${loaded.periodLabel} (${loaded.items.length} item material).`,
      });
    }
  }

  const safetyResultsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeSafetyStockSimulation>>();
    if (!activePeriod) return map;
    for (const item of activePeriod.items) {
      map.set(item.id, computeSafetyStockSimulation(item, simParams));
    }
    return map;
  }, [activePeriod, simParams]);

  const selectedItem = useMemo<WarehouseMaterialItem | null>(() => {
    if (!activePeriod || activePeriod.items.length === 0) return null;
    if (selectedItemId) {
      const found = activePeriod.items.find((i) => i.id === selectedItemId);
      if (found) return found;
    }
    const topActive = [...activePeriod.items]
      .filter((i) => i.jumlahKeluar > 0 || i.jumlahMasuk > 0)
      .sort(
        (a, b) =>
          b.activeDaysKeluar - a.activeDaysKeluar ||
          b.jumlahKeluar - a.jumlahKeluar
      );
    return topActive[0] || activePeriod.items[0];
  }, [activePeriod, selectedItemId]);

  const summary = useMemo(() => {
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
      if (item.group === 'APP') appCount++;
      if (item.group === 'HAR') harCount++;
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

  // Daily chart points (Days 1..31)
  const dailyFlowStats = useMemo(() => {
    if (!activePeriod) return [];
    const pool =
      chartGroupFilter === 'ALL'
        ? activePeriod.items
        : activePeriod.items.filter((i) => i.group === chartGroupFilter);

    const startBalance = pool.reduce((s, i) => s + i.saldoAwal, 0);
    let cumMasuk = 0;
    let cumKeluar = 0;
    let runningBalance = startBalance;

    return Array.from({ length: 31 }, (_, idx) => {
      const day = idx + 1;
      let masuk = 0;
      let keluar = 0;
      for (const item of pool) {
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
  }, [activePeriod, chartGroupFilter]);

  const dailyComparisonBars = useMemo(
    () =>
      dailyFlowStats.map((d) => ({
        label: String(d.day),
        value: d.masuk,
        secondaryValue: d.keluar,
      })),
    [dailyFlowStats]
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
      chartGroupFilter === 'ALL'
        ? activePeriod.items
        : activePeriod.items.filter((i) => i.group === chartGroupFilter);

    return [...pool]
      .filter((i) => i.jumlahMasuk > 0 || i.jumlahKeluar > 0)
      .sort(
        (a, b) =>
          b.jumlahKeluar + b.jumlahMasuk - (a.jumlahKeluar + a.jumlahMasuk)
      )
      .slice(0, 7)
      .map((item) => ({
        category: item.nama.split(';').slice(0, 2).join(' ').slice(0, 14),
        subLabel: item.kode,
        values: {
          awal: item.saldoAwal,
          masuk: item.jumlahMasuk,
          keluar: item.jumlahKeluar,
          akhir: item.saldoAkhir,
        },
      }));
  }, [activePeriod, chartGroupFilter]);

  const groupComparisonDonut = useMemo(() => {
    if (!activePeriod) return [];
    const appKeluar = activePeriod.items
      .filter((i) => i.group === 'APP')
      .reduce((s, i) => s + i.jumlahKeluar, 0);
    const harKeluar = activePeriod.items
      .filter((i) => i.group === 'HAR')
      .reduce((s, i) => s + i.jumlahKeluar, 0);
    return [
      { label: 'Kelompok APP (Keluar)', value: appKeluar, color: '#0284c7' },
      { label: 'Kelompok HAR (Keluar)', value: harKeluar, color: '#d97706' },
    ];
  }, [activePeriod]);

  const turnoverRankingData = useMemo(() => {
    if (!activePeriod) return [];
    const pool =
      chartGroupFilter === 'ALL'
        ? activePeriod.items
        : activePeriod.items.filter((i) => i.group === chartGroupFilter);

    const active = pool.filter((i) => i.jumlahMasuk > 0 || i.jumlahKeluar > 0);
    const sorted = [...active].sort((a, b) => {
      if (turnoverMetric === 'turnover') return b.turnoverRate - a.turnoverRate;
      if (turnoverMetric === 'keluar') return b.jumlahKeluar - a.jumlahKeluar;
      return b.jumlahMasuk - a.jumlahMasuk;
    });

    return sorted.slice(0, 10).map((item) => ({
      label: item.nama,
      subLabel: `${item.group} · ${item.movementClass}`,
      value:
        turnoverMetric === 'turnover'
          ? Number(item.turnoverRate.toFixed(2))
          : turnoverMetric === 'keluar'
          ? item.jumlahKeluar
          : item.jumlahMasuk,
      unit: turnoverMetric === 'turnover' ? 'x' : item.satuan,
      color:
        turnoverMetric === 'masuk'
          ? '#16a34a'
          : item.movementClass === 'Fast Moving'
          ? '#0284c7'
          : '#d97706',
    }));
  }, [activePeriod, chartGroupFilter, turnoverMetric]);

  // Multi-month 2026 trend data (JAN..NOV 2026)
  const yearlyTrendData = useMemo(() => {
    return WAREHOUSE_MONTH_TABS.map((tab) => {
      const p = periodsByGid[tab.gid];
      if (!p) return null;
      const masuk = p.items.reduce((s, i) => s + i.jumlahMasuk, 0);
      const keluar = p.items.reduce((s, i) => s + i.jumlahKeluar, 0);
      const akhir = p.items.reduce((s, i) => s + i.saldoAkhir, 0);
      const awal = p.items.reduce((s, i) => s + i.saldoAwal, 0);
      return {
        tab,
        masuk,
        keluar,
        awal,
        akhir,
        activeItems: p.items.filter(
          (i) => i.jumlahMasuk > 0 || i.jumlahKeluar > 0
        ).length,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [periodsByGid]);

  const yearlyBars = useMemo(
    () =>
      yearlyTrendData.map((m) => ({
        label: m.tab.shortLabel,
        value: m.masuk,
        secondaryValue: m.keluar,
      })),
    [yearlyTrendData]
  );

  const yearlyLines = useMemo(
    () =>
      yearlyTrendData.map((m) => ({
        label: m.tab.shortLabel,
        values: {
          saldoAkhir: m.akhir,
          masuk: m.masuk,
          keluar: m.keluar,
        },
      })),
    [yearlyTrendData]
  );

  // Searchable table items
  const filteredItems = useMemo(() => {
    if (!activePeriod) return [];
    const q = searchQuery.trim().toLowerCase();
    return activePeriod.items.filter((item) => {
      if (searchGroup !== 'ALL' && item.group !== searchGroup) return false;
      if (
        searchMovement === 'active' &&
        item.jumlahMasuk === 0 &&
        item.jumlahKeluar === 0
      ) {
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
        item.group.toLowerCase().includes(q)
      );
    });
  }, [
    activePeriod,
    searchQuery,
    searchGroup,
    searchMovement,
    safetyResultsMap,
  ]);

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
    if (showAllDays) return rows;
    const nonZero = rows.filter((r) => r.masuk > 0 || r.keluar > 0);
    return nonZero.length > 0 ? nonZero : rows.slice(0, 10);
  }, [selectedItem, showAllDays]);

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
        ev.group.toLowerCase().includes(q)
      );
    });
  }, [activePeriod, logTypeFilter, logDayFilter, logSearchQuery]);

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
        sim:
          safetyResultsMap.get(item.id) ||
          computeSafetyStockSimulation(item, simParams),
      }))
      .sort(
        (a, b) =>
          (priority[a.sim.status] ?? 9) - (priority[b.sim.status] ?? 9) ||
          b.item.jumlahKeluar - a.item.jumlahKeluar
      );
  }, [activePeriod, safetyResultsMap, simParams]);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <main
        id="top"
        className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {/* Workspace Header, Metadata & Month Tabs (11 Live Tabs of 2026) */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                  {activePeriod?.up3Label || 'UP3 MAKASSAR SELATAN'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activePeriod?.unitLabel || 'ULP KALEBAJENG'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  gid={selectedGid}
                </span>
                {activePeriod && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Sinkron {activePeriod.fetchedAt.toLocaleTimeString('id-ID')}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-display text-balance">
                Monitoring Pemakaian &amp; Saldo Material Gudang ({activePeriod?.periodLabel || 'BULAN OKTOBER 2026'})
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={WAREHOUSE_SPREADSHEET_EDIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Buka Spreadsheet</span>
              </a>

              <button
                type="button"
                disabled={loadingPrimary}
                onClick={() => {
                  loadMonth(selectedGid);
                  loadAllMonthsInBackground();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingPrimary ? 'animate-spin' : ''}`}
                />
                <span>{loadingPrimary ? 'Menyinkronkan...' : 'Muat Ulang Live'}</span>
              </button>

              {activePeriod && (
                <button
                  type="button"
                  onClick={() => exportPeriodToCSV(activePeriod, simParams)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 border border-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Section Quick-Jump Toolbar */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
            {[
              { id: 'section-charts', label: 'Grafik Harian' },
              { id: 'section-yearly', label: 'Tren 2026' },
              { id: 'section-search', label: 'Pencarian Item' },
              { id: 'section-logs', label: 'Detail Mutasi' },
              { id: 'section-safety', label: 'Safety Stok' },
            ].map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-200/80 dark:border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* 11 Live Month Tabs (JAN 2026 .. OKT 2026 .. NOV 2026) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pilih Bulan Lembar Kerja (Live Google Sheets)
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {WAREHOUSE_MONTH_TABS.map((tab) => {
                const isActive = tab.gid === selectedGid;
                const loadedData = periodsByGid[tab.gid];
                return (
                  <button
                    key={tab.gid}
                    type="button"
                    onClick={() => handleSelectMonthTab(tab.gid)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:border-cyan-200 dark:hover:border-cyan-700'
                    }`}
                  >
                    {tab.label}
                    {loadedData ? ` (${loadedData.items.length})` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Google Sheets Link Loader */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={customLink}
                onChange={(e) => setCustomLink(e.target.value)}
                placeholder="Tempel link tab Google Spreadsheet lain (mis. gid=410640151 atau gid=2039754835)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
              />
            </div>
            <button
              type="button"
              disabled={loadingPrimary}
              onClick={handleLoadCustomLink}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-700 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              Muat dari Link
            </button>
          </div>

          {linkStatus && (
            <div
              className={`px-3.5 py-2 rounded-lg border text-xs ${
                linkStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              {linkStatus.text}
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Loading State for Primary Period */}
        {loadingPrimary && !activePeriod ? (
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            ))}
          </section>
        ) : activePeriod ? (
          <>
            {/* 6-Card KPI Strip */}
            <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Item Material
                </div>
                <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {summary.totalItems}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  APP {summary.appCount} · HAR {summary.harCount}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {activePeriod.saldoAwalLabel}
                </div>
                <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatIdNum(summary.totalAwal, 0)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Total unit awal bulan
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Material Masuk</span>
                </div>
                <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  +{formatIdNum(summary.totalMasuk, 0)}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Akumulasi tanggal 1–31
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Material Keluar</span>
                </div>
                <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
                  -{formatIdNum(summary.totalKeluar, 0)}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {summary.fastMovingCount} item Fast Moving
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs font-medium text-sky-700 dark:text-sky-400 flex items-center gap-1 truncate">
                  <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{activePeriod.saldoAkhirLabel}</span>
                </div>
                <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400">
                  {formatIdNum(summary.totalAkhir, 0)}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  {summary.activeCount} item bermutasi
                </div>
              </div>

              <button
                type="button"
                onClick={() => scrollToSection('section-safety')}
                className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-600 rounded-xl p-4 transition-colors"
              >
                <div className="text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Siaga Safety Stok</span>
                </div>
                <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                  {summary.alertSafetyCount}
                </div>
                <div className="mt-1 text-xs text-rose-700 dark:text-rose-400 font-medium">
                  Perlu reorder / kritis →
                </div>
              </button>
            </section>

            {/* SECTION 1: DAILY COMPARISON & TURNOVER CHARTS */}
            <section id="section-charts" className="space-y-4 scroll-mt-20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>
                      Grafik Perbandingan &amp; Perputaran Material ({activePeriod.periodLabel})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tren penerimaan masuk, pemakaian keluar harian tanggal 1–31, serta rasio perputaran stok.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
                  {(['ALL', 'APP', 'HAR'] as const).map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setChartGroupFilter(grp)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        chartGroupFilter === grp
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {grp === 'ALL' ? 'Semua (APP + HAR)' : `Kelompok ${grp}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Grafik Perbandingan Masuk vs Keluar Harian (Tgl 1–31)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Perbandingan jumlah material masuk dan keluar setiap tanggal pada bulan aktif.
                    </p>
                  </div>
                  <VerticalBarChart
                    data={dailyComparisonBars}
                    primaryLabel="Material Masuk"
                    secondaryLabel="Material Keluar"
                    primaryColor="#16a34a"
                    secondaryColor="#d97706"
                    height={230}
                    unit="unit"
                    ariaLabel="Grafik perbandingan harian material masuk dan keluar"
                  />
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Grafik Arus Kumulatif &amp; Saldo Berjalan (Tgl 1–31)</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Akumulasi total masuk, total keluar, dan posisi saldo stok gudang sepanjang bulan.
                    </p>
                  </div>
                  <MultiLineChart
                    data={turnoverCumulativeLines}
                    series={[
                      { key: 'cumMasuk', label: 'Kumulatif Masuk', color: '#16a34a' },
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
                    ariaLabel="Grafik arus kumulatif harian material"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Perbandingan Saldo Awal, Masuk, Keluar &amp; Saldo Akhir (Top Material Aktif)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Komposisi stok 7 material dengan volume mutasi tertinggi pada periode {activePeriod.periodLabel}.
                    </p>
                  </div>
                  <GroupedBarChart
                    data={topMaterialComparisonData}
                    series={[
                      { key: 'awal', label: 'Saldo Awal', color: '#64748b' },
                      { key: 'masuk', label: 'Masuk', color: '#16a34a' },
                      { key: 'keluar', label: 'Keluar', color: '#d97706' },
                      { key: 'akhir', label: 'Saldo Akhir', color: '#0284c7' },
                    ]}
                    height={245}
                    unitLabel="unit"
                    ariaLabel="Grafik perbandingan top material aktif"
                  />
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Proporsi Pemakaian Keluar (APP vs HAR)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Distribusi volume pemakaian keluar antar kelompok bidang.
                    </p>
                  </div>
                  <DonutChart
                    segments={groupComparisonDonut}
                    centerTitle="Total Keluar"
                    centerValue={formatIdNum(summary.totalKeluar, 0)}
                    ariaLabel="Grafik proporsi keluar APP dan HAR"
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Peringkat Perputaran Material (Turnover Rate)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Rasio perputaran = Jumlah Keluar ÷ Rata-rata Stok pada bulan aktif.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
                    {[
                      { id: 'turnover' as const, label: 'Rasio Putaran (x)' },
                      { id: 'keluar' as const, label: 'Volume Keluar' },
                      { id: 'masuk' as const, label: 'Volume Masuk' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTurnoverMetric(m.id)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          turnoverMetric === m.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <HorizontalBarChart
                  data={turnoverRankingData}
                  emptyText="Belum ada material bermutasi pada periode/kelompok ini."
                />
              </div>
            </section>

            {/* SECTION 2: YEARLY 2026 TREND ACROSS ALL 11 TABS (JAN..NOV 2026) */}
            <section id="section-yearly" className="space-y-4 scroll-mt-20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>
                      Grafik Tren Material Tahunan 2026 (JAN – NOV 2026)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Perbandingan volume masuk, keluar, dan saldo akhir seluruh tab bulanan pada spreadsheet terlampir ({yearlyTrendData.length} / {WAREHOUSE_MONTH_TABS.length} bulan termuat).
                  </p>
                </div>
                {loadingYearly && (
                  <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400">
                    Memuat seluruh tab bulanan 2026...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Perbandingan Material Masuk vs Keluar per Bulan (2026)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Total unit penerimaan dan pemakaian material dari Januari hingga November 2026.
                    </p>
                  </div>
                  <VerticalBarChart
                    data={yearlyBars}
                    primaryLabel="Total Masuk"
                    secondaryLabel="Total Keluar"
                    primaryColor="#16a34a"
                    secondaryColor="#d97706"
                    height={230}
                    unit="unit"
                    ariaLabel="Grafik perbandingan masuk dan keluar bulanan tahun 2026"
                  />
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Kurva Saldo Akhir Gudang per Bulan (2026)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pergerakan total stok akhir bulan serta perbandingan volume mutasi bulanan.
                    </p>
                  </div>
                  <MultiLineChart
                    data={yearlyLines}
                    series={[
                      { key: 'saldoAkhir', label: 'Saldo Akhir', color: '#0284c7' },
                      { key: 'masuk', label: 'Total Masuk', color: '#16a34a' },
                      { key: 'keluar', label: 'Total Keluar', color: '#d97706', dashed: true },
                    ]}
                    height={230}
                    unit="unit"
                    ariaLabel="Grafik kurva saldo akhir bulanan tahun 2026"
                  />
                </div>
              </div>
            </section>

            {/* SECTION 3: SEARCHABLE MATERIAL CATALOG & SELECTED ITEM DAILY BREAKDOWN */}
            <section
              id="section-search"
              className="grid grid-cols-1 xl:grid-cols-12 gap-4 scroll-mt-20"
            >
              <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Daftar Pencarian Material per Item</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Klik baris item untuk melihat grafik dan rincian harian tanggal 1–31.
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-cyan-700 dark:text-cyan-400">
                    {filteredItems.length} / {activePeriod.items.length} item
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari kode (mis. 3250048), MCB, NFA2X, kWH..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      aria-label="Filter kelompok material"
                      value={searchGroup}
                      onChange={(e) =>
                        setSearchGroup(e.target.value as 'ALL' | MaterialGroup)
                      }
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                    >
                      <option value="ALL">Semua Kelompok</option>
                      <option value="APP">Kelompok APP</option>
                      <option value="HAR">Kelompok HAR</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      aria-label="Filter kondisi pergerakan"
                      value={searchMovement}
                      onChange={(e) =>
                        setSearchMovement(e.target.value as SearchMovementFilter)
                      }
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">Semua Kondisi</option>
                      <option value="active">Hanya Bermutasi</option>
                      <option value="fast">Fast Moving</option>
                      <option value="alert">Siaga Safety Stok</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[520px] border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
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
                              onClick={() => setSelectedItemId(item.id)}
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
                                  {item.group} · {item.satuan}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 min-w-[190px]">
                                <div className="font-medium text-slate-900 leading-snug">
                                  {item.nama}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                                  Putaran {item.turnoverRate.toFixed(2)}x ·{' '}
                                  {item.movementClass}
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
                                    className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${getSafetyStatusClasses(
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

              <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                {selectedItem ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-sky-700 font-semibold">
                          {selectedItem.group} · KODE {selectedItem.kode} ({selectedItem.satuan})
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                          {selectedItem.nama}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => scrollToSection('section-safety')}
                        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Simulasi Safety</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-[11px] text-slate-500">Awal</div>
                        <div className="text-sm font-bold font-mono tabular-nums text-slate-800">
                          {formatIdNum(selectedItem.saldoAwal, 0)}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <div className="text-[11px] text-emerald-700">Masuk</div>
                        <div className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                          +{formatIdNum(selectedItem.jumlahMasuk, 0)}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="text-[11px] text-amber-800">Keluar</div>
                        <div className="text-sm font-bold font-mono tabular-nums text-amber-700">
                          -{formatIdNum(selectedItem.jumlahKeluar, 0)}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200">
                        <div className="text-[11px] text-sky-800">Akhir</div>
                        <div className="text-sm font-bold font-mono tabular-nums text-sky-800">
                          {formatIdNum(selectedItem.saldoAkhir, 0)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Pergerakan Harian Tanggal 1–31 Item Terpilih
                      </div>
                      <VerticalBarChart
                        data={selectedItemDailyChart}
                        primaryLabel="Masuk"
                        secondaryLabel="Keluar"
                        primaryColor="#16a34a"
                        secondaryColor="#d97706"
                        height={175}
                        unit={selectedItem.satuan}
                        ariaLabel={`Grafik harian ${selectedItem.nama}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          Rincian Tanggal ({selectedItem.activeDaysMasuk} masuk /{' '}
                          {selectedItem.activeDaysKeluar} keluar)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAllDays((v) => !v)}
                          className="text-xs font-medium text-sky-700 hover:underline"
                        >
                          {showAllDays ? 'Hanya Tgl Bermutasi' : 'Tampilkan 31 Hari'}
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
                                Saldo
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
                                  {row.masuk > 0
                                    ? `+${formatIdNum(row.masuk, 0)}`
                                    : '—'}
                                </td>
                                <td className="py-1.5 px-2.5 text-right text-amber-700">
                                  {row.keluar > 0
                                    ? `-${formatIdNum(row.keluar, 0)}`
                                    : '—'}
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
                    Pilih item material dari tabel di sebelah kiri untuk melihat grafik hariannya.
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 4: DETAIL LOG TRANSAKSI HARIAN */}
            <section
              id="section-logs"
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 scroll-mt-20"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Detail Transaksi Material Keluar &amp; Masuk (Tgl 1–31)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Seluruh catatan mutasi harian per tanggal pada periode {activePeriod.periodLabel}.
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
                    aria-label="Filter arah mutasi"
                    value={logTypeFilter}
                    onChange={(e) =>
                      setLogTypeFilter(e.target.value as LogTypeFilter)
                    }
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">Semua (Masuk &amp; Keluar)</option>
                    <option value="masuk">Hanya Material Masuk</option>
                    <option value="keluar">Hanya Material Keluar</option>
                  </select>

                  <select
                    aria-label="Filter tanggal mutasi"
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
                      <th className="py-2.5 px-3 font-semibold">Arah</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Volume</th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        Saldo Setelah
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDailyLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-xs text-slate-500"
                        >
                          Tidak ada transaksi masuk/keluar pada filter yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      filteredDailyLogs.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                            Tanggal {ev.day}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {ev.group}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                            {ev.kode}
                          </td>
                          <td className="py-2 px-3 text-slate-900 font-medium">
                            {ev.nama}
                          </td>
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
                              ev.type === 'masuk'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
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

            {/* SECTION 5: SIMULASI SAFETY STOK & ROP */}
            <section id="section-safety" className="space-y-4 scroll-mt-20">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                      <span>Simulasi Safety Stok &amp; Reorder Point (ROP)</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Proyeksi ketahanan stok 30 hari ke depan dan rekomendasi batas pemesanan ulang berdasarkan mutasi bulan {activePeriod.periodLabel}.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto">
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
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          simParams.demandMultiplierPct === preset.pct
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Material yang Disimulasikan
                    </label>
                    <select
                      aria-label="Pilih material simulasi safety stok"
                      value={selectedItem?.id || ''}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800"
                    >
                      {activePeriod.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          [{item.group}] {item.kode} — {item.nama} (Akhir:{' '}
                          {item.saldoAkhir})
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
                    <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-0.5">
                      <span>1 hr</span>
                      <span>15 hr</span>
                      <span>30 hr</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tingkat Layanan (Service Level Z)
                    </label>
                    <select
                      aria-label="Service level safety stok"
                      value={simParams.zScore}
                      onChange={(e) =>
                        setSimParams((prev) => ({
                          ...prev,
                          zScore: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                    >
                      <option value={1.28}>90% (Z = 1,28 · Standar)</option>
                      <option value={1.65}>95% (Z = 1,65 · Rekomendasi PLN)</option>
                      <option value={2.05}>98% (Z = 2,05 · Siaga Tinggi)</option>
                      <option value={2.33}>99% (Z = 2,33 · Anti-Kosong)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Skenario Kebutuhan</span>
                      <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
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
                    <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>70%</span>
                      <span>100%</span>
                      <span>200%</span>
                    </div>
                  </div>
                </div>

                {selectedItem && selectedSafetySim && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Stok Aktual</div>
                        <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {formatIdNum(selectedItem.saldoAkhir, 0)}{' '}
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            {selectedItem.satuan}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Pemakaian/Hari</div>
                        <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {formatIdNum(selectedSafetySim.adjustedDailyUsage, 2)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Puncak: {formatIdNum(selectedSafetySim.maxDailyUsage, 0)}/hr
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                        <div className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                          Safety Stock
                        </div>
                        <div className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-700 dark:text-rose-300">
                          {formatIdNum(selectedSafetySim.recommendedSafetyStock, 0)}{' '}
                          <span className="text-xs font-normal">
                            {selectedItem.satuan}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                        <div className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                          Reorder Point
                        </div>
                        <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-800 dark:text-amber-300">
                          {formatIdNum(selectedSafetySim.reorderPoint, 0)}{' '}
                          <span className="text-xs font-normal">
                            {selectedItem.satuan}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                        <div className="text-xs font-semibold text-sky-800 dark:text-sky-400">
                          Ketahanan Stok
                        </div>
                        <div className="mt-1 text-lg font-bold font-mono tabular-nums text-sky-800 dark:text-sky-300">
                          {selectedSafetySim.daysOfSupply !== null
                            ? `${selectedSafetySim.daysOfSupply.toFixed(1)} hr`
                            : 'Pasif'}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Status &amp; Order</div>
                        <div className="mt-1">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-bold border rounded ${getSafetyStatusClasses(
                              selectedSafetySim.status
                            )}`}
                          >
                            {selectedSafetySim.statusLabel}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {selectedSafetySim.shortfallToRop > 0
                            ? `Order min: +${formatIdNum(
                                selectedSafetySim.shortfallToRop,
                                0
                              )} ${selectedItem.satuan}`
                            : 'Belum perlu order'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Simulasi Proyeksi Penurunan Stok 30 Hari ({selectedItem.nama})
                        </h3>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          Tanpa penerimaan baru selama 30 hari
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
                        height={225}
                        unit={selectedItem.satuan}
                        decimals={1}
                        ariaLabel="Grafik proyeksi penurunan stok 30 hari"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Matriks Safety Stok Material Bermutasi
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Diurutkan otomatis dari stok paling kritis. Klik baris untuk mensimulasikan.
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {safetyPortfolioRows.length} material aktif
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[420px] border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Kode / Kel.</th>
                        <th className="py-2.5 px-3 font-semibold">Nama Material</th>
                        <th className="py-2.5 px-2.5 font-semibold text-right">
                          Saldo Akhir
                        </th>
                        <th className="py-2.5 px-2.5 font-semibold text-right">
                          Rata²/Hr
                        </th>
                        <th className="py-2.5 px-2.5 font-semibold text-right text-rose-700 dark:text-rose-400">
                          Safety Stock
                        </th>
                        <th className="py-2.5 px-2.5 font-semibold text-right text-amber-800 dark:text-amber-400">
                          ROP
                        </th>
                        <th className="py-2.5 px-2.5 font-semibold text-right">
                          Ketahanan
                        </th>
                        <th className="py-2.5 px-2.5 font-semibold text-right text-sky-700 dark:text-sky-400">
                          Saran Order
                        </th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {safetyPortfolioRows.map(({ item, sim }) => {
                        const isSelected = selectedItem?.id === item.id;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedItemId(item.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-cyan-50/90 dark:bg-cyan-950/50'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {item.kode}
                              </span>{' '}
                              <span className="text-slate-400">· {item.group}</span>
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                              {item.nama}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                              {formatIdNum(item.saldoAkhir, 0)} {item.satuan}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {formatIdNum(sim.adjustedDailyUsage, 2)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                              {formatIdNum(sim.recommendedSafetyStock, 0)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-amber-800 dark:text-amber-400">
                              {formatIdNum(sim.reorderPoint, 0)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                              {sim.daysOfSupply !== null
                                ? `${sim.daysOfSupply.toFixed(1)} hr`
                                : 'Pasif'}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                              {sim.shortfallToRop > 0
                                ? `+${formatIdNum(sim.shortfallToRop, 0)}`
                                : '0'}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${getSafetyStatusClasses(
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
          </>
        ) : (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Data spreadsheet tidak dapat dimuat saat ini.
            </p>
            <button
              type="button"
              onClick={() => loadMonth(selectedGid)}
              className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
            >
              Coba Muat Ulang
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
