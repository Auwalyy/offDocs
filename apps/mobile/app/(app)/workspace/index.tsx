import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, SyncBadge, ScreenHeader, HeaderAction } from '../../../src/design-system';
import { Folder, RecentItem } from '../../../src/types';
import { getServices } from '../../../src/lib/ServiceRegistry';
import { useApp } from '../../../src/hooks/useApp';
import { useReloadOnChange } from '../../../src/hooks/useReloadOnChange';
import { useWorkspacePrefs } from '../../../src/hooks/useWorkspacePrefs';
import { useItemActions } from '../../../src/hooks/useItemActions';
import { FolderRow } from '../../../src/components/FolderRow';
import { CreateFolderModal } from '../../../src/components/CreateFolderModal';
import { WorkspaceToolbar } from '../../../src/components/WorkspaceToolbar';
import { RecentStrip } from '../../../src/components/RecentStrip';
import { sortFolders } from '../../../src/lib/sort';
import { GRID_SPACER, withGridSpacer } from '../../../src/lib/grid';

const RECENT_PREVIEW = 6;

function QuickLink({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 flex-row items-center gap-2 bg-white dark:bg-surface-800 rounded-lg px-3 min-h-[48px] border border-surface-100 dark:border-surface-800 active:opacity-80"
    >
      <Text className="text-lg">{icon}</Text>
      <Text variant="label" className="text-surface-800 dark:text-surface-100">{label}</Text>
    </Pressable>
  );
}

export default function WorkspaceScreen() {
  const router = useRouter();
  const { user, isOnline, isSyncing, failedSyncCount, triggerSync, notifyLocalChange } = useApp();
  const { sort, setSort, view, setView } = useWorkspacePrefs();
  const actions = useItemActions();
  const [folders, setFolders]       = useState<Folder[]>([]);
  const [recent, setRecent]         = useState<RecentItem[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const services = getServices();
    const [root, recentItems] = await Promise.all([
      services.workspace.getFolders(null),
      services.recent.list({ limit: RECENT_PREVIEW }),
    ]);
    setFolders(root);
    setRecent(recentItems);
    setLoaded(true);
  }, []);

  useReloadOnChange(load);

  const sorted = useMemo(() => sortFolders(folders, sort), [folders, sort]);
  // FlatList needs a new key to change its column count.
  const numColumns = view === 'grid' ? 2 : 1;

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

  const header = (
    <View className="gap-4 mb-2">
      <Pressable
        onPress={() => router.push('/(app)/search')}
        accessibilityRole="search"
        accessibilityLabel="Search folders, documents and tags"
        className="flex-row items-center gap-2 bg-white dark:bg-surface-800 rounded-md px-4 min-h-[48px] border border-surface-200 dark:border-surface-700"
      >
        <Text className="text-surface-400">🔍</Text>
        <Text variant="body" className="text-surface-400">Search folders, documents, tags…</Text>
      </Pressable>

      <View className="flex-row gap-3">
        <QuickLink icon="★" label="Favorites" onPress={() => router.push('/(app)/favorites')} />
        <QuickLink icon="🕘" label="Recent" onPress={() => router.push('/(app)/recent')} />
      </View>

      {recent.length > 0 ? (
        <RecentStrip items={recent} onSeeAll={() => router.push('/(app)/recent')} />
      ) : null}

      <WorkspaceToolbar
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
        summary={user ? `Hi ${user.displayName.split(' ')[0]} — ${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}` : undefined}
      />
    </View>
  );

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
        key={`cols-${numColumns}`}
        data={withGridSpacer(sorted, numColumns)}
        numColumns={numColumns}
        keyExtractor={(f) => (f === GRID_SPACER ? 'grid-spacer' : f.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 112, gap: 8 }}
        columnWrapperStyle={numColumns > 1 ? { gap: 8 } : undefined}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loaded ? (
            <View className="items-center py-16 gap-2">
              <Text className="text-5xl">📂</Text>
              <Text variant="h3">No folders yet</Text>
              <Text variant="caption" className="text-center">
                Create a folder to start organising your documents.{'\n'}Everything works offline.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          item === GRID_SPACER ? (
            <View className="flex-1" />
          ) : (
            <View className={numColumns > 1 ? 'flex-1' : undefined}>
              <FolderRow
                folder={item}
                layout={view}
                onPress={() => router.push(`/(app)/workspace/${item.id}`)}
                onOptions={() => actions.openFolderOptions(item)}
                onToggleFavorite={() => actions.toggleFolderFavorite(item)}
              />
            </View>
          )
        }
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
      {actions.modals}
    </View>
  );
}
