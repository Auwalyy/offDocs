import React from 'react';
import { Text as RNText, TextProps } from 'react-native';

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';

const variantClass: Record<Variant, string> = {
  h1:      'text-2xl font-bold text-surface-900 dark:text-surface-50',
  h2:      'text-xl font-semibold text-surface-900 dark:text-surface-50',
  h3:      'text-lg font-semibold text-surface-800 dark:text-surface-100',
  body:    'text-base font-sans text-surface-700 dark:text-surface-300',
  caption: 'text-sm font-sans text-surface-500 dark:text-surface-400',
  label:   'text-sm font-medium text-surface-600 dark:text-surface-300',
};

interface Props extends TextProps {
  variant?: Variant;
}

export function Text({ variant = 'body', className = '', ...props }: Props) {
  return (
    <RNText
      className={`${variantClass[variant]} ${className}`}
      {...props}
    />
  );
}
