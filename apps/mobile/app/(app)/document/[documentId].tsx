import React, { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import WebView from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { Text, Button } from '../../../src/design-system';
import { Document } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';

export default function DocumentScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<Document | null>(null);

  useEffect(() => {
    if (!documentId) return;
    getServices().documents.getDocument(documentId).then(setDoc);
  }, [documentId]);

  if (!doc) {
    return (
      <View className="flex-1 bg-surface-50 dark:bg-surface-950 items-center justify-center">
        <Text variant="caption" className="text-surface-400">Loading…</Text>
      </View>
    );
  }

  const isPdf = doc.mimeType === 'application/pdf';

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pt-14 pb-4 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" className="p-1">
          <Text className="text-primary-600 text-lg">‹</Text>
        </Pressable>
        <Text variant="h3" className="flex-1" numberOfLines={1}>{doc.name}</Text>
        <Pressable
          onPress={async () => {
            if (doc.localUri && (await Sharing.isAvailableAsync())) {
              await Sharing.shareAsync(doc.localUri);
            }
          }}
          accessibilityLabel="Share document"
          className="p-2"
        >
          <Text variant="caption" className="text-primary-600">Share</Text>
        </Pressable>
      </View>

      {isPdf && doc.localUri ? (
        <WebView
          source={{ uri: doc.localUri }}
          className="flex-1"
          accessibilityLabel="PDF viewer"
          originWhitelist={['file://*', 'content://*']}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text variant="h3" className="text-center">{doc.name}</Text>
          <Text variant="body" className="text-surface-500 text-center">
            DOCX files open in your device's document viewer.
          </Text>
          <Text variant="caption" className="text-surface-400 text-center">
            {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''}
            {doc.syncStatus === 'pending' ? ' · Pending sync' : ''}
          </Text>
          <Button
            label="Open with…"
            variant="secondary"
            onPress={async () => {
              if (doc.localUri && (await Sharing.isAvailableAsync())) {
                await Sharing.shareAsync(doc.localUri, { mimeType: doc.mimeType });
              }
            }}
          />
        </View>
      )}
    </View>
  );
}
