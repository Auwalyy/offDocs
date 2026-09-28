/**
 * Tests for behaviours the mobile sync engine relies on:
 * - idempotency only replays successful responses and is scoped per user
 * - malformed ids are rejected with 400 instead of crashing with 500
 * - uploads fall back to local disk when object storage is not configured
 * - refresh tokens are resolved by user id
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env['MONGODB_URI']               = 'mongodb://localhost:27017/test';
process.env['JWT_ACCESS_SECRET']         = 'test_access_secret_that_is_long_enough_32';
process.env['JWT_REFRESH_SECRET']        = 'test_refresh_secret_that_is_long_enough_32';
process.env['STORAGE_ENDPOINT']          = 'https://<account_id>.r2.cloudflarestorage.com';
process.env['STORAGE_ACCESS_KEY_ID']     = '<access_key_id>';
process.env['STORAGE_SECRET_ACCESS_KEY'] = '<secret_access_key>';
process.env['STORAGE_BUCKET']            = 'test-bucket';

jest.mock('../src/config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

const mockIdem = {
  findOne: jest.fn(),
  create: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../src/models/IdempotencyKey', () => ({ IdempotencyKey: mockIdem }));

const mockUser = { findById: jest.fn(), findByIdAndUpdate: jest.fn().mockResolvedValue(undefined), findOne: jest.fn() };
jest.mock('../src/models/User', () => ({ User: mockUser }));

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn().mockResolvedValue(true),
}));

const mockFolderService = {
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  findById: jest.fn(),
};
jest.mock('../src/services/FolderService', () => ({
  FolderService: jest.fn().mockImplementation(() => mockFolderService),
}));

const { app } = require('../src/app') as { app: import('express').Express };

const USER_ID = '64b7f0c2a1b2c3d4e5f60718';
const token = jwt.sign({ sub: USER_ID }, process.env['JWT_ACCESS_SECRET']!, { expiresIn: '5m' });
const auth = { Authorization: `Bearer ${token}` };
const CLIENT_ID = '3f1c2b1e-8a3d-4c6e-9f5b-2a7d9e4c1b0a';

beforeEach(() => {
  jest.clearAllMocks();
  mockIdem.findOne.mockResolvedValue(null);
});

describe('idempotency', () => {
  test('stores successful responses under a user-scoped key', async () => {
    mockFolderService.create.mockResolvedValue({
      clientId: CLIENT_ID, _id: { toString: () => 'srv1' }, name: 'A', parentId: null,
    });

    const res = await request(app)
      .post('/api/v1/folders')
      .set(auth)
      .set('Idempotency-Key', 'key-1')
      .send({ clientId: CLIENT_ID, name: 'A', parentId: null });

    expect(res.status).toBe(201);
    expect(mockIdem.findOne).toHaveBeenCalledWith({ key: `${USER_ID}:key-1` });
    expect(mockIdem.create).toHaveBeenCalledWith(expect.objectContaining({ key: `${USER_ID}:key-1`, statusCode: 201 }));
  });

  test('does not store error responses, so retries are re-executed', async () => {
    mockFolderService.create.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/api/v1/folders')
      .set(auth)
      .set('Idempotency-Key', 'key-2')
      .send({ clientId: CLIENT_ID, name: 'A', parentId: null });

    expect(res.status).toBe(500);
    expect(mockIdem.create).not.toHaveBeenCalled();
  });
});

describe('id validation', () => {
  test('malformed folder id returns 400', async () => {
    const res = await request(app).patch('/api/v1/folders/not-an-id').set(auth).send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
    expect(mockFolderService.update).not.toHaveBeenCalled();
  });

  test('folder delete returns 204', async () => {
    mockFolderService.softDelete.mockResolvedValue(undefined);
    const res = await request(app).delete(`/api/v1/folders/${USER_ID}`).set(auth);
    expect(res.status).toBe(204);
  });
});

describe('local storage fallback', () => {
  const storage = require('../src/config/storage') as typeof import('../src/config/storage');

  test('is used when storage env vars are placeholders', () => {
    expect(storage.usesLocalStorage).toBe(true);
  });

  test('keeps files inside the uploads directory', () => {
    const key = storage.buildStorageKey(USER_ID, CLIENT_ID, 'Notes.pdf');
    expect(storage.localPathForKey(key).startsWith(storage.LOCAL_UPLOAD_DIR)).toBe(true);
    expect(() => storage.localPathForKey('../../etc/passwd')).toThrow('Invalid storage key.');
  });

  test('upload without a file returns 400, not a storage error', async () => {
    const res = await request(app).post('/api/v1/documents').set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });
});

describe('refresh token', () => {
  test('looks the user up by the id prefix', async () => {
    mockUser.findById.mockResolvedValue({ _id: { toString: () => USER_ID }, refreshTokenHash: 'hash' });

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: `${USER_ID}.abcdef` });

    expect(res.status).toBe(200);
    expect(mockUser.findById).toHaveBeenCalledWith(USER_ID);
    expect(res.body.data.refreshToken.startsWith(`${USER_ID}.`)).toBe(true);
  });

  test('rejects tokens without a valid user id', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
    expect(mockUser.findById).not.toHaveBeenCalled();
  });
});

describe('upload content validation', () => {
  const { contentMatchesMimeType } = require('../src/middleware/upload') as typeof import('../src/middleware/upload');
  const PDF  = 'application/pdf';
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  test('accepts files whose leading bytes match the declared type', () => {
    expect(contentMatchesMimeType(Buffer.from('%PDF-1.7\n...'), PDF)).toBe(true);
    expect(contentMatchesMimeType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]), DOCX)).toBe(true);
  });

  test('rejects mismatched, truncated and unknown content', () => {
    expect(contentMatchesMimeType(Buffer.from('MZ\x90\x00 not a pdf'), PDF)).toBe(false);
    expect(contentMatchesMimeType(Buffer.from('%PDF-1.7'), DOCX)).toBe(false);
    expect(contentMatchesMimeType(Buffer.from('%PD'), PDF)).toBe(false);
    expect(contentMatchesMimeType(Buffer.from('%PDF-1.7'), 'text/plain')).toBe(false);
  });

  test('a file labelled PDF that is not a PDF is refused with 415', async () => {
    const res = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .field('clientId', CLIENT_ID)
      .field('folderId', USER_ID)
      .field('name', 'fake.pdf')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'fake.pdf', contentType: PDF });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('CONTENT_TYPE_MISMATCH');
  });
});

describe('organization fields', () => {
  test('folder style and favorite are passed through to the service', async () => {
    mockFolderService.update.mockResolvedValue({
      _id: { toString: () => 'srv1' }, name: 'A', parentId: null, color: '#2563EB', icon: '📚', isFavorite: true,
    });
    const res = await request(app)
      .patch(`/api/v1/folders/${USER_ID}`)
      .set(auth)
      .send({ color: '#2563EB', icon: '📚', isFavorite: true });
    expect(res.status).toBe(200);
    expect(mockFolderService.update).toHaveBeenCalledWith(
      expect.objectContaining({ color: '#2563EB', icon: '📚', isFavorite: true })
    );
    expect(res.body.data).toMatchObject({ color: '#2563EB', icon: '📚', isFavorite: true });
  });

  test('invalid folder colour is rejected before reaching the service', async () => {
    const res = await request(app).patch(`/api/v1/folders/${USER_ID}`).set(auth).send({ color: 'red' });
    expect(res.status).toBe(400);
    expect(mockFolderService.update).not.toHaveBeenCalled();
  });

  test('document update needs at least one field and caps the tag list', async () => {
    const empty = await request(app).patch(`/api/v1/documents/${USER_ID}`).set(auth).send({});
    expect(empty.status).toBe(400);

    const tooMany = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const res = await request(app).patch(`/api/v1/documents/${USER_ID}`).set(auth).send({ tags: tooMany });
    expect(res.status).toBe(400);
  });

  test('tags are de-duplicated case-insensitively, keeping the first spelling', () => {
    const { dedupeTags } = require('../src/services/DocumentService') as typeof import('../src/services/DocumentService');
    expect(dedupeTags(['Exam', ' exam ', 'CSC 401', '', 'csc 401', 'Lecture'])).toEqual(['Exam', 'CSC 401', 'Lecture']);
  });
});
