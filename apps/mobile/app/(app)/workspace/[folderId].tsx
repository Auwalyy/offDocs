import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Text, SyncBadge } from '../../../src/design-system';
import { Document, Folder } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { useApp } from '../../../src/hooks/useApp';
import { FolderRow } from '../../../src/components/FolderRow';
import { DocumentRow } from '../../../src/components/DocumentRow';
import { CreateFolderModal } from '../../../src/components/CreateFolderModal';
import { RenameFolderModal } from '../../../src/components/RenameFolderModal';
import { MoveFolderModal } from '../../../src/components/MoveFolderModal';

const SUPPORTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function FolderScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const router = useRouter();
  const { isOnline, isSyncing, failedSyncCount } = useApp();

  const [folder, setFolder]         = useState<Folder | null>(null);
  const [subFolders, setSubFolders] = useState<Folder[]>([]);
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showMove, setShowMove]     = useState(false);

  const load = useCallback(async () => {
    if (!folderId) return;
    const { workspace, documents: docSvc } = getServices();
    const [f, subs, docs] = await Promise.all([
      workspace.getFolder(folderId),
      workspace.getFolders(folderId),
      docSvc.getDocuments(folderId),
    ]);
    setFolder(f);
    setSubFolders(subs);
    setDocuments(docs);
    setLoading(false);
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  async function handleImport() {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_MIME,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const { documents: docSvc } = getServices();
    await docSvc.importDocument({
      sourceUri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      fileSize: asset.size ?? 0,
      folderId: folderId!,
      lastModified: asset.lastModified ?? 0,
    });
    await load();
  }

  async function handleDeleteFolder(id: string) {
    Alert.alert('Delete Folder', 'Delete this folder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { workspace } = getServices();
          await workspace.deleteFolder(id);
          await load();
        },
      },
    ]);
  }

  async function handleDeleteDocument(id: string) {
    Alert.alert('Delete Document', 'Remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { documents: docSvc } = getServices();
          await docSvc.deleteDocument(id);
          await load();
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-4 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" className="p-1">
            <Text className="text-primary-600 text-lg">‹</Text>
          </Pressable>
          <Text variant="h3" className="flex-1" numberOfLines={1}>{folder?.name ?? '…'}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <SyncBadge isOnline={isOnline} isSyncing={isSyncing} hasError={failedSyncCount > 0} />
          <Pressable onPress={() => setShowRename(true)} accessibilityLabel="Rename folder" className="p-2">
            <Text variant="caption" className="text-primary-600">Rename</Text>
          </Pressable>
          <Pressable onPress={() => setShowMove(true)} accessibilityLabel="Move folder" className="p-2">
            <Text variant="caption" className="text-primary-600">Move</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {subFolders.length > 0 && (
          <>
            <Text variant="label" className="mt-3 mb-1 text-surface-400">Folders</Text>
            {subFolders.map((f) => (
              <FolderRow
                key={f.id}
                folder={f}
                onPress={() => router.push(`/(app)/workspace/${f.id}`)}
                onDelete={() => handleDeleteFolder(f.id)}
              />
            ))}
          </>
        )}

        {documents.length > 0 && (
          <>
            <Text variant="label" className="mt-3 mb-1 text-surface-400">Documents</Text>
            {documents.map((d) => (
              <DocumentRow
                key={d.id}
                document={d}
                onPress={() => router.push(`/(app)/document/${d.id}`)}
                onDelete={() => handleDeleteDocument(d.id)}
              />
            ))}
          </>
        )}

        {!loading && subFolders.length === 0 && documents.length === 0 && (
          <View className="items-center py-16">
            <Text variant="caption" className="text-surface-400">This folder is empty</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB row */}
      <View className="absolute bottom-8 right-6 gap-3">
        <Pressable
          onPress={handleImport}
          accessibilityLabel="Import document"
          accessibilityRole="button"
          className="w-14 h-14 rounded-full bg-surface-700 items-center justify-center shadow-md active:opacity-80"
        >
          <Text className="text-white text-xl">↑</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowCreate(true)}
          accessibilityLabel="Create new folder"
          accessibilityRole="button"
          className="w-14 h-14 rounded-full bg-primary-600 items-center justify-center shadow-lg active:bg-primary-700"
        >
          <Text className="text-white text-2xl font-bold">+</Text>
        </Pressable>
      </View>

      <CreateFolderModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async (name) => {
          const { workspace } = getServices();
          await workspace.createFolder(name, folderId!);
          await load();
          setShowCreate(false);
        }}
      />
      <MoveFolderModal
        visible={showMove}
        movingFolderId={folderId!}
        onClose={() => setShowMove(false)}
        onMove={async (newParentId) => {
          const { workspace } = getServices();
          await workspace.moveFolder(folderId!, newParentId);
          setShowMove(false);
          router.back();
        }}
      />
      {folder && (
        <RenameFolderModal
          visible={showRename}
          currentName={folder.name}
          onClose={() => setShowRename(false)}
          onRename={async (name) => {
            const { workspace } = getServices();
            await workspace.renameFolder(folderId!, name);
            await load();
            setShowRename(false);
          }}
        />
      )}
    </View>
  );
}
