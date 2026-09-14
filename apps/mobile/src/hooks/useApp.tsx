import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import { getServices } from '../lib/ServiceRegistry';
import { connectivityMonitor } from '../lib/ConnectivityMonitor';

interface AppContextValue {
  user: User | null;
  isOnline: boolean;
  isSyncing: boolean;
  failedSyncCount: number;
  signIn: (user: User) => void;
  signOut: () => void;
  triggerSync: () => void;
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

  const refreshFailedCount = useCallback(async () => {
    try {
      const { syncQueue } = getServices();
      const count = await syncQueue.getFailedCount();
      setFailedSyncCount(count);
    } catch {
      // services not yet ready — ignore
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      const { syncEngine } = getServices();
      await syncEngine.sync();
      await refreshFailedCount();
    } catch {
      // network or service error — silently handled by sync engine
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshFailedCount]);

  useEffect(() => {
    const unsub = connectivityMonitor.subscribe((online) => {
      setIsOnline(online);
      if (online) triggerSync();
    });
    return unsub;
  }, [triggerSync]);

  const signIn = useCallback((u: User) => setUser(u), []);

  const signOut = useCallback(async () => {
    try {
      const { auth } = getServices();
      await auth.clearSession();
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  return (
    <AppContext.Provider value={{ user, isOnline, isSyncing, failedSyncCount, signIn, signOut, triggerSync }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
