import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FolderPlus,
  RefreshCw,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeMaterialStatus,
  hasMaterialActivity,
  MaterialFormInput,
  SheetSyncResult,
} from '../services/inventoryService';
import {
  autoMapColumns,
  ColumnMapping,
  DEFAULT_SPREADSHEET_URL,
  detectHeaderAndRows,
  fetchCombinedSheetTabs,
  fetchPublishedCsvValues,
  fetchSheetValues,
  fetchSpreadsheetMetadata,
  isPublishedCsvUrl,
  mapSheetRowsToMaterials,
  parseDelimitedText,
  parseGoogleSheetUrl,
  PUBLISHED_SHEET_CSV_URL,
  SHEET_PRESETS,
  SpreadsheetMetadata,
} from '../services/sheetsService';
import { Material } from '../types/inventory';
import { DonutChart, GroupedBarChart } from './Charts';
import { MaterialStatusIndicator } from './StatusText';

interface SheetsSyncViewProps {
  accessToken: string | null;
  onReconnectGoogle: () => Promise<string | null>;
  activeProjectName: string;
  isCompleted: boolean;
  existingMaterials: Material[];
  onSyncToActiveProject: (
    items: MaterialFormInput[],
    sheetLabel: string
  ) => Promise<SheetSyncResult>;
  onRebuildActiveProject: (
    items: MaterialFormInput[],
    sheetLabel: string
  ) => Promise<SheetSyncResult>;
  onCreateProjectFromSheet: (
    projectName: string,
    sheetLabel: string,
    items: MaterialFormInput[]
  ) => Promise<SheetSyncResult>;
}

const STORAGE_KEY_URL = 'binalogistik-sheet-url-v2';

export function SheetsSyncView({
  accessToken,
  onReconnectGoogle,
  activeProjectName,
  isCompleted,
  existingMaterials,
  onSyncToActiveProject,
  onRebuildActiveProject,
  onCreateProjectFromSheet,
}: SheetsSyncViewProps) {
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_URL);
      if (saved && saved.trim()) {
        return saved;
      }
    }
    return DEFAULT_SPREADSHEET_URL;
  });

  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [selectedSheetTitle, setSelectedSheetTitle] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [combinedMaterials, setCombinedMaterials] = useState<MaterialFormInput[] | null>(
    null
  );
  const [combinedTabSummaries, setCombinedTabSummaries] = useState<
    Array<{ title: string; sheetId: number; count: number }>
  >([]);

  const [loadingSheet, setLoadingSheet] = useState(false);
  const [syncingDb, setSyncingDb] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncInfo, setLastSyncInfo] = useState<{
    time: string;
    result?: SheetSyncResult;
    actionLabel: string;
  } | null>(null);

  const [confirmMode, setConfirmMode] = useState<'rebuild' | 'upsert' | 'new_project' | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialLoadedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sheetUrl.trim()) {
      localStorage.setItem(STORAGE_KEY_URL, sheetUrl.trim());
    }
  }, [sheetUrl]);

  const loadCsvUrl = useCallback(async (targetUrl: string) => {
    setLoadingSheet(true);
    setError(null);
    setCombinedMaterials(null);
    setCombinedTabSummaries([]);
    try {
      const values = await fetchPublishedCsvValues(targetUrl);
      const detected = detectHeaderAndRows(values);
      setMetadata({
        spreadsheetId: 'published-csv',
        title: 'Spreadsheet CSV Publik · Gd Ry Sinjai',
        sheets: [{ sheetId: 0, title: 'CSV Live' }],
      });
      setSelectedSheetTitle('CSV Live');
      setHeaders(detected.headers);
      setRawRows(detected.rawRows);
      setMapping(autoMapColumns(detected.headers));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membaca link CSV Google Sheets.');
    } finally {
      setLoadingSheet(false);
    }
  }, []);

  const loadSheetData = useCallback(
    async (targetUrl: string, tokenOverride?: string | null, explicitTabTitle?: string) => {
      if (isPublishedCsvUrl(targetUrl)) {
        await loadCsvUrl(targetUrl);
        return;
      }

      const token = tokenOverride ?? accessToken;
      if (!token) {
        setError('Untuk link editor Google Sheets non-CSV, klik "Hubungkan Google Sheets" terlebih dahulu.');
        return;
      }

      const { spreadsheetId, gid } = parseGoogleSheetUrl(targetUrl);
      if (!spreadsheetId) {
        setError('Link Google Sheets tidak valid. Gunakan link publikasi CSV atau URL spreadsheet.');
        return;
      }

      setLoadingSheet(true);
      setError(null);
      setCombinedMaterials(null);
      setCombinedTabSummaries([]);

      try {
        const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
        setMetadata(meta);

        if (meta.sheets.length === 0) {
          setError('Spreadsheet tidak memiliki tab sheet yang dapat dibaca.');
          setLoadingSheet(false);
          return;
        }

        let targetTab = explicitTabTitle
          ? meta.sheets.find((s) => s.title === explicitTabTitle)
          : undefined;

        if (!targetTab && gid !== null) {
          targetTab = meta.sheets.find((s) => s.sheetId === gid);
        }
        if (!targetTab) {
          targetTab = meta.sheets[0];
        }

        setSelectedSheetTitle(targetTab.title);
        const values = await fetchSheetValues(spreadsheetId, targetTab.title, token);
        const detected = detectHeaderAndRows(values);
        setHeaders(detected.headers);
        setRawRows(detected.rawRows);
        setMapping(autoMapColumns(detected.headers));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal membaca spreadsheet.';
        if (msg === 'AUTH_EXPIRED') {
          setError('Sesi akses Google Sheets telah kedaluwarsa. Klik "Hubungkan Google Sheets" untuk memperbarui akses.');
        } else {
          setError(msg);
        }
      } finally {
        setLoadingSheet(false);
      }
    },
    [accessToken, loadCsvUrl]
  );

  const loadCombinedTabsData = useCallback(
    async (token: string, targetUrl: string) => {
      const { spreadsheetId } = parseGoogleSheetUrl(targetUrl);
      if (!spreadsheetId) {
        setError('Link Google Sheets tidak valid.');
        return;
      }

      setLoadingSheet(true);
      setError(null);

      try {
        const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
        setMetadata(meta);
        if (meta.sheets.length === 0) {
          setError('Spreadsheet tidak memiliki tab sheet yang dapat dibaca.');
          return;
        }
        const result = await fetchCombinedSheetTabs(spreadsheetId, meta.sheets, token);
        setSelectedSheetTitle('__ALL__');
        setCombinedMaterials(result.materials);
        setCombinedTabSummaries(result.tabSummaries);
        setHeaders([]);
        setRawRows([]);
        setMapping(autoMapColumns([]));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menggabungkan tab spreadsheet.';
        if (msg === 'AUTH_EXPIRED') {
          setError('Sesi akses Google Sheets telah kedaluwarsa. Klik "Hubungkan Google Sheets" untuk memperbarui akses.');
        } else {
          setError(msg);
        }
      } finally {
        setLoadingSheet(false);
      }
    },
    []
  );

  // Auto-fetch live CSV preview when opening this tab
  useEffect(() => {
    if (initialLoadedRef.current) return;
    if (isPublishedCsvUrl(sheetUrl)) {
      initialLoadedRef.current = true;
      loadCsvUrl(sheetUrl);
    } else if (accessToken) {
      initialLoadedRef.current = true;
      loadSheetData(sheetUrl, accessToken);
    }
  }, [sheetUrl, accessToken, loadCsvUrl, loadSheetData]);

  const parsedMaterials = useMemo(() => {
    if (combinedMaterials) return combinedMaterials;
    if (!mapping || rawRows.length === 0) return [];
    return mapSheetRowsToMaterials(rawRows, mapping, selectedSheetTitle || 'Gd Ry Sinjai');
  }, [combinedMaterials, rawRows, mapping, selectedSheetTitle]);

  const activeParsedCount = useMemo(
    () => parsedMaterials.filter((item) => hasMaterialActivity(item)).length,
    [parsedMaterials]
  );

  const matchSummary = useMemo(() => {
    const skuSet = new Set(existingMaterials.map((m) => m.sku.trim().toLowerCase()));
    const nameSet = new Set(existingMaterials.map((m) => m.name.trim().toLowerCase()));
    let toUpdate = 0;
    let toCreate = 0;
    for (const item of parsedMaterials) {
      if (
        skuSet.has(item.sku.trim().toLowerCase()) ||
        nameSet.has(item.name.trim().toLowerCase())
      ) {
        toUpdate++;
      } else {
        toCreate++;
      }
    }
    return { toUpdate, toCreate };
  }, [parsedMaterials, existingMaterials]);

  const sheetCharts = useMemo(() => {
    const sums = {
      awal: { dist: 0, aga: 0, te: 0 },
      masuk: { dist: 0, aga: 0, te: 0 },
      keluar: { dist: 0, aga: 0, te: 0 },
      akhir: { dist: 0, aga: 0, te: 0 },
    };
    for (const item of parsedMaterials) {
      sums.awal.dist += item.stokAwal.dist;
      sums.awal.aga += item.stokAwal.aga;
      sums.awal.te += item.stokAwal.te;
      sums.masuk.dist += item.materialMasuk.dist;
      sums.masuk.aga += item.materialMasuk.aga;
      sums.masuk.te += item.materialMasuk.te;
      sums.keluar.dist += item.materialKeluar.dist;
      sums.keluar.aga += item.materialKeluar.aga;
      sums.keluar.te += item.materialKeluar.te;
      sums.akhir.dist += item.stokAkhir.dist;
      sums.akhir.aga += item.stokAkhir.aga;
      sums.akhir.te += item.stokAkhir.te;
    }

    const groupedData = [
      {
        category: 'DIST',
        subLabel: 'Distribusi',
        values: {
          awal: sums.awal.dist,
          masuk: sums.masuk.dist,
          keluar: sums.keluar.dist,
          akhir: sums.akhir.dist,
        },
      },
      {
        category: 'AGA',
        subLabel: 'Niaga / Pelanggan',
        values: {
          awal: sums.awal.aga,
          masuk: sums.masuk.aga,
          keluar: sums.keluar.aga,
          akhir: sums.akhir.aga,
        },
      },
      {
        category: 'TE',
        subLabel: 'Transaksi Energi',
        values: {
          awal: sums.awal.te,
          masuk: sums.masuk.te,
          keluar: sums.keluar.te,
          akhir: sums.akhir.te,
        },
      },
    ];

    const syncSegments = [
      {
        label: 'Aktif Bermutasi',
        value: activeParsedCount,
        color: '#0e7490',
      },
      {
        label: 'Katalog Pasif (0 Mutasi)',
        value: Math.max(0, parsedMaterials.length - activeParsedCount),
        color: '#94a3b8',
      },
    ];

    return { groupedData, syncSegments };
  }, [parsedMaterials, activeParsedCount]);

  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    setError(null);
    try {
      const freshToken = await onReconnectGoogle();
      if (freshToken) {
        await loadSheetData(sheetUrl, freshToken);
      } else {
        setError('Izin baca Google Sheets tidak diberikan pada proses masuk.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menghubungkan akun Google Sheets.'
      );
    } finally {
      setConnectingGoogle(false);
    }
  }

  async function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const values = parseDelimitedText(text);
      if (values.length < 2) {
        setError('File CSV/TSV kosong atau tidak memiliki cukup baris data.');
        return;
      }
      const detected = detectHeaderAndRows(values);
      const cleanFileName = file.name.replace(/\.[^.]+$/, '');
      setCombinedMaterials(null);
      setCombinedTabSummaries([]);
      setMetadata({
        spreadsheetId: 'local-csv',
        title: cleanFileName,
        sheets: [{ sheetId: 0, title: 'File Lokal' }],
      });
      setSelectedSheetTitle('File Lokal');
      setHeaders(detected.headers);
      setRawRows(detected.rawRows);
      setMapping(autoMapColumns(detected.headers));
    } catch {
      setError('Gagal membaca file CSV/TSV.');
    } finally {
      e.target.value = '';
    }
  }

  async function handleExecuteSync(mode: 'rebuild' | 'upsert' | 'new_project') {
    if (parsedMaterials.length === 0) return;
    setSyncingDb(true);
    setError(null);
    try {
      const displayTab =
        selectedSheetTitle === '__ALL__' ? 'Semua Tab (Gabungan)' : selectedSheetTitle;
      const sheetLabel = `${metadata?.title || 'Google Sheets'} · ${displayTab}`;
      let result: SheetSyncResult;
      let actionLabel = 'Sinkronisasi';

      if (mode === 'rebuild') {
        result = await onRebuildActiveProject(parsedMaterials, sheetLabel);
        actionLabel = 'Hapus Data Lama & Bangun Ulang';
      } else if (mode === 'upsert') {
        result = await onSyncToActiveProject(parsedMaterials, sheetLabel);
        actionLabel = 'Tambahkan / Perbarui';
      } else {
        result = await onCreateProjectFromSheet(
          'Gd Ry Sinjai — Monitoring Material',
          sheetLabel,
          parsedMaterials
        );
        actionLabel = 'Buat Proyek Baru';
      }
      setLastSyncInfo({
        time: new Date().toLocaleTimeString('id-ID'),
        result,
        actionLabel,
      });
      setConfirmMode(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyinkronkan data ke database.'
      );
    } finally {
      setSyncingDb(false);
    }
  }

  function updateMappingField(key: keyof ColumnMapping, colIndex: number) {
    setMapping((prev) => (prev ? { ...prev, [key]: colIndex } : null));
  }

  const csvMode = isPublishedCsvUrl(sheetUrl);

  return (
    <div className="space-y-5">
      {/* Spreadsheet Connection & URL Configuration */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Integrasi Sumber Data Google Sheets (CSV Live &amp; API)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Terhubung langsung ke publikasi CSV <strong>Gd Ry Sinjai</strong> (No, Gudang, No Material, Nama Material, Satuan, Stok Awal, Material Masuk, Material Keluar, Stok Akhir per DIST/AGA/TE, Keterangan).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={sheetUrl || PUBLISHED_SHEET_CSV_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <span>Buka Sumber</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Preset Sheet Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Sumber Cepat:
          </span>
          {SHEET_PRESETS.map((preset) => {
            const isSelected = sheetUrl.trim() === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setSheetUrl(preset.url);
                  if (preset.mode === 'csv') {
                    loadCsvUrl(preset.url);
                  } else if (accessToken) {
                    loadSheetData(preset.url, accessToken);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-600 text-cyan-800 dark:text-cyan-300'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          {accessToken && !csvMode && (
            <button
              type="button"
              disabled={loadingSheet}
              onClick={() => loadCombinedTabsData(accessToken, sheetUrl)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                selectedSheetTitle === '__ALL__'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 text-indigo-800 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Gabung Semua Tab
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-2.5">
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
            className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleCsvUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CSV / TSV</span>
          </button>

          {csvMode ? (
            <button
              type="button"
              onClick={() => loadCsvUrl(sheetUrl)}
              disabled={loadingSheet}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSheet ? 'animate-spin' : ''}`} />
              <span>{loadingSheet ? 'Memuat CSV...' : 'Muat CSV Live'}</span>
            </button>
          ) : !accessToken ? (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <span>
                {connectingGoogle ? 'Menghubungkan...' : 'Hubungkan Google Sheets'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                selectedSheetTitle === '__ALL__'
                  ? loadCombinedTabsData(accessToken, sheetUrl)
                  : loadSheetData(sheetUrl, accessToken)
              }
              disabled={loadingSheet}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSheet ? 'animate-spin' : ''}`} />
              <span>{loadingSheet ? 'Memuat...' : 'Muat Data Sheet'}</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {lastSyncInfo?.result && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-lg flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                <strong>{lastSyncInfo.actionLabel}</strong> selesai pukul{' '}
                <strong className="font-mono">{lastSyncInfo.time}</strong>:{' '}
                {typeof lastSyncInfo.result.deletedCount === 'number' && (
                  <>
                    <strong className="font-mono">{lastSyncInfo.result.deletedCount}</strong> data lama dihapus,{' '}
                  </>
                )}
                <strong className="font-mono">{lastSyncInfo.result.createdCount}</strong> material dimuat,{' '}
                <strong className="font-mono">{lastSyncInfo.result.updatedCount}</strong> diperbarui,{' '}
                <strong className="font-mono">{lastSyncInfo.result.notificationsTriggered}</strong> notifikasi dipicu.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Sheet Metadata, Column Mapper & Actions */}
      {metadata && mapping && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sumber Data Terbaca
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {metadata.title}
              </div>
            </div>

            {metadata.sheets.length > 1 && accessToken && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Tab Sheet:
                </label>
                <select
                  value={selectedSheetTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!accessToken) return;
                    if (val === '__ALL__') {
                      loadCombinedTabsData(accessToken, sheetUrl);
                    } else {
                      loadSheetData(sheetUrl, accessToken, val);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {metadata.sheets.map((tab) => (
                    <option key={tab.sheetId} value={tab.title}>
                      {tab.title} (gid: {tab.sheetId})
                    </option>
                  ))}
                  <option value="__ALL__">Gabungkan Semua Tab</option>
                </select>
              </div>
            )}
          </div>

          {selectedSheetTitle === '__ALL__' ? (
            <div className="flex flex-wrap gap-2">
              {combinedTabSummaries.map((tab) => (
                <div
                  key={tab.sheetId}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums"
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {tab.title}
                  </span>{' '}
                  — <span className="text-cyan-700 dark:text-cyan-400 font-semibold">{tab.count} item</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
                Pemetaan Kolom Sheet ke Database Stok (Otomatis 22 Kolom)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {(
                  [
                    { key: 'rowNumCol', label: 'No' },
                    { key: 'zoneCol', label: 'Gudang' },
                    { key: 'skuCol', label: 'No Material' },
                    { key: 'nameCol', label: 'Nama Material *' },
                    { key: 'unitCol', label: 'Satuan' },
                    { key: 'awalTotalCol', label: 'Stok Awal TOTAL' },
                    { key: 'masukTotalCol', label: 'Masuk TOTAL' },
                    { key: 'keluarTotalCol', label: 'Keluar TOTAL' },
                    { key: 'akhirTotalCol', label: 'Stok Akhir TOTAL' },
                    { key: 'akhirDistCol', label: 'Stok Akhir DIST' },
                    { key: 'akhirAgaCol', label: 'Stok Akhir AGA' },
                    { key: 'notesCol', label: 'Keterangan' },
                  ] as Array<{ key: keyof ColumnMapping; label: string }>
                ).map((field) => (
                  <div key={field.key}>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">
                      {field.label}
                    </label>
                    <select
                      value={mapping[field.key]}
                      onChange={(e) =>
                        updateMappingField(field.key, Number(e.target.value))
                      }
                      className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100"
                    >
                      <option value={-1}>— Otomatis / Kosong —</option>
                      {headers.map((h, idx) => (
                        <option key={`${idx}-${h}`} value={idx}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
              Terbaca <strong>{parsedMaterials.length.toLocaleString('id-ID')}</strong> material (
              <strong>{activeParsedCount}</strong> aktif bermutasi · {matchSummary.toCreate} baru · {matchSummary.toUpdate} cocok)
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={parsedMaterials.length === 0 || syncingDb}
                onClick={() => setConfirmMode('new_project')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Buat Proyek Baru</span>
              </button>

              <button
                type="button"
                disabled={parsedMaterials.length === 0 || syncingDb || isCompleted}
                onClick={() => setConfirmMode('upsert')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tambah / Perbarui</span>
              </button>

              <button
                type="button"
                disabled={parsedMaterials.length === 0 || syncingDb || isCompleted}
                onClick={() => setConfirmMode('rebuild')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hapus Data Lama &amp; Bangun Ulang</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Visual Chart Summary of Loaded Spreadsheet */}
      {metadata && parsedMaterials.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Grafik Ringkasan Data Terbaca dari Spreadsheet
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="lg:col-span-7 space-y-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Agregasi per Bidang (DIST / AGA / TE) pada Sumber CSV
              </div>
              <GroupedBarChart
                series={[
                  { key: 'awal', label: 'Stok Awal', color: '#64748b' },
                  { key: 'masuk', label: 'Masuk', color: '#059669' },
                  { key: 'keluar', label: 'Keluar', color: '#d97706' },
                  { key: 'akhir', label: 'Stok Akhir', color: '#0e7490' },
                ]}
                data={sheetCharts.groupedData}
              />
            </div>

            <div className="lg:col-span-5 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Proporsi Material Aktif vs Pasif ({matchSummary.toCreate} Baru · {matchSummary.toUpdate} Cocok)
              </div>
              <DonutChart
                segments={sheetCharts.syncSegments}
                centerTitle="Terbaca"
                centerValue={parsedMaterials.length.toLocaleString('id-ID')}
              />
            </div>
          </div>
        </section>
      )}

      {/* Parsed Preview Table */}
      {metadata && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Pratinjau Data Material (Sesuai Kolom Spreadsheet)
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {parsedMaterials.length.toLocaleString('id-ID')} baris
            </span>
          </div>

          {parsedMaterials.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              Tidak ada baris material yang dapat dipetakan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40 uppercase">
                    <th className="py-2.5 px-3 text-center">No</th>
                    <th className="py-2.5 px-3">Gudang</th>
                    <th className="py-2.5 px-3">No Material</th>
                    <th className="py-2.5 px-3">Nama Material</th>
                    <th className="py-2.5 px-2 text-center">Sat</th>
                    <th className="py-2.5 px-3 text-right">Awal</th>
                    <th className="py-2.5 px-3 text-right">Masuk</th>
                    <th className="py-2.5 px-3 text-right">Keluar</th>
                    <th className="py-2.5 px-3 text-right">Akhir (D/A/T)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Ket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {[...parsedMaterials]
                    .sort((a, b) => Number(hasMaterialActivity(b)) - Number(hasMaterialActivity(a)))
                    .slice(0, 60)
                    .map((item) => {
                      const status = computeMaterialStatus(
                        item.currentStock,
                        item.minThreshold,
                        item.criticalThreshold
                      );
                      const isInactive = !hasMaterialActivity(item) && item.minThreshold === 0;
                      return (
                        <tr
                          key={`${item.rowNumber}-${item.sku}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2 px-3 text-center font-mono text-slate-500">
                            {item.rowNumber}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {item.warehouseZone}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {item.sku}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-[240px] truncate">
                            {item.name}
                          </td>
                          <td className="py-2 px-2 text-center font-mono">{item.unit}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {item.stokAwal.total}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                            {item.materialMasuk.total}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                            {item.materialKeluar.total}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.stokAkhir.total}
                            </span>{' '}
                            <span className="text-[10px] text-slate-500">
                              ({item.stokAkhir.dist}/{item.stokAkhir.aga}/{item.stokAkhir.te})
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <MaterialStatusIndicator status={status} isInactive={isInactive} />
                          </td>
                          <td className="py-2 px-3 text-slate-500 max-w-[120px] truncate">
                            {item.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {parsedMaterials.length > 60 && (
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                  Menampilkan 60 baris teratas (prioritas material aktif) dari total{' '}
                  {parsedMaterials.length.toLocaleString('id-ID')} material. Seluruh baris akan disimpan ke Firestore.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Confirmation Modal */}
      {confirmMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {confirmMode === 'rebuild'
                ? 'Hapus Data Lama & Bangun Ulang Database?'
                : confirmMode === 'upsert'
                ? 'Konfirmasi Pembaruan Stok dari Spreadsheet'
                : 'Buat Proyek Baru dari Spreadsheet?'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmMode === 'rebuild' ? (
                <>
                  Seluruh <strong>{existingMaterials.length.toLocaleString('id-ID')}</strong> material lama, log mutasi, dan notifikasi pada{' '}
                  <strong>{activeProjectName}</strong> akan dihapus permanen, lalu dibangun ulang dengan{' '}
                  <strong>{parsedMaterials.length.toLocaleString('id-ID')} baris</strong> langsung dari spreadsheet CSV.
                </>
              ) : confirmMode === 'upsert' ? (
                <>
                  Sistem akan menyinkronkan{' '}
                  <strong>{parsedMaterials.length.toLocaleString('id-ID')} material</strong> ke proyek{' '}
                  <strong>{activeProjectName}</strong> ({matchSummary.toCreate} item baru, {matchSummary.toUpdate} diperbarui).
                </>
              ) : (
                <>
                  Sistem akan membuat gudang baru bernama{' '}
                  <strong>Gd Ry Sinjai — Monitoring Material</strong> dengan{' '}
                  <strong>{parsedMaterials.length.toLocaleString('id-ID')} material</strong>.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={syncingDb}
                onClick={() => setConfirmMode(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={syncingDb}
                onClick={() => handleExecuteSync(confirmMode)}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors disabled:opacity-50 ${
                  confirmMode === 'rebuild'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-cyan-700 hover:bg-cyan-800'
                }`}
              >
                {syncingDb ? 'Memproses Database...' : 'Konfirmasi & Jalankan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
