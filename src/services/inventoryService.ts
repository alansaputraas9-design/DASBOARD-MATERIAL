import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  PUBLIC_PROJECT_ID,
  PublicOperator,
} from '../lib/firebase';
import {
  DivisionBreakdown,
  FIELD_LIMITS,
  Material,
  MaterialCategory,
  MaterialDivision,
  MaterialStatus,
  MovementType,
  NotificationSeverity,
  ProjectStatus,
  StockNotification,
} from '../types/inventory';
import {
  fetchMaterialsFromPublishedCsv,
  PUBLISHED_SHEET_CSV_URL,
} from './sheetsService';

export function computeMaterialStatus(
  currentStock: number,
  minThreshold: number,
  criticalThreshold: number
): MaterialStatus {
  if (currentStock <= 0) return 'out';
  if (currentStock <= criticalThreshold && criticalThreshold > 0) return 'critical';
  if (currentStock <= minThreshold && minThreshold > 0) return 'low';
  return 'nominal';
}

export function hasMaterialActivity(mat: {
  stokAwal?: DivisionBreakdown;
  materialMasuk?: DivisionBreakdown;
  materialKeluar?: DivisionBreakdown;
  stokAkhir?: DivisionBreakdown;
  currentStock?: number;
}): boolean {
  const awal = mat.stokAwal?.total ?? 0;
  const masuk = mat.materialMasuk?.total ?? 0;
  const keluar = mat.materialKeluar?.total ?? 0;
  const akhir = mat.stokAkhir?.total ?? mat.currentStock ?? 0;
  return awal !== 0 || masuk !== 0 || keluar !== 0 || akhir !== 0;
}

export function emptyBreakdown(total = 0): DivisionBreakdown {
  return { dist: total, aga: 0, te: 0, total };
}

function clampBreakdown(b?: DivisionBreakdown): DivisionBreakdown {
  if (!b) return { dist: 0, aga: 0, te: 0, total: 0 };
  const clampSigned = (v: number) =>
    Number.isFinite(v)
      ? Math.max(-FIELD_LIMITS.maxStock, Math.min(FIELD_LIMITS.maxStock, v))
      : 0;
  return {
    dist: clampSigned(b.dist),
    aga: clampSigned(b.aga),
    te: clampSigned(b.te),
    total: clampSigned(b.total),
  };
}

function generateDocId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${timePart}-${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function clampString(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

export interface CreateProjectInput {
  name: string;
  location: string;
  managerName: string;
}

export async function createProject(
  operator: PublicOperator,
  input: CreateProjectInput
): Promise<string> {
  const projectId = generateDocId('proj');
  const path = `projects/${projectId}`;
  try {
    await setDoc(doc(db, 'projects', projectId), {
      name: clampString(input.name, FIELD_LIMITS.projectNameMax),
      location: clampString(input.location, FIELD_LIMITS.locationMax),
      managerName: clampString(input.managerName, FIELD_LIMITS.managerNameMax),
      status: 'active' as ProjectStatus,
      ownerId: operator.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface MaterialFormInput {
  rowNumber: number;
  sku: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  currentStock: number;
  stokAwal: DivisionBreakdown;
  materialMasuk: DivisionBreakdown;
  materialKeluar: DivisionBreakdown;
  stokAkhir: DivisionBreakdown;
  minThreshold: number;
  criticalThreshold: number;
  maxCapacity: number;
  unitPrice: number;
  supplierName: string;
  warehouseZone: string;
  notes: string;
}

export async function createMaterialWithInitialStock(
  operator: PublicOperator,
  projectId: string,
  input: MaterialFormInput
): Promise<void> {
  const materialId = generateDocId('mat');
  const cleanAkhir = clampBreakdown(input.stokAkhir);
  const cleanAwal = clampBreakdown(input.stokAwal);
  const cleanMasuk = clampBreakdown(input.materialMasuk);
  const cleanKeluar = clampBreakdown(input.materialKeluar);
  const cleanStock = clampNumber(
    cleanAkhir.total >= 0 ? cleanAkhir.total : input.currentStock,
    0,
    FIELD_LIMITS.maxStock
  );
  const cleanMin = clampNumber(input.minThreshold, 0, FIELD_LIMITS.maxStock);
  const cleanCrit = clampNumber(input.criticalThreshold, 0, cleanMin);
  const cleanCap = clampNumber(
    input.maxCapacity,
    Math.max(1, cleanStock),
    FIELD_LIMITS.maxStock
  );
  const cleanPrice = clampNumber(input.unitPrice, 0, FIELD_LIMITS.maxUnitPrice);
  const cleanSku = clampString(input.sku, FIELD_LIMITS.skuMax).replace(
    /[^a-zA-Z0-9\-_]/g,
    '-'
  );
  const cleanName = clampString(input.name, FIELD_LIMITS.materialNameMax);
  const cleanUnit = clampString(input.unit, FIELD_LIMITS.unitMax);
  const cleanZone = clampString(input.warehouseZone || 'Gd Ry Sinjai', FIELD_LIMITS.zoneMax);
  const cleanSupplier = clampString(
    input.supplierName.length >= 2 ? input.supplierName : 'Gudang Logistik PLN',
    FIELD_LIMITS.supplierMax
  );
  const cleanNotes = clampString(input.notes || '', FIELD_LIMITS.notesMax);
  const status = computeMaterialStatus(cleanStock, cleanMin, cleanCrit);

  const batch = writeBatch(db);
  const matRef = doc(db, 'projects', projectId, 'materials', materialId);

  batch.set(matRef, {
    projectId,
    ownerId: operator.uid,
    rowNumber: clampNumber(Math.round(input.rowNumber || 1), 0, 1000000),
    sku: cleanSku,
    name: cleanName,
    category: input.category,
    unit: cleanUnit,
    currentStock: cleanStock,
    stokAwal: cleanAwal,
    materialMasuk: cleanMasuk,
    materialKeluar: cleanKeluar,
    stokAkhir: cleanAkhir,
    minThreshold: cleanMin,
    criticalThreshold: cleanCrit,
    maxCapacity: cleanCap,
    unitPrice: cleanPrice,
    supplierName: cleanSupplier,
    warehouseZone: cleanZone,
    notes: cleanNotes,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (cleanStock > 0) {
    const movRef = doc(db, 'projects', projectId, 'movements', generateDocId('mov'));
    batch.set(movRef, {
      projectId,
      ownerId: operator.uid,
      materialId,
      materialName: cleanName,
      materialSku: cleanSku,
      unit: cleanUnit,
      division: 'UMUM' as MaterialDivision,
      type: 'in' as MovementType,
      quantity: Number(
        Math.min(FIELD_LIMITS.maxQuantity, Math.max(0.01, cleanStock)).toFixed(2)
      ),
      previousStock: 0,
      newStock: cleanStock,
      referenceNo: `INIT-${cleanSku}`.slice(0, FIELD_LIMITS.referenceMax),
      actorName: clampString(
        operator.displayName || operator.email || 'Petugas Gudang',
        FIELD_LIMITS.actorMax
      ),
      notes: 'Pencatatan saldo awal material ke database.',
      createdAt: serverTimestamp(),
    });
  }

  if (status !== 'nominal' && (cleanMin > 0 || cleanStock > 0)) {
    const notif = buildAlertPayload(
      projectId,
      operator.uid,
      materialId,
      cleanName,
      cleanSku,
      cleanUnit,
      cleanStock,
      cleanMin,
      cleanCrit,
      cleanZone,
      status
    );
    const notifRef = doc(db, 'projects', projectId, 'notifications', generateDocId('ntf'));
    batch.set(notifRef, notif);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `projects/${projectId}/materials/${materialId}`
    );
  }
}

export async function updateMaterialConfig(
  operator: PublicOperator,
  projectId: string,
  material: Material,
  input: Pick<
    MaterialFormInput,
    | 'rowNumber'
    | 'name'
    | 'category'
    | 'unit'
    | 'minThreshold'
    | 'criticalThreshold'
    | 'maxCapacity'
    | 'unitPrice'
    | 'supplierName'
    | 'warehouseZone'
    | 'notes'
  >
): Promise<void> {
  const cleanMin = clampNumber(input.minThreshold, 0, FIELD_LIMITS.maxStock);
  const cleanCrit = clampNumber(input.criticalThreshold, 0, cleanMin);
  const cleanCap = clampNumber(
    input.maxCapacity,
    Math.max(1, material.currentStock),
    FIELD_LIMITS.maxStock
  );
  const cleanPrice = clampNumber(input.unitPrice, 0, FIELD_LIMITS.maxUnitPrice);
  const cleanName = clampString(input.name, FIELD_LIMITS.materialNameMax);
  const cleanUnit = clampString(input.unit, FIELD_LIMITS.unitMax);
  const cleanZone = clampString(input.warehouseZone || 'Gd Ry Sinjai', FIELD_LIMITS.zoneMax);
  const cleanSupplier = clampString(
    input.supplierName.length >= 2 ? input.supplierName : 'Gudang Logistik PLN',
    FIELD_LIMITS.supplierMax
  );
  const cleanNotes = clampString(input.notes || '', FIELD_LIMITS.notesMax);
  const newStatus = computeMaterialStatus(material.currentStock, cleanMin, cleanCrit);

  const batch = writeBatch(db);
  const matRef = doc(db, 'projects', projectId, 'materials', material.id);

  batch.update(matRef, {
    rowNumber: clampNumber(Math.round(input.rowNumber || material.rowNumber || 1), 0, 1000000),
    name: cleanName,
    category: input.category,
    unit: cleanUnit,
    minThreshold: cleanMin,
    criticalThreshold: cleanCrit,
    maxCapacity: cleanCap,
    unitPrice: cleanPrice,
    supplierName: cleanSupplier,
    warehouseZone: cleanZone,
    notes: cleanNotes,
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  if (newStatus !== 'nominal' && newStatus !== material.status && cleanMin > 0) {
    const notifRef = doc(db, 'projects', projectId, 'notifications', generateDocId('ntf'));
    batch.set(
      notifRef,
      buildAlertPayload(
        projectId,
        operator.uid,
        material.id,
        cleanName,
        material.sku,
        cleanUnit,
        material.currentStock,
        cleanMin,
        cleanCrit,
        cleanZone,
        newStatus
      )
    );
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `projects/${projectId}/materials/${material.id}`
    );
  }
}

export async function deleteMaterial(projectId: string, materialId: string): Promise<void> {
  const path = `projects/${projectId}/materials/${materialId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'materials', materialId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface StockMovementInput {
  type: MovementType;
  division: MaterialDivision;
  quantity: number;
  referenceNo: string;
  actorName: string;
  notes: string;
}

export async function recordStockMovement(
  operator: PublicOperator,
  projectId: string,
  material: Material,
  input: StockMovementInput,
  openNotifications: StockNotification[]
): Promise<{ newStatus: MaterialStatus; triggeredNotification: boolean }> {
  const previousStock = material.currentStock;
  let newStock = previousStock;
  let deltaQuantity = clampNumber(input.quantity, 0.01, FIELD_LIMITS.maxQuantity);

  const nextMasuk = { ...(material.materialMasuk || emptyBreakdown()) };
  const nextKeluar = { ...(material.materialKeluar || emptyBreakdown()) };
  const nextAkhir = { ...(material.stokAkhir || emptyBreakdown(previousStock)) };

  const divKey: 'dist' | 'aga' | 'te' =
    input.division === 'AGA'
      ? 'aga'
      : input.division === 'TE'
      ? 'te'
      : 'dist';

  if (input.type === 'in') {
    newStock = clampNumber(previousStock + deltaQuantity, 0, FIELD_LIMITS.maxStock);
    nextMasuk[divKey] = Number((nextMasuk[divKey] + deltaQuantity).toFixed(2));
    nextMasuk.total = Number((nextMasuk.total + deltaQuantity).toFixed(2));
    nextAkhir[divKey] = Number((nextAkhir[divKey] + deltaQuantity).toFixed(2));
    nextAkhir.total = newStock;
  } else if (input.type === 'out') {
    if (deltaQuantity > previousStock) {
      throw new Error(
        `Jumlah keluar (${deltaQuantity}) melebihi stok tersedia (${previousStock} ${material.unit}).`
      );
    }
    newStock = clampNumber(previousStock - deltaQuantity, 0, FIELD_LIMITS.maxStock);
    nextKeluar[divKey] = Number((nextKeluar[divKey] + deltaQuantity).toFixed(2));
    nextKeluar.total = Number((nextKeluar.total + deltaQuantity).toFixed(2));
    nextAkhir[divKey] = Number((nextAkhir[divKey] - deltaQuantity).toFixed(2));
    nextAkhir.total = newStock;
  } else {
    const targetStock = clampNumber(input.quantity, 0, FIELD_LIMITS.maxStock);
    const signedDiff = targetStock - previousStock;
    deltaQuantity = Math.max(0.01, Math.abs(signedDiff));
    newStock = targetStock;
    nextAkhir[divKey] = Number((nextAkhir[divKey] + signedDiff).toFixed(2));
    nextAkhir.total = targetStock;
  }

  const newStatus = computeMaterialStatus(
    newStock,
    material.minThreshold,
    material.criticalThreshold
  );

  const batch = writeBatch(db);
  const matRef = doc(db, 'projects', projectId, 'materials', material.id);
  const movRef = doc(db, 'projects', projectId, 'movements', generateDocId('mov'));

  batch.update(matRef, {
    currentStock: newStock,
    materialMasuk: clampBreakdown(nextMasuk),
    materialKeluar: clampBreakdown(nextKeluar),
    stokAkhir: clampBreakdown(nextAkhir),
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  batch.set(movRef, {
    projectId,
    ownerId: operator.uid,
    materialId: material.id,
    materialName: material.name,
    materialSku: material.sku,
    unit: material.unit,
    division: input.division,
    type: input.type,
    quantity: Number(deltaQuantity.toFixed(2)),
    previousStock,
    newStock,
    referenceNo: clampString(input.referenceNo, FIELD_LIMITS.referenceMax),
    actorName: clampString(input.actorName, FIELD_LIMITS.actorMax),
    notes: clampString(input.notes, FIELD_LIMITS.notesMax),
    createdAt: serverTimestamp(),
  });

  let triggeredNotification = false;

  if (newStatus !== 'nominal' && (material.minThreshold > 0 || previousStock > 0)) {
    const worsened =
      (material.status === 'nominal' &&
        (newStatus === 'low' || newStatus === 'critical' || newStatus === 'out')) ||
      (material.status === 'low' && (newStatus === 'critical' || newStatus === 'out')) ||
      (material.status === 'critical' && newStatus === 'out') ||
      newStock < previousStock;

    if (worsened) {
      const notifRef = doc(db, 'projects', projectId, 'notifications', generateDocId('ntf'));
      batch.set(
        notifRef,
        buildAlertPayload(
          projectId,
          operator.uid,
          material.id,
          material.name,
          material.sku,
          material.unit,
          newStock,
          material.minThreshold,
          material.criticalThreshold,
          material.warehouseZone,
          newStatus
        )
      );
      triggeredNotification = true;
    }
  } else if (material.status !== 'nominal' && newStatus === 'nominal') {
    const relatedOpen = openNotifications.filter(
      (n) => n.materialId === material.id && !n.isResolved
    );
    for (const item of relatedOpen) {
      const ref = doc(db, 'projects', projectId, 'notifications', item.id);
      batch.update(ref, {
        isRead: true,
        isResolved: true,
        updatedAt: serverTimestamp(),
      });
    }

    const restockNotifRef = doc(
      db,
      'projects',
      projectId,
      'notifications',
      generateDocId('ntf')
    );
    batch.set(restockNotifRef, {
      projectId,
      ownerId: operator.uid,
      materialId: material.id,
      materialName: material.name,
      materialSku: material.sku,
      severity: 'restocked' as NotificationSeverity,
      title: `Stok Terpenuhi: ${material.name}`.slice(0, FIELD_LIMITS.notificationTitleMax),
      message: `Stok ${material.warehouseZone} berhasil diisi ulang (${input.division}) menjadi ${newStock} ${material.unit}.`.slice(
        0,
        FIELD_LIMITS.notificationMessageMax
      ),
      currentStock: newStock,
      threshold: material.minThreshold,
      unit: material.unit,
      isRead: false,
      isResolved: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    triggeredNotification = true;
  }

  try {
    await batch.commit();
    return { newStatus, triggeredNotification };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/movements`);
  }
}

function buildAlertPayload(
  projectId: string,
  ownerId: string,
  materialId: string,
  name: string,
  sku: string,
  unit: string,
  currentStock: number,
  minThreshold: number,
  criticalThreshold: number,
  warehouseZone: string,
  status: Exclude<MaterialStatus, 'nominal'>
) {
  let severity: NotificationSeverity = 'warning';
  let title = `Stok Menipis: ${name}`;
  let threshold = minThreshold;
  let message = `Sisa stok di ${warehouseZone} sebanyak ${currentStock} ${unit} mencapai batas minimum (${minThreshold} ${unit}). Segera jadwalkan pengisian ulang.`;

  if (status === 'critical') {
    severity = 'critical';
    title = `Stok Kritis: ${name}`;
    threshold = criticalThreshold;
    message = `Perhatian! Sisa stok di ${warehouseZone} tinggal ${currentStock} ${unit} (batas kritis ${criticalThreshold} ${unit}).`;
  } else if (status === 'out') {
    severity = 'out_of_stock';
    title = `Stok Habis: ${name}`;
    threshold = 0;
    message = `Stok ${name} (${sku}) di ${warehouseZone} telah habis (0 ${unit}) setelah pemakaian. Segera ajukan permintaan material.`;
  }

  return {
    projectId,
    ownerId,
    materialId,
    materialName: clampString(name, FIELD_LIMITS.materialNameMax),
    materialSku: clampString(sku, FIELD_LIMITS.skuMax),
    severity,
    title: clampString(title, FIELD_LIMITS.notificationTitleMax),
    message: clampString(message, FIELD_LIMITS.notificationMessageMax),
    currentStock,
    threshold,
    unit: clampString(unit, FIELD_LIMITS.unitMax),
    isRead: false,
    isResolved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function markNotificationRead(
  projectId: string,
  notificationId: string,
  isRead: boolean
): Promise<void> {
  const path = `projects/${projectId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'notifications', notificationId), {
      isRead,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resolveNotification(
  projectId: string,
  notificationId: string
): Promise<void> {
  const path = `projects/${projectId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'notifications', notificationId), {
      isRead: true,
      isResolved: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(
  projectId: string,
  notifications: StockNotification[]
): Promise<void> {
  const unread = notifications.filter((n) => !n.isRead);
  if (unread.length === 0) return;

  const batch = writeBatch(db);
  for (const item of unread.slice(0, 400)) {
    batch.update(doc(db, 'projects', projectId, 'notifications', item.id), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}/notifications`);
  }
}

async function deleteCollectionInBatches(
  ownerId: string,
  projectId: string,
  subcollection: 'materials' | 'movements' | 'notifications'
): Promise<number> {
  const colPath = `projects/${projectId}/${subcollection}`;
  let snap;
  try {
    snap = await getDocs(
      query(collection(db, 'projects', projectId, subcollection), where('ownerId', '==', ownerId))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }

  if (snap.empty) return 0;

  const docs = snap.docs;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + CHUNK_SIZE)) {
      batch.delete(d.ref);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colPath);
    }
  }
  return docs.length;
}

export interface SheetSyncResult {
  createdCount: number;
  updatedCount: number;
  deletedCount?: number;
  notificationsTriggered: number;
}

export async function rebuildProjectFromSheetItems(
  operator: PublicOperator,
  projectId: string,
  items: MaterialFormInput[],
  sheetLabel: string,
  updateProjectHeader?: { name: string; location: string }
): Promise<SheetSyncResult> {
  const deletedMaterials = await deleteCollectionInBatches(operator.uid, projectId, 'materials');
  await deleteCollectionInBatches(operator.uid, projectId, 'movements');
  await deleteCollectionInBatches(operator.uid, projectId, 'notifications');

  if (updateProjectHeader) {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        name: clampString(updateProjectHeader.name, FIELD_LIMITS.projectNameMax),
        location: clampString(updateProjectHeader.location, FIELD_LIMITS.locationMax),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  }

  let createdCount = 0;
  let notificationsTriggered = 0;

  // Keep batch ops strictly < 480 (120 items max * up to 4 ops per item)
  const CHUNK_SIZE = 120;
  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    const chunk = items.slice(start, start + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const rawItem of chunk) {
      const cleanAkhir = clampBreakdown(rawItem.stokAkhir);
      const cleanAwal = clampBreakdown(rawItem.stokAwal);
      const cleanMasuk = clampBreakdown(rawItem.materialMasuk);
      const cleanKeluar = clampBreakdown(rawItem.materialKeluar);
      const cleanStock = clampNumber(
        cleanAkhir.total >= 0 ? cleanAkhir.total : rawItem.currentStock,
        0,
        FIELD_LIMITS.maxStock
      );
      const cleanMin = clampNumber(rawItem.minThreshold, 0, FIELD_LIMITS.maxStock);
      const cleanCrit = clampNumber(rawItem.criticalThreshold, 0, cleanMin);
      const cleanCap = clampNumber(
        rawItem.maxCapacity,
        Math.max(1, cleanStock),
        FIELD_LIMITS.maxStock
      );
      const cleanPrice = clampNumber(rawItem.unitPrice, 0, FIELD_LIMITS.maxUnitPrice);
      const cleanSku = clampString(rawItem.sku, FIELD_LIMITS.skuMax).replace(
        /[^a-zA-Z0-9\-_]/g,
        '-'
      );
      const cleanName = clampString(rawItem.name, FIELD_LIMITS.materialNameMax);
      const cleanUnit = clampString(rawItem.unit || 'BH', FIELD_LIMITS.unitMax);
      const cleanSupplier = clampString(
        rawItem.supplierName.length >= 2 ? rawItem.supplierName : 'Gudang Logistik PLN',
        FIELD_LIMITS.supplierMax
      );
      const cleanZone = clampString(
        rawItem.warehouseZone || 'Gd Ry Sinjai',
        FIELD_LIMITS.zoneMax
      );
      const cleanNotes = clampString(rawItem.notes || '', FIELD_LIMITS.notesMax);

      const status = computeMaterialStatus(cleanStock, cleanMin, cleanCrit);
      const materialId = `mat-csv-${String(rawItem.rowNumber).padStart(4, '0')}-${cleanSku
        .toLowerCase()
        .slice(0, 14)}`;
      const matRef = doc(db, 'projects', projectId, 'materials', materialId);

      batch.set(matRef, {
        projectId,
        ownerId: operator.uid,
        rowNumber: clampNumber(Math.round(rawItem.rowNumber), 0, 1000000),
        sku: cleanSku,
        name: cleanName,
        category: rawItem.category,
        unit: cleanUnit,
        currentStock: cleanStock,
        stokAwal: cleanAwal,
        materialMasuk: cleanMasuk,
        materialKeluar: cleanKeluar,
        stokAkhir: cleanAkhir,
        minThreshold: cleanMin,
        criticalThreshold: cleanCrit,
        maxCapacity: cleanCap,
        unitPrice: cleanPrice,
        supplierName: cleanSupplier,
        warehouseZone: cleanZone,
        notes: cleanNotes,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdCount++;

      // Record movement entries ONLY for rows that actually had inflow/outflow in the sheet
      if (cleanMasuk.total > 0) {
        const dominantDiv: MaterialDivision =
          cleanMasuk.dist >= cleanMasuk.aga && cleanMasuk.dist >= cleanMasuk.te
            ? 'DIST'
            : cleanMasuk.aga >= cleanMasuk.te
            ? 'AGA'
            : 'TE';
        const movRef = doc(
          db,
          'projects',
          projectId,
          'movements',
          `mov-in-${String(rawItem.rowNumber).padStart(4, '0')}`
        );
        batch.set(movRef, {
          projectId,
          ownerId: operator.uid,
          materialId,
          materialName: cleanName,
          materialSku: cleanSku,
          unit: cleanUnit,
          division: dominantDiv,
          type: 'in' as MovementType,
          quantity: Number(
            Math.min(FIELD_LIMITS.maxQuantity, Math.max(0.01, cleanMasuk.total)).toFixed(2)
          ),
          previousStock: Math.max(0, cleanAwal.total),
          newStock: clampNumber(cleanAwal.total + cleanMasuk.total, 0, FIELD_LIMITS.maxStock),
          referenceNo: `CSV-MSK-${rawItem.rowNumber}`,
          actorName: 'Rekap Sheet Gd Ry Sinjai',
          notes: clampString(
            `Material masuk dari ${sheetLabel} (DIST ${cleanMasuk.dist} · AGA ${cleanMasuk.aga} · TE ${cleanMasuk.te}).`,
            FIELD_LIMITS.notesMax
          ),
          createdAt: serverTimestamp(),
        });
      }

      if (cleanKeluar.total > 0) {
        const dominantDiv: MaterialDivision =
          cleanKeluar.dist >= cleanKeluar.aga && cleanKeluar.dist >= cleanKeluar.te
            ? 'DIST'
            : cleanKeluar.aga >= cleanKeluar.te
            ? 'AGA'
            : 'TE';
        const movRef = doc(
          db,
          'projects',
          projectId,
          'movements',
          `mov-out-${String(rawItem.rowNumber).padStart(4, '0')}`
        );
        batch.set(movRef, {
          projectId,
          ownerId: operator.uid,
          materialId,
          materialName: cleanName,
          materialSku: cleanSku,
          unit: cleanUnit,
          division: dominantDiv,
          type: 'out' as MovementType,
          quantity: Number(
            Math.min(FIELD_LIMITS.maxQuantity, Math.max(0.01, cleanKeluar.total)).toFixed(2)
          ),
          previousStock: clampNumber(cleanAwal.total + cleanMasuk.total, 0, FIELD_LIMITS.maxStock),
          newStock: cleanStock,
          referenceNo: `CSV-KLR-${rawItem.rowNumber}`,
          actorName: 'Rekap Sheet Gd Ry Sinjai',
          notes: clampString(
            `Material keluar dari ${sheetLabel} (DIST ${cleanKeluar.dist} · AGA ${cleanKeluar.aga} · TE ${cleanKeluar.te}).`,
            FIELD_LIMITS.notesMax
          ),
          createdAt: serverTimestamp(),
        });
      }

      // Automatic alerts ONLY for active items that dropped to low/critical/out
      const active = hasMaterialActivity(rawItem);
      if (active && status !== 'nominal' && cleanMin > 0) {
        const notifRef = doc(
          db,
          'projects',
          projectId,
          'notifications',
          `ntf-csv-${String(rawItem.rowNumber).padStart(4, '0')}`
        );
        batch.set(
          notifRef,
          buildAlertPayload(
            projectId,
            operator.uid,
            materialId,
            cleanName,
            cleanSku,
            cleanUnit,
            cleanStock,
            cleanMin,
            cleanCrit,
            cleanZone,
            status
          )
        );
        notificationsTriggered++;
      }
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/materials`);
    }
  }

  return {
    createdCount,
    updatedCount: 0,
    deletedCount: deletedMaterials,
    notificationsTriggered,
  };
}

export async function rebuildProjectFromLivePublishedCsv(
  operator: PublicOperator,
  projectId: string
): Promise<SheetSyncResult> {
  const items = await fetchMaterialsFromPublishedCsv(PUBLISHED_SHEET_CSV_URL);
  return rebuildProjectFromSheetItems(operator, projectId, items, 'Spreadsheet CSV Gd Ry Sinjai', {
    name: 'Gd Ry Sinjai — Monitoring Material',
    location: 'Sinjai, Sulawesi Selatan',
  });
}

export async function seedStarterProject(operator: PublicOperator): Promise<string> {
  const projectRef = doc(db, 'projects', PUBLIC_PROJECT_ID);
  try {
    const existingSnap = await getDoc(projectRef);
    if (existingSnap.exists()) {
      return PUBLIC_PROJECT_ID;
    }

    await setDoc(projectRef, {
      name: 'Gd Ry Sinjai — Monitoring Material',
      location: 'Sinjai, Sulawesi Selatan',
      managerName: clampString(
        operator.displayName || 'Petugas Gudang Sinjai',
        FIELD_LIMITS.managerNameMax
      ),
      status: 'active' as ProjectStatus,
      ownerId: operator.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projects/${PUBLIC_PROJECT_ID}`);
  }

  try {
    const items = await fetchMaterialsFromPublishedCsv(PUBLISHED_SHEET_CSV_URL);
    await rebuildProjectFromSheetItems(
      operator,
      PUBLIC_PROJECT_ID,
      items,
      'Spreadsheet CSV Gd Ry Sinjai'
    );
  } catch (err) {
    console.error('Gagal mengunduh CSV awal:', err);
  }

  return PUBLIC_PROJECT_ID;
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTimeID(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return 'Baru saja';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ts.toDate());
  } catch {
    return 'Baru saja';
  }
}

export function exportMaterialsToCSV(projectName: string, materials: Material[]): void {
  const header1 = [
    'No',
    'Gudang',
    'No Material',
    'Nama Material',
    'Satuan',
    'STOK AWAL DIST',
    'STOK AWAL AGA',
    'STOK AWAL TE',
    'STOK AWAL TOTAL',
    'MATERIAL MASUK DIST',
    'MATERIAL MASUK AGA',
    'MATERIAL MASUK TE',
    'MATERIAL MASUK TOTAL',
    'MATERIAL KELUAR DIST',
    'MATERIAL KELUAR AGA',
    'MATERIAL KELUAR TE',
    'MATERIAL KELUAR TOTAL',
    'STOK AKHIR DIST',
    'STOK AKHIR AGA',
    'STOK AKHIR TE',
    'STOK AKHIR TOTAL',
    'KETERANGAN',
  ];

  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const sorted = [...materials].sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));

  const rows = sorted.map((m, idx) => [
    m.rowNumber || idx + 1,
    m.warehouseZone,
    m.sku,
    m.name,
    m.unit,
    m.stokAwal?.dist ?? 0,
    m.stokAwal?.aga ?? 0,
    m.stokAwal?.te ?? 0,
    m.stokAwal?.total ?? 0,
    m.materialMasuk?.dist ?? 0,
    m.materialMasuk?.aga ?? 0,
    m.materialMasuk?.te ?? 0,
    m.materialMasuk?.total ?? 0,
    m.materialKeluar?.dist ?? 0,
    m.materialKeluar?.aga ?? 0,
    m.materialKeluar?.te ?? 0,
    m.materialKeluar?.total ?? 0,
    m.stokAkhir?.dist ?? 0,
    m.stokAkhir?.aga ?? 0,
    m.stokAkhir?.te ?? 0,
    m.stokAkhir?.total ?? m.currentStock,
    m.notes || '',
  ]);

  const csvContent =
    '\uFEFF' +
    [header1, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  link.href = url;
  link.download = `stok-material-${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function breakdownEquals(a?: DivisionBreakdown, b?: DivisionBreakdown): boolean {
  return (
    (a?.dist ?? 0) === (b?.dist ?? 0) &&
    (a?.aga ?? 0) === (b?.aga ?? 0) &&
    (a?.te ?? 0) === (b?.te ?? 0) &&
    (a?.total ?? 0) === (b?.total ?? 0)
  );
}

export async function syncMaterialsFromSheet(
  operator: PublicOperator,
  projectId: string,
  parsedMaterials: MaterialFormInput[],
  existingMaterials: Material[],
  openNotifications: StockNotification[],
  sheetLabel: string,
  options?: { onlyChanged?: boolean }
): Promise<SheetSyncResult> {
  if (parsedMaterials.length === 0) {
    return { createdCount: 0, updatedCount: 0, notificationsTriggered: 0 };
  }

  const onlyChanged = options?.onlyChanged ?? false;
  const bySku = new Map<string, Material>();
  const byName = new Map<string, Material>();
  for (const m of existingMaterials) {
    bySku.set(m.sku.trim().toLowerCase(), m);
    byName.set(m.name.trim().toLowerCase(), m);
  }

  const pendingOps: Array<{
    mode: 'create' | 'update';
    matched?: Material;
    rawItem: MaterialFormInput;
    cleanAkhir: DivisionBreakdown;
    cleanAwal: DivisionBreakdown;
    cleanMasuk: DivisionBreakdown;
    cleanKeluar: DivisionBreakdown;
    cleanStock: number;
    cleanMin: number;
    cleanCrit: number;
    cleanCap: number;
    cleanPrice: number;
    cleanSku: string;
    cleanName: string;
    cleanUnit: string;
    cleanSupplier: string;
    cleanZone: string;
    cleanNotes: string;
    newStatus: MaterialStatus;
    active: boolean;
  }> = [];

  for (const rawItem of parsedMaterials) {
    const cleanAkhir = clampBreakdown(rawItem.stokAkhir);
    const cleanAwal = clampBreakdown(rawItem.stokAwal);
    const cleanMasuk = clampBreakdown(rawItem.materialMasuk);
    const cleanKeluar = clampBreakdown(rawItem.materialKeluar);
    const cleanStock = clampNumber(
      cleanAkhir.total >= 0 ? cleanAkhir.total : rawItem.currentStock,
      0,
      FIELD_LIMITS.maxStock
    );
    const cleanMin = clampNumber(rawItem.minThreshold, 0, FIELD_LIMITS.maxStock);
    const cleanCrit = clampNumber(rawItem.criticalThreshold, 0, cleanMin);
    const cleanCap = clampNumber(
      rawItem.maxCapacity,
      Math.max(1, cleanStock),
      FIELD_LIMITS.maxStock
    );
    const cleanPrice = clampNumber(rawItem.unitPrice, 0, FIELD_LIMITS.maxUnitPrice);
    const cleanSku = clampString(rawItem.sku, FIELD_LIMITS.skuMax).replace(
      /[^a-zA-Z0-9\-_]/g,
      '-'
    );
    const cleanName = clampString(rawItem.name, FIELD_LIMITS.materialNameMax);
    const cleanUnit = clampString(rawItem.unit || 'BH', FIELD_LIMITS.unitMax);
    const cleanSupplier = clampString(
      rawItem.supplierName.length >= 2 ? rawItem.supplierName : 'Gudang Logistik PLN',
      FIELD_LIMITS.supplierMax
    );
    const cleanZone = clampString(
      rawItem.warehouseZone || 'Gd Ry Sinjai',
      FIELD_LIMITS.zoneMax
    );
    const cleanNotes = clampString(rawItem.notes || '', FIELD_LIMITS.notesMax);
    const newStatus = computeMaterialStatus(cleanStock, cleanMin, cleanCrit);
    const matched =
      bySku.get(cleanSku.toLowerCase()) || byName.get(cleanName.toLowerCase());
    const active = hasMaterialActivity(rawItem);

    if (matched && onlyChanged) {
      const cleanRowNum = clampNumber(
        Math.round(rawItem.rowNumber || matched.rowNumber || 1),
        0,
        1000000
      );
      const isSame =
        (matched.rowNumber || 0) === cleanRowNum &&
        matched.name === cleanName &&
        matched.category === rawItem.category &&
        matched.unit === cleanUnit &&
        matched.currentStock === cleanStock &&
        matched.warehouseZone === cleanZone &&
        (matched.notes || '') === cleanNotes &&
        matched.status === newStatus &&
        breakdownEquals(matched.stokAwal, cleanAwal) &&
        breakdownEquals(matched.materialMasuk, cleanMasuk) &&
        breakdownEquals(matched.materialKeluar, cleanKeluar) &&
        breakdownEquals(matched.stokAkhir, cleanAkhir);

      if (isSame) {
        continue;
      }
    }

    pendingOps.push({
      mode: matched ? 'update' : 'create',
      matched,
      rawItem,
      cleanAkhir,
      cleanAwal,
      cleanMasuk,
      cleanKeluar,
      cleanStock,
      cleanMin,
      cleanCrit,
      cleanCap,
      cleanPrice,
      cleanSku,
      cleanName,
      cleanUnit,
      cleanSupplier,
      cleanZone,
      cleanNotes,
      newStatus,
      active,
    });
  }

  if (pendingOps.length === 0) {
    return { createdCount: 0, updatedCount: 0, notificationsTriggered: 0 };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let notificationsTriggered = 0;

  const CHUNK_SIZE = 120;
  for (let start = 0; start < pendingOps.length; start += CHUNK_SIZE) {
    const chunk = pendingOps.slice(start, start + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const op of chunk) {
      const {
        mode,
        matched,
        rawItem,
        cleanAkhir,
        cleanAwal,
        cleanMasuk,
        cleanKeluar,
        cleanStock,
        cleanMin,
        cleanCrit,
        cleanCap,
        cleanPrice,
        cleanSku,
        cleanName,
        cleanUnit,
        cleanSupplier,
        cleanZone,
        cleanNotes,
        newStatus,
        active,
      } = op;

      if (mode === 'update' && matched) {
        const matRef = doc(db, 'projects', projectId, 'materials', matched.id);
        batch.update(matRef, {
          rowNumber: clampNumber(
            Math.round(rawItem.rowNumber || matched.rowNumber || 1),
            0,
            1000000
          ),
          name: cleanName,
          category: rawItem.category,
          unit: cleanUnit,
          currentStock: cleanStock,
          stokAwal: cleanAwal,
          materialMasuk: cleanMasuk,
          materialKeluar: cleanKeluar,
          stokAkhir: cleanAkhir,
          minThreshold: cleanMin,
          criticalThreshold: cleanCrit,
          maxCapacity: cleanCap,
          unitPrice: cleanPrice,
          supplierName: cleanSupplier,
          warehouseZone: cleanZone,
          notes: cleanNotes,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
        updatedCount++;

        if (cleanStock !== matched.currentStock) {
          const diff = Math.abs(cleanStock - matched.currentStock);
          const movRef = doc(
            db,
            'projects',
            projectId,
            'movements',
            generateDocId('mov')
          );
          batch.set(movRef, {
            projectId,
            ownerId: operator.uid,
            materialId: matched.id,
            materialName: cleanName,
            materialSku: matched.sku,
            unit: cleanUnit,
            division: 'UMUM' as MaterialDivision,
            type: (cleanStock > matched.currentStock ? 'in' : 'out') as MovementType,
            quantity: Number(
              Math.min(FIELD_LIMITS.maxQuantity, Math.max(0.01, diff)).toFixed(2)
            ),
            previousStock: matched.currentStock,
            newStock: cleanStock,
            referenceNo: 'GSHEET-AUTO',
            actorName: clampString(
              operator.displayName || operator.email || 'Auto-Sinkronisasi 10 Menit',
              FIELD_LIMITS.actorMax
            ),
            notes: clampString(
              `Sinkronisasi otomatis dari ${sheetLabel}.`,
              FIELD_LIMITS.notesMax
            ),
            createdAt: serverTimestamp(),
          });
        }

        if (
          active &&
          newStatus !== 'nominal' &&
          cleanMin > 0 &&
          (newStatus !== matched.status || cleanStock < matched.currentStock)
        ) {
          const notifRef = doc(
            db,
            'projects',
            projectId,
            'notifications',
            generateDocId('ntf')
          );
          batch.set(
            notifRef,
            buildAlertPayload(
              projectId,
              operator.uid,
              matched.id,
              cleanName,
              matched.sku,
              cleanUnit,
              cleanStock,
              cleanMin,
              cleanCrit,
              cleanZone,
              newStatus
            )
          );
          notificationsTriggered++;
        } else if (matched.status !== 'nominal' && newStatus === 'nominal') {
          const relatedOpen = openNotifications.filter(
            (n) => n.materialId === matched.id && !n.isResolved
          );
          for (const item of relatedOpen) {
            batch.update(doc(db, 'projects', projectId, 'notifications', item.id), {
              isRead: true,
              isResolved: true,
              updatedAt: serverTimestamp(),
            });
          }
          const restockNotifRef = doc(
            db,
            'projects',
            projectId,
            'notifications',
            generateDocId('ntf')
          );
          batch.set(restockNotifRef, {
            projectId,
            ownerId: operator.uid,
            materialId: matched.id,
            materialName: cleanName,
            materialSku: matched.sku,
            severity: 'restocked' as NotificationSeverity,
            title: `Stok Terpenuhi: ${cleanName}`.slice(0, FIELD_LIMITS.notificationTitleMax),
            message: `Sinkronisasi Google Sheets memperbarui stok menjadi ${cleanStock} ${cleanUnit}.`.slice(
              0,
              FIELD_LIMITS.notificationMessageMax
            ),
            currentStock: cleanStock,
            threshold: cleanMin,
            unit: cleanUnit,
            isRead: false,
            isResolved: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notificationsTriggered++;
        }
      } else {
        const materialId = `mat-csv-${String(rawItem.rowNumber || 1).padStart(
          4,
          '0'
        )}-${cleanSku.toLowerCase().slice(0, 14)}`;
        const matRef = doc(db, 'projects', projectId, 'materials', materialId);
        batch.set(matRef, {
          projectId,
          ownerId: operator.uid,
          rowNumber: clampNumber(Math.round(rawItem.rowNumber || 1), 0, 1000000),
          sku: cleanSku,
          name: cleanName,
          category: rawItem.category,
          unit: cleanUnit,
          currentStock: cleanStock,
          stokAwal: cleanAwal,
          materialMasuk: cleanMasuk,
          materialKeluar: cleanKeluar,
          stokAkhir: cleanAkhir,
          minThreshold: cleanMin,
          criticalThreshold: cleanCrit,
          maxCapacity: cleanCap,
          unitPrice: cleanPrice,
          supplierName: cleanSupplier,
          warehouseZone: cleanZone,
          notes: cleanNotes,
          status: newStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdCount++;

        if (cleanStock > 0) {
          const movRef = doc(
            db,
            'projects',
            projectId,
            'movements',
            generateDocId('mov')
          );
          batch.set(movRef, {
            projectId,
            ownerId: operator.uid,
            materialId,
            materialName: cleanName,
            materialSku: cleanSku,
            unit: cleanUnit,
            division: 'UMUM' as MaterialDivision,
            type: 'in' as MovementType,
            quantity: Number(
              Math.min(FIELD_LIMITS.maxQuantity, Math.max(0.01, cleanStock)).toFixed(2)
            ),
            previousStock: 0,
            newStock: cleanStock,
            referenceNo: 'GSHEET-INIT',
            actorName: clampString(
              operator.displayName || operator.email || 'Auto-Sinkronisasi 10 Menit',
              FIELD_LIMITS.actorMax
            ),
            notes: clampString(
              `Impor material baru dari ${sheetLabel}.`,
              FIELD_LIMITS.notesMax
            ),
            createdAt: serverTimestamp(),
          });
        }

        if (active && newStatus !== 'nominal' && cleanMin > 0) {
          const notifRef = doc(
            db,
            'projects',
            projectId,
            'notifications',
            generateDocId('ntf')
          );
          batch.set(
            notifRef,
            buildAlertPayload(
              projectId,
              operator.uid,
              materialId,
              cleanName,
              cleanSku,
              cleanUnit,
              cleanStock,
              cleanMin,
              cleanCrit,
              cleanZone,
              newStatus
            )
          );
          notificationsTriggered++;
        }
      }
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/materials`);
    }
  }

  return { createdCount, updatedCount, notificationsTriggered };
}

export async function createProjectFromSheet(
  operator: PublicOperator,
  projectName: string,
  sheetTitle: string,
  parsedMaterials: MaterialFormInput[]
): Promise<{ projectId: string; result: SheetSyncResult }> {
  const projectId = await createProject(operator, {
    name: clampString(projectName || 'Gd Ry Sinjai', FIELD_LIMITS.projectNameMax),
    location: clampString(`Sumber: ${sheetTitle}`, FIELD_LIMITS.locationMax),
    managerName: clampString(
      operator.displayName || operator.email || 'Petugas Gudang',
      FIELD_LIMITS.managerNameMax
    ),
  });

  const result = await rebuildProjectFromSheetItems(
    operator,
    projectId,
    parsedMaterials,
    sheetTitle
  );

  return { projectId, result };
}

export function buildLocalMaterialsFromCsvItems(
  projectId: string,
  ownerId: string,
  items: MaterialFormInput[]
): Material[] {
  return items.map((item) => {
    const cleanStock = clampNumber(
      item.stokAkhir.total >= 0 ? item.stokAkhir.total : item.currentStock,
      0,
      FIELD_LIMITS.maxStock
    );
    const status = computeMaterialStatus(
      cleanStock,
      item.minThreshold,
      item.criticalThreshold
    );
    return {
      id: `local-csv-${String(item.rowNumber).padStart(4, '0')}`,
      projectId,
      ownerId,
      rowNumber: item.rowNumber,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: cleanStock,
      stokAwal: item.stokAwal,
      materialMasuk: item.materialMasuk,
      materialKeluar: item.materialKeluar,
      stokAkhir: item.stokAkhir,
      minThreshold: item.minThreshold,
      criticalThreshold: item.criticalThreshold,
      maxCapacity: item.maxCapacity,
      unitPrice: item.unitPrice,
      supplierName: item.supplierName,
      warehouseZone: item.warehouseZone,
      notes: item.notes,
      status,
    };
  });
}
