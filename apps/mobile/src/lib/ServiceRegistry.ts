import { SQLiteDatabase } from 'expo-sqlite';
import { AuthService } from '../features/auth/AuthService';
import { WorkspaceService } from '../features/workspace/WorkspaceService';
import { DocumentService } from '../features/documents/DocumentService';
import { SyncQueueRepository } from '../features/sync/SyncQueueRepository';
import { SyncEngine } from './SyncEngine';
import { apiClient } from '../api/client';

export interface Services {
  auth: AuthService;
  workspace: WorkspaceService;
  documents: DocumentService;
  syncQueue: SyncQueueRepository;
  syncEngine: SyncEngine;
}

let _services: Services | null = null;

export function initServices(db: SQLiteDatabase): Services {
  const auth      = new AuthService(db);
  const workspace = new WorkspaceService(db);
  const documents = new DocumentService(db);
  const syncQueue = new SyncQueueRepository(db);
  const syncEngine = new SyncEngine(db);

  apiClient.setAuthService(auth);

  _services = { auth, workspace, documents, syncQueue, syncEngine };
  return _services;
}

export function getServices(): Services {
  if (!_services) throw new Error('Services not initialized');
  return _services;
}
