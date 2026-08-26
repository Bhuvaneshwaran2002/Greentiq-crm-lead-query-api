import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, UnauthorizedError } from '../errors.js';
import { prisma } from '../db/client.js';
import type { CurrentUser, UserRole } from '../types/lead-filter.js';

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

const authHeadersSchema = z.object({
  'x-tenant-id': z.string().trim().uuid('x-tenant-id must be a valid UUID'),
  'x-user-id': z.string().trim().uuid('x-user-id must be a valid UUID'),
  'x-user-role': z.enum(['owner', 'admin', 'manager', 'agent'] as const),
});

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const rawHeaders = {
    'x-tenant-id': req.headers['x-tenant-id'],
    'x-user-id': req.headers['x-user-id'],
    'x-user-role': req.headers['x-user-role'],
  };

  const result = authHeadersSchema.safeParse(rawHeaders);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('; ');
    const hasInvalidUuid = result.error.issues.some((issue) => {
      const header = issue.path[0];
      return (header === 'x-tenant-id' && rawHeaders['x-tenant-id'] !== undefined) || (header === 'x-user-id' && rawHeaders['x-user-id'] !== undefined);
    });
    next(new (hasInvalidUuid ? BadRequestError : UnauthorizedError)(`Missing or invalid auth headers. ${message}`));
    return;
  }

  const { 'x-tenant-id': tenantId, 'x-user-id': userId, 'x-user-role': role } = result.data;
  void prisma.user.findFirst({ where: { id: userId, tenantId }, select: { role: true } })
    .then((user) => {
      if (!user || user.role !== role) {
        next(new UnauthorizedError('User is not valid for this tenant or role'));
        return;
      }
      req.user = { tenantId, userId, role: user.role as UserRole };
      next();
    })
    .catch(() => next(new UnauthorizedError('Authentication service unavailable')));
}
