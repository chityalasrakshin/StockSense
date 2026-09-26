import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header('x-request-id');
    const requestId = supplied && supplied.length <= 128 ? supplied : randomUUID();
    response.setHeader('x-request-id', requestId);
    requestContext.run({ requestId }, next);
  }
}
