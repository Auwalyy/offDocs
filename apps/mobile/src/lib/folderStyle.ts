/** Colours offered for folders. Values are what is stored and synced (#RRGGBB). */
export const FOLDER_COLORS: { value: string; name: string }[] = [
  { value: '#2563EB', name: 'Blue' },
  { value: '#4F46E5', name: 'Indigo' },
  { value: '#7C3AED', name: 'Violet' },
  { value: '#DB2777', name: 'Pink' },
  { value: '#DC2626', name: 'Red' },
  { value: '#EA580C', name: 'Orange' },
  { value: '#D97706', name: 'Amber' },
  { value: '#16A34A', name: 'Green' },
  { value: '#0D9488', name: 'Teal' },
  { value: '#475569', name: 'Slate' },
];

export const FOLDER_ICONS: { value: string; name: string }[] = [
  { value: '📁', name: 'Folder' },
  { value: '📚', name: 'Books' },
  { value: '📝', name: 'Notes' },
  { value: '🎓', name: 'Graduation' },
  { value: '🧪', name: 'Lab' },
  { value: '💻', name: 'Computer' },
  { value: '📐', name: 'Maths' },
  { value: '📊', name: 'Charts' },
  { value: '🧠', name: 'Study' },
  { value: '⭐', name: 'Star' },
  { value: '📅', name: 'Calendar' },
  { value: '🔬', name: 'Science' },
];

export const DEFAULT_FOLDER_ICON = '📁';
export const DEFAULT_FOLDER_COLOR = '#64748B';

/** 8-digit hex: the folder colour at low opacity, used as a tile background. */
export function tint(color: string | null, alpha = '22'): string {
  return `${color ?? DEFAULT_FOLDER_COLOR}${alpha}`;
}
