import { SQLiteDatabase } from 'expo-sqlite';
import { AuthService } from '../features/auth/AuthService';
import { WorkspaceService } from '../features/workspace/WorkspaceService';
import { DocumentService } from '../features/documents/DocumentService';
import { SyncQueueRepository } from '../features/sync/SyncQueueRepository';
import { SyncEngine } from './SyncEngine';
import { OrganizationService } from '../features/favorites/OrganizationService';
import { SearchService } from '../features/search/SearchService';
import { RecentRepository } from '../features/recent/RecentRepository';
import { PreferencesRepository } from '../features/settings/PreferencesRepository';
import { apiClient } from '../api/client';

export interface Services {
  auth: AuthService;
  workspace: WorkspaceService;
  documents: DocumentService;
  syncQueue: SyncQueueRepository;
  syncEngine: SyncEngine;
  organization: OrganizationService;
  search: SearchService;
  recent: RecentRepository;
  preferences: PreferencesRepository;
}

let _services: Services | null = null;
let _db: SQLiteDatabase | null = null;

export function initServices(db: SQLiteDatabase): Services {
  _db = db;
  return _build(db);
}

function _build(db: SQLiteDatabase): Services {
  const auth       = new AuthService(db);
  const workspace  = new WorkspaceService(db);
  const documents  = new DocumentService(db);
  const syncQueue  = new SyncQueueRepository(db);
  const syncEngine = new SyncEngine(db);
  const organization = new OrganizationService(db);
  const search      = new SearchService(db);
  const recent      = new RecentRepository(db);
  const preferences = new PreferencesRepository(db);

  apiClient.setAuthService(auth);

  _services = { auth, workspace, documents, syncQueue, syncEngine, organization, search, recent, preferences };
  return _services;
}

export function getServices(): Services {
  // Fast Refresh can wipe module-level state while the React tree stays alive.
  // Re-build from the stored db reference rather than throwing.
  if (!_services) {
    if (!_db) throw new Error('Services not initialized — call initServices first');
    return _build(_db);
  }
  return _services;
}
