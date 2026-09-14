import * as SecureStore from 'expo-secure-store';
import { SQLiteDatabase } from 'expo-sqlite';
import { User } from '../types';
import { UserRepository } from './UserRepository';

const SECURE_KEY_ACCESS  = 'foliosync_access_token';
const SECURE_KEY_REFRESH = 'foliosync_refresh_token';
const SECURE_KEY_USER_ID = 'foliosync_user_id';

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

  async clearSession(): Promise<void> {
    const user = await this.userRepo.getCurrent();
    if (user) await this.userRepo.clearTokens(user.id);
    await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS);
    await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH);
    await SecureStore.deleteItemAsync(SECURE_KEY_USER_ID);
  }

  isTokenExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt - 60_000; // 1 min buffer
  }
}
