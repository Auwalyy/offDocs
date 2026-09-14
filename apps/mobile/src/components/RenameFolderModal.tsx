import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Text, Input, Button } from '../design-system';

interface Props {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}

export function RenameFolderModal({ visible, currentName, onClose, onRename }: Props) {
  const [name, setName]     = useState(currentName);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setName(currentName); }, [currentName]);

  async function handleRename() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (name.trim() === currentName) { onClose(); return; }
    setError('');
    setLoading(true);
    try {
      await onRename(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename.');
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
          className="bg-white dark:bg-surface-800 rounded-xl p-6 gap-4"
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="h3">Rename Folder</Text>
          <Input
            label="New name"
            value={name}
            onChangeText={setName}
            autoFocus
            error={error}
            onSubmitEditing={handleRename}
          />
          <View className="flex-row gap-3">
            <Button label="Cancel" variant="ghost" onPress={onClose} className="flex-1" />
            <Button label="Rename" onPress={handleRename} loading={loading} className="flex-1" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
