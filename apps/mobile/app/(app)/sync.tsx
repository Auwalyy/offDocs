import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Text, Button, SyncBadge, ScreenHeader } from '../../src/design-system';
import { SyncOperation, SyncQueueItem, SyncStatus } from '../../src/types';
import { getServices } from '../../src/lib/ServiceRegistry';
import { useApp } from '../../src/hooks/useApp';
import { useReloadOnChange } from '../../src/hooks/useReloadOnChange';
import { API_BASE_URL } from '../../src/api/client';
import { formatRelativeTime } from '../../src/lib/format';

type ActivityItem = SyncQueueItem & { entityName: string | null };

const OPERATION_LABEL: Record<SyncOperation, string> = {
  'folder:create':   'Create folder',
  'folder:rename':   'Rename folder',
  'folder:move':     'Move folder',
  'folder:delete':   'Delete folder',
  'document:create': 'Upload document',
  'document:delete': 'Delete document',
};

const STATUS: Record<SyncStatus, { label: string; className: string }> = {
  pending:         { label: 'Waiting',       className: 'text-warning' },
  syncing:         { label: 'Syncing',       className: 'text-primary-500' },
  synced:          { label: 'Done',          className: 'text-success' },
  failed:          { label: 'Retrying',      className: 'text-error' },
  needs_attention: { label: 'Failed',        className: 'text-error' },
};

export default function SyncScreen() {
  const { isOnline, isSyncing, failedSyncCount, triggerSync, retryFailedSync } = useApp();
  const [items, setItems]           = useState<ActivityItem[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await getServices().syncQueue.getRecentActivity());
    setLoaded(true);
  }, []);

  useReloadOnChange(load);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const waitingCount = items.filter((i) => i.status === 'pending' || i.status === 'syncing').length;

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader
        title="Sync Activity"
        right={<SyncBadge isOnline={isOnline} isSyncing={isSyncing} hasError={failedSyncCount > 0} />}
      />

      <View className="px-4 pt-4 pb-2 gap-3">
        <View className="bg-white dark:bg-surface-800 rounded-lg p-4 gap-1">
          <Text variant="h3">
            {!isOnline
              ? 'You are offline'
              : failedSyncCount > 0
              ? `${failedSyncCount} ${failedSyncCount === 1 ? 'change' : 'changes'} failed to sync`
              : waitingCount > 0
              ? `${waitingCount} ${waitingCount === 1 ? 'change' : 'changes'} waiting`
              : 'Everything is up to date'}
          </Text>
          <Text variant="caption">
            {!isOnline
              ? 'Your changes are saved on this device and will sync when you reconnect.'
              : failedSyncCount > 0
              ? 'See the error on each item below. Fix the cause, then tap Retry.'
              : 'Changes sync automatically in the background.'}
          </Text>
          <Text variant="caption" className="text-xs mt-1" numberOfLines={1}>Server: {API_BASE_URL}</Text>
        </View>

        <View className="flex-row gap-3">
          <Button
            label="Sync now"
            loading={isSyncing}
            disabled={!isOnline}
            onPress={() => void triggerSync()}
            className="flex-1"
          />
          {failedSyncCount > 0 ? (
            <Button
              label="Retry failed"
              variant="secondary"
              disabled={!isOnline || isSyncing}
              onPress={() => void retryFailedSync()}
              className="flex-1"
            />
          ) : null}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 8 }}
        ListEmptyComponent={
          loaded ? (
            <View className="items-center py-16 gap-1">
              <Text className="text-4xl">✅</Text>
              <Text variant="caption">No sync activity yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const status = STATUS[item.status] ?? { label: item.status, className: 'text-surface-500' };
          return (
            <View className="bg-white dark:bg-surface-800 rounded-lg p-4 gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="label" className="flex-1" numberOfLines={1}>
                  {OPERATION_LABEL[item.operation] ?? item.operation}
                  {item.entityName ? ` · ${item.entityName}` : ''}
                </Text>
                <Text variant="caption" className={`font-semibold ${status.className}`}>{status.label}</Text>
              </View>
              <Text variant="caption" className="text-xs">
                {formatRelativeTime(item.createdAt)}
                {item.retryCount > 0 ? ` · ${item.retryCount} ${item.retryCount === 1 ? 'attempt' : 'attempts'}` : ''}
              </Text>
              {item.lastError && item.status !== 'synced' ? (
                <Text
                  variant="caption"
                  className={item.status === 'pending' ? 'text-surface-500' : 'text-error'}
                >
                  {item.lastError}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
