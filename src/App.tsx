import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeftRight,
  Bell,
  Box,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FolderPlus,
  Home,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Settings2,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import { Component, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { InventoryView } from './components/InventoryView';
import { KpiTargetView } from './components/KpiTargetView';
import { PlnEmblem } from './components/PlnEmblem';
import {
  DeleteConfirmModal,
  MaterialModal,
  MovementModal,
  ProjectModal,
} from './components/Modals';
import { MovementsView } from './components/MovementsView';
import { NotificationsView } from './components/NotificationsView';
import { OverviewView } from './components/OverviewView';
import { PiketView } from './components/PiketView';
import { PortalHomeView } from './components/PortalHomeView';
import { SheetsSyncView } from './components/SheetsSyncView';
import { NotificationSeverityLabel } from './components/StatusText';
import { WorkbookSheetsView } from './components/WorkbookSheetsView';
import {
  db,
  handleFirestoreError,
  OperationType,
  PUBLIC_OPERATOR,
  PUBLIC_OWNER_ID,
  testFirestoreConnection,
} from './lib/firebase';
import {
  createMaterialWithInitialStock,
  createProject,
  createProjectFromSheet,
  deleteMaterial,
  hasMaterialActivity,
  markAllNotificationsRead,
  markNotificationRead,
  MaterialFormInput,
  rebuildProjectFromLivePublishedCsv,
  rebuildProjectFromSheetItems,
  recordStockMovement,
  resolveNotification,
  seedStarterProject,
  StockMovementInput,
  syncMaterialsFromSheet,
  updateMaterialConfig,
  updateProjectStatus,
} from './services/inventoryService';
import {
  Material,
  MaterialStatus,
  MovementType,
  Project,
  ProjectStatus,
  StockMovement,
  StockNotification,
} from './types/inventory';

type ActiveTab =
  | 'home'
  | 'overview'
  | 'inventory'
  | 'piket'
  | 'workbook'
  | 'kpi'
  | 'movements'
  | 'notifications'
  | 'sheets';

const STATUS_PRIORITY: Record<MaterialStatus, number> = {
  out: 0,
  critical: 1,
  low: 2,
  nominal: 3,
};

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
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Terjadi Gangguan Sinkronisasi Data
            </h1>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardApp() {
  const [offlineBanner, setOfflineBanner] = useState<string | null>(null);
  const [rebuildingCsv, setRebuildingCsv] = useState(false);
  const [rebuildingBanner, setRebuildingBanner] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [notifications, setNotifications] = useState<StockNotification[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [liveToast, setLiveToast] = useState<StockNotification | null>(null);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Modals
  const [movementModalState, setMovementModalState] = useState<{
    open: boolean;
    material?: Material | null;
    type?: MovementType;
  }>({ open: false });

  const [materialModalState, setMaterialModalState] = useState<{
    open: boolean;
    editing?: Material | null;
  }>({ open: false });

  const [projectModalState, setProjectModalState] = useState<{
    open: boolean;
    mode: 'create' | 'status';
  }>({ open: false, mode: 'create' });

  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);

  const seededRef = useRef(false);
  const migratedProjectsRef = useRef<Set<string>>(new Set());
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const notifInitializedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('binalogistik-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('binalogistik-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    testFirestoreConnection().then((res) => {
      if (!res.connected) {
        setOfflineBanner(
          'Koneksi ke server database Firestore tidak dapat dijangkau. Periksa jaringan internet atau konfigurasi Firebase.'
        );
      }
    });
  }, []);

  // Listen to shared public workspace projects
  useEffect(() => {
    setProjectsLoading(true);
    const path = 'projects';
    const q = query(collection(db, path), where('ownerId', '==', PUBLIC_OWNER_ID));

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const list: Project[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Project, 'id'>),
        }));
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis() ?? 0;
          const tB = b.createdAt?.toMillis() ?? 0;
          return tB - tA;
        });

        if (list.length === 0 && !seededRef.current) {
          seededRef.current = true;
          try {
            setRebuildingBanner('Menarik 1.827 baris material awal dari Spreadsheet CSV Gd Ry Sinjai...');
            const newId = await seedStarterProject(PUBLIC_OPERATOR);
            setActiveProjectId(newId);
          } catch (err) {
            console.error(err);
          } finally {
            setRebuildingBanner(null);
          }
          return;
        }

        setProjects(list);
        setActiveProjectId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
        setProjectsLoading(false);
      },
      (error) => {
        setProjectsLoading(false);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return unsub;
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // Listen to materials, movements, notifications for activeProjectId
  useEffect(() => {
    if (!activeProject) {
      setMaterials([]);
      setMovements([]);
      setNotifications([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    notifInitializedProjectRef.current = null;
    seenNotifIdsRef.current = new Set();

    const matPath = `projects/${activeProject.id}/materials`;
    const movPath = `projects/${activeProject.id}/movements`;
    const ntfPath = `projects/${activeProject.id}/notifications`;

    const unsubMat = onSnapshot(
      query(collection(db, matPath), where('ownerId', '==', activeProject.ownerId)),
      (snapshot) => {
        const items: Material[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Material, 'id'>),
        }));

        // Check whether existing data uses legacy schema/starter data and migrate once cleanly
        const needsLegacyRebuild =
          !migratedProjectsRef.current.has(activeProject.id) &&
          (activeProject.name === 'Proyek Menara Sudirman — Fase II' ||
            (items.length > 0 &&
              items.some(
                (m) => !m.stokAkhir || typeof m.rowNumber !== 'number'
              )));

        if (needsLegacyRebuild) {
          migratedProjectsRef.current.add(activeProject.id);
          setRebuildingCsv(true);
          setRebuildingBanner(
            'Menghapus data lama dan membangun ulang database sesuai Spreadsheet CSV Gd Ry Sinjai...'
          );
          rebuildProjectFromLivePublishedCsv(PUBLIC_OPERATOR, activeProject.id)
            .catch((err) => {
              console.error('Gagal migrasi data dari CSV:', err);
            })
            .finally(() => {
              setRebuildingCsv(false);
              setRebuildingBanner(null);
            });
        }

        items.sort((a, b) => {
          const actA = hasMaterialActivity(a) ? 0 : 1;
          const actB = hasMaterialActivity(b) ? 0 : 1;
          if (actA !== actB) return actA - actB;

          if (actA === 0) {
            const diff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
            if (diff !== 0) return diff;
          }
          const rA = a.rowNumber || 0;
          const rB = b.rowNumber || 0;
          if (rA !== rB) return rA - rB;
          return a.name.localeCompare(b.name, 'id');
        });
        setMaterials(items);
        setDataLoading(false);
      },
      (error) => {
        setDataLoading(false);
        handleFirestoreError(error, OperationType.LIST, matPath);
      }
    );

    const unsubMov = onSnapshot(
      query(collection(db, movPath), where('ownerId', '==', activeProject.ownerId)),
      (snapshot) => {
        const items: StockMovement[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StockMovement, 'id'>),
        }));
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis() ?? Date.now();
          const tB = b.createdAt?.toMillis() ?? Date.now();
          return tB - tA;
        });
        setMovements(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, movPath);
      }
    );

    const unsubNtf = onSnapshot(
      query(collection(db, ntfPath), where('ownerId', '==', activeProject.ownerId)),
      (snapshot) => {
        const items: StockNotification[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StockNotification, 'id'>),
        }));
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis() ?? Date.now();
          const tB = b.createdAt?.toMillis() ?? Date.now();
          return tB - tA;
        });

        if (notifInitializedProjectRef.current === activeProject.id) {
          for (const item of items) {
            if (!seenNotifIdsRef.current.has(item.id) && !item.isRead) {
              setLiveToast(item);
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                try {
                  new Notification(item.title, {
                    body: item.message,
                  });
                } catch {
                  // Ignore browser notification restrictions inside iframe
                }
              }
              break;
            }
          }
        } else {
          notifInitializedProjectRef.current = activeProject.id;
        }

        for (const item of items) {
          seenNotifIdsRef.current.add(item.id);
        }
        setNotifications(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, ntfPath);
      }
    );

    return () => {
      unsubMat();
      unsubMov();
      unsubNtf();
    };
  }, [activeProject]);

  useEffect(() => {
    if (!liveToast) return;
    const timer = window.setTimeout(() => setLiveToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [liveToast]);

  async function handleRequestBrowserPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
    } catch {
      // Ignore if blocked in sandbox iframe
    }
  }

  async function handleRebuildFromLiveCsv() {
    if (!activeProject) return;
    setRebuildingCsv(true);
    setRebuildingBanner(
      'Menghapus data lama dan membangun ulang data terbaru dari Spreadsheet CSV Gd Ry Sinjai...'
    );
    try {
      await rebuildProjectFromLivePublishedCsv(PUBLIC_OPERATOR, activeProject.id);
    } finally {
      setRebuildingCsv(false);
      setRebuildingBanner(null);
    }
  }

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const unresolvedNotifCount = notifications.filter((n) => !n.isResolved).length;
  const isCompleted = activeProject?.status === 'completed';

  const nextRowNumber =
    materials.reduce((max, m) => Math.max(max, m.rowNumber || 0), 0) + 1;

  const tabTitles: Record<ActiveTab, string> = {
    home: 'Portal Utama',
    overview: 'Ringkasan Stok',
    inventory: 'Tabel Stok Gudang',
    piket: 'Jadwal Piket (gid: 418796009)',
    workbook: 'Workbook Terlampir (10 Sheet)',
    kpi: 'KPI Pelanggan, MVA & BP',
    movements: 'Log Mutasi Barang',
    notifications: 'Pusat Notifikasi',
    sheets: 'Sumber Spreadsheet CSV',
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }> = [
    { id: 'home', label: 'Portal Utama', icon: Home },
    { id: 'overview', label: 'Ringkasan Stok', icon: LayoutDashboard },
    { id: 'inventory', label: 'Tabel Stok Gudang', icon: Box },
    { id: 'piket', label: 'Jadwal Piket (418796009)', icon: CalendarCheck2 },
    { id: 'workbook', label: 'Rekap Workbook (10 Sheet)', icon: Layers },
    { id: 'kpi', label: 'KPI Pelanggan & MVA', icon: TrendingUp },
    { id: 'movements', label: 'Log Mutasi Barang', icon: ArrowLeftRight },
    {
      id: 'notifications',
      label: 'Pusat Notifikasi',
      icon: Bell,
      badge: unresolvedNotifCount,
    },
    { id: 'sheets', label: 'Sumber Spreadsheet', icon: FileSpreadsheet },
  ];

  const operatorInitial = PUBLIC_OPERATOR.displayName.charAt(0).toUpperCase();

  return (
    <>
      {rebuildingBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[92%] bg-sky-600 text-white border border-sky-300 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 text-xs font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-200 shrink-0" />
          <span>{rebuildingBanner}</span>
        </div>
      )}

      {activeTab === 'home' ? (
        <PortalHomeView
          project={activeProject}
          projects={projects}
          materials={materials}
          movements={movements}
          notifications={notifications}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onSelectProject={(projectId) => setActiveProjectId(projectId)}
          onOpenNewProject={() => setProjectModalState({ open: true, mode: 'create' })}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onQuickMovement={() => {
            if (activeProject && !isCompleted && materials.length > 0) {
              setMovementModalState({ open: true, type: 'out' });
            } else {
              setActiveTab('inventory');
            }
          }}
        />
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-sky-50/85 via-white to-amber-50/35 dark:bg-none dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Left Workspace Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-40 bg-white dark:bg-slate-900 border-r border-sky-200/80 dark:border-slate-800 flex flex-col transition-all duration-200 lg:static lg:translate-x-0 ${
              sidebarCollapsed ? 'w-64 lg:w-16' : 'w-64'
            } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <div
              className={`h-14 border-b border-sky-100 dark:border-slate-800 flex items-center shrink-0 ${
                sidebarCollapsed ? 'px-5 lg:px-0 lg:justify-center' : 'px-4 justify-between'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className={`flex items-center gap-2.5 text-left min-w-0 ${
                  sidebarCollapsed ? 'lg:hidden' : ''
                }`}
                title="Kembali ke Portal Utama PLN"
              >
                <PlnEmblem size="sm" />
                <div className="min-w-0">
                  <span className="block text-sm font-bold tracking-tight font-display text-slate-900 dark:text-slate-100 whitespace-nowrap truncate leading-tight">
                    PLN · BinaLogistik
                  </span>
                  <span className="block text-[10px] font-bold text-amber-600 whitespace-nowrap truncate leading-tight">
                    Terang, Benderang, Yess
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className="hidden lg:inline-flex p-1.5 text-slate-500 hover:text-sky-700 dark:hover:text-cyan-400 rounded-md hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
                aria-label={sidebarCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
                title={sidebarCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
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
                className="p-1.5 text-slate-500 lg:hidden"
                aria-label="Tutup menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!sidebarCollapsed && (
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Gudang / Proyek Aktif
                  </span>
                  <button
                    type="button"
                    onClick={() => setProjectModalState({ open: true, mode: 'create' })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Gudang Baru</span>
                  </button>
                </div>

                <select
                  aria-label="Pilih proyek konstruksi"
                  value={activeProjectId || ''}
                  disabled={projectsLoading || projects.length === 0}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
                >
                  {projects.length === 0 ? (
                    <option value="">Memuat gudang...</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>

                {activeProject && (
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate">{activeProject.location}</span>
                    <button
                      type="button"
                      onClick={() => setProjectModalState({ open: true, mode: 'status' })}
                      title="Ubah status"
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-cyan-700 dark:hover:text-cyan-400 shrink-0 ml-2"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>
                        {activeProject.status === 'active'
                          ? 'Aktif'
                          : activeProject.status === 'paused'
                          ? 'Ditunda'
                          : 'Selesai'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto" aria-label="Menu Utama">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center rounded-lg transition-colors whitespace-nowrap ${
                      sidebarCollapsed
                        ? 'justify-between px-3 py-2.5 lg:justify-center lg:px-0'
                        : 'justify-between px-3 py-2.5'
                    } text-sm font-medium ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className={`truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                        {item.label}
                      </span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span
                        className={`font-mono tabular-nums text-xs font-semibold ${
                          sidebarCollapsed ? 'lg:hidden' : ''
                        } ${
                          isActive
                            ? 'text-cyan-100'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
                className={`w-full flex items-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ${
                  sidebarCollapsed ? 'justify-between lg:justify-center lg:px-0' : 'justify-between'
                }`}
              >
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>
                  {darkMode ? 'Mode Terang' : 'Mode Gelap'}
                </span>
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              <div
                className={`flex items-center gap-2.5 ${
                  sidebarCollapsed ? 'justify-between lg:justify-center' : 'justify-between'
                }`}
              >
                <div className={`flex items-center gap-2.5 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center text-xs font-semibold text-cyan-800 dark:text-cyan-300 shrink-0">
                    {operatorInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {PUBLIC_OPERATOR.displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Workspace Publik · Live DB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 bg-white/95 dark:bg-slate-900 backdrop-blur-sm border-b border-sky-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Buka menu navigasi"
                  className="p-1.5 text-slate-600 dark:text-slate-300 lg:hidden shrink-0"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  title="Kembali ke Portal Utama"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-cyan-400 bg-sky-50/70 dark:bg-slate-950 border border-sky-200/80 dark:border-slate-800 shrink-0 transition-colors"
                >
                  <Home className="w-3.5 h-3.5 text-sky-700" />
                  <span className="hidden sm:inline">Portal</span>
                </button>

                <PlnEmblem size="sm" className="hidden sm:flex" />

                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[140px] sm:max-w-[240px]">
                    {activeProject?.name || 'Memuat...'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    /
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {tabTitles[activeTab]}
                  </span>
                </nav>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!activeProject || isCompleted || materials.length === 0}
                  onClick={() => setMovementModalState({ open: true, type: 'out' })}
                  className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Catat Mutasi
                </button>

                <button
                  type="button"
                  disabled={!activeProject || isCompleted}
                  onClick={() => setMaterialModalState({ open: true, editing: null })}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Material</span>
                </button>
              </div>
            </header>

            {offlineBanner && (
              <div className="bg-red-600 text-white px-6 py-2.5 text-xs font-medium">
                {offlineBanner}
              </div>
            )}

            {isCompleted && (
              <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-6 py-2.5 text-xs flex items-center justify-between gap-4">
                <span>
                  Gudang berstatus <strong>Selesai</strong>. Perubahan stok dan mutasi baru dikunci untuk menjaga arsip audit.
                </span>
              </div>
            )}

            <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
              {activeTab === 'overview' && (
                <OverviewView
                  materials={materials}
                  movements={movements}
                  notifications={notifications}
                  loading={projectsLoading || dataLoading}
                  isCompleted={Boolean(isCompleted)}
                  rebuildingFromCsv={rebuildingCsv}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onQuickRestock={(mat) =>
                    setMovementModalState({ open: true, material: mat, type: 'in' })
                  }
                  onAddMaterial={() =>
                    setMaterialModalState({ open: true, editing: null })
                  }
                  onRebuildFromCsv={handleRebuildFromLiveCsv}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  projectName={activeProject?.name || 'gd-ry-sinjai'}
                  isCompleted={Boolean(isCompleted)}
                  materials={materials}
                  loading={projectsLoading || dataLoading}
                  onQuickMovement={(mat, initialType) =>
                    setMovementModalState({
                      open: true,
                      material: mat,
                      type: initialType,
                    })
                  }
                  onEditMaterial={(mat) =>
                    setMaterialModalState({ open: true, editing: mat })
                  }
                  onDeleteMaterial={(mat) => setDeleteTarget(mat)}
                  onAddMaterial={() =>
                    setMaterialModalState({ open: true, editing: null })
                  }
                />
              )}

              {activeTab === 'piket' && <PiketView />}

              {activeTab === 'workbook' && <WorkbookSheetsView />}

              {activeTab === 'kpi' && <KpiTargetView />}

              {activeTab === 'movements' && (
                <MovementsView
                  movements={movements}
                  loading={projectsLoading || dataLoading}
                  hasMaterials={materials.length > 0}
                  isCompleted={Boolean(isCompleted)}
                  onRecordMovement={() =>
                    setMovementModalState({ open: true, type: 'out' })
                  }
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationsView
                  notifications={notifications}
                  materials={materials}
                  loading={projectsLoading || dataLoading}
                  isCompleted={Boolean(isCompleted)}
                  browserPermission={browserPermission}
                  onRequestBrowserPermission={handleRequestBrowserPermission}
                  onMarkRead={async (notif, isRead) => {
                    if (!activeProject) return;
                    await markNotificationRead(activeProject.id, notif.id, isRead);
                  }}
                  onResolve={async (notif) => {
                    if (!activeProject) return;
                    await resolveNotification(activeProject.id, notif.id);
                  }}
                  onMarkAllRead={async () => {
                    if (!activeProject) return;
                    await markAllNotificationsRead(activeProject.id, notifications);
                  }}
                  onRestockMaterial={(mat) =>
                    setMovementModalState({ open: true, material: mat, type: 'in' })
                  }
                />
              )}

              {activeTab === 'sheets' && (
                <SheetsSyncView
                  activeProjectName={activeProject?.name || 'Gudang Aktif'}
                  isCompleted={Boolean(isCompleted)}
                  existingMaterials={materials}
                  onSyncToActiveProject={async (items, sheetLabel) => {
                    if (!activeProject) {
                      throw new Error('Pilih gudang aktif terlebih dahulu.');
                    }
                    return syncMaterialsFromSheet(
                      PUBLIC_OPERATOR,
                      activeProject.id,
                      items,
                      materials,
                      notifications,
                      sheetLabel
                    );
                  }}
                  onRebuildActiveProject={async (items, sheetLabel) => {
                    if (!activeProject) {
                      throw new Error('Pilih gudang aktif terlebih dahulu.');
                    }
                    return rebuildProjectFromSheetItems(
                      PUBLIC_OPERATOR,
                      activeProject.id,
                      items,
                      sheetLabel,
                      {
                        name: 'Gd Ry Sinjai — Monitoring Material',
                        location: 'Sinjai, Sulawesi Selatan',
                      }
                    );
                  }}
                  onCreateProjectFromSheet={async (projectName, sheetLabel, items) => {
                    const created = await createProjectFromSheet(
                      PUBLIC_OPERATOR,
                      projectName,
                      sheetLabel,
                      items
                    );
                    setActiveProjectId(created.projectId);
                    return created.result;
                  }}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Real-Time Automatic Notification Toast */}
      {liveToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <NotificationSeverityLabel severity={liveToast.severity} />
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              aria-label="Tutup notifikasi"
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {liveToast.title}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {liveToast.message}
          </p>
          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('notifications');
                setLiveToast(null);
              }}
              className="text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
            >
              Buka Pusat Notifikasi ({unreadNotifCount})
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {movementModalState.open && activeProject && (
        <MovementModal
          materials={materials}
          initialMaterial={movementModalState.material}
          initialType={movementModalState.type}
          defaultActorName={PUBLIC_OPERATOR.displayName}
          onClose={() => setMovementModalState({ open: false })}
          onSubmit={async (mat, input: StockMovementInput) => {
            await recordStockMovement(
              PUBLIC_OPERATOR,
              activeProject.id,
              mat,
              input,
              notifications
            );
          }}
        />
      )}

      {materialModalState.open && activeProject && (
        <MaterialModal
          existingMaterial={materialModalState.editing}
          nextRowNumber={nextRowNumber}
          onClose={() => setMaterialModalState({ open: false })}
          onSubmit={async (input: MaterialFormInput) => {
            if (materialModalState.editing) {
              await updateMaterialConfig(
                PUBLIC_OPERATOR,
                activeProject.id,
                materialModalState.editing,
                {
                  rowNumber: input.rowNumber,
                  name: input.name,
                  category: input.category,
                  unit: input.unit,
                  minThreshold: input.minThreshold,
                  criticalThreshold: input.criticalThreshold,
                  maxCapacity: input.maxCapacity,
                  unitPrice: input.unitPrice,
                  supplierName: input.supplierName,
                  warehouseZone: input.warehouseZone,
                  notes: input.notes,
                }
              );
            } else {
              await createMaterialWithInitialStock(
                PUBLIC_OPERATOR,
                activeProject.id,
                input
              );
            }
          }}
        />
      )}

      {projectModalState.open && (
        <ProjectModal
          defaultManager="Admin Gudang"
          activeProject={activeProject}
          mode={projectModalState.mode}
          onClose={() => setProjectModalState({ open: false, mode: 'create' })}
          onCreateProject={async (input) => {
            const newId = await createProject(PUBLIC_OPERATOR, input);
            setActiveProjectId(newId);
          }}
          onUpdateStatus={async (status: ProjectStatus) => {
            if (!activeProject) return;
            await updateProjectStatus(activeProject.id, status);
          }}
        />
      )}

      {deleteTarget && activeProject && (
        <DeleteConfirmModal
          material={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteMaterial(activeProject.id, deleteTarget.id);
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <DashboardApp />
    </AppErrorBoundary>
  );
}
