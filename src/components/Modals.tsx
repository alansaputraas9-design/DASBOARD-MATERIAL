import { AlertTriangle, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
  computeMaterialStatus,
  hasMaterialActivity,
  MaterialFormInput,
  StockMovementInput,
} from '../services/inventoryService';
import {
  FIELD_LIMITS,
  MATERIAL_CATEGORIES,
  MATERIAL_DIVISIONS,
  Material,
  MaterialCategory,
  MaterialDivision,
  MovementType,
  Project,
  ProjectStatus,
} from '../types/inventory';
import { MaterialStatusIndicator } from './StatusText';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ title, subtitle, onClose, children }: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface MovementModalProps {
  materials: Material[];
  initialMaterial?: Material | null;
  initialType?: MovementType;
  defaultActorName: string;
  onClose: () => void;
  onSubmit: (material: Material, input: StockMovementInput) => Promise<void>;
}

export function MovementModal({
  materials,
  initialMaterial,
  initialType = 'out',
  defaultActorName,
  onClose,
  onSubmit,
}: MovementModalProps) {
  const [selectedId, setSelectedId] = useState(
    initialMaterial?.id || materials[0]?.id || ''
  );
  const [type, setType] = useState<MovementType>(initialType);
  const [division, setDivision] = useState<MaterialDivision>('DIST');
  const [quantity, setQuantity] = useState<string>('1');
  const [referenceNo, setReferenceNo] = useState(
    `${initialType === 'in' ? 'SJ' : 'BON'}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`
  );
  const [actorName, setActorName] = useState(defaultActorName);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMat = materials.find((m) => m.id === selectedId) || null;

  useEffect(() => {
    if (selectedMat && type === 'adjustment') {
      setQuantity(String(selectedMat.currentStock));
    }
  }, [type, selectedMat]);

  const numericQty = Number(quantity);
  const previewStock = selectedMat
    ? type === 'in'
      ? selectedMat.currentStock + (Number.isFinite(numericQty) ? Math.max(0, numericQty) : 0)
      : type === 'out'
      ? Math.max(0, selectedMat.currentStock - (Number.isFinite(numericQty) ? Math.max(0, numericQty) : 0))
      : Number.isFinite(numericQty)
      ? Math.max(0, numericQty)
      : selectedMat.currentStock
    : 0;

  const previewStatus = selectedMat
    ? computeMaterialStatus(
        previewStock,
        selectedMat.minThreshold,
        selectedMat.criticalThreshold
      )
    : 'nominal';

  const isPreviewInactive = Boolean(
    selectedMat &&
      !hasMaterialActivity(selectedMat) &&
      selectedMat.minThreshold === 0 &&
      previewStock === 0
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedMat) {
      setError('Pilih material terlebih dahulu.');
      return;
    }
    if (!Number.isFinite(numericQty) || (type !== 'adjustment' && numericQty <= 0) || numericQty < 0) {
      setError('Masukkan jumlah stok yang valid.');
      return;
    }
    if (type === 'out' && numericQty > selectedMat.currentStock) {
      setError(`Stok tidak mencukupi (tersedia ${selectedMat.currentStock} ${selectedMat.unit}).`);
      return;
    }
    if (!referenceNo.trim()) {
      setError('Nomor referensi (Surat Jalan / Bon Pemakaian) wajib diisi.');
      return;
    }
    if (!actorName.trim()) {
      setError('Nama petugas penanggung jawab wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(selectedMat, {
        type,
        division,
        quantity: numericQty,
        referenceNo: referenceNo.trim(),
        actorName: actorName.trim(),
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan mutasi stok.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title="Catat Mutasi Stok Material"
      subtitle="Perubahan langsung memperbarui Material Masuk / Keluar dan Stok Akhir per bidang (DIST / AGA / TE)."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Material (No Material &amp; Nama)
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.rowNumber || '-'} · {m.sku} — {m.name} (Stok: {m.currentStock} {m.unit})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Jenis Mutasi
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'in', label: 'Masuk' },
                  { id: 'out', label: 'Keluar' },
                  { id: 'adjustment', label: 'Opname' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setType(opt.id);
                    if (opt.id === 'in') {
                      setReferenceNo(`SJ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
                    } else if (opt.id === 'out') {
                      setReferenceNo(`BON-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
                    } else {
                      setReferenceNo(`OPN-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
                    }
                  }}
                  className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    type === opt.id
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Bidang / Divisi Terkait
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {MATERIAL_DIVISIONS.map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => setDivision(div)}
                  className={`py-2 px-1 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap ${
                    division === div
                      ? 'bg-white dark:bg-slate-950 text-cyan-800 dark:text-cyan-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {div}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {type === 'adjustment'
                ? `Saldo Akhir Total Baru (${selectedMat?.unit || 'BH'})`
                : `Jumlah (${selectedMat?.unit || 'BH'})`}
            </label>
            <input
              type="number"
              step="any"
              min={type === 'adjustment' ? 0 : 0.01}
              max={FIELD_LIMITS.maxQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              No. Surat Jalan / Referensi
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.referenceMax}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              required
              placeholder="Contoh: SJ-261109"
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
        </div>

        {selectedMat && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Estimasi Stok Akhir Total: </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {previewStock} {selectedMat.unit}
                </span>
              </div>
              <MaterialStatusIndicator status={previewStatus} isInactive={isPreviewInactive} />
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Stok Akhir Bidang saat ini — DIST: {selectedMat.stokAkhir?.dist ?? 0} · AGA:{' '}
              {selectedMat.stokAkhir?.aga ?? 0} · TE: {selectedMat.stokAkhir?.te ?? 0}
            </div>
          </div>
        )}

        {previewStatus !== 'nominal' &&
          !isPreviewInactive &&
          selectedMat &&
          previewStock !== selectedMat.currentStock && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Mutasi ini akan memicu notifikasi otomatis karena stok berada pada level{' '}
                <strong>
                  {previewStatus === 'out'
                    ? 'Habis'
                    : previewStatus === 'critical'
                    ? 'Kritis'
                    : 'Menipis'}
                </strong>
                .
              </span>
            </div>
          )}

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Petugas Penanggung Jawab
          </label>
          <input
            type="text"
            maxLength={FIELD_LIMITS.actorMax}
            value={actorName}
            onChange={(e) => setActorName(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Keterangan Lapangan (Opsional)
          </label>
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.notesMax}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: Pemasangan kWh Meter P2TL bidang TE"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600 resize-none"
          />
        </div>

        {error && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Mutasi'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface MaterialModalProps {
  existingMaterial?: Material | null;
  nextRowNumber?: number;
  onClose: () => void;
  onSubmit: (input: MaterialFormInput) => Promise<void>;
}

export function MaterialModal({
  existingMaterial,
  nextRowNumber = 1,
  onClose,
  onSubmit,
}: MaterialModalProps) {
  const isEditing = Boolean(existingMaterial);
  const [rowNumber, setRowNumber] = useState(
    String(existingMaterial?.rowNumber ?? nextRowNumber)
  );
  const [sku, setSku] = useState(existingMaterial?.sku || '000000000000000000');
  const [name, setName] = useState(existingMaterial?.name || '');
  const [category, setCategory] = useState<MaterialCategory>(
    existingMaterial?.category || 'kWh Meter & AMR'
  );
  const [unit, setUnit] = useState(existingMaterial?.unit || 'BH');
  const [warehouseZone, setWarehouseZone] = useState(
    existingMaterial?.warehouseZone || 'Gd Ry Sinjai'
  );
  const [awalDist, setAwalDist] = useState(String(existingMaterial?.stokAwal?.dist ?? 0));
  const [awalAga, setAwalAga] = useState(String(existingMaterial?.stokAwal?.aga ?? 0));
  const [awalTe, setAwalTe] = useState(String(existingMaterial?.stokAwal?.te ?? 0));

  const [masukDist, setMasukDist] = useState(
    String(existingMaterial?.materialMasuk?.dist ?? 0)
  );
  const [masukAga, setMasukAga] = useState(
    String(existingMaterial?.materialMasuk?.aga ?? 0)
  );
  const [masukTe, setMasukTe] = useState(
    String(existingMaterial?.materialMasuk?.te ?? 0)
  );

  const [keluarDist, setKeluarDist] = useState(
    String(existingMaterial?.materialKeluar?.dist ?? 0)
  );
  const [keluarAga, setKeluarAga] = useState(
    String(existingMaterial?.materialKeluar?.aga ?? 0)
  );
  const [keluarTe, setKeluarTe] = useState(
    String(existingMaterial?.materialKeluar?.te ?? 0)
  );

  const [minThreshold, setMinThreshold] = useState(
    String(existingMaterial?.minThreshold ?? 10)
  );
  const [criticalThreshold, setCriticalThreshold] = useState(
    String(existingMaterial?.criticalThreshold ?? 4)
  );
  const [maxCapacity, setMaxCapacity] = useState(
    String(existingMaterial?.maxCapacity ?? 100)
  );
  const [supplierName, setSupplierName] = useState(
    existingMaterial?.supplierName || 'Gudang Logistik PLN'
  );
  const [notes, setNotes] = useState(existingMaterial?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dAwal = Number(awalDist) || 0;
  const aAwal = Number(awalAga) || 0;
  const tAwal = Number(awalTe) || 0;
  const dMasuk = Number(masukDist) || 0;
  const aMasuk = Number(masukAga) || 0;
  const tMasuk = Number(masukTe) || 0;
  const dKeluar = Number(keluarDist) || 0;
  const aKeluar = Number(keluarAga) || 0;
  const tKeluar = Number(keluarTe) || 0;

  const akhirDist = dAwal + dMasuk - dKeluar;
  const akhirAga = aAwal + aMasuk - aKeluar;
  const akhirTe = tAwal + tMasuk - tKeluar;
  const akhirTotal = akhirDist + akhirAga + akhirTe;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const rowNum = Number(rowNumber);
    const minNum = Number(minThreshold);
    const critNum = Number(criticalThreshold);
    const maxNum = Number(maxCapacity);

    if (!sku.trim() || !FIELD_LIMITS.skuPattern.test(sku.trim())) {
      setError('No Material hanya boleh menggunakan huruf, angka, tanda hubung (-), atau garis bawah (_).');
      return;
    }
    if (name.trim().length < 2) {
      setError('Nama Material minimal 2 karakter.');
      return;
    }
    if (critNum > minNum) {
      setError('Batas kritis tidak boleh lebih besar daripada batas minimum.');
      return;
    }
    if (maxNum <= 0) {
      setError('Kapasitas gudang maksimum harus lebih dari 0.');
      return;
    }

    setSubmitting(true);
    try {
      const computedCurrentStock = isEditing
        ? existingMaterial!.currentStock
        : Math.max(0, akhirTotal);

      await onSubmit({
        rowNumber: Number.isFinite(rowNum) && rowNum > 0 ? Math.round(rowNum) : 1,
        sku: sku.trim(),
        name: name.trim(),
        category,
        unit: unit.trim() || 'BH',
        currentStock: computedCurrentStock,
        stokAwal: {
          dist: dAwal,
          aga: aAwal,
          te: tAwal,
          total: dAwal + aAwal + tAwal,
        },
        materialMasuk: {
          dist: dMasuk,
          aga: aMasuk,
          te: tMasuk,
          total: dMasuk + aMasuk + tMasuk,
        },
        materialKeluar: {
          dist: dKeluar,
          aga: aKeluar,
          te: tKeluar,
          total: dKeluar + aKeluar + tKeluar,
        },
        stokAkhir: isEditing
          ? existingMaterial!.stokAkhir
          : {
              dist: akhirDist,
              aga: akhirAga,
              te: akhirTe,
              total: akhirTotal,
            },
        minThreshold: minNum,
        criticalThreshold: critNum,
        maxCapacity: maxNum,
        unitPrice: existingMaterial?.unitPrice ?? 0,
        supplierName: supplierName.trim() || 'Gudang Logistik PLN',
        warehouseZone: warehouseZone.trim() || 'Gd Ry Sinjai',
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data material.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={isEditing ? 'Edit Konfigurasi Material' : 'Tambah Material Baru'}
      subtitle="Lengkapi No Material, Gudang, rincian bidang (DIST/AGA/TE), dan ambang batas peringatan."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              No Urut
            </label>
            <input
              type="number"
              min={1}
              value={rowNumber}
              onChange={(e) => setRowNumber(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              No Material
            </label>
            <input
              type="text"
              disabled={isEditing}
              maxLength={FIELD_LIMITS.skuMax}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Material
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.materialNameMax}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Contoh: MTR;kWH E;;1P;230V;5-60A;1;;2W"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Gudang
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.zoneMax}
              value={warehouseZone}
              onChange={(e) => setWarehouseZone(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MaterialCategory)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            >
              {MATERIAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Satuan
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.unitMax}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              placeholder="BH, M, SET, ROL"
              className="w-full px-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
        </div>

        {!isEditing && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span>Rincian Stok per Bidang (Sesuai Kolom Sheet)</span>
              <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                Stok Akhir Total: {akhirTotal} {unit}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <div>Komponen</div>
              <div>DIST</div>
              <div>AGA</div>
              <div>TE</div>
            </div>

            <div className="grid grid-cols-4 gap-2 items-center">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Stok Awal
              </span>
              <input
                type="number"
                step="any"
                value={awalDist}
                onChange={(e) => setAwalDist(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
              <input
                type="number"
                step="any"
                value={awalAga}
                onChange={(e) => setAwalAga(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
              <input
                type="number"
                step="any"
                value={awalTe}
                onChange={(e) => setAwalTe(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 items-center">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Masuk
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={masukDist}
                onChange={(e) => setMasukDist(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
              <input
                type="number"
                min={0}
                step="any"
                value={masukAga}
                onChange={(e) => setMasukAga(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
              <input
                type="number"
                min={0}
                step="any"
                value={masukTe}
                onChange={(e) => setMasukTe(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 items-center">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Keluar
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={keluarDist}
                onChange={(e) => setKeluarDist(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
              <input
                type="number"
                min={0}
                step="any"
                value={keluarAga}
                onChange={(e) => setKeluarAga(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
              <input
                type="number"
                min={0}
                step="any"
                value={keluarTe}
                onChange={(e) => setKeluarTe(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Batas Min
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={minThreshold}
              onChange={(e) => setMinThreshold(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Batas Kritis
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={criticalThreshold}
              onChange={(e) => setCriticalThreshold(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Kapasitas Maks
            </label>
            <input
              type="number"
              min={1}
              step="any"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Keterangan (Kolom Sheet)
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.notesMax}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keterangan tambahan jika ada"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Sumber / Pengelola
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.supplierMax}
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting
              ? 'Menyimpan...'
              : isEditing
              ? 'Simpan Perubahan'
              : 'Simpan Material'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface ProjectModalProps {
  defaultManager: string;
  activeProject?: Project | null;
  mode: 'create' | 'status';
  onClose: () => void;
  onCreateProject: (input: { name: string; location: string; managerName: string }) => Promise<void>;
  onUpdateStatus: (status: ProjectStatus) => Promise<void>;
}

export function ProjectModal({
  defaultManager,
  activeProject,
  mode,
  onClose,
  onCreateProject,
  onUpdateStatus,
}: ProjectModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [managerName, setManagerName] = useState(defaultManager);
  const [status, setStatus] = useState<ProjectStatus>(activeProject?.status || 'active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await onCreateProject({
          name: name.trim(),
          location: location.trim(),
          managerName: managerName.trim(),
        });
      } else {
        await onUpdateStatus(status);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses data gudang.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={mode === 'create' ? 'Buat Gudang / Proyek Baru' : 'Status Operasional Gudang'}
      subtitle={
        mode === 'create'
          ? 'Setiap gudang memiliki database stok, mutasi, dan notifikasi terpisah.'
          : 'Menandai sebagai Selesai akan mengunci seluruh mutasi inventaris.'
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'create' ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Gudang / Proyek
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.projectNameMax}
                minLength={2}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Gd Ry Sinjai — Periode Q2"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Lokasi Gudang
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.locationMax}
                minLength={2}
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Sinjai, Sulawesi Selatan"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Penanggung Jawab Gudang
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.managerNameMax}
                minLength={2}
                required
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {(
              [
                { id: 'active', title: 'Aktif', desc: 'Mutasi stok dan notifikasi otomatis berjalan normal.' },
                { id: 'paused', title: 'Ditunda Sementara', desc: 'Gudang sedang jeda; data tetap tersimpan.' },
                { id: 'completed', title: 'Selesai (Kunci Arsip)', desc: 'Gudang selesai; perubahan stok akan dikunci.' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  status === opt.id
                    ? 'border-cyan-600 bg-cyan-50/50 dark:bg-cyan-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="projectStatus"
                  value={opt.id}
                  checked={status === opt.id}
                  onChange={() => setStatus(opt.id)}
                  className="mt-1 accent-cyan-700"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {opt.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {opt.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : mode === 'create' ? 'Buat Gudang' : 'Perbarui Status'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface DeleteConfirmModalProps {
  material: Material;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({
  material,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Hapus Material dari Database?" onClose={onClose}>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Anda akan menghapus <strong className="text-slate-900 dark:text-slate-100">{material.name}</strong> ({material.sku}) dari daftar inventaris aktif proyek ini.
      </p>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirm}
          className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? 'Menghapus...' : 'Hapus Material'}
        </button>
      </div>
    </ModalShell>
  );
}
