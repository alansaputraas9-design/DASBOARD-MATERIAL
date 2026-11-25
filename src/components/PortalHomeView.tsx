import {
  ArrowLeftRight,
  ArrowRight,
  BellRing,
  Box,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  FileSpreadsheet,
  Layers,
  LayoutDashboard,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import kalebajengPlnHeroImg from '../assets/images/kalebajeng_pln_daylight_hero_1795586564030.jpg';
import { hasMaterialActivity } from '../services/inventoryService';
import { Material, Project, StockMovement, StockNotification } from '../types/inventory';
import { PlnEmblem } from './PlnEmblem';

interface PortalHomeViewProps {
  project: Project | null;
  projects: Project[];
  materials: Material[];
  movements: StockMovement[];
  notifications: StockNotification[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onNavigateTab: (
    tab:
      | 'overview'
      | 'inventory'
      | 'movements'
      | 'notifications'
      | 'sheets'
      | 'piket'
      | 'workbook'
      | 'kpi'
  ) => void;
  onQuickMovement: () => void;
  onSignOut?: () => void;
}

export function PortalHomeView({
  project,
  projects,
  materials,
  movements,
  notifications,
  darkMode,
  onToggleDarkMode,
  onSelectProject,
  onOpenNewProject,
  onNavigateTab,
  onQuickMovement,
  onSignOut,
}: PortalHomeViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
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

  const totalItems = materials.length;
  const activeMaterials = materials.filter((m) => hasMaterialActivity(m));
  const alertCount = activeMaterials.filter(
    (m) => m.status !== 'nominal' && m.minThreshold > 0
  ).length;
  const unresolvedCount = notifications.filter((n) => !n.isResolved).length;

  const totalStokAkhir = materials.reduce(
    (sum, m) => sum + (m.stokAkhir?.total ?? m.currentStock),
    0
  );

  const portalCards = [
    {
      id: 'inventory',
      title: 'Tabel Stok & Mutasi Gudang',
      description: 'Stok Awal, Masuk, Keluar & Stok Akhir per bidang (DIST / AGA / TE)',
      metric: `${activeMaterials.length} Aktif / ${totalItems.toLocaleString('id-ID')}`,
      metricColor: 'text-indigo-700',
      icon: <Box className="w-5 h-5 text-indigo-600" />,
      action: () => onNavigateTab('inventory'),
    },
    {
      id: 'overview',
      title: 'Rekapitulasi & Saldo Bidang',
      description: 'Ringkasan Stok Awal, Masuk, Keluar & Akhir untuk DIST, AGA, TE',
      metric: `${totalStokAkhir.toLocaleString('id-ID')} Stok Akhir`,
      metricColor: 'text-emerald-700',
      icon: <LayoutDashboard className="w-5 h-5 text-sky-700" />,
      action: () => onNavigateTab('overview'),
    },
    {
      id: 'movements',
      title: 'Log Mutasi Masuk & Keluar',
      description: 'Riwayat mutasi material per bidang (DIST, AGA, TE) secara real-time',
      metric: `${movements.length.toLocaleString('id-ID')} Log`,
      metricColor: 'text-sky-700',
      icon: <ArrowLeftRight className="w-5 h-5 text-sky-600" />,
      action: () => onNavigateTab('movements'),
    },
    {
      id: 'notifications',
      title: 'Notifikasi Stok Otomatis',
      description: 'Peringatan material aktif menipis, kritis, atau habis secara real-time',
      metric: unresolvedCount > 0 ? `${unresolvedCount} Alert` : 'Aman',
      metricColor: unresolvedCount > 0 ? 'text-red-600' : 'text-emerald-700',
      icon: (
        <BellRing
          className={`w-5 h-5 ${
            unresolvedCount > 0 ? 'text-red-600' : 'text-emerald-600'
          }`}
        />
      ),
      action: () => onNavigateTab('notifications'),
    },
    {
      id: 'sheets',
      title: 'Sumber Spreadsheet CSV Live',
      description: 'Sinkronisasi & bangun ulang dari CSV publik Gd Ry Sinjai tanpa OAuth',
      metric: 'CSV Live · Gd Ry Sinjai',
      metricColor: 'text-emerald-700',
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
      action: () => onNavigateTab('sheets'),
    },
    {
      id: 'piket',
      title: 'Jadwal Piket ULP Sinjai (Form C1.A)',
      description: 'Jadwal penugasan piket/shift/kategori P21B khusus (gid: 418796009)',
      metric: 'PIKET · 418796009',
      metricColor: 'text-amber-700',
      icon: <CalendarCheck2 className="w-5 h-5 text-amber-600" />,
      action: () => onNavigateTab('piket'),
    },
    {
      id: 'kpi',
      title: 'KPI Pelanggan, MVA, BP & Saldo',
      description: 'Grafik target vs realisasi Delta Pelanggan, MVA, BP & Saldo (4 Tab)',
      metric: 'KPI Live · gid=0',
      metricColor: 'text-sky-700',
      icon: <TrendingUp className="w-5 h-5 text-sky-600" />,
      action: () => onNavigateTab('kpi'),
    },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between bg-gradient-to-br from-sky-100 via-cyan-50 to-white text-slate-900">
      {!imgError && (
        <img
          src={kalebajengPlnHeroImg}
          alt="Panorama Cerah Arsitektur Balla Lompoa Wilayah Kalebajeng, Persawahan Hijau Gowa, dan Gardu Listrik PLN di bawah Langit Cerah"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover object-center brightness-105 contrast-[0.98] select-none pointer-events-none"
        />
      )}

      {/* Bright Daylight Wash & Warm Sunbeam Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-white/70 via-sky-50/10 to-white/85 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(254,240,138,0.48),rgba(186,230,253,0.18)_48%,transparent_78%)] pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Portal Header — Pojok Kiri Atas dengan Lambang PLN & Semboyan */}
      <header className="relative z-20 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white/92 backdrop-blur-md border border-sky-200/90 shadow-sm min-w-0">
          <PlnEmblem size="lg" />
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900 uppercase leading-none font-display">
                Dasbor Monitoring Material PLN
              </h1>
              <span className="text-xs font-semibold font-mono text-sky-700 tracking-wide">
                · REAL-TIME DB
              </span>
            </div>
            <div className="mt-1 text-xs sm:text-sm font-bold tracking-wide text-amber-600 font-display">
              Terang, Benderang, Yess
            </div>
            <div className="mt-1 flex items-center flex-wrap gap-2 text-xs text-slate-600">
              <span className="font-semibold text-sky-800 truncate max-w-xs sm:max-w-md">
                {project?.name || 'Gd Ry Sinjai — Monitoring Material'}
              </span>
              {project?.location && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-slate-600 truncate">{project.location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live Operational Light Glass Widgets */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-sky-200/80 shadow-sm">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono leading-none">
              Waktu Lokal
            </div>
            <div className="text-sm font-bold text-slate-950 font-mono tabular-nums leading-tight mt-0.5">
              {timeFormatted}
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-sky-200/80 shadow-sm">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 font-bold font-mono leading-none flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-sky-700" />
              <span>{dateFormatted}</span>
            </div>
            <div className="text-xs font-semibold text-slate-950 leading-tight mt-0.5 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate max-w-[160px]">
                PJ: {project?.managerName || 'Admin Gudang'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('sheets')}
            className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white backdrop-blur-md border border-sky-200/80 hover:border-emerald-500 shadow-sm transition-all text-left group flex items-center gap-2"
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-800 font-bold font-mono leading-none flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                <span>Google Sheet CSV</span>
              </div>
              <div className="text-xs font-bold text-slate-950 font-mono tabular-nums leading-tight mt-0.5">
                Gd Ry Sinjai · Live
              </div>
            </div>
            <RefreshCw className="w-3.5 h-3.5 text-emerald-700 group-hover:rotate-45 transition-transform" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('piket')}
            className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white backdrop-blur-md border border-sky-200/80 hover:border-amber-500 shadow-sm transition-all text-left group flex items-center gap-2"
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider text-amber-800 font-bold font-mono leading-none flex items-center gap-1">
                <CalendarCheck2 className="w-3 h-3 text-amber-700" />
                <span>Sheet PIKET</span>
              </div>
              <div className="text-xs font-bold text-slate-950 font-mono tabular-nums leading-tight mt-0.5">
                Form C1.A · 418796009
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('workbook')}
            className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white backdrop-blur-md border border-sky-200/80 hover:border-indigo-500 shadow-sm transition-all text-left group flex items-center gap-2"
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider text-indigo-800 font-bold font-mono leading-none flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-700" />
                <span>Workbook Sheet</span>
              </div>
              <div className="text-xs font-bold text-slate-950 font-mono tabular-nums leading-tight mt-0.5">
                10 Sheet · 4 Kelompok
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('kpi')}
            className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white backdrop-blur-md border border-sky-200/80 hover:border-sky-500 shadow-sm transition-all text-left group flex items-center gap-2"
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider text-sky-800 font-bold font-mono leading-none flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-sky-700" />
                <span>KPI &amp; Grafik</span>
              </div>
              <div className="text-xs font-bold text-slate-950 font-mono tabular-nums leading-tight mt-0.5">
                Pelanggan &amp; MVA
              </div>
            </div>
          </button>

          {projects.length > 0 && (
            <select
              aria-label="Pilih proyek aktif"
              value={project?.id || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/92 backdrop-blur-md border border-sky-200/85 text-xs font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 max-w-[200px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onQuickMovement}
            className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold shadow-sm transition-colors whitespace-nowrap"
          >
            Catat Mutasi
          </button>

          <button
            type="button"
            onClick={onOpenNewProject}
            className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            + Gudang
          </button>
        </div>
      </header>

      {/* Live Alert Strip */}
      <div className="relative z-10 flex-1 min-h-[140px] sm:min-h-[190px] lg:min-h-[220px] flex items-end px-4 sm:px-6 lg:px-8 pb-4">
        {alertCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigateTab('notifications')}
            className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rose-50/95 hover:bg-rose-100 backdrop-blur-md border border-rose-300 text-xs text-rose-900 shadow-sm transition-colors"
          >
            <BellRing className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong className="font-mono tabular-nums">{alertCount}</strong> material aktif berada di bawah ambang batas stok aman
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-rose-600" />
          </button>
        )}
      </div>

      {/* Bottom Command Portal Grid */}
      <section
        aria-label="Menu Utama Modul"
        className="relative z-20 px-4 sm:px-6 lg:px-8 pb-5 pt-2 space-y-3"
      >
        <button
          type="button"
          onClick={() => onNavigateTab('workbook')}
          className="w-full group text-left px-4 py-3 rounded-xl bg-white/92 hover:bg-white backdrop-blur-md border border-sky-300/85 hover:border-sky-500 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
              <Layers className="w-5 h-5 text-sky-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight">
                Rekap Workbook Material &amp; Mutasi (10 Sheet Terlampir)
              </h2>
              <p className="text-[11px] text-slate-600 truncate mt-0.5">
                Dikelompokkan per sheet: Varian Material, STOK (referensi), MATERIAL MASUK, MATERIAL KELUAR, Sheet5, Sheet4, Sheet1 (1) &amp; Sheet1–3
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs font-mono font-semibold text-sky-700">
            <span>Buka 10 Sheet</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {portalCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={card.action}
              className="group text-left px-3.5 py-3 rounded-xl bg-white/92 hover:bg-white backdrop-blur-md border border-sky-200/75 hover:border-sky-500 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-sky-50/80 border border-sky-100 flex items-center justify-center shadow-2xs">
                {card.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                  <h2 className="text-xs sm:text-[13px] font-bold text-slate-950 group-hover:text-sky-800 uppercase tracking-tight leading-snug truncate">
                    {card.title}
                  </h2>
                  <span
                    className={`text-[11px] font-bold font-mono tabular-nums whitespace-nowrap shrink-0 ${card.metricColor}`}
                  >
                    {card.metric}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                  {card.description}
                </p>
              </div>
              <div className="shrink-0 w-6 h-6 rounded-lg bg-sky-100/80 group-hover:bg-sky-600 text-sky-700 group-hover:text-white flex items-center justify-center transition-colors">
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>

        <footer className="px-1 pt-1 flex items-center justify-between text-[11px] text-slate-700 gap-3">
          <div className="truncate">
            © 2026 <span className="font-bold text-slate-900">PLN ULP Sinjai · BinaLogistik</span> · Monitoring Material Gd Ry Sinjai Real-Time
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
              aria-label="Ubah tema tampilan"
              className="w-8 h-8 rounded-full bg-white/90 hover:bg-sky-600 text-slate-700 hover:text-white backdrop-blur-md border border-sky-200 shadow-xs flex items-center justify-center transition-colors"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                title="Keluar"
                aria-label="Keluar akun"
                className="w-8 h-8 rounded-full bg-white/90 hover:bg-red-600 text-slate-700 hover:text-white backdrop-blur-md border border-sky-200 shadow-xs flex items-center justify-center transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
