import React from 'react';
import { Pressable, View } from 'react-native';
import { Text, Chip } from '../design-system';
import { Document } from '../types';
import { SyncDot } from './SyncDot';
import { HighlightText } from './HighlightText';
import { StarButton } from './StarButton';
import { formatBytes } from '../lib/format';
import { fileTypeLabel } from '../lib/sort';

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📕',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
};

/** Tags shown on a row; the rest are summarised as "+N". */
const VISIBLE_TAGS = 2;

interface Props {
  document: Document;
  onPress: () => void;
  onOptions?: () => void;
  onToggleFavorite?: () => void;
  tags?: string[];
  layout?: 'list' | 'grid';
  /** Replaces the type/size line, e.g. the folder in search results. */
  subtitle?: string | null;
  query?: string;
}

export function DocumentRow({
  document: doc, onPress, onOptions, onToggleFavorite, tags = [], layout = 'list', subtitle, query,
}: Props) {
  const meta = subtitle ?? [fileTypeLabel(doc.mimeType), doc.fileSize ? formatBytes(doc.fileSize) : null]
    .filter(Boolean)
    .join(' · ');
  const icon = MIME_ICON[doc.mimeType] ?? '📎';
  const label = `Open document ${doc.name}${doc.isFavorite ? ', favorite' : ''}${tags.length ? `, tags ${tags.join(', ')}` : ''}`;
  const name = query ? (
    <HighlightText text={doc.name} query={query} numberOfLines={layout === 'grid' ? 2 : 1} className="text-surface-800 dark:text-surface-100" />
  ) : (
    <Text variant="label" className="text-surface-800 dark:text-surface-100" numberOfLines={layout === 'grid' ? 2 : 1}>{doc.name}</Text>
  );
  const tagChips = tags.length ? (
    <View className="flex-row flex-wrap gap-1 mt-1">
      {tags.slice(0, VISIBLE_TAGS).map((t) => <Chip key={t} label={`#${t}`} size="sm" />)}
      {tags.length > VISIBLE_TAGS ? <Chip label={`+${tags.length - VISIBLE_TAGS}`} size="sm" /> : null}
    </View>
  ) : null;

  if (layout === 'grid') {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onOptions}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={onOptions ? 'Long press for options' : undefined}
        className="flex-1 bg-white dark:bg-surface-800 rounded-lg p-3 border border-surface-100 dark:border-surface-800 active:opacity-80 gap-1"
      >
        <View className="flex-row items-start justify-between">
          <Text className="text-4xl">{icon}</Text>
          {onToggleFavorite ? <StarButton active={doc.isFavorite} name={doc.name} onPress={onToggleFavorite} /> : null}
        </View>
        {name}
        <View className="flex-row items-center justify-between">
          <Text variant="caption" className="text-xs flex-1" numberOfLines={1}>{meta}</Text>
          <SyncDot status={doc.syncStatus} />
        </View>
        {tagChips}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onOptions}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={onOptions ? 'Long press for options' : undefined}
      className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg pl-3 pr-2 py-3 border border-surface-100 dark:border-surface-800 active:opacity-80"
    >
      <Text className="text-2xl w-10 text-center">{icon}</Text>
      <View className="flex-1 mx-3">
        {name}
        {meta ? <Text variant="caption" className="text-xs" numberOfLines={1}>{meta}</Text> : null}
        {tagChips}
      </View>
      <SyncDot status={doc.syncStatus} />
      {onToggleFavorite ? <StarButton active={doc.isFavorite} name={doc.name} onPress={onToggleFavorite} /> : null}
      {onOptions ? (
        <Pressable
          onPress={onOptions}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${doc.name}`}
          hitSlop={8}
          className="w-9 h-11 items-center justify-center"
        >
          <Text className="text-surface-400 text-xl">⋯</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
