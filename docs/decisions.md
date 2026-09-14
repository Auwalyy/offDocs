# FolioSync — Architecture Decisions

## ADR-001: Object Storage Provider — Cloudflare R2

**Decision:** Use Cloudflare R2 as the S3-compatible object storage provider.

**Rationale:**
- S3-compatible: AWS SDK v3 works with a custom endpoint, no code changes needed to switch to AWS S3
- Free tier is generous (10 GB, no egress fees) — appropriate for a final-year project
- Simple setup: one R2 bucket, one API token

**Consequence:** The backend uses `@aws-sdk/client-s3` with `endpoint` set to the R2 endpoint. Switching to AWS S3 requires only changing environment variables.

---

## ADR-002: expo-sqlite New Architecture API

**Decision:** Use the `expo-sqlite` async API (`openDatabaseAsync`) introduced for New Architecture.

**Rationale:**
- SDK 57 targets New Architecture (Bridgeless)
- The synchronous `openDatabase` API is deprecated in New Architecture
- Async API supports proper transactions and WAL mode

**Consequence:** All database calls are async. Repositories return Promises.

---

## ADR-003: No Redux / No Zustand

**Decision:** Use React Context + `useSyncExternalStore` for UI state. No global state library.

**Rationale:**
- SQLite is the source of truth, not an in-memory store
- The UI reads from SQLite via repositories
- A lightweight subscription model is sufficient
- Avoids unnecessary complexity for a project of this scope

**Consequence:** Each feature screen queries its own data. Shared state (auth session, connectivity) uses React Context.

---

## ADR-004: NativeWind 4.x with Tailwind CSS 3.x

**Decision:** Use NativeWind 4.x (not v2) with Tailwind CSS 3.4.x.

**Rationale:**
- NativeWind 4 is the current stable version compatible with Expo SDK 57 and New Architecture
- NativeWind 2 does not support New Architecture
- Tailwind CSS 4.x is NOT supported by NativeWind 4 (peer dep requires `>3.3.0`)

**Consequence:** `tailwind.config.js` uses Tailwind CSS 3 syntax. CSS variables approach via NativeWind's `vars()` utility for theming.

---

## ADR-005: UUID Generation Strategy

**Decision:** Use `react-native-uuid` for client-side UUID v4 generation.

**Rationale:**
- Pure JavaScript implementation, no native module required
- Works in Hermes
- No Expo install needed (no native code)
- Verified compatible with React Native 0.86

**Consequence:** All client entities receive a UUID before any network call.

---

## ADR-006: DOCX Viewing Strategy

**Decision:** For DOCX files, display a metadata/info screen with a "Open with..." option using `expo-sharing` or `Linking.openURL`. Do not attempt in-app DOCX rendering.

**Rationale:**
- No reliable, maintained, SDK-57-compatible in-app DOCX renderer exists for React Native as of this implementation
- Inventing or forcing an incompatible library would violate the project's correctness requirement
- The core requirement (import, store, organize, sync DOCX files) is fully met
- PDF viewing uses `expo-pdf-viewer` or a WebView-based approach (verified at implementation time)

**Consequence:** DOCX files are imported, stored locally, organized, and synced. Viewing opens the system document viewer. This limitation is documented.

---

## ADR-007: Sync Engine Lives Outside React

**Decision:** The `SyncEngine` class is a plain TypeScript class, not a React hook or component.

**Rationale:**
- Sync logic must be testable without a React environment
- Sync must survive component unmounts
- Dependencies (repositories, API client) are injected via constructor

**Consequence:** A single `SyncEngine` instance is created at app startup and held in a module-level singleton. React components interact with it only to trigger sync or read status.

---

## ADR-008: Idempotency via Queue Entry UUID

**Decision:** Each `sync_queue` row's `id` (UUID) is sent as the `Idempotency-Key` HTTP header.

**Rationale:**
- The queue entry UUID is stable across retries (same row, same UUID)
- The server stores processed idempotency keys with a TTL
- If the same request arrives twice, the server returns the original result

**Consequence:** The backend must maintain an `idempotency_keys` collection in MongoDB with a TTL index.
