import React, { useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../design-system';

export interface SheetOption {
  label: string;
  icon?: string;
  destructive?: boolean;
  /** Shows a check mark (for single-choice lists such as sorting). */
  selected?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  options: SheetOption[];
  onClose: () => void;
}

/**
 * Bottom sheet of actions. Used instead of Alert because Android alerts show
 * at most three buttons.
 */
export function OptionsSheet({ visible, title, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // iOS cannot present a modal (e.g. Rename) while this one is still closing,
  // so the chosen action runs from onDismiss there.
  const pendingAction = useRef<(() => void) | null>(null);

  function choose(option: SheetOption) {
    onClose();
    if (Platform.OS === 'ios') pendingAction.current = option.onPress;
    else option.onPress();
  }

  function runPending() {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={runPending}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose} accessibilityLabel="Close menu">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-white dark:bg-surface-900 rounded-t-xl pt-2 max-h-[80%]"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="self-center w-10 h-1 rounded-full bg-surface-300 dark:bg-surface-700 mb-2" />
          {title ? (
            <Text variant="label" numberOfLines={1} className="px-5 pb-2 text-surface-400">{title}</Text>
          ) : null}
          <ScrollView>
            {options.map((option) => (
              <Pressable
                key={option.label}
                onPress={() => choose(option)}
                accessibilityRole="button"
                accessibilityState={option.selected !== undefined ? { selected: option.selected } : undefined}
                className="flex-row items-center px-5 min-h-[52px] active:bg-surface-100 dark:active:bg-surface-800"
              >
                {option.icon ? <Text className="text-xl w-9">{option.icon}</Text> : null}
                <Text
                  variant="body"
                  className={`flex-1 ${option.destructive ? 'text-error' : ''} ${option.selected ? 'font-semibold' : ''}`}
                >
                  {option.label}
                </Text>
                {option.selected ? <Text className="text-primary-600 dark:text-primary-400 text-lg">✓</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
