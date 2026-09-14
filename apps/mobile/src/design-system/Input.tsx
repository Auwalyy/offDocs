import React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: Props) {
  return (
    <View className="gap-1">
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        className={`
          bg-surface-100 dark:bg-surface-800
          border border-surface-200 dark:border-surface-700
          rounded-md px-4 py-3 min-h-[48px]
          text-base text-surface-900 dark:text-surface-50
          ${error ? 'border-error' : ''}
          ${className}
        `}
        placeholderTextColor="#94A3B8"
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text variant="caption" className="text-error">{error}</Text> : null}
    </View>
  );
}
