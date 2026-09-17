import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, SyncBadge, ScreenHeader, HeaderAction } from '../../../src/design-system';
import { Folder } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { useApp } from '../../../src/hooks/useApp';
import { useReloadOnChange } from '../../../src/hooks/useReloadOnChange';
import { FolderRow } from '../../../src/components/FolderRow';
import { CreateFolderModal } from '../../../src/components/CreateFolderModal';
import { confirmDelete, showError } from '../../../src/lib/alerts';

export default function WorkspaceScreen() {
  const router = useRouter();
  const { user, isOnline, isSyncing, failedSyncCount, triggerSync, notifyLocalChange } = useApp();
  const [folders, setFolders]       = useState<Folder[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setFolders(await getServices().workspace.getFolders(null));
    setLoaded(true);
  }, []);

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

  async function handleCreateFolder(name: string) {
    await getServices().workspace.createFolder(name, null);
    setShowCreate(false);
    notifyLocalChange();
  }

  function handleDeleteFolder(folder: Folder) {
    confirmDelete(
      'Delete folder',
      `Delete “${folder.name}” and everything inside it?`,
      async () => {
        try {
          await getServices().workspace.deleteFolder(folder.id);
          notifyLocalChange();
        } catch (e) {
          showError('Could not delete folder', e);
        }
      }
    );
  }

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader
        title="My Workspace"
        showBack={false}
        right={
          <>
            <SyncBadge
              isOnline={isOnline}
              isSyncing={isSyncing}
              hasError={failedSyncCount > 0}
              onPress={() => router.push('/(app)/sync')}
            />
            <HeaderAction label="⚙" accessibilityLabel="Settings" onPress={() => router.push('/(app)/settings')} />
          </>
        }
      />

      <FlatList
        data={folders}
        keyExtractor={(f) => f.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 112, gap: 8 }}
        ListHeaderComponent={
          user ? (
            <Text variant="caption" className="mb-2">
              Hi {user.displayName.split(' ')[0]} — {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          loaded ? (
            <View className="items-center py-20 gap-2">
              <Text className="text-5xl">📂</Text>
              <Text variant="h3">No folders yet</Text>
              <Text variant="caption" className="text-center">
                Create a folder to start organising your documents.{'\n'}Everything works offline.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <FolderRow
            folder={item}
            onPress={() => router.push(`/(app)/workspace/${item.id}`)}
            onDelete={() => handleDeleteFolder(item)}
          />
        )}
      />

      <Pressable
        onPress={() => setShowCreate(true)}
        accessibilityLabel="Create new folder"
        accessibilityRole="button"
        className="absolute bottom-8 right-6 flex-row items-center gap-2 h-14 px-5 rounded-full bg-primary-600 shadow-lg active:bg-primary-700"
      >
        <Text className="text-white text-2xl leading-7">+</Text>
        <Text className="text-white font-semibold">New folder</Text>
      </Pressable>

      <CreateFolderModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}
