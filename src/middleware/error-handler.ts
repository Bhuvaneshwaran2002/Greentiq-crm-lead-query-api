import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('Route not found', 404));
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (!(error instanceof AppError)) console.error('Unhandled request error', error instanceof Error ? error.message : error);
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'error', message: 'Malformed JSON request body' });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};
