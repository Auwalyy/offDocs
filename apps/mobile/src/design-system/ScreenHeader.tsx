import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';

interface Props {
  title: string;
  /** Show a back button (default true). */
  showBack?: boolean;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, showBack = true, right }: Props) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
      <View className="flex-row items-center gap-2 flex-1 mr-2">
        {showBack ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/workspace'))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            className="pr-2 py-1"
          >
            <Text className="text-primary-600 dark:text-primary-400 text-3xl leading-8">‹</Text>
          </Pressable>
        ) : null}
        <Text variant="h2" numberOfLines={1} className="flex-1">{title}</Text>
      </View>
      {right ? <View className="flex-row items-center gap-1">{right}</View> : null}
    </View>
  );
}

interface HeaderActionProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function HeaderAction({ label, onPress, accessibilityLabel }: HeaderActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      className="px-2 py-1.5 rounded-md active:bg-surface-100 dark:active:bg-surface-800"
    >
      <Text variant="label" className="text-primary-600 dark:text-primary-400">{label}</Text>
    </Pressable>
  );
}
