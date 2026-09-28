import { useCallback, useEffect, useState } from 'react';
import { getServices } from '../lib/ServiceRegistry';
import { DEFAULT_SORT, DEFAULT_VIEW, SortOption, ViewMode, isSortOption } from '../lib/sort';

const SORT_KEY = 'workspace.sort';
const VIEW_KEY = 'workspace.view';

/** Sort order and list/grid view, saved on the device and shared by all folders. */
export function useWorkspacePrefs() {
  const [sort, setSortState] = useState<SortOption>(DEFAULT_SORT);
  const [view, setViewState] = useState<ViewMode>(DEFAULT_VIEW);

  useEffect(() => {
    const prefs = getServices().preferences;
    Promise.all([prefs.get(SORT_KEY), prefs.get(VIEW_KEY)])
      .then(([s, v]) => {
        if (isSortOption(s)) setSortState(s);
        if (v === 'list' || v === 'grid') setViewState(v);
      })
      .catch((err: unknown) => console.warn('Could not load preferences:', err));
  }, []);

  const setSort = useCallback((value: SortOption) => {
    setSortState(value);
    getServices().preferences.set(SORT_KEY, value).catch((err: unknown) => console.warn('Could not save sort:', err));
  }, []);

  const setView = useCallback((value: ViewMode) => {
    setViewState(value);
    getServices().preferences.set(VIEW_KEY, value).catch((err: unknown) => console.warn('Could not save view:', err));
  }, []);

  return { sort, setSort, view, setView };
}
