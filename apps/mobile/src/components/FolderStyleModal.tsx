import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Text, Button } from '../design-system';
import { Folder } from '../types';
import { FOLDER_COLORS, FOLDER_ICONS, tint } from '../lib/folderStyle';
import { FolderIcon } from './FolderIcon';
import { errorMessage } from '../lib/alerts';

interface Props {
  visible: boolean;
  folder: Folder | null;
  onClose: () => void;
  onSave: (style: { color: string | null; icon: string | null }) => Promise<void>;
}

export function FolderStyleModal({ visible, folder, onClose, onSave }: Props) {
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon]   = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && folder) {
      setColor(folder.color);
      setIcon(folder.icon);
      setError('');
    }
  }, [visible, folder]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ color, icon });
    } catch (e) {
      setError(errorMessage(e, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-center px-6" onPress={onClose} accessibilityLabel="Close">
        <Pressable className="bg-white dark:bg-surface-800 rounded-xl p-6 gap-4" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center gap-3">
            <FolderIcon color={color} icon={icon} size="lg" />
            <View className="flex-1">
              <Text variant="h3">Customize folder</Text>
              <Text variant="caption" numberOfLines={1}>{folder?.name}</Text>
            </View>
          </View>

          <Text variant="label">Colour</Text>
          <View className="flex-row flex-wrap gap-3">
            <Pressable
              onPress={() => setColor(null)}
              accessibilityRole="button"
              accessibilityLabel="Default colour"
              accessibilityState={{ selected: color === null }}
              className={`w-9 h-9 rounded-full items-center justify-center border-2 ${color === null ? 'border-primary-600' : 'border-surface-200 dark:border-surface-600'}`}
            >
              <Text className="text-xs text-surface-500">Auto</Text>
            </Pressable>
            {FOLDER_COLORS.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setColor(c.value)}
                accessibilityRole="button"
                accessibilityLabel={`${c.name} colour`}
                accessibilityState={{ selected: color === c.value }}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: c.value, borderWidth: color === c.value ? 3 : 0, borderColor: tint(c.value, '66') }}
              >
                {color === c.value ? <Text className="text-white font-bold">✓</Text> : null}
              </Pressable>
            ))}
          </View>

          <Text variant="label">Icon</Text>
          <View className="flex-row flex-wrap gap-2">
            {FOLDER_ICONS.map((i) => {
              const selected = (icon ?? '📁') === i.value;
              return (
                <Pressable
                  key={i.value}
                  onPress={() => setIcon(i.value === '📁' ? null : i.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${i.name} icon`}
                  accessibilityState={{ selected }}
                  className={`w-11 h-11 rounded-md items-center justify-center border ${selected ? 'border-primary-600 bg-primary-50 dark:bg-primary-900' : 'border-surface-200 dark:border-surface-700'}`}
                >
                  <Text className="text-xl">{i.value}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text variant="caption" className="text-error">{error}</Text> : null}
          <View className="flex-row gap-3">
            <Button label="Cancel" variant="ghost" onPress={onClose} className="flex-1" />
            <Button label="Save" onPress={handleSave} loading={saving} className="flex-1" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
