import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design-system';
import { Folder } from '../types';

const SYNC_DOT: Record<string, string> = {
  pending:         'bg-warning',
  syncing:         'bg-primary-500',
  synced:          'bg-success',
  failed:          'bg-error',
  needs_attention: 'bg-error',
};

interface Props {
  folder: Folder;
  onPress: () => void;
  onDelete: () => void;
}

export function FolderRow({ folder, onPress, onDelete }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open folder ${folder.name}`}
      className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg px-4 py-3.5 active:opacity-80"
    >
      <Text className="text-xl mr-3">📁</Text>
      <View className="flex-1">
        <Text variant="label">{folder.name}</Text>
      </View>
      <View className={`w-2 h-2 rounded-full mr-3 ${SYNC_DOT[folder.syncStatus] ?? 'bg-surface-300'}`} />
      <Pressable
        onPress={onDelete}
        accessibilityLabel={`Delete folder ${folder.name}`}
        accessibilityRole="button"
        hitSlop={12}
        className="p-2"
      >
        <Text variant="caption" className="text-error">Delete</Text>
      </Pressable>
      <Text className="text-surface-400 ml-1">›</Text>
    </Pressable>
  );
}
