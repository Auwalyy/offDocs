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
import { getDatabase } from '../src/database/database';
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

  const db = await getDatabase();

  // Never wipe the database on a failed migration: it may hold offline work
  // that has not synced yet. Surface the error instead.
  try {
    await runMigrations(db);
  } catch (migrationError) {
    const detail = migrationError instanceof Error ? migrationError.message : String(migrationError);
    throw new Error(`Could not update the local database. Your data has not been changed.\n${detail}`);
  }

  const services = initServices(db);
  await connectivityMonitor.initialize();

  return services.auth.getSignedInUser();
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
