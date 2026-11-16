import {
  AlertCircle,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  exportPiketToCSV,
  fetchPiketSheetData,
  PIKET_CSV_URL,
  PiketSheetData,
} from '../services/piketService';
import { HorizontalBarChart, VerticalBarChart } from './Charts';

export function PiketView() {
  const [data, setData] = useState<PiketSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await fetchPiketSheetData(PIKET_CSV_URL);
      setData(parsed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memuat data Sheet PIKET (gid=418796009).'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      const matchesSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.nip.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q);
      const matchesDay =
        selectedDay === 'all' || row.assignedDays.includes(selectedDay);
      return matchesSearch && matchesDay;
    });
  }, [data, search, selectedDay]);

  const stats = useMemo(() => {
    if (!data) {
      return { totalPersonnel: 0, totalShifts: 0, coveredDays: 0 };
    }
    const daySet = new Set<number>();
    let totalShifts = 0;
    for (const r of data.rows) {
      totalShifts += r.totalShifts;
      for (const d of r.assignedDays) daySet.add(d);
    }
    return {
      totalPersonnel: data.rows.length,
      totalShifts,
      coveredDays: daySet.size,
    };
  }, [data]);

  const dailyCoverageChart = useMemo(() => {
    if (!data) return [];
    return data.days.map((d) => {
      const count = data.rows.filter((r) =>
        r.assignedDays.includes(d.dayNumber)
      ).length;
      return {
        label: String(d.dayNumber),
        value: count,
        highlight: selectedDay === d.dayNumber,
        muted: d.isWeekend && selectedDay !== d.dayNumber,
      };
    });
  }, [data, selectedDay]);

  const personnelLoadChart = useMemo(() => {
    if (!data) return [];
    return [...data.rows]
      .sort((a, b) => b.totalShifts - a.totalShifts)
      .map((r) => ({
        label: r.name,
        subLabel: r.category,
        value: r.totalShifts,
        unit: 'hr',
        color: '#0e7490',
      }));
  }, [data]);

  return (
    <div className="space-y-5">
      {/* Header Metadata Banner */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold">
                {data?.unit || 'ULP SINJAI'}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono font-semibold">
                {data?.formCode || 'Form C1.A'}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                Sheet PIKET · gid=418796009
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {data?.title || 'JADWAL RENCANA PENUGASAN PIKET/SHIFT/KATEGORI P21B KHUSUS'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Periode: <strong className="text-slate-700 dark:text-slate-200">{data?.periodLabel || 'Oktober 2026'}</strong>
              {data?.fetchedAt && (
                <>
                  {' '}
                  · Diperbarui live pukul{' '}
                  <span className="font-mono">
                    {data.fetchedAt.toLocaleTimeString('id-ID')}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={PIKET_CSV_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <span>CSV Sumber</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              disabled={!data || data.rows.length === 0}
              onClick={() => data && exportPiketToCSV(data)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Memuat...' : 'Muat Ulang Live'}</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-mono font-bold">
              <span>PETUGAS PIKET</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stats.totalPersonnel}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Personel terdaftar
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-400 text-[11px] font-mono font-bold">
              <span>TOTAL SHIFT PIKET</span>
              <CalendarCheck2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-cyan-800 dark:text-cyan-300 mt-1">
              {stats.totalShifts}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Penugasan bertanda √
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-bold">
              <span>CAKUPAN HARI</span>
              <CalendarDays className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
              {stats.coveredDays} / {data?.days.length || 31}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Hari dengan petugas terjadwal
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60">
            <div className="text-indigo-700 dark:text-indigo-300 text-[11px] font-mono font-bold">
              FILTER TANGGAL
            </div>
            <select
              aria-label="Filter petugas menurut tanggal"
              value={selectedDay}
              onChange={(e) =>
                setSelectedDay(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="mt-1.5 w-full px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option value="all">Semua Tanggal ({data?.days.length || 31} hari)</option>
              {(data?.days || []).map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Tgl {d.dayNumber} — {d.dayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Piket Charts Row */}
      {data && data.rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Grafik Jumlah Petugas Piket Harian ({data.periodLabel})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Batang kuning menunjukkan hari akhir pekan (Sabtu / Minggu)
                </p>
              </div>
            </div>
            <VerticalBarChart
              data={dailyCoverageChart}
              primaryLabel="Jumlah Petugas Bertugas"
              unit="orang"
              height={200}
              ariaLabel="Grafik jumlah petugas piket per tanggal"
            />
          </section>

          <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Distribusi Total Hari Piket per Personel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Perbandingan beban penugasan pada Form C1.A
              </p>
            </div>
            <HorizontalBarChart data={personnelLoadChart} />
          </section>
        </div>
      )}

      {/* Search Bar & Matrix Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Matriks Jadwal Piket Bulanan ({data?.periodLabel || 'Oktober 2026'})
          </h3>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pegawai, NIP, kategori..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
        </div>

        {loading && !data ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada petugas piket yang cocok dengan filter atau pencarian saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50/90 dark:bg-slate-800/50">
                  <th rowSpan={2} className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800">
                    No
                  </th>
                  <th rowSpan={2} className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    NIP
                  </th>
                  <th rowSpan={2} className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap min-w-[170px]">
                    Nama Pegawai
                  </th>
                  <th rowSpan={2} className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    Kategori Pekerjaan
                  </th>
                  <th rowSpan={2} className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    Total
                  </th>
                  {(data?.days || []).map((d) => (
                    <th
                      key={`dn-${d.dayNumber}`}
                      className={`py-1.5 px-1.5 text-center font-medium text-[10px] border-r border-slate-200/70 dark:border-slate-800/70 min-w-[34px] ${
                        selectedDay === d.dayNumber
                          ? 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-900 dark:text-cyan-200'
                          : d.isWeekend
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                          : ''
                      }`}
                    >
                      {d.dayName.slice(0, 3)}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/70">
                  {(data?.days || []).map((d) => (
                    <th
                      key={`num-${d.dayNumber}`}
                      className={`py-1 px-1.5 text-center border-r border-slate-200/70 dark:border-slate-800/70 ${
                        selectedDay === d.dayNumber
                          ? 'bg-cyan-700 text-white'
                          : d.isWeekend
                          ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                          : ''
                      }`}
                    >
                      {d.dayNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredRows.map((row) => {
                  const assignedSet = new Set(row.assignedDays);
                  return (
                    <tr
                      key={`${row.rowNo}-${row.nip}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 border-r border-slate-100 dark:border-slate-800">
                        {row.rowNo}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        {row.nip}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-cyan-800 dark:text-cyan-300 border-r border-slate-200 dark:border-slate-800">
                        {row.totalShifts} hr
                      </td>
                      {(data?.days || []).map((d) => {
                        const isOnDuty = assignedSet.has(d.dayNumber);
                        return (
                          <td
                            key={`${row.nip}-${d.dayNumber}`}
                            title={
                              isOnDuty
                                ? `${row.name} bertugas tanggal ${d.dayNumber} (${d.dayName})`
                                : undefined
                            }
                            className={`p-1 text-center border-r border-slate-100 dark:border-slate-800/70 ${
                              selectedDay === d.dayNumber
                                ? 'bg-cyan-50/70 dark:bg-cyan-950/30'
                                : d.isWeekend
                                ? 'bg-amber-50/30 dark:bg-amber-950/10'
                                : ''
                            }`}
                          >
                            {isOnDuty ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-cyan-700 dark:bg-cyan-600 text-white font-bold shadow-2xs">
                                <Check className="w-3.5 h-3.5" aria-label="Bertugas" />
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">·</span>
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
        )}

        {/* Quick Per-Personnel Shift Summary */}
        {data && filteredRows.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Daftar Tanggal Bertugas per Personel:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {filteredRows.map((row) => (
                <div
                  key={`card-${row.nip}`}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {row.name}
                    </div>
                    <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 font-semibold shrink-0">
                      {row.totalShifts} shift
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    NIP: {row.nip} · {row.category}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {row.assignedDays.map((dayNum) => (
                      <span
                        key={dayNum}
                        className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 rounded"
                      >
                        {dayNum}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Notes Section from Sheet */}
      {data && data.notes.length > 0 && (
        <section className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
            <FileText className="w-4 h-4 shrink-0" />
            <span>CATATAN WAJIB DIBACA</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-900/90 dark:text-amber-200/90 list-disc list-inside">
            {data.notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
