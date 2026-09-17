import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Text, SyncBadge, ScreenHeader, HeaderAction } from '../../../src/design-system';
import { Document, Folder } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { useApp } from '../../../src/hooks/useApp';
import { useReloadOnChange } from '../../../src/hooks/useReloadOnChange';
import { FolderRow } from '../../../src/components/FolderRow';
import { DocumentRow } from '../../../src/components/DocumentRow';
import { CreateFolderModal } from '../../../src/components/CreateFolderModal';
import { RenameFolderModal } from '../../../src/components/RenameFolderModal';
import { MoveFolderModal } from '../../../src/components/MoveFolderModal';
import { SUPPORTED_MIME_TYPES } from '../../../src/features/documents/DocumentService';
import { confirmDelete, showError } from '../../../src/lib/alerts';

export default function FolderScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const router = useRouter();
  const { isOnline, isSyncing, failedSyncCount, triggerSync, notifyLocalChange } = useApp();

  const [folder, setFolder]         = useState<Folder | null>(null);
  const [subFolders, setSubFolders] = useState<Folder[]>([]);
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting]   = useState(false);
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
    setLoaded(true);
  }, [folderId]);

  useReloadOnChange(load);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await triggerSync();
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleImport() {
    if (!folderId || importing) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...SUPPORTED_MIME_TYPES],
        // On Android the picker's cache copy lives outside the app's file-system
        // sandbox (unreadable in Expo Go). A content:// URI is always readable,
        // so copy straight from it instead.
        copyToCacheDirectory: Platform.OS !== 'android',
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;

      setImporting(true);
      const { documents: docSvc } = getServices();
      for (const asset of result.assets) {
        await docSvc.importDocument({
          sourceUri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          fileSize: asset.size ?? 0,
          folderId,
        });
      }
      notifyLocalChange();
    } catch (e) {
      showError('Import failed', e);
    } finally {
      setImporting(false);
    }
  }

  function handleDeleteFolder(target: Folder) {
    confirmDelete('Delete folder', `Delete “${target.name}” and everything inside it?`, async () => {
      try {
        await getServices().workspace.deleteFolder(target.id);
        if (target.id === folderId) router.back();
        notifyLocalChange();
      } catch (e) {
        showError('Could not delete folder', e);
      }
    });
  }

  function openFolderMenu(target: Folder) {
    // Android alerts show at most three buttons, so Cancel is only added on iOS
    // (Android dismisses on outside tap).
    Alert.alert(
      target.name,
      undefined,
      [
        { text: 'Rename', onPress: () => setShowRename(true) },
        { text: 'Move', onPress: () => setShowMove(true) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteFolder(target) },
        ...(Platform.OS === 'ios' ? [{ text: 'Cancel', style: 'cancel' as const }] : []),
      ],
      { cancelable: true }
    );
  }

  function handleDeleteDocument(doc: Document) {
    confirmDelete('Delete document', `Remove “${doc.name}”?`, async () => {
      try {
        await getServices().documents.deleteDocument(doc.id);
        notifyLocalChange();
      } catch (e) {
        showError('Could not delete document', e);
      }
    });
  }

  if (loaded && !folder) {
    return (
      <View className="flex-1 bg-surface-50 dark:bg-surface-950">
        <ScreenHeader title="Folder" />
        <View className="flex-1 items-center justify-center px-8 gap-2">
          <Text variant="h3">Folder not found</Text>
          <Text variant="caption" className="text-center">It may have been deleted.</Text>
        </View>
      </View>
    );
  }

  const isEmpty = loaded && subFolders.length === 0 && documents.length === 0;

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader
        title={folder?.name ?? ''}
        right={
          <>
            <SyncBadge
              isOnline={isOnline}
              isSyncing={isSyncing}
              hasError={failedSyncCount > 0}
              onPress={() => router.push('/(app)/sync')}
            />
            {folder ? (
              <HeaderAction label="Edit" onPress={() => openFolderMenu(folder)} accessibilityLabel="Folder options" />
            ) : null}
          </>
        }
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 180, gap: 8 }}
      >
        {subFolders.length > 0 && (
          <>
            <Text variant="label" className="mt-3 mb-1 text-surface-400 uppercase text-xs tracking-wide">
              Folders · {subFolders.length}
            </Text>
            {subFolders.map((f) => (
              <FolderRow
                key={f.id}
                folder={f}
                onPress={() => router.push(`/(app)/workspace/${f.id}`)}
                onDelete={() => handleDeleteFolder(f)}
              />
            ))}
          </>
        )}

        {documents.length > 0 && (
          <>
            <Text variant="label" className="mt-3 mb-1 text-surface-400 uppercase text-xs tracking-wide">
              Documents · {documents.length}
            </Text>
            {documents.map((d) => (
              <DocumentRow
                key={d.id}
                document={d}
                onPress={() => router.push(`/(app)/document/${d.id}`)}
                onDelete={() => handleDeleteDocument(d)}
              />
            ))}
          </>
        )}

        {isEmpty && (
          <View className="items-center py-20 gap-2">
            <Text className="text-5xl">🗂️</Text>
            <Text variant="h3">This folder is empty</Text>
            <Text variant="caption" className="text-center">Import a PDF or DOCX, or add a subfolder.</Text>
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-8 right-6 items-end gap-3">
        <Pressable
          onPress={handleImport}
          disabled={importing}
          accessibilityLabel="Import document"
          accessibilityRole="button"
          className="flex-row items-center gap-2 h-12 px-4 rounded-full bg-surface-700 shadow-md active:opacity-80"
        >
          {importing ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-lg">↑</Text>}
          <Text className="text-white font-medium">{importing ? 'Importing…' : 'Import'}</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowCreate(true)}
          accessibilityLabel="Create new folder"
          accessibilityRole="button"
          className="flex-row items-center gap-2 h-14 px-5 rounded-full bg-primary-600 shadow-lg active:bg-primary-700"
        >
          <Text className="text-white text-2xl leading-7">+</Text>
          <Text className="text-white font-semibold">New folder</Text>
        </Pressable>
      </View>

      <CreateFolderModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async (name) => {
          await getServices().workspace.createFolder(name, folderId!);
          setShowCreate(false);
          notifyLocalChange();
        }}
      />
      {folder && (
        <MoveFolderModal
          visible={showMove}
          folder={folder}
          onClose={() => setShowMove(false)}
          onMove={async (newParentId) => {
            await getServices().workspace.moveFolder(folder.id, newParentId);
            setShowMove(false);
            notifyLocalChange();
          }}
        />
      )}
      {folder && (
        <RenameFolderModal
          visible={showRename}
          currentName={folder.name}
          onClose={() => setShowRename(false)}
          onRename={async (name) => {
            await getServices().workspace.renameFolder(folder.id, name);
            setShowRename(false);
            notifyLocalChange();
          }}
        />
      )}
    </View>
  );
}
