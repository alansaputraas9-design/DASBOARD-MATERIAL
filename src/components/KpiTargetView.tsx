import {
  Activity,
  AlertCircle,
  BarChart3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  exportKpiRowsToCSV,
  fetchKpiWorkbookData,
  getKpiTabCsvUrl,
  KPI_SPREADSHEET_EDIT_URL,
  KPI_SPREADSHEET_ID,
  KPI_TABS,
  KpiTabId,
  KpiWorkbookData,
  PelangganRow,
  SaldoRow,
} from '../services/kpiTargetService';
import {
  DonutChart,
  HorizontalBarChart,
  MultiLineChart,
  VerticalBarChart,
} from './Charts';

function fmtNum(val: number | null | undefined, maxDecimals = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return `${val.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function KpiTargetView() {
  const [data, setData] = useState<KpiWorkbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<KpiTabId>('pelanggan-mva');
  const [pelangganMode, setPelangganMode] = useState<'aktual' | 'prognosa'>('aktual');
  const [saldoMode, setSaldoMode] = useState<'aktual' | 'prognosa'>('aktual');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await fetchKpiWorkbookData();
      setData(parsed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data spreadsheet KPI terlampir.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Latest active summaries for top KPI cards
  const latestPelangganAktual = useMemo(() => {
    if (!data) return null;
    const rows = data.pelanggan.aktualRows;
    return (
      [...rows].reverse().find((r) => r.realisasiBulanan !== null) ||
      rows[rows.length - 1] ||
      null
    );
  }, [data]);

  const latestPelangganPrognosa = useMemo(() => {
    if (!data) return null;
    const rows = data.pelanggan.prognosaRows;
    return rows[rows.length - 1] || null;
  }, [data]);

  const latestMva = useMemo(() => {
    if (!data) return null;
    const rows = data.mva.rows;
    return (
      [...rows].reverse().find((r) => r.realisasiBulananMva !== null) ||
      rows[rows.length - 1] ||
      null
    );
  }, [data]);

  const latestBp = useMemo(() => {
    if (!data) return null;
    const rows = data.bp.rows;
    return (
      [...rows].reverse().find((r) => r.realisasiBulanan !== null) ||
      rows[rows.length - 1] ||
      null
    );
  }, [data]);

  const latestSaldo = useMemo(() => {
    if (!data) return null;
    const rows = data.saldo.aktualRows;
    return (
      [...rows].reverse().find((r) => r.realisasiKumulatif !== null) ||
      rows[rows.length - 1] ||
      null
    );
  }, [data]);

  const activePelangganRows: PelangganRow[] = useMemo(() => {
    if (!data) return [];
    return pelangganMode === 'prognosa'
      ? data.pelanggan.prognosaRows
      : data.pelanggan.aktualRows;
  }, [data, pelangganMode]);

  const activeSaldoRows: SaldoRow[] = useMemo(() => {
    if (!data) return [];
    return saldoMode === 'prognosa'
      ? data.saldo.prognosaRows
      : data.saldo.aktualRows;
  }, [data, saldoMode]);

  const activeTabMeta = useMemo(
    () => KPI_TABS.find((t) => t.id === activeTab) || KPI_TABS[0],
    [activeTab]
  );

  function handleExportCurrentTab() {
    if (!data) return;
    if (activeTab === 'pelanggan-mva') {
      exportKpiRowsToCSV(
        `kpi-pelanggan-${pelangganMode}`,
        [
          'Bulan',
          'Status',
          'Target Kumulatif',
          'Target Bulanan',
          pelangganMode === 'prognosa' ? 'Prognosa Bulanan' : 'Realisasi Bulanan',
          'Realisasi Mutasi N',
          'Realisasi Kumulatif',
          'Pencapaian (%)',
          'Target 110% Kumulatif',
          'Selisih Target 100%',
          'Selisih Target 110%',
        ],
        activePelangganRows.map((r) => [
          r.bulan,
          r.isPrognosa ? 'PROGNOSA' : 'AKTUAL',
          r.targetKumulatif,
          r.targetBulanan,
          r.realisasiBulanan,
          r.realisasiMutasiN,
          r.realisasiKumulatif,
          r.persentasePencapaian,
          r.target110Kumulatif,
          r.selisihTarget100,
          r.selisihTarget110,
        ])
      );
    } else if (activeTab === 'bp') {
      exportKpiRowsToCSV(
        'kpi-biaya-penyambungan',
        [
          'Bulan',
          'Target Kumulatif (Rp M)',
          'Target Bulanan (Rp M)',
          'Realisasi Bulanan (Rp M)',
          'Realisasi Kumulatif (Rp M)',
          'Pencapaian (%)',
          'Target 110% Kumulatif',
          'Selisih Target 100%',
          'Selisih Target 110%',
        ],
        data.bp.rows.map((r) => [
          r.bulan,
          r.targetKumulatif,
          r.targetBulanan,
          r.realisasiBulanan,
          r.realisasiKumulatif,
          r.persentasePencapaian,
          r.target110Kumulatif,
          r.selisihTarget100,
          r.selisihTarget110,
        ])
      );
    } else if (activeTab === 'saldo') {
      exportKpiRowsToCSV(
        `kpi-saldo-${saldoMode}`,
        [
          'Bulan',
          'Status',
          'Target Kumulatif (Rp Jt)',
          'Target Bulanan (Rp Jt)',
          'Realisasi Bulanan (Rp Jt)',
          'Realisasi Kumulatif (Rp Jt)',
          'Pencapaian (%)',
          'Catatan',
        ],
        activeSaldoRows.map((r) => [
          r.bulan,
          r.isPrognosa ? 'PROGNOSA' : 'AKTUAL',
          r.targetKumulatif,
          r.targetBulanan,
          r.realisasiBulanan,
          r.realisasiKumulatif,
          r.persentasePencapaian,
          r.catatan,
        ])
      );
    } else {
      exportKpiRowsToCSV(
        'kpi-sheet4',
        data.sheet4Rows[0]?.map((_, idx) => `Kolom ${idx + 1}`) || ['Data'],
        data.sheet4Rows
      );
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Banner + Spreadsheet Link */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>KPI Target &amp; Realisasi · 4 Tab Sheet</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
                ID: {KPI_SPREADSHEET_ID.slice(0, 14)}…
              </span>
              {data?.pelanggan.updatedAt && (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono text-[11px] font-semibold">
                  Updated: {data.pelanggan.updatedAt}
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              Monitoring Delta Pelanggan, Daya Tersambung MVA, Biaya Penyambungan &amp; Saldo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Terhubung langsung ke Google Spreadsheet terlampir (real-time CSV live) dengan grafik perbandingan Target 100%, Target 110%, Realisasi &amp; Prognosa.
              {data?.fetchedAt && (
                <>
                  {' '}
                  · Dimuat pukul{' '}
                  <span className="font-mono">
                    {data.fetchedAt.toLocaleTimeString('id-ID')}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={KPI_SPREADSHEET_EDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Buka Spreadsheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              disabled={!data || loading}
              onClick={handleExportCurrentTab}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Memuat...' : 'Muat Ulang Live'}</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-cyan-700 dark:text-cyan-400">
              <span>PENAMBAHAN PELANGGAN</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {fmtNum(latestPelangganAktual?.realisasiKumulatif, 0)}{' '}
                <span className="text-xs font-normal text-slate-500">plg</span>
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {fmtPct(latestPelangganAktual?.persentasePencapaian)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {latestPelangganAktual?.bulan || 'NOV'} · Target:{' '}
              {fmtNum(latestPelangganAktual?.targetKumulatif, 0)} · Prognosa Des:{' '}
              {fmtNum(latestPelangganPrognosa?.realisasiKumulatif, 0)}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-400">
              <span>PENAMBAHAN DAYA (MVA)</span>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {fmtNum(latestMva?.realisasiPenambahanKumulatif, 3)}{' '}
                <span className="text-xs font-normal text-slate-500">MVA</span>
              </span>
              <span className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                {fmtPct(latestMva?.persentasePencapaian)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {latestMva?.bulan || 'NOV'} · Tersambung:{' '}
              {fmtNum(latestMva?.realisasiDayaTersambung, 4)} MVA
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400">
              <span>BIAYA PENYAMBUNGAN (BP)</span>
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                Rp {fmtNum(latestBp?.realisasiKumulatif, 2)}{' '}
                <span className="text-xs font-normal text-slate-500">M</span>
              </span>
              <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-400">
                {fmtPct(latestBp?.persentasePencapaian)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {latestBp?.bulan || 'SEP'} · Target:{' '}
              {fmtNum(latestBp?.targetKumulatif, 2)} M ({data?.bp.updatedAt || '12 Okt 2026'})
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              <span>SALDO RATA-RATA AKHIR</span>
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                Rp {fmtNum(latestSaldo?.realisasiKumulatif, 2)}{' '}
                <span className="text-xs font-normal text-slate-500">Jt</span>
              </span>
              <span
                className={`text-xs font-mono font-semibold ${
                  (latestSaldo?.persentasePencapaian ?? 0) < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {fmtPct(latestSaldo?.persentasePencapaian)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {latestSaldo?.bulan || 'OCT'} · Target: Rp{' '}
              {fmtNum(latestSaldo?.targetKumulatif, 0)} Jt
            </div>
          </div>
        </div>

        {/* Sheet Tab Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {KPI_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-cyan-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.name}</span>
                <span
                  className={`font-mono text-[10px] ${
                    isActive ? 'text-cyan-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  gid={tab.gid}
                </span>
              </button>
            );
          })}

          <a
            href={getKpiTabCsvUrl(activeTabMeta.gid)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-mono text-cyan-700 dark:text-cyan-400 hover:underline"
          >
            <span>CSV Tab Aktif</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </section>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3 animate-pulse">
          <div className="h-6 w-1/3 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-56 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      )}

      {/* TAB 1: DELTA PELANGGAN & DELTA MVA (gid=0) */}
      {data && activeTab === 'pelanggan-mva' && (
        <div className="space-y-6">
          {/* BLOCK A: JUMLAH PENAMBAHAN PELANGGAN */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {data.pelanggan.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perbandingan Target 100%, Target 110%, Realisasi Bulanan &amp; Kumulatif ({data.pelanggan.updatedAt})
                  {data.pelanggan.targetHarian !== null && (
                    <>
                      {' '}
                      · Target Harian:{' '}
                      <strong className="font-mono text-slate-700 dark:text-slate-200">
                        {data.pelanggan.targetHarian} {data.pelanggan.targetHarianSatuan}
                      </strong>
                    </>
                  )}
                </p>
              </div>

              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950 shrink-0">
                <button
                  type="button"
                  onClick={() => setPelangganMode('aktual')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    pelangganMode === 'aktual'
                      ? 'bg-cyan-700 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Realisasi Aktual
                </button>
                <button
                  type="button"
                  onClick={() => setPelangganMode('prognosa')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    pelangganMode === 'prognosa'
                      ? 'bg-cyan-700 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Prognosa s.d. Des 2026
                </button>
              </div>
            </div>

            {/* Charts Grid: Pelanggan */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-2">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Kurva Kumulatif Penambahan Pelanggan (JAN–DEC)
                </h4>
                <MultiLineChart
                  data={activePelangganRows.map((r) => ({
                    label: r.bulan,
                    values: {
                      realisasi: r.realisasiKumulatif,
                      target100: r.targetKumulatif,
                      target110: r.target110Kumulatif,
                    },
                  }))}
                  series={[
                    {
                      key: 'realisasi',
                      label:
                        pelangganMode === 'prognosa'
                          ? 'Prognosa Kumulatif'
                          : 'Realisasi Kumulatif',
                      color: '#0e7490',
                    },
                    {
                      key: 'target100',
                      label: 'Target 100%',
                      color: '#d97706',
                      dashed: true,
                    },
                    {
                      key: 'target110',
                      label: 'Target 110%',
                      color: '#4338ca',
                      dashed: true,
                    },
                  ]}
                  unit="plg"
                  decimals={0}
                  ariaLabel="Kurva kumulatif penambahan pelanggan"
                />
              </div>

              <div className="lg:col-span-6 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Target Bulanan vs {pelangganMode === 'prognosa' ? 'Prognosa' : 'Realisasi'} Bulanan
                </h4>
                <VerticalBarChart
                  data={activePelangganRows.map((r) => ({
                    label: r.bulan,
                    value: r.realisasiBulanan ?? 0,
                    secondaryValue: r.targetBulanan ?? 0,
                  }))}
                  primaryLabel={
                    pelangganMode === 'prognosa' ? 'Realisasi/Prognosa' : 'Realisasi Bulanan'
                  }
                  secondaryLabel="Target Bulanan"
                  primaryColor="#0e7490"
                  secondaryColor="#f59e0b"
                  unit="plg"
                  height={250}
                  ariaLabel="Perbandingan target dan realisasi bulanan pelanggan"
                />
              </div>
            </div>

            {/* Pencapaian % + Potensi PB Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="lg:col-span-7 space-y-2">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Persentase Pencapaian Bulanan (%)
                </h4>
                <HorizontalBarChart
                  data={activePelangganRows.map((r) => ({
                    label: r.bulan,
                    subLabel: `${fmtNum(r.realisasiKumulatif, 0)} / ${fmtNum(
                      r.targetKumulatif,
                      0
                    )} plg`,
                    value: r.persentasePencapaian ?? 0,
                    unit: '%',
                    color:
                      (r.persentasePencapaian ?? 0) >= 100
                        ? '#059669'
                        : (r.persentasePencapaian ?? 0) >= 85
                        ? '#0e7490'
                        : '#d97706',
                  }))}
                />
              </div>

              <div className="lg:col-span-5 space-y-3 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Potensi Pasang Baru (Potensi PB)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Rincian pipeline pelanggan potensial dari sheet terlampir
                  </p>
                </div>
                <DonutChart
                  segments={data.pelanggan.potensiPb.map((item, idx) => ({
                    label: item.kategori,
                    value: item.jumlah,
                    color: ['#0e7490', '#4338ca', '#d97706', '#059669'][idx % 4],
                  }))}
                  centerTitle="Total Potensi"
                  centerValue={data.pelanggan.potensiPbTotal.toLocaleString('id-ID')}
                  ariaLabel="Distribusi Potensi PB"
                />
              </div>
            </div>

            {/* Data Table: Pelanggan */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3">Bulan</th>
                    <th className="py-2.5 px-3 text-right">Target Kumulatif</th>
                    <th className="py-2.5 px-3 text-right">Target Bulanan</th>
                    <th className="py-2.5 px-3 text-right">
                      {pelangganMode === 'prognosa' ? 'Prognosa' : 'Realisasi Bulanan'}
                    </th>
                    <th className="py-2.5 px-3 text-right">Mutasi N</th>
                    <th className="py-2.5 px-3 text-right">Realisasi Kumulatif</th>
                    <th className="py-2.5 px-3 text-right">% Pencapaian</th>
                    <th className="py-2.5 px-3 text-right">Target 110%</th>
                    <th className="py-2.5 px-3 text-right">Selisih 100%</th>
                    <th className="py-2.5 px-3 text-right">Selisih 110%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                  {activePelangganRows.map((row) => (
                    <tr
                      key={`${pelangganMode}-${row.bulan}`}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        row.isPrognosa ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.bulan}{' '}
                        {row.isPrognosa && (
                          <span className="ml-1 text-[10px] font-mono text-amber-700 dark:text-amber-300">
                            (PROGNOSA)
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">{fmtNum(row.targetKumulatif, 0)}</td>
                      <td className="py-2 px-3 text-right">{fmtNum(row.targetBulanan, 0)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-cyan-800 dark:text-cyan-300">
                        {fmtNum(row.realisasiBulanan, 0)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {fmtNum(row.realisasiMutasiN, 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {fmtNum(row.realisasiKumulatif, 0)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          (row.persentasePencapaian ?? 0) >= 100
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {fmtPct(row.persentasePencapaian)}
                      </td>
                      <td className="py-2 px-3 text-right">{fmtNum(row.target110Kumulatif, 0)}</td>
                      <td
                        className={`py-2 px-3 text-right ${
                          (row.selisihTarget100 ?? 0) < 0
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {fmtNum(row.selisihTarget100, 0)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right ${
                          (row.selisihTarget110 ?? 0) < 0
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {fmtNum(row.selisihTarget110, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* BLOCK B: JUMLAH PENAMBAHAN DAYA TERSAMBUNG (MVA) */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {data.mva.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Baseline {data.mva.baselineLabel}:{' '}
                  <strong className="font-mono text-slate-700 dark:text-slate-200">
                    {fmtNum(data.mva.baselineValue, 5)} MVA
                  </strong>{' '}
                  · Updated: {data.mva.updatedAt}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-2">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Kurva Penambahan Daya Kumulatif vs Target (MVA)
                </h4>
                <MultiLineChart
                  data={data.mva.rows.map((r) => ({
                    label: r.bulan,
                    values: {
                      realisasi: r.realisasiPenambahanKumulatif,
                      target100: r.targetKumulatif,
                      target110: r.target110Kumulatif,
                    },
                  }))}
                  series={[
                    {
                      key: 'realisasi',
                      label: 'Realisasi Penambahan (MVA)',
                      color: '#4338ca',
                    },
                    {
                      key: 'target100',
                      label: 'Target 100% (MVA)',
                      color: '#d97706',
                      dashed: true,
                    },
                    {
                      key: 'target110',
                      label: 'Target 110% (MVA)',
                      color: '#059669',
                      dashed: true,
                    },
                  ]}
                  unit="MVA"
                  decimals={3}
                  ariaLabel="Kurva penambahan daya tersambung MVA"
                />
              </div>

              <div className="lg:col-span-6 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Realisasi Penambahan Daya Bulanan (MVA)
                </h4>
                <VerticalBarChart
                  data={data.mva.rows.map((r) => ({
                    label: r.bulan,
                    value: r.realisasiBulananMva ?? 0,
                  }))}
                  primaryLabel="Penambahan Bulanan (MVA)"
                  primaryColor="#4338ca"
                  unit="MVA"
                  height={250}
                  ariaLabel="Grafik batang penambahan daya bulanan MVA"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Persentase Pencapaian Daya Tersambung per Bulan (%)
              </h4>
              <HorizontalBarChart
                data={data.mva.rows.map((r) => ({
                  label: r.bulan,
                  subLabel: `${fmtNum(r.realisasiPenambahanKumulatif, 3)} / ${fmtNum(
                    r.targetKumulatif,
                    2
                  )} MVA`,
                  value: r.persentasePencapaian ?? 0,
                  unit: '%',
                  color:
                    (r.persentasePencapaian ?? 0) >= 100 ? '#059669' : '#4338ca',
                }))}
              />
            </div>

            {/* Table MVA */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3">Bulan</th>
                    <th className="py-2.5 px-3 text-right">Target Kumulatif</th>
                    <th className="py-2.5 px-3 text-right">Daya Tersambung (MVA)</th>
                    <th className="py-2.5 px-3 text-right">Realisasi Bulanan</th>
                    <th className="py-2.5 px-3 text-right">Penambahan Kumulatif</th>
                    <th className="py-2.5 px-3 text-right">% Pencapaian</th>
                    <th className="py-2.5 px-3 text-right">Target 110%</th>
                    <th className="py-2.5 px-3 text-right">Selisih 100%</th>
                    <th className="py-2.5 px-3 text-right">Selisih 110%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                  <tr className="bg-slate-50/80 dark:bg-slate-950/60">
                    <td className="py-2 px-3 font-sans font-semibold text-slate-600 dark:text-slate-400">
                      {data.mva.baselineLabel} (Baseline)
                    </td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {fmtNum(data.mva.baselineValue, 5)}
                    </td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right">—</td>
                  </tr>
                  {data.mva.rows.map((row) => (
                    <tr
                      key={`mva-${row.bulan}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900 dark:text-slate-100">
                        {row.bulan}
                      </td>
                      <td className="py-2 px-3 text-right">{fmtNum(row.targetKumulatif, 2)}</td>
                      <td className="py-2 px-3 text-right">
                        {fmtNum(row.realisasiDayaTersambung, 4)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-indigo-700 dark:text-indigo-300">
                        {fmtNum(row.realisasiBulananMva, 5)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {fmtNum(row.realisasiPenambahanKumulatif, 3)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          (row.persentasePencapaian ?? 0) >= 100
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {fmtPct(row.persentasePencapaian)}
                      </td>
                      <td className="py-2 px-3 text-right">{fmtNum(row.target110Kumulatif, 3)}</td>
                      <td
                        className={`py-2 px-3 text-right ${
                          (row.selisihTarget100 ?? 0) < 0
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : ''
                        }`}
                      >
                        {fmtNum(row.selisihTarget100, 3)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right ${
                          (row.selisihTarget110 ?? 0) < 0
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : ''
                        }`}
                      >
                        {fmtNum(row.selisihTarget110, 3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: BP (gid=1864590170) */}
      {data && activeTab === 'bp' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {data.bp.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Satuan Rp Miliar · Updated: {data.bp.updatedAt}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-2">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Kurva Kumulatif Pendapatan BP (Rp Miliar)
              </h4>
              <MultiLineChart
                data={data.bp.rows.map((r) => ({
                  label: r.bulan,
                  values: {
                    realisasi: r.realisasiKumulatif,
                    target100: r.targetKumulatif,
                    target110: r.target110Kumulatif,
                  },
                }))}
                series={[
                  { key: 'realisasi', label: 'Realisasi Kumulatif', color: '#d97706' },
                  { key: 'target100', label: 'Target 100%', color: '#0e7490', dashed: true },
                  { key: 'target110', label: 'Target 110%', color: '#4338ca', dashed: true },
                ]}
                unit="M"
                decimals={2}
                ariaLabel="Kurva kumulatif pendapatan biaya penyambungan"
              />
            </div>

            <div className="lg:col-span-6 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Target Bulanan vs Realisasi Bulanan BP (Rp Miliar)
              </h4>
              <VerticalBarChart
                data={data.bp.rows.map((r) => ({
                  label: r.bulan,
                  value: r.realisasiBulanan ?? 0,
                  secondaryValue: r.targetBulanan ?? 0,
                }))}
                primaryLabel="Realisasi Bulanan"
                secondaryLabel="Target Bulanan"
                primaryColor="#d97706"
                secondaryColor="#0e7490"
                unit="M"
                height={250}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Persentase Pencapaian Biaya Penyambungan (%)
            </h4>
            <HorizontalBarChart
              data={data.bp.rows.map((r) => ({
                label: r.bulan,
                subLabel: `Rp ${fmtNum(r.realisasiKumulatif, 2)} / ${fmtNum(
                  r.targetKumulatif,
                  2
                )} M`,
                value: r.persentasePencapaian ?? 0,
                unit: '%',
                color: '#d97706',
              }))}
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Bulan</th>
                  <th className="py-2.5 px-3 text-right">Target Kumulatif</th>
                  <th className="py-2.5 px-3 text-right">Target Bulanan</th>
                  <th className="py-2.5 px-3 text-right">Realisasi Bulanan</th>
                  <th className="py-2.5 px-3 text-right">Realisasi Kumulatif</th>
                  <th className="py-2.5 px-3 text-right">% Pencapaian</th>
                  <th className="py-2.5 px-3 text-right">Target 110%</th>
                  <th className="py-2.5 px-3 text-right">Selisih 100%</th>
                  <th className="py-2.5 px-3 text-right">Selisih 110%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                {data.bp.rows.map((row) => (
                  <tr key={`bp-${row.bulan}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-sans font-semibold text-slate-900 dark:text-slate-100">
                      {row.bulan}
                    </td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.targetKumulatif, 2)}</td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.targetBulanan, 2)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-amber-700 dark:text-amber-300">
                      {fmtNum(row.realisasiBulanan, 2)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold">{fmtNum(row.realisasiKumulatif, 2)}</td>
                    <td className="py-2 px-3 text-right font-bold">{fmtPct(row.persentasePencapaian)}</td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.target110Kumulatif, 2)}</td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.selisihTarget100, 2)}</td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.selisihTarget110, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: SALDO RATA-RATA AKHIR BULAN (gid=2066054738) */}
      {data && activeTab === 'saldo' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {data.saldo.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target Saldo Maksimal Rp 22 Juta / Bulan · Updated: {data.saldo.updatedAt}
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950 shrink-0">
              <button
                type="button"
                onClick={() => setSaldoMode('aktual')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  saldoMode === 'aktual'
                    ? 'bg-cyan-700 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Realisasi Aktual
              </button>
              <button
                type="button"
                onClick={() => setSaldoMode('prognosa')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  saldoMode === 'prognosa'
                    ? 'bg-cyan-700 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Prognosa Nihil Tunggakan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-2">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Tren Saldo Rata-Rata Kumulatif &amp; Bulanan vs Target (Rp Juta)
              </h4>
              <MultiLineChart
                data={activeSaldoRows.map((r) => ({
                  label: r.bulan,
                  values: {
                    kumulatif: r.realisasiKumulatif,
                    bulanan: r.realisasiBulanan,
                    target: r.targetKumulatif,
                  },
                }))}
                series={[
                  { key: 'kumulatif', label: 'Realisasi Kumulatif (Rp Jt)', color: '#0e7490' },
                  { key: 'bulanan', label: 'Realisasi Bulanan (Rp Jt)', color: '#d97706' },
                  { key: 'target', label: 'Target Maks (Rp 22 Jt)', color: '#059669', dashed: true },
                ]}
                unit="Jt"
                decimals={2}
                ariaLabel="Tren saldo rata-rata akhir bulan"
              />
            </div>

            <div className="lg:col-span-6 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Realisasi Bulanan vs Target Saldo (Rp Juta)
              </h4>
              <VerticalBarChart
                data={activeSaldoRows.map((r) => ({
                  label: r.bulan,
                  value: r.realisasiBulanan ?? 0,
                  secondaryValue: r.targetBulanan ?? 0,
                }))}
                primaryLabel="Saldo Bulanan"
                secondaryLabel="Target"
                primaryColor="#0e7490"
                secondaryColor="#059669"
                unit="Jt"
                height={250}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Persentase Pencapaian Saldo Akhir Bulan (%)
            </h4>
            <HorizontalBarChart
              data={activeSaldoRows.map((r) => ({
                label: r.bulan,
                subLabel: r.catatan
                  ? `${fmtNum(r.realisasiKumulatif, 2)} Jt (${r.catatan})`
                  : `${fmtNum(r.realisasiKumulatif, 2)} Jt`,
                value: r.persentasePencapaian ?? 0,
                unit: '%',
                color: '#059669',
                negativeColor: '#dc2626',
              }))}
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Bulan</th>
                  <th className="py-2.5 px-3 text-right">Target Kumulatif (Rp Jt)</th>
                  <th className="py-2.5 px-3 text-right">Target Bulanan</th>
                  <th className="py-2.5 px-3 text-right">Realisasi Bulanan</th>
                  <th className="py-2.5 px-3 text-right">Realisasi Kumulatif</th>
                  <th className="py-2.5 px-3 text-right">% Pencapaian</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                {activeSaldoRows.map((row) => (
                  <tr
                    key={`saldo-${saldoMode}-${row.bulan}`}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                      row.isPrognosa ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-sans font-semibold text-slate-900 dark:text-slate-100">
                      {row.bulan}{' '}
                      {row.isPrognosa && (
                        <span className="ml-1 text-[10px] font-mono text-amber-700 dark:text-amber-300">
                          (PROGNOSA)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.targetKumulatif, 2)}</td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.targetBulanan, 2)}</td>
                    <td className="py-2 px-3 text-right">{fmtNum(row.realisasiBulanan, 3)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-cyan-800 dark:text-cyan-300">
                      {fmtNum(row.realisasiKumulatif, 2)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-bold ${
                        (row.persentasePencapaian ?? 0) < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {fmtPct(row.persentasePencapaian)}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-500 dark:text-slate-400">
                      {row.catatan || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: SHEET4 (gid=1120348723) */}
      {data && activeTab === 'sheet4' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Sheet4 — Matriks Ringkasan Saldo (gid=1120348723)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Menampilkan isi asli {data.sheet4Rows.length} baris ringkasan JAN–OCT dari tab Sheet4.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 px-3 font-sans">Baris</th>
                  {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT'].map(
                    (m) => (
                      <th key={m} className="py-2 px-3 text-right">
                        {m}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.sheet4Rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-sans font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {idx === 0
                        ? 'Realisasi Bulanan'
                        : idx === 1
                        ? 'Realisasi Kumulatif'
                        : idx === 2
                        ? '% Pencapaian'
                        : `Baris ${idx + 1}`}
                    </td>
                    {Array.from({ length: 10 }).map((_, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 text-right whitespace-nowrap">
                        {row[cIdx] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
