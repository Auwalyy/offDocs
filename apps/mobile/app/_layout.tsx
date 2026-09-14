import '../global.css';
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { getDatabase, resetDatabase } from '../src/database/database';
import { runMigrations } from '../src/database/schema';
import { initServices } from '../src/lib/ServiceRegistry';
import { connectivityMonitor } from '../src/lib/ConnectivityMonitor';
import { AppProvider, useApp } from '../src/hooks/useApp';
import { User } from '../src/types';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user } = useApp();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(app)/workspace');
    }
  }, [user, segments, router]);

  return <Slot />;
}

type InitState =
  | { status: 'loading' }
  | { status: 'ready'; initialUser: User | null }
  | { status: 'error'; message: string };

async function initApp(): Promise<User | null> {
  await Font.loadAsync({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  let db = await getDatabase();

  // Try migrations — if they fail due to stale schema, reset and retry once
  try {
    await runMigrations(db);
  } catch (migrationError) {
    console.warn('Migration failed, resetting database:', migrationError);
    db = await resetDatabase();
    await runMigrations(db);
  }

  const services = initServices(db);
  await connectivityMonitor.initialize();

  const storedUser = await services.auth.getCurrentUser();
  return storedUser?.accessToken ? storedUser : null;
}

export default function RootLayout() {
  const [initState, setInitState] = useState<InitState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    initApp()
      .then((initialUser) => {
        if (!cancelled) setInitState({ status: 'ready', initialUser });
      })
      .catch((e) => {
        console.error('App init error:', e);
        if (!cancelled) {
          setInitState({
            status: 'error',
            message: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .finally(() => {
        SplashScreen.hideAsync();
      });

    return () => { cancelled = true; };
  }, []);

  if (initState.status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: '#0F172A' }} />;
  }

  if (initState.status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#EF4444', fontSize: 16, textAlign: 'center' }}>
          {'Failed to initialize app:\n'}{initState.message}
        </Text>
      </View>
    );
  }

  return (
    <AppProvider initialUser={initState.initialUser}>
      <RootNavigator />
    </AppProvider>
  );
}
