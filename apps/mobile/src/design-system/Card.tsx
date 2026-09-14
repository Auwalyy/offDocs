import React from 'react';
import { View, ViewProps } from 'react-native';

export function Card({ className = '', children, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`bg-white dark:bg-surface-800 rounded-lg p-4 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
