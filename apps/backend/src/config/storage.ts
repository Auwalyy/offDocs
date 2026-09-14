import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

const s3 = new S3Client({
  endpoint: config.STORAGE_ENDPOINT,
  region: config.STORAGE_REGION,
  credentials: {
    accessKeyId: config.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

export async function uploadFile(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  }));
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: key,
  }));
}

export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
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
  return `users/${userId}/documents/${clientId}/${safe}`;
}
