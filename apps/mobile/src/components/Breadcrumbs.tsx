import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Text } from '../design-system';
import { Folder } from '../types';

interface Props {
  /** Ancestors then the current folder, root first. */
  path: Folder[];
  onNavigateRoot: () => void;
  onNavigate: (folderId: string) => void;
}

export function Breadcrumbs({ path, onNavigateRoot, onNavigate }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Keep the current folder in view when the path is long.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [path]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="toolbar"
      accessibilityLabel="Folder path"
      className="grow-0 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900"
      contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', minHeight: 40 }}
    >
      <Pressable onPress={onNavigateRoot} accessibilityRole="link" accessibilityLabel="My Workspace" hitSlop={6} className="py-2">
        <Text variant="caption" className="text-primary-600 dark:text-primary-400">My Workspace</Text>
      </Pressable>
      {path.map((f, i) => {
        const isCurrent = i === path.length - 1;
        return (
          <React.Fragment key={f.id}>
            <Text variant="caption" className="mx-1.5 text-surface-400">›</Text>
            {isCurrent ? (
              <Text variant="caption" className="font-semibold text-surface-800 dark:text-surface-100" numberOfLines={1}>
                {f.name}
              </Text>
            ) : (
              <Pressable onPress={() => onNavigate(f.id)} accessibilityRole="link" accessibilityLabel={f.name} hitSlop={6} className="py-2">
                <Text variant="caption" className="text-primary-600 dark:text-primary-400" numberOfLines={1}>{f.name}</Text>
              </Pressable>
            )}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}
