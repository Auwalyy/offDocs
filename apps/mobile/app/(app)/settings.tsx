import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, SyncBadge } from '../../src/design-system';
import { useApp } from '../../src/hooks/useApp';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isOnline, isSyncing, failedSyncCount, signOut } = useApp();

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-4 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" className="p-1">
            <Text className="text-primary-600 text-lg">‹</Text>
          </Pressable>
          <Text variant="h2">Settings</Text>
        </View>
        <SyncBadge isOnline={isOnline} isSyncing={isSyncing} hasError={failedSyncCount > 0} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20, gap: 16 }}>
        {/* Account */}
        <View className="bg-white dark:bg-surface-800 rounded-lg p-4 gap-3">
          <Text variant="label" className="text-surface-400 uppercase tracking-wide text-xs">Account</Text>
          <View className="gap-1">
            <Text variant="body">{user?.displayName ?? '—'}</Text>
            <Text variant="caption" className="text-surface-400">{user?.email ?? '—'}</Text>
          </View>
        </View>

        {/* Sync */}
        <View className="bg-white dark:bg-surface-800 rounded-lg p-4 gap-3">
          <Text variant="label" className="text-surface-400 uppercase tracking-wide text-xs">Synchronization</Text>
          <Pressable
            onPress={() => router.push('/(app)/sync')}
            accessibilityRole="button"
            accessibilityLabel="View sync activity"
            className="flex-row items-center justify-between py-1"
          >
            <Text variant="body">Sync Activity</Text>
            <View className="flex-row items-center gap-2">
              {failedSyncCount > 0 && (
                <View className="bg-error rounded-full px-2 py-0.5">
                  <Text variant="caption" className="text-white">{failedSyncCount}</Text>
                </View>
              )}
              <Text className="text-surface-400">›</Text>
            </View>
          </Pressable>
          <View className="flex-row items-center justify-between py-1">
            <Text variant="body">Status</Text>
            <SyncBadge isOnline={isOnline} isSyncing={isSyncing} hasError={failedSyncCount > 0} />
          </View>
        </View>

        {/* About */}
        <View className="bg-white dark:bg-surface-800 rounded-lg p-4 gap-3">
          <Text variant="label" className="text-surface-400 uppercase tracking-wide text-xs">About</Text>
          <View className="flex-row items-center justify-between py-1">
            <Text variant="body">Version</Text>
            <Text variant="caption" className="text-surface-400">1.0.0</Text>
          </View>
          <View className="flex-row items-center justify-between py-1">
            <Text variant="body">Storage</Text>
            <Text variant="caption" className="text-surface-400">Cloudflare R2</Text>
          </View>
        </View>

        {/* Sign out */}
        <Button label="Sign Out" variant="danger" onPress={handleSignOut} fullWidth />
      </ScrollView>
    </View>
  );
}
