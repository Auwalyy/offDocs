import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Pressable, RefreshControl, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, SyncBadge } from '../../../src/design-system';
import { Folder } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { useApp } from '../../../src/hooks/useApp';
import { FolderRow } from '../../../src/components/FolderRow';
import { CreateFolderModal } from '../../../src/components/CreateFolderModal';

export default function WorkspaceScreen() {
  const router = useRouter();
  const { isOnline, isSyncing, failedSyncCount, triggerSync } = useApp();
  const [folders, setFolders]   = useState<Folder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const { workspace } = getServices();
    const data = await workspace.getFolders(null);
    setFolders(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateFolder(name: string) {
    const { workspace } = getServices();
    await workspace.createFolder(name, null);
    await load();
    setShowCreate(false);
  }

  async function handleDeleteFolder(id: string) {
    Alert.alert('Delete Folder', 'Delete this folder and all its contents?', [
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

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-4 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <Text variant="h2">My Workspace</Text>
        <View className="flex-row items-center gap-3">
          <SyncBadge isOnline={isOnline} isSyncing={isSyncing} hasError={failedSyncCount > 0} />
          <Pressable
            onPress={() => router.push('/(app)/sync')}
            accessibilityLabel="Sync status"
            className="p-2"
          >
            <Text variant="caption" className="text-primary-600">Sync</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            accessibilityLabel="Settings"
            className="p-2"
          >
            <Text variant="caption" className="text-primary-600">⚙</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={folders}
        keyExtractor={(f) => f.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-16">
              <Text variant="body" className="text-surface-400 mb-2">No folders yet</Text>
              <Text variant="caption" className="text-surface-400">Tap + to create your first folder</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <FolderRow
            folder={item}
            onPress={() => router.push(`/(app)/workspace/${item.id}`)}
            onDelete={() => handleDeleteFolder(item.id)}
          />
        )}
      />

      {/* FAB */}
      <Pressable
        onPress={() => setShowCreate(true)}
        accessibilityLabel="Create new folder"
        accessibilityRole="button"
        className="absolute bottom-8 right-6 w-14 h-14 rounded-full bg-primary-600 items-center justify-center shadow-lg active:bg-primary-700"
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </Pressable>

      <CreateFolderModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}
