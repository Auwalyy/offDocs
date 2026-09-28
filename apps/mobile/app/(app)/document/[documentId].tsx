import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import WebView from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { Text, Button, Chip, ScreenHeader, HeaderAction } from '../../../src/design-system';
import { Document, TagSummary } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { useApp } from '../../../src/hooks/useApp';
import { useReloadOnChange } from '../../../src/hooks/useReloadOnChange';
import { StarButton } from '../../../src/components/StarButton';
import { TagEditorModal } from '../../../src/components/TagEditorModal';
import { formatBytes } from '../../../src/lib/format';
import { fileTypeLabel } from '../../../src/lib/sort';
import { showError } from '../../../src/lib/alerts';

const SYNC_LABEL: Record<Document['syncStatus'], string> = {
  pending: 'Waiting to sync',
  syncing: 'Syncing',
  synced: 'Synced',
  failed: 'Sync failed, will retry',
  needs_attention: 'Sync failed',
};

export default function DocumentScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const { notifyLocalChange } = useApp();
  const [doc, setDoc]         = useState<Document | null>(null);
  const [tags, setTags]       = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagSummary[]>([]);
  const [loaded, setLoaded]   = useState(false);
  const [editingTags, setEditingTags] = useState(false);

  const load = useCallback(async () => {
    if (!documentId) return;
    const { documents, organization } = getServices();
    const [d, t] = await Promise.all([documents.getDocument(documentId), organization.getDocumentTags(documentId)]);
    setDoc(d);
    setTags(t);
    setLoaded(true);
  }, [documentId]);

  useReloadOnChange(load);

  // One "opened" entry per visit to this screen.
  useEffect(() => {
    if (!documentId) return;
    getServices().recent.record('document', documentId, 'opened')
      .catch((err: unknown) => console.warn('Could not record recent document:', err));
  }, [documentId]);

  async function toggleFavorite() {
    if (!doc) return;
    const next = !doc.isFavorite;
    setDoc({ ...doc, isFavorite: next }); // optimistic; reverted below on failure
    try {
      await getServices().organization.setFavorite('document', doc.id, next);
      notifyLocalChange();
    } catch (e) {
      setDoc({ ...doc, isFavorite: !next });
      showError('Could not update favorite', e);
    }
  }

  async function openTagEditor() {
    try {
      setAllTags(await getServices().organization.getAllTags());
    } catch {
      setAllTags([]); // suggestions are optional
    }
    setEditingTags(true);
  }

  async function saveTags(next: string[]) {
    if (!doc) return;
    const saved = await getServices().organization.setDocumentTags(doc.id, next);
    setTags(saved);
    setEditingTags(false);
    notifyLocalChange();
  }

  async function openExternally() {
    if (!doc?.localUri) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        showError('Not available', new Error('Sharing is not available on this device.'));
        return;
      }
      await Sharing.shareAsync(doc.localUri, { mimeType: doc.mimeType, dialogTitle: doc.name });
    } catch (e) {
      showError('Could not open document', e);
    }
  }

  if (!doc) {
    return (
      <View className="flex-1 bg-surface-50 dark:bg-surface-950">
        <ScreenHeader title="Document" />
        <View className="flex-1 items-center justify-center px-8">
          <Text variant="caption">{loaded ? 'This document no longer exists.' : 'Loading…'}</Text>
        </View>
      </View>
    );
  }

  // iOS WebView renders local PDFs natively; Android WebView has no PDF viewer.
  const canPreviewInline = doc.mimeType === 'application/pdf' && Platform.OS === 'ios' && !!doc.localUri;
  const kind = fileTypeLabel(doc.mimeType);

  const tagBar = (
    <View className="flex-row flex-wrap items-center gap-2 px-4 py-2 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
      {tags.map((t) => <Chip key={t} label={`#${t}`} size="sm" />)}
      <Pressable
        onPress={openTagEditor}
        accessibilityRole="button"
        accessibilityLabel={tags.length ? 'Edit tags' : 'Add tags'}
        hitSlop={8}
        className="min-h-[32px] justify-center"
      >
        <Text variant="caption" className="text-primary-600 dark:text-primary-400">
          {tags.length ? '✎ Edit tags' : '🏷️ Add tags'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader
        title={doc.name}
        right={
          <>
            <StarButton active={doc.isFavorite} name={doc.name} onPress={toggleFavorite} />
            <HeaderAction label="Share" onPress={openExternally} accessibilityLabel="Share document" />
          </>
        }
      />
      {tagBar}

      {canPreviewInline ? (
        <WebView
          source={{ uri: doc.localUri! }}
          style={{ flex: 1 }}
          accessibilityLabel="PDF viewer"
          originWhitelist={['file://*']}
          allowFileAccess
        />
      ) : (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-6xl">{kind === 'PDF' ? '📕' : '📘'}</Text>
          <Text variant="h3" className="text-center">{doc.name}</Text>
          <Text variant="caption" className="text-center">
            {[kind, doc.fileSize ? formatBytes(doc.fileSize) : null, SYNC_LABEL[doc.syncStatus]]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text variant="body" className="text-surface-500 text-center">
            Open this file in another app on your device to read it.
          </Text>
          <Button label="Open with…" onPress={openExternally} disabled={!doc.localUri} />
        </View>
      )}

      <TagEditorModal
        visible={editingTags}
        documentName={doc.name}
        initialTags={tags}
        allTags={allTags}
        onClose={() => setEditingTags(false)}
        onSave={saveTags}
      />
    </View>
  );
}
