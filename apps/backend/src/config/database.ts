import dns from 'dns';
import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

/** Used only when the system resolver cannot answer the SRV lookup. */
const FALLBACK_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

function isSrvLookupFailure(err: unknown): boolean {
  return (err as { syscall?: string } | null)?.syscall === 'querySrv';
}

/**
 * `mongodb+srv://` URIs need a DNS SRV lookup. Some networks (phone hotspots,
 * captive routers) answer SRV queries with malformed responses (EBADRESP), so
 * on that specific failure the lookup is retried once through public DNS.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.MONGODB_URI);
  } catch (err) {
    if (!isSrvLookupFailure(err)) throw err;
    logger.warn(
      `MongoDB SRV lookup failed with the system DNS (${(err as { code?: string }).code ?? 'unknown'}); retrying via ${FALLBACK_DNS_SERVERS.join(', ')}`
    );
    dns.setServers(FALLBACK_DNS_SERVERS);
    await mongoose.connect(config.MONGODB_URI);
  }
  logger.info('MongoDB connected');
}
