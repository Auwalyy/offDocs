import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design-system';
import { Document } from '../types';
import { SyncDot } from './SyncDot';
import { formatBytes } from '../lib/format';

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📕',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
};

const MIME_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

interface Props {
  document: Document;
  onPress: () => void;
  onDelete: () => void;
}

export function DocumentRow({ document: doc, onPress, onDelete }: Props) {
  const meta = [MIME_LABEL[doc.mimeType], doc.fileSize ? formatBytes(doc.fileSize) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`Open document ${doc.name}`}
      accessibilityHint="Long press to delete"
      className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg px-4 py-3.5 border border-surface-100 dark:border-surface-800 active:opacity-80"
    >
      <Text className="text-2xl mr-3">{MIME_ICON[doc.mimeType] ?? '📎'}</Text>
      <View className="flex-1 mr-2">
        <Text variant="label" className="text-surface-800 dark:text-surface-100" numberOfLines={1}>{doc.name}</Text>
        {meta ? <Text variant="caption" className="text-xs">{meta}</Text> : null}
      </View>
      <SyncDot status={doc.syncStatus} />
      <Pressable
        onPress={onDelete}
        accessibilityLabel={`Delete document ${doc.name}`}
        accessibilityRole="button"
        hitSlop={12}
        className="px-2 py-1 ml-2"
      >
        <Text variant="caption" className="text-error">Delete</Text>
      </Pressable>
    </Pressable>
  );
}
