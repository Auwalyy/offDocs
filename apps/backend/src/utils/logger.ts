import { createLogger, format, transports } from 'winston';
import { config } from '../config';

export const logger = createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    config.NODE_ENV === 'production'
      ? format.json()
      : format.combine(format.colorize(), format.simple())
  ),
  transports: [new transports.Console()],
});
