import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Text, Button, SyncBadge, ScreenHeader } from '../../src/design-system';
import { useApp } from '../../src/hooks/useApp';
import { API_BASE_URL } from '../../src/api/client';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white dark:bg-surface-800 rounded-lg p-4 gap-3">
      <Text variant="label" className="text-surface-400 uppercase tracking-wide text-xs">{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-1 gap-4">
      <Text variant="body">{label}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isOnline, isSyncing, failedSyncCount, signOut } = useApp();

  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'Changes that have not synced yet stay on this device and will sync next time you sign in with this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ]
    );
  }

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20, gap: 16 }}>
        <Section title="Account">
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-full bg-primary-600 items-center justify-center">
              <Text className="text-white font-semibold text-lg">
                {(user?.displayName ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text variant="body" numberOfLines={1}>{user?.displayName ?? '—'}</Text>
              <Text variant="caption" numberOfLines={1}>{user?.email ?? '—'}</Text>
            </View>
          </View>
        </Section>

        <Section title="Synchronization">
          <Pressable
            onPress={() => router.push('/(app)/sync')}
            accessibilityRole="button"
            accessibilityLabel="View sync activity"
            className="flex-row items-center justify-between py-1 active:opacity-70"
          >
            <Text variant="body">Sync activity</Text>
            <View className="flex-row items-center gap-2">
              {failedSyncCount > 0 && (
                <View className="bg-error rounded-full px-2 py-0.5">
                  <Text variant="caption" className="text-white">{failedSyncCount}</Text>
                </View>
              )}
              <Text className="text-surface-400 text-xl">›</Text>
            </View>
          </Pressable>
          <Row label="Status">
            <SyncBadge isOnline={isOnline} isSyncing={isSyncing} hasError={failedSyncCount > 0} />
          </Row>
          <Row label="Server">
            <Text variant="caption" className="flex-1 text-right" numberOfLines={1}>{API_BASE_URL}</Text>
          </Row>
        </Section>

        <Section title="About">
          <Row label="Version">
            <Text variant="caption">{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </Row>
        </Section>

        <Button label="Sign out" variant="danger" onPress={handleSignOut} fullWidth />
      </ScrollView>
    </View>
  );
}
