import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Text, SyncBadge, ScreenHeader, HeaderAction } from '../../../src/design-system';
import { Document, Folder } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { useApp } from '../../../src/hooks/useApp';
import { useReloadOnChange } from '../../../src/hooks/useReloadOnChange';
import { useWorkspacePrefs } from '../../../src/hooks/useWorkspacePrefs';
import { useItemActions } from '../../../src/hooks/useItemActions';
import { FolderRow } from '../../../src/components/FolderRow';
import { DocumentRow } from '../../../src/components/DocumentRow';
import { CreateFolderModal } from '../../../src/components/CreateFolderModal';
import { Breadcrumbs } from '../../../src/components/Breadcrumbs';
import { WorkspaceToolbar } from '../../../src/components/WorkspaceToolbar';
import { ItemGrid } from '../../../src/components/ItemGrid';
import { StarButton } from '../../../src/components/StarButton';
import { SUPPORTED_MIME_TYPES } from '../../../src/features/documents/DocumentService';
import { sortDocuments, sortFolders } from '../../../src/lib/sort';
import { showError } from '../../../src/lib/alerts';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function FolderScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const router = useRouter();
  const { isOnline, isSyncing, failedSyncCount, triggerSync, notifyLocalChange } = useApp();
  const { sort, setSort, view, setView } = useWorkspacePrefs();
  const actions = useItemActions({
    onDeleted: (target) => {
      // Leave the screen of a folder that no longer exists.
      if (target.kind === 'folder' && target.folder.id === folderId) router.back();
    },
  });

  const [path, setPath]             = useState<Folder[]>([]);
  const [subFolders, setSubFolders] = useState<Folder[]>([]);
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [tagsByDoc, setTagsByDoc]   = useState<Record<string, string[]>>({});
  const [loaded, setLoaded]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const folder = path.length ? path[path.length - 1]! : null;

  const load = useCallback(async () => {
    if (!folderId) return;
    const { workspace, documents: docSvc, organization } = getServices();
    const [p, subs, docs] = await Promise.all([
      organization.getFolderPath(folderId),
      workspace.getFolders(folderId),
      docSvc.getDocuments(folderId),
    ]);
    // A deleted folder has no live row, so its path ends somewhere else.
    const current = p[p.length - 1];
    setPath(current?.id === folderId && current.deletedAt === null ? p : []);
    setSubFolders(subs);
    setDocuments(docs);
    setTagsByDoc(await organization.getTagsForDocuments(docs.map((d) => d.id)));
    setLoaded(true);
  }, [folderId]);

  useReloadOnChange(load);

  // Count a visit once per time the screen is shown, not on every data reload.
  useFocusEffect(
    useCallback(() => {
      if (!folderId) return;
      getServices().recent.record('folder', folderId, 'opened')
        .catch((err: unknown) => console.warn('Could not record recent folder:', err));
    }, [folderId])
  );

  const sortedFolders = useMemo(() => sortFolders(subFolders, sort), [subFolders, sort]);
  const sortedDocs    = useMemo(() => sortDocuments(documents, sort), [documents, sort]);
  const columns = view === 'grid' ? 2 : 1;

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

  function navigateToFolder(id: string) {
    // Go back to that folder's screen if it is already in the stack.
    router.dismissTo(`/(app)/workspace/${id}`);
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
              <>
                <StarButton active={folder.isFavorite} name={folder.name} onPress={() => actions.toggleFolderFavorite(folder)} />
                <HeaderAction label="⋯" onPress={() => actions.openFolderOptions(folder)} accessibilityLabel="Folder options" />
              </>
            ) : null}
          </>
        }
      />
      {path.length > 0 ? (
        <Breadcrumbs path={path} onNavigateRoot={() => router.dismissTo('/(app)/workspace')} onNavigate={navigateToFolder} />
      ) : null}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 180, gap: 8 }}
      >
        {!isEmpty && loaded ? (
          <WorkspaceToolbar
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={setView}
            summary={[
              subFolders.length ? plural(subFolders.length, 'folder') : null,
              documents.length ? plural(documents.length, 'document') : null,
            ].filter(Boolean).join(' · ')}
          />
        ) : null}

        {sortedFolders.length > 0 && (
          <>
            <Text variant="label" className="mt-1 mb-1 text-surface-400 uppercase text-xs tracking-wide">
              Folders · {sortedFolders.length}
            </Text>
            <ItemGrid
              items={sortedFolders}
              columns={columns}
              keyOf={(f) => f.id}
              renderItem={(f) => (
                <FolderRow
                  folder={f}
                  layout={view}
                  onPress={() => router.push(`/(app)/workspace/${f.id}`)}
                  onOptions={() => actions.openFolderOptions(f)}
                  onToggleFavorite={() => actions.toggleFolderFavorite(f)}
                />
              )}
            />
          </>
        )}

        {sortedDocs.length > 0 && (
          <>
            <Text variant="label" className="mt-3 mb-1 text-surface-400 uppercase text-xs tracking-wide">
              Documents · {sortedDocs.length}
            </Text>
            <ItemGrid
              items={sortedDocs}
              columns={columns}
              keyOf={(d) => d.id}
              renderItem={(d) => (
                <DocumentRow
                  document={d}
                  layout={view}
                  tags={tagsByDoc[d.id]}
                  onPress={() => router.push(`/(app)/document/${d.id}`)}
                  onOptions={() => actions.openDocumentOptions(d)}
                  onToggleFavorite={() => actions.toggleDocumentFavorite(d)}
                />
              )}
            />
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
      {actions.modals}
    </View>
  );
}
