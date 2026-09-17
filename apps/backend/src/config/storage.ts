import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

/**
 * True when the storage env vars look like real values rather than the
 * `<placeholder>` entries from .env.example.
 */
export const isStorageConfigured = [
  config.STORAGE_ENDPOINT,
  config.STORAGE_ACCESS_KEY_ID,
  config.STORAGE_SECRET_ACCESS_KEY,
  config.STORAGE_BUCKET,
].every((v) => !/[<>]/.test(v));

/**
 * Without real object-storage credentials, files are kept on the server's disk
 * so the app works end-to-end during development. Not intended for production.
 */
export const usesLocalStorage = !isStorageConfigured;

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const s3 = isStorageConfigured
  ? new S3Client({
      endpoint: config.STORAGE_ENDPOINT,
      region: config.STORAGE_REGION,
      credentials: {
        accessKeyId: config.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY,
      },
      forcePathStyle: false,
    })
  : null;

/** Maps a storage key to a path inside LOCAL_UPLOAD_DIR, refusing anything that escapes it. */
export function localPathForKey(key: string): string {
  const resolved = path.resolve(LOCAL_UPLOAD_DIR, key);
  if (!resolved.startsWith(LOCAL_UPLOAD_DIR + path.sep)) {
    throw new Error('Invalid storage key.');
  }
  return resolved;
}

export async function uploadFile(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  if (!s3) {
    const target = localPathForKey(params.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, params.body);
    return;
  }
  await s3.send(new PutObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  }));
}

export async function deleteFile(key: string): Promise<void> {
  if (!s3) {
    await fs.rm(localPathForKey(key), { force: true });
    return;
  }
  await s3.send(new DeleteObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: key,
  }));
}

/** Only available with real object storage; local files are served by the API instead. */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  if (!s3) throw new Error('Presigned URLs require object storage.');
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.STORAGE_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Generates a safe, non-guessable storage key.
 * Format: users/{userId}/documents/{clientId}/{safeFilename}
 */
export function buildStorageKey(userId: string, clientId: string, originalName: string): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const safeClientId = clientId.replace(/[^a-zA-Z0-9-]/g, '_');
  return `users/${userId}/documents/${safeClientId}/${safe}`;
}
