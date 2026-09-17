import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { Text, Button } from '../design-system';
import { Folder } from '../types';
import { getServices } from '../lib/ServiceRegistry';
import { errorMessage } from '../lib/alerts';

interface Props {
  visible: boolean;
  folder: Folder;
  onClose: () => void;
  onMove: (newParentId: string | null) => Promise<void>;
}

interface Destination {
  id: string;
  path: string;
}

/** Every folder except the one being moved, its descendants, and its current parent. */
function buildDestinations(all: Folder[], moving: Folder): Destination[] {
  const byId = new Map(all.map((f) => [f.id, f]));
  const pathOf = (f: Folder): string[] => {
    const parts: string[] = [];
    let current: Folder | undefined = f;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return parts;
  };
  const isInsideMoving = (f: Folder): boolean => {
    let current: Folder | undefined = f;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      if (current.id === moving.id) return true;
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };

  return all
    .filter((f) => !isInsideMoving(f) && f.id !== moving.parentId)
    .map((f) => ({ id: f.id, path: pathOf(f).join(' / ') }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function MoveFolderModal({ visible, folder, onClose, onMove }: Props) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const all = await getServices().workspace.getAllFolders();
    setDestinations(buildDestinations(all, folder));
  }, [folder]);

  useEffect(() => {
    if (visible) {
      setSelected(undefined);
      setError('');
      load().catch((e: unknown) => setError(errorMessage(e)));
    }
  }, [visible, load]);

  async function handleMove() {
    if (selected === undefined) {
      setError('Choose a destination.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onMove(selected);
    } catch (e) {
      setError(errorMessage(e, 'Move failed.'));
    } finally {
      setLoading(false);
    }
  }

  const optionClass = (isSelected: boolean) =>
    `flex-row items-center px-3 py-3 rounded-md border ${
      isSelected
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
        : 'border-surface-200 dark:border-surface-700'
    }`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-center px-6" onPress={onClose} accessibilityLabel="Close">
        <Pressable
          className="bg-white dark:bg-surface-800 rounded-xl p-6 gap-4 max-h-[75%]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="gap-1">
            <Text variant="h3">Move “{folder.name}”</Text>
            <Text variant="caption">Choose where to move this folder.</Text>
          </View>

          {folder.parentId !== null && (
            <Pressable
              onPress={() => setSelected(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === null }}
              className={optionClass(selected === null)}
            >
              <Text className="text-lg mr-2">🏠</Text>
              <Text variant="body">Top level</Text>
            </Pressable>
          )}

          <FlatList
            data={destinations}
            keyExtractor={(d) => d.id}
            style={{ maxHeight: 260 }}
            contentContainerStyle={{ gap: 6 }}
            ListEmptyComponent={
              <Text variant="caption" className="text-center py-4">No other folders available</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelected(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === item.id }}
                className={optionClass(selected === item.id)}
              >
                <Text className="text-lg mr-2">📁</Text>
                <Text variant="body" className="flex-1" numberOfLines={1}>{item.path}</Text>
              </Pressable>
            )}
          />

          {error ? <Text variant="caption" className="text-error">{error}</Text> : null}

          <View className="flex-row gap-3">
            <Button label="Cancel" variant="ghost" onPress={onClose} className="flex-1" />
            <Button label="Move" onPress={handleMove} loading={loading} className="flex-1" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
