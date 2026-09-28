import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design-system';
import { SORT_OPTIONS, SortOption, ViewMode, sortLabel } from '../lib/sort';
import { OptionsSheet } from './OptionsSheet';

interface Props {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** Left-hand summary, e.g. "3 folders · 5 documents". */
  summary?: string;
}

export function WorkspaceToolbar({ sort, onSortChange, view, onViewChange, summary }: Props) {
  const [showSort, setShowSort] = useState(false);
  return (
    <View className="flex-row items-center justify-between mb-1">
      <Text variant="caption" className="flex-1" numberOfLines={1}>{summary ?? ''}</Text>
      <Pressable
        onPress={() => setShowSort(true)}
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${sortLabel(sort)}. Change sort order`}
        className="flex-row items-center px-2 min-h-[40px] rounded-md active:bg-surface-100 dark:active:bg-surface-800"
      >
        <Text variant="caption" className="text-primary-600 dark:text-primary-400">⇅ {sortLabel(sort)}</Text>
      </Pressable>
      <Pressable
        onPress={() => onViewChange(view === 'list' ? 'grid' : 'list')}
        accessibilityRole="button"
        accessibilityLabel={view === 'list' ? 'Switch to grid view' : 'Switch to list view'}
        className="w-10 h-10 items-center justify-center rounded-md active:bg-surface-100 dark:active:bg-surface-800"
      >
        <Text className="text-lg text-primary-600 dark:text-primary-400">{view === 'list' ? '▦' : '☰'}</Text>
      </Pressable>

      <OptionsSheet
        visible={showSort}
        title="Sort by"
        onClose={() => setShowSort(false)}
        options={SORT_OPTIONS.map((o) => ({
          label: o.label,
          selected: o.value === sort,
          onPress: () => onSortChange(o.value),
        }))}
      />
    </View>
  );
}
