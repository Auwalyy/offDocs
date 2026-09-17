import { AuthService } from '../features/auth/AuthService';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const REQUEST_TIMEOUT_MS = 20_000;

export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Error thrown for any failed API call. `status` is 0 when the server was unreachable. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }

  /** 4xx errors (except auth/timeouts/rate limits) will not succeed on retry. */
  get isPermanent(): boolean {
    return this.status >= 400 && this.status < 500 && ![401, 408, 429].includes(this.status);
  }
}

/** Turns a raw response body into a readable ApiError. */
export function toApiError(status: number, rawBody: string): ApiError {
  try {
    const parsed = JSON.parse(rawBody) as Partial<ApiErrorBody>;
    if (parsed.error?.message) return new ApiError(parsed.error.message, status, parsed.error.code);
  } catch {
    // not JSON — fall through
  }
  return new ApiError(`Server responded with HTTP ${status}`, status);
}

class ApiClient {
  private authService: AuthService | null = null;
  private refreshInFlight: Promise<string | null> | null = null;
  private sessionExpiredHandler: (() => void) | null = null;

  setAuthService(service: AuthService): void {
    this.authService = service;
  }

  /**
   * Called when the server definitively rejects the session (refresh token
   * invalid, account gone). Network failures never trigger it.
   */
  setSessionExpiredHandler(handler: (() => void) | null): void {
    this.sessionExpiredHandler = handler;
  }

  private notifySessionExpired(): void {
    this.sessionExpiredHandler?.();
  }

  /** Returns a non-expired access token, refreshing it first when needed. */
  async getValidAccessToken(): Promise<string | null> {
    if (!this.authService) return null;
    const tokens = await this.authService.getStoredTokens();
    if (!tokens) return null;

    if (this.authService.isTokenExpired(tokens.expiresAt)) {
      return this.refreshAccessToken();
    }
    return tokens.accessToken;
  }

  /** Refreshes the session. Concurrent callers share a single request. */
  refreshAccessToken(): Promise<string | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<string | null> {
    const tokens = await this.authService?.getStoredTokens();
    if (!tokens) {
      this.notifySessionExpired();
      return null;
    }
    try {
      const res = await this.fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (res.status === 401) {
        // The server no longer accepts this session — only signing in again helps.
        this.notifySessionExpired();
        return null;
      }
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

  async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new ApiError(
        aborted
          ? 'The server took too long to respond.'
          : `Cannot reach the server at ${API_BASE_URL}. Check that the backend is running and the phone is on the same network.`,
        0,
        aborted ? 'TIMEOUT' : 'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async request<T>(
    path: string,
    options: RequestInit & { idempotencyKey?: string } = {}
  ): Promise<T> {
    const { idempotencyKey, ...init } = options;

    const send = async (token: string | null) => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers as Record<string, string> | undefined),
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      return this.fetchWithTimeout(`${API_BASE_URL}${path}`, { ...init, headers });
    };

    let token = await this.getValidAccessToken();
    let res = await send(token);

    // The access token may have been revoked or the clock may be off — refresh once and retry.
    if (res.status === 401 && token) {
      token = await this.refreshAccessToken();
      if (token) res = await send(token);
    } else if (res.status === 401 && !path.startsWith('/auth/')) {
      // A protected call with no stored session at all.
      this.notifySessionExpired();
    }

    if (res.status === 401 && !path.startsWith('/auth/')) {
      throw new ApiError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
    }

    const raw = await res.text();
    if (!res.ok) throw toApiError(res.status, raw);

    // 204 No Content (e.g. DELETE) has no body to parse.
    return (raw ? JSON.parse(raw) : undefined) as T;
  }

  post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body), idempotencyKey });
  }

  patch<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body), idempotencyKey });
  }

  delete<T = void>(path: string, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', idempotencyKey });
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }
}

export const apiClient = new ApiClient();
