/** Empty cell appended to an odd-length grid so the last tile keeps its width. */
export const GRID_SPACER = Symbol('grid-spacer');

export function withGridSpacer<T>(items: T[], columns: number): (T | typeof GRID_SPACER)[] {
  return columns > 1 && items.length % columns !== 0
    ? [...items, ...Array<typeof GRID_SPACER>(columns - (items.length % columns)).fill(GRID_SPACER)]
    : items;
}
