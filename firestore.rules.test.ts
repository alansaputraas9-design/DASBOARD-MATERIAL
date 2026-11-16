import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'proj-graha-karya';
const MATERIAL_ID = 'mat-semen-01';
const USER_A = { uid: 'userA', email: 'engA@example.com', email_verified: true };
const USER_B = { uid: 'userB', email: 'engB@example.com', email_verified: true };
const UNVERIFIED_ADMIN = { uid: 'spoof', email: 'alansaputra.AS9@gmail.com', email_verified: false };

async function runSecurityTests() {
  testEnv = await initializeTestEnvironment({
    projectId: 'binalogistik-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  const dbA = testEnv.authenticatedContext(USER_A.uid, { email: USER_A.email, email_verified: true }).firestore();
  const dbB = testEnv.authenticatedContext(USER_B.uid, { email: USER_B.email, email_verified: true }).firestore();
  const dbUnauth = testEnv.unauthenticatedContext().firestore();
  const dbSpoof = testEnv.authenticatedContext(UNVERIFIED_ADMIN.uid, { email: UNVERIFIED_ADMIN.email, email_verified: false }).firestore();

  // Seed legitimate project + material via User A
  await assertSucceeds(setDoc(doc(dbA, 'projects', PROJECT_ID), {
    name: 'Proyek Graha Karya',
    location: 'Jakarta Selatan',
    managerName: 'Ir. Hendra Wijaya',
    status: 'active',
    ownerId: USER_A.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  await assertSucceeds(setDoc(doc(dbA, 'projects', PROJECT_ID, 'materials', MATERIAL_ID), {
    projectId: PROJECT_ID,
    ownerId: USER_A.uid,
    sku: 'MAT-SMN-01',
    name: 'Semen Portland 50kg',
    category: 'Struktur & Beton',
    unit: 'Sak',
    currentStock: 120,
    minThreshold: 50,
    criticalThreshold: 20,
    maxCapacity: 500,
    unitPrice: 68000,
    supplierName: 'PT Semen Nusantara',
    warehouseZone: 'Zona A',
    status: 'nominal',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  // 1. Unauthenticated Read
  await assertFails(getDoc(doc(dbUnauth, 'projects', PROJECT_ID)));
  // 2. Unverified Email Spoof
  await assertFails(getDocs(collection(dbSpoof, 'projects')));
  // 3. Identity Spoofing on Create
  await assertFails(setDoc(doc(dbB, 'projects', 'proj-spoof'), {
    name: 'Proyek Palsu',
    location: 'Bandung',
    managerName: 'Anonim',
    status: 'active',
    ownerId: USER_A.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  // 4. Shadow Ghost Field Injection
  await assertFails(setDoc(doc(dbA, 'projects', PROJECT_ID, 'materials', 'mat-ghost'), {
    projectId: PROJECT_ID,
    ownerId: USER_A.uid,
    sku: 'MAT-GH-01',
    name: 'Besi Beton',
    category: 'Baja & Besi',
    unit: 'Batang',
    currentStock: 100,
    minThreshold: 20,
    criticalThreshold: 10,
    maxCapacity: 500,
    unitPrice: 95000,
    supplierName: 'PT Baja Jaya',
    warehouseZone: 'Zona B',
    status: 'nominal',
    isApprovedByDirector: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  // 5. Client-Forged Timestamp
  await assertFails(setDoc(doc(dbA, 'projects', 'proj-time'), {
    name: 'Proyek Lama',
    location: 'Surabaya',
    managerName: 'Budi',
    status: 'active',
    ownerId: USER_A.uid,
    createdAt: new Date('2020-01-01T00:00:00Z'),
    updatedAt: serverTimestamp(),
  }));
  // 6. ID Poisoning Attack
  await assertFails(setDoc(doc(dbA, 'projects', PROJECT_ID, 'materials', 'A'.repeat(200)), {
    projectId: PROJECT_ID,
    ownerId: USER_A.uid,
    sku: 'MAT-01',
    name: 'Pasir',
    category: 'Pasir & Agregat',
    unit: 'm3',
    currentStock: 10,
    minThreshold: 5,
    criticalThreshold: 2,
    maxCapacity: 100,
    unitPrice: 250000,
    supplierName: 'CV Alam',
    warehouseZone: 'Zona C',
    status: 'nominal',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  // 7. Negative Stock Manipulation
  await assertFails(updateDoc(doc(dbA, 'projects', PROJECT_ID, 'materials', MATERIAL_ID), {
    currentStock: -50,
    status: 'out',
    updatedAt: serverTimestamp(),
  }));
  // 8. Orphaned Material Creation
  await assertFails(setDoc(doc(dbA, 'projects', 'nonexistent-proj', 'materials', 'mat-orphan'), {
    projectId: 'nonexistent-proj',
    ownerId: USER_A.uid,
    sku: 'MAT-ORPH',
    name: 'Bata Merah',
    category: 'Struktur & Beton',
    unit: 'Biji',
    currentStock: 1000,
    minThreshold: 200,
    criticalThreshold: 50,
    maxCapacity: 5000,
    unitPrice: 1200,
    supplierName: 'UD Jaya',
    warehouseZone: 'Zona D',
    status: 'nominal',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  // 9. Cross-Tenant List Scraping
  await assertFails(getDocs(collection(dbB, 'projects')));
  // 10. Immutable Field Tampering
  await assertFails(updateDoc(doc(dbA, 'projects', PROJECT_ID, 'materials', MATERIAL_ID), {
    ownerId: USER_B.uid,
    updatedAt: serverTimestamp(),
  }));
  // 11. Non-Atomic Ledger Bypass
  await assertFails(setDoc(doc(dbA, 'projects', PROJECT_ID, 'movements', 'mov-non-atomic'), {
    projectId: PROJECT_ID,
    ownerId: USER_A.uid,
    materialId: MATERIAL_ID,
    materialName: 'Semen Portland 50kg',
    materialSku: 'MAT-SMN-01',
    unit: 'Sak',
    type: 'out',
    quantity: 10,
    previousStock: 120,
    newStock: 110,
    referenceNo: 'REQ-001',
    actorName: 'Mandor',
    notes: 'Test non-atomic',
    createdAt: serverTimestamp(),
  }));
  // 12. Terminal State Bypass
  await assertSucceeds(updateDoc(doc(dbA, 'projects', PROJECT_ID), {
    status: 'completed',
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(dbA, 'projects', PROJECT_ID), {
    status: 'active',
    updatedAt: serverTimestamp(),
  }));

  await testEnv.cleanup();
}

export { runSecurityTests };
