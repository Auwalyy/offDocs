import React from 'react';
import { View } from 'react-native';
import { SyncStatus } from '../types';

const DOT_CLASS: Record<SyncStatus, string> = {
  pending:         'bg-warning',
  syncing:         'bg-primary-500',
  synced:          'bg-success',
  failed:          'bg-error',
  needs_attention: 'bg-error',
};

const LABEL: Record<SyncStatus, string> = {
  pending:         'Waiting to sync',
  syncing:         'Syncing',
  synced:          'Synced',
  failed:          'Sync failed, will retry',
  needs_attention: 'Sync failed',
};

export function SyncDot({ status }: { status: SyncStatus }) {
  return (
    <View
      className={`w-2.5 h-2.5 rounded-full ${DOT_CLASS[status] ?? 'bg-surface-300'}`}
      accessibilityLabel={LABEL[status] ?? status}
    />
  );
}
