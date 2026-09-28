import React from 'react';
import { View } from 'react-native';
import { GRID_SPACER, withGridSpacer } from '../lib/grid';

interface Props<T> {
  items: T[];
  columns: number;
  keyOf: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}

/** Lays items out in equal-width columns inside a ScrollView (one column = list). */
export function ItemGrid<T>({ items, columns, keyOf, renderItem }: Props<T>) {
  if (columns <= 1) {
    return <>{items.map((item) => <React.Fragment key={keyOf(item)}>{renderItem(item)}</React.Fragment>)}</>;
  }
  const cells = withGridSpacer(items, columns);
  const rows: (T | typeof GRID_SPACER)[][] = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));
  return (
    <>
      {rows.map((row, r) => (
        <View key={r} className="flex-row gap-2">
          {row.map((cell, c) => (
            <View key={cell === GRID_SPACER ? `spacer-${c}` : keyOf(cell)} className="flex-1">
              {cell === GRID_SPACER ? null : renderItem(cell)}
            </View>
          ))}
        </View>
      ))}
    </>
  );
}
