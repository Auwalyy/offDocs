import { z } from 'zod';

const envSchema = z.object({
  PORT:                    z.string().default('3000'),
  NODE_ENV:                z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI:             z.string().min(1),
  JWT_ACCESS_SECRET:       z.string().min(32),
  JWT_REFRESH_SECRET:      z.string().min(32),
  JWT_ACCESS_EXPIRES_IN:   z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN:  z.string().default('30d'),
  STORAGE_ENDPOINT:        z.string().min(1),
  STORAGE_REGION:          z.string().default('auto'),
  STORAGE_ACCESS_KEY_ID:   z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_BUCKET:          z.string().min(1),
  MAX_FILE_SIZE_MB:        z.string().default('50'),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Logger depends on config, so console is the only option here.
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
export const MAX_FILE_SIZE_BYTES = parseInt(config.MAX_FILE_SIZE_MB, 10) * 1024 * 1024;
