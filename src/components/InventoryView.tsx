import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Minus,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { exportMaterialsToCSV, hasMaterialActivity } from '../services/inventoryService';
import {
  DivisionBreakdown,
  MATERIAL_CATEGORIES,
  Material,
  MaterialCategory,
  MaterialStatus,
} from '../types/inventory';
import { DonutChart, HorizontalBarChart } from './Charts';
import { MaterialStatusIndicator } from './StatusText';

interface InventoryViewProps {
  projectName: string;
  isCompleted: boolean;
  materials: Material[];
  loading: boolean;
  onQuickMovement: (material: Material, initialType: 'in' | 'out') => void;
  onEditMaterial: (material: Material) => void;
  onDeleteMaterial: (material: Material) => void;
  onAddMaterial: () => void;
}

type ScopeFilter = 'active' | 'in_stock' | 'attention' | 'all';
type DivisionScope = 'ALL' | 'DIST' | 'AGA' | 'TE';

const PAGE_SIZE = 50;

function BreakdownCell({
  breakdown,
  accentClass = 'text-slate-900 dark:text-slate-100',
}: {
  breakdown?: DivisionBreakdown;
  accentClass?: string;
}) {
  const b = breakdown || { dist: 0, aga: 0, te: 0, total: 0 };
  return (
    <div className="font-mono tabular-nums text-right">
      <div
        className={`text-xs font-semibold ${
          b.total < 0 ? 'text-red-600 dark:text-red-400' : accentClass
        }`}
      >
        {b.total.toLocaleString('id-ID')}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
        <span title="DIST">D:{b.dist}</span>{' '}
        <span
          title="AGA"
          className={b.aga < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}
        >
          A:{b.aga}
        </span>{' '}
        <span title="TE">T:{b.te}</span>
      </div>
    </div>
  );
}

export function InventoryView({
  projectName,
  isCompleted,
  materials,
  loading,
  onQuickMovement,
  onEditMaterial,
  onDeleteMaterial,
  onAddMaterial,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('active');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MaterialCategory>('all');
  const [divisionFilter, setDivisionFilter] = useState<DivisionScope>('ALL');
  const [page, setPage] = useState(1);
  const [showCharts, setShowCharts] = useState(true);

  const counts = useMemo(() => {
    let active = 0;
    let inStock = 0;
    let attention = 0;
    for (const m of materials) {
      const isAct = hasMaterialActivity(m);
      if (isAct) active++;
      if ((m.stokAkhir?.total ?? m.currentStock) > 0) inStock++;
      if (isAct && m.status !== 'nominal' && m.minThreshold > 0) attention++;
    }
    return {
      active,
      inStock,
      attention,
      all: materials.length,
    };
  }, [materials]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((m) => {
      const isAct = hasMaterialActivity(m);
      const matchesScope =
        scopeFilter === 'all' ||
        (scopeFilter === 'active' && isAct) ||
        (scopeFilter === 'in_stock' && (m.stokAkhir?.total ?? m.currentStock) > 0) ||
        (scopeFilter === 'attention' && isAct && m.status !== 'nominal' && m.minThreshold > 0);

      const matchesCategory =
        categoryFilter === 'all' || m.category === categoryFilter;

      const divKey =
        divisionFilter === 'DIST'
          ? 'dist'
          : divisionFilter === 'AGA'
          ? 'aga'
          : divisionFilter === 'TE'
          ? 'te'
          : null;

      const matchesDivision =
        !divKey ||
        (m.stokAwal?.[divKey] ?? 0) !== 0 ||
        (m.materialMasuk?.[divKey] ?? 0) !== 0 ||
        (m.materialKeluar?.[divKey] ?? 0) !== 0 ||
        (m.stokAkhir?.[divKey] ?? 0) !== 0;

      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        m.warehouseZone.toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q) ||
        String(m.rowNumber || '').includes(q);

      return matchesScope && matchesCategory && matchesDivision && matchesSearch;
    });
  }, [materials, search, scopeFilter, categoryFilter, divisionFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, scopeFilter, categoryFilter, divisionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const inventoryCharts = useMemo(() => {
    const divField =
      divisionFilter === 'DIST'
        ? 'dist'
        : divisionFilter === 'AGA'
        ? 'aga'
        : divisionFilter === 'TE'
        ? 'te'
        : 'total';

    const topStock = [...filtered]
      .map((m) => ({
        label: m.name,
        subLabel: m.sku,
        value: m.stokAkhir?.[divField] ?? m.currentStock,
        unit: m.unit,
        color: '#0e7490',
      }))
      .filter((x) => x.value !== 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 6);

    const activeList = filtered.filter((m) => hasMaterialActivity(m));
    const statusSegments = [
      {
        label: 'Nominal (Aman)',
        value: activeList.filter((m) => m.status === 'nominal').length,
        color: '#059669',
      },
      {
        label: 'Menipis',
        value: activeList.filter((m) => m.status === 'low').length,
        color: '#d97706',
      },
      {
        label: 'Kritis',
        value: activeList.filter((m) => m.status === 'critical').length,
        color: '#ea580c',
      },
      {
        label: 'Habis (0)',
        value: activeList.filter((m) => m.status === 'out').length,
        color: '#dc2626',
      },
      {
        label: 'Non-Aktif',
        value: filtered.length - activeList.length,
        color: '#94a3b8',
      },
    ];

    return { topStock, statusSegments };
  }, [filtered, divisionFilter]);

  return (
    <div className="space-y-4">
      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'active', label: `Aktif / Mutasi (${counts.active})` },
              { id: 'in_stock', label: `Stok > 0 (${counts.inStock})` },
              { id: 'attention', label: `Perlu Pengadaan (${counts.attention})` },
              { id: 'all', label: `Semua Katalog (${counts.all.toLocaleString('id-ID')})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScopeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scopeFilter === tab.id
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[210px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No Material, nama, keterangan..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>

          <select
            aria-label="Filter bidang"
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value as DivisionScope)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
          >
            <option value="ALL">Semua Bidang</option>
            <option value="DIST">Bidang DIST</option>
            <option value="AGA">Bidang AGA</option>
            <option value="TE">Bidang TE</option>
          </select>

          <select
            aria-label="Filter kategori material"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as 'all' | MaterialCategory)
            }
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
          >
            <option value="all">Semua Kategori</option>
            {MATERIAL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={materials.length === 0}
            onClick={() => exportMaterialsToCSV(projectName, filtered)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Contextual Charts for Filtered Inventory */}
      {!loading && filtered.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Grafik Stok Gudang ({filtered.length.toLocaleString('id-ID')} Material Terfilter)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCharts((s) => !s)}
              className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap"
            >
              {showCharts ? 'Sembunyikan Grafik' : 'Tampilkan Grafik'}
            </button>
          </div>

          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="lg:col-span-7 space-y-2">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  6 Material Stok Akhir Teratas {divisionFilter !== 'ALL' ? `(Bidang ${divisionFilter})` : ''}
                </div>
                <HorizontalBarChart data={inventoryCharts.topStock} />
              </div>

              <div className="lg:col-span-5 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Proporsi Status Ketersediaan
                </div>
                <DonutChart
                  segments={inventoryCharts.statusSegments}
                  centerTitle="Terfilter"
                  centerValue={filtered.length.toLocaleString('id-ID')}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Spreadsheet-Aligned Stock Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-3.5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : materials.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Database stok material masih kosong
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tambahkan material atau sinkronkan dari Sumber Spreadsheet CSV Live.
            </p>
            {!isCompleted && (
              <button
                type="button"
                onClick={onAddMaterial}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Material</span>
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Tidak ada material yang cocok dengan filter
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setScopeFilter('all');
                setCategoryFilter('all');
                setDivisionFilter('ALL');
              }}
              className="mt-3 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
            >
              Tampilkan seluruh {materials.length.toLocaleString('id-ID')} katalog
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/50">
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3">Gudang / No &amp; Nama Material</th>
                    <th className="py-3 px-2.5 text-center">Sat</th>
                    <th className="py-3 px-3 text-right">Stok Awal<br /><span className="font-normal text-[10px]">D · A · T</span></th>
                    <th className="py-3 px-3 text-right">Masuk<br /><span className="font-normal text-[10px]">D · A · T</span></th>
                    <th className="py-3 px-3 text-right">Keluar<br /><span className="font-normal text-[10px]">D · A · T</span></th>
                    <th className="py-3 px-3 text-right">Stok Akhir<br /><span className="font-normal text-[10px]">D · A · T</span></th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Keterangan</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {pageItems.map((mat) => {
                    const isInactive = !hasMaterialActivity(mat) && mat.minThreshold === 0;
                    return (
                      <tr
                        key={mat.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                          {mat.rowNumber || '—'}
                        </td>
                        <td className="py-2.5 px-3 min-w-[230px] max-w-[300px]">
                          <div className="font-medium text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate" title={mat.name}>
                            {mat.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="font-mono text-slate-600 dark:text-slate-300">
                              {mat.sku}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{mat.warehouseZone}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-cyan-700 dark:text-cyan-400">
                              {mat.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {mat.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          <BreakdownCell breakdown={mat.stokAwal} />
                        </td>
                        <td className="py-2.5 px-3">
                          <BreakdownCell
                            breakdown={mat.materialMasuk}
                            accentClass="text-emerald-700 dark:text-emerald-400"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <BreakdownCell
                            breakdown={mat.materialKeluar}
                            accentClass="text-amber-700 dark:text-amber-400"
                          />
                        </td>
                        <td className="py-2.5 px-3 bg-indigo-50/30 dark:bg-indigo-950/15">
                          <BreakdownCell
                            breakdown={mat.stokAkhir}
                            accentClass="text-indigo-900 dark:text-indigo-200"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <MaterialStatusIndicator
                            status={mat.status as MaterialStatus}
                            isInactive={isInactive}
                          />
                        </td>
                        <td className="py-2.5 px-3 max-w-[160px]">
                          <span className="text-xs text-slate-600 dark:text-slate-400 truncate block" title={mat.notes || ''}>
                            {mat.notes || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              disabled={isCompleted}
                              title="Catat Barang Masuk"
                              onClick={() => onQuickMovement(mat, 'in')}
                              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-colors disabled:opacity-30"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isCompleted || mat.currentStock <= 0}
                              title="Catat Material Keluar"
                              onClick={() => onQuickMovement(mat, 'out')}
                              className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-md transition-colors disabled:opacity-30"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isCompleted}
                              title="Edit Material & Ambang Batas"
                              onClick={() => onEditMaterial(mat)}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Hapus Material"
                              onClick={() => onDeleteMaterial(mat)}
                              className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="font-mono tabular-nums">
                Menampilkan {((safePage - 1) * PAGE_SIZE + 1).toLocaleString('id-ID')}–
                {Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString('id-ID')} dari{' '}
                <strong>{filtered.length.toLocaleString('id-ID')}</strong> material
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <span className="px-2 font-mono tabular-nums">
                    Hal {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
