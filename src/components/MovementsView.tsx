import { ArrowDownLeft, ArrowUpRight, BarChart3, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateTimeID } from '../services/inventoryService';
import {
  MATERIAL_DIVISIONS,
  MaterialDivision,
  MovementType,
  StockMovement,
} from '../types/inventory';
import { DonutChart, HorizontalBarChart } from './Charts';
import { DivisionBadge, MovementTypeLabel } from './StatusText';

interface MovementsViewProps {
  movements: StockMovement[];
  loading: boolean;
  onRecordMovement: () => void;
  hasMaterials: boolean;
  isCompleted: boolean;
}

export function MovementsView({
  movements,
  loading,
  onRecordMovement,
  hasMaterials,
  isCompleted,
}: MovementsViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | MovementType>('all');
  const [divisionFilter, setDivisionFilter] = useState<'all' | MaterialDivision>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((mv) => {
      const matchesType = typeFilter === 'all' || mv.type === typeFilter;
      const matchesDivision =
        divisionFilter === 'all' || (mv.division || 'UMUM') === divisionFilter;
      const matchesSearch =
        !q ||
        mv.materialName.toLowerCase().includes(q) ||
        mv.materialSku.toLowerCase().includes(q) ||
        mv.referenceNo.toLowerCase().includes(q) ||
        mv.actorName.toLowerCase().includes(q) ||
        (mv.notes || '').toLowerCase().includes(q);
      return matchesType && matchesDivision && matchesSearch;
    });
  }, [movements, search, typeFilter, divisionFilter]);

  const movementCharts = useMemo(() => {
    const typeTotals = { in: 0, out: 0, adjustment: 0 };
    const matMap = new Map<
      string,
      { label: string; subLabel: string; value: number; unit: string; color: string }
    >();

    for (const mv of filtered) {
      typeTotals[mv.type] += mv.quantity;
      const key = mv.materialSku || mv.materialName;
      const existing = matMap.get(key);
      if (existing) {
        existing.value += mv.quantity;
      } else {
        matMap.set(key, {
          label: mv.materialName,
          subLabel: mv.materialSku,
          value: mv.quantity,
          unit: mv.unit,
          color:
            mv.type === 'in'
              ? '#059669'
              : mv.type === 'out'
              ? '#d97706'
              : '#0e7490',
        });
      }
    }

    const segments = [
      { label: 'Barang Masuk', value: typeTotals.in, color: '#059669' },
      { label: 'Barang Keluar', value: typeTotals.out, color: '#d97706' },
      { label: 'Penyesuaian / Opname', value: typeTotals.adjustment, color: '#0e7490' },
    ];

    const topMaterials = Array.from(matMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const totalVolume = typeTotals.in + typeTotals.out + typeTotals.adjustment;
    return { segments, topMaterials, totalVolume };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'all', label: 'Semua Mutasi' },
              { id: 'in', label: 'Material Masuk' },
              { id: 'out', label: 'Material Keluar' },
              { id: 'adjustment', label: 'Opname / Koreksi' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === tab.id
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter bidang"
            value={divisionFilter}
            onChange={(e) =>
              setDivisionFilter(e.target.value as 'all' | MaterialDivision)
            }
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
          >
            <option value="all">Semua Bidang</option>
            {MATERIAL_DIVISIONS.map((div) => (
              <option key={div} value={div}>
                Bidang {div}
              </option>
            ))}
          </select>

          <div className="relative min-w-[230px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. material, referensi, catatan..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Grafik Ringkasan Mutasi ({filtered.length.toLocaleString('id-ID')} Transaksi)
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="lg:col-span-5 space-y-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Proporsi Volume per Jenis Mutasi
              </div>
              <DonutChart
                segments={movementCharts.segments}
                centerTitle="Total Unit"
                centerValue={movementCharts.totalVolume.toLocaleString('id-ID')}
              />
            </div>

            <div className="lg:col-span-7 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Material dengan Volume Mutasi Terbesar
              </div>
              <HorizontalBarChart data={movementCharts.topMaterials} />
            </div>
          </div>
        </section>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4 animate-pulse">
                <div className="h-3.5 w-52 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Belum ada catatan mutasi barang
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Setiap penerimaan barang dan pemakaian lapangan per bidang (DIST / AGA / TE) akan terekam otomatis di sini.
            </p>
            {hasMaterials && !isCompleted && (
              <button
                type="button"
                onClick={onRecordMovement}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors"
              >
                Catat Mutasi Pertama
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada log mutasi yang sesuai dengan kata kunci pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Waktu &amp; Referensi</th>
                  <th className="py-3 px-4">No &amp; Nama Material</th>
                  <th className="py-3 px-4">Bidang</th>
                  <th className="py-3 px-4">Tipe Mutasi</th>
                  <th className="py-3 px-4 text-right">Jumlah</th>
                  <th className="py-3 px-4 text-right">Saldo (Sebelum → Sesudah)</th>
                  <th className="py-3 px-4">Petugas &amp; Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filtered.slice(0, 150).map((mv) => (
                  <tr
                    key={mv.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                        {mv.referenceNo}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDateTimeID(mv.createdAt)}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[260px]">
                        {mv.materialName}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {mv.materialSku}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <DivisionBadge division={mv.division || 'UMUM'} />
                    </td>
                    <td className="py-2.5 px-4">
                      <MovementTypeLabel type={mv.type} />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          mv.type === 'in'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : mv.type === 'out'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {mv.type === 'in' ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : mv.type === 'out' ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        )}
                        {mv.type === 'in' ? '+' : mv.type === 'out' ? '-' : ''}
                        {mv.quantity} {mv.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span>{mv.previousStock}</span>
                      <span className="mx-1.5 text-slate-400">→</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {mv.newStock} {mv.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-[260px]">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {mv.actorName}
                      </div>
                      {mv.notes && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {mv.notes}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
