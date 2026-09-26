import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/node';

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    fieldErrors?: FieldError[];
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let fieldErrors: FieldError[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        code = this.statusCodeToErrorCode(status);
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        code =
          typeof resObj.error === 'string' && resObj.error.length > 0
            ? (resObj.error as string).toUpperCase().replace(/\s+/g, '_')
            : this.statusCodeToErrorCode(status);

        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
          fieldErrors = (resObj.message as string[]).map((msg: string) => {
            const parts = msg.split(' ');
            return {
              field: parts[0] || 'field',
              message: msg,
            };
          });
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      Sentry.captureException(exception);
      message = exception.message;
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    const errorBody: ApiErrorEnvelope = {
      error: {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
      },
    };

    response.status(status).json(errorBody);
  }

  private statusCodeToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
