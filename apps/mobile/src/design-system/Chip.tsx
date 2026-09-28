import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows a × button that calls this. */
  onRemove?: () => void;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
}

/** Pill used for tags and filters. */
export function Chip({ label, selected = false, onPress, onRemove, size = 'md', accessibilityLabel }: Props) {
  const pad = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1.5 min-h-[32px]';
  const colors = selected
    ? 'bg-primary-600 border-primary-600'
    : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700';
  const textColor = selected ? 'text-white' : 'text-surface-700 dark:text-surface-200';

  const content = (
    <>
      <Text className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium ${textColor}`} numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          className="ml-1.5"
        >
          <Text className={`text-base leading-4 ${textColor}`}>×</Text>
        </Pressable>
      ) : null}
    </>
  );

  const className = `flex-row items-center self-start rounded-full border ${pad} ${colors}`;
  if (!onPress) return <View className={className}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      className={`${className} active:opacity-80`}
    >
      {content}
    </Pressable>
  );
}
