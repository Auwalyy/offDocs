import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';

type BadgeState = 'offline' | 'syncing' | 'synced' | 'error';

const config: Record<BadgeState, { dot: string; label: string; text: string }> = {
  offline: { dot: 'bg-surface-400', label: 'Offline',    text: 'text-surface-500 dark:text-surface-400' },
  syncing: { dot: 'bg-warning',     label: 'Syncing…',   text: 'text-warning' },
  synced:  { dot: 'bg-success',     label: 'Synced',     text: 'text-success' },
  error:   { dot: 'bg-error',       label: 'Sync issue', text: 'text-error' },
};

interface Props {
  isOnline: boolean;
  isSyncing: boolean;
  hasError: boolean;
  onPress?: () => void;
}

export function SyncBadge({ isOnline, isSyncing, hasError, onPress }: Props) {
  const state: BadgeState = !isOnline
    ? 'offline'
    : isSyncing
    ? 'syncing'
    : hasError
    ? 'error'
    : 'synced';

  const { dot, label, text } = config[state];

  const content = (
    <>
      <View className={`w-2 h-2 rounded-full ${dot}`} />
      <Text variant="caption" className={text}>{label}</Text>
    </>
  );
  const className = 'flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800';

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${className} active:opacity-70`}
        accessibilityRole="button"
        accessibilityLabel={`Sync status: ${label}. Open sync activity`}
        hitSlop={6}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className={className} accessibilityLabel={`Sync status: ${label}`} accessibilityRole="text">
      {content}
    </View>
  );
}
