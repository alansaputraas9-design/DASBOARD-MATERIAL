import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Boxes,
  FileSpreadsheet,
  Layers,
  PackageCheck,
  PackagePlus,
  RefreshCw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateTimeID, hasMaterialActivity } from '../services/inventoryService';
import {
  GroupedBarChart,
  HorizontalBarChart,
  DonutChart,
} from './Charts';
import {
  DivisionBreakdown,
  MATERIAL_CATEGORIES,
  Material,
  StockMovement,
  StockNotification,
} from '../types/inventory';
import {
  DivisionBadge,
  MaterialStatusIndicator,
  MovementTypeLabel,
  NotificationSeverityLabel,
} from './StatusText';

interface OverviewViewProps {
  materials: Material[];
  movements: StockMovement[];
  notifications: StockNotification[];
  loading: boolean;
  isCompleted: boolean;
  rebuildingFromCsv?: boolean;
  onNavigateTab: (tab: 'inventory' | 'movements' | 'notifications' | 'sheets') => void;
  onQuickRestock: (material: Material) => void;
  onAddMaterial: () => void;
  onRebuildFromCsv: () => Promise<void>;
}

function sumBreakdowns(
  materials: Material[],
  picker: (m: Material) => DivisionBreakdown | undefined,
  fallbackTotalPicker?: (m: Material) => number
): DivisionBreakdown {
  let dist = 0;
  let aga = 0;
  let te = 0;
  let total = 0;
  for (const m of materials) {
    const b = picker(m);
    if (b) {
      dist += b.dist || 0;
      aga += b.aga || 0;
      te += b.te || 0;
      total += b.total || 0;
    } else if (fallbackTotalPicker) {
      total += fallbackTotalPicker(m);
    }
  }
  return { dist, aga, te, total };
}

export function OverviewView({
  materials,
  movements,
  notifications,
  loading,
  isCompleted,
  rebuildingFromCsv = false,
  onNavigateTab,
  onQuickRestock,
  onAddMaterial,
  onRebuildFromCsv,
}: OverviewViewProps) {
  const summary = useMemo(() => {
    const activeMaterials = materials.filter((m) => hasMaterialActivity(m));
    const stockReadyCount = activeMaterials.filter(
      (m) => (m.stokAkhir?.total ?? m.currentStock) > 0
    ).length;
    const activeAlertMaterials = activeMaterials.filter(
      (m) => m.status !== 'nominal' && m.minThreshold > 0
    );

    const awal = sumBreakdowns(materials, (m) => m.stokAwal);
    const masuk = sumBreakdowns(materials, (m) => m.materialMasuk);
    const keluar = sumBreakdowns(materials, (m) => m.materialKeluar);
    const akhir = sumBreakdowns(
      materials,
      (m) => m.stokAkhir,
      (m) => m.currentStock
    );

    const statusDistribution = [
      {
        label: 'Nominal (Aman)',
        value: activeMaterials.filter((m) => m.status === 'nominal').length,
        color: '#059669',
      },
      {
        label: 'Menipis',
        value: activeMaterials.filter((m) => m.status === 'low').length,
        color: '#d97706',
      },
      {
        label: 'Kritis',
        value: activeMaterials.filter((m) => m.status === 'critical').length,
        color: '#ea580c',
      },
      {
        label: 'Habis (0)',
        value: activeMaterials.filter((m) => m.status === 'out').length,
        color: '#dc2626',
      },
      {
        label: 'Non-Aktif (0 Mutasi)',
        value: materials.length - activeMaterials.length,
        color: '#94a3b8',
      },
    ];

    return {
      totalCatalog: materials.length,
      activeCount: activeMaterials.length,
      stockReadyCount,
      activeAlertMaterials,
      awal,
      masuk,
      keluar,
      akhir,
      statusDistribution,
    };
  }, [materials]);

  const [topRankMetric, setTopRankMetric] = useState<'akhir' | 'keluar' | 'masuk'>('akhir');

  const topMaterialsChartData = useMemo(() => {
    const scored = materials
      .map((m) => {
        const val =
          topRankMetric === 'akhir'
            ? m.stokAkhir?.total ?? m.currentStock
            : topRankMetric === 'keluar'
            ? m.materialKeluar?.total ?? 0
            : m.materialMasuk?.total ?? 0;
        return { m, val };
      })
      .filter((x) => x.val !== 0)
      .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
      .slice(0, 8);

    const barColor =
      topRankMetric === 'akhir'
        ? '#0e7490'
        : topRankMetric === 'masuk'
        ? '#059669'
        : '#d97706';

    return scored.map(({ m, val }) => ({
      label: m.name,
      subLabel: m.sku,
      value: val,
      unit: m.unit,
      color: barColor,
    }));
  }, [materials, topRankMetric]);

  const categoryStats = useMemo(() => {
    return MATERIAL_CATEGORIES.map((cat) => {
      const items = materials.filter((m) => m.category === cat);
      const active = items.filter((m) => hasMaterialActivity(m));
      const akhirTotal = items.reduce(
        (s, m) => s + (m.stokAkhir?.total ?? m.currentStock),
        0
      );
      const alerts = active.filter(
        (m) => m.status !== 'nominal' && m.minThreshold > 0
      ).length;
      return {
        category: cat,
        count: items.length,
        activeCount: active.length,
        akhirTotal,
        alerts,
      };
    }).filter((c) => c.count > 0);
  }, [materials]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 animate-pulse"
            >
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
              <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
          <div className="lg:col-span-5 h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const unresolvedAlerts = notifications.filter((n) => !n.isResolved);

  return (
    <div className="space-y-6">
      {/* 6-column KPI Strip Aligned to Exact Spreadsheet Structure */}
      <section
        aria-label="Ringkasan Metrik Stok"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold font-mono tracking-wider">
              TOTAL KATALOG
            </span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {summary.totalCatalog.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-cyan-700 dark:text-cyan-400 mt-1 font-medium font-mono tabular-nums">
            {summary.activeCount} material aktif bermutasi
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold font-mono tracking-wider">
              STOK AWAL
            </span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {summary.awal.total.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums truncate">
            D:{summary.awal.dist} · A:{summary.awal.aga} · T:{summary.awal.te}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-2">
            <span className="text-[11px] font-bold font-mono tracking-wider">
              MATERIAL MASUK
            </span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            +{summary.masuk.total.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums truncate">
            D:{summary.masuk.dist} · A:{summary.masuk.aga} · T:{summary.masuk.te}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-2">
            <span className="text-[11px] font-bold font-mono tracking-wider">
              MATERIAL KELUAR
            </span>
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
            -{summary.keluar.total.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums truncate">
            D:{summary.keluar.dist} · A:{summary.keluar.aga} · T:{summary.keluar.te}
          </div>
        </div>

        <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 mb-2">
            <span className="text-[11px] font-bold font-mono tracking-wider">
              STOK AKHIR
            </span>
            <PackageCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-indigo-950 dark:text-indigo-100">
            {summary.akhir.total.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1 font-medium font-mono tabular-nums">
            {summary.stockReadyCount} jenis material siap pakai
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-red-300 dark:hover:border-red-700 transition-colors">
          <div className="flex items-center justify-between text-red-700 dark:text-red-400 mb-2">
            <span className="text-[11px] font-bold font-mono tracking-wider">
              ALERT STOK AKTIF
            </span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400">
            {summary.activeAlertMaterials.length.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium font-mono tabular-nums">
            {unresolvedAlerts.length} notifikasi terbuka
          </div>
        </div>
      </section>

      {/* Live CSV Spreadsheet Source Strip */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-xs min-w-0">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Sumber Spreadsheet CSV Live
            </span>
            <span className="mx-2 text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono">
              Gd Ry Sinjai (No, Gudang, No Material, Nama, Satuan, Awal/Masuk/Keluar/Akhir DIST·AGA·TE)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isCompleted || rebuildingFromCsv}
            onClick={onRebuildFromCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rebuildingFromCsv ? 'animate-spin' : ''}`} />
            <span>{rebuildingFromCsv ? 'Memuat Ulang...' : 'Tarik Ulang CSV'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('sheets')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors whitespace-nowrap"
          >
            <span>Kelola Spreadsheet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {materials.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Belum ada material terdaftar di gudang ini
          </p>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Klik Tarik Ulang CSV untuk memuat seluruh 1.827 data material Gd Ry Sinjai atau tambahkan material secara manual.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <button
              type="button"
              disabled={rebuildingFromCsv}
              onClick={onRebuildFromCsv}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${rebuildingFromCsv ? 'animate-spin' : ''}`} />
              <span>Muat Data CSV Gd Ry Sinjai</span>
            </button>
            <button
              type="button"
              onClick={onAddMaterial}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Tambah Manual</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Interactive Charts Row: Division Comparison & Stock Health Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Grafik Stok &amp; Mutasi per Bidang (DIST / AGA / TE)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Perbandingan agregat Stok Awal, Masuk, Keluar, dan Stok Akhir
                  </p>
                </div>
              </div>

              <GroupedBarChart
                ariaLabel="Grafik perbandingan stok dan mutasi per bidang DIST, AGA, dan TE"
                series={[
                  { key: 'awal', label: 'Stok Awal', color: '#64748b' },
                  { key: 'masuk', label: 'Masuk', color: '#059669' },
                  { key: 'keluar', label: 'Keluar', color: '#d97706' },
                  { key: 'akhir', label: 'Stok Akhir', color: '#0e7490' },
                ]}
                data={[
                  {
                    category: 'DIST',
                    subLabel: 'Distribusi',
                    values: {
                      awal: summary.awal.dist,
                      masuk: summary.masuk.dist,
                      keluar: summary.keluar.dist,
                      akhir: summary.akhir.dist,
                    },
                  },
                  {
                    category: 'AGA',
                    subLabel: 'Niaga / Pelanggan',
                    values: {
                      awal: summary.awal.aga,
                      masuk: summary.masuk.aga,
                      keluar: summary.keluar.aga,
                      akhir: summary.akhir.aga,
                    },
                  },
                  {
                    category: 'TE',
                    subLabel: 'Transaksi Energi',
                    values: {
                      awal: summary.awal.te,
                      masuk: summary.masuk.te,
                      keluar: summary.keluar.te,
                      akhir: summary.akhir.te,
                    },
                  },
                ]}
              />
            </section>

            <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Proporsi Status Katalog Material
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Status keamanan stok pada {summary.activeCount.toLocaleString('id-ID')} material aktif
                </p>
              </div>

              <DonutChart
                ariaLabel="Grafik proporsi status ketersediaan material"
                segments={summary.statusDistribution}
                centerTitle="Total SKU"
                centerValue={summary.totalCatalog.toLocaleString('id-ID')}
              />
            </section>
          </div>

          {/* Top 8 Materials Ranking Bar Chart */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Grafik 8 Material Teratas Berdasarkan Volume
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Peringkat otomatis dari database Gd Ry Sinjai saat ini
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
                {(
                  [
                    { id: 'akhir', label: 'Stok Akhir' },
                    { id: 'keluar', label: 'Material Keluar' },
                    { id: 'masuk', label: 'Material Masuk' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTopRankMetric(opt.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      topRankMetric === opt.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <HorizontalBarChart data={topMaterialsChartData} />
          </section>

          {/* Rekapitulasi Per Bidang (DIST, AGA, TE, TOTAL) */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Rekapitulasi Pergerakan Material per Bidang (DIST / AGA / TE)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Agregasi langsung sesuai empat grup kolom pada spreadsheet Gd Ry Sinjai
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('inventory')}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Buka Tabel Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                    <th className="py-2.5 px-4">Bidang</th>
                    <th className="py-2.5 px-4 text-right">Stok Awal</th>
                    <th className="py-2.5 px-4 text-right">Material Masuk</th>
                    <th className="py-2.5 px-4 text-right">Material Keluar</th>
                    <th className="py-2.5 px-4 text-right">Stok Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm font-mono tabular-nums">
                  {(
                    [
                      {
                        label: 'DIST',
                        desc: 'Distribusi',
                        awal: summary.awal.dist,
                        masuk: summary.masuk.dist,
                        keluar: summary.keluar.dist,
                        akhir: summary.akhir.dist,
                      },
                      {
                        label: 'AGA',
                        desc: 'Niaga / Pelayanan Pelanggan',
                        awal: summary.awal.aga,
                        masuk: summary.masuk.aga,
                        keluar: summary.keluar.aga,
                        akhir: summary.akhir.aga,
                      },
                      {
                        label: 'TE',
                        desc: 'Transaksi Energi',
                        awal: summary.awal.te,
                        masuk: summary.masuk.te,
                        keluar: summary.keluar.te,
                        akhir: summary.akhir.te,
                      },
                    ] as const
                  ).map((row) => (
                    <tr
                      key={row.label}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <DivisionBadge division={row.label} />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {row.desc}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-800 dark:text-slate-200">
                        {row.awal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400 font-medium">
                        +{row.masuk.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-4 text-right text-amber-700 dark:text-amber-400 font-medium">
                        -{row.keluar.toLocaleString('id-ID')}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-semibold ${
                          row.akhir < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {row.akhir.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/90 dark:bg-slate-800/60 font-semibold">
                    <td className="py-2.5 px-4 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Total Keseluruhan Gudang
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-900 dark:text-slate-100">
                      {summary.awal.total.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400">
                      +{summary.masuk.total.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-amber-700 dark:text-amber-400">
                      -{summary.keluar.total.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-indigo-700 dark:text-indigo-300">
                      {summary.akhir.total.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Category Breakdown */}
            <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Distribusi Stok Akhir per Kategori Material
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pengelompokan otomatis berdasarkan jenis material kelistrikan &amp; gudang
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('inventory')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {categoryStats.map((stat) => {
                  const sharePct =
                    summary.akhir.total > 0
                      ? Math.min(100, Math.round((stat.akhirTotal / summary.akhir.total) * 100))
                      : 0;
                  return (
                    <div key={stat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {stat.category}
                        </span>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
                          <span>
                            {stat.activeCount} aktif / {stat.count} SKU
                          </span>
                          {stat.alerts > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {stat.alerts} alert
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 min-w-[48px] text-right">
                            {stat.akhirTotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            stat.alerts > 0
                              ? 'bg-amber-500'
                              : 'bg-cyan-600 dark:bg-cyan-500'
                          }`}
                          style={{ width: `${Math.max(stat.akhirTotal > 0 ? 4 : 0, sharePct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Active Automatic Alerts */}
            <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Notifikasi Otomatis Aktif
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('notifications')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>Pusat Alert ({unresolvedAlerts.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {unresolvedAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Semua material aktif dalam batas aman
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Tidak ada peringatan material menipis atau kritis yang belum ditangani.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {unresolvedAlerts.slice(0, 4).map((alert) => {
                    const targetMat = materials.find((m) => m.id === alert.materialId);
                    return (
                      <li
                        key={alert.id}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <NotificationSeverityLabel severity={alert.severity} />
                              <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                                {alert.materialSku}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {alert.materialName}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                              Stok Akhir {alert.currentStock} {alert.unit} (Min: {alert.threshold} {alert.unit})
                            </p>
                          </div>
                          {targetMat && (
                            <button
                              type="button"
                              onClick={() => onQuickRestock(targetMat)}
                              className="px-2.5 py-1.5 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              Isi Stok
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Priority Watch & Recent Movements */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Prioritas Pengadaan Material Aktif
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {summary.activeAlertMaterials.length} item perlu perhatian
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                      <th className="py-2.5 px-4">No &amp; Material</th>
                      <th className="py-2.5 px-4 text-right">Masuk / Keluar</th>
                      <th className="py-2.5 px-4 text-right">Stok Akhir</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {(summary.activeAlertMaterials.length > 0
                      ? summary.activeAlertMaterials
                      : materials.filter((m) => hasMaterialActivity(m))
                    )
                      .slice(0, 6)
                      .map((mat) => (
                        <tr
                          key={mat.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                              {mat.name}
                            </div>
                            <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              #{mat.rowNumber || '-'} · {mat.sku}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                            <span className="text-emerald-700 dark:text-emerald-400">
                              +{mat.materialMasuk?.total ?? 0}
                            </span>
                            <span className="mx-1 text-slate-400">/</span>
                            <span className="text-amber-700 dark:text-amber-400">
                              -{mat.materialKeluar?.total ?? 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {mat.stokAkhir?.total ?? mat.currentStock} {mat.unit}
                          </td>
                          <td className="py-2.5 px-4">
                            <MaterialStatusIndicator
                              status={mat.status}
                              isInactive={!hasMaterialActivity(mat) && mat.minThreshold === 0}
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onQuickRestock(mat)}
                              className="text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
                            >
                              Catat Mutasi
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Recent Movements */}
            <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Log Mutasi Terbaru
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateTab('movements')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
                >
                  <span>Semua Log ({movements.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {movements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Belum ada mutasi stok tercatat.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                        <th className="py-2.5 px-4">Material</th>
                        <th className="py-2.5 px-4">Bidang &amp; Tipe</th>
                        <th className="py-2.5 px-4 text-right">Jumlah</th>
                        <th className="py-2.5 px-4 text-right">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {movements.slice(0, 6).map((mv) => (
                        <tr
                          key={mv.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                              {mv.materialName}
                            </div>
                            <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              {mv.referenceNo}
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <DivisionBadge division={mv.division || 'UMUM'} />
                              <MovementTypeLabel type={mv.type} />
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-0.5 font-medium ${
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
                              ) : null}
                              {mv.type === 'in' ? '+' : mv.type === 'out' ? '-' : ''}
                              {mv.quantity} {mv.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDateTimeID(mv.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
