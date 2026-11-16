import type { Timestamp } from 'firebase/firestore';

export type ProjectStatus = 'active' | 'paused' | 'completed';

export type MaterialCategory =
  | 'kWh Meter & AMR'
  | 'MCB, Fuse & Proteksi'
  | 'Kabel & Konduktor'
  | 'Box, Panel & LVSB'
  | 'Tiang, Isolator & Konektor'
  | 'Peralatan & Aksesoris';

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'kWh Meter & AMR',
  'MCB, Fuse & Proteksi',
  'Kabel & Konduktor',
  'Box, Panel & LVSB',
  'Tiang, Isolator & Konektor',
  'Peralatan & Aksesoris',
];

export type MaterialStatus = 'nominal' | 'low' | 'critical' | 'out';

export type MovementType = 'in' | 'out' | 'adjustment';

export type MaterialDivision = 'DIST' | 'AGA' | 'TE' | 'UMUM';

export const MATERIAL_DIVISIONS: MaterialDivision[] = ['DIST', 'AGA', 'TE', 'UMUM'];

export interface DivisionBreakdown {
  dist: number;
  aga: number;
  te: number;
  total: number;
}

export type NotificationSeverity = 'warning' | 'critical' | 'out_of_stock' | 'restocked';

export interface Project {
  id: string;
  name: string;
  location: string;
  managerName: string;
  status: ProjectStatus;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Material {
  id: string;
  projectId: string;
  ownerId: string;
  rowNumber: number;
  sku: string; // Maps to "No Material"
  name: string; // Maps to "Nama Material"
  category: MaterialCategory;
  unit: string; // Maps to "Satuan"
  currentStock: number; // Mirrors stokAkhir.total (>= 0)
  stokAwal: DivisionBreakdown;
  materialMasuk: DivisionBreakdown;
  materialKeluar: DivisionBreakdown;
  stokAkhir: DivisionBreakdown;
  minThreshold: number;
  criticalThreshold: number;
  maxCapacity: number;
  unitPrice: number;
  supplierName: string;
  warehouseZone: string; // Maps to "Gudang" (e.g. Gd Ry Sinjai)
  notes: string; // Maps to "KETERANGAN"
  status: MaterialStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StockMovement {
  id: string;
  projectId: string;
  ownerId: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  unit: string;
  division: MaterialDivision;
  type: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceNo: string;
  actorName: string;
  notes: string;
  createdAt?: Timestamp | null;
}

export interface StockNotification {
  id: string;
  projectId: string;
  ownerId: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  currentStock: number;
  threshold: number;
  unit: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export const FIELD_LIMITS = {
  projectNameMax: 100,
  locationMax: 120,
  managerNameMax: 80,
  skuMax: 32,
  materialNameMax: 120,
  unitMax: 20,
  supplierMax: 80,
  zoneMax: 60,
  referenceMax: 50,
  actorMax: 80,
  notesMax: 240,
  notificationTitleMax: 140,
  notificationMessageMax: 320,
  maxStock: 10000000,
  maxQuantity: 1000000,
  maxUnitPrice: 1000000000,
  skuPattern: /^[a-zA-Z0-9\-_]+$/,
} as const;
