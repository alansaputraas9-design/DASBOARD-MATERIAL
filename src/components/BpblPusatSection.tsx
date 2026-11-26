import {
  AlertCircle,
  Building2,
  Camera,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderKanban,
  Layers,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BPBL_PUSAT_SPREADSHEET_EDIT_URL,
  BpblPusatDataset,
  BpblPusatGroupBy,
  BpblPusatRecord,
  exportBpblPusatToCSV,
  fetchBpblPusatData,
  groupBpblPusatRecords,
} from '../services/bpblPusatService';
import { DonutChart, HorizontalBarChart } from './Charts';

const GROUP_MODES: Array<{
  id: BpblPusatGroupBy;
  label: string;
  description: string;
}> = [
  {
    id: 'kecamatan',
    label: 'Kecamatan',
    description: 'Pengelompokan berdasarkan wilayah kecamatan & KD_KEC',
  },
  {
    id: 'desa',
    label: 'Desa / Kelurahan',
    description: 'Pengelompokan berdasarkan desa/kelurahan & KD_KEL',
  },
  {
    id: 'alamat',
    label: 'Alamat / Dusun',
    description: 'Pengelompokan per dusun, jalan, atau lorong alamat',
  },
  {
    id: 'sumberData',
    label: 'Sumber Data',
    description: 'Pengelompokan kategori usulan (INTI / lainnya)',
  },
  {
    id: 'kabupaten',
    label: 'Kabupaten / Kota',
    description: 'Pengelompokan nilai kolom KABUPATENKOTA pada sheet',
  },
  {
    id: 'unitPln',
    label: 'Unit PLN',
    description: 'Pengelompokan UIW/UID, UP3 & ULP penanggung jawab',
  },
  {
    id: 'dokumentasi',
    label: 'Dokumentasi',
    description: 'Status kelengkapan kolom Dokumentasi Pemasangan Instalasi',
  },
];

const CHART_PALETTE = [
  '#0284c7',
  '#059669',
  '#0d9488',
  '#4f46e5',
  '#d97706',
  '#0891b2',
  '#2563eb',
  '#65a30d',
  '#e11d48',
  '#64748b',
];

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function BpblPusatSection() {
  const [dataset, setDataset] = useState<BpblPusatDataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [groupBy, setGroupBy] = useState<BpblPusatGroupBy>('kecamatan');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [kecamatanFilter, setKecamatanFilter] = useState<string>('ALL');
  const [desaFilter, setDesaFilter] = useState<string>('ALL');
  const [sumberFilter, setSumberFilter] = useState<string>('ALL');
  const [kabupatenFilter, setKabupatenFilter] = useState<string>('ALL');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await fetchBpblPusatData();
      setDataset(next);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : 'Gagal memuat data BPBL Anggaran Pusat 2026.'
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    const syncActive = () => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    };
    const interval = window.setInterval(syncActive, 60_000);
    document.addEventListener('visibilitychange', syncActive);
    window.addEventListener('focus', syncActive);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', syncActive);
      window.removeEventListener('focus', syncActive);
    };
  }, [loadData]);

  const records = useMemo(() => dataset?.records || [], [dataset]);

  const handleChangeGroupBy = (mode: BpblPusatGroupBy) => {
    setGroupBy(mode);
    setSelectedGroupKey(null);
  };

  const summary = useMemo(() => {
    const kecamatanSet = new Set<string>();
    const desaSet = new Set<string>();
    const alamatSet = new Set<string>();
    const sumberMap = new Map<string, number>();
    let dokumentasiCount = 0;

    for (const r of records) {
      if (r.kecamatan && r.kecamatan !== 'Tidak Tercantum') {
        kecamatanSet.add(r.kecamatan);
      }
      if (r.desaKelurahan && r.desaKelurahan !== 'Tidak Tercantum') {
        desaSet.add(`${r.kecamatan}::${r.desaKelurahan}`);
      }
      if (r.alamat && r.alamat !== '—') {
        alamatSet.add(`${r.desaKelurahan}::${r.alamat}`);
      }
      const s = r.sumberData || 'Belum Terisi';
      sumberMap.set(s, (sumberMap.get(s) || 0) + 1);
      if (r.dokumentasiInstalasi) dokumentasiCount += 1;
    }

    const sumberSummary = Array.from(sumberMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${v} ${k}`)
      .join(' · ');

    return {
      total: records.length,
      kecamatanCount: kecamatanSet.size,
      kecamatanList: Array.from(kecamatanSet).sort(),
      desaCount: desaSet.size,
      alamatCount: alamatSet.size,
      dokumentasiCount,
      sumberSummary: sumberSummary || 'Menunggu data',
    };
  }, [records]);

  const groups = useMemo(
    () => groupBpblPusatRecords(records, groupBy),
    [records, groupBy]
  );

  const selectedGroup = useMemo(
    () =>
      selectedGroupKey
        ? groups.find((g) => g.key === selectedGroupKey) || null
        : null,
    [groups, selectedGroupKey]
  );

  const kecamatanOptions = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.kecamatan))).sort((a, b) =>
      a.localeCompare(b, 'id-ID')
    );
  }, [records]);

  const desaOptions = useMemo(() => {
    const source =
      kecamatanFilter === 'ALL'
        ? records
        : records.filter((r) => r.kecamatan === kecamatanFilter);
    return Array.from(new Set(source.map((r) => r.desaKelurahan))).sort((a, b) =>
      a.localeCompare(b, 'id-ID')
    );
  }, [records, kecamatanFilter]);

  const sumberOptions = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.sumberData))).sort((a, b) =>
      a.localeCompare(b, 'id-ID')
    );
  }, [records]);

  const kabupatenOptions = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.kabupatenKota))).sort((a, b) =>
      a.localeCompare(b, 'id-ID')
    );
  }, [records]);

  const filteredRecords = useMemo<BpblPusatRecord[]>(() => {
    const base = selectedGroup ? selectedGroup.records : records;
    const q = searchQuery.trim().toLowerCase();

    return base.filter((r) => {
      if (kecamatanFilter !== 'ALL' && r.kecamatan !== kecamatanFilter) {
        return false;
      }
      if (desaFilter !== 'ALL' && r.desaKelurahan !== desaFilter) {
        return false;
      }
      if (sumberFilter !== 'ALL' && r.sumberData !== sumberFilter) {
        return false;
      }
      if (kabupatenFilter !== 'ALL' && r.kabupatenKota !== kabupatenFilter) {
        return false;
      }

      if (!q) return true;
      return (
        r.no.toLowerCase().includes(q) ||
        r.namaPelanggan.toLowerCase().includes(q) ||
        r.namaKk.toLowerCase().includes(q) ||
        r.nik.toLowerCase().includes(q) ||
        r.nomorKk.toLowerCase().includes(q) ||
        r.kecamatan.toLowerCase().includes(q) ||
        r.desaKelurahan.toLowerCase().includes(q) ||
        r.alamat.toLowerCase().includes(q) ||
        r.kabupatenKota.toLowerCase().includes(q) ||
        r.sumberData.toLowerCase().includes(q)
      );
    });
  }, [
    selectedGroup,
    records,
    searchQuery,
    kecamatanFilter,
    desaFilter,
    sumberFilter,
    kabupatenFilter,
  ]);

  const donutSegments = useMemo(() => {
    const top = groups.slice(0, 7);
    const restCount = groups.slice(7).reduce((sum, g) => sum + g.count, 0);
    const segs = top.map((g, idx) => ({
      label: g.label,
      value: g.count,
      color: CHART_PALETTE[idx % CHART_PALETTE.length],
    }));
    if (restCount > 0) {
      segs.push({
        label: `Lainnya (${groups.length - 7} grup)`,
        value: restCount,
        color: '#64748b',
      });
    }
    return segs;
  }, [groups]);

  const barData = useMemo(() => {
    return groups.slice(0, 12).map((g, idx) => ({
      label: g.label,
      subLabel: g.parentLabel || g.code,
      value: g.count,
      unit: 'pelanggan',
      color: CHART_PALETTE[idx % CHART_PALETTE.length],
    }));
  }, [groups]);

  const activeGroupMeta =
    GROUP_MODES.find((m) => m.id === groupBy) || GROUP_MODES[0];

  const hasActiveFilters =
    Boolean(selectedGroupKey) ||
    Boolean(searchQuery.trim()) ||
    kecamatanFilter !== 'ALL' ||
    desaFilter !== 'ALL' ||
    sumberFilter !== 'ALL' ||
    kabupatenFilter !== 'ALL';

  const resetAllFilters = () => {
    setSelectedGroupKey(null);
    setSearchQuery('');
    setKecamatanFilter('ALL');
    setDesaFilter('ALL');
    setSumberFilter('ALL');
    setKabupatenFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Header Control Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>BPBL Anggaran Pusat 2026 · Sinkronisasi Google Sheets Live</span>
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
              Data Pelanggan BPBL ULP Kalebajeng (Anggaran Pusat Tahun 2026)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
              {dataset?.title || 'Memuat data dari spreadsheet terlampir...'}
              {dataset
                ? ` · Disinkronkan ${dataset.fetchedAt.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}`
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={BPBL_PUSAT_SPREADSHEET_EDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Buka Spreadsheet</span>
            </a>

            <button
              type="button"
              disabled={loading}
              onClick={() => loadData()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Menyinkronkan...' : 'Muat Ulang Live'}</span>
            </button>

            {filteredRecords.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  exportBpblPusatToCSV(
                    filteredRecords,
                    selectedGroup ? selectedGroup.label : activeGroupMeta.id
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-amber-300/90 hover:bg-amber-400 border border-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV ({filteredRecords.length})</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !dataset ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
          <div className="h-5 w-64 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg"
              />
            ))}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
            Membaca data live BPBL Anggaran Pusat 2026 dari Google Sheets...
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Total Pelanggan</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summary.total}
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono truncate">
                Sumber: {summary.sumberSummary}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800/80 shadow-2xs">
              <div className="text-[11px] font-medium text-cyan-800 dark:text-cyan-400 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Kecamatan</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                {summary.kecamatanCount}
              </div>
              <div
                className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 truncate"
                title={summary.kecamatanList.join(', ')}
              >
                {summary.kecamatanList.join(', ') || '—'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
              <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 uppercase flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Desa / Kelurahan</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {summary.desaCount}
              </div>
              <div className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                Wilayah kode KD_KEL terdaftar
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800/80 shadow-2xs">
              <div className="text-[11px] font-medium text-sky-800 dark:text-sky-400 uppercase flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>Alamat / Dusun</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400">
                {summary.alamatCount}
              </div>
              <div className="mt-1 text-[11px] text-sky-800 dark:text-sky-300">
                Titik dusun / jalan / lorong unik
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Dokumentasi Pasang</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summary.dokumentasiCount}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  {' '}
                  / {summary.total}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                {summary.dokumentasiCount > 0
                  ? 'Terisi di kolom dokumentasi'
                  : 'Menunggu unggahan dokumentasi'}
              </div>
            </div>
          </section>

          {/* Interactive Grouping Explorer */}
          <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                  <FolderKanban className="w-4 h-4 shrink-0" />
                  <span>Pengelompokan Berdasarkan Kolom Spreadsheet</span>
                </div>
                <h2 className="mt-0.5 text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Rekapitulasi per {activeGroupMeta.label} ({groups.length} kelompok)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeGroupMeta.description}. Klik salah satu kartu kelompok untuk memfilter tabel detail di bawah.
                </p>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Pilihan</span>
                </button>
              )}
            </div>

            {/* Grouping Dimension Selector */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              {GROUP_MODES.map((mode) => {
                const active = mode.id === groupBy;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleChangeGroupBy(mode.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:border-cyan-200 dark:hover:border-cyan-700'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>

            {/* Group Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {groups.map((grp, idx) => {
                const isSelected = selectedGroupKey === grp.key;
                const barColor = CHART_PALETTE[idx % CHART_PALETTE.length];
                return (
                  <button
                    key={grp.key}
                    type="button"
                    onClick={() =>
                      setSelectedGroupKey((prev) =>
                        prev === grp.key ? null : grp.key
                      )
                    }
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-cyan-50/90 dark:bg-cyan-950/50 border-cyan-500 dark:border-cyan-500 ring-1 ring-cyan-500/30'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-600 hover:bg-white dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                          {grp.label}
                        </span>
                        <span className="text-sm font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-400 shrink-0">
                          {grp.count}
                        </span>
                      </div>

                      {(grp.parentLabel || grp.code) && (
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {[grp.parentLabel, grp.code].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    {grp.subBreakdown.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                        {grp.subBreakdown.slice(0, 3).map((sub) => (
                          <div
                            key={sub.label}
                            className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300"
                          >
                            <span className="truncate">{sub.label}</span>
                            <span className="font-mono tabular-nums font-semibold shrink-0">
                              {sub.count}
                            </span>
                          </div>
                        ))}
                        {grp.subBreakdown.length > 3 && (
                          <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            +{grp.subBreakdown.length - 3} sub-lokasi lainnya
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        <span>Porsi Data</span>
                        <span>{grp.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${Math.max(4, grp.percentage)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Visual Distribution Charts */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Proporsi Pelanggan menurut {activeGroupMeta.label}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Distribusi persentase dari total {records.length} pelanggan terdaftar.
                </p>
              </div>
              <DonutChart
                segments={donutSegments}
                centerTitle="Total Data"
                centerValue={String(records.length)}
                ariaLabel={`Grafik proporsi berdasarkan ${activeGroupMeta.label}`}
              />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Peringkat Terbanyak per {activeGroupMeta.label}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Menampilkan hingga 12 kelompok teratas berdasarkan jumlah pelanggan.
                </p>
              </div>
              <HorizontalBarChart
                data={barData}
                emptyText="Belum ada data kelompok untuk ditampilkan."
              />
            </div>
          </section>

          {/* Filterable Customer Data Table */}
          <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Rincian Daftar Pelanggan
                  {selectedGroup ? ` — Grup: ${selectedGroup.label}` : ''}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cari berdasarkan nama pelanggan, nama KK, NIK, nomor KK, kecamatan, desa, atau alamat dusun.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-cyan-700 dark:text-cyan-400 shrink-0">
                {filteredRecords.length} / {records.length} data
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-2">
              <div className="xl:col-span-4 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, NIK, nomor KK, desa, atau alamat..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                />
              </div>

              <div className="xl:col-span-3">
                <select
                  aria-label="Filter kecamatan"
                  value={kecamatanFilter}
                  onChange={(e) => {
                    setKecamatanFilter(e.target.value);
                    setDesaFilter('ALL');
                  }}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Semua Kecamatan</option>
                  {kecamatanOptions.map((kec) => (
                    <option key={kec} value={kec}>
                      {kec}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-3">
                <select
                  aria-label="Filter desa kelurahan"
                  value={desaFilter}
                  onChange={(e) => setDesaFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Semua Desa / Kelurahan</option>
                  {desaOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-1">
                <select
                  aria-label="Filter kabupaten atau kota"
                  value={kabupatenFilter}
                  onChange={(e) => setKabupatenFilter(e.target.value)}
                  className="w-full px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Kabupaten</option>
                  {kabupatenOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-1">
                <select
                  aria-label="Filter sumber data"
                  value={sumberFilter}
                  onChange={(e) => setSumberFilter(e.target.value)}
                  className="w-full px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Sumber</option>
                  {sumberOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[540px] border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">No</th>
                    <th className="py-2.5 px-3 font-semibold">Nama Pelanggan &amp; KK</th>
                    <th className="py-2.5 px-3 font-semibold">NIK &amp; Nomor KK</th>
                    <th className="py-2.5 px-3 font-semibold">Kecamatan &amp; Desa</th>
                    <th className="py-2.5 px-3 font-semibold">Alamat / Dusun</th>
                    <th className="py-2.5 px-3 font-semibold">Unit PLN</th>
                    <th className="py-2.5 px-3 font-semibold">Sumber Data</th>
                    <th className="py-2.5 px-3 font-semibold">Dokumentasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2"
                      >
                        <div>
                          Tidak ada baris data yang cocok dengan filter atau pencarian saat ini.
                        </div>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetAllFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/60"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Tampilkan Semua Data</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 align-top"
                      >
                        <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {r.no}
                        </td>

                        <td className="py-2.5 px-3 min-w-[170px]">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {r.namaPelanggan}
                          </div>
                          {r.namaKk && r.namaKk !== r.namaPelanggan && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              KK: {r.namaKk}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {r.kabupatenKota}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] min-w-[180px]">
                          <div className="text-slate-800 dark:text-slate-200">
                            NIK: {r.nik || '—'}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            KK: {r.nomorKk || '—'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 min-w-[180px]">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {r.desaKelurahan}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            Kec. {r.kecamatan}
                          </div>
                          {(r.kodeKecamatan || r.kodeKelurahan) && (
                            <div className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                              {[
                                r.kodeKecamatan ? `Kec ${r.kodeKecamatan}` : '',
                                r.kodeKelurahan ? `Kel ${r.kodeKelurahan}` : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 min-w-[160px] text-slate-700 dark:text-slate-300">
                          {r.alamat}
                        </td>

                        <td className="py-2.5 px-3 min-w-[170px] text-[11px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {r.namaUlp || '—'}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {r.namaUp3 || '—'}
                          </div>
                          <div className="font-mono tabular-nums text-[10px] text-slate-400 dark:text-slate-500">
                            {[r.kodeUiw, r.kodeUp3, r.kodeUlp]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 text-[11px] font-mono font-semibold border rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                            {r.sumberData}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                          {r.dokumentasiInstalasi ? (
                            isHttpUrl(r.dokumentasiInstalasi) ? (
                              <a
                                href={r.dokumentasiInstalasi}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400 hover:underline font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Lihat Dokumentasi</span>
                              </a>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-300">
                                {r.dokumentasiInstalasi}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              Belum terisi
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
