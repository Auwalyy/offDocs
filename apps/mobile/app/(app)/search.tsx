import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Chip, ScreenHeader } from '../../src/design-system';
import { DocumentHit, Folder, SearchFilter, SearchResults } from '../../src/types';
import { getServices } from '../../src/lib/ServiceRegistry';
import { useApp } from '../../src/hooks/useApp';
import { useItemActions } from '../../src/hooks/useItemActions';
import { FolderRow } from '../../src/components/FolderRow';
import { DocumentRow } from '../../src/components/DocumentRow';
import { fileTypeLabel } from '../../src/lib/sort';

const DEBOUNCE_MS = 250;

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'folders',   label: 'Folders' },
  { value: 'documents', label: 'Documents' },
  { value: 'favorites', label: '★ Favorites' },
  { value: 'recent',    label: 'Recent' },
];

type Row =
  | { type: 'header'; key: string; label: string }
  | { type: 'folder'; key: string; folder: Folder }
  | { type: 'document'; key: string; document: DocumentHit };

function toRows(results: SearchResults): Row[] {
  const rows: Row[] = [];
  if (results.folders.length) {
    rows.push({ type: 'header', key: 'h-folders', label: `Folders · ${results.folders.length}` });
    for (const f of results.folders) rows.push({ type: 'folder', key: `f-${f.id}`, folder: f });
  }
  if (results.documents.length) {
    rows.push({ type: 'header', key: 'h-docs', label: `Documents · ${results.documents.length}` });
    for (const d of results.documents) rows.push({ type: 'document', key: `d-${d.id}`, document: d });
  }
  return rows;
}

export default function SearchScreen() {
  const router = useRouter();
  const { dataVersion } = useApp();
  const actions = useItemActions();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery]     = useState('');
  const [filter, setFilter]   = useState<SearchFilter>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  // Ignores results of a search that finished after a newer one started.
  const requestId = useRef(0);

  const loadHistory = useCallback(() => {
    getServices().search.getHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(loadHistory, [loadHistory]);

  // Debounced search; also re-runs when local data changes (a sync or an edit).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      getServices().search.search(q, filter)
        .then((r) => {
          if (id === requestId.current) setResults(r);
        })
        .catch((err: unknown) => console.warn('Search failed:', err));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, filter, dataVersion]);

  /** Remember a query once the user acts on it, not on every keystroke. */
  function remember() {
    const q = query.trim();
    if (!q) return;
    getServices().search.addToHistory(q).then(loadHistory).catch(() => undefined);
  }

  function clear() {
    setQuery('');
    setResults(null);
    inputRef.current?.focus();
  }

  const rows = results ? toRows(results) : [];
  const q = query.trim();

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-950">
      <ScreenHeader title="Search" />

      <View className="px-4 pt-3 pb-2 gap-3 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <View className="flex-row items-center rounded-md border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 pl-3">
          <Text className="text-surface-400">🔍</Text>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={remember}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder="Folders, documents, tags, PDF…"
            placeholderTextColor="#94A3B8"
            accessibilityLabel="Search"
            className="flex-1 min-h-[48px] px-2 text-base text-surface-900 dark:text-surface-50"
          />
          {query ? (
            <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} className="w-11 h-11 items-center justify-center">
              <Text className="text-surface-400 text-lg">✕</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>

      {!q ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
          {history.length ? (
            <>
              <View className="flex-row items-center justify-between">
                <Text variant="label" className="uppercase text-xs tracking-wide text-surface-400">Recent searches</Text>
                <Pressable
                  onPress={() => getServices().search.clearHistory().then(loadHistory).catch(() => undefined)}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search history"
                  hitSlop={8}
                >
                  <Text variant="caption" className="text-primary-600 dark:text-primary-400">Clear</Text>
                </Pressable>
              </View>
              {history.map((h) => (
                <View key={h} className="flex-row items-center bg-white dark:bg-surface-800 rounded-lg border border-surface-100 dark:border-surface-800">
                  <Pressable
                    onPress={() => setQuery(h)}
                    accessibilityRole="button"
                    accessibilityLabel={`Search for ${h}`}
                    className="flex-1 flex-row items-center gap-3 px-4 min-h-[48px]"
                  >
                    <Text className="text-surface-400">🕘</Text>
                    <Text variant="body" numberOfLines={1} className="flex-1">{h}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => getServices().search.removeFromHistory(h).then(loadHistory).catch(() => undefined)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${h} from history`}
                    hitSlop={8}
                    className="w-11 h-11 items-center justify-center"
                  >
                    <Text className="text-surface-400">✕</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : (
            <View className="items-center py-16 gap-2">
              <Text className="text-5xl">🔍</Text>
              <Text variant="h3">Search your workspace</Text>
              <Text variant="caption" className="text-center">
                Find folders, documents and tags by name, or type “pdf” or “docx”.{'\n'}Works offline.
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            results ? (
              <View className="items-center py-16 gap-2">
                <Text className="text-5xl">🤷</Text>
                <Text variant="h3">No results</Text>
                <Text variant="caption" className="text-center">
                  Nothing matches “{q}”{filter !== 'all' ? ' with this filter' : ''}.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text variant="label" className="mt-2 uppercase text-xs tracking-wide text-surface-400">{item.label}</Text>;
            }
            if (item.type === 'folder') {
              return (
                <FolderRow
                  folder={item.folder}
                  query={q}
                  onPress={() => {
                    remember();
                    router.push(`/(app)/workspace/${item.folder.id}`);
                  }}
                  onOptions={() => actions.openFolderOptions(item.folder)}
                  onToggleFavorite={() => actions.toggleFolderFavorite(item.folder)}
                />
              );
            }
            const d = item.document;
            return (
              <DocumentRow
                document={d}
                query={q}
                tags={d.tags}
                subtitle={[fileTypeLabel(d.mimeType), d.folderName ? `in ${d.folderName}` : null].filter(Boolean).join(' · ')}
                onPress={() => {
                  remember();
                  router.push(`/(app)/document/${d.id}`);
                }}
                onOptions={() => actions.openDocumentOptions(d)}
                onToggleFavorite={() => actions.toggleDocumentFavorite(d)}
              />
            );
          }}
        />
      )}
      {actions.modals}
    </View>
  );
}
