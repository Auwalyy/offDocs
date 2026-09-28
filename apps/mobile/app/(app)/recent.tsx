import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Chip, ScreenHeader, HeaderAction } from '../../src/design-system';
import { EntityType, RecentItem } from '../../src/types';
import { getServices } from '../../src/lib/ServiceRegistry';
import { useReloadOnChange } from '../../src/hooks/useReloadOnChange';
import { FolderIcon } from '../../src/components/FolderIcon';
import { RECENT_ACTION_LABEL, recentIcon } from '../../src/components/RecentStrip';
import { formatBytes, formatRelativeTime } from '../../src/lib/format';
import { fileTypeLabel } from '../../src/lib/sort';
import { showError } from '../../src/lib/alerts';

type Filter = 'all' | EntityType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'document', label: 'Documents' },
  { value: 'folder', label: 'Folders' },
];

export default function RecentScreen() {
  const router = useRouter();
  const [items, setItems]   = useState<RecentItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setItems(await getServices().recent.list(filter === 'all' ? {} : { entityType: filter }));
    setLoaded(true);
  }, [filter]);

  useReloadOnChange(load);

  async function remove(item: RecentItem) {
    setItems((current) => current.filter((i) => i !== item));
    try {
      await getServices().recent.remove(item.entityType, item.entityId);
    } catch (e) {
      showError('Could not remove item', e);
      void load();
    }
  }

  function clearAll() {
    Alert.alert('Clear recent history', 'Your folders and documents are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          getServices().recent.clear().then(load).catch((e: unknown) => showError('Could not clear history', e));
        },
      },
    ]);
  }

  // Re-run the query when the filter changes (useReloadOnChange only reloads on focus/data changes).
  function changeFilter(next: Filter) {
    setFilter(next);
    getServices().recent.list(next === 'all' ? {} : { entityType: next })
      .then(setItems)
      .catch((err: unknown) => console.warn('Could not load recent items:', err));
  }

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader
        title="Recent"
        right={items.length ? <HeaderAction label="Clear" onPress={clearAll} accessibilityLabel="Clear recent history" /> : null}
      />
      <View className="flex-row gap-2 px-4 py-2 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => changeFilter(f.value)} />
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.entityType}:${i.entityId}`}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          loaded ? (
            <View className="items-center py-20 gap-2">
              <Text className="text-5xl">🕘</Text>
              <Text variant="h3">Nothing recent</Text>
              <Text variant="caption" className="text-center">Folders and documents you open or import will appear here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const details = [
            item.entityType === 'document' && item.mimeType ? fileTypeLabel(item.mimeType) : 'Folder',
            item.fileSize ? formatBytes(item.fileSize) : null,
            item.locationName ? `in ${item.locationName}` : 'in My Workspace',
          ].filter(Boolean).join(' · ');
          return (
            <View className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg border border-surface-100 dark:border-surface-800">
              <Pressable
                onPress={() =>
                  router.push(item.entityType === 'folder' ? `/(app)/workspace/${item.entityId}` : `/(app)/document/${item.entityId}`)
                }
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}. ${RECENT_ACTION_LABEL[item.action]} ${formatRelativeTime(item.occurredAt)}`}
                className="flex-1 flex-row items-center pl-3 py-3 active:opacity-80"
              >
                {item.entityType === 'folder' ? (
                  <FolderIcon color={item.color} icon={item.icon} />
                ) : (
                  <Text className="text-2xl w-10 text-center">{recentIcon(item)}</Text>
                )}
                <View className="flex-1 mx-3">
                  <Text variant="label" numberOfLines={1} className="text-surface-800 dark:text-surface-100">{item.name}</Text>
                  <Text variant="caption" className="text-xs" numberOfLines={1}>{details}</Text>
                  <Text variant="caption" className="text-xs" numberOfLines={1}>
                    {RECENT_ACTION_LABEL[item.action]} {formatRelativeTime(item.occurredAt)}
                    {item.updatedAt !== item.occurredAt ? ` · modified ${formatRelativeTime(item.updatedAt)}` : ''}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => void remove(item)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name} from recent`}
                hitSlop={8}
                className="w-11 h-11 items-center justify-center mr-1"
              >
                <Text className="text-surface-400">✕</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
