import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Layers,
  RefreshCw,
  Search,
  Table2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildChartsForWorkbookSheet } from '../services/chartAggregations';
import { parseSignedNumericCell } from '../services/sheetsService';
import {
  exportWorkbookSheetToCSV,
  fetchWorkbookSheet,
  getWorkbookSheetCsvUrl,
  ParsedWorkbookSheet,
  REKAP_WORKBOOK_CSV_URL,
  REKAP_WORKBOOK_SHEETS,
  WORKBOOK_GROUPS,
  WorkbookGroupId,
  WorkbookSheetMeta,
} from '../services/workbookService';
import { DonutChart, HorizontalBarChart, VerticalBarChart } from './Charts';

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

export function WorkbookSheetsView() {
  const [selectedGid, setSelectedGid] = useState<string>(
    REKAP_WORKBOOK_SHEETS[0].gid
  );
  const [activeGroupFilter, setActiveGroupFilter] = useState<
    WorkbookGroupId | 'all'
  >('all');
  const [cache, setCache] = useState<Record<string, ParsedWorkbookSheet>>({});
  const [loadingGids, setLoadingGids] = useState<Record<string, boolean>>({});
  const [loadingAll, setLoadingAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showCharts, setShowCharts] = useState(true);

  const activeMeta: WorkbookSheetMeta = useMemo(
    () =>
      REKAP_WORKBOOK_SHEETS.find((s) => s.gid === selectedGid) ||
      REKAP_WORKBOOK_SHEETS[0],
    [selectedGid]
  );

  const loadSingleSheet = useCallback(
    async (meta: WorkbookSheetMeta, forceReload = false) => {
      if (!forceReload && cache[meta.gid]) return;

      setLoadingGids((prev) => ({ ...prev, [meta.gid]: true }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[meta.gid];
        return next;
      });

      try {
        const parsed = await fetchWorkbookSheet(meta);
        setCache((prev) => ({ ...prev, [meta.gid]: parsed }));
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : `Gagal memuat sheet ${meta.name}.`;
        setErrors((prev) => ({ ...prev, [meta.gid]: msg }));
      } finally {
        setLoadingGids((prev) => ({ ...prev, [meta.gid]: false }));
      }
    },
    [cache]
  );

  useEffect(() => {
    loadSingleSheet(activeMeta, false);
  }, [activeMeta, loadSingleSheet]);

  const handleLoadAllSheets = useCallback(async () => {
    setLoadingAll(true);
    try {
      await Promise.allSettled(
        REKAP_WORKBOOK_SHEETS.map(async (meta) => {
          setLoadingGids((prev) => ({ ...prev, [meta.gid]: true }));
          try {
            const parsed = await fetchWorkbookSheet(meta);
            setCache((prev) => ({ ...prev, [meta.gid]: parsed }));
            setErrors((prev) => {
              const next = { ...prev };
              delete next[meta.gid];
              return next;
            });
          } catch (err) {
            const msg =
              err instanceof Error
                ? err.message
                : `Gagal memuat ${meta.name}`;
            setErrors((prev) => ({ ...prev, [meta.gid]: msg }));
          } finally {
            setLoadingGids((prev) => ({ ...prev, [meta.gid]: false }));
          }
        })
      );
    } finally {
      setLoadingAll(false);
    }
  }, []);

  const handleSelectSheet = (gid: string) => {
    setSelectedGid(gid);
    setSearch('');
    setPage(1);
    setSortCol(null);
    setSortDir('asc');
  };

  const activeData = cache[activeMeta.gid] || null;
  const activeLoading = Boolean(loadingGids[activeMeta.gid]);
  const activeError = errors[activeMeta.gid] || null;

  const filteredAndSortedRows = useMemo(() => {
    if (!activeData) return [];
    const q = search.trim().toLowerCase();

    let result = q
      ? activeData.rows.filter((row) =>
          row.some((cell) => cell.toLowerCase().includes(q))
        )
      : activeData.rows;

    if (sortCol !== null && sortCol >= 0 && sortCol < activeData.headers.length) {
      const isNum = activeData.numericColIndices.includes(sortCol);
      const factor = sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const valA = a[sortCol] ?? '';
        const valB = b[sortCol] ?? '';
        if (isNum) {
          return (parseSignedNumericCell(valA) - parseSignedNumericCell(valB)) * factor;
        }
        return valA.localeCompare(valB, 'id', { numeric: true }) * factor;
      });
    }

    return result;
  }, [activeData, search, sortCol, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedRows.length / pageSize)
  );
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  const visibleGroups = useMemo(() => {
    if (activeGroupFilter === 'all') return WORKBOOK_GROUPS;
    return WORKBOOK_GROUPS.filter((g) => g.id === activeGroupFilter);
  }, [activeGroupFilter]);

  const chartBundle = useMemo(() => {
    if (!activeData) return null;
    return buildChartsForWorkbookSheet(activeData);
  }, [activeData]);

  const loadedCount = Object.keys(cache).length;

  const toggleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Top Workbook Overview & Group Filter */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold">
                <Layers className="w-3.5 h-3.5" />
                <span>Workbook Terlampir · {REKAP_WORKBOOK_SHEETS.length} Sheet</span>
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono font-semibold">
                {loadedCount}/{REKAP_WORKBOOK_SHEETS.length} Termuat
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              Rekapitulasi Data Workbook Material &amp; Mutasi (Dikelompokkan per Sheet)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan seluruh {REKAP_WORKBOOK_SHEETS.length} tab sheet dari sumber spreadsheet CSV terlampir dalam 4 kelompok operasional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={REKAP_WORKBOOK_CSV_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Link Spreadsheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              disabled={loadingAll}
              onClick={handleLoadAllSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Database className={`w-3.5 h-3.5 ${loadingAll ? 'animate-pulse' : ''}`} />
              <span>{loadingAll ? 'Memuat Semua...' : 'Muat Ringkasan 10 Sheet'}</span>
            </button>
          </div>
        </div>

        {/* Group Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveGroupFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeGroupFilter === 'all'
                ? 'bg-cyan-700 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Semua Kelompok ({REKAP_WORKBOOK_SHEETS.length})
          </button>

          {WORKBOOK_GROUPS.map((group) => {
            const count = REKAP_WORKBOOK_SHEETS.filter(
              (s) => s.group === group.id
            ).length;
            const isActive = activeGroupFilter === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroupFilter(group.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-cyan-700 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {group.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Grouped Sheet Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleGroups.map((group) => {
            const sheetsInGroup = REKAP_WORKBOOK_SHEETS.filter(
              (s) => s.group === group.id
            );
            return (
              <div
                key={group.id}
                className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {group.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {group.description}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    {sheetsInGroup.length} sheet
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {sheetsInGroup.map((sheet) => {
                    const isSelected = sheet.gid === activeMeta.gid;
                    const cached = cache[sheet.gid];
                    const isBusy = Boolean(loadingGids[sheet.gid]);
                    return (
                      <button
                        key={sheet.gid}
                        type="button"
                        onClick={() => handleSelectSheet(sheet.gid)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'bg-cyan-700 text-white border-cyan-700 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-cyan-500'
                        }`}
                      >
                        <Table2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-cyan-200' : 'text-cyan-700 dark:text-cyan-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold leading-tight">
                            {sheet.name}
                          </div>
                          <div
                            className={`text-[10px] font-mono leading-tight mt-0.5 ${
                              isSelected
                                ? 'text-cyan-100'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {isBusy
                              ? 'Memuat...'
                              : cached
                              ? `${cached.rows.length.toLocaleString('id-ID')} baris`
                              : `gid=${sheet.gid}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dynamic Chart Section for Active Sheet */}
      {chartBundle && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Grafik Visualisasi Data: {activeMeta.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCharts((s) => !s)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              {showCharts ? 'Sembunyikan Grafik' : 'Tampilkan Grafik'}
            </button>
          </div>

          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="lg:col-span-7 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {chartBundle.leftTitle}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {chartBundle.leftSubtitle}
                  </p>
                </div>
                {chartBundle.leftType === 'vertical' ? (
                  <VerticalBarChart
                    data={chartBundle.leftVerticalData || []}
                    primaryLabel={
                      chartBundle.leftVerticalPrimaryLabel || 'Jumlah'
                    }
                    primaryColor={
                      activeMeta.gid === '1600935918' ? '#059669' : '#d97706'
                    }
                  />
                ) : (
                  <HorizontalBarChart
                    data={chartBundle.leftHorizontalData || []}
                  />
                )}
              </div>

              <div className="lg:col-span-5 space-y-3 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {chartBundle.rightTitle}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {chartBundle.rightSubtitle}
                  </p>
                </div>
                {chartBundle.rightType === 'donut' ? (
                  <DonutChart
                    segments={chartBundle.rightDonutSegments || []}
                    centerTitle={chartBundle.rightDonutCenterTitle || 'Total'}
                    centerValue={chartBundle.rightDonutCenterValue || '0'}
                  />
                ) : chartBundle.rightType === 'vertical' ? (
                  <VerticalBarChart
                    data={chartBundle.rightVerticalData || []}
                    primaryLabel={
                      chartBundle.rightVerticalPrimaryLabel || 'Jumlah'
                    }
                  />
                ) : (
                  <HorizontalBarChart
                    data={chartBundle.rightHorizontalData || []}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Active Sheet Details & KPIs */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeMeta.name}
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                  gid={activeMeta.gid}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 rounded">
                  {WORKBOOK_GROUPS.find((g) => g.id === activeMeta.group)?.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeMeta.subtitle}
                {activeData?.fetchedAt && (
                  <>
                    {' '}
                    · Live pukul{' '}
                    <span className="font-mono">
                      {activeData.fetchedAt.toLocaleTimeString('id-ID')}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={getWorkbookSheetCsvUrl(activeMeta.gid)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <span>CSV Sheet Ini</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                disabled={!activeData || filteredAndSortedRows.length === 0}
                onClick={() =>
                  activeData &&
                  exportWorkbookSheetToCSV(activeData, filteredAndSortedRows)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>

              <button
                type="button"
                disabled={activeLoading}
                onClick={() => loadSingleSheet(activeMeta, true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${activeLoading ? 'animate-spin' : ''}`}
                />
                <span>{activeLoading ? 'Memuat...' : 'Muat Ulang'}</span>
              </button>
            </div>
          </div>

          {/* Active Sheet KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                <span>TOTAL BARIS</span>
                <Table2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {activeData
                  ? activeData.rows.length.toLocaleString('id-ID')
                  : '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-cyan-700 dark:text-cyan-400">
                <span>BARIS TERFILTER</span>
                <Search className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-cyan-800 dark:text-cyan-300 mt-1">
                {activeData
                  ? filteredAndSortedRows.length.toLocaleString('id-ID')
                  : '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-400">
                <span>KOLOM AKTIF</span>
                <Columns3 className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-indigo-800 dark:text-indigo-300 mt-1">
                {activeData ? activeData.headers.length : '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 truncate uppercase">
                {activeData?.primaryStatLabel || 'KELOMPOK SHEET'}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300 mt-1 truncate">
                {activeData?.primaryStatValue !== null &&
                activeData?.primaryStatValue !== undefined
                  ? activeData.primaryStatValue.toLocaleString('id-ID')
                  : WORKBOOK_GROUPS.find((g) => g.id === activeMeta.group)
                      ?.label}
              </div>
            </div>
          </div>

          {/* Search & Page Size Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={`Cari di semua kolom ${activeMeta.name}...`}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Baris / halaman:
              </span>
              <select
                aria-label="Jumlah baris per halaman"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {activeError && (
          <div className="m-5 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{activeError}</span>
          </div>
        )}

        {/* Loading State */}
        {activeLoading && !activeData ? (
          <div className="p-6 space-y-2.5 animate-pulse">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg"
              />
            ))}
          </div>
        ) : activeData && activeData.rows.length === 0 ? (
          /* Empty Sheet State (Sheet1, Sheet2, Sheet3) */
          <div className="p-12 text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FolderOpen className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Sheet &ldquo;{activeMeta.name}&rdquo; Belum Memiliki Data
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Tab dengan <span className="font-mono">gid={activeMeta.gid}</span> saat ini kosong (0 baris) pada Google Spreadsheet sumber.
            </p>
          </div>
        ) : filteredAndSortedRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada data pada sheet <strong>{activeMeta.name}</strong> yang cocok dengan kata kunci &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <>
            {/* Dynamic Scrollable Table */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 shadow-2xs">
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    <th className="py-2.5 px-3 text-center border-r border-slate-200/80 dark:border-slate-700 w-12 font-mono">
                      #
                    </th>
                    {activeData?.headers.map((header, colIdx) => {
                      const isNumeric =
                        activeData.numericColIndices.includes(colIdx);
                      return (
                        <th
                          key={`${colIdx}-${header}`}
                          className={`py-2.5 px-3 border-r border-slate-200/80 dark:border-slate-700 whitespace-nowrap ${
                            isNumeric ? 'text-right' : 'text-left'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(colIdx)}
                            className={`inline-flex items-center gap-1 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors ${
                              isNumeric ? 'flex-row-reverse' : ''
                            }`}
                          >
                            <span>{header}</span>
                            <ArrowUpDown
                              className={`w-3 h-3 ${
                                sortCol === colIdx
                                  ? 'text-cyan-700 dark:text-cyan-300'
                                  : 'opacity-40'
                              }`}
                            />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {pagedRows.map((row, rIdx) => {
                    const globalIdx = (currentPage - 1) * pageSize + rIdx + 1;
                    return (
                      <tr
                        key={globalIdx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100 dark:border-slate-800">
                          {globalIdx}
                        </td>
                        {activeData?.headers.map((_, colIdx) => {
                          const cell = row[colIdx] ?? '';
                          const isNumeric =
                            activeData.numericColIndices.includes(colIdx);
                          const isCode =
                            activeData.codeColIndices.includes(colIdx);
                          const isNegative =
                            isNumeric && /^-\d/.test(cell.trim());

                          return (
                            <td
                              key={colIdx}
                              className={`py-2 px-3 border-r border-slate-100 dark:border-slate-800/70 ${
                                isNumeric
                                  ? 'text-right font-mono tabular-nums whitespace-nowrap font-medium'
                                  : isCode
                                  ? 'font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300'
                                  : 'text-slate-800 dark:text-slate-200 max-w-[320px] truncate'
                              } ${
                                isNegative
                                  ? 'text-red-600 dark:text-red-400 font-bold'
                                  : ''
                              }`}
                              title={cell.length > 35 ? cell : undefined}
                            >
                              {cell || (
                                <span className="text-slate-300 dark:text-slate-700">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                Menampilkan{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {((currentPage - 1) * pageSize + 1).toLocaleString('id-ID')}
                </strong>
                –
                <strong className="text-slate-900 dark:text-slate-100">
                  {Math.min(
                    currentPage * pageSize,
                    filteredAndSortedRows.length
                  ).toLocaleString('id-ID')}
                </strong>{' '}
                dari{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {filteredAndSortedRows.length.toLocaleString('id-ID')}
                </strong>{' '}
                baris
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                  aria-label="Halaman pertama"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Halaman sebelumnya"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Halaman berikutnya"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  aria-label="Halaman terakhir"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
