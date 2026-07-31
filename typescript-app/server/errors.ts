import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { config } from './config.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ message: 'Not found' });
};

function isPostgresError(error: unknown): error is { code?: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join('.');
    const message = field ? `${field}: ${issue.message}` : (issue?.message ?? 'Invalid request');
    response.status(400).json({ message });
    return;
  }

  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    response.status(400).json({ message: 'Invalid JSON body' });
    return;
  }

  if (
    typeof error === 'object'
    && error !== null
    && 'type' in error
    && error.type === 'entity.too.large'
  ) {
    response.status(413).json({ message: 'Request body is too large' });
    return;
  }

  if (isPostgresError(error) && error.code === '23505') {
    const message = error.constraint?.includes('users_email')
      ? 'Email already registered'
      : error.constraint?.includes('saved_groups')
        ? 'A group with that name already exists'
        : 'That saved player already exists';
    response.status(409).json({ message });
    return;
  }

  if (
    isPostgresError(error)
    && error.code
    && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03'].includes(error.code)
  ) {
    console.error('Database unavailable', error);
    response.status(503).json({ message: 'Database temporarily unavailable' });
    return;
  }

  console.error('Unhandled request error', error);
  response.status(500).json({
    message: config.isProduction ? 'Internal server error' : 'Unexpected server error',
  });
};
