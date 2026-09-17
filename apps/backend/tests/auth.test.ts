/**
 * Auth route tests.
 *
 * These tests mock mongoose and argon2 to avoid requiring a real MongoDB
 * instance in CI. They verify request validation, response shape, and
 * error handling.
 */

import request from 'supertest';

// ─── Mock dependencies before importing app ───────────────────────────────────

jest.mock('../src/config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/models/User', () => {
  const mockUser = {
    _id: { toString: () => 'user-server-id-123' },
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashed',
    refreshTokenHash: null,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return {
    User: {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue(mockUser),
      find: jest.fn().mockResolvedValue([]),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/models/IdempotencyKey', () => ({
  IdempotencyKey: {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
  },
}));

// Set required env vars before config loads
process.env['MONGODB_URI']               = 'mongodb://localhost:27017/test';
process.env['JWT_ACCESS_SECRET']         = 'test_access_secret_that_is_long_enough_32';
process.env['JWT_REFRESH_SECRET']        = 'test_refresh_secret_that_is_long_enough_32';
process.env['STORAGE_ENDPOINT']          = 'https://test.r2.cloudflarestorage.com';
process.env['STORAGE_ACCESS_KEY_ID']     = 'test_key';
process.env['STORAGE_SECRET_ACCESS_KEY'] = 'test_secret';
process.env['STORAGE_BUCKET']            = 'test-bucket';

// Import app AFTER mocks are set up
const { app } = require('../src/app') as { app: import('express').Express };

describe('POST /api/v1/auth/register', () => {
  test('returns 201 with tokens on valid input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123', displayName: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  test('returns 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 on short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'short', displayName: 'Test' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  test('returns 400 on missing password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
  });
});

describe('GET /health', () => {
  test('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Unknown route', () => {
  test('returns 404', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
