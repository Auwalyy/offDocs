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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [isOnline, setIsOnline]       = useState(connectivityMonitor.isOnline);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [failedSyncCount, setFailedSyncCount] = useState(0);

  const refreshFailedCount = useCallback(async () => {
    const { syncQueue } = getServices();
    const count = await syncQueue.getFailedCount();
    setFailedSyncCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      const { syncEngine } = getServices();
      await syncEngine.sync();
      await refreshFailedCount();
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
    const { auth } = getServices();
    await auth.clearSession();
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
