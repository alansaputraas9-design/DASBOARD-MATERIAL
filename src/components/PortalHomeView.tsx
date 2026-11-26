import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Moon,
  Search,
  ShieldAlert,
  Sun,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchBpblPusatData } from '../services/bpblPusatService';
import { fetchBpblTab } from '../services/bpblSheetService';
import {
  fetchWarehouseMonthTab,
  WAREHOUSE_MONTH_TABS,
} from '../services/warehouseSheetService';
import { PlnEmblem } from './PlnEmblem';

export type PortalDestination =
  | { menu: 'warehouse'; section?: string }
  | { menu: 'bpbl' }
  | { menu: 'bpbl-pusat' };

interface PortalHomeViewProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (dest: PortalDestination) => void;
}

interface LivePortalStats {
  warehouseItems: number | null;
  warehouseMasuk: number | null;
  warehouseKeluar: number | null;
  bpblTotal: number | null;
  bpblSiapMeter: number | null;
  bpblPusatTotal: number | null;
  bpblPusatKecamatan: number | null;
  bpblPusatDesa: number | null;
}

export function PortalHomeView({
  darkMode,
  onToggleDarkMode,
  onNavigate,
}: PortalHomeViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [imgError, setImgError] = useState(false);
  const [stats, setStats] = useState<LivePortalStats>({
    warehouseItems: null,
    warehouseMasuk: null,
    warehouseKeluar: null,
    bpblTotal: null,
    bpblSiapMeter: null,
    bpblPusatTotal: null,
    bpblPusatKecamatan: null,
    bpblPusatDesa: null,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const oktTab =
      WAREHOUSE_MONTH_TABS.find((t) => t.gid === '410640151') ||
      WAREHOUSE_MONTH_TABS[9];

    const loadPortalStats = () => {
      Promise.allSettled([
        fetchWarehouseMonthTab(oktTab),
        fetchBpblTab('gowa'),
        fetchBpblPusatData(),
      ]).then(([whRes, bpblRes, pusatRes]) => {
        if (!active) return;
        const next: LivePortalStats = {
          warehouseItems: null,
          warehouseMasuk: null,
          warehouseKeluar: null,
          bpblTotal: null,
          bpblSiapMeter: null,
          bpblPusatTotal: null,
          bpblPusatKecamatan: null,
          bpblPusatDesa: null,
        };
        if (whRes.status === 'fulfilled') {
          const items = whRes.value.items;
          next.warehouseItems = items.length;
          next.warehouseMasuk = items.reduce((s, i) => s + i.jumlahMasuk, 0);
          next.warehouseKeluar = items.reduce((s, i) => s + i.jumlahKeluar, 0);
        }
        if (bpblRes.status === 'fulfilled') {
          const recs = bpblRes.value.records;
          next.bpblTotal = recs.length;
          next.bpblSiapMeter = recs.filter(
            (r) =>
              r.stage === 'Sudah Terpasang' ||
              r.stage === 'Aktivasi Meter (Sisa Cetak)'
          ).length;
        }
        if (pusatRes.status === 'fulfilled') {
          const recs = pusatRes.value.records;
          next.bpblPusatTotal = recs.length;
          next.bpblPusatKecamatan = new Set(recs.map((r) => r.kecamatan)).size;
          next.bpblPusatDesa = new Set(
            recs.map((r) => `${r.kecamatan}::${r.desaKelurahan}`)
          ).size;
        }
        setStats(next);
      });
    };

    loadPortalStats();
    const onSync = () => {
      if (document.visibilityState === 'visible') {
        loadPortalStats();
      }
    };
    const interval = window.setInterval(onSync, 60_000);
    document.addEventListener('visibilitychange', onSync);
    window.addEventListener('focus', onSync);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onSync);
      window.removeEventListener('focus', onSync);
    };
  }, []);

  const timeFormatted = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const dateFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  const menuCards: Array<{
    id: string;
    title: string;
    subtitle: string;
    metricText: string;
    iconBg: string;
    icon: typeof BarChart3;
    destination: PortalDestination;
  }> = [
    {
      id: 'material-overview',
      title: 'Monitoring Material Gudang',
      subtitle: 'Stok awal, masuk, keluar & saldo akhir harian (OKT 2026 gid=410640151)',
      metricText:
        stats.warehouseItems !== null
          ? `${stats.warehouseItems} Item · +${stats.warehouseMasuk?.toLocaleString('id-ID')} / -${stats.warehouseKeluar?.toLocaleString('id-ID')}`
          : '11 Bulan Live (JAN–NOV 2026)',
      iconBg: 'bg-cyan-600 text-white',
      icon: BarChart3,
      destination: { menu: 'warehouse', section: 'section-charts' },
    },
    {
      id: 'tren-tahunan',
      title: 'Grafik Tren & Perputaran 2026',
      subtitle: 'Perbandingan arus masuk vs keluar antar bulan & kurva saldo tahunan',
      metricText: 'JAN 2026 – NOV 2026 · APP & HAR',
      iconBg: 'bg-indigo-600 text-white',
      icon: TrendingUp,
      destination: { menu: 'warehouse', section: 'section-yearly' },
    },
    {
      id: 'pencarian-item',
      title: 'Daftar Pencarian & Mutasi Item',
      subtitle: 'Cari kode/nama material, rincian harian tgl 1–31 & log transaksi',
      metricText:
        stats.warehouseItems !== null
          ? `${stats.warehouseItems} Material Terdaftar`
          : 'Katalog APP & HAR',
      iconBg: 'bg-sky-600 text-white',
      icon: Search,
      destination: { menu: 'warehouse', section: 'section-search' },
    },
    {
      id: 'safety-stock',
      title: 'Simulasi Safety Stock & ROP',
      subtitle: 'Proyeksi ketahanan stok 30 hari, lead time & ambang pemesanan ulang',
      metricText: 'Kalkulator Lead Time & Service Level Z',
      iconBg: 'bg-amber-500 text-white',
      icon: ShieldAlert,
      destination: { menu: 'warehouse', section: 'section-safety' },
    },
    {
      id: 'data-bpbl',
      title: 'Data BPBL T.A 2026',
      subtitle: 'Calon penerima & progres penyambungan 900 VA wilayah Kab. Gowa (ULP Kalebajeng)',
      metricText:
        stats.bpblTotal !== null
          ? `${stats.bpblTotal} Penerima Gowa · ${stats.bpblSiapMeter} Meter Siap`
          : 'Kab. Gowa · gid=1826313696',
      iconBg: 'bg-emerald-600 text-white',
      icon: Zap,
      destination: { menu: 'bpbl' },
    },
    {
      id: 'data-bpbl-pusat',
      title: 'BPBL Anggaran Pusat 2026',
      subtitle: 'Rekap & pengelompokan pelanggan BPBL ULP Kalebajeng per kecamatan, desa & sumber data',
      metricText:
        stats.bpblPusatTotal !== null
          ? `${stats.bpblPusatTotal} Pelanggan · ${stats.bpblPusatKecamatan} Kec · ${stats.bpblPusatDesa} Desa`
          : 'BPBL ULP KBJ · gid=0',
      iconBg: 'bg-teal-600 text-white',
      icon: Users,
      destination: { menu: 'bpbl-pusat' },
    },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden flex flex-col justify-between bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      {!imgError && (
        <img
          src="/assets/images/kalebajeng_pln_daylight_hero_1795586564030.jpg"
          alt="Panorama Cerah Arsitektur Kalebajeng, Persawahan Gowa, dan Jaringan Listrik PLN"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="fixed inset-0 w-full h-full object-cover object-center brightness-105 contrast-[0.98] select-none pointer-events-none"
        />
      )}

      {/* Measured Scrim for High Readability */}
      <div
        className="fixed inset-0 bg-gradient-to-b from-white/80 via-sky-50/45 to-white/85 dark:from-slate-950/85 dark:via-slate-950/75 dark:to-slate-950/90 pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Portal Header */}
      <header className="relative z-20 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-sm min-w-0">
          <PlnEmblem size="lg" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight font-display">
              DASBOARD KINERJA ULP KALEBAJENG
            </h1>
            <div className="mt-1 flex items-center flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                UP3 Makassar Selatan
              </span>
              <span aria-hidden="true">·</span>
              <span>ULP Kalebajeng</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                REWAKO
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>{dateFormatted}</span>
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums leading-tight mt-1">
              {timeFormatted} WITA
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ menu: 'warehouse' })}
            className="px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm transition-colors text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>Buka Workspace</span>
          </button>
        </div>
      </header>

      {/* Main Portal Menu Launcher Grid (ulpsinjai.netlify.app aesthetic) */}
      <main className="relative z-20 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col justify-center">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
                Menu Operasional &amp; Monitoring Utama
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                Pilih modul pemantauan gudang KBJ-Bahagia atau progres penyambungan BPBL 2026 langsung dari Google Spreadsheet live.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {menuCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onNavigate(card.destination)}
                  className="group text-left bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-500 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-150 flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${card.iconBg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors leading-snug">
                        {card.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {card.subtitle}
                      </p>
                      <div className="pt-0.5 text-xs font-mono tabular-nums font-semibold text-cyan-700 dark:text-cyan-400 truncate">
                        {card.metricText}
                      </div>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-cyan-600 text-slate-500 dark:text-slate-400 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-20 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pb-5 flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
        <div className="px-3.5 py-2 rounded-xl bg-white/88 dark:bg-slate-900/88 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-2xs truncate">
          © 2026 <strong className="text-slate-900 dark:text-slate-100">PLN ULP Kalebajeng</strong> · UP3 Makassar Selatan
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/92 dark:bg-slate-900/92 hover:bg-cyan-600 hover:text-white text-slate-700 dark:text-slate-200 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs text-xs font-medium transition-colors shrink-0"
        >
          {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span>{darkMode ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>
      </footer>
    </div>
  );
}
