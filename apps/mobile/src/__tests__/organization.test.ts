/**
 * Pure helpers behind sorting, search and tagging.
 */

import { sortDocuments, sortFolders, compareNames, isSortOption } from '../lib/sort';
import { splitHighlight } from '../lib/highlight';
import { escapeLike, mimeTypesForQuery } from '../features/search/SearchService';
import { normalizeTags, splitTagList, TAG_SEPARATOR, MAX_TAGS_PER_DOCUMENT } from '../features/tags/TagRepository';
import { Document, Folder } from '../types';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function folder(name: string, createdAt: number, updatedAt = createdAt): Folder {
  return {
    id: name, serverId: null, parentId: null, name, pathCache: null, color: null, icon: null,
    isFavorite: false, syncStatus: 'synced', createdAt, updatedAt, deletedAt: null,
  };
}

function doc(name: string, mimeType: string, fileSize: number, importedAt: number, updatedAt = importedAt): Document {
  return {
    id: name, serverId: null, folderId: 'f', name, mimeType, localUri: null, storageKey: null, fileSize,
    contentHash: null, importedAt, updatedAt, isFavorite: false, syncStatus: 'synced', deletedAt: null,
  };
}

describe('sorting', () => {
  const folders = [folder('csc 401', 3, 10), folder('CSC 90', 1, 30), folder('Assignments', 2, 20)];
  const docs = [
    doc('b.pdf', PDF, 500, 2, 5),
    doc('A.docx', DOCX, 900, 3, 1),
    doc('c.pdf', PDF, 100, 1, 9),
  ];

  test('names compare case-insensitively with numeric order', () => {
    expect(compareNames('CSC 90', 'csc 401')).toBeLessThan(0);
    expect(sortFolders(folders, 'name_asc').map((f) => f.name)).toEqual(['Assignments', 'CSC 90', 'csc 401']);
    expect(sortFolders(folders, 'name_desc').map((f) => f.name)).toEqual(['csc 401', 'CSC 90', 'Assignments']);
  });

  test('date-based options', () => {
    expect(sortFolders(folders, 'newest').map((f) => f.name)).toEqual(['csc 401', 'Assignments', 'CSC 90']);
    expect(sortFolders(folders, 'oldest').map((f) => f.name)).toEqual(['CSC 90', 'Assignments', 'csc 401']);
    expect(sortFolders(folders, 'modified').map((f) => f.name)).toEqual(['CSC 90', 'Assignments', 'csc 401']);
    expect(sortDocuments(docs, 'newest').map((d) => d.name)).toEqual(['A.docx', 'b.pdf', 'c.pdf']);
    expect(sortDocuments(docs, 'modified').map((d) => d.name)).toEqual(['c.pdf', 'b.pdf', 'A.docx']);
  });

  test('type groups documents, then sorts by name; size is largest first', () => {
    expect(sortDocuments(docs, 'type').map((d) => d.name)).toEqual(['A.docx', 'b.pdf', 'c.pdf']);
    expect(sortDocuments(docs, 'size').map((d) => d.name)).toEqual(['A.docx', 'b.pdf', 'c.pdf']);
  });

  test('folders fall back to name order for type and size', () => {
    expect(sortFolders(folders, 'size').map((f) => f.name)).toEqual(['Assignments', 'CSC 90', 'csc 401']);
  });

  test('does not mutate the input', () => {
    const before = docs.map((d) => d.name);
    sortDocuments(docs, 'size');
    expect(docs.map((d) => d.name)).toEqual(before);
  });

  test('validates stored preference values', () => {
    expect(isSortOption('size')).toBe(true);
    expect(isSortOption('bogus')).toBe(false);
    expect(isSortOption(null)).toBe(false);
  });
});

describe('search helpers', () => {
  test('highlight splits every case-insensitive match', () => {
    expect(splitHighlight('Database Systems database.pdf', 'DATA')).toEqual([
      { text: 'Data', match: true },
      { text: 'base Systems ', match: false },
      { text: 'data', match: true },
      { text: 'base.pdf', match: false },
    ]);
    expect(splitHighlight('Notes', '')).toEqual([{ text: 'Notes', match: false }]);
    expect(splitHighlight('Notes', 'xyz')).toEqual([{ text: 'Notes', match: false }]);
  });

  test('LIKE wildcards are escaped', () => {
    expect(escapeLike('100%_done\\')).toBe('100\\%\\_done\\\\');
  });

  test('file-type words map to MIME types', () => {
    expect(mimeTypesForQuery('pdf')).toEqual([PDF]);
    expect(mimeTypesForQuery('Wor')).toEqual([DOCX]);
    expect(mimeTypesForQuery('do')).toEqual([DOCX]);
    expect(mimeTypesForQuery('d')).toEqual([]);
    expect(mimeTypesForQuery('database')).toEqual([]);
  });
});

describe('tags', () => {
  test('normalizes whitespace and removes case-insensitive duplicates', () => {
    expect(normalizeTags(['  Exam ', 'exam', 'CSC   401', '', 'Lecture'])).toEqual(['Exam', 'CSC 401', 'Lecture']);
  });

  test('rejects overly long tags and too many tags', () => {
    expect(() => normalizeTags(['x'.repeat(41)])).toThrow('at most 40');
    const many = Array.from({ length: MAX_TAGS_PER_DOCUMENT + 1 }, (_, i) => `t${i}`);
    expect(() => normalizeTags(many)).toThrow(`at most ${MAX_TAGS_PER_DOCUMENT}`);
  });

  test('splits group_concat output', () => {
    expect(splitTagList(null)).toEqual([]);
    expect(splitTagList(['Exam', 'CSC 401'].join(TAG_SEPARATOR))).toEqual(['Exam', 'CSC 401']);
  });
});
