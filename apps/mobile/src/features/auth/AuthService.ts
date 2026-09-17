import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { SQLiteDatabase } from 'expo-sqlite';
import { User } from '../../types';
import { UserRepository } from './UserRepository';
import { withTransaction } from '../../database/transaction';
import { makeQueueItem } from '../workspace/WorkspaceService';
import { SyncQueueRepository } from '../sync/SyncQueueRepository';

const SECURE_KEY_ACCESS  = 'foliosync_access_token';
const SECURE_KEY_REFRESH = 'foliosync_refresh_token';
const SECURE_KEY_USER_ID = 'foliosync_user_id';
/** Set when the server rejected the session, so local work is kept for the next sign-in. */
const SECURE_KEY_KEEP_LOCAL_DATA = 'foliosync_keep_local_data';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AuthService {
  private userRepo: UserRepository;

  constructor(private db: SQLiteDatabase) {
    this.userRepo = new UserRepository(db);
  }

  async saveSession(user: User, tokens: AuthTokens): Promise<void> {
    const previous = await this.userRepo.getCurrent();
    if (previous && previous.id !== user.id) {
      const keepLocalData = (await SecureStore.getItemAsync(SECURE_KEY_KEEP_LOCAL_DATA)) === 'true';
      if (keepLocalData) {
        // The previous session died (e.g. the account no longer exists on the server).
        // Keep the offline work and upload all of it to the account signing in now.
        await this.adoptLocalData();
      } else {
        // A different person signed in after an explicit sign-out: start clean so their
        // queue never uploads someone else's files.
        await this.clearLocalData();
      }
    }
    await SecureStore.deleteItemAsync(SECURE_KEY_KEEP_LOCAL_DATA);

    await this.userRepo.upsert({
      ...user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      updatedAt: Date.now(),
    });
    await SecureStore.setItemAsync(SECURE_KEY_ACCESS,  tokens.accessToken);
    await SecureStore.setItemAsync(SECURE_KEY_REFRESH, tokens.refreshToken);
    await SecureStore.setItemAsync(SECURE_KEY_USER_ID, user.id);
  }

  async getStoredTokens(): Promise<AuthTokens | null> {
    const accessToken  = await SecureStore.getItemAsync(SECURE_KEY_ACCESS);
    const refreshToken = await SecureStore.getItemAsync(SECURE_KEY_REFRESH);
    if (!accessToken || !refreshToken) return null;

    const user = await this.userRepo.getCurrent();
    return {
      accessToken,
      refreshToken,
      expiresAt: user?.tokenExpiresAt ?? 0,
    };
  }

  async getCurrentUser(): Promise<User | null> {
    return this.userRepo.getCurrent();
  }

  async updateTokens(userId: string, tokens: AuthTokens): Promise<void> {
    await this.userRepo.updateTokens(
      userId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt
    );
    await SecureStore.setItemAsync(SECURE_KEY_ACCESS,  tokens.accessToken);
    await SecureStore.setItemAsync(SECURE_KEY_REFRESH, tokens.refreshToken);
  }

  /** @param options.expired true when the server rejected the session rather than the user signing out. */
  async clearSession(options: { expired?: boolean } = {}): Promise<void> {
    const user = await this.userRepo.getCurrent();
    if (user) await this.userRepo.clearTokens(user.id);
    await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS);
    await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH);
    await SecureStore.deleteItemAsync(SECURE_KEY_USER_ID);
    if (options.expired) {
      await SecureStore.setItemAsync(SECURE_KEY_KEEP_LOCAL_DATA, 'true');
    } else {
      await SecureStore.deleteItemAsync(SECURE_KEY_KEEP_LOCAL_DATA);
    }
  }

  /**
   * Server ids from the old account mean nothing to the new one, so every live
   * folder and document is marked unsynced and queued for upload again.
   */
  private async adoptLocalData(): Promise<void> {
    const queueRepo = new SyncQueueRepository(this.db);
    const folders = await this.db.getAllAsync<{ id: string; parent_id: string | null; name: string; created_at: number }>(
      'SELECT id, parent_id, name, created_at FROM folders WHERE deleted_at IS NULL ORDER BY created_at ASC'
    );
    const docs = await this.db.getAllAsync<{
      id: string; folder_id: string; name: string; mime_type: string; file_size: number | null; local_uri: string | null; imported_at: number;
    }>(
      'SELECT id, folder_id, name, mime_type, file_size, local_uri, imported_at FROM documents WHERE deleted_at IS NULL AND local_uri IS NOT NULL'
    );

    await withTransaction(this.db, async () => {
      await this.db.runAsync('DELETE FROM sync_queue');
      await this.db.runAsync('DELETE FROM users');
      await this.db.runAsync("UPDATE folders SET server_id = NULL, sync_status = 'pending'");
      await this.db.runAsync("UPDATE documents SET server_id = NULL, storage_key = NULL, sync_status = 'pending'");
      for (const f of folders) {
        await queueRepo.insert(makeQueueItem('folder', 'folder:create', f.id, {
          clientId: f.id, name: f.name, parentId: f.parent_id,
        }, f.created_at));
      }
      for (const d of docs) {
        await queueRepo.insert(makeQueueItem('document', 'document:create', d.id, {
          clientId: d.id, folderId: d.folder_id, name: d.name, mimeType: d.mime_type,
          fileSize: d.file_size, localUri: d.local_uri,
        }, d.imported_at));
      }
    });
  }

  private async clearLocalData(): Promise<void> {
    await withTransaction(this.db, async () => {
      await this.db.runAsync('DELETE FROM sync_queue');
      await this.db.runAsync('DELETE FROM documents');
      await this.db.runAsync('DELETE FROM folders');
      await this.db.runAsync('DELETE FROM users');
    });
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}foliosync/documents/`, { idempotent: true })
      .catch(() => undefined);
  }

  isTokenExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt - 60_000; // 1 min buffer
  }
}
