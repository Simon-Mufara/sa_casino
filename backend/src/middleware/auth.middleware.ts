import { Request, Response, NextFunction } from 'express';
import { JwtUtil, TokenPayload } from '../shared/utils/jwt';
import { UnauthorizedError } from '../shared/errors/app-error';

/**
 * Extend Express Request to include user information
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user information to request
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = JwtUtil.verifyAccessToken(token);

    // Attach user to request
    req.user = payload;

    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired authentication token'));
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token is valid, but doesn't fail if missing
 */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = JwtUtil.verifyAccessToken(token);
      req.user = payload;
    }

    next();
  } catch (error) {
    // Ignore errors, user will be undefined
    next();
  }
};
