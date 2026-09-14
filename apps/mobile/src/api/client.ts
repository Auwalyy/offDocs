import { AuthService } from '../features/auth/AuthService';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: { code: string; message: string };
}

class ApiClient {
  private authService: AuthService | null = null;

  setAuthService(service: AuthService): void {
    this.authService = service;
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.authService) return null;
    const tokens = await this.authService.getStoredTokens();
    if (!tokens) return null;

    if (this.authService.isTokenExpired(tokens.expiresAt)) {
      return this.refreshToken(tokens.refreshToken);
    }
    return tokens.accessToken;
  }

  private async refreshToken(refreshToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
        userId: string;
      }>;
      await this.authService?.updateTokens(json.data.userId, {
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
        expiresAt: json.data.expiresAt,
      });
      return json.data.accessToken;
    } catch {
      return null;
    }
  }

  async request<T>(
    path: string,
    options: RequestInit & { idempotencyKey?: string } = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
      throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey,
    });
  }

  async patch<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      idempotencyKey,
    });
  }

  async delete<T>(path: string, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', idempotencyKey });
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }
}

export const apiClient = new ApiClient();
