import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI);
  logger.info('MongoDB connected');
}
