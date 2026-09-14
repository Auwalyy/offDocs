import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, SyncBadge } from '../../src/design-system';
import { SyncQueueItem } from '../../src/types';
import { getServices } from '../../src/lib/ServiceRegistry';
import { useApp } from '../../src/hooks/useApp';

const STATUS_COLOR: Record<string, string> = {
  pending:         'text-warning',
  syncing:         'text-primary-500',
  synced:          'text-success',
  failed:          'text-error',
  needs_attention: 'text-error',
};

export default function SyncScreen() {
  const router = useRouter();
  const { isOnline, isSyncing, failedSyncCount, triggerSync } = useApp();
  const [items, setItems]   = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { syncQueue } = getServices();
    const all = await syncQueue.getAll();
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-4 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" className="p-1">
            <Text className="text-primary-600 text-lg">‹</Text>
          </Pressable>
          <Text variant="h2">Sync Activity</Text>
        </View>
        <SyncBadge isOnline={isOnline} isSyncing={isSyncing} hasError={failedSyncCount > 0} />
      </View>

      <View className="px-4 py-3 flex-row gap-3">
        <Button
          label={isSyncing ? 'Syncing…' : 'Sync Now'}
          loading={isSyncing}
          disabled={!isOnline}
          onPress={async () => { await triggerSync(); await load(); }}
          variant="primary"
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-16">
              <Text variant="caption" className="text-surface-400">No sync activity</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View className="bg-white dark:bg-surface-800 rounded-lg p-4 gap-1">
            <View className="flex-row items-center justify-between">
              <Text variant="label">{item.operation}</Text>
              <Text variant="caption" className={STATUS_COLOR[item.status] ?? 'text-surface-500'}>
                {item.status}
              </Text>
            </View>
            <Text variant="caption" className="text-surface-400">{item.clientEntityId}</Text>
            {item.lastError ? (
              <Text variant="caption" className="text-error">{item.lastError}</Text>
            ) : null}
            {item.retryCount > 0 ? (
              <Text variant="caption" className="text-surface-400">Retries: {item.retryCount}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
