import { Document, Folder } from '../types';

export type SortOption = 'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'modified' | 'type' | 'size';
export type ViewMode = 'list' | 'grid';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc',  label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',    label: 'Oldest first' },
  { value: 'modified',  label: 'Recently modified' },
  { value: 'type',      label: 'File type' },
  { value: 'size',      label: 'Size (largest first)' },
];

export const DEFAULT_SORT: SortOption = 'name_asc';
export const DEFAULT_VIEW: ViewMode = 'list';

export function isSortOption(value: string | null): value is SortOption {
  return SORT_OPTIONS.some((o) => o.value === value);
}

export function sortLabel(option: SortOption): string {
  return SORT_OPTIONS.find((o) => o.value === option)?.label ?? '';
}

/** Case-insensitive, and "CSC 90" sorts before "CSC 401". */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

const TYPE_ORDER: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

export function fileTypeLabel(mimeType: string): string {
  return TYPE_ORDER[mimeType] ?? 'File';
}

/** Folders have no type or size, so those options fall back to name order. */
export function sortFolders(folders: Folder[], option: SortOption): Folder[] {
  const sorted = [...folders];
  switch (option) {
    case 'name_desc': return sorted.sort((a, b) => compareNames(b.name, a.name));
    case 'newest':    return sorted.sort((a, b) => b.createdAt - a.createdAt || compareNames(a.name, b.name));
    case 'oldest':    return sorted.sort((a, b) => a.createdAt - b.createdAt || compareNames(a.name, b.name));
    case 'modified':  return sorted.sort((a, b) => b.updatedAt - a.updatedAt || compareNames(a.name, b.name));
    default:          return sorted.sort((a, b) => compareNames(a.name, b.name));
  }
}

export function sortDocuments<T extends Document>(docs: T[], option: SortOption): T[] {
  const sorted = [...docs];
  switch (option) {
    case 'name_desc': return sorted.sort((a, b) => compareNames(b.name, a.name));
    case 'newest':    return sorted.sort((a, b) => b.importedAt - a.importedAt || compareNames(a.name, b.name));
    case 'oldest':    return sorted.sort((a, b) => a.importedAt - b.importedAt || compareNames(a.name, b.name));
    case 'modified':  return sorted.sort((a, b) => b.updatedAt - a.updatedAt || compareNames(a.name, b.name));
    case 'type':
      return sorted.sort((a, b) =>
        compareNames(fileTypeLabel(a.mimeType), fileTypeLabel(b.mimeType)) || compareNames(a.name, b.name));
    case 'size':      return sorted.sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0) || compareNames(a.name, b.name));
    default:          return sorted.sort((a, b) => compareNames(a.name, b.name));
  }
}
