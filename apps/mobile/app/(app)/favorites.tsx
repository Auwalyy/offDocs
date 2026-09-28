import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, ScreenHeader } from '../../src/design-system';
import { Document, Folder } from '../../src/types';
import { getServices } from '../../src/lib/ServiceRegistry';
import { useReloadOnChange } from '../../src/hooks/useReloadOnChange';
import { useItemActions } from '../../src/hooks/useItemActions';
import { FolderRow } from '../../src/components/FolderRow';
import { DocumentRow } from '../../src/components/DocumentRow';

export default function FavoritesScreen() {
  const router = useRouter();
  const actions = useItemActions();
  const [folders, setFolders]     = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tagsByDoc, setTagsByDoc] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded]       = useState(false);

  const load = useCallback(async () => {
    const { organization } = getServices();
    const favorites = await organization.getFavorites();
    setFolders(favorites.folders);
    setDocuments(favorites.documents);
    setTagsByDoc(await organization.getTagsForDocuments(favorites.documents.map((d) => d.id)));
    setLoaded(true);
  }, []);

  useReloadOnChange(load);

  const isEmpty = loaded && folders.length === 0 && documents.length === 0;

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader title="Favorites" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {folders.length > 0 && (
          <>
            <Text variant="label" className="mb-1 uppercase text-xs tracking-wide text-surface-400">Folders · {folders.length}</Text>
            {folders.map((f) => (
              <FolderRow
                key={f.id}
                folder={f}
                onPress={() => router.push(`/(app)/workspace/${f.id}`)}
                onOptions={() => actions.openFolderOptions(f)}
                onToggleFavorite={() => actions.toggleFolderFavorite(f)}
              />
            ))}
          </>
        )}
        {documents.length > 0 && (
          <>
            <Text variant="label" className="mt-3 mb-1 uppercase text-xs tracking-wide text-surface-400">Documents · {documents.length}</Text>
            {documents.map((d) => (
              <DocumentRow
                key={d.id}
                document={d}
                tags={tagsByDoc[d.id]}
                onPress={() => router.push(`/(app)/document/${d.id}`)}
                onOptions={() => actions.openDocumentOptions(d)}
                onToggleFavorite={() => actions.toggleDocumentFavorite(d)}
              />
            ))}
          </>
        )}
        {isEmpty && (
          <View className="items-center py-20 gap-2">
            <Text className="text-5xl">☆</Text>
            <Text variant="h3">No favorites yet</Text>
            <Text variant="caption" className="text-center">
              Tap the ☆ on any folder or document to keep it here for quick access.
            </Text>
          </View>
        )}
      </ScrollView>
      {actions.modals}
    </View>
  );
}
