import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { Text, Button } from '../design-system';
import { Folder } from '../types';
import { getServices } from '../lib/ServiceRegistry';

interface Props {
  visible: boolean;
  movingFolderId: string;
  onClose: () => void;
  onMove: (newParentId: string | null) => Promise<void>;
}

export function MoveFolderModal({ visible, movingFolderId, onClose, onMove }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { workspace } = getServices();
    // Load root folders; exclude the folder being moved
    const all = await workspace.getFolders(null);
    setFolders(all.filter((f) => f.id !== movingFolderId));
  }, [movingFolderId]);

  useEffect(() => {
    if (visible) {
      setSelected(undefined);
      setError('');
      load();
    }
  }, [visible, load]);

  async function handleMove() {
    if (selected === undefined) {
      setError('Select a destination or choose Root.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onMove(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Move failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/50 justify-center px-6"
        onPress={onClose}
        accessibilityLabel="Close modal"
      >
        <Pressable
          className="bg-white dark:bg-surface-800 rounded-xl p-6 gap-4 max-h-[70%]"
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="h3">Move Folder</Text>
          <Text variant="caption" className="text-surface-400">Select destination:</Text>

          {/* Root option */}
          <Pressable
            onPress={() => setSelected(null)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === null }}
            className={`flex-row items-center px-3 py-3 rounded-lg border ${
              selected === null
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-surface-200 dark:border-surface-700'
            }`}
          >
            <Text className="text-lg mr-2">🏠</Text>
            <Text variant="body">Root (top level)</Text>
          </Pressable>

          <FlatList
            data={folders}
            keyExtractor={(f) => f.id}
            style={{ maxHeight: 200 }}
            contentContainerStyle={{ gap: 6 }}
            ListEmptyComponent={
              <Text variant="caption" className="text-surface-400 text-center py-4">
                No other folders available
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelected(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === item.id }}
                className={`flex-row items-center px-3 py-3 rounded-lg border ${
                  selected === item.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-200 dark:border-surface-700'
                }`}
              >
                <Text className="text-lg mr-2">📁</Text>
                <Text variant="body" className="flex-1" numberOfLines={1}>{item.name}</Text>
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
