import multer from 'multer';
import { MAX_FILE_SIZE_BYTES } from '../config';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Leading bytes each allowed type must start with (DOCX is a ZIP container). */
const MAGIC_BYTES: Record<string, Buffer> = {
  'application/pdf': Buffer.from('%PDF-', 'ascii'),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': Buffer.from([0x50, 0x4b, 0x03, 0x04]),
};

/**
 * The client-declared MIME type is only a claim; this checks the file content
 * actually starts like that type.
 */
export function contentMatchesMimeType(buffer: Buffer, mimeType: string): boolean {
  const magic = MAGIC_BYTES[mimeType];
  return !!magic && buffer.length >= magic.length && buffer.subarray(0, magic.length).equals(magic);
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});
