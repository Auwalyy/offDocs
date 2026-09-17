import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useApp } from './useApp';

/**
 * Runs `load` when the screen gains focus and whenever local data changes
 * (a sync finished or another screen mutated something).
 */
export function useReloadOnChange(load: () => Promise<void>): void {
  const { dataVersion } = useApp();
  const loadRef = useRef(load);
  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      loadRef.current().catch((err: unknown) => console.warn('Reload failed:', err));
    }, [])
  );

  useEffect(() => {
    if (dataVersion === 0) return; // initial load is handled by focus
    loadRef.current().catch((err: unknown) => console.warn('Reload failed:', err));
  }, [dataVersion]);
}
