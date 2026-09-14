import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, View } from 'react-native';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const containerClass: Record<Variant, string> = {
  primary:   'bg-primary-600 active:bg-primary-700',
  secondary: 'bg-surface-200 dark:bg-surface-700 active:bg-surface-300 dark:active:bg-surface-600',
  ghost:     'bg-transparent active:bg-surface-100 dark:active:bg-surface-800',
  danger:    'bg-error active:opacity-80',
};

const textClass: Record<Variant, string> = {
  primary:   'text-white font-semibold',
  secondary: 'text-surface-800 dark:text-surface-100 font-medium',
  ghost:     'text-primary-600 dark:text-primary-400 font-medium',
  danger:    'text-white font-semibold',
};

interface Props extends PressableProps {
  variant?: Variant;
  label: string;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  label,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center rounded-md px-5 py-3.5
        min-h-[48px] min-w-[48px]
        ${containerClass[variant]}
        ${isDisabled ? 'opacity-50' : ''}
        ${fullWidth ? 'w-full' : ''}
        ${typeof className === 'string' ? className : ''}
      `}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#3B82F6'} />
      ) : (
        <Text className={textClass[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
