import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { User } from '../types';
import { getServices } from '../lib/ServiceRegistry';
import { connectivityMonitor } from '../lib/ConnectivityMonitor';
import { apiClient } from '../api/client';

const AUTO_SYNC_INTERVAL_MS = 30_000;

interface AuthResponse {
  data: {
    user: { id: string; email: string; displayName: string };
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

interface AppContextValue {
  user: User | null;
  isOnline: boolean;
  isSyncing: boolean;
  /** Queue items that failed or need attention. */
  failedSyncCount: number;
  /** Increments after every sync run and local change — screens reload when it changes. */
  dataVersion: number;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Pushes pending changes now. Safe to call at any time. */
  triggerSync: () => Promise<void>;
  /** Resets failed items and syncs again. */
  retryFailedSync: () => Promise<void>;
  /** Call after a local mutation so the UI refreshes and the change is pushed. */
  notifyLocalChange: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  initialUser: User | null;
}

export function AppProvider({ children, initialUser }: AppProviderProps) {
  const [user, setUser]                       = useState<User | null>(initialUser);
  const [isOnline, setIsOnline]               = useState(connectivityMonitor.isOnline);
  const [isSyncing, setIsSyncing]             = useState(false);
  const [failedSyncCount, setFailedSyncCount] = useState(0);
  const [dataVersion, setDataVersion]         = useState(0);

  // Refs let long-lived callbacks (timers, listeners) read current values
  // instead of the values captured when they were created.
  const userRef     = useRef(user);
  const onlineRef   = useRef(isOnline);
  const syncingRef  = useRef(false);
  const sessionExpiredShownRef = useRef(false);
  userRef.current   = user;
  onlineRef.current = isOnline;

  const refreshFailedCount = useCallback(async () => {
    try {
      setFailedSyncCount(await getServices().syncQueue.getFailedCount());
    } catch {
      // services not ready yet
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!userRef.current || !onlineRef.current || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await getServices().syncEngine.sync();
    } catch (err) {
      console.warn('Sync run failed:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshFailedCount();
      setDataVersion((v) => v + 1);
    }
  }, [refreshFailedCount]);

  const retryFailedSync = useCallback(async () => {
    await getServices().syncQueue.retryFailed();
    await refreshFailedCount();
    await triggerSync();
  }, [refreshFailedCount, triggerSync]);

  const notifyLocalChange = useCallback(() => {
    setDataVersion((v) => v + 1);
    void triggerSync();
  }, [triggerSync]);

  // Connectivity changes: sync as soon as we come back online.
  useEffect(() => {
    return connectivityMonitor.subscribe((online) => {
      onlineRef.current = online;
      setIsOnline(online);
      if (online) void triggerSync();
    });
  }, [triggerSync]);

  // Initial sync on sign-in, then periodically and whenever the app returns to the foreground.
  useEffect(() => {
    if (!user) return;
    void refreshFailedCount();
    void triggerSync();
    const interval = setInterval(() => void triggerSync(), AUTO_SYNC_INTERVAL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void triggerSync();
    });
    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [user, triggerSync, refreshFailedCount]);

  const completeAuth = useCallback(async (res: AuthResponse) => {
    const now = Date.now();
    const tokens = {
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
      expiresAt: res.data.expiresAt,
    };
    const signedIn: User = {
      id: res.data.user.id,
      email: res.data.user.email,
      displayName: res.data.user.displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    const services = getServices();
    await services.auth.saveSession(signedIn, tokens);
    // Items that failed while signed out (e.g. with an expired session) get a fresh start.
    await services.syncQueue.retryFailed();
    sessionExpiredShownRef.current = false;
    setUser(signedIn);
  }, []);

  // The server rejected the session for good: sign out, keep local work, explain why.
  useEffect(() => {
    apiClient.setSessionExpiredHandler(() => {
      if (!userRef.current || sessionExpiredShownRef.current) return;
      sessionExpiredShownRef.current = true;
      void (async () => {
        try {
          await getServices().auth.clearSession({ expired: true });
        } catch {
          // ignore
        }
        setUser(null);
        setFailedSyncCount(0);
        Alert.alert(
          'Please sign in again',
          'Your session has expired or your account was not found on the server. ' +
            'Your folders and documents are still on this device and will upload after you sign in ' +
            '(or create a new account).'
        );
      })();
    });
    return () => apiClient.setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    await completeAuth(res);
  }, [completeAuth]);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/register', {
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    await completeAuth(res);
  }, [completeAuth]);

  const signOut = useCallback(async () => {
    // Revoke the refresh token server-side (needs the token, so before clearing it),
    // but never hold up sign-out for more than a moment on a slow network.
    if (onlineRef.current) {
      await Promise.race([
        apiClient.post('/auth/logout', {}).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ]);
    }
    try {
      await getServices().auth.clearSession();
    } catch {
      // ignore
    }
    setUser(null);
    setFailedSyncCount(0);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    user, isOnline, isSyncing, failedSyncCount, dataVersion,
    login, register, signOut, triggerSync, retryFailedSync, notifyLocalChange,
  }), [
    user, isOnline, isSyncing, failedSyncCount, dataVersion,
    login, register, signOut, triggerSync, retryFailedSync, notifyLocalChange,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
