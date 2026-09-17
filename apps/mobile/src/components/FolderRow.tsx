import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design-system';
import { Folder } from '../types';
import { SyncDot } from './SyncDot';

interface Props {
  folder: Folder;
  onPress: () => void;
  onDelete: () => void;
}

export function FolderRow({ folder, onPress, onDelete }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`Open folder ${folder.name}`}
      accessibilityHint="Long press to delete"
      className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg px-4 py-3.5 border border-surface-100 dark:border-surface-800 active:opacity-80"
    >
      <Text className="text-2xl mr-3">📁</Text>
      <View className="flex-1 mr-2">
        <Text variant="label" className="text-surface-800 dark:text-surface-100" numberOfLines={1}>{folder.name}</Text>
      </View>
      <SyncDot status={folder.syncStatus} />
      <Pressable
        onPress={onDelete}
        accessibilityLabel={`Delete folder ${folder.name}`}
        accessibilityRole="button"
        hitSlop={12}
        className="px-2 py-1 ml-2"
      >
        <Text variant="caption" className="text-error">Delete</Text>
      </Pressable>
      <Text className="text-surface-400 text-xl ml-1">›</Text>
    </Pressable>
  );
}
