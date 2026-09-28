import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Document, Folder } from '../types';
import { getServices } from '../lib/ServiceRegistry';
import { useApp } from './useApp';
import { confirmDelete, showError } from '../lib/alerts';
import { OptionsSheet, SheetOption } from '../components/OptionsSheet';
import { RenameFolderModal } from '../components/RenameFolderModal';
import { MoveFolderModal } from '../components/MoveFolderModal';
import { FolderStyleModal } from '../components/FolderStyleModal';

type Modal = 'options' | 'rename' | 'move' | 'style' | null;

type Target =
  | { kind: 'folder'; folder: Folder }
  | { kind: 'document'; document: Document };

interface Options {
  /** Called after an item is deleted (e.g. to leave the deleted folder's screen). */
  onDeleted?: (target: Target) => void;
}

/**
 * Favorite/rename/move/customize/delete for folders and documents, shared by
 * every screen that lists them. Render `modals` once in the screen.
 */
export function useItemActions({ onDeleted }: Options = {}) {
  const router = useRouter();
  const { notifyLocalChange } = useApp();
  const [target, setTarget] = useState<Target | null>(null);
  const [modal, setModal]   = useState<Modal>(null);

  async function toggleFavorite(kind: 'folder' | 'document', item: Folder | Document) {
    try {
      await getServices().organization.setFavorite(kind, item.id, !item.isFavorite);
      notifyLocalChange();
    } catch (e) {
      showError('Could not update favorite', e);
    }
  }

  function deleteFolder(folder: Folder) {
    confirmDelete('Delete folder', `Delete “${folder.name}” and everything inside it?`, async () => {
      try {
        await getServices().workspace.deleteFolder(folder.id);
        onDeleted?.({ kind: 'folder', folder });
        notifyLocalChange();
      } catch (e) {
        showError('Could not delete folder', e);
      }
    });
  }

  function deleteDocument(document: Document) {
    confirmDelete('Delete document', `Remove “${document.name}”?`, async () => {
      try {
        await getServices().documents.deleteDocument(document.id);
        onDeleted?.({ kind: 'document', document });
        notifyLocalChange();
      } catch (e) {
        showError('Could not delete document', e);
      }
    });
  }

  function openFolderOptions(folder: Folder) {
    setTarget({ kind: 'folder', folder });
    setModal('options');
  }

  function openDocumentOptions(document: Document) {
    setTarget({ kind: 'document', document });
    setModal('options');
  }

  function sheetOptions(): SheetOption[] {
    if (!target) return [];
    if (target.kind === 'folder') {
      const { folder } = target;
      return [
        {
          label: folder.isFavorite ? 'Remove from favorites' : 'Add to favorites',
          icon: folder.isFavorite ? '☆' : '★',
          onPress: () => void toggleFavorite('folder', folder),
        },
        { label: 'Customize colour & icon', icon: '🎨', onPress: () => setModal('style') },
        { label: 'Rename', icon: '✏️', onPress: () => setModal('rename') },
        { label: 'Move', icon: '📂', onPress: () => setModal('move') },
        { label: 'Delete', icon: '🗑️', destructive: true, onPress: () => deleteFolder(folder) },
      ];
    }
    const { document } = target;
    return [
      {
        label: document.isFavorite ? 'Remove from favorites' : 'Add to favorites',
        icon: document.isFavorite ? '☆' : '★',
        onPress: () => void toggleFavorite('document', document),
      },
      { label: 'Tags & details', icon: '🏷️', onPress: () => router.push(`/(app)/document/${document.id}`) },
      { label: 'Delete', icon: '🗑️', destructive: true, onPress: () => deleteDocument(document) },
    ];
  }

  const folder = target?.kind === 'folder' ? target.folder : null;
  const close = () => setModal(null);

  const modals = (
    <>
      <OptionsSheet
        visible={modal === 'options'}
        title={folder?.name ?? (target?.kind === 'document' ? target.document.name : undefined)}
        options={sheetOptions()}
        onClose={() => setModal((m) => (m === 'options' ? null : m))}
      />
      {folder ? (
        <>
          <RenameFolderModal
            visible={modal === 'rename'}
            currentName={folder.name}
            onClose={close}
            onRename={async (name) => {
              await getServices().workspace.renameFolder(folder.id, name);
              close();
              notifyLocalChange();
            }}
          />
          <MoveFolderModal
            visible={modal === 'move'}
            folder={folder}
            onClose={close}
            onMove={async (newParentId) => {
              await getServices().workspace.moveFolder(folder.id, newParentId);
              close();
              notifyLocalChange();
            }}
          />
          <FolderStyleModal
            visible={modal === 'style'}
            folder={folder}
            onClose={close}
            onSave={async (style) => {
              await getServices().organization.setFolderStyle(folder.id, style);
              close();
              notifyLocalChange();
            }}
          />
        </>
      ) : null}
    </>
  );

  return {
    modals,
    openFolderOptions,
    openDocumentOptions,
    toggleFolderFavorite: (f: Folder) => void toggleFavorite('folder', f),
    toggleDocumentFavorite: (d: Document) => void toggleFavorite('document', d),
  };
}
