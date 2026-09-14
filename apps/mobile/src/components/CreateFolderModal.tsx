import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Text, Input, Button } from '../design-system';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateFolderModal({ visible, onClose, onCreate }: Props) {
  const [name, setName]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { setError('Folder name is required.'); return; }
    setError('');
    setLoading(true);
    try {
      await onCreate(name.trim());
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create folder.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setName('');
    setError('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        className="flex-1 bg-black/50 justify-center px-6"
        onPress={handleClose}
        accessibilityLabel="Close modal"
      >
        <Pressable
          className="bg-white dark:bg-surface-800 rounded-xl p-6 gap-4"
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="h3">New Folder</Text>
          <Input
            label="Folder name"
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="e.g. Lecture Notes"
            error={error}
            onSubmitEditing={handleCreate}
          />
          <View className="flex-row gap-3">
            <Button label="Cancel" variant="ghost" onPress={handleClose} className="flex-1" />
            <Button label="Create" onPress={handleCreate} loading={loading} className="flex-1" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
