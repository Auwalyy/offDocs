import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import WebView from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { Text, Button, ScreenHeader, HeaderAction } from '../../../src/design-system';
import { Document } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { formatBytes } from '../../../src/lib/format';
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
  const [doc, setDoc] = useState<Document | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    getServices().documents.getDocument(documentId)
      .then(setDoc)
      .catch((e: unknown) => showError('Could not open document', e))
      .finally(() => setLoaded(true));
  }, [documentId]);

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
  const kind = doc.mimeType === 'application/pdf' ? 'PDF' : 'DOCX';

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader
        title={doc.name}
        right={<HeaderAction label="Share" onPress={openExternally} accessibilityLabel="Share document" />}
      />

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
    </View>
  );
}
