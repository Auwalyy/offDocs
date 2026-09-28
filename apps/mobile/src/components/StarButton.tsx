import React from 'react';
import { Pressable } from 'react-native';
import { Text } from '../design-system';

interface Props {
  active: boolean;
  name: string;
  onPress: () => void;
}

export function StarButton({ active, name, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      className="w-9 h-11 items-center justify-center"
    >
      <Text className={`text-xl ${active ? 'text-warning' : 'text-surface-300 dark:text-surface-600'}`}>
        {active ? '★' : '☆'}
      </Text>
    </Pressable>
  );
}
