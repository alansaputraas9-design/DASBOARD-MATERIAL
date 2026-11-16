import { BarChart3, Bell, BellOff, Check, CheckCheck, PackagePlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateTimeID } from '../services/inventoryService';
import { Material, StockNotification } from '../types/inventory';
import { DonutChart, HorizontalBarChart } from './Charts';
import { NotificationSeverityLabel } from './StatusText';

interface NotificationsViewProps {
  notifications: StockNotification[];
  materials: Material[];
  loading: boolean;
  isCompleted: boolean;
  browserPermission: NotificationPermission | 'unsupported';
  onRequestBrowserPermission: () => void;
  onMarkRead: (notif: StockNotification, isRead: boolean) => Promise<void>;
  onResolve: (notif: StockNotification) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onRestockMaterial: (material: Material) => void;
}

export function NotificationsView({
  notifications,
  materials,
  loading,
  isCompleted,
  browserPermission,
  onRequestBrowserPermission,
  onMarkRead,
  onResolve,
  onMarkAllRead,
  onRestockMaterial,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved');

  const filtered = useMemo(() => {
    if (filter === 'unresolved') {
      return notifications.filter((n) => !n.isResolved);
    }
    return notifications;
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const unresolvedCount = notifications.filter((n) => !n.isResolved).length;

  const notifCharts = useMemo(() => {
    const active = notifications.filter((n) => !n.isResolved);
    const resolved = notifications.filter((n) => n.isResolved);

    const segments = [
      {
        label: 'Stok Habis (Out)',
        value: active.filter((n) => n.severity === 'out_of_stock').length,
        color: '#dc2626',
      },
      {
        label: 'Kritis',
        value: active.filter((n) => n.severity === 'critical').length,
        color: '#ea580c',
      },
      {
        label: 'Menipis (Warning)',
        value: active.filter((n) => n.severity === 'warning').length,
        color: '#d97706',
      },
      {
        label: 'Terselesaikan',
        value: resolved.length,
        color: '#059669',
      },
    ];

    const topDeficit = [...active]
      .map((n) => ({
        label: n.materialName,
        subLabel: n.materialSku,
        value: Math.max(1, n.threshold - n.currentStock),
        unit: n.unit,
        color:
          n.severity === 'out_of_stock'
            ? '#dc2626'
            : n.severity === 'critical'
            ? '#ea580c'
            : '#d97706',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { segments, topDeficit };
  }, [notifications]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setFilter('unresolved')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filter === 'unresolved'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Aktif ({unresolvedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Semua Riwayat ({notifications.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {browserPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={onRequestBrowserPermission}
              disabled={browserPermission === 'granted' || browserPermission === 'denied'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {browserPermission === 'granted' ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Notifikasi Browser Aktif</span>
                </>
              ) : browserPermission === 'denied' ? (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Izin Notifikasi Diblokir Browser</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-orange-600" />
                  <span>Aktifkan Notifikasi Browser</span>
                </>
              )}
            </button>
          )}

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tandai Semua Dibaca ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      {!loading && notifications.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Grafik Peringatan &amp; Kekurangan Stok Material
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="lg:col-span-5 space-y-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Distribusi Status Notifikasi
              </div>
              <DonutChart
                segments={notifCharts.segments}
                centerTitle="Total Alert"
                centerValue={notifications.length.toLocaleString('id-ID')}
              />
            </div>

            <div className="lg:col-span-7 space-y-2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Kebutuhan Restock Terbesar (Selisih dari Batas Aman)
              </div>
              <HorizontalBarChart
                data={notifCharts.topDeficit}
                emptyText="Semua peringatan stok telah terselesaikan."
              />
            </div>
          </div>
        </section>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-5 animate-pulse space-y-2">
                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-80 bg-slate-100 dark:bg-slate-800/60 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {filter === 'unresolved'
                ? 'Tidak ada peringatan stok aktif'
                : 'Belum ada riwayat notifikasi otomatis'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Sistem memantau setiap mutasi stok secara real-time dan otomatis membuat notifikasi jika stok menyentuh batas minimum atau kritis.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((notif) => {
              const targetMat = materials.find((m) => m.id === notif.materialId);
              return (
                <li
                  key={notif.id}
                  className={`p-5 transition-colors ${
                    !notif.isRead
                      ? 'bg-orange-50/40 dark:bg-orange-950/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <NotificationSeverityLabel severity={notif.severity} />
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {notif.materialSku}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatDateTimeID(notif.createdAt)}
                        </span>
                        {!notif.isRead && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="font-semibold text-orange-600 dark:text-orange-400">
                              Belum Dibaca
                            </span>
                          </>
                        )}
                        {notif.isResolved && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              Selesai
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {notif.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                        {notif.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {targetMat && !notif.isResolved && !isCompleted && (
                        <button
                          type="button"
                          onClick={() => onRestockMaterial(targetMat)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-md transition-colors whitespace-nowrap"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>Restock Sekarang</span>
                        </button>
                      )}

                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(notif, true)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
                        >
                          Tandai Dibaca
                        </button>
                      )}

                      {!notif.isResolved && (
                        <button
                          type="button"
                          onClick={() => onResolve(notif)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Selesaikan</span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
