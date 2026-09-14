import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design-system';
import { Document } from '../types';

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
};

const SYNC_DOT: Record<string, string> = {
  pending:         'bg-warning',
  syncing:         'bg-primary-500',
  synced:          'bg-success',
  failed:          'bg-error',
  needs_attention: 'bg-error',
};

interface Props {
  document: Document;
  onPress: () => void;
  onDelete: () => void;
}

export function DocumentRow({ document: doc, onPress, onDelete }: Props) {
  const icon = MIME_ICON[doc.mimeType] ?? '📎';
  const sizeLabel = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open document ${doc.name}`}
      className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg px-4 py-3.5 active:opacity-80"
    >
      <Text className="text-xl mr-3">{icon}</Text>
      <View className="flex-1">
        <Text variant="label" numberOfLines={1}>{doc.name}</Text>
        {sizeLabel ? <Text variant="caption" className="text-surface-400">{sizeLabel}</Text> : null}
      </View>
      <View className={`w-2 h-2 rounded-full mr-3 ${SYNC_DOT[doc.syncStatus] ?? 'bg-surface-300'}`} />
      <Pressable
        onPress={onDelete}
        accessibilityLabel={`Delete document ${doc.name}`}
        accessibilityRole="button"
        hitSlop={12}
        className="p-2"
      >
        <Text variant="caption" className="text-error">Delete</Text>
      </Pressable>
    </Pressable>
  );
}
