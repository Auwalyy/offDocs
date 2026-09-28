import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design-system';
import { Folder } from '../types';
import { SyncDot } from './SyncDot';
import { FolderIcon } from './FolderIcon';
import { HighlightText } from './HighlightText';
import { StarButton } from './StarButton';

interface Props {
  folder: Folder;
  onPress: () => void;
  /** Opens the folder's action menu (also on long press). */
  onOptions?: () => void;
  onToggleFavorite?: () => void;
  layout?: 'list' | 'grid';
  /** Secondary line, e.g. the parent folder in search results. */
  subtitle?: string | null;
  /** Highlights matches in the name. */
  query?: string;
}

export function FolderRow({ folder, onPress, onOptions, onToggleFavorite, layout = 'list', subtitle, query }: Props) {
  const name = query ? (
    <HighlightText text={folder.name} query={query} numberOfLines={1} className="text-surface-800 dark:text-surface-100" />
  ) : (
    <Text variant="label" className="text-surface-800 dark:text-surface-100" numberOfLines={1}>{folder.name}</Text>
  );

  if (layout === 'grid') {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onOptions}
        accessibilityRole="button"
        accessibilityLabel={`Open folder ${folder.name}${folder.isFavorite ? ', favorite' : ''}`}
        accessibilityHint={onOptions ? 'Long press for options' : undefined}
        className="flex-1 bg-white dark:bg-surface-800 rounded-lg p-3 border border-surface-100 dark:border-surface-800 active:opacity-80 gap-2"
      >
        <View className="flex-row items-start justify-between">
          <FolderIcon color={folder.color} icon={folder.icon} size="lg" />
          {onToggleFavorite ? <StarButton active={folder.isFavorite} name={folder.name} onPress={onToggleFavorite} /> : null}
        </View>
        {name}
        <View className="flex-row items-center justify-between">
          <Text variant="caption" className="text-xs" numberOfLines={1}>{subtitle ?? 'Folder'}</Text>
          <SyncDot status={folder.syncStatus} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onOptions}
      accessibilityRole="button"
      accessibilityLabel={`Open folder ${folder.name}${folder.isFavorite ? ', favorite' : ''}`}
      accessibilityHint={onOptions ? 'Long press for options' : undefined}
      className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg pl-3 pr-2 py-3 border border-surface-100 dark:border-surface-800 active:opacity-80"
    >
      <FolderIcon color={folder.color} icon={folder.icon} />
      <View className="flex-1 mx-3">
        {name}
        {subtitle ? <Text variant="caption" className="text-xs" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <SyncDot status={folder.syncStatus} />
      {onToggleFavorite ? <StarButton active={folder.isFavorite} name={folder.name} onPress={onToggleFavorite} /> : null}
      {onOptions ? (
        <Pressable
          onPress={onOptions}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${folder.name}`}
          hitSlop={8}
          className="w-9 h-11 items-center justify-center"
        >
          <Text className="text-surface-400 text-xl">⋯</Text>
        </Pressable>
      ) : (
        <Text className="text-surface-400 text-xl ml-1">›</Text>
      )}
    </Pressable>
  );
}
