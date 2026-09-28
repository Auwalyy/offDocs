export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Splits `text` into matching / non-matching parts for `query`, case-insensitively. */
export function splitHighlight(text: string, query: string): HighlightPart[] {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const parts: HighlightPart[] = [];
  let index = 0;
  while (index < text.length) {
    const found = lower.indexOf(q, index);
    if (found === -1) break;
    if (found > index) parts.push({ text: text.slice(index, found), match: false });
    parts.push({ text: text.slice(found, found + q.length), match: true });
    index = found + q.length;
  }
  if (index < text.length) parts.push({ text: text.slice(index), match: false });
  return parts.length ? parts : [{ text, match: false }];
}
