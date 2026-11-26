import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  MapPin,
  RefreshCw,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BPBL_SPREADSHEET_EDIT_URL,
  BPBL_TABS,
  BpblProgressStage,
  BpblRecord,
  BpblTabData,
  BpblTabId,
  exportBpblRecordsToCSV,
  fetchBpblTab,
} from '../services/bpblSheetService';
import { DonutChart, HorizontalBarChart, VerticalBarChart } from './Charts';

function getStageBadgeClasses(stage: BpblProgressStage): string {
  switch (stage) {
    case 'Sudah Terpasang':
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'Aktivasi Meter (Sisa Cetak)':
      return 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    case 'BP PLN Lunas (Proses Penyambungan)':
      return 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
    case 'NIDI & SLO Terbit (Proses BP PLN)':
      return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    case 'Proses Penugasan NIDI & SLO':
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'Diganti':
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'Layak Teknis / Usulan':
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

const STAGE_COLOR_MAP: Record<BpblProgressStage, string> = {
  'Sudah Terpasang': '#059669',
  'Aktivasi Meter (Sisa Cetak)': '#0284c7',
  'BP PLN Lunas (Proses Penyambungan)': '#0891b2',
  'NIDI & SLO Terbit (Proses BP PLN)': '#4f46e5',
  'Proses Penugasan NIDI & SLO': '#d97706',
  Diganti: '#e11d48',
  'Layak Teknis / Usulan': '#64748b',
};

function isHttpUrl(text: string): boolean {
  return text.startsWith('http://') || text.startsWith('https://');
}

export function BpblSheetSection() {
  const [activeTabId, setActiveTabId] = useState<BpblTabId>('gowa');
  const [tabData, setTabData] = useState<BpblTabData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'ALL' | BpblProgressStage>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [wilayahFilter, setWilayahFilter] = useState<string>('ALL');
  const [nidiFilter, setNidiFilter] = useState<string>('ALL');

  const loadTab = useCallback(async (target: BpblTabId | string) => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await fetchBpblTab(target);
      setTabData(parsed);
      setStageFilter('ALL');
      setUnitFilter('ALL');
      setWilayahFilter('ALL');
      setNidiFilter('ALL');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data spreadsheet BPBL.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTab(activeTabId);
  }, [activeTabId, loadTab]);

  const records = useMemo(() => tabData?.records || [], [tabData]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.layakTeknisPln) set.add(r.layakTeknisPln);
    }
    return Array.from(set).sort();
  }, [records]);

  const wilayahOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      const label = [r.kecamatan, r.desa].filter(Boolean).join(' · ');
      if (label) set.add(label);
    }
    return Array.from(set).sort();
  }, [records]);

  const nidiPeriodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.periodeNidi) set.add(r.periodeNidi);
    }
    return Array.from(set);
  }, [records]);

  const summary = useMemo(() => {
    const total = records.length;
    const penggantiCount = records.filter((r) => r.isPengganti).length;
    const terpasangCount = records.filter(
      (r) => r.stage === 'Sudah Terpasang'
    ).length;
    const aktivasiCount = records.filter(
      (r) => r.stage === 'Aktivasi Meter (Sisa Cetak)'
    ).length;
    const nidiCount = records.filter((r) => Boolean(r.noNidi)).length;
    const sloCount = records.filter((r) => Boolean(r.noSlo)).length;
    const registerPlnCount = records.filter((r) => Boolean(r.noRegisterPln)).length;
    const kwh900Count = records.filter((r) =>
      `${r.keteranganInstalasi} ${r.dokumentasiPemasangan}`
        .toUpperCase()
        .includes('900 VA')
    ).length;

    const meterSiapPct =
      total > 0 ? ((terpasangCount + aktivasiCount) / total) * 100 : 0;

    return {
      total,
      penggantiCount,
      terpasangCount,
      aktivasiCount,
      meterSiapTotal: terpasangCount + aktivasiCount,
      meterSiapPct,
      nidiCount,
      sloCount,
      registerPlnCount,
      kwh900Count,
    };
  }, [records]);

  const stageDonutSegments = useMemo(() => {
    const counts = new Map<BpblProgressStage, number>();
    for (const r of records) {
      counts.set(r.stage, (counts.get(r.stage) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([stage, count]) => ({
        label: stage,
        value: count,
        color: STAGE_COLOR_MAP[stage],
      }));
  }, [records]);

  const wilayahBarData = useMemo(() => {
    const counts = new Map<string, { total: number; selesai: number }>();
    for (const r of records) {
      const key =
        r.desa && r.alamat
          ? `${r.desa} — ${r.alamat.split(',')[0].trim()}`
          : r.desa || r.kecamatan || 'Lainnya';
      const entry = counts.get(key) || { total: 0, selesai: 0 };
      entry.total += 1;
      if (
        r.stage === 'Sudah Terpasang' ||
        r.stage === 'Aktivasi Meter (Sisa Cetak)'
      ) {
        entry.selesai += 1;
      }
      counts.set(key, entry);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([label, stat]) => ({
        label,
        subLabel: `${stat.selesai} meter terpasang/aktivasi`,
        value: stat.total,
        unit: 'rumah',
        color: '#0284c7',
      }));
  }, [records]);

  const nidiWaveBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      const key = r.periodeNidi || 'Belum Ada NIDI';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([label, value]) => ({
      label,
      value,
      highlight: label.includes('Nov'),
      muted: label.includes('Belum'),
    }));
  }, [records]);

  const desilBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      const d = r.desil ? `Desil ${r.desil}` : 'Tanpa Desil';
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({
        label,
        value,
      }));
  }, [records]);

  const unitBreakdownBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      const u = r.layakTeknisPln || 'Belum Terisi';
      counts.set(u, (counts.get(u) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label,
        value,
        unit: 'pelanggan',
        color: label.toUpperCase().includes('KALEBAJENG')
          ? '#0284c7'
          : label.toUpperCase().includes('TAKALAR')
          ? '#d97706'
          : '#059669',
      }));
  }, [records]);

  const filteredRecords = useMemo<BpblRecord[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (stageFilter !== 'ALL' && r.stage !== stageFilter) return false;
      if (unitFilter !== 'ALL' && r.layakTeknisPln !== unitFilter) return false;
      const wilayahKey = [r.kecamatan, r.desa].filter(Boolean).join(' · ');
      if (wilayahFilter !== 'ALL' && wilayahKey !== wilayahFilter) return false;
      if (nidiFilter !== 'ALL' && r.periodeNidi !== nidiFilter) return false;

      if (!q) return true;
      return (
        r.namaPenerima.toLowerCase().includes(q) ||
        r.kepalaKeluarga.toLowerCase().includes(q) ||
        r.nik.toLowerCase().includes(q) ||
        r.kk.toLowerCase().includes(q) ||
        r.kecamatan.toLowerCase().includes(q) ||
        r.desa.toLowerCase().includes(q) ||
        r.alamat.toLowerCase().includes(q) ||
        r.noNidi.toLowerCase().includes(q) ||
        r.noSlo.toLowerCase().includes(q) ||
        r.noRegisterPln.toLowerCase().includes(q) ||
        r.keteranganInstalasi.toLowerCase().includes(q) ||
        r.statusProgresAkhir.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, stageFilter, unitFilter, wilayahFilter, nidiFilter]);

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
              <FileSpreadsheet className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Menu Data BPBL T.A 2026 · Sinkronisasi Google Sheets Live</span>
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
              Monitoring Calon Penerima &amp; Penyambungan BPBL 900 VA ({tabData?.meta.name || 'Kab. Gowa'})
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
              {tabData?.title || 'Memuat data dari spreadsheet terlampir...'}
              {tabData
                ? ` · Disinkronkan ${tabData.fetchedAt.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}`
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={BPBL_SPREADSHEET_EDIT_URL}
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
              onClick={() => loadTab(activeTabId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Menyinkronkan...' : 'Muat Ulang Live'}</span>
            </button>

            {filteredRecords.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  exportBpblRecordsToCSV(tabData?.meta.name || activeTabId, filteredRecords)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-amber-300/90 hover:bg-amber-400 border border-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV ({filteredRecords.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Region Tabs (rendered when multiple tabs exist) */}
        {BPBL_TABS.length > 1 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
            {BPBL_TABS.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:border-cyan-200 dark:hover:border-cyan-700'
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !tabData ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-14 text-center text-xs text-slate-500 dark:text-slate-400">
          Menghubungkan dan membaca data live dari spreadsheet BPBL...
        </div>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Total Penerima</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summary.total}
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                {summary.penggantiCount > 0
                  ? `Termasuk ${summary.penggantiCount} pengganti`
                  : 'Calon penerima terdata'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
              <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Meter Aktif / Terpasang</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {summary.meterSiapTotal}
              </div>
              <div className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-mono tabular-nums">
                {summary.meterSiapPct.toFixed(1)}% ({summary.terpasangCount} terpasang ·{' '}
                {summary.aktivasiCount} aktivasi)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800/80 shadow-2xs">
              <div className="text-[11px] font-medium text-sky-800 dark:text-sky-400 uppercase flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>NIDI &amp; SLO Terbit</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400">
                {summary.nidiCount}
              </div>
              <div className="mt-1 text-[11px] text-sky-800 dark:text-sky-300 font-mono tabular-nums">
                SLO: {summary.sloCount} · Reg. PLN: {summary.registerPlnCount}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 shadow-2xs">
              <div className="text-[11px] font-medium text-amber-800 dark:text-amber-400 uppercase">
                Material kWh 900 VA
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-800 dark:text-amber-400">
                {summary.kwh900Count}
              </div>
              <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                Unit proses/pasang 900 VA
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Cakupan Unit / Wilayah</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {wilayahOptions.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono truncate">
                {unitOptions.length} unit PLN ({unitOptions.join(', ') || '—'})
              </div>
            </div>
          </section>

          {/* Charts Grid */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Proporsi Progres Pemasangan &amp; Registrasi BP PLN
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pengelompokan status aktual dari kolom NIDI, SLO, Keterangan Instalasi &amp; Dokumentasi.
                </p>
              </div>
              <DonutChart
                segments={stageDonutSegments}
                centerTitle="Total Data"
                centerValue={String(summary.total)}
                ariaLabel="Grafik proporsi progres pemasangan BPBL"
              />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Sebaran Penerima per Desa / Dusun Teratas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Jumlah calon penerima dan realisasi meter terpasang/aktivasi per lokasi.
                </p>
              </div>
              <HorizontalBarChart
                data={wilayahBarData}
                emptyText="Belum ada data lokasi pada tab ini."
              />
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Gelombang Penerbitan NIDI
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Perbandingan nomor NIDI Okt 2026 (I.10), Nov 2026 (I.11) &amp; belum terbit.
                </p>
              </div>
              <VerticalBarChart
                data={nidiWaveBars}
                primaryLabel="Jumlah Pelanggan"
                primaryColor="#0284c7"
                height={200}
                unit="rumah"
                ariaLabel="Grafik gelombang penerbitan NIDI"
              />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Distribusi Tingkat Desil
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sebaran penerima bantuan berdasarkan kategori Desil 1 hingga Desil 5.
                </p>
              </div>
              <VerticalBarChart
                data={desilBars}
                primaryLabel="Penerima per Desil"
                primaryColor="#059669"
                height={200}
                unit="rumah"
                ariaLabel="Grafik distribusi desil penerima"
              />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Kelayakan Teknis per Unit PLN
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pembagian tanggung jawab teknis (ULP Kalebajeng, Takalar, dll.).
                </p>
              </div>
              <HorizontalBarChart
                data={unitBreakdownBars}
                emptyText="Kolom Layak Teknis PLN belum terisi."
              />
            </div>
          </section>

          {/* Search & Filterable Data Table */}
          <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daftar Pencarian &amp; Detail Penerima BPBL ({tabData?.meta.name})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cari berdasarkan nama, NIK, desa/dusun, nomor NIDI/SLO, atau nomor meter register PLN.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-cyan-700 dark:text-cyan-400">
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
                  placeholder="Cari nama, NIK, desa, NIDI, SLO, atau nomor meter..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                />
              </div>

              <div className="xl:col-span-3">
                <select
                  aria-label="Filter tahap progres BPBL"
                  value={stageFilter}
                  onChange={(e) =>
                    setStageFilter(e.target.value as 'ALL' | BpblProgressStage)
                  }
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Semua Tahap Progres</option>
                  {Array.from(new Set(records.map((r) => r.stage))).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-2">
                <select
                  aria-label="Filter unit layak teknis PLN"
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Semua Unit PLN</option>
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-2">
                <select
                  aria-label="Filter wilayah kecamatan dan desa"
                  value={wilayahFilter}
                  onChange={(e) => setWilayahFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Semua Wilayah</option>
                  {wilayahOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-1">
                <select
                  aria-label="Filter periode NIDI"
                  value={nidiFilter}
                  onChange={(e) => setNidiFilter(e.target.value)}
                  className="w-full px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">NIDI</option>
                  {nidiPeriodOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
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
                    <th className="py-2.5 px-3 font-semibold">Penerima / NIK</th>
                    <th className="py-2.5 px-3 font-semibold">Kecamatan / Desa / Alamat</th>
                    <th className="py-2.5 px-2.5 font-semibold text-center">Desil</th>
                    <th className="py-2.5 px-3 font-semibold">Layak Teknis</th>
                    <th className="py-2.5 px-3 font-semibold">NIDI · SLO · No Meter PLN</th>
                    <th className="py-2.5 px-3 font-semibold">Tahap &amp; Keterangan Instalasi</th>
                    <th className="py-2.5 px-3 font-semibold">Lokasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        Tidak ada baris data BPBL yang cocok dengan filter pencarian Anda.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 align-top">
                        <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {r.no}
                          {r.isPengganti && (
                            <div className="mt-1 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                              PENGGANTI
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 min-w-[180px]">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {r.namaPenerima}
                          </div>
                          {r.kepalaKeluarga &&
                            r.kepalaKeluarga !== r.namaPenerima && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                KK: {r.kepalaKeluarga}
                              </div>
                            )}
                          {r.nik && (
                            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                              NIK: {r.nik}
                            </div>
                          )}
                          {(r.jenisKelamin || r.pekerjaan) && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {[r.jenisKelamin, r.pekerjaan].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 min-w-[170px]">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {r.desa || '—'}
                            {r.kecamatan ? `, ${r.kecamatan}` : ''}
                          </div>
                          {r.alamat && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {r.alamat}
                            </div>
                          )}
                          {r.sumberListrik && (
                            <div className="text-[11px] text-cyan-700 dark:text-cyan-400 mt-0.5">
                              {r.sumberListrik}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-2.5 text-center font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">
                          {r.desil || '—'}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                          {r.layakTeknisPln || '—'}
                        </td>

                        <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] min-w-[190px]">
                          {r.noNidi ? (
                            <div className="text-slate-800 dark:text-slate-200 font-semibold">
                              NIDI: {r.noNidi}
                            </div>
                          ) : (
                            <div className="text-slate-400 dark:text-slate-500">NIDI: Belum</div>
                          )}
                          {r.noSlo && (
                            <div className="text-slate-600 dark:text-slate-400">SLO: {r.noSlo}</div>
                          )}
                          {r.noRegisterPln && (
                            <div className="text-cyan-700 dark:text-cyan-400 font-semibold">
                              Meter/Reg: {r.noRegisterPln}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 min-w-[230px]">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${getStageBadgeClasses(
                              r.stage
                            )}`}
                          >
                            {r.stage}
                          </span>
                          {r.keteranganInstalasi && (
                            <div className="mt-1 text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                              {r.keteranganInstalasi}
                            </div>
                          )}
                          {(r.statusProgresAkhir ||
                            r.dokumentasiPemasangan ||
                            r.catatanLampiran) && (
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              {[
                                r.statusProgresAkhir,
                                r.dokumentasiPemasangan,
                                r.catatanLampiran,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                          {r.maps && isHttpUrl(r.maps) ? (
                            <a
                              href={r.maps}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400 hover:underline font-medium"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Buka Maps</span>
                            </a>
                          ) : r.koordinat ? (
                            <span className="font-mono text-slate-600 dark:text-slate-400">
                              {r.koordinat}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {tabData && tabData.legendNotes.length > 0 && (
              <div className="p-3 rounded-lg bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/70 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                  Keterangan Resmi Spreadsheet
                </div>
                <ul className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                  {tabData.legendNotes.map((note, idx) => (
                    <li key={idx}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
