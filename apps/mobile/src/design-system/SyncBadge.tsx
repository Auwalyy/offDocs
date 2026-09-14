import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { SyncStatus } from '../types';

type BadgeState = 'offline' | 'syncing' | 'synced' | 'error';

const config: Record<BadgeState, { dot: string; label: string; text: string }> = {
  offline: { dot: 'bg-surface-400', label: 'Offline',  text: 'text-surface-500 dark:text-surface-400' },
  syncing: { dot: 'bg-warning',     label: 'Syncing…', text: 'text-warning' },
  synced:  { dot: 'bg-success',     label: 'Synced',   text: 'text-success' },
  error:   { dot: 'bg-error',       label: 'Sync Error', text: 'text-error' },
};

interface Props {
  isOnline: boolean;
  isSyncing: boolean;
  hasError: boolean;
}

export function SyncBadge({ isOnline, isSyncing, hasError }: Props) {
  const state: BadgeState = !isOnline
    ? 'offline'
    : isSyncing
    ? 'syncing'
    : hasError
    ? 'error'
    : 'synced';

  const { dot, label, text } = config[state];

  return (
    <View
      className="flex-row items-center gap-1.5 px-2 py-1 rounded-full bg-surface-100 dark:bg-surface-800"
      accessibilityLabel={`Sync status: ${label}`}
      accessibilityRole="text"
    >
      <View className={`w-2 h-2 rounded-full ${dot}`} />
      <Text variant="caption" className={text}>{label}</Text>
    </View>
  );
}
