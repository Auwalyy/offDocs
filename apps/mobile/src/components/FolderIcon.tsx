import React from 'react';
import { View } from 'react-native';
import { Text } from '../design-system';
import { DEFAULT_FOLDER_ICON, tint } from '../lib/folderStyle';

interface Props {
  color: string | null;
  icon: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { box: 32, font: 'text-base' },
  md: { box: 40, font: 'text-xl' },
  lg: { box: 56, font: 'text-3xl' },
};

/** A folder's icon on a tile tinted with the folder's colour. */
export function FolderIcon({ color, icon, size = 'md' }: Props) {
  const { box, font } = SIZES[size];
  return (
    <View
      className="items-center justify-center rounded-md"
      style={{ width: box, height: box, backgroundColor: tint(color), borderColor: tint(color, '55'), borderWidth: 1 }}
      importantForAccessibility="no-hide-descendants"
    >
      <Text className={font}>{icon ?? DEFAULT_FOLDER_ICON}</Text>
    </View>
  );
}
