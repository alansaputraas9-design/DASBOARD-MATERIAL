# Security Specification & Payload-First TDD

## 1. Data Invariants

1. **Verified Identity**: All reads and writes require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
2. **Ownership & Master Gate**: Every `material`, `movement`, and `notification` under `/projects/{projectId}` must belong to an existing parent `/projects/{projectId}` document, carry matching `projectId` and `ownerId`, and only be readable or writable by the project's `ownerId` or the verified bootstrapped admin.
3. **Immutable Ownership & Temporal Integrity**: `ownerId`, `projectId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Terminal Project Locking**: Once a project's `status` reaches `"completed"`, non-admin updates are blocked.
5. **Atomic Stock Ledger Synchronization**: Creating a `movement` document requires an atomic batch update/creation on the referenced `material` document (`getAfter(...).data.updatedAt == request.time`), preventing out-of-sync ledger entries.
6. **Immutable Audit Trail**: `movements` cannot be updated after creation (audit integrity).
7. **Strict Key & Volumetric Guards**: Every collection enforces `hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update, numeric range bounds, and `.size()` caps on every string and ID.
8. **Zero-Trust List Queries**: `allow list` rules strictly evaluate `resource.data.ownerId == request.auth.uid` (or verified bootstrapped admin email) without `get()` or `exists()` lookups.

## 2. The "Dirty Dozen" Attack Payloads (All Expected: `PERMISSION_DENIED`)

1. **Unauthenticated Read**: An unauthenticated client attempts `getDoc('/projects/proj-1')`.
2. **Unverified Email Spoof**: A user with `email: 'alansaputra.AS9@gmail.com'` and `email_verified: false` attempts to list `/projects`.
3. **Identity Spoofing on Create**: User B (`uid: 'userB'`) attempts to create `/projects/proj-b` with `ownerId: 'userA'`.
4. **Shadow Ghost Field Injection**: User A attempts to create a `Material` with an extra field `isApprovedByDirector: true`.
5. **Client-Forged Timestamp**: User A attempts to create a `Project` with `createdAt: new Date('2020-01-01')` instead of `request.time`.
6. **ID Poisoning Attack**: User A attempts to write to `/projects/proj-1/materials/${'A'.repeat(500)}`.
7. **Negative Stock Manipulation**: User A attempts to update `Material.currentStock` to `-50`.
8. **Orphaned Material Creation**: User A attempts to create a `Material` under `/projects/nonexistent-proj/materials/mat-1`.
9. **Cross-Tenant List Scraping**: User B attempts `getDocs(collection(db, 'projects'))` without filtering to `ownerId == 'userB'`.
10. **Immutable Field Tampering**: User A attempts to update `Material.ownerId` or `Material.createdAt` on an existing document.
11. **Non-Atomic Ledger Bypass**: User A attempts to create a `StockMovement` document without atomically updating the target `Material` document in the same batch.
12. **Terminal State Bypass**: User A attempts to mutate a `Project` whose existing `status` is `'completed'`.
