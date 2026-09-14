# FolioSync — Conflict Resolution

## Overview

FolioSync is an offline-first application. Conflicts arise when the same entity is modified on multiple devices while one or more are offline. This document defines the exact policy for each conflict case.

---

## Case A — Concurrent Rename

### Scenario

- Device A renames Folder X to "Physics Notes" while offline.
- Device B (online) renames Folder X to "Chemistry Notes".
- Device A reconnects and syncs.

### Policy: Last-Write-Wins by Server Timestamp

**Implementation:**

1. Device B's rename reaches the server first. Server sets `updatedAt = T1`, `name = "Chemistry Notes"`.
2. Device A syncs its rename. The sync request includes the `clientUpdatedAt` timestamp from the local SQLite record.
3. The server compares `clientUpdatedAt` with the stored `updatedAt`.
4. If `clientUpdatedAt < server.updatedAt`: the server rejects the rename and returns the current server state.
5. If `clientUpdatedAt >= server.updatedAt`: the server applies the rename.
6. The server response always includes the current `name` and `updatedAt`.
7. The mobile app updates its local record with the server's authoritative values.
8. The losing queue entry is marked `synced` (not failed) — the operation was processed, the server just returned a different result.

**Conflict metadata retained locally:**

The `sync_queue` row's `last_error` field stores a JSON object:
```json
{
  "type": "RENAME_CONFLICT",
  "localValue": "Physics Notes",
  "serverValue": "Chemistry Notes",
  "resolvedAt": "2025-01-01T00:00:00Z"
}
```

This is visible in the Sync Activity screen.

---

## Case B — Delete/Import Conflict

### Scenario

- Device A deletes Folder Y while offline.
- Device B imports Document Z into Folder Y while offline.
- Both devices reconnect.

### Policy: Document Preserved in Lost-and-Found

**Sub-case B1: Folder deletion reaches server first**

1. Server soft-deletes Folder Y (`deletedAt` set).
2. Device B syncs Document Z creation with `folderId = Y.serverId`.
3. Server detects that the target folder is soft-deleted.
4. Server creates Document Z in a system folder: `lost-and-found` (auto-created per user if not exists).
5. Server returns `{ clientId, serverId, folderId: lostAndFoundServerId }`.
6. Mobile updates Document Z's `folder_id` to the `lost-and-found` folder's client ID (or creates a local `lost-and-found` folder record).
7. The document is visible to the user in the `lost-and-found` folder with a warning indicator.

**Sub-case B2: Document creation reaches server first**

1. Server creates Document Z in Folder Y normally.
2. Device A syncs Folder Y deletion.
3. Server processes the folder deletion.
4. Server cascade policy: move all documents in Folder Y to `lost-and-found`.
5. Server returns the deletion result with a `cascadedDocuments` array.
6. Mobile updates affected documents' `folder_id` to `lost-and-found`.

**User notification:** The Sync Activity screen shows a warning:
> "1 document was moved to Lost & Found because its folder was deleted."

---

## Case C — Duplicate Document Import

### Scenario

The user imports the same PDF twice (accidentally, or from two devices).

### Policy: Deterministic Client ID Prevents Duplicates

**Implementation:**

1. When the user picks a file, the mobile app computes:
   ```
   importId = UUID_v5(namespace, filename + fileSize + lastModified)
   ```
   This is used as the document's `clientId`.

2. If the same file is picked again (same name + size + lastModified), the same `clientId` is generated.

3. Before creating a new document record, the repository checks:
   ```sql
   SELECT id FROM documents WHERE id = ? AND deleted_at IS NULL
   ```

4. If a record exists: the import is silently skipped and the existing document is shown.

5. On the server: the `(ownerId, clientId)` unique index prevents duplicate creation. The server returns the existing record idempotently.

**Edge case:** Two different files with the same name and size but different content.
- `lastModified` timestamp differentiates them in most cases.
- If `lastModified` is also identical (e.g., copied file), the files are treated as identical. This is an acceptable trade-off documented as a known limitation.

---

## Idempotency Key Lifecycle

Every sync queue entry has a UUID used as `Idempotency-Key`.

Server stores processed keys in MongoDB:
```
Collection: idempotency_keys
Fields: key (indexed, unique), result (JSON), createdAt (TTL: 7 days)
```

If the same key arrives within the TTL window, the server returns the stored result without re-processing.

After 7 days, the key expires. By that point, the mobile client will have marked the operation as `synced` and will not retry it.
