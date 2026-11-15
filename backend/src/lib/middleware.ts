import { MiddlewareHandler } from 'hono';
import { verifyAuthToken, AuthClaims } from '../services/tokens.js';
import { Errors } from './errors.js';
import { Role } from './validate.js';
import { Action, canPerform } from '../domain/permissions.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthClaims;
  }
}

/**
 * Authentication middleware: verifies Bearer JWT and sets `c.set('user', claims)`
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Errors.unauthorized('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7).trim();
  try {
    const claims = await verifyAuthToken(token);
    c.set('user', claims);
    await next();
  } catch (_err: unknown) {
    throw Errors.unauthorized('Invalid or expired token');
  }
};

/**
 * Authorization middleware: checks if current user has an allowed role
 */
export function requireRoles(roles: Role[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw Errors.unauthorized();
    }
    if (!roles.includes(user.role)) {
      throw Errors.forbidden(`Role '${user.role}' is not allowed to access this resource`);
    }
    await next();
  };
}

/**
 * Authorization middleware: checks if current user can perform the specified Action
 */
export function requirePermission(action: Action): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw Errors.unauthorized();
    }
    if (!canPerform(user.role, action)) {
      throw Errors.forbidden(`Role '${user.role}' cannot perform '${action}'`);
    }
    await next();
  };
}
