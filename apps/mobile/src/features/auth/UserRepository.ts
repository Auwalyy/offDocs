import { SQLiteDatabase } from 'expo-sqlite';
import { User } from '../../types';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  created_at: number;
  updated_at: number;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository {
  constructor(private db: SQLiteDatabase) {}

  async upsert(user: User): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO users
         (id, email, display_name, access_token, refresh_token, token_expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         token_expires_at = excluded.token_expires_at,
         updated_at = excluded.updated_at`,
      [
        user.id, user.email, user.displayName,
        user.accessToken, user.refreshToken, user.tokenExpiresAt,
        user.createdAt, user.updatedAt,
      ]
    );
  }

  async getCurrent(): Promise<User | null> {
    const row = await this.db.getFirstAsync<UserRow>(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT 1'
    );
    return row ? rowToUser(row) : null;
  }

  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number
  ): Promise<void> {
    await this.db.runAsync(
      'UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ? WHERE id = ?',
      [accessToken, refreshToken, tokenExpiresAt, Date.now(), id]
    );
  }

  async clearTokens(id: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE users SET access_token = NULL, refresh_token = NULL, token_expires_at = NULL, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }
}
