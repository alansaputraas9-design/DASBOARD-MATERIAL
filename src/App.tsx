import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  Menu,
  Moon,
  Sun,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Component, ReactNode, useEffect, useState } from 'react';
import { BpblPusatSection } from './components/BpblPusatSection';
import { BpblSheetSection } from './components/BpblSheetSection';
import { PlnEmblem } from './components/PlnEmblem';
import { PortalDestination, PortalHomeView } from './components/PortalHomeView';
import { WarehouseDashboard } from './components/WarehouseDashboard';

type ActiveView = 'home' | 'warehouse' | 'bpbl' | 'bpbl-pusat';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Terjadi Gangguan Memuat Data Dasbor
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardShell() {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [initialSection, setInitialSection] = useState<string | undefined>(
    undefined
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('kbj_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem('kbj_dark_mode', String(darkMode));
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  function handlePortalNavigate(dest: PortalDestination) {
    if (dest.menu === 'warehouse') {
      setInitialSection(dest.section);
      setActiveView('warehouse');
    } else if (dest.menu === 'bpbl-pusat') {
      setInitialSection(undefined);
      setActiveView('bpbl-pusat');
    } else {
      setInitialSection(undefined);
      setActiveView('bpbl');
    }
    setMobileMenuOpen(false);
  }

  function handleSelectSidebarItem(view: ActiveView, section?: string) {
    setInitialSection(section);
    setActiveView(view);
    setMobileMenuOpen(false);
  }

  if (activeView === 'home') {
    return (
      <PortalHomeView
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
        onNavigate={handlePortalNavigate}
      />
    );
  }

  const navItems: Array<{
    id: ActiveView;
    label: string;
    sublabel: string;
    icon: typeof Home;
  }> = [
    {
      id: 'home',
      label: 'Beranda',
      sublabel: 'Portal & Menu Utama',
      icon: Home,
    },
    {
      id: 'warehouse',
      label: 'Material & Grafik',
      sublabel: 'Gudang KBJ-Bahagia 2026',
      icon: BarChart3,
    },
    {
      id: 'bpbl',
      label: 'Data BPBL 2026',
      sublabel: 'Penerima & Sambungan 900 VA',
      icon: Zap,
    },
    {
      id: 'bpbl-pusat',
      label: 'BPBL Pusat 2026',
      sublabel: 'Anggaran Pusat ULP KBJ',
      icon: Users,
    },
  ];

  const activeBreadcrumbLabel =
    activeView === 'warehouse'
      ? 'Material & Grafik Gudang'
      : activeView === 'bpbl-pusat'
      ? 'BPBL Anggaran Pusat 2026'
      : 'Data BPBL T.A 2026';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible Left Sidebar (#main-sidebar matching ulpsinjai.netlify.app architecture) */}
      <aside
        id="main-sidebar"
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
        } ${
          mobileMenuOpen
            ? 'translate-x-0 w-64'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Lockup + Collapse Button */}
        <div className="h-14 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => handleSelectSidebarItem('home')}
              className="flex items-center gap-2.5 min-w-0 text-left"
            >
              <PlnEmblem size="sm" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate font-display leading-tight">
                  PLN ULP Kalebajeng
                </div>
                <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 truncate leading-tight">
                  Terang, Benderang, Yess
                </div>
              </div>
            </button>
          )}

          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => handleSelectSidebarItem('home')}
              title="Beranda Portal"
              className="hidden lg:flex mx-auto"
            >
              <PlnEmblem size="sm" />
            </button>
          )}

          <button
            type="button"
            id="collapse-sidebar-btn"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="hidden lg:inline-flex p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors shrink-0"
            title={sidebarCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            aria-label={sidebarCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav
          aria-label="Menu Operasional"
          className="flex-1 px-2 py-3 space-y-1.5 overflow-y-auto"
        >
          {!sidebarCollapsed && (
            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Menu Operasional
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSidebarItem(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-bold border border-cyan-300 dark:border-cyan-700 shadow-xs ring-1 ring-cyan-200 dark:ring-cyan-800'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate leading-tight">
                      {item.label}
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                      {item.sublabel}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Light/Dark Theme Toggle */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode((v) => !v)}
            title={darkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white dark:hover:bg-cyan-600 transition-colors ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            {!sidebarCollapsed && (
              <span className="whitespace-nowrap">
                {darkMode ? 'Mode Terang' : 'Mode Gelap'}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header (h-14) */}
        <header className="h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 sticky top-0 z-30 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Buka Navigasi"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectSidebarItem('home')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Portal</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">ULP Kalebajeng</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeBreadcrumbLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline text-xs font-mono text-cyan-700 dark:text-cyan-400 whitespace-nowrap">
              UP3 Makassar Selatan · Live Sheets
            </span>
          </div>
        </header>

        {/* Active Module Viewport */}
        <div className="flex-1 min-w-0">
          {activeView === 'warehouse' ? (
            <WarehouseDashboard initialSection={initialSection} />
          ) : activeView === 'bpbl-pusat' ? (
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
              <BpblPusatSection />
            </main>
          ) : (
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
              <BpblSheetSection />
            </main>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <DashboardShell />
    </AppErrorBoundary>
  );
}
