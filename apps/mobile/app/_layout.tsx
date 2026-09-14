import '../global.css';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
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

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
        });
        const db = await getDatabase();
        await runMigrations(db);
        initServices(db);
        await connectivityMonitor.initialize();
      } catch (e) {
        console.error('App init error:', e);
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!ready) return <View className="flex-1 bg-surface-900" />;

  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
