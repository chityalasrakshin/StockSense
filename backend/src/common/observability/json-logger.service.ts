import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';
import { currentRequestId } from './request-context';

@Injectable()
export class JsonLoggerService implements LoggerService {
  private readonly logger: Logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private write(level: 'info' | 'warn' | 'error' | 'debug', message: unknown, context?: string) {
    const payload = typeof message === 'string' ? { message } : { message: JSON.stringify(message) };
    this.logger[level]({ ...payload, context, requestId: currentRequestId() }, payload.message);
  }
  log(message: unknown, context?: string) { this.write('info', message, context); }
  error(message: unknown, trace?: string, context?: string) { this.logger.error({ message, trace, context, requestId: currentRequestId() }); }
  warn(message: unknown, context?: string) { this.write('warn', message, context); }
  debug(message: unknown, context?: string) { this.write('debug', message, context); }
  verbose(message: unknown, context?: string) { this.write('debug', message, context); }
}
