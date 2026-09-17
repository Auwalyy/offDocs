import React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: Props) {
  return (
    <View className="gap-1.5">
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        className={`min-h-[48px] rounded-md border px-4 py-3 text-base
          bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-50
          ${error ? 'border-error' : 'border-surface-200 dark:border-surface-700'}
          ${typeof className === 'string' ? className : ''}`}
        placeholderTextColor="#94A3B8"
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text variant="caption" className="text-error">{error}</Text> : null}
    </View>
  );
}
