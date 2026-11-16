import { AlertOctagon, AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import {
  MaterialDivision,
  MaterialStatus,
  MovementType,
  NotificationSeverity,
} from '../types/inventory';

export function MaterialStatusIndicator({
  status,
  isInactive = false,
}: {
  status: MaterialStatus;
  isInactive?: boolean;
}) {
  if (isInactive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
        <MinusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Kosong</span>
      </span>
    );
  }

  switch (status) {
    case 'nominal':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Aman</span>
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Menipis</span>
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Kritis</span>
        </span>
      );
    case 'out':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Habis</span>
        </span>
      );
  }
}

export function DivisionBadge({ division }: { division: MaterialDivision | string }) {
  const styles =
    division === 'DIST'
      ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
      : division === 'AGA'
      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      : division === 'TE'
      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded ${styles}`}
    >
      {division || 'UMUM'}
    </span>
  );
}

export function StockProgressBar({
  current,
  min,
  critical,
  max,
  status,
  isInactive = false,
}: {
  current: number;
  min: number;
  critical: number;
  max: number;
  status: MaterialStatus;
  isInactive?: boolean;
}) {
  const safeMax = Math.max(max, current, 1);
  const pct = Math.min(100, Math.max(0, (current / safeMax) * 100));
  const minPct = Math.min(100, Math.max(0, (min / safeMax) * 100));
  const critPct = Math.min(100, Math.max(0, (critical / safeMax) * 100));

  const barColor = isInactive
    ? 'bg-slate-300 dark:bg-slate-700'
    : status === 'nominal'
    ? 'bg-emerald-600 dark:bg-emerald-500'
    : status === 'low'
    ? 'bg-amber-500'
    : 'bg-red-600 dark:bg-red-500';

  return (
    <div
      className="relative w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-xs overflow-hidden"
      title={`Stok: ${current} / Kapasitas: ${max}`}
    >
      <div
        className={`h-full transition-all duration-200 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
      {critPct > 0 && critPct < 100 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-red-800/60 dark:bg-red-300/60"
          style={{ left: `${critPct}%` }}
        />
      )}
      {minPct > 0 && minPct < 100 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-800/50 dark:bg-amber-300/50"
          style={{ left: `${minPct}%` }}
        />
      )}
    </div>
  );
}

export function MovementTypeLabel({ type }: { type: MovementType }) {
  if (type === 'in') {
    return (
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        Barang Masuk
      </span>
    );
  }
  if (type === 'out') {
    return (
      <span className="text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        Material Keluar
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
      Opname / Koreksi
    </span>
  );
}

export function NotificationSeverityLabel({ severity }: { severity: NotificationSeverity }) {
  switch (severity) {
    case 'out_of_stock':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Stok Habis</span>
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 whitespace-nowrap">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Kritis</span>
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Menipis</span>
        </span>
      );
    case 'restocked':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Terpenuhi</span>
        </span>
      );
  }
}
