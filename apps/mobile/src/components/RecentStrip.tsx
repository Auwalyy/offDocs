import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../design-system';
import { RecentItem } from '../types';
import { FolderIcon } from './FolderIcon';
import { formatRelativeTime } from '../lib/format';

const DOC_ICON: Record<string, string> = {
  'application/pdf': '📕',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
};

export const RECENT_ACTION_LABEL: Record<RecentItem['action'], string> = {
  opened: 'Opened',
  imported: 'Imported',
  modified: 'Modified',
};

interface Props {
  items: RecentItem[];
  onSeeAll: () => void;
}

/** Horizontal "continue where you left off" row for the workspace home. */
export function RecentStrip({ items, onSeeAll }: Props) {
  const router = useRouter();
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="label" className="uppercase text-xs tracking-wide text-surface-400">Recent</Text>
        <Pressable onPress={onSeeAll} accessibilityRole="button" accessibilityLabel="See all recent items" hitSlop={8}>
          <Text variant="caption" className="text-primary-600 dark:text-primary-400">See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((item) => (
          <Pressable
            key={`${item.entityType}:${item.entityId}`}
            onPress={() =>
              router.push(item.entityType === 'folder' ? `/(app)/workspace/${item.entityId}` : `/(app)/document/${item.entityId}`)
            }
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${RECENT_ACTION_LABEL[item.action].toLowerCase()} ${formatRelativeTime(item.occurredAt)}`}
            className="w-36 bg-white dark:bg-surface-800 rounded-lg p-3 gap-2 border border-surface-100 dark:border-surface-800 active:opacity-80"
          >
            {item.entityType === 'folder' ? (
              <FolderIcon color={item.color} icon={item.icon} size="sm" />
            ) : (
              <Text className="text-2xl">{DOC_ICON[item.mimeType ?? ''] ?? '📎'}</Text>
            )}
            <Text variant="label" numberOfLines={2} className="text-surface-800 dark:text-surface-100">{item.name}</Text>
            <Text variant="caption" className="text-xs" numberOfLines={1}>
              {RECENT_ACTION_LABEL[item.action]} {formatRelativeTime(item.occurredAt)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function recentIcon(item: RecentItem): string {
  return item.entityType === 'folder' ? item.icon ?? '📁' : DOC_ICON[item.mimeType ?? ''] ?? '📎';
}
